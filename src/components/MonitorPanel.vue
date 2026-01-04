<template>
  <div class="monitor-panel">
    <!-- 加载状态 -->
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
        {{ t(error) || error }}
      </div>
    </div>

    <!-- 使用量信息 -->
    <div v-if="!loading && !error && usagePercent !== null" class="usage-info">
      <div class="usage-item">
        <span class="label">{{ t('currentUsage') }}</span>
        <span class="value">{{ usagePercent }}%</span>
      </div>

      <div class="progress-bar">
        <div
          class="progress-fill"
          :class="{ 'warning': isOverThreshold }"
          :style="{ width: (usagePercent || 0) + '%' }"
        ></div>
      </div>

      <div
        class="status"
        :class="{ 'warning': isOverThreshold }"
      >
        {{
          isOverThreshold
            ? t('warningMsg').replace('{threshold}', threshold.toString())
            : t('normalMsg')
        }}
      </div>

      <!-- 更新时间提示 -->
      <div v-if="lastUpdateTime" class="update-time">
        {{ t('lastUpdate') }}: {{ formatTime(lastUpdateTime) }}
      </div>

      <div class="action-buttons">
        <button @click="$emit('fetch-usage')" class="fetch-btn" :disabled="fetching">
          {{ fetching ? t('fetching') : '🔄 ' + t('fetchUsage') }}
        </button>
      </div>
    </div>

    <!-- 未获取到数据时显示操作按钮 -->
    <div v-if="!loading && !error && usagePercent === null" class="no-data-section">
      <p class="no-data-text">{{ t('noUsageData') }}</p>

      <!-- 获取使用量按钮 -->
      <button @click="$emit('fetch-usage')" class="fetch-btn-large" :disabled="fetching">
        {{ fetching ? t('fetching') : '🔄 ' + t('fetchUsage') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 监控面板组件
 * 显示当前使用量信息和状态
 */

interface Props {
  // 使用量数据
  usagePercent: number | null;
  // 加载状态
  loading: boolean;
  // 是否正在获取数据（用于 fetch 按钮）
  fetching: boolean;
  // 错误信息
  error: string | null;
  // 通知状态
  notificationStatus: string;
  // 是否超过阈值
  isOverThreshold: boolean;
  // 预警阈值
  threshold: number;
  // 翻译函数
  t: (key: string) => string;
  // 最后更新时间
  lastUpdateTime: Date | null;
}

defineProps<Props>();

/**
 * 格式化时间显示
 */
function formatTime(date: Date): string {
  return date.toLocaleTimeString();
}

// 事件定义
defineEmits<{
  'fetch-usage': [];    // 从页面获取使用量
}>();
</script>

<style scoped>
/* 监控面板容器 */
.monitor-panel {
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

/* 粘贴按钮 */
.paste-btn {
  flex: 1;
  padding: 8px 16px;
  background: #9c27b0;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.paste-btn:hover {
  background: #7b1fa2;
}

/* 获取使用量按钮 */
.fetch-btn {
  flex: 1;
  padding: 8px 16px;
  background: #2196f3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.fetch-btn:hover:not(:disabled) {
  background: #1976d2;
}

.fetch-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 大获取按钮 */
.fetch-btn-large {
  padding: 12px 24px;
  background: #2196f3;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
  font-weight: bold;
  transition: all 0.2s;
  width: 100%;
}

.fetch-btn-large:hover:not(:disabled) {
  background: #1976d2;
  transform: scale(1.02);
}

.fetch-btn-large:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 备用操作区域 */
.backup-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  padding-top: 16px;
  border-top: 1px dashed #ddd;
}

.backup-title {
  font-size: 12px;
  color: #999;
  text-align: center;
  margin: 0;
}

/* 更新时间 */
.update-time {
  text-align: center;
  font-size: 12px;
  color: #999;
}

/* 无数据区域 */
.no-data-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 20px;
}

.no-data-text {
  color: #666;
  margin: 0;
}

/* 手动输入 */
.manual-input {
  display: flex;
  gap: 8px;
  width: 100%;
}

.manual-input-field {
  flex: 1;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.manual-input-btn {
  padding: 8px 16px;
  background: #607d8b;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.manual-input-btn:hover {
  background: #546e7a;
}

.manual-input-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 大粘贴按钮 */
.paste-btn-large {
  padding: 12px 24px;
  background: #9c27b0;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: bold;
  transition: all 0.2s;
}

.paste-btn-large:hover {
  background: #7b1fa2;
  transform: scale(1.02);
}

.paste-hint {
  font-size: 12px;
  color: #999;
  margin: 0;
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
</style>
