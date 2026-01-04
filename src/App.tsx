import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';

// 导入样式
import './style.css';
import './App.css';

// 导入组件
import { MonitorPanel } from './components/MonitorPanel';

// 导入 hook
import { useUsage, Settings } from './hooks/useUsage';
import { useMinMaxWebview } from './hooks/useMinMaxWebview';
import { useNotification } from './hooks/useNotification';

// 导入国际化
import { t, getLang, setLang, Lang } from './i18n';

// 语言类型
type Language = Lang;

// 设置数据接口
interface AppSettings extends Settings {
  language: Language;
}

/**
 * 主应用组件
 */
function App() {
  // 是否显示设置面板
  const [showSettings, setShowSettings] = useState(false);
  // 当前语言
  const [currentLang, setCurrentLang] = useState<Language>('zh');
  // 设置数据
  const [settings, setSettings] = useState<AppSettings>({
    warningThreshold: 90,
    checkInterval: 30,
    wechatWorkWebhookUrl: '',
    language: 'zh',
  });

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
    console.log('[App] autoUsagePercent 变化:', autoUsagePercent);
    if (autoUsagePercent === null) return;
    console.log('[App] 收到自动使用量，更新到面板:', autoUsagePercent + '%');
    setUsage(autoUsagePercent);
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
      setSettings(prev => ({ ...prev, ...result }));
      setCurrentLang(result.language as Language || 'zh');
      console.log('[App] 设置加载完成:', result);
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
   * 保存设置到后端
   */
  const saveSettingsToBackend = useCallback(async () => {
    console.log('[App] 保存设置到后端:', settings);

    try {
      await invoke('save_settings', { settings });
      console.log('[App] 设置已保存');
      await loadSettingsFromBackend();
      console.log('[App] 设置已验证:', settings);
    } catch (err) {
      console.error('[App] 保存设置失败:', err);
      localStorage.setItem('minmax_settings', JSON.stringify(settings));
    }
  }, [settings, loadSettingsFromBackend]);

  /**
   * 切换语言
   */
  const toggleLanguage = useCallback(async () => {
    const newLang = currentLang === 'zh' ? 'en' : 'zh';
    setCurrentLang(newLang);
    setLang(newLang);
    setSettings(prev => ({ ...prev, language: newLang }));
    console.log('[App] 语言已切换:', newLang);
    await saveSettingsToBackend();
  }, [currentLang, saveSettingsToBackend]);

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

    if (!Number.isFinite(settings.checkInterval) || settings.checkInterval <= 0) {
      alert(t('invalidInterval'));
      return;
    }

    let sanitizedThreshold = settings.warningThreshold;
    if (!Number.isFinite(settings.warningThreshold)) {
      sanitizedThreshold = 90;
    } else {
      sanitizedThreshold = Math.min(100, Math.max(0, settings.warningThreshold));
    }

    if (sanitizedThreshold !== settings.warningThreshold) {
      console.warn('[App] 预警阈值超出范围，已自动修正:', {
        before: settings.warningThreshold,
        after: sanitizedThreshold,
      });
      setSettings(prev => ({ ...prev, warningThreshold: sanitizedThreshold }));
    }

    await saveSettingsToBackend();
    setShowSettings(false);
  }, [settings, saveSettingsToBackend]);

  /**
   * 取消设置修改
   */
  const cancelSettings = useCallback(() => {
    console.log('[App] 取消设置修改');
    setShowSettings(false);
    loadSettingsFromBackend();
  }, [loadSettingsFromBackend]);

  /**
   * 测试系统通知
   */
  const testNotification = useCallback(async () => {
    console.log('[App] 发送测试通知');
    const success = await sendTestNotification();
    if (success) {
      alert(t('notificationSent'));
    } else {
      alert('Failed: ' + notificationState.message);
    }
  }, [sendTestNotification, notificationState.message]);

  /**
   * 输入处理函数
   */
  const handleWarningThresholdChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setSettings(prev => ({ ...prev, warningThreshold: isNaN(value) ? 0 : value }));
  }, []);

  const handleCheckIntervalChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setSettings(prev => ({ ...prev, checkInterval: isNaN(value) ? 0 : value }));
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
    <div className="app-container">
      {/* 状态指示器 */}
      <div className="status-indicator" style={{ backgroundColor: statusColor }}>
        {statusIcon}
      </div>

      <header className="app-header">
        <h1>
          <span className="header-icon">📊</span>
          {t('title')}
        </h1>
        <div className="header-actions">
          <button
            className="lang-toggle"
            onClick={toggleLanguage}
            title={t('toggleLanguage')}
          >
            {currentLang === 'en' ? '中' : 'EN'}
          </button>
          <button
            className="settings-toggle"
            onClick={toggleSettings}
            title={t('settings')}
          >
            ⚙️
          </button>
        </div>
      </header>

      <main className="app-main">
        {showSettings ? (
          <div className="settings-panel">
            <h3>
              <span className="panel-icon">⚙️</span>
              {t('settingsTitle')}
            </h3>

            <div className="form-group">
              <label>{t('warningThreshold')}</label>
              <input
                type="number"
                value={settings.warningThreshold}
                onChange={handleWarningThresholdChange}
                min={0}
                max={100}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>{t('checkInterval')}</label>
              <input
                type="number"
                value={settings.checkInterval}
                onChange={handleCheckIntervalChange}
                min={1}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>{t('wechatWorkWebhookUrl')}</label>
              <input
                type="text"
                value={settings.wechatWorkWebhookUrl}
                onChange={handleWebhookUrlChange}
                className="form-input"
                placeholder={t('wechatWorkWebhookUrlPlaceholder')}
              />
            </div>

            <div className="form-group">
              <button onClick={testNotification} className="test-btn">
                {t('testNotification')}
              </button>
            </div>

            <div className="settings-actions">
              <button onClick={saveSettings} className="save-btn">
                {t('save')}
              </button>
              <button onClick={cancelSettings} className="cancel-btn">
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
    </div>
  );
}

export default App;
