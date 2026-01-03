<template>
  <div class="popup-container">
    <h1>MinMax 使用量监控</h1>
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
          :class="{ 'warning': usagePercent >= 90 }"
          :style="{ width: usagePercent + '%' }"
        ></div>
      </div>
      <div class="status" :class="{ 'warning': usagePercent >= 90 }">
        {{ usagePercent >= 90 ? '⚠️ 使用量超过90%，请注意！' : '✓ 使用量正常' }}
      </div>
      <button @click="refreshData" class="refresh-btn">刷新数据</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

// 定义状态变量
const loading = ref(true);           // 加载状态
const error = ref('');               // 错误信息
const usagePercent = ref(0);         // 使用量百分比

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
    target: { tabId: tab.id },
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

    // 如果使用量超过90%，发送预警通知
    if (percent >= 90) {
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
onMounted(() => {
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

h1 {
  font-size: 18px;
  margin-bottom: 16px;
  text-align: center;
  color: #333;
}

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
