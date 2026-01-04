<template>
  <div class="app-container">
    <header class="app-header">
      <h1>{{ t('title') }}</h1>
      <div class="header-actions">
        <!-- 模式切换按钮 -->
        <button
          class="mode-toggle"
          :class="viewMode"
          @click="toggleViewMode"
          :title="viewMode === 'monitor' ? t('openBrowser') : t('backToMonitor')"
        >
          {{ viewMode === 'monitor' ? '🌐' : '📊' }}
        </button>
        <button class="lang-toggle" @click="toggleLanguage" :title="t('toggleLanguage')">
          {{ currentLang === 'en' ? '中' : 'EN' }}
        </button>
        <button class="settings-toggle" @click="toggleSettings" :title="t('settings')">
          ⚙️
        </button>
      </div>
    </header>

    <main class="app-main">
      <!-- 设置面板 -->
      <div v-if="showSettings" class="settings-panel">
        <h3>{{ t('settingsTitle') }}</h3>

        <div class="form-group">
          <label>{{ t('warningThreshold') }}</label>
          <input
            type="number"
            v-model.number="settings.warningThreshold"
            min="0"
            max="100"
            class="form-input"
          />
        </div>

        <div class="form-group">
          <label>{{ t('checkInterval') }}</label>
          <input
            type="number"
            v-model.number="settings.checkInterval"
            min="1"
            class="form-input"
          />
        </div>

        <div class="form-group">
          <label>{{ t('wechatWorkWebhookUrl') }}</label>
          <input
            type="text"
            v-model="settings.wechatWorkWebhookUrl"
            class="form-input"
            :placeholder="t('wechatWorkWebhookUrlPlaceholder')"
          />
        </div>

        <div class="form-group">
          <button @click="testNotification" class="test-btn">
            {{ t('testNotification') }}
          </button>
        </div>

        <div class="settings-actions">
          <button @click="saveSettings" class="save-btn">
            {{ t('save') }}
          </button>
          <button @click="cancelSettings" class="cancel-btn">
            {{ t('cancel') }}
          </button>
        </div>
      </div>

      <!-- 监控面板 -->
      <MonitorPanel
        v-else-if="viewMode === 'monitor'"
        :usage-percent="usagePercent"
        :loading="loading"
        :fetching="fetching"
        :error="displayError"
        :notification-status="notificationStatus"
        :is-over-threshold="isOverThreshold"
        :threshold="settings.warningThreshold"
        :t="t"
        :last-update-time="lastUpdateTime"
        @refresh="refreshData"
        @fetch-usage="handleFetchUsage"
        @open-browser="openExternalBrowser"
        @paste="handlePaste"
        @manual-set="handleManualSet"
      />

      <!-- 浏览器面板 -->
      <BrowserPanel
        v-else
        :t="t"
        @confirm-login="confirmLogin"
      />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed, watch } from 'vue';
import { invoke } from '@tauri-apps/api/core';

// 导入组件
import MonitorPanel from './components/MonitorPanel.vue';
import BrowserPanel from './components/BrowserPanel.vue';

// 导入 hook
import { useMinMaxAuth } from './hooks/useMinMaxAuth';
import { useUsage } from './hooks/useUsage';
import { useMinMaxWebview } from './hooks/useMinMaxWebview';

/**
 * 语言资源定义
 */
