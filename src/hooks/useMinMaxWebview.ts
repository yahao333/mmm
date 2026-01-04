import { ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

/**
 * MinMax Webview Hook
 * 管理 MinMax 页面的加载和数据获取逻辑
 */

// MinMax 使用量页面 URL
const MINMAX_USAGE_URL = 'https://platform.minimaxi.com/user-center/payment/coding-plan';

/**
 * 使用 MinMax Webview 管理
 * @returns Webview 相关状态和方法
 */
export function useMinMaxWebview() {
  // 响应式状态
  const webviewLoading = ref(false);    // Webview 加载状态
  const webviewError = ref<string | null>(null); // Webview 错误信息
  const isWebviewOpen = ref(false);     // Webview 窗口是否打开
  const webviewHint = ref<string>('');  // 引导提示
  const autoUsagePercent = ref<number | null>(null); // 自动获取到的使用量

  let hasListener = false;

  function formatUnknownError(err: unknown): string {
    if (err instanceof Error) {
      return `${err.name}: ${err.message}`;
    }
    if (typeof err === 'string') {
      return err;
    }
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }

  function isTauriRuntime(): boolean {
    if (typeof window === 'undefined') return false;
    const ua = window.navigator?.userAgent || '';
    return ua.includes('Tauri') || typeof (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ !== 'undefined';
  }

  async function ensureUsageListener(): Promise<void> {
    if (hasListener) return;
    if (!isTauriRuntime()) return;

    console.log('[useMinMaxWebview] 注册 minmax-usage 事件监听');
    hasListener = true;

    await listen<{ percent?: number }>('minmax-usage', (event) => {
      const percent = event.payload?.percent;
      if (typeof percent === 'number' && Number.isFinite(percent) && percent >= 0 && percent <= 100) {
        const rounded = Math.round(percent * 10) / 10;
        console.log('[useMinMaxWebview] 自动获取到使用量:', rounded + '%');
        autoUsagePercent.value = rounded;
        webviewHint.value = '';
      } else {
        console.warn('[useMinMaxWebview] 收到无效使用量事件 payload:', event.payload);
      }
    });
  }

  async function openMinMaxWindowInTauri(): Promise<void> {
    await ensureUsageListener();

    console.log('[useMinMaxWebview] 通过后端创建/显示 MinMax 窗口:', MINMAX_USAGE_URL);
    await invoke('open_minmax_window');
    isWebviewOpen.value = true;
  }

  async function openMinMaxInBrowser(): Promise<void> {
    console.log('[useMinMaxWebview] 非 Tauri 环境，使用浏览器打开:', MINMAX_USAGE_URL);
    window.open(MINMAX_USAGE_URL, '_blank');
    isWebviewOpen.value = true;
    webviewHint.value = '已打开 MinMax 页面：登录后会自动同步使用量（无需复制），稍等几秒再回来看';
  }

  async function openMinMaxWindow(): Promise<void> {
    if (!isTauriRuntime()) {
      await openMinMaxInBrowser();
      return;
    }

    await openMinMaxWindowInTauri();
  }

  /**
   * 在应用内 webview 中打开 MinMax 页面并获取使用量数据
   * 当前版本暂不支持，使用外部浏览器方式
   */
  async function fetchUsageFromWebview(): Promise<number | null> {
    console.log('[useMinMaxWebview] 开始从 webview 获取使用量数据...');
    webviewLoading.value = true;
    webviewError.value = null;

    try {
      await openMinMaxWindow();
      return null;
    } catch (err) {
      console.error('[useMinMaxWebview] 创建 webview 失败:', err);
      webviewError.value = err instanceof Error ? err.message : '创建 webview 失败';
      return null;
    } finally {
      webviewLoading.value = false;
    }
  }

  /**
   * 在当前应用窗口中导航到 MinMax 页面获取使用量
   * 通过 Rust 后端执行脚本
   */
  async function navigateToMinMaxAndFetch(): Promise<number | null> {
    console.log('[useMinMaxWebview] 导航到 MinMax 页面并获取数据...');
    webviewLoading.value = true;
    webviewError.value = null;

    try {
      await openMinMaxWindow();
      return null;
    } catch (err) {
      console.error('[useMinMaxWebview] 获取数据失败:', err);
      webviewError.value = err instanceof Error ? err.message : '获取数据失败';
      return null;
    } finally {
      webviewLoading.value = false;
    }
  }

  /**
   * 通过 Rust 后端执行脚本获取使用量
   * 这是主要的数据获取方式
   */
  async function executeScriptAndFetch(): Promise<number | null> {
    console.log('[useMinMaxWebview] 尝试在应用内打开页面获取使用量...');
    webviewLoading.value = true;
    webviewError.value = null;
    webviewHint.value = '';

    try {
      await openMinMaxWindow();
      webviewHint.value = '已打开 MinMax 页面：登录后会自动同步使用量（无需复制），稍等几秒再回来看';
      return null;
    } catch (err) {
      console.error('[useMinMaxWebview] 执行脚本失败:', err);
      const detail = formatUnknownError(err);
      webviewError.value = `打开 MinMax 页面失败：${detail}`;
      return null;
    } finally {
      webviewLoading.value = false;
    }
  }

  return {
    // 状态
    webviewLoading,
    webviewError,
    isWebviewOpen,
    webviewHint,
    autoUsagePercent,
    // 方法
    fetchUsageFromWebview,
    navigateToMinMaxAndFetch,
    executeScriptAndFetch,
    // 常量
    MINMAX_USAGE_URL,
  };
}
