// Background Script - 后台脚本
// 处理扩展的后台任务，如定时检查、通知等

console.log('[MiniMax Background] 后台脚本已启动');

const ALARM_NAME = 'checkUsage';
let lastErrorTime = 0;
let lastEnterpriseErrorTime = 0; // 企业微信错误通知时间
const ERROR_COOLDOWN = 60 * 60 * 1000; // 1小时冷却时间（系统通知）
const ENTERPRISE_ERROR_COOLDOWN = 4 * 60 * 60 * 1000; // 4小时冷却时间（企业微信通知）

// 通知队列存储键名
const NOTIFICATION_QUEUE_KEY = 'notificationQueue';

// 主入口函数
function main(): void {
  // 监听安装事件
  chrome.runtime.onInstalled.addListener(() => {
    console.log('[MiniMax Background] 扩展已安装/更新');

    // 初始化存储的配置
    chrome.storage.local.get(['checkInterval', 'warningThreshold', 'wechatWorkWebhookUrl', NOTIFICATION_QUEUE_KEY], (result) => {
      if (!result.checkInterval) {
        // 默认检查间隔：30分钟
        chrome.storage.local.set({
          checkInterval: 30,
          warningThreshold: 90,
          wechatWorkWebhookUrl: '',
          [NOTIFICATION_QUEUE_KEY]: []
        });
        console.log('[MiniMax Background] 已初始化默认配置');
      }
      // 设置定时任务
      setupAlarm(result.checkInterval || 30);
    });
  });

  // 监听浏览器启动事件（防止重启后未恢复定时任务）
  chrome.runtime.onStartup.addListener(() => {
    console.log('[MiniMax Background] 浏览器启动，检查并恢复定时任务');
    void ensureAlarmScheduled('onStartup');
  });

  // 监听配置变更
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.checkInterval) {
      const newInterval = changes.checkInterval.newValue;
      console.log('[MiniMax Background] 检查间隔已更新为:', newInterval);
      setupAlarm(newInterval);
    }
  });

  // 监听定时任务
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) {
      console.log('[MiniMax Background] 定时检查触发');
      // 执行定时检查任务
      scheduledCheck();
    }
  });

  // 监听来自 popup 或 content script 的消息
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[MiniMax Background] 收到消息:', message);

    if (message.action === 'checkUsage') {
      // 检查使用量（手动触发，不使用队列）
      checkMinMaxUsage(false).then((result) => {
        sendResponse(result);
      });

      // 返回 true 表示异步响应
      return true;
    }

    if (message.action === 'sendNotification') {
      // 发送预警通知
      console.log('[MiniMax Background] 收到发送通知请求，使用量:', message.usage + '%');
      sendWarningNotification(message.usage);
      return false;
    }

    if (message.action === 'getQueueStatus') {
      // 获取队列状态
      getQueueStatus().then((status) => {
        sendResponse(status);
      });
      return true;
    }
  });

  // 后台脚本启动时也检查一次，避免 service worker 被唤醒但 alarm 未创建
  void ensureAlarmScheduled('backgroundStart');

  console.log('[MiniMax Background] 后台脚本加载完成');
}

// 导出 main 函数供 wxt 使用
export { main };

// 定义为后台脚本
export default {
  main,
};

// ==================== 通知队列管理 ====================

/**
 * 通知项类型
 */
interface NotificationItem {
  id: string;           // 唯一标识
  type: 'warning' | 'error'; // 通知类型
  title: string;        // 通知标题
  content: string;      // 通知内容
  usage?: number;       // 使用量（预警通知）
  timestamp: number;    // 创建时间
  sent: boolean;        // 是否已发送
  sentAt?: number;      // 发送时间
}

/**
 * 获取通知队列
 */
async function getNotificationQueue(): Promise<NotificationItem[]> {
  return new Promise((resolve) => {
    chrome.storage.local.get([NOTIFICATION_QUEUE_KEY], (result) => {
      const queue = result[NOTIFICATION_QUEUE_KEY] || [];
      console.log('[MiniMax Background] 获取通知队列，当前数量:', queue.length);
      resolve(queue as NotificationItem[]);
    });
  });
}

