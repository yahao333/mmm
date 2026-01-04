use std::sync::Arc;
use tokio::sync::Mutex;
use tauri;
use tauri::Manager;
use tauri::Emitter;
use tokio::fs;
use log::{info, warn, error};

const MINMAX_USAGE_URL: &str = "https://platform.minimaxi.com/user-center/payment/coding-plan";
const MINMAX_WINDOW_LABEL: &str = "minmax";

const MINMAX_INIT_SCRIPT: &str = r#"
(function () {
  const TAG = '[MinMax Inject]';
  let lastSentPercent = null;
  let collectCount = 0;

  function isValidPercent(p) {
    return typeof p === 'number' && Number.isFinite(p) && p > 0 && p <= 100;
  }

  function extractUsageFromText(text) {
    if (!text) return null;

    // 策略：扫描所有 "XX%" 格式，选择最大的那个值
    // MinMax 使用量通常接近 100%，所以选择最大值最合理
    const matches = text.matchAll(/(\d+(?:\.\d+)?)\s*%/g);
    let maxPercent = 0;
    let maxContext = '';

    for (const m of matches) {
      const p = parseFloat(m[1]);
      if (!isValidPercent(p)) continue;

      // 获取上下文
      const idx = m.index;
      const start = Math.max(0, idx - 15);
      const end = Math.min(text.length, idx + m[0].length + 15);
      const context = text.substring(start, end).replace(/\s+/g, ' ').trim();

      if (p > maxPercent) {
        maxPercent = p;
        maxContext = context;
      }
    }

    if (maxPercent > 0) {
      console.log(TAG, '选择最大值:', maxPercent + '%', '上下文:', maxContext);
      return maxPercent;
    }

    return null;
  }

  function getTauriEventEmitter() {
    // 尝试多种方式获取 Tauri 事件发射器
    if (typeof window !== 'undefined' && window.__TAURI__) {
      // 方式 1: window.__TAURI__.event (Tauri 2.x 标准方式)
      if (window.__TAURI__.event && typeof window.__TAURI__.event.emit === 'function') {
        return window.__TAURI__.event;
      }
    }
    // 方式 2: Tauri 内部 API
    if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__) {
      if (typeof window.__TAURI_INTERNALS__.emit === 'function') {
        return { emit: window.__TAURI_INTERNALS__.emit };
      }
    }
    return null;
  }

  function emitUsage(percent) {
    const eventEmitter = getTauriEventEmitter();
    if (!eventEmitter) {
      console.warn(TAG, 'Tauri event API 不可用，尝试延迟发送');
      // 延迟尝试发送
      setTimeout(() => {
        const emitter = getTauriEventEmitter();
        if (emitter) {
          emitter.emit('minmax-usage', { percent: percent });
          console.log(TAG, '延迟上报使用量:', percent + '%');
        } else {
          console.warn(TAG, '延迟发送仍失败，Tauri API 不可用');
        }
      }, 1000);
      return false;
    }

    try {
      eventEmitter.emit('minmax-usage', { percent: percent });
      console.log(TAG, '上报使用量:', percent + '%');
      return true;
    } catch (e) {
      console.error(TAG, '上报失败:', e);
      return false;
    }
  }

  function tryCollect() {
    if (!document || !document.body) return;
    collectCount++;

    const text = document.body.innerText || '';
    const percent = extractUsageFromText(text);

    if (!percent) {
      // 调试：打印页面内容片段
      if (collectCount <= 3) {
        console.log(TAG, '检测 #' + collectCount + ': 未找到使用量数据，页面文本片段:', text.substring(0, 200));
      }
      return;
    }

    const rounded = Math.round(percent * 10) / 10;

    // 值变化超过 1% 或前 3 次才打印日志
    if (lastSentPercent === null || Math.abs(rounded - lastSentPercent) >= 1 || collectCount <= 3) {
      console.log(TAG, '检测 #' + collectCount + ':', rounded + '%', '(上次:', lastSentPercent + ')');
    }

    // 跳过无明显变化的值
    if (lastSentPercent !== null && Math.abs(rounded - lastSentPercent) < 0.5) return;

    if (emitUsage(rounded)) {
      lastSentPercent = rounded;
    }
  }

  function setup() {
    console.log(TAG, '初始化');
    tryCollect();

    // 监听 DOM 变化
    const observer = new MutationObserver(function () {
      setTimeout(tryCollect, 300);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // 定时检查
    setInterval(tryCollect, 3000);

    // 窗口聚焦时检查
    window.addEventListener('focus', tryCollect);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }
})();
"#;

/// 应用配置数据结构
/// 用于存储用户的设置选项
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct AppConfig {
  /// 预警阈值（百分比）
  #[serde(rename = "warningThreshold")]
  pub warning_threshold: f64,
  /// 检查间隔（分钟）
  #[serde(rename = "checkInterval")]
  pub check_interval: i32,
  /// 企业微信 Webhook URL
  #[serde(rename = "wechatWorkWebhookUrl")]
  pub wechat_work_webhook_url: String,
  /// 语言设置
  #[serde(rename = "language")]
  pub language: String,
}

impl Default for AppConfig {
  fn default() -> Self {
    Self {
      warning_threshold: 90.0,
      check_interval: 30,
      wechat_work_webhook_url: String::new(),
      language: "zh".to_string(),
    }
  }
}

/// 获取配置文件路径
/// 返回应用数据目录下的 config.json 路径
fn get_config_path() -> std::path::PathBuf {
  // 使用标准方式获取应用数据目录
  // Tauri 2.x 简化处理：使用 HOME 目录下的隐藏文件夹
  let home_dir = std::env::var("HOME")
    .or_else(|_| std::env::var("USERPROFILE"))
    .expect("无法获取用户主目录");

  let app_data_dir = std::path::PathBuf::from(home_dir)
    .join(".minmax-helper");

  // 确保目录存在
  std::fs::create_dir_all(&app_data_dir).expect("无法创建应用数据目录");

  app_data_dir.join("config.json")
}

/// 加载应用配置
/// 从 JSON 文件中读取配置，如果文件不存在则返回默认配置
#[tauri::command]
async fn get_settings() -> Result<AppConfig, String> {
  let config_path = get_config_path();
  info!("加载配置，路径: {:?}", config_path);

  // 尝试读取配置文件
  match fs::read_to_string(&config_path).await {
    Ok(content) => {
      // 解析 JSON 配置
      let config: AppConfig = serde_json::from_str(&content)
        .map_err(|e| format!("配置解析失败: {}", e))?;
      info!("配置加载成功: {:?}", config);
      Ok(config)
    }
    Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
      // 文件不存在，返回默认配置
      info!("配置文件不存在，使用默认配置");
      Ok(AppConfig::default())
    }
    Err(e) => {
      // 其他读取错误，返回错误信息
      let error_msg = format!("读取配置文件失败: {}", e);
      error!("{}", error_msg);
      Err(error_msg)
    }
  }
}

