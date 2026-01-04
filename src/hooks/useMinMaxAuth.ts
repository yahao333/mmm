import { ref } from 'vue';

/**
 * 登录状态管理 Hook
 * 管理 MinMax 平台的登录状态持久化
 */

// 登录状态存储 key
const LOGIN_STATUS_KEY = 'minmax_logged_in';

/**
 * 检查是否已登录
 */
export function checkIsLoggedIn(): boolean {
  return localStorage.getItem(LOGIN_STATUS_KEY) === 'true';
}

/**
 * 设置登录状态
 */
export function setLoggedIn(): void {
  localStorage.setItem(LOGIN_STATUS_KEY, 'true');
  console.log('[useMinMaxAuth] 已设置登录状态');
}

/**
 * 清除登录状态（用于退出登录）
 */
export function clearLoginStatus(): void {
  localStorage.removeItem(LOGIN_STATUS_KEY);
  console.log('[useMinMaxAuth] 已清除登录状态');
}

/**
 * 使用登录状态管理
 * @returns 登录状态相关方法和状态
 */
export function useMinMaxAuth() {
  // 响应式登录状态
  const isLoggedIn = ref(checkIsLoggedIn());

  /**
   * 登录成功处理
   * 设置登录状态并更新响应式变量
   */
  function login(): void {
    setLoggedIn();
    isLoggedIn.value = true;
    console.log('[useMinMaxAuth] 登录成功');
  }

  /**
   * 退出登录处理
   * 清除登录状态并更新响应式变量
   */
  function logout(): void {
    clearLoginStatus();
    isLoggedIn.value = false;
    console.log('[useMinMaxAuth] 已退出登录');
  }

  return {
    // 响应式状态
    isLoggedIn,
    // 方法
    login,
    logout,
  };
}
