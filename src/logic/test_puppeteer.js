import puppeteer from 'puppeteer';
import { extractUsageFromText, extractResetTimeFromText } from './parser.js';

async function runTest() {
  console.log('启动 Puppeteer 测试...');
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // 模拟 MiniMax 使用量页面
    // 由于我们无法直接登录真实的 MiniMax 页面，我们创建一个包含模拟数据的 HTML 页面
    // 或者直接设置页面内容
    console.log('设置模拟页面内容...');
    
    const mockHtml = `
      <!DOCTYPE html>
      <html>
        <body>
          <div class="container">
            <h1>我的配额</h1>
            <div class="usage-card">
              <span class="label">本月已使用:</span>
              <span class="value">45.5%</span>
            </div>
            <div class="reset-info">
              <p>您的配额将在 2 天 3 小时后重置</p>
            </div>
          </div>
        </body>
      </html>
    `;
    
    await page.setContent(mockHtml);
    
    // 获取页面文本
    const bodyText = await page.evaluate(() => document.body.innerText);
    console.log('页面文本:', bodyText);
    
    // 验证解析逻辑
    console.log('验证解析逻辑...');
    
    const usage = extractUsageFromText(bodyText);
    const resetTime = extractResetTimeFromText(bodyText);
    
    console.log(`解析结果: 使用量=${usage}%, 剩余时间=${resetTime}`);
    
    let passed = true;
    
    if (usage === 45.5) {
      console.log('✅ 使用量提取正确');
    } else {
      console.error(`❌ 使用量提取错误: 期望 45.5, 实际 ${usage}`);
      passed = false;
    }
    
    if (resetTime === '2 天 3 小时后') {
      console.log('✅ 剩余时间提取正确');
    } else {
      console.error(`❌ 剩余时间提取错误: 期望 "2 天 3 小时后", 实际 "${resetTime}"`);
      passed = false;
    }
    
    // 验证注入脚本的兼容性
    console.log('验证注入脚本逻辑...');
    const result = await page.evaluate(() => {
        // 模拟 lib.rs 中的注入逻辑
        const text = document.body.innerText;
        // 简单的正则匹配（模拟 fallback 逻辑）
        const matches = text.matchAll(/(\d+(?:\.\d+)?)\s*%/g);
        let maxPercent = 0;
        for (const m of matches) {
            const p = parseFloat(m[1]);
            if (p > 0 && p <= 100 && p > maxPercent) {
                maxPercent = p;
            }
        }
        return maxPercent;
    });
    
    if (result === 45.5) {
        console.log('✅ 注入脚本 Fallback 逻辑验证通过');
    } else {
        console.error(`❌ 注入脚本 Fallback 逻辑验证失败: 期望 45.5, 实际 ${result}`);
        passed = false;
    }

    if (passed) {
        console.log('🎉 所有测试通过');
        process.exit(0);
    } else {
        console.error('💥 测试失败');
        process.exit(1);
    }
    
  } catch (error) {
    console.error('测试过程中发生错误:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runTest();
