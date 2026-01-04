import { ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';

/**
 * 使用量数据获取 Hook
 * 封装使用量数据的获取逻辑和状态管理
 */

// 设置数据接口
interface Settings {
  warningThreshold: number;
  checkInterval: number;
  wechatWorkWebhookUrl: string;
  language: string;
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
 * 使用使用量数据管理
 * @param settings 当前设置
 * @param onNotify 通知回调函数（可选）
 * @returns 使用量相关状态和方法
 */
export function useUsage(settings: Settings, onNotify?: (success: boolean, message: string) => void) {
  // 响应式状态
  const loading = ref(false);                        // 加载状态
  const error = ref<string | null>(null);            // 错误信息
  const usagePercent = ref<number | null>(null);     // 使用量百分比
  const notificationStatus = ref('');                // 通知状态提示
  const lastUpdateTime = ref<Date | null>(null);     // 最后更新时间

  // 记录是否已发送过预警（避免重复发送）
  const hasSentWarning = ref(false);

  /**
   * 处理使用量数据
   * 设置使用量并检查是否需要发送预警
   * @param percent 使用量百分比
   */
  async function handleUsageData(percent: number): Promise<void> {
    usagePercent.value = percent;
    lastUpdateTime.value = new Date();

    console.log('[useUsage] 获取到使用量:', percent + '%');

    // 检查是否需要发送预警通知
    const shouldNotify = percent >= settings.warningThreshold;
    const isFirstWarning = shouldNotify && !hasSentWarning.value;

    // 如果使用量超过阈值且是第一次（或者已恢复后再次超过），发送预警通知
    if (isFirstWarning) {
      console.log('[useUsage] 使用量超过阈值，触发预警:', {
        percent,
        threshold: settings.warningThreshold,
      });

      const success = await sendWarningNotification(percent, settings.warningThreshold);

      if (success) {
        hasSentWarning.value = true;
        const statusMessage = `⚠️ 预警已发送 (${percent.toFixed(1)}%)`;
        notificationStatus.value = statusMessage;

        // 回调通知
        if (onNotify) {
          onNotify(true, statusMessage);
        }

        // 3秒后清除状态提示
        setTimeout(() => {
          notificationStatus.value = '';
        }, 3000);
      } else {
        const errorMessage = '预警发送失败';
        notificationStatus.value = errorMessage;

        if (onNotify) {
          onNotify(false, errorMessage);
        }
      }
    } else if (!shouldNotify) {
      // 使用量恢复到阈值以下，重置预警状态
      if (hasSentWarning.value) {
        console.log('[useUsage] 使用量已恢复到阈值以下，重置预警状态');
        hasSentWarning.value = false;
      }
    }
  }

  /**
   * 从剪贴板获取使用量数据
   */
  async function paste(): Promise<boolean> {
    loading.value = true;
    error.value = null;

    try {
      const percent = await pasteFromClipboard();
      if (percent !== null) {
        await handleUsageData(percent);
        return true;
      } else {
        error.value = '未能从剪贴板提取使用量数据';
        console.log('[useUsage] 未能从剪贴板提取使用量数据');
        return false;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '读取剪贴板失败';
      console.error('[useUsage] 粘贴失败:', err);
      return false;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 设置使用量（手动输入）
   * @param percent 使用量百分比
   */
  async function setUsage(percent: number): Promise<void> {
    // 校验范围
    if (percent < 0 || percent > 100) {
      error.value = '使用量必须在 0-100% 之间';
      return;
    }

    error.value = null;
    await handleUsageData(percent);
  }

  /**
   * 检查使用量是否超过阈值
   */
  function isOverThreshold(): boolean {
    return usagePercent.value !== null && usagePercent.value >= settings.warningThreshold;
  }

  /**
   * 重置预警状态（用于测试或手动清除）
   */
  function resetWarningState(): void {
    hasSentWarning.value = false;
    notificationStatus.value = '';
  }

  return {
    // 响应式状态
    loading,
    error,
    usagePercent,
    notificationStatus,
    lastUpdateTime,
    // 计算属性
    isOverThreshold,
    // 方法
    paste,
    setUsage,
    resetWarningState,
  };
}
