import { useState, useCallback, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

/**
 * 使用量数据获取 Hook
 * 封装使用量数据的获取逻辑和状态管理
 */

// 设置数据接口
export interface Settings {
  warningThreshold: number;
  checkInterval: number;
  wechatWorkWebhookUrl: string;
  language: string;
}

// 返回值接口
export interface UseUsageReturn {
  loading: boolean;
  error: string | null;
  usagePercent: number | null;
  notificationStatus: string;
  lastUpdateTime: Date | null;
  isOverThreshold: boolean;
  setUsage: (percent: number) => Promise<void>;
  paste: () => Promise<boolean>;
  resetWarningState: () => void;
}

/**
 * 从文本中提取使用量百分比
 * 参考 Chrome 扩展的 content script 逻辑
 * @param text 页面文本或剪贴板文本
 * @returns 使用量百分比，如果未找到返回 null
 */
function extractUsageFromText(text: string): number | null {
  console.log('[useUsage] 开始查找使用量数据...');
  console.log('[useUsage] 文本长度:', text.length);

  // 方法1: 匹配 "XX% 已使用" 格式
  const percentUsedMatch = text.match(/(\d+(?:\.\d+)?)\s*%\s*(?:已使用|已消耗|已用)/);
  if (percentUsedMatch) {
    const percent = parseFloat(percentUsedMatch[1]);
    if (percent > 0 && percent <= 100) {
      console.log('[useUsage] 方法1-百分比已使用格式匹配成功:', percent + '%');
      return percent;
    }
  }

  // 方法2: 匹配 "已使用 X/Y" 格式
  const usageMatch = text.match(/已使用\s*(\d+(?:\.\d+)?)\s*[\/｜|]\s*(\d+(?:\.\d+)?)/);
  if (usageMatch) {
    const used = parseFloat(usageMatch[1]);
    const total = parseFloat(usageMatch[2]);
    if (total > 0 && used <= total && used > 0) {
      const percent = (used / total) * 100;
      console.log('[useUsage] 方法2-已使用格式匹配成功:', percent + '%', `(已使用 ${used}/${total})`);
      return percent;
    }
  }

  // 方法3: 匹配纯百分比数字（兜底）
  const purePercentMatch = text.match(/(\d+(?:\.\d+)?)\s*%/);
  if (purePercentMatch) {
    const percent = parseFloat(purePercentMatch[1]);
    if (percent > 0 && percent <= 100) {
      console.log('[useUsage] 方法3-纯百分比格式匹配成功:', percent + '%');
      return percent;
    }
  }

  console.log('[useUsage] 所有方法都未匹配到使用量数据');
  return null;
}

/**
 * 从剪贴板读取文本并提取使用量
 * 通过 Rust 后端读取系统剪贴板
 */
async function pasteFromClipboard(): Promise<number | null> {
  console.log('[useUsage] 从剪贴板粘贴使用量数据');

  try {
    // 通过 Rust 后端读取剪贴板
    const text = await invoke<string>('read_clipboard');
    console.log('[useUsage] 剪贴板内容:', text);

    if (!text) {
      console.log('[useUsage] 剪贴板为空');
      return null;
    }

    // 提取使用量
    const percent = extractUsageFromText(text);
    if (percent !== null) {
      console.log('[useUsage] 从剪贴板提取到使用量:', percent + '%');
    }
    return percent;
  } catch (err) {
    console.error('[useUsage] 读取剪贴板失败:', err);
    throw err;
  }
}

/**
 * 发送预警通知
 * @param percent 当前使用量百分比
 * @param threshold 预警阈值
 */
async function sendWarningNotification(percent: number, threshold: number): Promise<boolean> {
  console.log('[useUsage] 发送预警通知，使用量:', percent + '%');

  try {
    await invoke('send_warning_notification', {
      usage: percent,
      threshold,
    });
    return true;
  } catch (err) {
    console.error('[useUsage] 发送预警通知失败:', err);
    return false;
  }
}

/**
 * 使用使用量数据管理 Hook
 * @param settings 当前设置
 * @returns 使用量相关状态和方法
 */
export function useUsage(settings: Settings): UseUsageReturn {
  // 状态
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usagePercent, setUsagePercent] = useState<number | null>(null);
  const [notificationStatus, setNotificationStatus] = useState('');
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);

  // 使用 ref 存储不会触发重渲染的状态
  const hasSentWarning = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 清理 timeout
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  /**
   * 处理使用量数据
   * 设置使用量并检查是否需要发送预警
   */
  const handleUsageData = useCallback(async (percent: number) => {
    setUsagePercent(percent);
    setLastUpdateTime(new Date());

    console.log('[useUsage] 获取到使用量:', percent + '%');

    // 检查是否需要发送预警通知
    const shouldNotify = percent >= settings.warningThreshold;
    const isFirstWarning = shouldNotify && !hasSentWarning.current;

    // 如果使用量超过阈值且是第一次（或者已恢复后再次超过），发送预警通知
    if (isFirstWarning) {
      console.log('[useUsage] 使用量超过阈值，触发预警:', {
        percent,
        threshold: settings.warningThreshold,
      });

      const success = await sendWarningNotification(percent, settings.warningThreshold);

      if (success) {
        hasSentWarning.current = true;
        const statusMessage = `⚠️ 预警已发送 (${percent.toFixed(1)}%)`;
        setNotificationStatus(statusMessage);

        // 3秒后清除状态提示
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
          setNotificationStatus('');
        }, 3000);
      } else {
        setNotificationStatus('预警发送失败');
      }
    } else if (!shouldNotify) {
      // 使用量恢复到阈值以下，重置预警状态
      if (hasSentWarning.current) {
        console.log('[useUsage] 使用量已恢复到阈值以下，重置预警状态');
        hasSentWarning.current = false;
      }
    }
  }, [settings.warningThreshold]);

  /**
   * 从剪贴板获取使用量数据
   */
  const paste = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const percent = await pasteFromClipboard();
      if (percent !== null) {
        await handleUsageData(percent);
        return true;
      } else {
        setError('未能从剪贴板提取使用量数据');
        console.log('[useUsage] 未能从剪贴板提取使用量数据');
        return false;
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '读取剪贴板失败';
      setError(errorMsg);
      console.error('[useUsage] 粘贴失败:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [handleUsageData]);

  /**
   * 设置使用量（手动输入）
   */
  const setUsage = useCallback(async (percent: number) => {
    // 校验范围
    if (percent < 0 || percent > 100) {
      setError('使用量必须在 0-100% 之间');
      return;
    }

    setError(null);
    await handleUsageData(percent);
  }, [handleUsageData]);

  /**
   * 检查使用量是否超过阈值
   */
  const isOverThreshold = usagePercent !== null && usagePercent >= settings.warningThreshold;

  /**
   * 重置预警状态（用于测试或手动清除）
   */
  const resetWarningState = useCallback(() => {
    hasSentWarning.current = false;
    setNotificationStatus('');
  }, []);

  return {
    loading,
    error,
    usagePercent,
    notificationStatus,
    lastUpdateTime,
    isOverThreshold,
    setUsage,
    paste,
    resetWarningState,
  };
}
