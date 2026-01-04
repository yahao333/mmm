/// <reference types="vite/client" />

// Vite 客户端类型声明
// 提供 Vite 导入的类型支持

/**
 * Vite 导入的 SVG 文件声明
 * 允许导入 .svg 文件作为模块
 */
declare module '*.svg' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

/**
 * Vite 导入的 CSS 文件声明
 */
declare module '*.css' {
  const content: string;
  export default content;
}

/**
 * Vite 导入的 JSON 文件声明
 */
declare module '*.json' {
  const content: any;
  export default content;
}
