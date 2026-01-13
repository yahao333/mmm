SHELL := /bin/zsh
.ONESHELL:

# Load .env file if it exists
ifneq (,$(wildcard .env))
    include .env
    export
endif

# Clean up APPLE_SIGNING_IDENTITY (remove double quotes if they were included from .env)
APPLE_SIGNING_IDENTITY := $(subst ",,$(APPLE_SIGNING_IDENTITY))

.PHONY: help dev dev-extension dev-tauri build build-extension build-tauri test clean release release-silicon release-intel

PNPM := pnpm -s
WXT := npx wxt
PLAYWRIGHT := npx playwright

# Get version from tauri.conf.json
VERSION := $(shell grep '"version":' src-tauri/tauri.conf.json | head -n 1 | awk -F: '{ print $$2 }' | sed 's/[ ",]//g')

# 默认目标：显示帮助信息
help:
	@echo "Usage: make [target]"
	@echo ""
	@echo "Development Targets:"
	@echo "  dev             - Start development server for Chrome Extension (Hot Reload)"
	@echo "  dev-tauri       - Start development server for Tauri App"
	@echo "  test            - Run E2E tests with Playwright"
	@echo ""
	@echo "Build Targets:"
	@echo "  build           - Build both Chrome Extension and Tauri App"
	@echo "  build-extension - Build Chrome Extension only (output: .output/chrome-mv3)"
	@echo "  build-tauri     - Build Tauri App only"
	@echo "  release         - Build Tauri App (unsigned) for current arch"
	@echo "  release-silicon - Build & Sign Tauri App for Apple Silicon (M1/M2/M3)"
	@echo "  release-intel   - Build & Sign Tauri App for Intel Mac"
	@echo ""
	@echo "Maintenance Targets:"
	@echo "  clean           - Clean build artifacts"

# --- Development ---

# 启动 Chrome 插件开发模式 (Hot Reload)
dev:
	@echo "🚀 Starting Chrome Extension development server..."
	$(WXT)

# 启动 Tauri 开发模式
dev-tauri:
	@echo "🚀 Starting Tauri development server..."
	$(PNPM) dev:tauri

# 运行自动化测试
test:
	@echo "🧪 Running E2E tests..."
	$(PLAYWRIGHT) test

# --- Build ---

# 构建所有
build: build-extension build-tauri

# 仅构建 Chrome 插件
build-extension:
	@echo "📦 Building Chrome Extension..."
	$(WXT) build
	@echo "✅ Chrome Extension built at .output/chrome-mv3"

# 仅构建 Tauri 应用 (Web资源)
build-web:
	$(PNPM) build

# 仅构建 Tauri 应用 (Native)
build-tauri:
	$(PNPM) build:tauri

# --- Release (Tauri Specific) ---

# 默认构建 - 不签名，用户需自行承担安全风险
release:
	$(PNPM) build
	$(PNPM) build:tauri --target aarch64-apple-darwin --no-sign

# Apple Silicon 签名构建
release-silicon: build-web
	@# Source .env to get the raw shell variable value, bypassing Make's quoting issues
	@if [ -f .env ]; then set -a; source .env; set +a; fi; \
	if [ -z "$$APPLE_SIGNING_IDENTITY" ]; then echo "Error: APPLE_SIGNING_IDENTITY is not set in .env"; exit 1; fi; \
	if [[ "$$APPLE_SIGNING_IDENTITY" != *"Developer ID Application"* ]]; then \
		echo "❌ Error: Invalid Certificate for Direct Distribution"; \
		echo "   Current Identity: '$$APPLE_SIGNING_IDENTITY'"; \
		echo "   Reason: Direct DMG distribution (Notarization) requires a 'Developer ID Application' certificate."; \
		echo "   '3rd Party Mac Developer Application' is exclusively for the Mac App Store."; \
		echo "   Please create a 'Developer ID Application' certificate at developer.apple.com and install it."; \
		exit 1; \
	fi; \
	# Export the identity so Tauri uses it for the .app bundle signing
	export APPLE_SIGNING_IDENTITY="$$APPLE_SIGNING_IDENTITY"; \
	$(PNPM) build:tauri --target aarch64-apple-darwin; \
	echo "Signing DMG for Apple Silicon..."; \
	# Check both standard release path and architecture-specific path
	if [ -f "src-tauri/target/release/bundle/dmg/MiniMax Monitor_$(VERSION)_aarch64.dmg" ]; then \
		DMG_FILE="src-tauri/target/release/bundle/dmg/MiniMax Monitor_$(VERSION)_aarch64.dmg"; \
	else \
		DMG_FILE="src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/MiniMax Monitor_$(VERSION)_aarch64.dmg"; \
	fi; \
	if [ -f "$$DMG_FILE" ]; then \
		echo "Found DMG at: $$DMG_FILE"; \
		echo "Signing $$DMG_FILE with identity: $$APPLE_SIGNING_IDENTITY"; \
		codesign --deep --force --options runtime --sign "$$APPLE_SIGNING_IDENTITY" "$$DMG_FILE"; \
		echo "Verifying signature..."; \
		codesign --verify --verbose "$$DMG_FILE"; \
		echo "✅ Build and signing completed: $$DMG_FILE"; \
	else \
		echo "Error: DMG file not found. Checked 'target/release' and 'target/aarch64-apple-darwin/release'"; \
		exit 1; \
	fi

# Intel 签名构建
release-intel: build-web
	@# Source .env to get the raw shell variable value, bypassing Make's quoting issues
	@if [ -f .env ]; then set -a; source .env; set +a; fi; \
	if [ -z "$$APPLE_SIGNING_IDENTITY" ]; then echo "Error: APPLE_SIGNING_IDENTITY is not set in .env"; exit 1; fi; \
	if [[ "$$APPLE_SIGNING_IDENTITY" != *"Developer ID Application"* ]]; then \
		echo "❌ Error: Invalid Certificate for Direct Distribution"; \
		echo "   Current Identity: '$$APPLE_SIGNING_IDENTITY'"; \
		echo "   Reason: Direct DMG distribution (Notarization) requires a 'Developer ID Application' certificate."; \
		echo "   '3rd Party Mac Developer Application' is exclusively for the Mac App Store."; \
		echo "   Please create a 'Developer ID Application' certificate at developer.apple.com and install it."; \
		exit 1; \
	fi; \
	export APPLE_SIGNING_IDENTITY="$$APPLE_SIGNING_IDENTITY"; \
	$(PNPM) build:tauri --target x86_64-apple-darwin; \
	echo "Signing DMG for Intel..."; \
	if [ -f "src-tauri/target/release/bundle/dmg/MiniMax Monitor_$(VERSION)_x64.dmg" ]; then \
		DMG_FILE="src-tauri/target/release/bundle/dmg/MiniMax Monitor_$(VERSION)_x64.dmg"; \
	else \
		DMG_FILE="src-tauri/target/x86_64-apple-darwin/release/bundle/dmg/MiniMax Monitor_$(VERSION)_x64.dmg"; \
	fi; \
	if [ -f "$$DMG_FILE" ]; then \
		echo "Found DMG at: $$DMG_FILE"; \
		echo "Signing $$DMG_FILE with identity: $$APPLE_SIGNING_IDENTITY"; \
		codesign --deep --force --options runtime --sign "$$APPLE_SIGNING_IDENTITY" "$$DMG_FILE"; \
		echo "Verifying signature..."; \
		codesign --verify --verbose "$$DMG_FILE"; \
		echo "✅ Build and signing completed: $$DMG_FILE"; \
	else \
		echo "Error: DMG file not found. Checked 'target/release' and 'target/x86_64-apple-darwin/release'"; \
		exit 1; \
	fi

# --- Clean ---

clean:
	@echo "🧹 Cleaning build artifacts..."
	rm -rf .output dist src-tauri/target
