//! data.json / settings.json 읽기·쓰기. 쓰기는 임시 파일 + rename 으로 원자적으로 처리한다.

use std::fs;
use std::path::PathBuf;

use serde_json::Value;
use tauri::{AppHandle, Manager};

const DATA_FILE: &str = "data.json";
const SETTINGS_FILE: &str = "settings.json";

fn app_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("앱 데이터 폴더를 찾을 수 없어요: {e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("앱 데이터 폴더를 만들 수 없어요: {e}"))?;
    Ok(dir)
}

fn read_json(app: &AppHandle, name: &str) -> Result<Option<Value>, String> {
    let path = app_dir(app)?.join(name);
    if !path.exists() {
        return Ok(None);
    }
    let text = fs::read_to_string(&path).map_err(|e| format!("{name} 을 읽을 수 없어요: {e}"))?;
    if text.trim().is_empty() {
        return Ok(None);
    }
    match serde_json::from_str(&text) {
        Ok(v) => Ok(Some(v)),
        Err(e) => {
            // 손상된 파일은 덮어쓰지 않고 옆으로 치워 두고, 없는 것으로 취급한다.
            let backup = path.with_extension("corrupt.json");
            let _ = fs::rename(&path, &backup);
            Err(format!(
                "{name} 이 손상돼 있어요 ({e}). 파일을 {} 으로 옮겨 두었습니다.",
                backup.display()
            ))
        }
    }
}

fn write_json(app: &AppHandle, name: &str, value: &Value) -> Result<(), String> {
    let dir = app_dir(app)?;
    let path = dir.join(name);
    let tmp = dir.join(format!("{name}.tmp"));
    let text =
        serde_json::to_string_pretty(value).map_err(|e| format!("직렬화에 실패했어요: {e}"))?;
    fs::write(&tmp, text).map_err(|e| format!("{name} 임시 파일을 쓸 수 없어요: {e}"))?;
    // Windows 의 rename 은 대상이 있으면 덮어쓴다.
    fs::rename(&tmp, &path).map_err(|e| format!("{name} 을 저장할 수 없어요: {e}"))?;
    Ok(())
}

#[tauri::command]
pub fn load_data(app: AppHandle) -> Result<Option<Value>, String> {
    read_json(&app, DATA_FILE)
}

#[tauri::command]
pub fn save_data(app: AppHandle, data: Value) -> Result<(), String> {
    write_json(&app, DATA_FILE, &data)
}

#[tauri::command]
pub fn load_settings(app: AppHandle) -> Result<Option<Value>, String> {
    read_json(&app, SETTINGS_FILE)
}

#[tauri::command]
pub fn save_settings(app: AppHandle, settings: Value) -> Result<(), String> {
    write_json(&app, SETTINGS_FILE, &settings)
}

/// 사용자가 다이얼로그로 고른 경로를 읽는다 (JSON 가져오기).
#[tauri::command]
pub fn read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("파일을 읽을 수 없어요: {e}"))
}

/// 사용자가 다이얼로그로 고른 경로에 쓴다 (JSON/CSV 내보내기).
#[tauri::command]
pub fn write_text_file(path: String, contents: String) -> Result<(), String> {
    fs::write(&path, contents).map_err(|e| format!("파일을 저장할 수 없어요: {e}"))
}

/// 설정 화면에서 저장 위치를 보여주기 위한 경로.
#[tauri::command]
pub fn data_dir_path(app: AppHandle) -> Result<String, String> {
    Ok(app_dir(&app)?.display().to_string())
}
