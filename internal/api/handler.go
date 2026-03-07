package api

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"

	"sprite_sheet_tool/internal/models"
	"sprite_sheet_tool/internal/slicer"
)

const maxUploadSize = 50 << 20 // 50 MB

func ExportHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if err := r.ParseMultipartForm(maxUploadSize); err != nil {
		http.Error(w, "failed to parse form: "+err.Error(), http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("image")
	if err != nil {
		http.Error(w, "missing image file: "+err.Error(), http.StatusBadRequest)
		return
	}
	defer file.Close()

	configStr := r.FormValue("config")
	if configStr == "" {
		http.Error(w, "missing config field", http.StatusBadRequest)
		return
	}

	var req models.ExportRequest
	if err := json.Unmarshal([]byte(configStr), &req); err != nil {
		http.Error(w, "invalid config JSON: "+err.Error(), http.StatusBadRequest)
		return
	}

	if req.Prefix == "" {
		req.Prefix = "sprite"
	}

	zipBuf, err := slicer.Process(file, header.Filename, req)
	if err != nil {
		log.Printf("export error: %v", err)
		http.Error(w, "processing failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", `attachment; filename="export.zip"`)
	w.Write(zipBuf.Bytes())
}

func RemoveBGHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if err := r.ParseMultipartForm(maxUploadSize); err != nil {
		http.Error(w, "failed to parse form: "+err.Error(), http.StatusBadRequest)
		return
	}

	file, _, err := r.FormFile("image")
	if err != nil {
		http.Error(w, "missing image file: "+err.Error(), http.StatusBadRequest)
		return
	}
	defer file.Close()

	tolerance := 30
	if t := r.FormValue("tolerance"); t != "" {
		if v, err := strconv.Atoi(t); err == nil && v >= 0 && v <= 255 {
			tolerance = v
		}
	}

	pngBuf, err := slicer.RemoveBackground(file, tolerance)
	if err != nil {
		log.Printf("remove-bg error: %v", err)
		http.Error(w, "processing failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "image/png")
	w.Write(pngBuf.Bytes())
}

func ExportGIFHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if err := r.ParseMultipartForm(maxUploadSize); err != nil {
		http.Error(w, "failed to parse form: "+err.Error(), http.StatusBadRequest)
		return
	}

	file, _, err := r.FormFile("image")
	if err != nil {
		http.Error(w, "missing image file: "+err.Error(), http.StatusBadRequest)
		return
	}
	defer file.Close()

	configStr := r.FormValue("config")
	if configStr == "" {
		http.Error(w, "missing config field", http.StatusBadRequest)
		return
	}

	var req models.GIFRequest
	if err := json.Unmarshal([]byte(configStr), &req); err != nil {
		http.Error(w, "invalid config JSON: "+err.Error(), http.StatusBadRequest)
		return
	}

	if req.Delay <= 0 {
		req.Delay = 10
	}

	gifBuf, err := slicer.GenerateGIF(file, req)
	if err != nil {
		log.Printf("export-gif error: %v", err)
		http.Error(w, "processing failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "image/gif")
	w.Header().Set("Content-Disposition", `attachment; filename="animation.gif"`)
	w.Write(gifBuf.Bytes())
}
