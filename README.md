# Sprite Sheet Slicer & Asset Generator

A web-based internal tool for Game Developers/Designers to upload a master sprite sheet, optionally remove its background, divide it using an interactive grid system, preview and fine-tune each frame with zoom/pan controls, create animations from selected frames, and export sliced images as a ZIP or animated GIF -- all compatible with the **Flutter Flame Engine**.

## Architecture

A single Go binary launches two HTTP servers concurrently:

| Server   | Port   | Purpose                                                  |
|----------|--------|----------------------------------------------------------|
| Web UI   | `9600` | Serves static HTML/CSS/JS (the editor interface)         |
| REST API | `9601` | Handles image processing, slicing, BG removal, GIF/ZIP export |

The API server has CORS configured to accept requests from `http://localhost:9600`.

## Project Structure

```
sprite_sheet_tool/
├── main.go                    # Entry point (launches both servers)
├── go.mod
├── internal/
│   ├── api/
│   │   ├── server.go          # API mux + CORS middleware
│   │   └── handler.go         # Export, RemoveBG, ExportGIF handlers
│   ├── models/
│   │   └── models.go          # ExportRequest, FrameData, GIFRequest
│   └── slicer/
│       ├── slicer.go          # Image decode, crop, in-memory ZIP
│       ├── removebg.go        # Background removal (corner-detection)
│       └── gif.go             # Animated GIF generation
├── web/
│   ├── index.html
│   ├── style.css
│   └── app.js
├── Containerfile              # Multi-stage container build
├── podman-compose.yml
└── README.md
```

## Prerequisites

- **Go 1.25+** (for local development)
- **Podman** + **podman-compose** (macOS) or **Docker** + **docker-compose** (Ubuntu/Linux)

## Quick Start

### Option 1: Run locally with Go

```bash
go run main.go
```

Open http://localhost:9600 in your browser.

### Option 2: Container (macOS with Podman)

```bash
podman-compose up --build
```

Open http://localhost:9600 in your browser.

To stop:

```bash
podman-compose down
```

### Option 3: Container (Ubuntu/Linux with Docker)

```bash
docker-compose -f podman-compose.yml up --build
```

Open http://localhost:9600 in your browser.

To stop:

```bash
docker-compose -f podman-compose.yml down
```

## Features

### 1. Upload Sprite Sheet
- Drag-and-drop or click to upload a PNG/JPEG sprite sheet.
- Displays filename and original dimensions.

### 2. Remove Background
- Click **Remove Background** to auto-detect the background color (from corner pixels) and replace it with transparency.
- Adjust the **Tolerance** slider (0-255) to control how aggressively similar colors are removed.
- The processed image replaces the original in-memory for all subsequent operations.

### 3. Interactive Grid
- Enter rows and columns, then click **Generate Grid & Preview**.
- Grid lines are drawn on the main canvas as a visual overlay.
- **Drag grid lines** directly on the canvas to adjust cell boundaries. The preview frames update automatically when you release.

### 4. Preview & Fine-tune
- Each sliced frame appears as a preview thumbnail with controls:
  - **Zoom In (+) / Zoom Out (-) / Reset (1:1)** buttons to inspect detail.
  - **Drag to pan** within each preview canvas.
  - **X, Y, W, H** numeric inputs to precisely adjust the crop region per frame.
- All changes apply in real-time.

### 5. Export ZIP
- Enter a filename prefix (e.g., `player_run`), then click **Export Sliced Images (ZIP)**.
- The ZIP contains:
  - `images/<prefix>_01.png`, `images/<prefix>_02.png`, ...
  - `metadata.json` with Flame-compatible sprite mapping.

### 6. Animation Preview & GIF Export
- Click frames in the strip to select/deselect them for the animation.
- Use **Select All** / **Deselect All** for convenience.
- Adjust **FPS** and click **Play** to preview the animation.
- Click **Export GIF** to generate and download an animated GIF from the selected frames.

## API Reference

### POST /api/export

Slices the sprite sheet and returns a ZIP.

| Field    | Type   | Description                                              |
|----------|--------|----------------------------------------------------------|
| `image`  | File   | The sprite sheet image (PNG or JPEG)                     |
| `config` | String | JSON: `{"prefix": "...", "frames": [{id,x,y,width,height}]}` |

**Response:** `application/zip`

### POST /api/remove-bg

Removes the background color and returns a transparent PNG.

| Field       | Type   | Description                          |
|-------------|--------|--------------------------------------|
| `image`     | File   | The sprite sheet image               |
| `tolerance` | String | Color distance tolerance (0-255, default 30) |

**Response:** `image/png`

### POST /api/export-gif

Generates an animated GIF from selected frames.

| Field    | Type   | Description                                              |
|----------|--------|----------------------------------------------------------|
| `image`  | File   | The sprite sheet image                                   |
| `config` | String | JSON: `{"frames": [{id,x,y,width,height}], "delay": 10}` |

`delay` is in hundredths of a second (e.g., 10 = 100ms per frame = 10 FPS).

**Response:** `image/gif`

## License

Internal tool -- not for public distribution.
