# Stage 1: Build the Go binary
FROM golang:1.25-alpine AS builder

WORKDIR /build
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o sprite-slicer .

# Stage 2: Minimal runtime image
FROM alpine:3.20

RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=builder /build/sprite-slicer .
COPY --from=builder /build/web ./web

EXPOSE 9600 9601

ENTRYPOINT ["./sprite-slicer"]
