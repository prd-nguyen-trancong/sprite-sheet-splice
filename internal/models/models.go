package models

type ExportRequest struct {
	Prefix string      `json:"prefix"`
	Frames []FrameData `json:"frames"`
}

type FrameData struct {
	ID     int `json:"id"`
	X      int `json:"x"`
	Y      int `json:"y"`
	Width  int `json:"width"`
	Height int `json:"height"`
}

type GIFRequest struct {
	Frames []FrameData `json:"frames"`
	Delay  int         `json:"delay"`
}