/**
 * 保存通知队列
 */
async function saveNotificationQueue(queue: NotificationItem[]): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [NOTIFICATION_QUEUE_KEY]: queue }, () => {
      console.log('[MiniMax Background] 保存通知队列，数量:', queue.length);
      resolve();
    });
  });
}

/**
 * 添加通知到队列
 */
async function addToQueue(item: Omit<NotificationItem, 'id' | 'timestamp' | 'sent'>): Promise<void> {
  const queue = await getNotificationQueue();

  // 检查是否已存在相同类型的未发送通知（避免重复添加）
  const existing = queue.find(n => !n.sent && n.type === item.type);
  if (existing) {
    console.log('[MiniMax Background] 存在未发送的同类通知，跳过添加:', item.type);
    return;
  }

  const newItem: NotificationItem = {
    ...item,
    id: `${item.type}-${Date.now()}`,
    timestamp: Date.now(),
    sent: false,
  };

  queue.push(newItem);
  await saveNotificationQueue(queue);
  console.log('[MiniMax Background] 添加通知到队列:', newItem.id, newItem.type);
}

/**
 * 获取队列状态
 */
async function getQueueStatus(): Promise<{ pending: number; sent: number }> {
  const queue = await getNotificationQueue();
  return {
    pending: queue.filter(n => !n.sent).length,
    sent: queue.filter(n => n.sent).length,
  };
}

/**
 * 发送队列中的待发送通知
 */
async function sendQueuedNotifications(): Promise<number> {
  const queue = await getNotificationQueue();
  let sentCount = 0;

  for (const item of queue) {
    if (item.sent) continue;

    console.log('[MiniMax Background] 发送队列中的通知:', item.id, item.type);

    // 发送系统通知
    if (item.type === 'warning') {
      try {
        const notificationId = `minmax-warning-${item.id}`;
        await chrome.notifications.create(notificationId, {
          type: 'basic',
          title: item.title,
          message: item.content,
          priority: 2,
          requireInteraction: true,
        });
        console.log('[MiniMax Background] 系统预警通知已发送');
      } catch (err) {
        console.error('[MiniMax Background] 发送系统预警通知失败:', err);
      }
    } else if (item.type === 'error') {
      try {
        await chrome.notifications.create({
          type: 'basic',
          title: item.title,
          message: item.content,
          priority: 2,
        });
        console.log('[MiniMax Background] 系统错误通知已发送');
      } catch (err) {
        console.error('[MiniMax Background] 发送系统错误通知失败:', err);
      }
    }

    // 发送企业微信通知
    const wechatSuccess = await sendWeChatWorkNotification(item.title, item.content);

    // 标记为已发送
    item.sent = true;
    item.sentAt = Date.now();
    sentCount++;

    // 保存更新后的队列
    await saveNotificationQueue(queue);
  }

  // 清理已发送的旧通知（保留最近 10 条）
  if (queue.length > 10) {
    const sorted = [...queue].sort((a, b) => b.sentAt! - a.sentAt!);
    const cleaned = sorted.slice(0, 10);
    await saveNotificationQueue(cleaned);
    console.log('[MiniMax Background] 清理旧通知，保留最近 10 条');
  }

  return sentCount;
}

/**
 * 清理过期的已发送通知（保留 24 小时）
 */
async function cleanupOldNotifications(): Promise<void> {
  const queue = await getNotificationQueue();
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 小时

  const filtered = queue.filter(item => {
    // 保留未发送的
    if (!item.sent) return true;
    // 保留 24 小时内的已发送通知
    if (item.sentAt && (now - item.sentAt) < maxAge) return true;
    return false;
  });

  if (filtered.length !== queue.length) {
    await saveNotificationQueue(filtered);
    console.log('[MiniMax Background] 清理过期通知，清理数量:', queue.length - filtered.length);
  }
}

// ==================== 定时检查任务 ====================

