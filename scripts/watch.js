// Watch 脚本 - 监听文件变化并自动重新构建
import { watch } from 'chokidar';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('[Watch] 启动文件监听...');

// 监听 entrypoints 目录下的所有文件变化
const watcher = watch('./entrypoints/**/*', {
  ignored: /(^|[\/\\])\../, // 忽略隐藏文件
  persistent: true,
});

// 第一次构建
console.log('[Watch] 初始构建...');
execSync('pnpm build', { cwd: __dirname, stdio: 'inherit' });

// 文件变化时重新构建
watcher.on('change', (filePath) => {
  console.log(`[Watch] 文件变化: ${filePath}`);
  console.log('[Watch] 重新构建...');
  try {
    execSync('pnpm build', { cwd: __dirname, stdio: 'inherit' });
    console.log('[Watch] 构建完成');
  } catch (err) {
    console.error('[Watch] 构建失败:', err.message);
  }
});

watcher.on('add', (filePath) => {
  console.log(`[Watch] 新文件: ${filePath}`);
});

watcher.on('unlink', (filePath) => {
  console.log(`[Watch] 删除文件: ${filePath}`);
});

console.log('[Watch] 监听中... (按 Ctrl+C 停止)');
