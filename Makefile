SHELL := /bin/zsh
.ONESHELL:

# Load .env file if it exists
ifneq (,$(wildcard .env))
    include .env
    export
endif

# Clean up APPLE_SIGNING_IDENTITY (remove double quotes if they were included from .env)
# This prevents double-quoting issues in zsh (e.g. ""(foo)"" causing "unknown file attribute")
APPLE_SIGNING_IDENTITY := $(subst ",,$(APPLE_SIGNING_IDENTITY))

.PHONY: build-web build-tauri release release-silicon release-intel clean

PNPM := pnpm -s

# Get version from tauri.conf.json
VERSION := $(shell grep '"version":' src-tauri/tauri.conf.json | head -n 1 | awk -F: '{ print $$2 }' | sed 's/[ ",]//g')

build-web:
	$(PNPM) build

build-tauri:
	$(PNPM) build:tauri

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

clean:
	rm -rf src-tauri/target