/**
 * 定时检查任务主函数
 * 1. 先发送队列中的待发送通知
 * 2. 然后检查使用量，如果需要预警则添加到队列
 */
async function scheduledCheck(): Promise<void> {
  console.log('[MiniMax Background] ========== 开始定时检查 ==========');

  try {
    // 步骤 1: 发送队列中的待发送通知
    console.log('[MiniMax Background] 步骤 1: 检查待发送通知');
    const sentCount = await sendQueuedNotifications();
    if (sentCount > 0) {
      console.log(`[MiniMax Background] 已发送 ${sentCount} 条待发送通知`);
    } else {
      console.log('[MiniMax Background] 没有待发送的通知');
    }

    // 步骤 2: 检查使用量
    console.log('[MiniMax Background] 步骤 2: 检查使用量');
    const result = await checkMinMaxUsage(true);

    if (result.warning && result.usage !== null) {
      console.log('[MiniMax Background] 使用量超过阈值，添加到通知队列');

      // 添加预警通知到队列
      await addToQueue({
        type: 'warning',
        title: 'MiniMax 使用量预警',
        content: `当前使用量已达到 ${result.usage.toFixed(1)}%，请注意配额使用情况！`,
        usage: result.usage,
      });

      console.log('[MiniMax Background] 预警通知已添加到队列，下次检查时发送');
    }

    // 步骤 3: 清理过期通知
    console.log('[MiniMax Background] 步骤 3: 清理过期通知');
    await cleanupOldNotifications();

    // 获取并打印队列状态
    const status = await getQueueStatus();
    console.log('[MiniMax Background] 队列状态: 待发送', status.pending, '条，已发送', status.sent, '条');

  } catch (err) {
    console.error('[MiniMax Background] 定时检查任务失败:', err);

    // 添加错误通知到队列
    await addToQueue({
      type: 'error',
      title: 'MiniMax 监控异常',
      content: `检查使用量时发生错误: ${err instanceof Error ? err.message : String(err)}`,
    });

    console.log('[MiniMax Background] 错误通知已添加到队列');
  }

  console.log('[MiniMax Background] ========== 定时检查完成 ==========');
}

// ==================== 使用量检查 ====================

/**
 * 等待 content script 注入并就绪
 * @param tabId 标签页 ID
 * @param timeoutMs 超时时间（毫秒）
 * @returns 是否成功等待到 content script 就绪
 */
async function waitForContentScript(tabId: number, timeoutMs: number = 10000): Promise<boolean> {
  console.log('[MiniMax Background] 等待 content script 就绪...');

  const startTime = Date.now();

  return new Promise((resolve) => {
    // 轮询检查 content script 是否就绪
    const checkInterval = setInterval(async () => {
      // 检查是否超时
      if (Date.now() - startTime > timeoutMs) {
        console.log('[MiniMax Background] 等待 content script 超时');
        clearInterval(checkInterval);
        resolve(false);
        return;
      }

      try {
        // 尝试发送 ping 消息检查 content script 是否就绪
        const response = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
        if (response && response.pong) {
          console.log('[MiniMax Background] content script 已就绪');
          clearInterval(checkInterval);
          resolve(true);
        }
      } catch {
        // content script 尚未就绪，继续等待
      }
    }, 500); // 每 500ms 检查一次
  });
}

/**
 * 检查 MiniMax 使用量
 * @param shouldRefreshPage 是否刷新页面后再检查（定时任务时为 true）
 * @returns 使用量检查结果
 */