const messages: Record<string, Record<string, string>> = {
  zh: {
    title: 'MinMax 使用量监控',
    settings: '设置',
    toggleLanguage: '切换语言',
    settingsTitle: '设置',
    warningThreshold: '预警阈值 (%)',
    checkInterval: '后台检查间隔 (分钟)',
    save: '保存',
    cancel: '取消',
    loading: '正在获取使用量数据...',
    currentUsage: '当前使用量:',
    warningMsg: '⚠️ 使用量超过 {threshold}%，请注意！',
    normalMsg: '✓ 使用量正常',
    refresh: '刷新数据',
    goToPage: '前往 MinMax 页面',
    openBrowser: '打开浏览器',
    backToMonitor: '返回监控',
    invalidInterval: '后台检查间隔必须大于 0 分钟',
    testNotification: '测试系统通知',
    notificationSent: '通知已发送',
    wechatWorkWebhookUrl: '企业微信 Webhook URL',
    wechatWorkWebhookUrlPlaceholder: 'https://qyapi.weixin.qq.com/... (可选)',
    needLogin: '请先登录 MinMax 平台',
    fetchFailed: '获取数据失败',
    browserLoading: '页面加载中...',
    pleaseLogin: '请在下方登录 MinMax 账号',
    confirmLogin: '我已登录',
    loginPrompt: '请登录 MinMax 账号以查看使用量',
    loginGuideTitle: '登录 MinMax 账号',
    loginGuideDesc: '请在浏览器中打开登录页面，完成登录后返回此应用点击确认',
    openBrowserToLogin: '打开浏览器登录',
    afterLoginPrompt: '登录完成后点击确认',
    pasteUsage: '粘贴使用量',
    noUsageData: '请获取使用量数据',
    manualInputPlaceholder: '输入使用量 (0-100)',
    setUsage: '设置',
    pasteHint: '提示: 在浏览器中选中"XX% 已使用"文本后复制，然后点击粘贴',
    lastUpdate: '最后更新',
    fetchUsage: '获取使用量',
    fetching: '获取中...',
    orUseBackup: '或使用备用方式：',
  },
  en: {
    title: 'MinMax Usage Monitor',
    settings: 'Settings',
    toggleLanguage: 'Toggle Language',
    settingsTitle: 'Settings',
    warningThreshold: 'Warning Threshold (%)',
    checkInterval: 'Check Interval (min)',
    save: 'Save',
    cancel: 'Cancel',
    loading: 'Fetching usage data...',
    currentUsage: 'Current Usage:',
    warningMsg: '⚠️ Usage exceeds {threshold}%, please check!',
    normalMsg: '✓ Usage is normal',
    refresh: 'Refresh Data',
    goToPage: 'Go to MinMax Page',
    openBrowser: 'Open Browser',
    backToMonitor: 'Back to Monitor',
    invalidInterval: 'Check interval must be greater than 0 minutes',
    testNotification: 'Test Notification',
    notificationSent: 'Notification Sent',
    wechatWorkWebhookUrl: 'WeChat Work Webhook URL',
    wechatWorkWebhookUrlPlaceholder: 'https://qyapi.weixin.qq.com/... (optional)',
    needLogin: 'Please login to MinMax platform first',
    fetchFailed: 'Failed to fetch data',
    browserLoading: 'Loading page...',
    pleaseLogin: 'Please login to MinMax below',
    confirmLogin: 'I\'m logged in',
    loginPrompt: 'Please login to MinMax to view usage',
    loginGuideTitle: 'Login to MinMax',
    loginGuideDesc: 'Please open the login page in your browser, complete login, then return and click confirm',
    openBrowserToLogin: 'Open Browser to Login',
    afterLoginPrompt: 'Click confirm after login',
    pasteUsage: 'Paste Usage',
    noUsageData: 'Please get usage data',
    manualInputPlaceholder: 'Enter usage (0-100)',
    setUsage: 'Set',
    pasteHint: 'Tip: Select "XX% used" text in browser, copy, then click paste',
    lastUpdate: 'Last update',
    fetchUsage: 'Fetch Usage',
    fetching: 'Fetching...',
    orUseBackup: 'Or use backup method:',
  },
};

/**
 * 语言类型
 */
type Lang = 'zh' | 'en';

/**
 * 视图模式
 */
type ViewMode = 'monitor' | 'browser';

/**
 * 设置数据接口
 */
interface Settings {
  warningThreshold: number;
  checkInterval: number;
  wechatWorkWebhookUrl: string;
  language: Lang;
}

// 使用 hook 管理登录状态
const { isLoggedIn, login, logout } = useMinMaxAuth();

