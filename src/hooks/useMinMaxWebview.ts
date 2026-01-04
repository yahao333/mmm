import { useState, useCallback, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

/**
 * MinMax Webview Hook
 * 管理 MinMax 页面的加载和数据获取逻辑
 */

// MinMax 使用量页面 URL
const MINMAX_USAGE_URL = 'https://platform.minimaxi.com/user-center/payment/coding-plan';

// 返回值接口
export interface UseMinMaxWebviewReturn {
  webviewLoading: boolean;
  webviewError: string | null;
  isWebviewOpen: boolean;
  webviewHint: string;
  autoUsagePercent: number | null;
  executeScriptAndFetch: () => Promise<void>;
  MINMAX_USAGE_URL: string;
}

/**
 * 格式化错误信息
 */
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

/**
 * 检查是否是 Tauri 运行环境
 */
function isTauriRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator?.userAgent || '';
  return ua.includes('Tauri') || typeof (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ !== 'undefined';
}

/**
 * 使用 MinMax Webview 管理
 * @returns Webview 相关状态和方法
 */
export function useMinMaxWebview(): UseMinMaxWebviewReturn {
  // 状态
  const [webviewLoading, setWebviewLoading] = useState(false);
  const [webviewError, setWebviewError] = useState<string | null>(null);
  const [isWebviewOpen, setIsWebviewOpen] = useState(false);
  const [webviewHint, setWebviewHint] = useState('');
  const [autoUsagePercent, setAutoUsagePercent] = useState<number | null>(null);

  // 使用 ref 存储 listener 注册状态
  const hasListener = useRef(false);

  /**
   * 注册使用量事件监听器
   */
  const ensureUsageListener = useCallback(async () => {
    if (hasListener.current) return;
    if (!isTauriRuntime()) return;

    console.log('[useMinMaxWebview] 注册 minmax-usage 事件监听');
    hasListener.current = true;

    await listen<{ percent?: number }>('minmax-usage', (event) => {
      console.log('[useMinMaxWebview] 收到 minmax-usage 事件, payload:', JSON.stringify(event.payload));
      const percent = event.payload?.percent;
      console.log('[useMinMaxWebview] 解析到的 percent:', percent, 'typeof:', typeof percent);
      if (typeof percent === 'number' && Number.isFinite(percent) && percent >= 0 && percent <= 100) {
        const rounded = Math.round(percent * 10) / 10;
        console.log('[useMinMaxWebview] 自动获取到使用量:', rounded + '%');
        console.log('[useMinMaxWebview] 设置 autoUsagePercent =', rounded);
        setAutoUsagePercent(rounded);
        console.log('[useMinMaxWebview] autoUsagePercent 现在是:', rounded);
        setWebviewHint('');
      } else {
        console.warn('[useMinMaxWebview] 收到无效使用量事件 payload:', event.payload);
      }
    });
  }, []);

  /**
   * 在 Tauri 窗口中打开 MinMax 页面
   */
  const openMinMaxWindowInTauri = useCallback(async () => {
    await ensureUsageListener();

    console.log('[useMinMaxWebview] 通过后端创建/显示 MinMax 窗口:', MINMAX_USAGE_URL);
    await invoke('open_minmax_window');
    setIsWebviewOpen(true);
  }, [ensureUsageListener]);

  /**
   * 在浏览器中打开 MinMax 页面
   */
  const openMinMaxInBrowser = useCallback(() => {
    console.log('[useMinMaxWebview] 非 Tauri 环境，使用浏览器打开:', MINMAX_USAGE_URL);
    window.open(MINMAX_USAGE_URL, '_blank');
    setIsWebviewOpen(true);
    setWebviewHint('已打开 MinMax 页面：登录后会自动同步使用量（无需复制），稍等几秒再回来看');
  }, []);

  /**
   * 打开 MinMax 页面（自动选择环境）
   */
  const openMinMaxWindow = useCallback(async () => {
    if (!isTauriRuntime()) {
      openMinMaxInBrowser();
      return;
    }

    await openMinMaxWindowInTauri();
  }, [openMinMaxInBrowser, openMinMaxWindowInTauri]);

  /**
   * 通过 Rust 后端执行脚本获取使用量
   * 这是主要的数据获取方式
   */
  const executeScriptAndFetch = useCallback(async () => {
    console.log('[useMinMaxWebview] 尝试在应用内打开页面获取使用量...');
    setWebviewLoading(true);
    setWebviewError(null);
    setWebviewHint('');

    try {
      await openMinMaxWindow();
      setWebviewHint('已打开 MinMax 页面：登录后会自动同步使用量（无需复制），稍等几秒再回来看');
    } catch (err) {
      console.error('[useMinMaxWebview] 执行脚本失败:', err);
      const detail = formatUnknownError(err);
      setWebviewError(`打开 MinMax 页面失败：${detail}`);
    } finally {
      setWebviewLoading(false);
    }
  }, [openMinMaxWindow]);

  return {
    webviewLoading,
    webviewError,
    isWebviewOpen,
    webviewHint,
    autoUsagePercent,
    executeScriptAndFetch,
    MINMAX_USAGE_URL,
  };
}
