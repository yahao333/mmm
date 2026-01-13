// Content Script - 内容脚本
// 在 MiniMax 页面上运行，用于获取使用量数据

/**
 * 查找使用量百分比
 * @returns 使用量百分比，如果未找到返回 null
 */
export function findUsagePercent(): number | null {
  // 获取页面所有文本内容
  const pageText = document.body.innerText;
  console.log('[MiniMax Content] 开始查找使用量数据...');
  console.log('[MiniMax Content] 页面文本长度:', pageText.length);

  // 方法1: 匹配百分比格式（数字后跟百分号）
  // 页面显示格式：18%、85.5% 等
  // 验证：百分比后紧跟"已使用"或"已消耗"等关键词
  const percentUsedMatch = pageText.match(/(\d+(?:\.\d+)?)\s*%\s*(?:已使用|已消耗|已用)/);
  if (percentUsedMatch) {
    const percent = parseFloat(percentUsedMatch[1]);
    if (Number.isFinite(percent) && percent >= 0 && percent <= 100) {
      console.log('[MiniMax Content] 方法1-百分比已使用格式匹配成功:', percent + '%');
      return percent;
    }
  }

  // 方法2: 匹配 "已使用 X/Y" 格式（备用）
  const usageMatch = pageText.match(/已使用\s*(\d+(?:\.\d+)?)\s*[\/｜|]\s*(\d+(?:\.\d+)?)/);
  if (usageMatch) {
    const used = parseFloat(usageMatch[1]);
    const total = parseFloat(usageMatch[2]);
    if (Number.isFinite(used) && Number.isFinite(total) && total > 0 && used >= 0 && used <= total) {
      const percent = (used / total) * 100;
      console.log('[MiniMax Content] 方法2-已使用格式匹配成功:', percent + '%', `(已使用 ${used}/${total})`);
      return percent;
    }
  }

  console.log('[MiniMax Content] 所有方法都未匹配到使用量数据');
  return null;
}

// 主入口函数
function main(): void {
  console.log('[MiniMax Content] 内容脚本已加载');

  // 监听来自 popup 的消息
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[MiniMax Content] 收到消息:', message);

    if (message.action === 'ping') {
      // ping/pong 健康检查
      sendResponse({ pong: true });
      return false;
    }

    if (message.action === 'getUsage') {
      // 获取当前页面使用量，带重试机制
      const startTime = Date.now();
      const MAX_RETRY_TIME = 3000; // 最多重试3秒
      const RETRY_INTERVAL = 500;  // 每次间隔500ms

      const tryFindUsage = async () => {
        let usage = findUsagePercent();
        
        // 如果未找到且未超时，则重试
        if (usage === null && (Date.now() - startTime < MAX_RETRY_TIME)) {
          console.log('[MiniMax Content] 未找到使用量，等待重试...');
          return new Promise<void>((resolve) => {
            setTimeout(async () => {
              resolve(await tryFindUsage());
            }, RETRY_INTERVAL);
          });
        }

        console.log('[MiniMax Content] 最终返回使用量数据:', usage);
        sendResponse({
          success: usage !== null,
          usage: usage,
        });
      };

      tryFindUsage();
      return true; // 保持消息通道开启
    }

    // 返回 true 表示异步响应
    return true;
  });
}

// 导出 main 函数供 wxt 使用
export { main };

// 定义为内容脚本
export default {
  main,
  matches: ['*://platform.minimaxi.com/*'],
};
