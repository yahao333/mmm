<template>
  <div class="browser-panel">
    <!-- 登录引导区域 -->
    <div class="login-guide">
      <div class="guide-icon">🔗</div>
      <h3>{{ t('loginGuideTitle') }}</h3>
      <p>{{ t('loginGuideDesc') }}</p>

      <!-- 打开浏览器按钮 -->
      <button @click="openInBrowser" class="open-browser-btn">
        🌐 {{ t('openBrowserToLogin') }}
      </button>

      <!-- 已登录确认 -->
      <div class="login-confirm">
        <p class="login-prompt-text">{{ t('afterLoginPrompt') }}</p>
        <button @click="confirmLogin" class="confirm-login-btn">
          {{ t('confirmLogin') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 浏览器模式面板组件
 * 由于 MinMax 网站 CSP 限制无法嵌入 iframe，改为外部浏览器打开方式
 */

import { ref } from 'vue';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

// MinMax 使用量页面 URL
const MINMAX_USAGE_URL = 'https://platform.minimaxi.com/user-center/payment/coding-plan';
const MINMAX_WINDOW_LABEL = 'minmax';

interface Props {
  // 翻译函数
  t: (key: string) => string;
}

const props = defineProps<Props>();

// 事件定义
const emit = defineEmits<{
  'confirm-login': [];
}>();

/**
 * 在外部浏览器中打开登录页面
 */
async function openInBrowser(): Promise<void> {
  console.log('[BrowserPanel] 在应用内打开登录页面');
  try {
    const ua = window.navigator?.userAgent || '';
    const isTauriRuntime = ua.includes('Tauri') || typeof (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ !== 'undefined';

    if (!isTauriRuntime) {
      console.log('[BrowserPanel] 非 Tauri 环境，使用浏览器打开:', MINMAX_USAGE_URL);
      window.open(MINMAX_USAGE_URL, '_blank');
      return;
    }

    const existing = await WebviewWindow.getByLabel(MINMAX_WINDOW_LABEL);
    if (existing) {
      await existing.show();
      await existing.setFocus();
      return;
    }

    const win = new WebviewWindow(MINMAX_WINDOW_LABEL, {
      url: MINMAX_USAGE_URL,
      title: 'MinMax',
      width: 1100,
      height: 800,
      resizable: true,
      center: true,
    });

    win.once('tauri://created', () => {
      console.log('[BrowserPanel] MinMax 窗口已创建');
    });

    win.once('tauri://error', (e) => {
      console.error('[BrowserPanel] MinMax 窗口创建失败:', e);
    });
  } catch (err) {
    console.error('[BrowserPanel] 打开 MinMax 窗口失败:', err);
  }
}

/**
 * 确认登录完成
 */
function confirmLogin(): void {
  console.log('[BrowserPanel] 用户确认已登录');
  emit('confirm-login');
}
</script>

<style scoped>
/* 浏览器面板容器 */
.browser-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

/* 登录引导区域 */
.login-guide {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  text-align: center;
  max-width: 280px;
}

.guide-icon {
  font-size: 48px;
  margin-bottom: 8px;
}

.login-guide h3 {
  font-size: 18px;
  color: #333;
  margin: 0;
}

.login-guide p {
  font-size: 14px;
  color: #666;
  line-height: 1.6;
  margin: 0;
}

/* 打开浏览器按钮 */
.open-browser-btn {
  padding: 12px 24px;
  background: #2196f3;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: bold;
  transition: all 0.2s;
  margin-top: 8px;
}

.open-browser-btn:hover {
  background: #1976d2;
  transform: scale(1.02);
}

/* 登录确认区域 */
.login-confirm {
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid #eee;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.login-prompt-text {
  margin: 0;
  padding: 8px 16px;
  background: #f5f5f5;
  color: #666;
  border-radius: 4px;
  font-size: 13px;
}

.confirm-login-btn {
  padding: 12px 32px;
  background: #4caf50;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: bold;
  box-shadow: 0 2px 8px rgba(76, 175, 80, 0.3);
  transition: all 0.2s;
}

.confirm-login-btn:hover {
  background: #43a047;
  transform: scale(1.05);
}
</style>
