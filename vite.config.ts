import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// Vite 配置文件
// 用于配置 React 构建选项和 Tauri 集成
export default defineConfig({
  // React 插件配置
  plugins: [react()],

  // 基础路径配置
  base: './',

  // 构建选项
  build: {
    // 输出目录
    outDir: 'dist',
    // 资源目录
    assetsDir: 'assets',
    // 使用 esbuild 进行压缩（内置，无需额外安装）
    minify: 'esbuild',
    // 生成 source map
    sourcemap: false,
  },

  // 开发服务器配置
  server: {
    // 端口号（与 Tauri devUrl 一致）
    port: 5174,
    // 严格端口检测
    strictPort: false,
    // 允许所有来源
    cors: true,
  },

  // 路径别名配置
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
