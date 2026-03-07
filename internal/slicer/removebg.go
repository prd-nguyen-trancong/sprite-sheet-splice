package slicer

import (
	"bytes"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"image/png"
	"io"
	"math"
)

// RemoveBackground detects the dominant background color from the image corners
// and replaces all pixels within the given tolerance with full transparency.
// Returns the resulting PNG as bytes.
func RemoveBackground(imageReader io.Reader, tolerance int) (*bytes.Buffer, error) {
	img, _, err := image.Decode(imageReader)
	if err != nil {
		return nil, fmt.Errorf("failed to decode image: %w", err)
	}

	bounds := img.Bounds()
	rgba := image.NewRGBA(bounds)
	draw.Draw(rgba, bounds, img, bounds.Min, draw.Src)

	bgColor := detectBackgroundColor(rgba)

	tol := float64(tolerance)
	for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
		for x := bounds.Min.X; x < bounds.Max.X; x++ {
			c := rgba.RGBAAt(x, y)
			if colorDistance(c, bgColor) <= tol {
				rgba.SetRGBA(x, y, color.RGBA{0, 0, 0, 0})
			}
		}
	}

	buf := new(bytes.Buffer)
	if err := png.Encode(buf, rgba); err != nil {
		return nil, fmt.Errorf("failed to encode png: %w", err)
	}
	return buf, nil
}

func detectBackgroundColor(img *image.RGBA) color.RGBA {
	b := img.Bounds()
	corners := []image.Point{
		{b.Min.X, b.Min.Y},
		{b.Max.X - 1, b.Min.Y},
		{b.Min.X, b.Max.Y - 1},
		{b.Max.X - 1, b.Max.Y - 1},
	}

	votes := make(map[color.RGBA]int)
	for _, p := range corners {
		c := img.RGBAAt(p.X, p.Y)
		votes[c]++
	}

	var best color.RGBA
	bestCount := 0
	for c, n := range votes {
		if n > bestCount {
			bestCount = n
			best = c
		}
	}
	return best
}

func colorDistance(a, b color.RGBA) float64 {
	dr := float64(a.R) - float64(b.R)
	dg := float64(a.G) - float64(b.G)
	db := float64(a.B) - float64(b.B)
	da := float64(a.A) - float64(b.A)
	return math.Sqrt(dr*dr + dg*dg + db*db + da*da)
}
