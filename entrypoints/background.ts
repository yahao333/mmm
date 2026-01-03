// Background Script - 后台脚本
// 处理扩展的后台任务，如定时检查、通知等

console.log('[MinMax Background] 后台脚本已启动');

const ALARM_NAME = 'checkUsage';
let lastErrorTime = 0;
const ERROR_COOLDOWN = 60 * 60 * 1000; // 1小时冷却时间

// 主入口函数
function main(): void {
  // 监听安装事件
  chrome.runtime.onInstalled.addListener(() => {
    console.log('[MinMax Background] 扩展已安装/更新');

    // 初始化存储的配置
    chrome.storage.local.get(['checkInterval', 'warningThreshold'], (result) => {
      if (!result.checkInterval) {
        // 默认检查间隔：30分钟
        chrome.storage.local.set({ checkInterval: 30, warningThreshold: 90 });
        console.log('[MinMax Background] 已初始化默认配置');
      }
      // 设置定时任务
      setupAlarm(result.checkInterval || 30);
    });
  });

  // 监听配置变更
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.checkInterval) {
      const newInterval = changes.checkInterval.newValue;
      console.log('[MinMax Background] 检查间隔已更新为:', newInterval);
      setupAlarm(newInterval);
    }
  });

  // 监听定时任务
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) {
      console.log('[MinMax Background] 定时检查触发');
      checkMinMaxUsage();
    }
  });

  // 监听来自 popup 或 content script 的消息
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[MinMax Background] 收到消息:', message);

    if (message.action === 'checkUsage') {
      // 检查使用量
      checkMinMaxUsage().then((result) => {
        sendResponse(result);
      });

      // 返回 true 表示异步响应
      return true;
    }

    if (message.action === 'sendNotification') {
      // 发送预警通知
      console.log('[MinMax Background] 收到发送通知请求，使用量:', message.usage + '%');
      sendWarningNotification(message.usage);
      return false;
    }
  });

  console.log('[MinMax Background] 后台脚本加载完成');
}

// 导出 main 函数供 wxt 使用
export { main };

// 定义为后台脚本
export default {
  main,
};

/**
 * 检查 MinMax 使用量
 * @returns 使用量检查结果
 */
async function checkMinMaxUsage(): Promise<{ success: boolean; usage: number | null; warning: boolean }> {
  console.log('[MinMax Background] 开始检查使用量...');

  try {
    // 获取当前 MinMax 标签页
    const tabs = await chrome.tabs.query({ url: '*://platform.minimaxi.com/*' });
    console.log('[MinMax Background] 找到 MinMax 标签页数量:', tabs.length);

    if (tabs.length === 0) {
      console.log('[MinMax Background] 未找到 MinMax 页面');
      return { success: false, usage: null, warning: false };
    }

    // 获取第一个 MinMax 标签页的使用量
    const tab = tabs[0];

    // 发送消息给 content script 获取使用量
    const results = await chrome.tabs.sendMessage(tab.id!, { action: 'getUsage' });
    console.log('[MinMax Background] 获取到使用量:', results);

    // 获取预警阈值
    const threshold = await new Promise<number>((resolve) => {
      chrome.storage.local.get(['warningThreshold'], (result) => {
        resolve(result.warningThreshold || 90);
      });
    });

    const shouldWarn = results.usage !== null && results.usage >= threshold;

    // 如果需要预警，发送通知
    if (shouldWarn) {
      await sendWarningNotification(results.usage!);
    }

    return {
      success: results.success,
      usage: results.usage,
      warning: shouldWarn,
    };
  } catch (err) {
    console.error('[MinMax Background] 检查使用量失败:', err);
    // 发送错误通知
    await sendErrorNotification(err instanceof Error ? err.message : String(err));
    return { success: false, usage: null, warning: false };
  }
}

/**
 * 设置定时任务
 * @param intervalMinutes 检查间隔（分钟）
 */
function setupAlarm(intervalMinutes: number) {
  // 防御性检查：确保间隔大于 0
  if (!intervalMinutes || intervalMinutes <= 0) {
    console.warn('[MinMax Background] 检查间隔无效，重置为 1 分钟:', intervalMinutes);
    intervalMinutes = 1;
  }

  chrome.alarms.create(ALARM_NAME, {
    periodInMinutes: intervalMinutes
  });
  console.log(`[MinMax Background] 定时任务已设置，间隔: ${intervalMinutes}分钟`);
}

/**
 * 发送错误通知
 * @param error 错误信息
 */
async function sendErrorNotification(error: string): Promise<void> {
  const now = Date.now();
  // 检查冷却时间
  if (now - lastErrorTime < ERROR_COOLDOWN) {
    console.log('[MinMax Background] 错误通知处于冷却期，跳过发送');
    return;
  }

  console.log('[MinMax Background] 发送错误通知:', error);

  try {
    await chrome.notifications.create({
      type: 'basic',
      // 不指定 iconUrl，使用 Chrome 默认图标
      title: 'MinMax 监控异常',
      message: `检查使用量时发生错误: ${error}`,
      priority: 2,
    });
    lastErrorTime = now;
    console.log('[MinMax Background] 错误通知已发送');
  } catch (err) {
    console.error('[MinMax Background] 发送错误通知失败:', err);
  }
}

/**
 * 发送预警通知
 * @param usage 当前使用量百分比
 */
async function sendWarningNotification(usage: number): Promise<void> {
  console.log('[MinMax Background] 发送预警通知，使用量:', usage + '%');

  // 使用唯一 ID
  const notificationId = `minmax-warning-${Date.now()}`;

  try {
    await chrome.notifications.create(notificationId, {
      type: 'basic',
      // 不指定 iconUrl，使用 Chrome 默认图标
      title: 'MinMax 使用量预警',
      message: `当前使用量已达到 ${usage.toFixed(1)}%，请注意配额使用情况！`,
      priority: 2,
      requireInteraction: true, // 要求用户交互，防止自动消失
    });
    console.log('[MinMax Background] 预警通知已发送');
  } catch (err) {
    console.error('[MinMax Background] 发送通知失败:', err);
  }
}
