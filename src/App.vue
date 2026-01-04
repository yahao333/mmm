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

      <!-- 监控模式 -->
      <div v-else-if="viewMode === 'monitor'" class="monitor-mode">
        <div v-if="loading" class="loading">
          {{ t('loading') }}
        </div>

        <!-- 通知状态提示 -->
        <div v-if="notificationStatus" class="notification-status">
          {{ notificationStatus }}
        </div>

        <!-- 错误显示 -->
        <div v-if="error" class="error-container">
          <div class="error">
            {{ getErrorMessage(error) }}
          </div>
          <button
            v-if="error === 'needLogin'"
            @click="openMinMaxBrowser"
            class="link-btn"
          >
            {{ t('goToPage') }}
          </button>
        </div>

        <!-- 使用量信息 -->
        <div v-if="!loading && !error" class="usage-info">
          <div class="usage-item">
            <span class="label">{{ t('currentUsage') }}</span>
            <span class="value">{{ usagePercent }}%</span>
          </div>

          <div class="progress-bar">
            <div
              class="progress-fill"
              :class="{ 'warning': usagePercent !== null && usagePercent >= settings.warningThreshold }"
              :style="{ width: (usagePercent || 0) + '%' }"
            ></div>
          </div>

          <div
            class="status"
            :class="{ 'warning': usagePercent !== null && usagePercent >= settings.warningThreshold }"
          >
            {{
              usagePercent !== null && usagePercent >= settings.warningThreshold
                ? t('warningMsg').replace('{threshold}', settings.warningThreshold.toString())
                : t('normalMsg')
            }}
          </div>

          <div class="action-buttons">
            <button @click="refreshData" class="refresh-btn">
              {{ t('refresh') }}
            </button>
            <button @click="openMinMaxBrowser" class="browser-btn">
              {{ t('openBrowser') }}
            </button>
          </div>
        </div>

        <!-- 登录提示 -->
        <div v-if="!loading && !error && usagePercent === null" class="login-prompt">
          <p>{{ t('needLogin') }}</p>
          <button @click="openMinMaxBrowser" class="link-btn">
            {{ t('goToPage') }}
          </button>
        </div>
      </div>

      <!-- 浏览器模式 -->
      <div v-else class="browser-mode">
        <div class="browser-toolbar">
          <button @click="goBack" class="nav-btn" :disabled="!canGoBack">
            ←
          </button>
          <button @click="goForward" class="nav-btn" :disabled="!canGoForward">
            →
          </button>
          <button @click="refreshBrowser" class="nav-btn">
            ↻
          </button>
          <input
            type="text"
            v-model="currentUrl"
            class="url-input"
            readonly
          />
          <button @click="openInExternal" class="nav-btn" title="在外部浏览器打开">
            ◖
          </button>
        </div>
        <webview
          id="minmax-webview"
          :src="targetUrl"
          class="webview"
          allowpopups
        ></webview>
        <!-- 登录确认按钮 -->
        <div class="login-confirm-overlay">
          <p class="login-prompt-text">{{ t('loginPrompt') }}</p>
          <button @click="confirmLogin" class="confirm-login-btn">
            {{ t('confirmLogin') }}
          </button>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, computed, watch } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

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

// 响应式状态
const loading = ref(true);                        // 加载状态
const error = ref('');                            // 错误信息
const usagePercent = ref<number | null>(null);    // 使用量百分比
const showSettings = ref(false);                  // 是否显示设置面板
const currentLang = ref<Lang>('zh');              // 当前语言
const notificationStatus = ref('');               // 通知状态提示
const viewMode = ref<ViewMode>('monitor');        // 视图模式
const currentUrl = ref('');                       // 当前浏览器 URL
const targetUrl = ref('https://platform.minimaxi.com/user-center/payment/coding-plan'); // 目标 URL
const canGoBack = ref(false);                     // 是否可以后退
const canGoForward = ref(false);                  // 是否可以前进

// 设置数据
const settings = reactive<Settings>({
  warningThreshold: 90,
  checkInterval: 30,
  wechatWorkWebhookUrl: '',
  language: 'zh',
});

// MinMax 使用量页面 URL
const MINMAX_USAGE_URL = 'https://platform.minimaxi.com/user-center/payment/coding-plan';
// MinMax 登录页面 URL
const MINMAX_LOGIN_URL = 'https://platform.minimaxi.com/user-center/login';
// 登录状态存储 key
const LOGIN_STATUS_KEY = 'minmax_logged_in';

