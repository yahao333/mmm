SHELL := /bin/zsh
.ONESHELL:

.PHONY: build-web build-tauri release release-silicon release-intel clean

PNPM := pnpm -s

build-web:
	$(PNPM) build

build-tauri:
	$(PNPM) build:tauri

# 默认构建 - 不签名，用户需自行承担安全风险
release:
	$(PNPM) build
	$(PNPM) build:tauri --target aarch64-apple-darwin --no-sign

# 签名版本（Apple 公证问题未解决，暂不可用）
release-silicon:
	@echo "错误: 签名版本暂时不可用（Apple 公证服务异常）"
	@echo "使用 'make release' 进行不签名构建"

release-intel:
	@echo "错误: 签名版本暂时不可用（Apple 公证服务异常）"
	@echo "使用 'make release' 进行不签名构建"

clean:
	rm -rf src-tauri/target
