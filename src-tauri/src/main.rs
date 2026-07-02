// SPDX-License-Identifier: AGPL-3.0-or-later

// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    warid_lib::run()
}
