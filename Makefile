.PHONY: help build build-frontend build-backend clean dev install gen-password

# Variables
BINARY_NAME := garage-webui
BACKEND_DIR := backend
DIST_DIR := dist
UI_DIST_DIR := $(BACKEND_DIR)/ui/dist
GO_BUILD_FLAGS := -tags prod
TOOLS_DIR := tools

help:
	@echo "Available targets:"
	@echo "  make install        - Install frontend dependencies"
	@echo "  make build          - Build complete project (frontend + backend)"
	@echo "  make build-frontend - Build only frontend"
	@echo "  make build-backend  - Build only backend"
	@echo "  make dev            - Run development server (frontend + backend)"
	@echo "  make gen-password   - Build password generator tool"
	@echo "  make clean          - Clean build artifacts"

install:
	pnpm install

build-frontend:
	@echo "Building frontend..."
	pnpm run build
	@echo "Copying dist to backend/ui/dist..."
	rm -rf $(UI_DIST_DIR)
	cp -r $(DIST_DIR) $(UI_DIST_DIR)

build-backend:
	@echo "Building backend..."
	cd $(BACKEND_DIR) && go build $(GO_BUILD_FLAGS) -o ../$(BINARY_NAME) .
	@echo "Binary created: $(BINARY_NAME)"

gen-password:
	@echo "Building password generator..."
	cd $(TOOLS_DIR) && go build -o gen_password gen_password.go
	@echo "Password generator built: $(TOOLS_DIR)/gen_password"
	@echo "Usage: ./$(TOOLS_DIR)/gen_password <username> <password>"

build: build-frontend build-backend
	@echo "Build completed successfully!"
	@ls -lh $(BINARY_NAME)

dev:
	pnpm run dev

clean:
	@echo "Cleaning build artifacts..."
	rm -rf $(DIST_DIR)
	rm -rf $(UI_DIST_DIR)
	rm -f $(BINARY_NAME)
	rm -f $(TOOLS_DIR)/gen_password
	@echo "Clean completed!"
