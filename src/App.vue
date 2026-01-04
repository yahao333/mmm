<template>
  <div class="app-container">
    <header class="app-header">
      <h1>{{ t('title') }}</h1>
      <div class="header-actions">
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

      <!-- 主界面 -->
      <div v-else class="main-content">
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
            @click="openMinMaxPage"
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
              :class="{ 'warning': usagePercent >= settings.warningThreshold }"
              :style="{ width: usagePercent + '%' }"
            ></div>
          </div>

          <div
            class="status"
            :class="{ 'warning': usagePercent >= settings.warningThreshold }"
          >
            {{
              usagePercent >= settings.warningThreshold
                ? t('warningMsg').replace('{threshold}', settings.warningThreshold.toString())
                : t('normalMsg')
            }}
          </div>

          <button @click="refreshData" class="refresh-btn">
            {{ t('refresh') }}
          </button>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue';
import { invoke } from '@tauri-apps/api/core';

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
    invalidInterval: '后台检查间隔必须大于 0 分钟',
    testNotification: '测试系统通知',
    notificationSent: '通知已发送',
    wechatWorkWebhookUrl: '企业微信 Webhook URL',
    wechatWorkWebhookUrlPlaceholder: 'https://qyapi.weixin.qq.com/... (可选)',
    needLogin: '请先登录 MinMax 平台',
    fetchFailed: '获取数据失败',
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
    invalidInterval: 'Check interval must be greater than 0 minutes',
    testNotification: 'Test Notification',
    notificationSent: 'Notification Sent',
    wechatWorkWebhookUrl: 'WeChat Work Webhook URL',
    wechatWorkWebhookUrlPlaceholder: 'https://qyapi.weixin.qq.com/... (optional)',
    needLogin: 'Please login to MinMax platform first',
    fetchFailed: 'Failed to fetch data',
  },
};

/**
 * 语言类型
 */
type Lang = 'zh' | 'en';

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
const usagePercent = ref(0);                      // 使用量百分比
const showSettings = ref(false);                  // 是否显示设置面板
const currentLang = ref<Lang>('zh');              // 当前语言
const notificationStatus = ref('');               // 通知状态提示

// 设置数据
const settings = reactive<Settings>({
  warningThreshold: 90,
  checkInterval: 30,
  wechatWorkWebhookUrl: '',
  language: 'zh',
});

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
 * 打开 MinMax 页面
 * 在 WebView2 中打开 MinMax 使用量页面
 */
async function openMinMaxPage(): Promise<void> {
  console.log('[MinMax App] 打开 MinMax 页面');
  // 通过 Tauri shell 插件打开 URL
  if (typeof window !== 'undefined' && (window as any).__TAURI__) {
    await (window as any).__TAURI__.shell.open('https://platform.minimaxi.com/user-center/payment/coding-plan');
  } else {
    // 开发环境下直接跳转
    window.location.href = 'https://platform.minimaxi.com/user-center/payment/coding-plan';
  }
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
 * 从后端获取使用量数据
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
}

/* 头部样式 */
.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
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
.settings-toggle {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: background 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
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
.lang-toggle:hover {
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

.refresh-btn {
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
</style>