/**
 * 检查是否已登录
 */
function checkIsLoggedIn(): boolean {
  return localStorage.getItem(LOGIN_STATUS_KEY) === 'true';
}

/**
 * 设置登录状态
 */
function setLoggedIn(): void {
  localStorage.setItem(LOGIN_STATUS_KEY, 'true');
  console.log('[MinMax App] 已设置登录状态');
}

/**
 * 清除登录状态（用于退出登录）
 */
function clearLoginStatus(): void {
  localStorage.removeItem(LOGIN_STATUS_KEY);
  console.log('[MinMax App] 已清除登录状态');
}

/**
 * 获取翻译文本
 * @param key 翻译键
 */
function t(key: string): string {
  return messages[currentLang.value][key] || key;
}

/**
 * 获取错误信息的本地化翻译
 * @param msg 原始错误信息
 */
function getErrorMessage(msg: string): string {
  const map = messages[currentLang.value] as Record<string, string>;
  return map[msg] || msg;
}

/**
 * 切换语言
 */
async function toggleLanguage(): Promise<void> {
  currentLang.value = currentLang.value === 'zh' ? 'en' : 'zh';
  settings.language = currentLang.value;
  console.log('[MinMax App] 语言已切换:', currentLang.value);

  // 保存语言设置到后端
  await saveSettingsToBackend();
}

/**
 * 切换视图模式
 */
async function toggleViewMode(): Promise<void> {
  if (viewMode.value === 'monitor') {
    // 切换到浏览器模式
    viewMode.value = 'browser';
    console.log('[MinMax App] 切换到浏览器模式');
  } else {
    // 切换回监控模式
    viewMode.value = 'monitor';
    console.log('[MinMax App] 切换到监控模式');
    // 刷新数据
    await refreshData();
  }
}

/**
 * 在浏览器模式中打开 MinMax 页面
 */
async function openMinMaxBrowser(): Promise<void> {
  console.log('[MinMax App] 打开 MinMax 浏览器');

  // 导航到 MinMax 使用量页面
  targetUrl.value = MINMAX_USAGE_URL;
  viewMode.value = 'browser';

  // 更新窗口标题
  try {
    const appWindow = getCurrentWindow();
    await appWindow.setTitle('MinMax Helper - 浏览器');
  } catch (err) {
    console.error('[MinMax App] 设置窗口标题失败:', err);
  }
}

/**
 * 在外部浏览器中打开 URL
 */
async function openInExternal(): Promise<void> {
  console.log('[MinMax App] 在外部浏览器中打开:', currentUrl.value);

  try {
    await invoke('open_url', { url: currentUrl.value });
  } catch (err) {
    console.error('[MinMax App] 打开外部浏览器失败:', err);
  }
}

/**
 * 后退
 */
function goBack(): void {
  const webview = document.getElementById('minmax-webview') as any;
  if (webview && webview.canGoBack()) {
    webview.goBack();
  }
}

/**
 * 前进
 */
function goForward(): void {
  const webview = document.getElementById('minmax-webview') as any;
  if (webview && webview.canGoForward()) {
    webview.goForward();
  }
}

/**
 * 刷新浏览器
 */
function refreshBrowser(): void {
  const webview = document.getElementById('minmax-webview') as any;
  if (webview) {
    webview.reload();
  }
}

/**
 * 确认已登录
 * 用户登录完成后调用此方法，标记登录状态并返回监控模式
 */
async function confirmLogin(): Promise<void> {
  console.log('[MinMax App] 用户确认已登录');
  setLoggedIn();
  viewMode.value = 'monitor';
  // 刷新数据
  await refreshData();
}

/**
 * 从页面提取使用量数据
 * 参考 Chrome 扩展的 content script 逻辑
 */
