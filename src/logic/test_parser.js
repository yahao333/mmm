import { extractUsageFromText, extractResetTimeFromText } from './parser.js';

console.log('开始测试 parser.js ...');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅PASS: ${message}`);
    passed++;
  } else {
    console.error(`❌FAIL: ${message}`);
    failed++;
  }
}

function testUsage() {
  console.log('\n--- 测试使用量提取 ---');
  
  const cases = [
    { text: "当前已用 45%", expected: 45 },
    { text: "已使用: 12.5%", expected: 12.5 },
    { text: "进度 99.9%", expected: 99.9 },
    { text: "优惠 10% (干扰项)", expected: null },
    { text: "已用 45%  优惠 10%", expected: 45 }, // 应该优先提取已用
    { text: "random text 50% random", expected: null }, // 孤立百分比应该被忽略或优先级低
    { text: "使用量: 5% (低使用量)", expected: 5 },
  ];

  cases.forEach((c, i) => {
    const result = extractUsageFromText(c.text);
    assert(result === c.expected, `Case ${i+1}: "${c.text}" -> Expected ${c.expected}, Got ${result}`);
  });
}

function testResetTime() {
  console.log('\n--- 测试剩余时间提取 ---');

  const cases = [
    { text: "1 小时 26 分钟后重置", expected: "1 小时 26 分钟后" },
    { text: "2 天 3 小时后重置", expected: "2 天 3 小时后" },
    { text: "30 分钟后重置", expected: "30 分钟后" },
    { text: "1小时26分钟后重置", expected: "1 小时 26 分钟后" },
    { text: "无相关信息", expected: null },
  ];

  cases.forEach((c, i) => {
    const result = extractResetTimeFromText(c.text);
    assert(result === c.expected, `Case ${i+1}: "${c.text}" -> Expected "${c.expected}", Got "${result}"`);
  });
}

testUsage();
testResetTime();

console.log(`\n测试完成: ${passed} 通过, ${failed} 失败`);

if (failed > 0) process.exit(1);
