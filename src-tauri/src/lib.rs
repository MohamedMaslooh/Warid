use std::sync::Mutex;
use tauri::{
    menu::{MenuBuilder, MenuItem, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent},
    Manager,
};

struct TrayHandles {
    tray: TrayIcon,
    show_item: MenuItem<tauri::Wry>,
    quit_item: MenuItem<tauri::Wry>,
}

struct TrayState(Mutex<Option<TrayHandles>>);

#[tauri::command]
fn greet(name: &str) -> String {
    format!("مرحباً، {}! من وارِد.", name)
}

#[tauri::command]
fn save_pdf(file_name: String, pdf_bytes: Vec<u8>) -> Result<String, String> {
    let default_name = if file_name.ends_with(".pdf") {
        file_name.clone()
    } else {
        format!("{}.pdf", file_name)
    };

    let chosen = rfd::FileDialog::new()
        .set_title("Save PDF")
        .set_file_name(&default_name)
        .add_filter("PDF Document", &["pdf"])
        .save_file();

    match chosen {
        Some(path) => {
            std::fs::write(&path, &pdf_bytes)
                .map_err(|e| format!("Failed to write file: {}", e))?;
            Ok(path.to_string_lossy().into_owned())
        }
        None => Err("cancelled".to_string()),
    }
}

#[tauri::command]
fn update_tray_language(app: tauri::AppHandle, lang: String) {
    let (show_label, quit_label, tooltip) = if lang == "ar" {
        ("إظهار وارِد", "إغلاق", "وارِد")
    } else {
        ("Show Warid", "Quit", "Warid")
    };
    let state = app.state::<TrayState>();
    let guard = state.0.lock().unwrap();
    if let Some(handles) = guard.as_ref() {
        let _ = handles.show_item.set_text(show_label);
        let _ = handles.quit_item.set_text(quit_label);
        let _ = handles.tray.set_tooltip(Some(tooltip));
    }
}