// 响应式状态
const showSettings = ref(false);    // 是否显示设置面板
const currentLang = ref<Lang>('zh'); // 当前语言
const viewMode = ref<ViewMode>('monitor'); // 视图模式

// 设置数据
const settings = reactive<Settings>({
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
  paste,
  setUsage,
} = useUsage(settings);

// 使用 hook 管理 webview 获取
const {
  webviewLoading: fetching,
  webviewError,
  executeScriptAndFetch,
  openInExternalBrowser,
} = useMinMaxWebview();

const displayError = computed(() => error.value || webviewError.value);

/**
 * 在应用内打开 MinMax 使用量页面
 */
async function openExternalBrowser(): Promise<void> {
  try {
    await openInExternalBrowser();
  } catch (err) {
    console.error('[App] 打开 MinMax 窗口失败:', err);
  }
}

/**
 * 获取翻译文本
 * @param key 翻译键
 */
function t(key: string): string {
  return messages[currentLang.value][key] || key;
}

/**
 * 切换语言
 */
async function toggleLanguage(): Promise<void> {
  currentLang.value = currentLang.value === 'zh' ? 'en' : 'zh';
  settings.language = currentLang.value;
  console.log('[App] 语言已切换:', currentLang.value);
  await saveSettingsToBackend();
}

/**
 * 切换视图模式
 */
async function toggleViewMode(): Promise<void> {
  if (viewMode.value === 'monitor') {
    viewMode.value = 'browser';
    console.log('[App] 切换到登录引导');
  } else {
    viewMode.value = 'monitor';
    console.log('[App] 切换到监控模式');
  }
}

/**
 * 确认登录完成
 * 用户登录完成后调用此方法，标记登录状态并返回监控模式
 */
async function confirmLogin(): Promise<void> {
  console.log('[App] 用户确认已登录');
  login();
  viewMode.value = 'monitor';
}

/**
 * 处理粘贴使用量
 */
async function handlePaste(): Promise<void> {
  console.log('[App] 处理粘贴使用量');
  await paste();
}

/**
 * 从页面获取使用量
 */
async function handleFetchUsage(): Promise<void> {
  console.log('[App] 从页面获取使用量');

  // 先尝试使用 JavaScript 注入方式获取
  const percent = await executeScriptAndFetch();

  if (percent !== null) {
    // 成功获取到数据
    await setUsage(percent);
    console.log('[App] 通过页面脚本获取到使用量:', percent + '%');
  } else {
    console.log('[App] 未自动获取到使用量，请使用“粘贴使用量”方式');
  }
}

/**
 * 处理手动设置使用量
 */
async function handleManualSet(value: number): Promise<void> {
  console.log('[App] 手动设置使用量:', value);
  await setUsage(value);
}

/**
 * 从后端加载设置
 */
async function loadSettingsFromBackend(): Promise<void> {
  console.log('[App] 从后端加载设置');

  try {
    const result = await invoke<Settings>('get_settings');
    Object.assign(settings, result);
    currentLang.value = (result.language as Lang) || 'zh';
    console.log('[App] 设置加载完成:', settings);
  } catch (err) {
    console.error('[App] 加载设置失败:', err);
    // 使用 localStorage 作为后备
    const storedSettings = localStorage.getItem('minmax_settings');
    if (storedSettings) {
      const parsed = JSON.parse(storedSettings);
      Object.assign(settings, parsed);
      currentLang.value = (parsed.language as Lang) || 'zh';
    }
  }
}

/**
 * 保存设置到后端
 */
async function saveSettingsToBackend(): Promise<void> {
  console.log('[App] 保存设置到后端:', settings);

  try {
    await invoke('save_settings', { settings });
    console.log('[App] 设置已保存');
  } catch (err) {
    console.error('[App] 保存设置失败:', err);
    localStorage.setItem('minmax_settings', JSON.stringify(settings));
  }
}

/**
 * 切换设置面板显示
 */
function toggleSettings(): void {
  showSettings.value = !showSettings.value;
  console.log('[App]', showSettings.value ? '打开设置面板' : '关闭设置面板');
}

/**
 * 保存设置
 */
async function saveSettings(): Promise<void> {
  console.log('[App] 保存设置');

  // 校验检查间隔
  if (!Number.isFinite(settings.checkInterval) || settings.checkInterval <= 0) {
    alert(t('invalidInterval'));
    return;
  }

  // 校验预警阈值
  const sanitizedThreshold = Number.isFinite(settings.warningThreshold)
    ? Math.min(100, Math.max(0, settings.warningThreshold))
    : 90;

  if (sanitizedThreshold !== settings.warningThreshold) {
    console.warn('[App] 预警阈值超出范围，已自动修正:', {
      before: settings.warningThreshold,
      after: sanitizedThreshold,
    });
    settings.warningThreshold = sanitizedThreshold;
  }

  await saveSettingsToBackend();
  showSettings.value = false;
}

/**
 * 取消设置修改
 */
function cancelSettings(): void {
  console.log('[App] 取消设置修改');
  showSettings.value = false;
  loadSettingsFromBackend();
}

/**
 * 测试系统通知
 */
async function testNotification(): Promise<void> {
  console.log('[App] 发送测试通知');

  try {
    await invoke('test_notification');
    alert(t('notificationSent'));
  } catch (err) {
    console.error('[App] 发送测试通知失败:', err);
    alert('Failed: ' + String(err));
  }
}

/**
 * 刷新数据（从剪贴板粘贴）
 */
async function refreshData(): Promise<void> {
  await paste();
}

// 监听设置变化，更新 useUsage hook 的配置
watch(
  () => settings.warningThreshold,
  () => {
    // 设置变化时会自动反映到 useUsage hook
    console.log('[App] 预警阈值已更新:', settings.warningThreshold);
  }
);

// 组件挂载时初始化
onMounted(async () => {
  console.log('[App] 组件已挂载');

  // 加载设置
  await loadSettingsFromBackend();

  // 检查登录状态，决定显示哪个视图
  if (!isLoggedIn.value) {
    console.log('[App] 未登录，显示登录引导');
    viewMode.value = 'browser';
  } else {
    // 已登录，提示用户粘贴数据
    console.log('[App] 已登录，等待粘贴使用量数据');
  }
});
</script>

<style scoped>
/* 应用容器 */
.app-container {
  width: 100%;
  max-width: 400px;
  margin: 0 auto;
  padding: 16px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* 头部样式 */
.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-shrink: 0;
}

.app-header h1 {
  font-size: 18px;
  margin: 0;
  color: #333;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.lang-toggle,
.settings-toggle,
.mode-toggle {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: background 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}

.mode-toggle {
  font-size: 18px;
}

.mode-toggle.monitor {
  background: #e3f2fd;
}

.mode-toggle.browser {
  background: #fff3e0;
}

.settings-toggle {
  font-size: 20px;
  border-radius: 50%;
}

.lang-toggle {
  font-size: 12px;
  font-weight: bold;
  color: #666;
  border: 1px solid #ddd;
  padding: 2px 6px;
  min-width: 24px;
}

.settings-toggle:hover,
.lang-toggle:hover,
.mode-toggle:hover {
  background: #f0f0f0;
}

/* 设置面板样式 */
.settings-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.settings-panel h3 {
  font-size: 16px;
  margin: 0 0 8px 0;
  color: #333;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-size: 14px;
  color: #666;
}

.form-input {
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.settings-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.save-btn {
  flex: 1;
  padding: 8px;
  background: #4caf50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.save-btn:hover {
  background: #43a047;
}

.cancel-btn {
  flex: 1;
  padding: 8px;
  background: #f5f5f5;
  color: #666;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.cancel-btn:hover {
  background: #eeeeee;
}

/* 主内容区 */
.app-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.test-btn {
  width: 100%;
  padding: 8px;
  background: #ff9800;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.test-btn:hover {
  background: #f57c00;
}
</style>
