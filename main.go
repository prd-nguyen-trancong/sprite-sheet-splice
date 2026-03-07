package main

import (
	"log"
	"net/http"

	"sprite_sheet_tool/internal/api"
)

func main() {
	errc := make(chan error, 2)

	// Static file server for the web UI on :9600
	go func() {
		fs := http.FileServer(http.Dir("web"))
		log.Println("Web UI server listening on :9600")
		errc <- http.ListenAndServe(":9600", fs)
	}()

	// REST API server on :9601
	go func() {
		handler := api.NewAPIServer()
		log.Println("API server listening on :9601")
		errc <- http.ListenAndServe(":9601", handler)
	}()

	// Block until one of the servers returns an error
	log.Fatalf("server exited: %v", <-errc)
}
