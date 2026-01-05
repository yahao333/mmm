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
  sendTestNotification: (webhookUrl?: string) => Promise<boolean>;
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
   * @param webhookUrl 可选的企业微信 Webhook URL，如果提供则同时发送企业微信通知
   */
  const sendTestNotification = useCallback(async (webhookUrl?: string) => {
    console.log('[useNotification] 发送测试通知', webhookUrl ? '包含企业微信' : '');
    setSending(true);
    setNotificationState({
      success: false,
      message: '发送中...',
      type: 'info',
    });

    try {
      // 发送系统通知
      await invoke('test_notification');
      console.log('[useNotification] 系统测试通知已发送');

      // 如果提供了企业微信 Webhook URL，发送企业微信通知
      if (webhookUrl && webhookUrl.trim() !== '') {
        await invoke('test_wechat_notification', { webhookUrl });
        console.log('[useNotification] 企业微信测试通知已发送');
        setNotificationState({
          success: true,
          message: '系统通知和企业微信通知已发送',
          type: 'success',
        });
      } else {
        setNotificationState({
          success: true,
          message: '测试通知已发送',
          type: 'success',
        });
      }

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
