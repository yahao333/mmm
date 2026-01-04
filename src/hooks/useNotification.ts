import { ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';

/**
 * 通知 Hook
 * 封装通知相关的数据获取和状态管理
 */

/**
 * 通知状态
 */
export interface NotificationState {
  // 通知是否发送成功
  success: boolean;
  // 通知消息
  message: string;
  // 通知类型
  type: 'success' | 'error' | 'warning' | 'info';
}

/**
 * 使用通知管理
 * @returns 通知相关状态和方法
 */
export function useNotification() {
  // 通知状态
  const notificationState = ref<NotificationState>({
    success: true,
    message: '',
    type: 'info',
  });
  // 是否正在发送通知
  const sending = ref(false);

  /**
   * 发送测试通知
   */
  async function sendTestNotification(): Promise<boolean> {
    console.log('[useNotification] 发送测试通知');
    sending.value = true;
    notificationState.value = {
      success: false,
      message: '发送中...',
      type: 'info',
    };

    try {
      await invoke('test_notification');
      notificationState.value = {
        success: true,
        message: '测试通知已发送',
        type: 'success',
      };
      console.log('[useNotification] 测试通知已发送');
      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      notificationState.value = {
        success: false,
        message: `发送失败: ${errorMsg}`,
        type: 'error',
      };
      console.error('[useNotification] 发送测试通知失败:', err);
      return false;
    } finally {
      sending.value = false;
    }
  }

  /**
   * 发送预警通知
   * @param usage 当前使用量
   * @param threshold 预警阈值
   */
  async function sendWarning(usage: number, threshold: number): Promise<boolean> {
    console.log('[useNotification] 发送预警通知，使用量:', usage + '%', '阈值:', threshold + '%');
    sending.value = true;

    try {
      await invoke('send_warning_notification', { usage, threshold });
      notificationState.value = {
        success: true,
        message: `预警已发送 (${usage.toFixed(1)}%)`,
        type: 'warning',
      };
      console.log('[useNotification] 预警通知已发送');
      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      notificationState.value = {
        success: false,
        message: `发送失败: ${errorMsg}`,
        type: 'error',
      };
      console.error('[useNotification] 发送预警通知失败:', err);
      return false;
    } finally {
      sending.value = false;
    }
  }

  /**
   * 清除通知状态
   */
  function clearNotification(): void {
    notificationState.value = {
      success: true,
      message: '',
      type: 'info',
    };
  }

  return {
    // 状态
    notificationState,
    sending,
    // 方法
    sendTestNotification,
    sendWarning,
    clearNotification,
  };
}