function extractUsageFromPage(): number | null {
  const pageText = document.body.innerText;
  console.log('[MinMax App] 开始查找使用量数据...');
  console.log('[MinMax App] 页面文本长度:', pageText.length);

  // 方法1: 匹配 "XX% 已使用" 格式
  const percentUsedMatch = pageText.match(/(\d+(?:\.\d+)?)\s*%\s*(?:已使用|已消耗|已用)/);
  if (percentUsedMatch) {
    const percent = parseFloat(percentUsedMatch[1]);
    if (percent > 0 && percent <= 100) {
      console.log('[MinMax App] 方法1-百分比已使用格式匹配成功:', percent + '%');
      return percent;
    }
  }

  // 方法2: 匹配 "已使用 X/Y" 格式
  const usageMatch = pageText.match(/已使用\s*(\d+(?:\.\d+)?)\s*[\/｜|]\s*(\d+(?:\.\d+)?)/);
  if (usageMatch) {
    const used = parseFloat(usageMatch[1]);
    const total = parseFloat(usageMatch[2]);
    if (total > 0 && used <= total && used > 0) {
      const percent = (used / total) * 100;
      console.log('[MinMax App] 方法2-已使用格式匹配成功:', percent + '%', `(已使用 ${used}/${total})`);
      return percent;
    }
  }

  console.log('[MinMax App] 所有方法都未匹配到使用量数据');
  return null;
}

/**
 * 从后端加载设置
 */
async function loadSettingsFromBackend(): Promise<void> {
  console.log('[MinMax App] 从后端加载设置');

  try {
    // 通过 Tauri IPC 调用 Rust 后端获取设置
    const result = await invoke<Settings>('get_settings');
    Object.assign(settings, result);
    currentLang.value = result.language || 'zh';

    console.log('[MinMax App] 设置加载完成:', settings);
  } catch (err) {
    console.error('[MinMax App] 加载设置失败:', err);
    // 使用 localStorage 作为后备
    const storedSettings = localStorage.getItem('minmax_settings');
    if (storedSettings) {
      const parsed = JSON.parse(storedSettings);
      Object.assign(settings, parsed);
      currentLang.value = parsed.language || 'zh';
    }
  }
}

/**
 * 保存设置到后端
 */
async function saveSettingsToBackend(): Promise<void> {
  console.log('[MinMax App] 保存设置到后端:', settings);

  try {
    // 通过 Tauri IPC 调用 Rust 后端保存设置
    await invoke('save_settings', { settings });

    console.log('[MinMax App] 设置已保存');
  } catch (err) {
    console.error('[MinMax App] 保存设置失败:', err);
    // 使用 localStorage 作为后备
    localStorage.setItem('minmax_settings', JSON.stringify({
      warningThreshold: settings.warningThreshold,
      checkInterval: settings.checkInterval,
      wechatWorkWebhookUrl: settings.wechatWorkWebhookUrl,
      language: settings.language,
    }));
  }
}

/**
 * 切换设置面板显示
 */
function toggleSettings(): void {
  showSettings.value = !showSettings.value;
  if (showSettings.value) {
    console.log('[MinMax App] 打开设置面板');
  } else {
    console.log('[MinMax App] 关闭设置面板');
  }
}

/**
 * 保存设置
 */
async function saveSettings(): Promise<void> {
  console.log('[MinMax App] 保存设置');

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
    console.warn('[MinMax App] 预警阈值超出范围，已自动修正:', {
      before: settings.warningThreshold,
      after: sanitizedThreshold,
    });
    settings.warningThreshold = sanitizedThreshold;
  }

  // 保存设置
  await saveSettingsToBackend();
  showSettings.value = false;
}

/**
 * 取消设置修改
 */
function cancelSettings(): void {
  console.log('[MinMax App] 取消设置修改');
  showSettings.value = false;
  // 重新加载设置
  loadSettingsFromBackend();
}

/**
 * 测试系统通知
 */
async function testNotification(): Promise<void> {
  console.log('[MinMax App] 发送测试通知');

  try {
    // 通过 Tauri IPC 调用 Rust 后端发送测试通知
    await invoke('test_notification');
    alert(t('notificationSent'));
  } catch (err) {
    console.error('[MinMax App] 发送测试通知失败:', err);
    alert('Failed: ' + String(err));
  }
}

/**
 * 从后端获取使用量数据（模拟数据）
 */
async function fetchUsageFromBackend(): Promise<number> {
  console.log('[MinMax App] 从后端获取使用量数据');

  try {
    // 通过 Tauri IPC 调用 Rust 后端获取使用量
    const usage = await invoke<number>('get_usage');
    console.log('[MinMax App] 获取到使用量:', usage);
    return usage;
  } catch (err) {
    console.error('[MinMax App] 获取使用量失败:', err);
    throw err;
  }
}

/**
 * 发送预警通知
 * @param percent 当前使用量百分比
 */
