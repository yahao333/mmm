<template>
  <div class="popup-container">
    <div class="header">
      <h1>MinMax 使用量监控</h1>
      <button class="settings-toggle" @click="toggleSettings" title="设置">⚙️</button>
    </div>

    <!-- 设置面板 -->
    <div v-if="showSettings" class="settings-panel">
      <h3>设置</h3>
      <div class="form-group">
        <label>预警阈值 (%)</label>
        <input type="number" v-model.number="threshold" min="0" max="100" class="form-input" />
      </div>
      <div class="form-group">
        <label>后台检查间隔 (分钟)</label>
        <input type="number" v-model.number="checkInterval" min="1" class="form-input" />
      </div>
      <div class="settings-actions">
        <button @click="saveSettings" class="save-btn">保存</button>
        <button @click="cancelSettings" class="cancel-btn">取消</button>
      </div>
    </div>

    <div v-else>
      <div v-if="loading" class="loading">
        正在获取使用量数据...
      </div>
      <div v-else-if="error" class="error">
        {{ error }}
      </div>
      <div v-else class="usage-info">
        <div class="usage-item">
          <span class="label">当前使用量:</span>
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
          {{ usagePercent >= threshold ? '⚠️ 使用量超过' + threshold + '%，请注意！' : '✓ 使用量正常' }}
        </div>
        <button @click="refreshData" class="refresh-btn">刷新数据</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

// 定义状态变量
const loading = ref(true);           // 加载状态
const error = ref('');               // 错误信息
const usagePercent = ref(0);         // 使用量百分比
const showSettings = ref(false);     // 是否显示设置
const threshold = ref(90);           // 预警阈值
const checkInterval = ref(30);       // 检查间隔

/**
 * 加载设置
 */
async function loadSettings() {
  const result = await chrome.storage.local.get(['warningThreshold', 'checkInterval']);
  if (result.warningThreshold !== undefined) threshold.value = result.warningThreshold;
  if (result.checkInterval !== undefined) checkInterval.value = result.checkInterval;
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
  await chrome.storage.local.set({
    warningThreshold: threshold.value,
    checkInterval: checkInterval.value
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
 * @param percent 当前使用量百分比
 */
async function sendWarningNotification(percent: number): Promise<void> {
  // 调试日志：记录预警触发
  console.log('[MinMax Popup] 触发预警通知，使用量:', percent + '%');

  await chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icon-128.png',  // 需要在项目中添加图标
    title: 'MinMax 使用量预警',
    message: `当前使用量已达到 ${percent.toFixed(1)}%，请注意配额使用情况！`,
    priority: 2,
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
    if (percent >= threshold.value) {
      await sendWarningNotification(percent);
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

h1 {
  font-size: 18px;
  margin: 0;
  color: #333;
}

.settings-toggle {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  padding: 4px;
  border-radius: 50%;
  transition: background 0.2s;
}

.settings-toggle:hover {
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

.error {
  color: #e53935;
  padding: 12px;
  background: #ffebee;
  border-radius: 4px;
  font-size: 14px;
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
