import React from 'react';

/**
 * 监控面板 Props
 */
interface MonitorPanelProps {
  // 使用量数据
  usagePercent: number | null;
  // 剩余重置时间
  resetTime: string | null;
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
  resetTime,
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
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <div className="flex flex-col items-center gap-4 px-5 py-10">
          <div className="w-12 h-12 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
          <p className="text-gray-600 text-sm">{t('loading')}</p>
        </div>
      </div>
    );
  }

  // 渲染通知状态
  if (notificationStatus) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="text-center text-emerald-500 px-5 py-3 bg-emerald-500/10 rounded-xl text-sm font-medium animate-fade-in">
          {notificationStatus}
        </div>
      </div>
    );
  }

  // 渲染错误
  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-5 py-5">
        <div className="text-[32px]">⚠️</div>
        <div className="text-red-500 px-5 py-3 bg-red-500/10 rounded-xl text-sm text-center">
          {t(error) || error}
        </div>
      </div>
    );
  }

  // 渲染使用量信息
  if (usagePercent !== null) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-5">
        {/* 进度圆环 */}
        <div className="relative w-[140px] h-[140px] flex items-center justify-center">
          <svg className="w-[140px] h-[140px]" viewBox="0 0 120 120">
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke="#e8e8e8"
              strokeWidth="10"
            />
            <circle
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
          <div className="absolute flex flex-col items-center justify-center">
            <span className="text-[36px] font-bold text-gray-800 leading-none">{usagePercent}</span>
            <span className="text-sm text-gray-400 font-medium">%</span>
          </div>
          <div className="absolute -bottom-7 text-xs text-gray-400 whitespace-nowrap">
            {t('currentUsage')}
          </div>
        </div>

        {/* 状态信息 */}
        <div className={`flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-medium transition-all duration-300 ${
          isOverThreshold
            ? 'bg-red-500/10 text-red-500 animate-pulse'
            : 'bg-emerald-500/10 text-emerald-500'
        }`}>
          <span className="text-base">{statusIcon}</span>
          <span>
            {isOverThreshold
              ? t('warningMsg', { threshold: threshold.toString() })
              : t('normalMsg')}
          </span>
        </div>

        {/* 剩余重置时间 */}
        {resetTime && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400 px-4 py-2 bg-black/3 rounded-full">
            <span>⏰</span>
            {resetTime}重置
          </div>
        )}

        {/* 更新时间提示 */}
        {lastUpdateTime && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400 px-4 py-2 bg-black/3 rounded-full">
            <span>🕐</span>
            {t('lastUpdate')}: {formatTime(lastUpdateTime)}
          </div>
        )}

        {/* 操作按钮 */}
        <div className="w-full flex gap-3 mt-2">
          <button
            onClick={onFetchUsage}
            className="flex-1 px-6 py-3.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-medium text-sm cursor-pointer transition-all duration-200 shadow-[0_4px_15px_rgba(102,126,234,0.4)] hover:shadow-[0_6px_20px_rgba(102,126,234,0.5)] hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
            disabled={fetching}
          >
            {fetching ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {t('fetching')}
              </>
            ) : (
              <>
                <span className="text-base">🔄</span>
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
    <div className="flex-1 flex flex-col items-center justify-center gap-4">
      <div className="flex flex-col items-center gap-4 px-5 py-10 text-center">
        <div className="text-[48px] opacity-80">{statusIcon}</div>
        <p className="text-gray-600 m-0 text-sm">{t('noUsageData')}</p>

        <button
          onClick={onFetchUsage}
          className="w-full px-8 py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-semibold text-[15px] cursor-pointer transition-all duration-200 shadow-[0_6px_20px_rgba(102,126,234,0.4)] hover:shadow-[0_8px_25px_rgba(102,126,234,0.5)] hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2.5"
          disabled={fetching}
        >
          {fetching ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              {t('fetching')}
            </>
          ) : (
            <>
              <span className="text-base">🔄</span>
              {t('fetchUsage')}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
