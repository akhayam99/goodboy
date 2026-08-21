// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    if let Some(code) = goodboy_desktop_lib::run_query_cli() {
        std::process::exit(code);
    }
    goodboy_desktop_lib::run();
}