async function sendWarningNotification(percent: number): Promise<void> {
  console.log('[MinMax App] 发送预警通知，使用量:', percent + '%');

  try {
    // 通过 Tauri IPC 调用 Rust 后端发送预警通知
    await invoke('send_warning_notification', {
      usage: percent,
      threshold: settings.warningThreshold,
    });
  } catch (err) {
    console.error('[MinMax App] 发送预警通知失败:', err);
  }
}

/**
 * 刷新数据
 * 重新获取使用量信息
 */
async function refreshData(): Promise<void> {
  loading.value = true;
  error.value = '';

  try {
    // 获取使用量数据
    const percent = await fetchUsageFromBackend();
    usagePercent.value = percent;

    console.log('[MinMax App] 获取到使用量:', percent + '%');

    // 如果使用量超过阈值，发送预警通知
    if (percent >= settings.warningThreshold) {
      console.log('[MinMax App] 使用量超过阈值，触发预警:', {
        percent,
        threshold: settings.warningThreshold,
      });
      await sendWarningNotification(percent);

      // 显示通知状态提示
      notificationStatus.value = t('notificationSent');
      setTimeout(() => {
        notificationStatus.value = '';
      }, 3000);
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'fetchFailed';
    console.error('[MinMax App] 获取使用量失败:', err);
  } finally {
    loading.value = false;
  }
}

// 组件挂载时自动获取数据
onMounted(async () => {
  console.log('[MinMax App] 组件已挂载');

  // 加载设置
  await loadSettingsFromBackend();

  // 检查登录状态
  if (!checkIsLoggedIn()) {
    console.log('[MinMax App] 未登录，导航到登录页面');
    // 未登录时导航到登录页面
    targetUrl.value = MINMAX_LOGIN_URL;
    viewMode.value = 'browser';
    return;
  }

  // 刷新数据
  await refreshData();
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

/* 监控模式 */
.monitor-mode {
  flex: 1;
  display: flex;
  flex-direction: column;
}

/* 加载状态 */
.loading {
  text-align: center;
  color: #666;
  padding: 20px;
}

/* 通知状态 */
.notification-status {
  text-align: center;
  color: #4caf50;
  padding: 8px;
  background: #e8f5e9;
  border-radius: 4px;
  margin-bottom: 12px;
  font-size: 14px;
}

/* 错误容器 */
.error-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.error {
  color: #e53935;
  padding: 12px;
  background: #ffebee;
  border-radius: 4px;
  font-size: 14px;
}

.link-btn {
  padding: 8px 16px;
  background: #2196f3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  text-align: center;
}

.link-btn:hover {
  background: #1976d2;
}

/* 使用量信息 */
.usage-info {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.usage-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.label {
  color: #666;
  font-size: 14px;
}

.value {
  font-size: 24px;
  font-weight: bold;
  color: #333;
}

.progress-bar {
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #4caf50;
  transition: width 0.3s ease;
}

.progress-fill.warning {
  background: #f44336;
}

.status {
  text-align: center;
  font-size: 14px;
  padding: 8px;
  background: #e8f5e9;
  border-radius: 4px;
  color: #2e7d32;
}

.status.warning {
  background: #ffebee;
  color: #c62828;
}

.action-buttons {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.refresh-btn {
  flex: 1;
  padding: 8px 16px;
  background: #2196f3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.refresh-btn:hover {
  background: #1976d2;
}

.browser-btn {
  flex: 1;
  padding: 8px 16px;
  background: #ff9800;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.browser-btn:hover {
  background: #f57c00;
}

/* 登录提示 */
.login-prompt {
  text-align: center;
  padding: 20px;
  color: #666;
}

.login-prompt p {
  margin-bottom: 12px;
}

/* 浏览器模式 */
.browser-mode {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  margin: 0 -16px;
}

.browser-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px;
  background: #f5f5f5;
  border-bottom: 1px solid #ddd;
}

.nav-btn {
  padding: 6px 10px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.nav-btn:hover:not(:disabled) {
  background: #e0e0e0;
}

.nav-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.url-input {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
  background: white;
}

/* WebView 样式 */
.webview {
  flex: 1;
  width: 100%;
  height: 100%;
  border: none;
}

/* 登录确认浮层 */
.login-confirm-overlay {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.login-prompt-text {
  margin: 0;
  padding: 6px 12px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  border-radius: 4px;
  font-size: 12px;
}

.confirm-login-btn {
  padding: 12px 24px;
  background: #4caf50;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: bold;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  transition: all 0.2s;
}

.confirm-login-btn:hover {
  background: #43a047;
  transform: scale(1.05);
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
