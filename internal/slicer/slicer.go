package slicer

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"fmt"
	"image"
	"image/png"
	"io"

	_ "image/jpeg"

	"sprite_sheet_tool/internal/models"
)

type subImager interface {
	SubImage(r image.Rectangle) image.Image
}

type MetadataFrame struct {
	X      int `json:"x"`
	Y      int `json:"y"`
	Width  int `json:"width"`
	Height int `json:"height"`
}

type Metadata struct {
	SpriteSheet string                   `json:"spriteSheet"`
	Frames      map[string]MetadataFrame `json:"frames"`
}

// Process decodes the uploaded image, crops each frame according to the
// provided coordinates, and returns an in-memory ZIP containing the sliced
// PNGs under images/ plus a metadata.json for Flutter Flame.
func Process(imageReader io.Reader, originalFilename string, req models.ExportRequest) (*bytes.Buffer, error) {
	img, _, err := image.Decode(imageReader)
	if err != nil {
		return nil, fmt.Errorf("failed to decode image: %w", err)
	}

	simg, ok := img.(subImager)
	if !ok {
		return nil, fmt.Errorf("image type does not support SubImage cropping")
	}

	buf := new(bytes.Buffer)
	zw := zip.NewWriter(buf)

	metadata := Metadata{
		SpriteSheet: originalFilename,
		Frames:      make(map[string]MetadataFrame),
	}

	digits := digitCount(len(req.Frames))

	for i, frame := range req.Frames {
		rect := image.Rect(frame.X, frame.Y, frame.X+frame.Width, frame.Y+frame.Height)
		cropped := simg.SubImage(rect)

		filename := fmt.Sprintf("%s_%0*d.png", req.Prefix, digits, i+1)
		path := "images/" + filename

		fw, err := zw.Create(path)
		if err != nil {
			return nil, fmt.Errorf("failed to create zip entry %s: %w", path, err)
		}
		if err := png.Encode(fw, cropped); err != nil {
			return nil, fmt.Errorf("failed to encode png %s: %w", filename, err)
		}

		metadata.Frames[filename] = MetadataFrame{
			X:      frame.X,
			Y:      frame.Y,
			Width:  frame.Width,
			Height: frame.Height,
		}
	}

	mw, err := zw.Create("metadata.json")
	if err != nil {
		return nil, fmt.Errorf("failed to create metadata.json in zip: %w", err)
	}
	enc := json.NewEncoder(mw)
	enc.SetIndent("", "  ")
	if err := enc.Encode(metadata); err != nil {
		return nil, fmt.Errorf("failed to encode metadata.json: %w", err)
	}

	if err := zw.Close(); err != nil {
		return nil, fmt.Errorf("failed to finalize zip: %w", err)
	}

	return buf, nil
}

func digitCount(n int) int {
	if n < 10 {
		return 2
	}
	count := 0
	for n > 0 {
		count++
		n /= 10
	}
	return count
}
