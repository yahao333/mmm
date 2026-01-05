/**
 * 国际化配置
 * 支持中文和英文两种语言
 */

// 语言类型
export type Lang = 'zh' | 'en';

// 语言资源定义
type Messages = {
  [key: string]: string;
};

// 多语言资源
const messages: Record<Lang, Messages> = {
  zh: {
    title: 'MiniMax 使用量监控',
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
    goToPage: '前往 MiniMax 页面',
    openBrowser: '打开浏览器',
    backToMonitor: '返回监控',
    invalidInterval: '后台检查间隔必须大于 0 分钟',
    testNotification: '测试系统通知',
    notificationSent: '通知已发送',
    wechatWorkWebhookUrl: '企业微信 Webhook URL',
    wechatWorkWebhookUrlPlaceholder: 'https://qyapi.weixin.qq.com/... (可选)',
    needLogin: '请先登录 MiniMax 平台',
    fetchFailed: '获取数据失败',
    browserLoading: '页面加载中...',
    pleaseLogin: '请在下方登录 MiniMax 账号',
    confirmLogin: '我已登录',
    loginPrompt: '请登录 MiniMax 账号以查看使用量',
    loginGuideTitle: '登录 MiniMax 账号',
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
    resetSettings: '恢复出厂设置',
    resetSettingsDesc: '此操作将清除所有设置并重启应用，是否继续？',
    resetSettingsConfirm: '确定要恢复出厂设置吗？此操作不可撤销。',
    resetSuccess: '已恢复出厂设置，应用将重启',
    reset: '恢复',
    checkingLogin: '正在检查登录状态...',
    loginRequired: '请先登录 MiniMax',
    goToLogin: '去登录',
  },
  en: {
    title: 'MiniMax Usage Monitor',
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
    goToPage: 'Go to MiniMax Page',
    openBrowser: 'Open Browser',
    backToMonitor: 'Back to Monitor',
    invalidInterval: 'Check interval must be greater than 0 minutes',
    testNotification: 'Test Notification',
    notificationSent: 'Notification Sent',
    wechatWorkWebhookUrl: 'WeChat Work Webhook URL',
    wechatWorkWebhookUrlPlaceholder: 'https://qyapi.weixin.qq.com/... (optional)',
    needLogin: 'Please login to MiniMax platform first',
    fetchFailed: 'Failed to fetch data',
    browserLoading: 'Loading page...',
    pleaseLogin: 'Please login to MiniMax below',
    confirmLogin: 'I\'m logged in',
    loginPrompt: 'Please login to MiniMax to view usage',
    loginGuideTitle: 'Login to MiniMax',
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
    resetSettings: 'Reset to Factory Settings',
    resetSettingsDesc: 'This will clear all settings and restart the app. Continue?',
    resetSettingsConfirm: 'Are you sure you want to reset? This action cannot be undone.',
    resetSuccess: 'Factory settings restored, app will restart',
    reset: 'Reset',
    checkingLogin: 'Checking login status...',
    loginRequired: 'Please login to MiniMax first',
    goToLogin: 'Go to Login',
  },
};

// 当前语言状态
let currentLang: Lang = 'zh';

/**
 * 获取当前语言
 */
export function getLang(): Lang {
  return currentLang;
}

/**
 * 设置当前语言
 */
export function setLang(lang: Lang): void {
  currentLang = lang;
}

/**
 * 获取翻译文本
 * @param key 翻译键
 * @param params 替换参数，例如 {threshold: '90'}
 */
export function t(key: string, params?: Record<string, string>): string {
  const message = messages[currentLang][key] || key;

  if (params) {
    return message.replace(/\{(\w+)\}/g, (match, paramKey) => {
      return params[paramKey] !== undefined ? params[paramKey] : match;
    });
  }

  return message;
}
