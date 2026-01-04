import { useState, useCallback } from 'react';
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

// 返回值接口
export interface UseNotificationReturn {
  notificationState: NotificationState;
  sending: boolean;
  sendTestNotification: () => Promise<boolean>;
  clearNotification: () => void;
}

/**
 * 使用通知管理
 * @returns 通知相关状态和方法
 */
export function useNotification(): UseNotificationReturn {
  // 通知状态
  const [notificationState, setNotificationState] = useState<NotificationState>({
    success: true,
    message: '',
    type: 'info',
  });
  // 是否正在发送通知
  const [sending, setSending] = useState(false);

  /**
   * 发送测试通知
   */
  const sendTestNotification = useCallback(async () => {
    console.log('[useNotification] 发送测试通知');
    setSending(true);
    setNotificationState({
      success: false,
      message: '发送中...',
      type: 'info',
    });

    try {
      await invoke('test_notification');
      setNotificationState({
        success: true,
        message: '测试通知已发送',
        type: 'success',
      });
      console.log('[useNotification] 测试通知已发送');
      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setNotificationState({
        success: false,
        message: `发送失败: ${errorMsg}`,
        type: 'error',
      });
      console.error('[useNotification] 发送测试通知失败:', err);
      return false;
    } finally {
      setSending(false);
    }
  }, []);

  /**
   * 清除通知状态
   */
  const clearNotification = useCallback(() => {
    setNotificationState({
      success: true,
      message: '',
      type: 'info',
    });
  }, []);

  return {
    notificationState,
    sending,
    sendTestNotification,
    clearNotification,
  };
}