#[tauri::command]
fn paste_at_cursor(app: tauri::AppHandle) {
    use enigo::{Direction, Enigo, Key, Keyboard, Settings};
    use std::thread::sleep;
    use std::time::Duration;

    #[cfg(target_os = "windows")]
    {
        use windows::Win32::Foundation::HWND;
        use windows::Win32::System::Threading::{AttachThreadInput, GetCurrentThreadId};
        use windows::Win32::UI::Input::KeyboardAndMouse::SetFocus;
        use windows::Win32::UI::WindowsAndMessaging::{
            GetForegroundWindow, GetWindow, GetWindowThreadProcessId, IsIconic,
            IsWindowVisible, SetForegroundWindow, GW_HWNDNEXT,
        };

        // Resolve every HWND that belongs to Warid (the main window AND the
        // floating overlay control bar) so we never paste back into ourselves.
        // Clicking the overlay to stop a recording makes it the foreground
        // window, so excluding only "main" would let Ctrl+V land in the overlay.
        let warid_hwnds: Vec<*mut core::ffi::c_void> = ["main", "overlay"]
            .iter()
            .filter_map(|label| app.get_webview_window(label))
            .filter_map(|w| w.hwnd().ok())
            .map(|h| h.0)
            .filter(|p| !p.is_null())
            .collect();
        let is_warid = |h: HWND| !h.0.is_null() && warid_hwnds.iter().any(|p| *p == h.0);

        // Fallback start point for the Z-order walk when nothing is foreground.
        let main_hwnd: HWND = app
            .get_webview_window("main")
            .and_then(|w| w.hwnd().ok())
            .unwrap_or(HWND(std::ptr::null_mut()));

        // Step 1: Capture the foreground window.
        let initial_foreground = unsafe { GetForegroundWindow() };
        let warid_was_foreground = is_warid(initial_foreground);

        // Step 2: Pick a target. If a Warid window is in front (or nothing is),
        // walk the Z-order for the next visible, non-minimized, non-Warid window.
        let mut target_hwnd = initial_foreground;
        if target_hwnd.0.is_null() || is_warid(target_hwnd) {
            let start = if target_hwnd.0.is_null() { main_hwnd } else { target_hwnd };
            let mut cursor = unsafe { GetWindow(start, GW_HWNDNEXT) }
                .unwrap_or(HWND(std::ptr::null_mut()));
            let mut found = HWND(std::ptr::null_mut());
            while !cursor.0.is_null() {
                let visible = unsafe { IsWindowVisible(cursor).as_bool() };
                let iconic = unsafe { IsIconic(cursor).as_bool() };
                if visible && !iconic && !is_warid(cursor) {
                    found = cursor;
                    break;
                }
                cursor = unsafe { GetWindow(cursor, GW_HWNDNEXT) }
                    .unwrap_or(HWND(std::ptr::null_mut()));
            }
            target_hwnd = found;
        }

        // If we still have no target, bail before sending keystrokes — otherwise
        // Ctrl+V lands in Warid itself or wherever the OS decides.
        if target_hwnd.0.is_null() || is_warid(target_hwnd) {
            return;
        }

        // Step 3: Only minimize Warid if it was actually the foreground.
        // Minimizing an already-hidden/background window can disrupt focus.
        if warid_was_foreground {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.minimize();
            }
            sleep(Duration::from_millis(80));
        }

        // Step 4: Force focus to the target using AttachThreadInput, which
        // bypasses Windows' SetForegroundWindow lock. Without this, after
        // Warid grabs the foreground once, the OS can silently refuse our
        // subsequent SetForegroundWindow calls.
        unsafe {
            let mut _pid: u32 = 0;
            let target_tid = GetWindowThreadProcessId(target_hwnd, Some(&mut _pid));
            let current_tid = GetCurrentThreadId();
            if target_tid != 0 && target_tid != current_tid {
                let _ = AttachThreadInput(current_tid, target_tid, true);
                let _ = SetForegroundWindow(target_hwnd);
                let _ = SetFocus(Some(target_hwnd));
                let _ = AttachThreadInput(current_tid, target_tid, false);
            } else {
                let _ = SetForegroundWindow(target_hwnd);
            }
        }
        sleep(Duration::from_millis(80));

        // Step 5: Verify the target really is in front before pressing Ctrl+V.
        let now_foreground = unsafe { GetForegroundWindow() };
        if now_foreground.0.is_null() || is_warid(now_foreground) {
            return;
        }

        // Step 6: Send Ctrl+V.
        if let Ok(mut enigo) = Enigo::new(&Settings::default()) {
            let _ = enigo.key(Key::Control, Direction::Press);
            sleep(Duration::from_millis(30));
            let _ = enigo.key(Key::Unicode('v'), Direction::Click);
            sleep(Duration::from_millis(30));
            let _ = enigo.key(Key::Control, Direction::Release);
        }
    }

    // Non-Windows fallback (original behaviour).
    #[cfg(not(target_os = "windows"))]
    {
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.minimize();
        }
        sleep(Duration::from_millis(120));
        if let Ok(mut enigo) = Enigo::new(&Settings::default()) {
            let _ = enigo.key(Key::Control, Direction::Press);
            sleep(Duration::from_millis(30));
            let _ = enigo.key(Key::Unicode('v'), Direction::Click);
            sleep(Duration::from_millis(30));
            let _ = enigo.key(Key::Control, Direction::Release);
        }
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        // Shortcuts are registered dynamically from JS (per-command), so we just
        // mount the plugin with no built-in handler.
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                if window.label() == "main" {
                    let _ = window.hide();
                    api.prevent_close();
                }
            }
            _ => {}
        })
        .manage(TrayState(Mutex::new(None)))
        .setup(|app| {
            // System tray — labels default to English; updated at runtime once the
            // JS layer reports the saved UI language via `update_tray_language`.
            let show_item = MenuItemBuilder::with_id("show", "Show Warid").build(app)?;
            let quit_item = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
            let menu = MenuBuilder::new(app)
                .item(&show_item)
                .item(&quit_item)
                .build()?;

            let tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("Warid")
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            if let Some(overlay) = app.get_webview_window("overlay") {
                let _ = overlay.set_always_on_top(true);
                // We don't know the monitor size yet easily here without a bit more code,
                // but Tauri's 'center' in tauri.conf handles the horizontal part well.
                // We'll just let it stay centered for now, or we can use the monitor API.
            }

            let state = app.state::<TrayState>();
            *state.0.lock().unwrap() = Some(TrayHandles {
                tray,
                show_item,
                quit_item,
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet, paste_at_cursor, update_tray_language, save_pdf])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