async function checkMinMaxUsage(shouldRefreshPage: boolean = false): Promise<{ success: boolean; usage: number | null; warning: boolean }> {
  console.log('[MiniMax Background] 开始检查使用量...', shouldRefreshPage ? '需要刷新页面' : '');

  try {
    // 获取当前 MiniMax 标签页
    const tabs = await chrome.tabs.query({ url: '*://platform.minimaxi.com/*' });
    console.log('[MiniMax Background] 找到 MiniMax 标签页数量:', tabs.length);

    if (tabs.length === 0) {
      console.log('[MiniMax Background] 未找到 MiniMax 页面');
      return { success: false, usage: null, warning: false };
    }

    // 获取第一个 MiniMax 标签页
    const tab = tabs[0];

    // 如果需要刷新页面
    if (shouldRefreshPage && tab.id) {
      console.log('[MiniMax Background] 刷新页面以获取最新数据');

      // 刷新页面
      await chrome.tabs.reload(tab.id);

      // 等待页面加载完成并检查 content script 是否就绪
      console.log('[MiniMax Background] 等待页面加载和 content script 注入...');
      let isReady = await waitForContentScript(tab.id);

      if (!isReady) {
        console.log('[MiniMax Background] content script 未就绪，尝试手动注入...');
        // 手动注入 content script（路径必须以 / 开头，相对于扩展根目录）
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['/content-scripts/content.js'],
        });
        console.log('[MiniMax Background] 已注入 content script，等待初始化...');

        // 等待注入后的 content script 初始化
        await new Promise(resolve => setTimeout(resolve, 1000));
        isReady = await waitForContentScript(tab.id, 5000);

        if (!isReady) {
          console.log('[MiniMax Background] 手动注入后仍未就绪，尝试再次注入...');
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['/content-scripts/content.js'],
          });
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }
    }

    // 发送消息给 content script 获取使用量（带重试）
    let results = null;
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        results = await chrome.tabs.sendMessage(tab.id!, { action: 'getUsage' });
        console.log('[MiniMax Background] 获取到使用量:', results);
        break; // 成功，跳出重试循环
      } catch (err) {
        retryCount++;
        console.warn(`[MiniMax Background] 获取使用量失败（第 ${retryCount} 次）:`, err);
        if (retryCount < maxRetries) {
          // 等待后重试
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    if (!results) {
      throw new Error('多次尝试后仍无法获取使用量数据');
    }

    // 获取预警阈值
    const threshold = await new Promise<number>((resolve) => {
      chrome.storage.local.get(['warningThreshold'], (result) => {
        resolve(result.warningThreshold || 90);
      });
    });

    const shouldWarn = results.usage !== null && results.usage >= threshold;

    return {
      success: results.success,
      usage: results.usage,
      warning: shouldWarn,
    };
  } catch (err) {
    console.error('[MiniMax Background] 检查使用量失败:', err);
    throw err;
  }
}

/**
 * 设置定时任务
 * @param intervalMinutes 检查间隔（分钟）
 */
function setupAlarm(intervalMinutes: number) {
  const raw = intervalMinutes;
  intervalMinutes = Number(intervalMinutes);

  if (!Number.isFinite(intervalMinutes)) {
    console.warn('[MiniMax Background] 检查间隔不是有效数字，重置为 1 分钟:', raw);
    intervalMinutes = 1;
  }

  // 防御性检查：确保间隔大于 0
  if (!intervalMinutes || intervalMinutes <= 0) {
    console.warn('[MiniMax Background] 检查间隔无效，重置为 1 分钟:', intervalMinutes);
    intervalMinutes = 1;
  }

  chrome.alarms.create(ALARM_NAME, {
    periodInMinutes: intervalMinutes
  });
  console.log(`[MiniMax Background] 定时任务已设置，间隔: ${intervalMinutes}分钟`);
}

async function getStoredCheckIntervalMinutes(): Promise<number> {
  try {
    const result = await chrome.storage.local.get(['checkInterval']);
    const raw = result.checkInterval;
    const interval = typeof raw === 'number' ? raw : Number(raw);
    if (Number.isFinite(interval) && interval > 0) return interval;
    return 30;
  } catch (err) {
    console.warn('[MiniMax Background] 读取检查间隔失败，使用默认值 30 分钟:', err);
    return 30;
  }
}

async function getAlarmByName(name: string): Promise<chrome.alarms.Alarm | undefined> {
  return new Promise((resolve) => {
    chrome.alarms.get(name, (alarm) => resolve(alarm));
  });
}

