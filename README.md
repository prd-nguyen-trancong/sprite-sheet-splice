# Sprite Sheet Slicer & Asset Generator

A web-based internal tool for Game Developers/Designers to upload a master sprite sheet, divide it using a grid system (rows/columns), preview and fine-tune each frame, and export a ZIP containing sliced images with a `metadata.json` compatible with the **Flutter Flame Engine**.

## Architecture

A single Go binary launches two HTTP servers concurrently:

| Server       | Port   | Purpose                                          |
|-------------|--------|--------------------------------------------------|
| Web UI      | `9600` | Serves static HTML/CSS/JS (the editor interface) |
| REST API    | `9601` | Handles image slicing and ZIP export             |

The API server has CORS configured to accept requests from `http://localhost:9600`.

## Project Structure

```
sprite_sheet_tool/
├── main.go                    # Entry point (launches both servers)
├── go.mod
├── internal/
│   ├── api/
│   │   ├── server.go          # API mux + CORS middleware
│   │   ├── handler.go         # POST /api/export handler
│   │   └── models.go          # (re-exports note)
│   ├── models/
│   │   └── models.go          # Shared ExportRequest / FrameData structs
│   └── slicer/
│       └── slicer.go          # Image decode, crop, in-memory ZIP
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

## Usage

1. **Upload** -- Click the upload area or drag-and-drop a PNG/JPEG sprite sheet.
2. **Configure Grid** -- Enter the number of rows and columns, then click **Generate Grid & Preview**.
3. **Fine-tune** -- Each sliced frame appears as a preview thumbnail. Adjust the X and Y offset inputs below any frame to shift its crop region. Changes render in real-time.
4. **Export** -- Enter a filename prefix (e.g. `player_run`), then click **Export Sliced Images (ZIP)**.

The downloaded `export.zip` contains:

```
export.zip
├── images/
│   ├── player_run_01.png
│   ├── player_run_02.png
│   └── ...
└── metadata.json
```

### metadata.json format

```json
{
  "spriteSheet": "original_filename.png",
  "frames": {
    "player_run_01.png": { "x": 0, "y": 0, "width": 64, "height": 64 },
    "player_run_02.png": { "x": 64, "y": 0, "width": 64, "height": 64 }
  }
}
```

## API Reference

### POST /api/export

**Content-Type:** `multipart/form-data`

| Field    | Type   | Description                                              |
|----------|--------|----------------------------------------------------------|
| `image`  | File   | The original sprite sheet image (PNG or JPEG)            |
| `config` | String | JSON string: `{"prefix": "...", "frames": [{...}, ...]}` |

**Response:** `application/zip` binary stream with `Content-Disposition: attachment; filename="export.zip"`.

## License

Internal tool -- not for public distribution.
