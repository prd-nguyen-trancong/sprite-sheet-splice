(function () {
  "use strict";

  const API_URL = "http://localhost:9601";

  // DOM refs
  const fileInput = document.getElementById("file-input");
  const dropZone = document.getElementById("drop-zone");
  const imageInfo = document.getElementById("image-info");
  const infoFilename = document.getElementById("info-filename");
  const infoDimensions = document.getElementById("info-dimensions");
  const canvasSection = document.getElementById("canvas-section");
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

  const ctx = mainCanvas.getContext("2d");

  // State
  let loadedImage = null; // HTMLImageElement
  let originalFile = null; // File blob
  let frames = []; // [{id, x, y, width, height}]

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
        previewSection.classList.add("hidden");
        exportSection.classList.add("hidden");
        frames = [];
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function showImageInfo(name, w, h) {
    infoFilename.textContent = name;
    infoDimensions.textContent = w + " × " + h + " px";
    imageInfo.classList.remove("hidden");
  }

  // ── Main Canvas ─────────────────────────────────────────

  function drawMainCanvas() {
    if (!loadedImage) return;
    mainCanvas.width = loadedImage.width;
    mainCanvas.height = loadedImage.height;
    ctx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
    ctx.drawImage(loadedImage, 0, 0);
  }

  function drawGrid(rows, cols) {
    if (!loadedImage) return;
    const w = loadedImage.width / cols;
    const h = loadedImage.height / rows;

    ctx.save();
    ctx.strokeStyle = "rgba(108, 92, 231, 0.8)";
    ctx.lineWidth = 1;

    for (let r = 0; r <= rows; r++) {
      const y = Math.round(r * h);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(mainCanvas.width, y);
      ctx.stroke();
    }
    for (let c = 0; c <= cols; c++) {
      const x = Math.round(c * w);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, mainCanvas.height);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ── Grid Generation ─────────────────────────────────────

  btnGenerate.addEventListener("click", () => {
    if (!loadedImage) return;

    const rows = parseInt(inputRows.value, 10) || 1;
    const cols = parseInt(inputCols.value, 10) || 1;

    const itemWidth = Math.floor(loadedImage.width / cols);
    const itemHeight = Math.floor(loadedImage.height / rows);

    frames = [];
    let id = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        frames.push({
          id: id++,
          x: c * itemWidth,
          y: r * itemHeight,
          width: itemWidth,
          height: itemHeight,
        });
      }
    }

    drawMainCanvas();
    drawGrid(rows, cols);
    renderPreviews();
    previewSection.classList.remove("hidden");
    exportSection.classList.remove("hidden");
  });

  // ── Previews ────────────────────────────────────────────

  function renderPreviews() {
    previewGrid.innerHTML = "";

    frames.forEach((frame) => {
      const item = document.createElement("div");
      item.className = "preview-item";

      const previewSize = 128;
      const canvas = document.createElement("canvas");
      canvas.width = previewSize;
      canvas.height = previewSize;
      drawPreview(canvas, frame, previewSize);

      const label = document.createElement("div");
      label.className = "frame-label";
      label.textContent =
        "#" + (frame.id + 1) + "  (" + frame.x + ", " + frame.y + ")";

      const controls = document.createElement("div");
      controls.className = "offset-controls";

      const xGroup = createOffsetInput("X", frame.x, (val) => {
        frame.x = val;
        drawPreview(canvas, frame, previewSize);
        label.textContent =
          "#" + (frame.id + 1) + "  (" + frame.x + ", " + frame.y + ")";
      });

      const yGroup = createOffsetInput("Y", frame.y, (val) => {
        frame.y = val;
        drawPreview(canvas, frame, previewSize);
        label.textContent =
          "#" + (frame.id + 1) + "  (" + frame.x + ", " + frame.y + ")";
      });

      controls.appendChild(xGroup);
      controls.appendChild(yGroup);

      item.appendChild(canvas);
      item.appendChild(label);
      item.appendChild(controls);
      previewGrid.appendChild(item);
    });
  }

  function drawPreview(canvas, frame, size) {
    const pctx = canvas.getContext("2d");
    pctx.clearRect(0, 0, size, size);

    const scale = Math.min(size / frame.width, size / frame.height);
    const dw = frame.width * scale;
    const dh = frame.height * scale;
    const dx = (size - dw) / 2;
    const dy = (size - dh) / 2;

    pctx.drawImage(
      loadedImage,
      frame.x,
      frame.y,
      frame.width,
      frame.height,
      dx,
      dy,
      dw,
      dh
    );
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

  // ── Export ──────────────────────────────────────────────

  btnExport.addEventListener("click", async () => {
    if (!originalFile || frames.length === 0) return;

    const prefix = inputPrefix.value.trim() || "sprite";
    const config = JSON.stringify({ prefix, frames });

    const formData = new FormData();
    formData.append("image", originalFile);
    formData.append("config", config);

    btnExport.disabled = true;
    btnExport.textContent = "Exporting...";
    showStatus("", "");

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
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "export.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showStatus("Export successful! ZIP downloaded.", "success");
    } catch (err) {
      showStatus("Error: " + err.message, "error");
    } finally {
      btnExport.disabled = false;
      btnExport.textContent = "Export Sliced Images (ZIP)";
    }
  });

  function showStatus(msg, type) {
    if (!msg) {
      exportStatus.classList.add("hidden");
      return;
    }
    exportStatus.textContent = msg;
    exportStatus.className = "export-status " + type;
    exportStatus.classList.remove("hidden");
  }
})();
