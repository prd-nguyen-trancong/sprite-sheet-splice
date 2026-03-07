package slicer

import (
	"bytes"
	"fmt"
	"image"
	"image/color/palette"
	"image/draw"
	"image/gif"
	"io"

	"sprite_sheet_tool/internal/models"
)

// GenerateGIF decodes the source image, crops the specified frames, and
// assembles them into an animated GIF with the given delay per frame
// (in hundredths of a second).
func GenerateGIF(imageReader io.Reader, req models.GIFRequest) (*bytes.Buffer, error) {
	img, _, err := image.Decode(imageReader)
	if err != nil {
		return nil, fmt.Errorf("failed to decode image: %w", err)
	}

	simg, ok := img.(subImager)
	if !ok {
		return nil, fmt.Errorf("image type does not support SubImage cropping")
	}

	if len(req.Frames) == 0 {
		return nil, fmt.Errorf("no frames provided")
	}

	anim := &gif.GIF{}

	for _, frame := range req.Frames {
		rect := image.Rect(frame.X, frame.Y, frame.X+frame.Width, frame.Y+frame.Height)
		cropped := simg.SubImage(rect)

		palettedImg := image.NewPaletted(image.Rect(0, 0, frame.Width, frame.Height), palette.Plan9)
		draw.FloydSteinberg.Draw(palettedImg, palettedImg.Bounds(), cropped, cropped.Bounds().Min)

		anim.Image = append(anim.Image, palettedImg)
		anim.Delay = append(anim.Delay, req.Delay)
	}

	anim.LoopCount = 0

	buf := new(bytes.Buffer)
	if err := gif.EncodeAll(buf, anim); err != nil {
		return nil, fmt.Errorf("failed to encode gif: %w", err)
	}
	return buf, nil
}
