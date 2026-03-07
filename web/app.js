(function () {
  "use strict";

  const API_URL = "http://localhost:9601";

  // ── DOM refs ────────────────────────────────────────────
  const fileInput = document.getElementById("file-input");
  const dropZone = document.getElementById("drop-zone");
  const imageInfo = document.getElementById("image-info");
  const infoFilename = document.getElementById("info-filename");
  const infoDimensions = document.getElementById("info-dimensions");
  const uploadActions = document.getElementById("upload-actions");
  const btnRemoveBG = document.getElementById("btn-remove-bg");
  const bgTolerance = document.getElementById("bg-tolerance");
  const canvasSection = document.getElementById("canvas-section");
  const canvasWrapper = document.getElementById("canvas-wrapper");
  const mainCanvas = document.getElementById("main-canvas");
  const inputRows = document.getElementById("input-rows");
  const inputCols = document.getElementById("input-cols");
  const btnGenerate = document.getElementById("btn-generate");
  const previewSection = document.getElementById("preview-section");
  const previewGrid = document.getElementById("preview-grid");
  const exportSection = document.getElementById("export-section");
  const inputPrefix = document.getElementById("input-prefix");
  const btnExport = document.getElementById("btn-export");
  const exportStatus = document.getElementById("export-status");
  const animSection = document.getElementById("anim-section");
  const animCanvas = document.getElementById("anim-canvas");
  const animStrip = document.getElementById("anim-strip");
  const animFps = document.getElementById("anim-fps");
  const btnAnimPlay = document.getElementById("btn-anim-play");
  const btnAnimStop = document.getElementById("btn-anim-stop");
  const btnAnimSelectAll = document.getElementById("btn-anim-select-all");
  const btnAnimDeselect = document.getElementById("btn-anim-deselect");
  const btnExportGIF = document.getElementById("btn-export-gif");
  const gifStatus = document.getElementById("gif-status");

  const ctx = mainCanvas.getContext("2d");

  // ── State ───────────────────────────────────────────────
  let loadedImage = null;
  let originalFile = null;
  let frames = [];
  let gridRows = 1;
  let gridCols = 1;

  // Grid line positions (pixel coords on the image)
  let hLines = []; // horizontal lines (rows+1 values)
  let vLines = []; // vertical lines (cols+1 values)
  let draggingLine = null; // {type:'h'|'v', index}

  // Animation state
  let animSelectedIndices = new Set();
  let animTimer = null;
  let animCurrentFrame = 0;

  // ── Upload ──────────────────────────────────────────────

  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length) handleFile(e.target.files[0]);
  });

  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragover");
  });

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
  });

  function handleFile(file) {
    if (!file.type.match(/^image\/(png|jpeg)$/)) {
      alert("Please upload a PNG or JPEG image.");
      return;
    }
    originalFile = file;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        loadedImage = img;
        showImageInfo(file.name, img.width, img.height);
        drawMainCanvas();
        canvasSection.classList.remove("hidden");
        uploadActions.classList.remove("hidden");
        previewSection.classList.add("hidden");
        exportSection.classList.add("hidden");
        animSection.classList.add("hidden");
        frames = [];
        stopAnimation();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function showImageInfo(name, w, h) {
    infoFilename.textContent = name;
    infoDimensions.textContent = w + " \u00d7 " + h + " px";
    imageInfo.classList.remove("hidden");
  }

  // ── Remove Background ──────────────────────────────────

  btnRemoveBG.addEventListener("click", async () => {
    if (!originalFile) return;

    btnRemoveBG.disabled = true;
    btnRemoveBG.textContent = "Processing...";

    try {
      const formData = new FormData();
      formData.append("image", originalFile);
      formData.append("tolerance", bgTolerance.value);

      const res = await fetch(API_URL + "/api/remove-bg", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "Failed with status " + res.status);
      }

      const blob = await res.blob();
      originalFile = new File([blob], originalFile.name.replace(/\.\w+$/, ".png"), { type: "image/png" });

      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        loadedImage = img;
        showImageInfo(originalFile.name, img.width, img.height);
        drawMainCanvas();
        if (frames.length > 0) {
          rebuildFramesFromGrid();
          renderPreviews();
        }
        URL.revokeObjectURL(url);
      };
      img.src = url;
    } catch (err) {
      alert("Remove background failed: " + err.message);
    } finally {
      btnRemoveBG.disabled = false;
      btnRemoveBG.textContent = "Remove Background";
    }
  });

  // ── Main Canvas ─────────────────────────────────────────

  function drawMainCanvas() {
    if (!loadedImage) return;
    mainCanvas.width = loadedImage.width;
    mainCanvas.height = loadedImage.height;
    ctx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
    ctx.drawImage(loadedImage, 0, 0);
  }

  function drawGridOverlay() {
    if (!loadedImage || hLines.length === 0) return;

    ctx.save();
    ctx.strokeStyle = "rgba(91, 76, 219, 0.7)";
    ctx.lineWidth = 2;

    for (let i = 0; i < hLines.length; i++) {
      const y = hLines[i];
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(mainCanvas.width, y);
      ctx.stroke();
    }
    for (let i = 0; i < vLines.length; i++) {
      const x = vLines[i];
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, mainCanvas.height);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(91, 76, 219, 0.15)";
    for (let i = 0; i < hLines.length; i++) {
      ctx.fillRect(0, hLines[i] - 3, mainCanvas.width, 6);
    }
    for (let i = 0; i < vLines.length; i++) {
      ctx.fillRect(vLines[i] - 3, 0, 6, mainCanvas.height);
    }

    ctx.restore();
  }

  function redrawCanvasWithGrid() {
    drawMainCanvas();
    drawGridOverlay();
  }

  // ── Interactive Grid Dragging on Main Canvas ────────────

  function canvasMousePos(e) {
    const rect = mainCanvas.getBoundingClientRect();
    const scaleX = mainCanvas.width / rect.width;
    const scaleY = mainCanvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  mainCanvas.addEventListener("mousedown", (e) => {
    if (hLines.length === 0) return;
    const pos = canvasMousePos(e);
    const threshold = 8 * (mainCanvas.width / mainCanvas.getBoundingClientRect().width);

    for (let i = 1; i < hLines.length - 1; i++) {
      if (Math.abs(pos.y - hLines[i]) < threshold) {
        draggingLine = { type: "h", index: i };
        mainCanvas.style.cursor = "row-resize";
        return;
      }
    }
    for (let i = 1; i < vLines.length - 1; i++) {
      if (Math.abs(pos.x - vLines[i]) < threshold) {
        draggingLine = { type: "v", index: i };
        mainCanvas.style.cursor = "col-resize";
        return;
      }
    }
  });

  mainCanvas.addEventListener("mousemove", (e) => {
    if (hLines.length === 0) return;
    const pos = canvasMousePos(e);

    if (draggingLine) {
      if (draggingLine.type === "h") {
        const minY = hLines[draggingLine.index - 1] + 4;
        const maxY = hLines[draggingLine.index + 1] - 4;
        hLines[draggingLine.index] = Math.max(minY, Math.min(maxY, Math.round(pos.y)));
      } else {
        const minX = vLines[draggingLine.index - 1] + 4;
        const maxX = vLines[draggingLine.index + 1] - 4;
        vLines[draggingLine.index] = Math.max(minX, Math.min(maxX, Math.round(pos.x)));
      }
      redrawCanvasWithGrid();
      return;
    }

    const threshold = 8 * (mainCanvas.width / mainCanvas.getBoundingClientRect().width);
    let cursor = "default";
    for (let i = 1; i < hLines.length - 1; i++) {
      if (Math.abs(pos.y - hLines[i]) < threshold) { cursor = "row-resize"; break; }
    }
    if (cursor === "default") {
      for (let i = 1; i < vLines.length - 1; i++) {
        if (Math.abs(pos.x - vLines[i]) < threshold) { cursor = "col-resize"; break; }
      }
    }
    mainCanvas.style.cursor = cursor;
  });

  window.addEventListener("mouseup", () => {
    if (draggingLine) {
      draggingLine = null;
      mainCanvas.style.cursor = "default";
      rebuildFramesFromGrid();
      renderPreviews();
    }
  });

  // ── Grid Generation ─────────────────────────────────────

  btnGenerate.addEventListener("click", () => {
    if (!loadedImage) return;

    gridRows = parseInt(inputRows.value, 10) || 1;
    gridCols = parseInt(inputCols.value, 10) || 1;

    hLines = [];
    for (let r = 0; r <= gridRows; r++) {
      hLines.push(Math.round((r * loadedImage.height) / gridRows));
    }
    vLines = [];
    for (let c = 0; c <= gridCols; c++) {
      vLines.push(Math.round((c * loadedImage.width) / gridCols));
    }

    rebuildFramesFromGrid();
    redrawCanvasWithGrid();
    renderPreviews();
    previewSection.classList.remove("hidden");
    exportSection.classList.remove("hidden");
    animSection.classList.remove("hidden");
    buildAnimStrip();
  });

  function rebuildFramesFromGrid() {
    frames = [];
    let id = 0;
    for (let r = 0; r < hLines.length - 1; r++) {
      for (let c = 0; c < vLines.length - 1; c++) {
        frames.push({
          id: id++,
          x: vLines[c],
          y: hLines[r],
          width: vLines[c + 1] - vLines[c],
          height: hLines[r + 1] - hLines[r],
        });
      }
    }
  }

  // ── Previews with Zoom & Drag ───────────────────────────

  function renderPreviews() {
    previewGrid.innerHTML = "";

    frames.forEach((frame) => {
      const item = document.createElement("div");
      item.className = "preview-item";

      const previewSize = 128;
      const canvas = document.createElement("canvas");
      canvas.width = previewSize;
      canvas.height = previewSize;

      let zoom = 1.0;
      let panX = 0;
      let panY = 0;

      function draw() {
        const pctx = canvas.getContext("2d");
        pctx.clearRect(0, 0, previewSize, previewSize);

        const baseScale = Math.min(previewSize / frame.width, previewSize / frame.height);
        const scale = baseScale * zoom;
        const dw = frame.width * scale;
        const dh = frame.height * scale;
        const dx = (previewSize - dw) / 2 + panX;
        const dy = (previewSize - dh) / 2 + panY;

        pctx.drawImage(loadedImage, frame.x, frame.y, frame.width, frame.height, dx, dy, dw, dh);
      }

      draw();

      // Drag to pan
      let isDragging = false;
      let dragStartX, dragStartY, startPanX, startPanY;

      canvas.addEventListener("mousedown", (e) => {
        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        startPanX = panX;
        startPanY = panY;
      });

      canvas.addEventListener("mousemove", (e) => {
        if (!isDragging) return;
        panX = startPanX + (e.clientX - dragStartX);
        panY = startPanY + (e.clientY - dragStartY);
        draw();
      });

      window.addEventListener("mouseup", () => {
        isDragging = false;
      });

      const label = document.createElement("div");
      label.className = "frame-label";
      function updateLabel() {
        label.textContent = "#" + (frame.id + 1) + "  (" + frame.x + "," + frame.y + " " + frame.width + "\u00d7" + frame.height + ")";
      }
      updateLabel();

      // Toolbar: zoom buttons
      const toolbar = document.createElement("div");
      toolbar.className = "preview-toolbar";

      const btnZoomIn = document.createElement("button");
      btnZoomIn.className = "btn btn-outline btn-sm";
      btnZoomIn.textContent = "+";
      btnZoomIn.title = "Zoom in";
      btnZoomIn.addEventListener("click", () => { zoom = Math.min(zoom + 0.25, 5); draw(); });

      const btnZoomOut = document.createElement("button");
      btnZoomOut.className = "btn btn-outline btn-sm";
      btnZoomOut.textContent = "\u2013";
      btnZoomOut.title = "Zoom out";
      btnZoomOut.addEventListener("click", () => { zoom = Math.max(zoom - 0.25, 0.25); draw(); });

      const btnReset = document.createElement("button");
      btnReset.className = "btn btn-outline btn-sm";
      btnReset.textContent = "1:1";
      btnReset.title = "Reset zoom & pan";
      btnReset.addEventListener("click", () => { zoom = 1; panX = 0; panY = 0; draw(); });

      toolbar.appendChild(btnZoomOut);
      toolbar.appendChild(btnReset);
      toolbar.appendChild(btnZoomIn);

      // Offset controls (X, Y, W, H)
      const controls = document.createElement("div");
      controls.className = "offset-controls";

      const xGroup = createOffsetInput("X", frame.x, (val) => {
        frame.x = val; draw(); updateLabel();
      });
      const yGroup = createOffsetInput("Y", frame.y, (val) => {
        frame.y = val; draw(); updateLabel();
      });
      const wGroup = createOffsetInput("W", frame.width, (val) => {
        frame.width = Math.max(1, val); draw(); updateLabel();
      });
      const hGroup = createOffsetInput("H", frame.height, (val) => {
        frame.height = Math.max(1, val); draw(); updateLabel();
      });

      controls.appendChild(xGroup);
      controls.appendChild(yGroup);
      controls.appendChild(wGroup);
      controls.appendChild(hGroup);

      item.appendChild(canvas);
      item.appendChild(toolbar);
      item.appendChild(label);
      item.appendChild(controls);
      previewGrid.appendChild(item);
    });
  }

  function createOffsetInput(labelText, initialValue, onChange) {
    const group = document.createElement("div");
    group.className = "input-group";

    const lbl = document.createElement("label");
    lbl.textContent = labelText;

    const input = document.createElement("input");
    input.type = "number";
    input.value = initialValue;
    input.addEventListener("input", () => {
      onChange(parseInt(input.value, 10) || 0);
    });

    group.appendChild(lbl);
    group.appendChild(input);
    return group;
  }

  // ── Export ZIP ──────────────────────────────────────────

  btnExport.addEventListener("click", async () => {
    if (!originalFile || frames.length === 0) return;

    const prefix = inputPrefix.value.trim() || "sprite";
    const config = JSON.stringify({ prefix, frames });

    const formData = new FormData();
    formData.append("image", originalFile);
    formData.append("config", config);

    btnExport.disabled = true;
    btnExport.textContent = "Exporting...";
    showStatus(exportStatus, "", "");

    try {
      const res = await fetch(API_URL + "/api/export", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "Export failed with status " + res.status);
      }

      const blob = await res.blob();
      triggerDownload(blob, "export.zip");
      showStatus(exportStatus, "Export successful! ZIP downloaded.", "success");
    } catch (err) {
      showStatus(exportStatus, "Error: " + err.message, "error");
    } finally {
      btnExport.disabled = false;
      btnExport.textContent = "Export Sliced Images (ZIP)";
    }
  });

  // ── Animation ──────────────────────────────────────────

  function buildAnimStrip() {
    animStrip.innerHTML = "";
    animSelectedIndices = new Set();

    frames.forEach((frame, idx) => {
      const thumb = document.createElement("canvas");
      thumb.width = 56;
      thumb.height = 56;
      thumb.className = "anim-frame-thumb";
      thumb.title = "Frame #" + (idx + 1);

      const tctx = thumb.getContext("2d");
      const scale = Math.min(56 / frame.width, 56 / frame.height);
      const dw = frame.width * scale;
      const dh = frame.height * scale;
      tctx.drawImage(loadedImage, frame.x, frame.y, frame.width, frame.height, (56 - dw) / 2, (56 - dh) / 2, dw, dh);

      thumb.addEventListener("click", () => {
        if (animSelectedIndices.has(idx)) {
          animSelectedIndices.delete(idx);
          thumb.classList.remove("selected");
        } else {
          animSelectedIndices.add(idx);
          thumb.classList.add("selected");
        }
      });

      animStrip.appendChild(thumb);
    });
  }

  btnAnimSelectAll.addEventListener("click", () => {
    animSelectedIndices.clear();
    frames.forEach((_, idx) => animSelectedIndices.add(idx));
    animStrip.querySelectorAll(".anim-frame-thumb").forEach((t) => t.classList.add("selected"));
  });

  btnAnimDeselect.addEventListener("click", () => {
    animSelectedIndices.clear();
    animStrip.querySelectorAll(".anim-frame-thumb").forEach((t) => t.classList.remove("selected"));
  });

  btnAnimPlay.addEventListener("click", () => {
    startAnimation();
  });

  btnAnimStop.addEventListener("click", () => {
    stopAnimation();
  });

  function startAnimation() {
    stopAnimation();
    const selectedFrames = getSelectedFrames();
    if (selectedFrames.length === 0) return;

    animCurrentFrame = 0;
    const fps = parseInt(animFps.value, 10) || 10;
    const interval = 1000 / fps;

    renderAnimFrame(selectedFrames[0]);

    animTimer = setInterval(() => {
      animCurrentFrame = (animCurrentFrame + 1) % selectedFrames.length;
      renderAnimFrame(selectedFrames[animCurrentFrame]);
    }, interval);
  }

  function stopAnimation() {
    if (animTimer) {
      clearInterval(animTimer);
      animTimer = null;
    }
  }

  function renderAnimFrame(frame) {
    const actx = animCanvas.getContext("2d");
    const size = 256;
    animCanvas.width = size;
    animCanvas.height = size;
    actx.clearRect(0, 0, size, size);

    const scale = Math.min(size / frame.width, size / frame.height);
    const dw = frame.width * scale;
    const dh = frame.height * scale;
    const dx = (size - dw) / 2;
    const dy = (size - dh) / 2;

    actx.drawImage(loadedImage, frame.x, frame.y, frame.width, frame.height, dx, dy, dw, dh);
  }

  function getSelectedFrames() {
    const indices = Array.from(animSelectedIndices).sort((a, b) => a - b);
    return indices.map((i) => frames[i]);
  }

  // ── Export GIF ─────────────────────────────────────────

  btnExportGIF.addEventListener("click", async () => {
    const selectedFrames = getSelectedFrames();
    if (selectedFrames.length === 0 || !originalFile) {
      alert("Please select at least one frame for the GIF.");
      return;
    }

    const fps = parseInt(animFps.value, 10) || 10;
    const delay = Math.round(100 / fps);

    const config = JSON.stringify({ frames: selectedFrames, delay });

    const formData = new FormData();
    formData.append("image", originalFile);
    formData.append("config", config);

    btnExportGIF.disabled = true;
    btnExportGIF.textContent = "Generating...";
    showStatus(gifStatus, "", "");

    try {
      const res = await fetch(API_URL + "/api/export-gif", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "GIF export failed with status " + res.status);
      }

      const blob = await res.blob();
      triggerDownload(blob, "animation.gif");
      showStatus(gifStatus, "GIF exported successfully!", "success");
    } catch (err) {
      showStatus(gifStatus, "Error: " + err.message, "error");
    } finally {
      btnExportGIF.disabled = false;
      btnExportGIF.textContent = "Export GIF";
    }
  });

  // ── Helpers ─────────────────────────────────────────────

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function showStatus(el, msg, type) {
    if (!msg) {
      el.classList.add("hidden");
      return;
    }
    el.textContent = msg;
    el.className = "export-status " + type;
    el.classList.remove("hidden");
  }
})();
