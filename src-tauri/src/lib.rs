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
async fn paste_at_cursor(app: tauri::AppHandle) -> Result<(), String> {
    // The focus juggling and sleeps below MUST run off the main thread. Sync
    // Tauri commands execute on the event loop; blocking it freezes the UI and
    // defers our own minimize() dispatch until after the command returns, so
    // whenever a Warid window held the foreground the old code saw "Warid still
    // in front" and silently skipped the paste.
    match tauri::async_runtime::spawn_blocking(move || paste_at_cursor_impl(app)).await {
        Ok(result) => result,
        Err(e) => Err(format!("paste task failed: {e}")),
    }
}

fn paste_at_cursor_impl(app: tauri::AppHandle) -> Result<(), String> {
    use std::thread::sleep;
    use std::time::Duration;

    #[cfg(target_os = "windows")]
    {
        use std::time::Instant;
        use windows::Win32::Foundation::HWND;
        use windows::Win32::System::Threading::{AttachThreadInput, GetCurrentThreadId};
        use windows::Win32::UI::Input::KeyboardAndMouse::{
            GetAsyncKeyState, MapVirtualKeyW, SendInput, SetFocus, INPUT, INPUT_0,
            INPUT_KEYBOARD, KEYBDINPUT, KEYBD_EVENT_FLAGS, KEYEVENTF_KEYUP, MAPVK_VK_TO_VSC,
            VIRTUAL_KEY, VK_CONTROL, VK_LWIN, VK_MENU, VK_RWIN, VK_SHIFT, VK_V,
        };
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
            return Err("no target window to paste into".to_string());
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
        let force_focus = |target: HWND| unsafe {
            let mut _pid: u32 = 0;
            let target_tid = GetWindowThreadProcessId(target, Some(&mut _pid));
            let current_tid = GetCurrentThreadId();
            if target_tid != 0 && target_tid != current_tid {
                let _ = AttachThreadInput(current_tid, target_tid, true);
                let _ = SetForegroundWindow(target);
                let _ = SetFocus(Some(target));
                let _ = AttachThreadInput(current_tid, target_tid, false);
            } else {
                let _ = SetForegroundWindow(target);
            }
        };
        force_focus(target_hwnd);

        // Step 5: Poll until a non-Warid window actually holds the foreground,
        // re-forcing focus while we wait. Focus transitions on a busy system
        // routinely take longer than a fixed 80ms sleep, and a single
        // SetForegroundWindow can be dropped while our minimize is in flight.
        let focus_deadline = Instant::now() + Duration::from_millis(600);
        loop {
            let fg = unsafe { GetForegroundWindow() };
            if !fg.0.is_null() && !is_warid(fg) {
                break;
            }
            if Instant::now() >= focus_deadline {
                return Err("target window never took the foreground".to_string());
            }
            sleep(Duration::from_millis(40));
            force_focus(target_hwnd);
        }

        // Builds a keyboard INPUT with both the virtual-key code and its scan
        // code. VK codes (not Unicode characters) are what apps match Ctrl+V
        // accelerators against, and they are independent of the active keyboard
        // layout — Arabic layout included.
        fn key_event(vk: VIRTUAL_KEY, up: bool) -> INPUT {
            let scan = unsafe { MapVirtualKeyW(vk.0 as u32, MAPVK_VK_TO_VSC) } as u16;
            INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: vk,
                        wScan: scan,
                        dwFlags: if up { KEYEVENTF_KEYUP } else { KEYBD_EVENT_FLAGS(0) },
                        time: 0,
                        dwExtraInfo: 0,
                    },
                },
            }
        }
        let is_down =
            |vk: VIRTUAL_KEY| (unsafe { GetAsyncKeyState(vk.0 as i32) } as u16 & 0x8000) != 0;

        // Step 6: The stop-recording hotkey means the user may still be holding
        // modifier keys; held Shift/Alt/Win would turn our Ctrl+V into a
        // different chord. Wait for them to be released, then force-release
        // anything still held.
        const MODIFIERS: [VIRTUAL_KEY; 5] = [VK_CONTROL, VK_SHIFT, VK_MENU, VK_LWIN, VK_RWIN];
        let mod_deadline = Instant::now() + Duration::from_millis(1000);
        while MODIFIERS.iter().any(|&vk| is_down(vk)) && Instant::now() < mod_deadline {
            sleep(Duration::from_millis(20));
        }
        let stuck: Vec<INPUT> = MODIFIERS
            .iter()
            .filter(|&&vk| is_down(vk))
            .map(|&vk| key_event(vk, true))
            .collect();
        if !stuck.is_empty() {
            unsafe { SendInput(&stuck, std::mem::size_of::<INPUT>() as i32) };
            sleep(Duration::from_millis(20));
        }

        // Step 7: Send Ctrl+V as one atomic SendInput batch so no real user
        // input can interleave between the down/up events.
        let combo = [
            key_event(VK_CONTROL, false),
            key_event(VK_V, false),
            key_event(VK_V, true),
            key_event(VK_CONTROL, true),
        ];
        let sent = unsafe { SendInput(&combo, std::mem::size_of::<INPUT>() as i32) };
        if sent != combo.len() as u32 {
            return Err(format!(
                "SendInput injected only {} of {} events (input blocked?)",
                sent,
                combo.len()
            ));
        }
        return Ok(());
    }

    // Non-Windows fallback (original behaviour).
    #[cfg(not(target_os = "windows"))]
    {
        use enigo::{Direction, Enigo, Key, Keyboard, Settings};

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
        return Ok(());
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
