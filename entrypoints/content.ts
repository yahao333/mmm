// Content Script - 内容脚本
// 在 MinMax 页面上运行，用于获取使用量数据

/**
 * 查找使用量百分比
 * @returns 使用量百分比，如果未找到返回 null
 */
function findUsagePercent(): number | null {
  // 获取页面所有文本内容
  const pageText = document.body.innerText;
  console.log('[MinMax Content] 开始查找使用量数据...');
  console.log('[MinMax Content] 页面文本长度:', pageText.length);

  // 方法1: 匹配百分比格式（数字后跟百分号）
  // 页面显示格式：18%、85.5% 等
  // 验证：百分比后紧跟"已使用"或"已消耗"等关键词
  const percentUsedMatch = pageText.match(/(\d+(?:\.\d+)?)\s*%\s*(?:已使用|已消耗|已用)/);
  if (percentUsedMatch) {
    const percent = parseFloat(percentUsedMatch[1]);
    if (percent > 0 && percent <= 100) {
      console.log('[MinMax Content] 方法1-百分比已使用格式匹配成功:', percent + '%');
      return percent;
    }
  }

  // 方法2: 匹配 "已使用 X/Y" 格式（备用）
  const usageMatch = pageText.match(/已使用\s*(\d+(?:\.\d+)?)\s*[\/｜|]\s*(\d+(?:\.\d+)?)/);
  if (usageMatch) {
    const used = parseFloat(usageMatch[1]);
    const total = parseFloat(usageMatch[2]);
    if (total > 0 && used <= total && used > 0) {
      const percent = (used / total) * 100;
      console.log('[MinMax Content] 方法2-已使用格式匹配成功:', percent + '%', `(已使用 ${used}/${total})`);
      return percent;
    }
  }

  console.log('[MinMax Content] 所有方法都未匹配到使用量数据');
  return null;
}

// 主入口函数
function main(): void {
  console.log('[MinMax Content] 内容脚本已加载');

  // 监听来自 popup 的消息
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[MinMax Content] 收到消息:', message);

    if (message.action === 'ping') {
      // ping/pong 健康检查
      sendResponse({ pong: true });
      return false;
    }

    if (message.action === 'getUsage') {
      // 获取当前页面使用量
      const usage = findUsagePercent();
      console.log('[MinMax Content] 返回使用量数据:', usage);

      sendResponse({
        success: usage !== null,
        usage: usage,
      });
      return false;
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
