<template>
  <div class="popup-container">
    <div class="header">
      <h1>{{ t('title') }}</h1>
      <div class="header-actions">
        <button class="lang-toggle" @click="toggleLanguage" title="Change Language">
          {{ currentLang === 'en' ? '中' : 'EN' }}
        </button>
        <button class="settings-toggle" @click="toggleSettings" :title="t('settings')">⚙️</button>
      </div>
    </div>

    <!-- 设置面板 -->
    <div v-if="showSettings" class="settings-panel">
      <h3>{{ t('settingsTitle') }}</h3>
      <div class="form-group">
        <label>{{ t('warningThreshold') }}</label>
        <input type="number" v-model.number="threshold" min="0" max="100" class="form-input" />
      </div>
      <div class="form-group">
        <label>{{ t('checkInterval') }}</label>
        <input type="number" v-model.number="checkInterval" min="1" class="form-input" />
      </div>
      <div class="form-group">
        <label>{{ t('wechatWorkWebhookUrl') }}</label>
        <input type="text" v-model="wechatWorkWebhookUrl" class="form-input" :placeholder="t('wechatWorkWebhookUrlPlaceholder')" />
      </div>
      <div class="form-group">
        <button @click="testNotification" class="test-btn">{{ t('testNotification') }}</button>
      </div>
      <div class="settings-actions">
        <button @click="saveSettings" class="save-btn">{{ t('save') }}</button>
        <button @click="cancelSettings" class="cancel-btn">{{ t('cancel') }}</button>
      </div>
    </div>

    <div v-else>
      <div v-if="loading" class="loading">
        {{ t('loading') }}
      </div>
      <div v-if="notificationStatus" class="notification-status">
        {{ notificationStatus }}
      </div>
      <div v-if="!loading && error" class="error-container">
        <div class="error">
          {{ getErrorMessage(error) }}
        </div>
        <button 
          v-if="error === '请在 MinMax 页面打开扩展' || error === 'Please open extension on MinMax page'"
          @click="openMinMaxPage" 
          class="link-btn"
        >
          {{ t('goToPage') }}
        </button>
      </div>
      <div v-else class="usage-info">
        <div class="usage-item">
          <span class="label">{{ t('currentUsage') }}</span>
          <span class="value">{{ usagePercent }}%</span>
        </div>
        <div class="progress-bar">
          <div
            class="progress-fill"
            :class="{ 'warning': usagePercent >= threshold }"
            :style="{ width: usagePercent + '%' }"
          ></div>
        </div>
        <div class="status" :class="{ 'warning': usagePercent >= threshold }">
          {{ usagePercent >= threshold ? t('warningMsg').replace('{threshold}', threshold.toString()) : t('normalMsg') }}
        </div>
        <button @click="refreshData" class="refresh-btn">{{ t('refresh') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';

// 定义语言资源
const messages = {
  zh: {
    title: 'MinMax 使用量监控',
    settings: '设置',
    warningThreshold: '预警阈值 (%)',
    checkInterval: '后台检查间隔 (分钟)',
    save: '保存',
    cancel: '取消',
    loading: '正在获取使用量数据...',
    currentUsage: '当前使用量:',
    warningMsg: '⚠️ 使用量超过 {threshold}%，请注意！',
    normalMsg: '✓ 使用量正常',
    refresh: '刷新数据',
    settingsTitle: '设置',
    goToPage: '前往 MinMax 页面',
    invalidInterval: '后台检查间隔必须大于 0 分钟',
    testNotification: '测试系统通知',
    notificationSent: '通知已发送',
    wechatWorkWebhookUrl: '企业微信 Webhook URL',
    wechatWorkWebhookUrlPlaceholder: 'https://qyapi.weixin.qq.com/... (可选)',
    // 错误信息映射
    '请在 MinMax 页面打开扩展': '请在 MinMax 页面打开扩展',
    '未能在页面中找到使用量数据，请确认是否在正确的页面上': '未能在页面中找到使用量数据，请确认是否在正确的页面上',
    '获取数据失败': '获取数据失败',
    'Please open extension on MinMax page': '请在 MinMax 页面打开扩展',
    'Usage data not found on page': '未能在页面中找到使用量数据',
    'Failed to fetch data': '获取数据失败'
  },
  en: {
    title: 'MinMax Usage Monitor',
    settings: 'Settings',
    warningThreshold: 'Warning Threshold (%)',
    checkInterval: 'Check Interval (min)',
    save: 'Save',
    cancel: 'Cancel',
    loading: 'Fetching usage data...',
    currentUsage: 'Current Usage:',
    warningMsg: '⚠️ Usage exceeds {threshold}%, please check!',
    normalMsg: '✓ Usage is normal',
    refresh: 'Refresh Data',
    settingsTitle: 'Settings',
    goToPage: 'Go to MinMax Page',
    invalidInterval: 'Check interval must be greater than 0 minutes',
    testNotification: 'Test Notification',
    notificationSent: 'Notification Sent',
    wechatWorkWebhookUrl: 'WeChat Work Webhook URL',
    wechatWorkWebhookUrlPlaceholder: 'https://qyapi.weixin.qq.com/... (optional)',
    // Error mapping
    '请在 MinMax 页面打开扩展': 'Please open extension on MinMax page',
    '未能在页面中找到使用量数据，请确认是否在正确的页面上': 'Usage data not found on page',
    '获取数据失败': 'Failed to fetch data',
    'Please open extension on MinMax page': 'Please open extension on MinMax page',
    'Usage data not found on page': 'Usage data not found on page',
    'Failed to fetch data': 'Failed to fetch data'
  }
};

type Lang = 'zh' | 'en';

// 定义状态变量
const loading = ref(true);           // 加载状态
const error = ref('');               // 错误信息
const usagePercent = ref(0);         // 使用量百分比
const showSettings = ref(false);     // 是否显示设置
const threshold = ref(90);           // 预警阈值
const checkInterval = ref(30);       // 检查间隔
const currentLang = ref<Lang>('en'); // 当前语言，默认英文
const notificationStatus = ref('');  // 通知状态提示
const wechatWorkWebhookUrl = ref(''); // 企业微信 Webhook URL

/**
 * 获取翻译文本
 * @param key 翻译键
 */
function t(key: keyof typeof messages['en']) {
  return messages[currentLang.value][key] || key;
}

/**
 * 获取错误信息的翻译
 * 尝试匹配已知的错误信息并翻译，否则显示原样
 */
function getErrorMessage(msg: string) {
  const map = messages[currentLang.value] as Record<string, string>;
  return map[msg] || msg;
}

/**
 * 切换语言
 */
async function toggleLanguage() {
  currentLang.value = currentLang.value === 'en' ? 'zh' : 'en';
  await chrome.storage.local.set({ language: currentLang.value });
}

/**
 * 打开 MinMax 页面
 */
function openMinMaxPage() {
  chrome.tabs.create({ url: 'https://platform.minimaxi.com/user-center/payment/coding-plan' });
}

/**
 * 加载设置
 */
async function loadSettings() {
  const result = await chrome.storage.local.get(['warningThreshold', 'checkInterval', 'language', 'wechatWorkWebhookUrl']);
  const storedThreshold = typeof result.warningThreshold === 'number' ? result.warningThreshold : Number(result.warningThreshold);
  if (Number.isFinite(storedThreshold)) threshold.value = storedThreshold;

  const storedInterval = typeof result.checkInterval === 'number' ? result.checkInterval : Number(result.checkInterval);
  if (Number.isFinite(storedInterval)) checkInterval.value = storedInterval;
  if (result.language !== undefined) currentLang.value = result.language as Lang;
  if (result.wechatWorkWebhookUrl !== undefined) wechatWorkWebhookUrl.value = result.wechatWorkWebhookUrl;
}

/**
 * 切换设置面板显示
 */
function toggleSettings() {
  showSettings.value = !showSettings.value;
  if (showSettings.value) {
    loadSettings();
  }
}

/**
 * 保存设置
 */
async function saveSettings() {
  // 校验检查间隔
  if (!Number.isFinite(checkInterval.value) || checkInterval.value <= 0) {
    alert(t('invalidInterval'));
    return;
  }

  const sanitizedThreshold = Number.isFinite(threshold.value) ? Math.min(100, Math.max(0, threshold.value)) : 90;
  const sanitizedInterval = checkInterval.value;

  if (sanitizedThreshold !== threshold.value) {
    console.warn('[MinMax Popup] 预警阈值超出范围，已自动修正:', { before: threshold.value, after: sanitizedThreshold });
    threshold.value = sanitizedThreshold;
  }

  await chrome.storage.local.set({
    warningThreshold: sanitizedThreshold,
    checkInterval: sanitizedInterval,
    wechatWorkWebhookUrl: wechatWorkWebhookUrl.value
  });
  showSettings.value = false;
}

/**
 * 取消设置修改
 */
function cancelSettings() {
  showSettings.value = false;
  loadSettings();
}

/**
 * 测试系统通知
 */
async function testNotification() {
  try {
    // 通过 background 脚本发送测试通知
    await chrome.runtime.sendMessage({
      action: 'sendNotification',
      usage: 88.8
    });
    alert(t('notificationSent'));
  } catch (err) {
    console.error('Failed to send test notification:', err);
    alert('Failed: ' + String(err));
  }
}

/**
 * 获取当前标签页
 * @returns 当前活动标签页信息
 */
async function getCurrentTab(): Promise<chrome.tabs.Tab> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

/**
 * 从页面获取 MinMax 使用量数据
 * 通过 content script 注入脚本来获取页面数据
 */
async function fetchUsageData(): Promise<number> {
  // 获取当前标签页
  const tab = await getCurrentTab();

  // 检查是否是 MinMax 页面
  if (!tab.url?.includes('minimaxi.com')) {
    throw new Error('请在 MinMax 页面打开扩展');
  }

  // 调试日志：记录当前页面 URL
  console.log('[MinMax Popup] 当前页面 URL:', tab.url);

  // 执行脚本获取使用量数据
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id! },
    func: () => {
      // 从页面中查找使用量信息
      // 页面结构：查找包含 "已使用" 或百分比信息的元素
      const usageText = document.body.innerText;

      // 调试日志：记录页面内容（截取前500字符）
      console.log('[MinMax Popup] 页面内容预览:', usageText.substring(0, 500));

      // 尝试匹配使用量百分比模式
      // 匹配格式如: "80%", "85.5%", "90%" 等
      const percentMatch = usageText.match(/(\d+(?:\.\d+)?)%/);

      if (percentMatch) {
        const percent = parseFloat(percentMatch[1]);
        console.log('[MinMax Popup] 匹配到使用量百分比:', percent + '%');
        return percent;
      }

      // 尝试查找特定文本模式
      // 格式如: "已使用 80/100" 或 "80 / 100"
      const usageMatch = usageText.match(/已使用\s*(\d+(?:\.\d+)?)\s*[\/｜|]\s*(\d+(?:\.\d+)?)/);
      if (usageMatch) {
        const used = parseFloat(usageMatch[1]);
        const total = parseFloat(usageMatch[2]);
        const percent = (used / total) * 100;
        console.log('[MinMax Popup] 计算使用量百分比:', percent + '%', `(已使用 ${used}/${total})`);
        return percent;
      }

      console.log('[MinMax Popup] 未找到使用量数据');
      return null;
    },
  });

  if (results[0]?.result !== null && results[0]?.result !== undefined) {
    return results[0].result as number;
  }

  throw new Error('未能在页面中找到使用量数据，请确认是否在正确的页面上');
}

