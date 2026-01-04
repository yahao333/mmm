import React from 'react';

/**
 * 监控面板 Props
 */
interface MonitorPanelProps {
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
  t: (key: string, params?: Record<string, string>) => string;
  // 最后更新时间
  lastUpdateTime: Date | null;
  // 获取使用量事件
  onFetchUsage: () => void;
  // 状态颜色
  statusColor?: string;
  // 状态图标
  statusIcon?: string;
}

/**
 * 监控面板组件
 * 显示当前使用量信息和状态
 */
export function MonitorPanel({
  usagePercent,
  loading,
  fetching,
  error,
  notificationStatus,
  isOverThreshold,
  threshold,
  t,
  lastUpdateTime,
  onFetchUsage,
  statusColor = '#667eea',
  statusIcon = '📊',
}: MonitorPanelProps) {
  /**
   * 格式化时间显示
   */
  function formatTime(date: Date): string {
    return date.toLocaleTimeString();
  }

  // 渲染加载状态
  if (loading) {
    return (
      <div className="monitor-panel">
        <div className="loading-container">
          <div className="loading-spinner" />
          <p className="loading-text">{t('loading')}</p>
        </div>
      </div>
    );
  }

  // 渲染通知状态
  if (notificationStatus) {
    return (
      <div className="monitor-panel">
        <div className="notification-status">{notificationStatus}</div>
      </div>
    );
  }

  // 渲染错误
  if (error) {
    return (
      <div className="monitor-panel">
        <div className="error-container">
          <div className="error-icon">⚠️</div>
          <div className="error">{t(error) || error}</div>
        </div>
      </div>
    );
  }

  // 渲染使用量信息
  if (usagePercent !== null) {
    return (
      <div className="monitor-panel">
        {/* 进度圆环 */}
        <div className="usage-circle-container">
          <svg className="usage-circle" viewBox="0 0 120 120">
            <circle
              className="usage-circle-bg"
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke="#e8e8e8"
              strokeWidth="10"
            />
            <circle
              className="usage-circle-progress"
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke={statusColor}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${(usagePercent / 100) * 339.292} 339.292`}
              transform="rotate(-90 60 60)"
              style={{
                transition: 'stroke-dasharray 0.5s ease, stroke 0.3s ease',
              }}
            />
          </svg>
          <div className="usage-circle-content">
            <span className="usage-percent">{usagePercent}</span>
            <span className="usage-percent-symbol">%</span>
          </div>
          <div className="usage-circle-label">{t('currentUsage')}</div>
        </div>

        {/* 状态信息 */}
        <div className={`status-card ${isOverThreshold ? 'warning' : 'normal'}`}>
          <span className="status-icon">{statusIcon}</span>
          <span className="status-text">
            {isOverThreshold
              ? t('warningMsg', { threshold: threshold.toString() })
              : t('normalMsg')}
          </span>
        </div>

        {/* 更新时间提示 */}
        {lastUpdateTime && (
          <div className="update-time">
            <span className="update-icon">🕐</span>
            {t('lastUpdate')}: {formatTime(lastUpdateTime)}
          </div>
        )}

        {/* 操作按钮 */}
        <div className="action-buttons">
          <button
            onClick={onFetchUsage}
            className="fetch-btn"
            disabled={fetching}
          >
            {fetching ? (
              <>
                <span className="btn-spinner" />
                {t('fetching')}
              </>
            ) : (
              <>
                <span className="btn-icon">🔄</span>
                {t('fetchUsage')}
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // 渲染未获取到数据时的操作按钮
  return (
    <div className="monitor-panel">
      <div className="no-data-section">
        <div className="no-data-icon">{statusIcon}</div>
        <p className="no-data-text">{t('noUsageData')}</p>

        <button
          onClick={onFetchUsage}
          className="fetch-btn-large"
          disabled={fetching}
        >
          {fetching ? (
            <>
              <span className="btn-spinner" />
              {t('fetching')}
            </>
          ) : (
            <>
              <span className="btn-icon">🔄</span>
              {t('fetchUsage')}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
