import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './style.css';

/**
 * 应用入口
 * 使用 React 18 的新并发特性
 */
ReactDOM.createRoot(document.getElementById('app')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