async function ensureAlarmScheduled(reason: string): Promise<void> {
  const intervalMinutes = await getStoredCheckIntervalMinutes();
  const existing = await getAlarmByName(ALARM_NAME);

  if (!existing) {
    console.log('[MiniMax Background] 未找到已存在的定时任务，准备创建。原因:', reason, 'interval:', intervalMinutes);
    setupAlarm(intervalMinutes);
    return;
  }

  if (existing.periodInMinutes !== intervalMinutes) {
    console.log(
      '[MiniMax Background] 定时任务间隔与配置不一致，准备更新。原因:',
      reason,
      'alarm.periodInMinutes:',
      existing.periodInMinutes,
      'expected:',
      intervalMinutes,
    );
    setupAlarm(intervalMinutes);
    return;
  }

  console.log('[MiniMax Background] 定时任务已存在且配置一致。原因:', reason, 'interval:', intervalMinutes);
}

// ==================== 通知发送 ====================

/**
 * 发送错误通知（添加到队列）
 * @param error 错误信息
 */
async function sendErrorNotification(error: string): Promise<void> {
  // 添加错误通知到队列
  await addToQueue({
    type: 'error',
    title: 'MiniMax 监控异常',
    content: `检查使用量时发生错误: ${error}`,
  });
  console.log('[MiniMax Background] 错误通知已添加到队列');
}

/**
 * 发送预警通知（添加到队列）
 * @param usage 当前使用量百分比
 */
async function sendWarningNotification(usage: number): Promise<void> {
  // 添加预警通知到队列
  await addToQueue({
    type: 'warning',
    title: 'MiniMax 使用量预警',
    content: `当前使用量已达到 ${usage.toFixed(1)}%，请注意配额使用情况！`,
    usage: usage,
  });
  console.log('[MiniMax Background] 预警通知已添加到队列');
}

/**
 * 发送企业微信机器人通知
 * @param title 通知标题
 * @param content 通知内容
 * @returns 是否发送成功
 */
async function sendWeChatWorkNotification(title: string, content: string): Promise<boolean> {
  try {
    // 获取企业微信 Webhook URL
    const result = await chrome.storage.local.get(['wechatWorkWebhookUrl']);
    const webhookUrl = result.wechatWorkWebhookUrl;

    // 如果没有配置 Webhook URL，跳过发送
    if (!webhookUrl || webhookUrl.trim() === '') {
      console.log('[MiniMax Background] 未配置企业微信 Webhook URL，跳过企业微信通知');
      return false;
    }

    const maskedWebhookUrl = (() => {
      try {
        const u = new URL(webhookUrl);
        const suffix = u.pathname.length > 10 ? u.pathname.slice(-10) : u.pathname;
        return `${u.origin}/...${suffix}`;
      } catch {
        return 'invalid_url';
      }
    })();
    console.log('[MiniMax Background] 准备发送企业微信通知，Webhook:', maskedWebhookUrl);

    // 构建企业微信消息格式
    const message = {
      msgtype: 'markdown',
      markdown: {
        content: `**${title}**\n\n${content}\n\n---\n*来自 MiniMax 使用量监控扩展*`,
      },
    };

    // 发送请求，添加超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // 读取响应内容
    const responseText = await response.text();
    console.log('[MiniMax Background] 企业微信响应状态:', response.status, '响应内容:', responseText);

    if (response.ok) {
      console.log('[MiniMax Background] 企业微信通知发送成功');
      return true;
    } else {
      // 解析企业微信返回的错误信息
      let errorMsg = `HTTP ${response.status}`;
      try {
        const errorData = JSON.parse(responseText);
        errorMsg = errorData.errmsg || errorMsg;
      } catch {
        // 响应不是 JSON 格式，使用默认错误信息
      }
      console.error('[MiniMax Background] 企业微信通知发送失败:', errorMsg);
      return false;
    }
  } catch (err) {
    // 区分超时错误和其他错误
    if (err instanceof Error && err.name === 'AbortError') {
      console.error('[MiniMax Background] 企业微信通知请求超时，请检查网络连接');
    } else {
      console.error('[MiniMax Background] 发送企业微信通知时发生错误:', err);
    }
    return false;
  }
}