/// 保存应用配置
/// 将配置保存到 JSON 文件
#[tauri::command]
async fn save_settings(settings: AppConfig) -> Result<(), String> {
  let config_path = get_config_path();
  info!("保存配置，路径: {:?}, 内容: {:?}", config_path, settings);

  // 序列化配置为 JSON
  let content = serde_json::to_string_pretty(&settings)
    .map_err(|e| format!("配置序列化失败: {}", e))?;

  // 写入文件
  fs::write(&config_path, content)
    .await
    .map_err(|e| format!("配置写入失败: {}", e))?;

  info!("配置保存成功");

  // 验证：立即读取并返回配置内容用于调试
  match fs::read_to_string(&config_path).await {
    Ok(content) => {
      info!("配置文件内容: {}", content);
    }
    Err(e) => {
      error!("验证读取配置文件失败: {}", e);
    }
  }

  Ok(())
}

/// 调试：获取配置文件路径
#[tauri::command]
async fn get_config_path_debug() -> Result<String, String> {
  let path = get_config_path();
  let content = match fs::read_to_string(&path).await {
    Ok(c) => c,
    Err(e) => format!("读取失败: {}", e),
  };
  Ok(format!("路径: {:?}\n内容: {}", path, content))
}

/// 发送系统通知
/// 根据不同平台使用系统命令发送通知
async fn send_system_notification(
  title: &str,
  body: &str,
) -> Result<(), String> {
  info!("发送系统通知: {} - {}", title, body);

  // 根据不同平台发送系统通知
  let result = if cfg!(target_os = "windows") {
    // Windows: 使用 PowerShell 发送 Toast 通知
    // 注意: Windows 通知需要应用先注册，这里使用简单的消息框作为后备
    let script = format!(r#"
      Add-Type -AssemblyName System.Windows.Forms
      [System.Windows.Forms.MessageBox]::Show("{}", "{}", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information)
    "#, body.replace('"', "\\\""), title);
    tokio::process::Command::new("powershell")
      .args(&["-Command", &script])
      .spawn()
  } else if cfg!(target_os = "macos") {
    // macOS: 使用 osascript 发送通知
    tokio::process::Command::new("osascript")
      .args(&[
        "-e",
        &format!("display notification \"{}\" with title \"{}\"", body, title),
      ])
      .spawn()
  } else {
    // Linux: 使用 notify-send 命令
    tokio::process::Command::new("notify-send")
      .args(&[title, body])
      .spawn()
  };

  match result {
    Ok(mut child) => {
      let _ = child.wait().await;
      info!("系统通知已发送: {}", title);
      Ok(())
    }
    Err(e) => {
      // 如果系统通知失败，回退到日志记录
      warn!("发送系统通知失败: {}，回退到日志记录", e);
      info!("[通知] {} - {}", title, body);
      Ok(())
    }
  }
}

/// 发送企业微信通知
/// 通过 Webhook 发送通知到企业微信
async fn send_wechat_work_notification(
  webhook_url: &str,
  title: &str,
  body: &str,
) -> Result<bool, String> {
  // 如果没有配置 Webhook URL，跳过发送
  if webhook_url.trim().is_empty() {
    info!("企业微信 Webhook URL 未配置，跳过发送");
    return Ok(false);
  }

  info!("准备发送企业微信通知");

  // 构建企业微信消息格式（Markdown 格式）
  let message = serde_json::json!({
    "msgtype": "markdown",
    "markdown": {
      "content": format!("**{}\n\n{}\n\n---\n*来自 MinMax 使用量监控*", title, body)
    }
  });

  // 发送 HTTP 请求
  let client = reqwest::Client::new();
  let response = client
    .post(webhook_url)
    .json(&message)
    .send()
    .await
    .map_err(|e| format!("企业微信请求失败: {}", e))?;

  let status = response.status();
  let response_text = response.text().await.unwrap_or_default();

  info!("企业微信响应状态: {}, 内容: {}", status, response_text);

  if status.is_success() {
    info!("企业微信通知发送成功");
    Ok(true)
  } else {
    // 解析企业微信返回的错误信息
    let error_msg = if response_text.contains("errmsg") {
      serde_json::from_str::<serde_json::Value>(&response_text)
        .ok()
        .and_then(|v| v.get("errmsg").map(|e| e.to_string()))
        .unwrap_or_else(|| format!("HTTP {}", status.as_u16()))
    } else {
      format!("HTTP {}", status.as_u16())
    };
    warn!("企业微信通知发送失败: {}", error_msg);
    Err(error_msg)
  }
}

/// 发送预警通知
/// 当使用量超过阈值时发送预警通知（系统通知 + 企业微信）
#[tauri::command]
async fn send_warning_notification(
  usage: f64,
  threshold: f64,
) -> Result<(), String> {
  info!("发送预警通知，使用量: {}%, 阈值: {}%", usage, threshold);

  let title = "MinMax 使用量预警";
  let body = format!("当前使用量已达到 {:.1}%，请注意配额使用情况！", usage);

  // 发送系统通知
  let _ = send_system_notification(title, &body).await;

  // 获取配置，发送企业微信通知
  let config = get_settings().await?;
  let _ = send_wechat_work_notification(
    &config.wechat_work_webhook_url,
    title,
    &body,
  ).await;

  Ok(())
}

/// 测试系统通知
/// 发送一个测试通知来验证通知功能是否正常
#[tauri::command]
async fn test_notification() -> Result<(), String> {
  info!("发送测试通知");

  // 发送系统通知
  let _ = send_system_notification("MinMax Helper", "测试通知发送成功！").await;

  Ok(())
}

/// 发送错误通知
/// 当检查使用量发生错误时发送通知
#[tauri::command]
async fn send_error_notification(
  error: String,
  config: AppConfig,
) -> Result<(), String> {
  error!("发送错误通知: {}", error);

  let title = "MinMax 监控异常";
  let body = format!("检查使用量时发生错误: {}", error);

  // 发送系统通知
  let _ = send_system_notification(title, &body).await;

  // 发送企业微信通知
  let _ = send_wechat_work_notification(
    &config.wechat_work_webhook_url,
    title,
    &body,
  ).await;

  Ok(())
}

/// 打开 URL
/// 使用系统默认浏览器打开指定 URL
#[tauri::command]
async fn open_url(url: String) -> Result<(), String> {
  info!("打开 URL: {}", url);

  // 根据不同平台使用系统命令打开浏览器
  let result = if cfg!(target_os = "windows") {
    // Windows: 使用 start 命令
    tokio::process::Command::new("cmd")
      .args(&["/c", "start", &url])
      .spawn()
  } else if cfg!(target_os = "macos") {
    // macOS: 使用 open 命令
    tokio::process::Command::new("open")
      .arg(&url)
      .spawn()
  } else {
    // Linux: 使用 xdg-open 命令
    tokio::process::Command::new("xdg-open")
      .arg(&url)
      .spawn()
  };

  match result {
    Ok(mut child) => {
      // 等待进程启动
      let _ = child.wait().await;
      info!("已打开 URL: {}", url);
      Ok(())
    }
    Err(e) => {
      let error_msg = format!("打开 URL 失败: {}", e);
      error!("{}", error_msg);
      Err(error_msg)
    }
  }
}

#[tauri::command]
async fn open_minmax_window(app: tauri::AppHandle) -> Result<(), String> {
  info!("打开 MinMax 窗口");

  if let Some(existing) = app.get_webview_window(MINMAX_WINDOW_LABEL) {
    info!("MinMax 窗口已存在，尝试显示并聚焦");
    if let Err(e) = existing.show() {
      warn!("显示 MinMax 窗口失败: {}", e);
    }
    if let Err(e) = existing.set_focus() {
      warn!("聚焦 MinMax 窗口失败: {}", e);
    }
    return Ok(());
  }

  let url = MINMAX_USAGE_URL
    .parse()
    .map_err(|e| format!("MinMax URL 解析失败: {}", e))?;

  info!("创建 MinMax 窗口: {}", MINMAX_USAGE_URL);

  tauri::WebviewWindowBuilder::new(&app, MINMAX_WINDOW_LABEL, tauri::WebviewUrl::External(url))
    .title("MinMax")
    .inner_size(1100.0, 800.0)
    .resizable(true)
    .center()
    .initialization_script(MINMAX_INIT_SCRIPT)
    .build()
    .map_err(|e| format!("创建 MinMax 窗口失败: {}", e))?;

  Ok(())
}

/// 读取剪贴板文本
/// 使用系统命令读取剪贴板内容
#[tauri::command]
async fn read_clipboard() -> Result<String, String> {
  info!("读取剪贴板");

  // 根据不同平台使用系统命令读取剪贴板
  let result = if cfg!(target_os = "windows") {
    // Windows: 使用 PowerShell 读取剪贴板
    tokio::process::Command::new("powershell")
      .args(&["-Command", "Get-Clipboard"])
      .output()
      .await
  } else if cfg!(target_os = "macos") {
    // macOS: 使用 pbpaste 命令
    tokio::process::Command::new("pbpaste")
      .output()
      .await
  } else {
    // Linux: 使用 xclip 或 xsel
    // 尝试 xclip
    tokio::process::Command::new("sh")
      .args(&["-c", "xclip -selection clipboard -o 2>/dev/null || xsel -ob 2>/dev/null"])
      .output()
      .await
  };

  match result {
    Ok(output) => {
      if output.status.success() {
        // 去除可能的换行符
        let text = String::from_utf8_lossy(&output.stdout)
          .trim()
          .to_string();
        info!("剪贴板内容长度: {}", text.len());
        Ok(text)
      } else {
        let error_msg = String::from_utf8_lossy(&output.stderr).to_string();
        error!("读取剪贴板失败: {}", error_msg);
        Err(format!("读取剪贴板失败: {}", error_msg))
      }
    }
    Err(e) => {
      let error_msg = format!("执行命令失败: {}", e);
      error!("{}", error_msg);
      Err(error_msg)
    }
  }
}

/// 从页面获取使用量数据
/// 创建临时的 webview 窗口加载 MinMax 页面，然后执行 JavaScript 提取使用量
#[tauri::command]
async fn fetch_usage_from_page() -> Result<serde_json::Value, String> {
  info!("从页面获取使用量数据");

  // MinMax 使用量页面 URL
  let url = "https://platform.minimaxi.com/user-center/payment/coding-plan";
  info!("目标 URL: {}", url);

  // 由于 Tauri 2.x 的限制，无法直接从 Rust 端创建 webview 并执行脚本
  // 这里返回错误，提示使用外部浏览器方式
  // 实际的数据获取应该由前端通过 webview.executeScript 实现

  info!("无法直接创建 webview，请使用前端 JS 注入方式获取数据");

  Err("需要通过前端 JavaScript 注入获取页面数据".to_string())
}

/// 获取使用量数据
/// 注意：此命令已废弃，实际使用量获取由前端通过 WebView 注入 JavaScript 实现
/// 保留此命令以保持 API 兼容，返回错误提示
#[tauri::command]
async fn get_usage() -> Result<f64, String> {
  error!("[定时任务] get_usage 被调用 - 此函数已废弃，返回模拟数据");

  // 使用模拟数据（实际由前端通过 JS 注入获取）
  let usage = rand::random::<f64>() % 100.0;
  warn!("[定时任务] 使用量数据（模拟）: {:.1}%", usage);

  Ok(usage)
}

/// 内部函数：触发前端获取使用量（供定时任务直接调用）
/// 这个函数是普通异步函数，不是 tauri command
async fn do_trigger_fetch_usage(app: &tauri::AppHandle) {
  info!("[do_trigger_fetch_usage] 开始执行");

  // 检查 MinMax 窗口是否存在
  let window = app.get_webview_window(MINMAX_WINDOW_LABEL);

  if let Some(win) = window {
    info!("[do_trigger_fetch_usage] MinMax 窗口已存在");

    // 在后台执行窗口操作
    let win_clone = win.clone();
    tokio::spawn(async move {
      let _ = win_clone.show();
      let _ = win_clone.set_focus();
    });

    // 发送事件
    let emit_result = win.emit("trigger-fetch-usage", {});
    info!("[do_trigger_fetch_usage] 事件发送结果: {:?}", emit_result);
  } else {
    info!("[do_trigger_fetch_usage] MinMax 窗口不存在，创建新窗口");

    // 在后台创建窗口
    let app_clone = app.clone();
    tokio::spawn(async move {
      let url = MINMAX_USAGE_URL
        .parse()
        .expect("MinMax URL 解析失败");

      match tauri::WebviewWindowBuilder::new(&app_clone, MINMAX_WINDOW_LABEL, tauri::WebviewUrl::External(url))
        .title("MinMax")
        .inner_size(1100.0, 800.0)
        .resizable(true)
        .center()
        .initialization_script(MINMAX_INIT_SCRIPT)
        .build()
      {
        Ok(_) => info!("[do_trigger_fetch_usage] MinMax 窗口创建成功"),
        Err(e) => error!("[do_trigger_fetch_usage] MinMax 窗口创建失败: {}", e),
      }
    });
  }

  info!("[do_trigger_fetch_usage] 执行完成");
}

/// 触发前端获取使用量
/// Rust 后端定时任务调用此命令，通知前端打开 MinMax 页面并获取使用量
#[tauri::command]
async fn trigger_fetch_usage(app: tauri::AppHandle) -> Result<(), String> {
  do_trigger_fetch_usage(&app).await;
  Ok(())
}

/// 定时检查使用量
/// 内部函数，由定时器调用
async fn scheduled_check(app: &tauri::AppHandle, app_state: &Arc<AppState>) {
  info!("[scheduled_check] 开始定时检查");

  // 获取当前配置
  let config = {
    let state = app_state.config.lock().await;
    state.clone()
  };

  info!("[scheduled_check] 配置: 阈值={:.1}%, 间隔={}分钟", config.warning_threshold, config.check_interval);

  // 调用内部函数触发前端获取使用量
  do_trigger_fetch_usage(app).await;

  info!("[scheduled_check] 检查完成");
}

/// 应用状态
struct AppState {
  /// 当前配置
  config: Mutex<AppConfig>,
  /// 定时器是否运行中
  timer_running: Mutex<bool>,
}

impl AppState {
  /// 创建新的应用状态
  fn new() -> Self {
    Self {
      config: Mutex::new(AppConfig::default()),
      timer_running: Mutex::new(false),
    }
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  // 创建应用状态
  let app_state = Arc::new(AppState::new());

  tauri::Builder::default()
    .plugin(tauri_plugin_log::Builder::default().build())
    // 注册 Tauri 命令
    .invoke_handler(tauri::generate_handler![
      get_settings,
      save_settings,
      get_config_path_debug,
      test_notification,
      send_warning_notification,
      send_error_notification,
      open_url,
      open_minmax_window,
      read_clipboard,
      fetch_usage_from_page,
      get_usage,
      trigger_fetch_usage,
    ])
    .manage(app_state.clone())
    .setup(move |app| {
      // 使用 Tauri 提供的 Tokio runtime 启动异步任务
      let app_handle = app.handle().clone();
      let app_state_clone = app_state.clone();
      tauri::async_runtime::spawn(async move {
        if let Ok(config) = get_settings().await {
          // 更新应用状态
          {
            let mut state = app_state_clone.config.lock().await;
            *state = config;
          } // state 在这里被释放

          // 启动定时器
          start_timer(app_handle, app_state_clone).await;
        }
      });

      info!("应用初始化完成");
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

/// 启动定时器
/// 根据配置启动定时检查任务
async fn start_timer(app: tauri::AppHandle, app_state: Arc<AppState>) {
  let mut running = app_state.timer_running.lock().await;

  if *running {
    info!("[定时任务] 定时器已在运行中，跳过启动");
    return;
  }

  info!("[定时任务] 正在启动定时器...");

  // 获取当前配置
  let config = {
    let state = app_state.config.lock().await;
    state.clone()
  };

  let interval_minutes = config.check_interval;
  let interval_secs = (interval_minutes as u64) * 60;

  info!("[定时任务] 启动定时器，检查间隔: {} 分钟 ({} 秒)", interval_minutes, interval_secs);

  *running = true;

  // 使用 Tauri 的 async runtime 启动定时任务
  let app_state_clone = app_state.clone();
  let app_clone = app.clone();
  tauri::async_runtime::spawn(async move {
    info!("[定时任务] Tauri async 任务已启动，间隔 {} 秒", interval_secs);

    let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(interval_secs));

    // 首次执行
    info!("[定时任务] 执行首次检查...");
    scheduled_check(&app, &app_state_clone).await;
    info!("[定时任务] 首次检查完成");

    let mut tick_count = 0;
    loop {
      tick_count += 1;

      // 检查定时器是否停止
      {
        let running = app_state_clone.timer_running.lock().await;
        if !*running {
          info!("[定时任务] 定时器已停止");
          break;
        }
      }

      info!("[定时任务] 等待第 {} 个 tick...", tick_count);

      interval.tick().await;

      info!("[定时任务] 第 {} 个 tick 到达，执行检查", tick_count);

      // 执行检查
      scheduled_check(&app_clone, &app_state_clone).await;
      info!("[定时任务] 第 {} 个检查完成", tick_count);
    }
  });

  info!("[定时任务] start_timer 函数返回");
}