/**
 * 发送预警通知
 * 通过 background 脚本发送通知，避免 popup 直接调用通知 API 的限制
 * @param percent 当前使用量百分比
 */
async function sendWarningNotification(percent: number): Promise<void> {
  // 调试日志：记录预警触发
  console.log('[MinMax Popup] 触发预警通知，使用量:', percent + '%');

  // 发送消息给 background 脚本，由 background 发送通知
  await chrome.runtime.sendMessage({
    action: 'sendNotification',
    usage: percent
  });
}

/**
 * 刷新数据
 * 重新获取当前页面使用量信息
 */
async function refreshData(): Promise<void> {
  loading.value = true;
  error.value = '';

  try {
    // 获取使用量数据
    const percent = await fetchUsageData();
    usagePercent.value = percent;

    // 调试日志：记录获取到的使用量
    console.log('[MinMax Popup] 获取到使用量:', percent + '%');

    // 如果使用量超过阈值，发送预警通知
    console.log('[MinMax Popup] 预警检查: percent=', percent, 'threshold.value=', threshold.value, 'percent >= threshold.value:', percent >= threshold.value);
    if (percent >= threshold.value) {
      await sendWarningNotification(percent);
      // 显示通知状态提示
      notificationStatus.value = t('notificationSent');
      setTimeout(() => {
        notificationStatus.value = '';
      }, 3000);
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '获取数据失败';
    console.error('[MinMax Popup] 获取使用量失败:', err);
  } finally {
    loading.value = false;
  }
}

// 组件挂载时自动获取数据
onMounted(async () => {
  await loadSettings();
  console.log('[MinMax Popup] 组件已挂载，开始获取数据');
  refreshData();
});
</script>

<style>
.popup-container {
  width: 300px;
  padding: 16px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* Header Styles */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

h1 {
  font-size: 18px;
  margin: 0;
  color: #333;
}

.settings-toggle, .lang-toggle {
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

.settings-toggle:hover, .lang-toggle:hover {
  background: #f0f0f0;
}

/* Settings Panel Styles */
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

/* Existing Styles */
.loading {
  text-align: center;
  color: #666;
  padding: 20px;
}

.notification-status {
  text-align: center;
  color: #4caf50;
  padding: 8px;
  background: #e8f5e9;
  border-radius: 4px;
  margin-bottom: 12px;
  font-size: 14px;
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
