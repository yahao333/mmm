import { ref } from 'vue';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { invoke } from '@tauri-apps/api/core';

/**
 * MinMax Webview Hook
 * 管理 MinMax 页面的加载和数据获取逻辑
 */

// MinMax 使用量页面 URL
const MINMAX_USAGE_URL = 'https://platform.minimaxi.com/user-center/payment/coding-plan';
const MINMAX_WINDOW_LABEL = 'minmax';

/**
 * 使用 MinMax Webview 管理
 * @returns Webview 相关状态和方法
 */
export function useMinMaxWebview() {
  // 响应式状态
  const webviewLoading = ref(false);    // Webview 加载状态
  const webviewError = ref<string | null>(null); // Webview 错误信息
  const isWebviewOpen = ref(false);     // Webview 窗口是否打开

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

  async function openMinMaxInSystemBrowser(): Promise<void> {
    console.log('[useMinMaxWebview] 使用系统浏览器打开:', MINMAX_USAGE_URL);
    if (!isTauriRuntime()) {
      window.open(MINMAX_USAGE_URL, '_blank');
      return;
    }
    await invoke('open_url', { url: MINMAX_USAGE_URL });
  }

  async function getOrCreateMinMaxWindow(): Promise<WebviewWindow> {
    if (!isTauriRuntime()) {
      console.log('[useMinMaxWebview] 非 Tauri 环境，使用浏览器打开:', MINMAX_USAGE_URL);
      window.open(MINMAX_USAGE_URL, '_blank');
      throw new Error('Non-Tauri runtime');
    }

    let existing: WebviewWindow | null = null;
    try {
      existing = await WebviewWindow.getByLabel(MINMAX_WINDOW_LABEL);
    } catch (err) {
      const detail = formatUnknownError(err);
      console.warn('[useMinMaxWebview] 读取已存在窗口失败，将尝试直接创建新窗口:', detail);
      existing = null;
    }

    if (existing) {
      try {
        await existing.show();
        await existing.setFocus();
      } catch (err) {
        console.warn('[useMinMaxWebview] 聚焦 MinMax 窗口失败:', err);
      }
      isWebviewOpen.value = true;
      return existing;
    }

    const label = `${MINMAX_WINDOW_LABEL}-${Date.now()}`;
    console.log('[useMinMaxWebview] 创建 MinMax 窗口:', { url: MINMAX_USAGE_URL, label });
    try {
      const win = new WebviewWindow(label, {
        url: MINMAX_USAGE_URL,
        title: 'MinMax',
        width: 1100,
        height: 800,
        resizable: true,
        center: true,
      });

      return await new Promise<WebviewWindow>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          reject(new Error('创建 MinMax 窗口超时（10s）'));
        }, 10_000);

        win.once('tauri://created', async () => {
          window.clearTimeout(timeout);
          console.log('[useMinMaxWebview] MinMax 窗口已创建');
          isWebviewOpen.value = true;
          try {
            await win.show();
            await win.setFocus();
          } catch (err) {
            console.warn('[useMinMaxWebview] 显示/聚焦 MinMax 窗口失败:', err);
          }
          resolve(win);
        });

        win.once('tauri://error', (e) => {
          window.clearTimeout(timeout);
          console.error('[useMinMaxWebview] MinMax 窗口创建失败:', e);
          const payload = (e as unknown as { payload?: unknown })?.payload;
          const detail = payload ?? e;
          reject(new Error(`创建 MinMax 窗口失败: ${formatUnknownError(detail)}`));
        });
      });
    } catch (err) {
      throw new Error(`创建 MinMax 窗口异常: ${formatUnknownError(err)}`);
    }
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
      // 当前 Tauri 2.x 限制，无法直接在应用中创建新的 webview 窗口
      // 标记状态并返回 null，调用方会使用外部浏览器方式
      isWebviewOpen.value = true;
      console.log('[useMinMaxWebview] Webview 功能受限，使用外部浏览器方式');

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
      // 通过 Rust 后端执行 webview 脚本
      // 这里需要 Rust 后端支持在当前 webview 中执行脚本
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

    try {
      await getOrCreateMinMaxWindow();
      webviewError.value = '已在应用内打开 MinMax 页面：登录后复制使用量，再回到应用点击“粘贴使用量”';
      return null;
    } catch (err) {
      console.error('[useMinMaxWebview] 执行脚本失败:', err);
      if (err instanceof Error && err.message === 'Non-Tauri runtime') {
        webviewError.value = '已打开 MinMax 页面（浏览器）：登录后复制使用量，再回到应用点击“粘贴使用量”';
      } else {
        const detail = formatUnknownError(err);
        webviewError.value = `打开 MinMax 页面失败：${detail}`;
        try {
          await openMinMaxInSystemBrowser();
          webviewError.value += '（已自动使用系统浏览器打开）';
        } catch (e) {
          webviewError.value += `（系统浏览器打开也失败：${formatUnknownError(e)}）`;
        }
      }
      return null;
    } finally {
      webviewLoading.value = false;
    }
  }

  /**
   * 在外部浏览器中打开 MinMax 页面（备用方案）
   */
  async function openInExternalBrowser(): Promise<void> {
    console.log('[useMinMaxWebview] 打开 MinMax 页面:', MINMAX_USAGE_URL);
    try {
      await openMinMaxInSystemBrowser();
    } catch (err) {
      console.error('[useMinMaxWebview] 打开 MinMax 窗口失败:', err);
    }
  }

  return {
    // 状态
    webviewLoading,
    webviewError,
    isWebviewOpen,
    // 方法
    fetchUsageFromWebview,
    navigateToMinMaxAndFetch,
    executeScriptAndFetch,
    openInExternalBrowser,
    // 常量
    MINMAX_USAGE_URL,
  };
}
