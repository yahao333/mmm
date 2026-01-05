import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

// 导入样式
import './style.css';

// 导入组件
import { MonitorPanel } from './components/MonitorPanel';
import { ConfirmModal } from './components/ConfirmModal';

// 导入 hook
import { useUsage, Settings } from './hooks/useUsage';
import { useMinMaxWebview } from './hooks/useMinMaxWebview';
import { useNotification } from './hooks/useNotification';

// 导入国际化
import { t, getLang, setLang, Lang } from './i18n';

// 语言类型
type Language = Lang;

// 设置数据接口（完整定义，确保与后端 AppConfig 对应）
interface AppSettings {
  warningThreshold: number;
  checkInterval: number;
  wechatWorkWebhookUrl: string;
  language: Language;
}

const DEFAULT_SETTINGS: AppSettings = {
  warningThreshold: 90,
  checkInterval: 30,
  wechatWorkWebhookUrl: '',
  language: 'zh',
};

/**
 * 主应用组件
 */
function App() {
  // 是否显示设置面板
  const [showSettings, setShowSettings] = useState(false);
  // 是否显示恢复出厂设置确认框
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  // 当前语言
  const [currentLang, setCurrentLang] = useState<Language>('zh');
  // 设置数据
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  // 使用 ref 存储最新的输入值，避免闭包问题
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // 使用 hook 管理使用量数据
  const {
    loading,
    error,
    usagePercent,
    notificationStatus,
    isOverThreshold,
    lastUpdateTime,
    setUsage,
  } = useUsage(settings);

  // 使用 hook 管理 webview 获取
  const {
    webviewLoading: fetching,
    webviewError,
    webviewHint,
    autoUsagePercent,
    executeScriptAndFetch,
  } = useMinMaxWebview();

  // 使用 hook 管理通知
  const {
    notificationState,
    sendTestNotification,
  } = useNotification();

  // 监听 autoUsagePercent 变化并更新使用量
  useEffect(() => {
    if (autoUsagePercent === null) return;
    console.log('[App] 收到自动使用量，更新到面板:', autoUsagePercent + '%');
    setUsage(autoUsagePercent);
  }, [autoUsagePercent, setUsage]);

  // 监听定时任务触发信号，确保每次定时检查都执行预警检查
  // 即使 autoUsagePercent 值没变化，也要调用 setUsage 来触发 handleUsageData
  useEffect(() => {
    let isMounted = true;

    const handleTriggerFetch = async () => {
      console.log('[App] 收到定时任务触发信号');
      if (isMounted && autoUsagePercent !== null) {
        console.log('[App] 强制调用 setUsage 执行预警检查');
        await setUsage(autoUsagePercent);
      }
    };

    listen('trigger-fetch-usage', handleTriggerFetch).then((unlistenFn) => {
      if (!isMounted) {
        unlistenFn();
      }
    });

    return () => {
      isMounted = false;
    };
  }, [autoUsagePercent, setUsage]);

  // 计算显示的错误信息
  const displayError = useMemo(() => {
    return error || webviewError || null;
  }, [error, webviewError]);

  // 计算显示的通知状态
  const displayNotificationStatus = useMemo(() => {
    if (webviewHint) return webviewHint;
    if (notificationStatus) return notificationStatus;
    if (notificationState.message) return notificationState.message;
    return '';
  }, [webviewHint, notificationStatus, notificationState.message]);

  // 根据使用量获取状态颜色
  const statusColor = useMemo(() => {
    if (usagePercent === null) return '#667eea';
    if (usagePercent >= 90) return '#e74c3c';
    if (usagePercent >= 70) return '#f39c12';
    return '#27ae60';
  }, [usagePercent]);

  // 根据使用量获取状态图标
  const statusIcon = useMemo(() => {
    if (usagePercent === null) return '📊';
    if (usagePercent >= 90) return '🔴';
    if (usagePercent >= 70) return '🟡';
    return '🟢';
  }, [usagePercent]);

  /**
   * 从后端加载设置
   */
  const loadSettingsFromBackend = useCallback(async () => {
    console.log('[App] 从后端加载设置');

    try {
      const result = await invoke<AppSettings>('get_settings');
      console.log('[App] 后端返回配置:', result);

      // 将后端返回的 snake_case 转换为前端使用的 camelCase
      const convertedSettings = {
        warningThreshold: result.warningThreshold,
        checkInterval: result.checkInterval,
        wechatWorkWebhookUrl: result.wechatWorkWebhookUrl,
        language: result.language,
      };

      setSettings(prev => ({ ...prev, ...convertedSettings }));
      setCurrentLang(convertedSettings.language as Language || 'zh');
      console.log('[App] 设置加载完成:', convertedSettings);
    } catch (err) {
      console.error('[App] 加载设置失败:', err);
      const storedSettings = localStorage.getItem('minmax_settings');
      if (storedSettings) {
        const parsed = JSON.parse(storedSettings);
        setSettings(prev => ({ ...prev, ...parsed }));
        setCurrentLang(parsed.language as Language || 'zh');
      }
    }
  }, []);

  /**
   * 切换语言
   */
  const toggleLanguage = useCallback(async () => {
    const newLang = currentLang === 'zh' ? 'en' : 'zh';
    setCurrentLang(newLang);
    setLang(newLang);

    const settingsToSave = { ...settings, language: newLang };
    console.log('[App] 语言已切换:', newLang);

    try {
      await invoke('save_settings', { settings: settingsToSave });
      console.log('[App] 语言设置已保存');
      setSettings(prev => ({ ...prev, language: newLang }));
    } catch (err) {
      console.error('[App] 保存语言设置失败:', err);
    }
  }, [currentLang, settings]);

  /**
   * 从页面获取使用量
   */
  const handleFetchUsage = useCallback(async () => {
    console.log('[App] 从页面获取使用量');
    await executeScriptAndFetch();
    console.log('[App] 等待页面自动同步使用量（登录后几秒内会更新）');
  }, [executeScriptAndFetch]);

  /**
   * 切换设置面板显示
   */
  const toggleSettings = useCallback(() => {
    setShowSettings(prev => {
      const newValue = !prev;
      console.log('[App]', newValue ? '打开设置面板' : '关闭设置面板');
      return newValue;
    });
  }, []);

  /**
   * 保存设置
   */
  const saveSettings = useCallback(async () => {
    console.log('[App] 保存设置');
    console.log('[App] settingsRef.current:', JSON.stringify(settingsRef.current));

    // 使用 ref 获取最新的输入值，避免闭包问题
    const currentSettings = settingsRef.current;
    const currentThreshold = currentSettings.warningThreshold;
    const currentInterval = currentSettings.checkInterval;

    console.log('[App] 当前输入值 - 阈值:', currentThreshold, '间隔:', currentInterval);

    if (!Number.isFinite(currentInterval) || currentInterval <= 0) {
      alert(t('invalidInterval'));
      return;
    }

    // 计算修正后的阈值
    let sanitizedThreshold = currentThreshold;
    if (!Number.isFinite(currentThreshold)) {
      sanitizedThreshold = 90;
    } else {
      sanitizedThreshold = Math.min(100, Math.max(0, currentThreshold));
    }

    console.log('[App] 修正后的阈值:', sanitizedThreshold);

    // 构造保存的配置对象
    const settingsToSave = {
      warningThreshold: sanitizedThreshold,
      checkInterval: currentInterval,
      wechatWorkWebhookUrl: currentSettings.wechatWorkWebhookUrl,
      language: currentSettings.language,
    };

    console.log('[App] 准备保存设置:', JSON.stringify(settingsToSave));

    try {
      await invoke('save_settings', { settings: settingsToSave });
      console.log('[App] 设置已保存到后端');

      // 保存成功后更新本地 state（确保一致性）
      setSettings(prev => ({
        ...prev,
        warningThreshold: sanitizedThreshold,
        checkInterval: currentInterval,
      }));
      console.log('[App] 本地 state 已更新');

      // 重新加载配置以确保一致性
      await loadSettingsFromBackend();
      console.log('[App] 配置已验证');
    } catch (err) {
      console.error('[App] 保存设置失败:', err);
      // 后端保存失败时，回退到 localStorage
      localStorage.setItem('minmax_settings', JSON.stringify(settingsToSave));
    }

    setShowSettings(false);
  }, [loadSettingsFromBackend]);

  /**
   * 取消设置修改
   */
  const cancelSettings = useCallback(() => {
    console.log('[App] 取消设置修改');
    setShowSettings(false);
    loadSettingsFromBackend();
  }, [loadSettingsFromBackend]);

  /**
   * 恢复出厂设置 - 点击按钮
   */
  const resetToFactorySettings = useCallback(() => {
    setShowResetConfirm(true);
  }, []);

  /**
   * 恢复出厂设置 - 确认执行
   */
  const handleConfirmReset = useCallback(async () => {
    console.log('[App] 开始恢复出厂设置');

    try {
      localStorage.clear();
    } catch (e) {
      console.warn('[App] 清理 localStorage 失败:', e);
    }

    try {
      await invoke('clear_web_caches');
      console.log('[App] 已请求清理 WebView 缓存与存储');
    } catch (e) {
      console.warn('[App] 清理 WebView 缓存失败:', e);
    }

    try {
      const backendSettings = await invoke<AppSettings>('reset_settings');
      console.log('[App] 后端已重置配置，返回默认配置:', backendSettings);

      setSettings(prev => ({ ...prev, ...backendSettings }));
      setCurrentLang((backendSettings.language as Language) || 'zh');
      setLang(((backendSettings.language as Language) || 'zh'));
    } catch (err) {
      console.error('[App] 调用后端重置失败，回退到前端默认值:', err);
      setSettings(DEFAULT_SETTINGS);
      setCurrentLang('zh');
      setLang('zh');
    }

    setShowSettings(false);
    setShowResetConfirm(false);
    alert(t('resetSuccess'));
    try {
      await invoke('exit_app');
    } catch (e) {
      console.error('[App] 退出应用失败，回退到刷新:', e);
      setTimeout(() => window.location.reload(), 150);
    }
  }, []);

  /**
   * 测试通知（同时发送系统通知和企业微信通知）
   */
  const testNotification = useCallback(async () => {
    console.log('[App] 发送测试通知');
    const success = await sendTestNotification(settings.wechatWorkWebhookUrl);
    if (success) {
      alert(t('notificationSent'));
    } else {
      alert('Failed: ' + notificationState.message);
    }
  }, [sendTestNotification, settings.wechatWorkWebhookUrl, notificationState.message]);

  /**
   * 输入处理函数
   */
  const handleWarningThresholdChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    const newValue = isNaN(value) ? 0 : value;
    console.log('[App] 阈值输入变化:', value, '->', newValue);
    setSettings(prev => ({ ...prev, warningThreshold: newValue }));
  }, []);

  const handleCheckIntervalChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    const newValue = isNaN(value) ? 0 : value;
    console.log('[App] 间隔输入变化:', value, '->', newValue);
    setSettings(prev => ({ ...prev, checkInterval: newValue }));
  }, []);

  const handleWebhookUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings(prev => ({ ...prev, wechatWorkWebhookUrl: e.target.value }));
  }, []);

  // 组件挂载时初始化
  useEffect(() => {
    console.log('[App] 组件已挂载');
    loadSettingsFromBackend();
  }, [loadSettingsFromBackend]);

  return (
    <div className="w-full max-w-[380px] bg-white/95 rounded-[20px] shadow-[0_20px_60px_rgba(0,0,0,0.3),0_8px_20px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.8)] p-5 h-auto min-h-[400px] flex flex-col relative overflow-hidden">
      {/* 状态指示器 */}
      <div
        className="absolute top-0 left-0 right-0 h-1 rounded-tl-[20px] rounded-tr-[20px] transition-colors duration-300"
        style={{ backgroundColor: statusColor }}
      >
      </div>

      {/* 头部 */}
      <header className="flex justify-between items-center mb-5 flex-shrink-0 pt-2">
        <h1 className="text-[20px] font-semibold m-0 text-gray-800 flex items-center gap-2">
          <span className="text-[24px]">📊</span>
          {t('title')}
        </h1>
        <div className="flex items-center gap-2">
          <button
            className="bg-purple-500/10 hover:bg-purple-500/20 transition-all duration-200 p-2 rounded-xl flex items-center justify-center text-[14px] font-semibold text-purple-600 min-w-[36px]"
            onClick={toggleLanguage}
            title={t('toggleLanguage')}
          >
            {currentLang === 'en' ? '中' : 'EN'}
          </button>
          <button
            className="bg-purple-500/10 hover:bg-purple-500/20 transition-all duration-200 p-2 rounded-xl flex items-center justify-center text-[18px]"
            onClick={toggleSettings}
            title={t('settings')}
          >
            ⚙️
          </button>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {showSettings ? (
          <div className="flex flex-col gap-5 animate-fade-in">
            <h3 className="text-[18px] font-semibold m-0 mb-2 text-gray-800 flex items-center gap-2">
              <span className="text-[20px]">⚙️</span>
              {t('settingsTitle')}
            </h3>

            <div className="flex flex-col gap-2">
              <label className="text-[13px] font-medium text-gray-600">{t('warningThreshold')}</label>
              <input
                type="number"
                value={settings.warningThreshold}
                onChange={handleWarningThresholdChange}
                min={0}
                max={100}
                className="w-full px-[14px] py-[10px] border border-gray-200 rounded-xl outline-none transition-all duration-200 bg-white/90 focus:border-purple-500 focus:shadow-[0_0_0_3px_rgba(102,126,234,0.2)]"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[13px] font-medium text-gray-600">{t('checkInterval')}</label>
              <input
                type="number"
                value={settings.checkInterval}
                onChange={handleCheckIntervalChange}
                min={1}
                className="w-full px-[14px] py-[10px] border border-gray-200 rounded-xl outline-none transition-all duration-200 bg-white/90 focus:border-purple-500 focus:shadow-[0_0_0_3px_rgba(102,126,234,0.2)]"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[13px] font-medium text-gray-600">{t('wechatWorkWebhookUrl')}</label>
              <input
                type="text"
                value={settings.wechatWorkWebhookUrl}
                onChange={handleWebhookUrlChange}
                className="w-full px-[14px] py-[10px] border border-gray-200 rounded-xl outline-none transition-all duration-200 bg-white/90 focus:border-purple-500 focus:shadow-[0_0_0_3px_rgba(102,126,234,0.2)]"
                placeholder={t('wechatWorkWebhookUrlPlaceholder')}
              />
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={testNotification}
                className="w-full px-5 py-3 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-xl font-medium text-[14px] cursor-pointer transition-all duration-200 shadow-[0_4px_15px_rgba(245,87,108,0.3)] hover:shadow-[0_6px_20px_rgba(245,87,108,0.4)] hover:-translate-y-0.5"
              >
                {t('testNotification')}
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={resetToFactorySettings}
                className="w-full px-5 py-3 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-xl font-medium text-[14px] cursor-pointer transition-all duration-200 shadow-[0_4px_15px_rgba(239,68,68,0.25)] hover:shadow-[0_6px_20px_rgba(239,68,68,0.35)] hover:-translate-y-0.5"
              >
                {t('resetSettings')}
              </button>
            </div>

            <div className="flex gap-3 mt-2">
              <button
                onClick={saveSettings}
                className="flex-1 px-5 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-medium text-[14px] cursor-pointer transition-all duration-200 shadow-[0_4px_15px_rgba(102,126,234,0.4)] hover:shadow-[0_6px_20px_rgba(102,126,234,0.5)] hover:-translate-y-0.5"
              >
                {t('save')}
              </button>
              <button
                onClick={cancelSettings}
                className="flex-1 px-5 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium text-[14px] cursor-pointer border border-gray-200 transition-all duration-200 hover:bg-gray-200 hover:-translate-y-0.5"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        ) : (
          <MonitorPanel
            usagePercent={usagePercent}
            loading={loading}
            fetching={fetching}
            error={displayError}
            notificationStatus={displayNotificationStatus}
            isOverThreshold={isOverThreshold}
            threshold={settings.warningThreshold}
            t={t}
            lastUpdateTime={lastUpdateTime}
            onFetchUsage={handleFetchUsage}
            statusColor={statusColor}
            statusIcon={statusIcon}
          />
        )}
      </main>

      {/* 确认对话框 */}
      <ConfirmModal
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={handleConfirmReset}
        title={t('resetSettings')}
        message={t('resetSettingsConfirm')}
        confirmText={t('reset')}
        cancelText={t('cancel')}
      />
    </div>
  );
}

export default App;
