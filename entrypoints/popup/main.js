import { createApp } from 'vue';
import Popup from './Popup.vue';

// 创建 Vue 应用并挂载
console.log('[MinMax Popup] 初始化 Vue 应用');
const app = createApp(Popup);
app.mount('#app');
console.log('[MinMax Popup] Vue 应用已挂载');
