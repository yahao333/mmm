import { defineConfig } from 'wxt';

// Wxt 配置文件
export default defineConfig({
  // 配置 modules
  modules: [
    '@wxt-dev/module-vue',
  ],

  // 配置 manifest.json 的默认选项
  manifest: {
    name: 'MiniMax Helper',
    description: 'MiniMax 账号使用量监控工具',
    version: '1.0.0',
    author: 'minmax-helper',
    homepage_url: 'https://github.com/minmax-helper/minmax-helper',
    permissions: [
      'activeTab',
      'storage',
      'notifications',
      'scripting',
      'alarms',
    ],
    // 允许访问企业微信 API 域名
    host_permissions: [
      'https://qyapi.weixin.qq.com/*',
    ],
  },
});
