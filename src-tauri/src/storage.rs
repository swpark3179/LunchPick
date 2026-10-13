//! data.json / settings.json 읽기·쓰기. 쓰기는 임시 파일 + rename 으로 원자적으로 처리한다.
//!
//! 도란식사 식당 보관함은 식당마다 파일 하나다 — `doran/<id>.json`. 파일 하나가 깨져도 나머지는 그대로 읽힌다.

use std::fs;
use std::path::{Path, PathBuf};

use serde_json::Value;
use tauri::{AppHandle, Manager};

const DATA_FILE: &str = "data.json";
const SETTINGS_FILE: &str = "settings.json";
const DORAN_DIR: &str = "doran";
/// 식당 하나의 파일이 이보다 크면 손상된 것으로 보고 읽지 않는다.
const DORAN_FILE_MAX: u64 = 512 * 1024;

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

// ---------------------------------------------------------------- 도란식사 식당 보관함

/// 식당 id 는 파일 이름이 되므로 소문자·숫자·`_`·`-` 1~40자만 받는다 (src/share/doran.ts 의 DORAN_ID 와 같다).
fn valid_doran_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 40
        && id
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'_' || b == b'-')
}

fn doran_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app_dir(app)?.join(DORAN_DIR);
    fs::create_dir_all(&dir).map_err(|e| format!("식당 보관함 폴더를 만들 수 없어요: {e}"))?;
    Ok(dir)
}

/// 폴더 안의 `*.json` 을 모두 읽는다. 읽지 못하거나 깨진 파일·너무 큰 파일은 건너뛴다.
fn list_in(dir: &Path) -> Vec<Value> {
    let Ok(rd) = fs::read_dir(dir) else {
        return Vec::new();
    };
    let mut out = Vec::new();
    for entry in rd.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }
        let Some(stem) = path.file_stem().and_then(|s| s.to_str()) else {
            continue;
        };
        if !valid_doran_id(stem) {
            continue;
        }
        if entry
            .metadata()
            .map(|m| m.len() > DORAN_FILE_MAX)
            .unwrap_or(true)
        {
            continue;
        }
        if let Some(v) = fs::read_to_string(&path)
            .ok()
            .and_then(|t| serde_json::from_str::<Value>(&t).ok())
        {
            out.push(v);
        }
    }
    out
}

fn save_in(dir: &Path, id: &str, value: &Value) -> Result<(), String> {
    if !valid_doran_id(id) {
        return Err(format!("식당 id '{id}' 형식이 올바르지 않아요."));
    }
    let path = dir.join(format!("{id}.json"));
    let tmp = dir.join(format!("{id}.json.tmp"));
    let text =
        serde_json::to_string_pretty(value).map_err(|e| format!("직렬화에 실패했어요: {e}"))?;
    fs::write(&tmp, text).map_err(|e| format!("식당 파일을 쓸 수 없어요: {e}"))?;
    fs::rename(&tmp, &path).map_err(|e| format!("식당 파일을 저장할 수 없어요: {e}"))?;
    Ok(())
}

fn delete_in(dir: &Path, id: &str) -> Result<(), String> {
    if !valid_doran_id(id) {
        return Err(format!("식당 id '{id}' 형식이 올바르지 않아요."));
    }
    match fs::remove_file(dir.join(format!("{id}.json"))) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(format!("식당 파일을 지울 수 없어요: {e}")),
    }
}

/// 보관함의 식당 파일들 (내용은 프론트가 검증한다).
#[tauri::command]
pub fn doran_list(app: AppHandle) -> Result<Vec<Value>, String> {
    Ok(list_in(&doran_dir(&app)?))
}

#[tauri::command]
pub fn doran_save(app: AppHandle, id: String, entry: Value) -> Result<(), String> {
    save_in(&doran_dir(&app)?, &id, &entry)
}

#[tauri::command]
pub fn doran_delete(app: AppHandle, id: String) -> Result<(), String> {
    delete_in(&doran_dir(&app)?, &id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn temp_dir(name: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("lunchpick-doran-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn doran_ids_are_lowercase_file_safe() {
        assert!(valid_doran_id("a1b2c3d"));
        assert!(valid_doran_id("x_y-z"));
        assert!(!valid_doran_id(""));
        assert!(!valid_doran_id("A1"));
        assert!(!valid_doran_id("../a"));
        assert!(!valid_doran_id("a.b"));
        assert!(!valid_doran_id(&"a".repeat(41)));
    }

    #[test]
    fn doran_save_list_delete_round_trip() {
        let dir = temp_dir("round");
        save_in(
            &dir,
            "abc",
            &json!({ "restaurant": { "id": "abc", "name": "횟집" } }),
        )
        .unwrap();
        save_in(
            &dir,
            "def",
            &json!({ "restaurant": { "id": "def", "name": "고깃집" } }),
        )
        .unwrap();
        // 같은 id 로 다시 저장하면 덮어쓴다.
        save_in(
            &dir,
            "abc",
            &json!({ "restaurant": { "id": "abc", "name": "바다횟집" } }),
        )
        .unwrap();
        let mut names: Vec<String> = list_in(&dir)
            .iter()
            .map(|v| v["restaurant"]["name"].as_str().unwrap().to_string())
            .collect();
        names.sort();
        assert_eq!(names, vec!["고깃집", "바다횟집"]);
        assert!(!dir.join("abc.json.tmp").exists());

        delete_in(&dir, "abc").unwrap();
        // 없는 파일을 지워도 괜찮다.
        delete_in(&dir, "abc").unwrap();
        assert_eq!(list_in(&dir).len(), 1);
        assert!(save_in(&dir, "../x", &json!({})).is_err());
        assert!(delete_in(&dir, "A").is_err());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn doran_list_skips_broken_and_foreign_files() {
        let dir = temp_dir("broken");
        save_in(
            &dir,
            "good",
            &json!({ "restaurant": { "id": "good", "name": "국밥" } }),
        )
        .unwrap();
        fs::write(dir.join("bad.json"), "{ 깨진").unwrap();
        fs::write(dir.join("half.json.tmp"), "{}").unwrap();
        fs::write(dir.join("Upper.json"), "{}").unwrap();
        fs::write(dir.join("notes.txt"), "메모").unwrap();
        let all = list_in(&dir);
        assert_eq!(all.len(), 1);
        assert_eq!(all[0]["restaurant"]["name"], "국밥");
        // 폴더가 없으면 빈 목록이다.
        assert!(list_in(&dir.join("없음")).is_empty());
        let _ = fs::remove_dir_all(&dir);
    }
}
