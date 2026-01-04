import { createApp } from 'vue';
import App from './App.vue';
import './style.css';

/**
 * 应用入口文件
 * 创建 Vue 应用实例并挂载到 DOM
 */

console.log('[MinMax App] 应用启动');

// 创建 Vue 应用实例
const app = createApp(App);

// 挂载应用到 #app 元素
app.mount('#app');

console.log('[MinMax App] Vue 应用已挂载');
