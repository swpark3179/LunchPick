//! Windows 자격 증명 관리자에 FabriX 자격증명을 보관한다.
//!
//! 값을 **읽는 커맨드는 프론트엔드에 노출하지 않는다** — webview 가 키를 볼 수 없게 하는 것이
//! 이 모듈의 목적이다. 읽기는 `fabrix` 모듈이 Rust 안에서만 쓴다.

use keyring::Entry;

const SERVICE: &str = "lunchpick";

pub const CLIENT_KEY: &str = "fabrix_client_key";
pub const OPENAPI_TOKEN: &str = "fabrix_openapi_token";

const ALLOWED: [&str; 2] = [CLIENT_KEY, OPENAPI_TOKEN];

fn entry(key: &str) -> Result<Entry, String> {
    if !ALLOWED.contains(&key) {
        return Err(format!("허용되지 않은 키 이름이에요: {key}"));
    }
    Entry::new(SERVICE, key).map_err(|e| format!("자격 증명 저장소를 열 수 없어요: {e}"))
}

/// Rust 내부 전용 읽기.
pub fn read(key: &str) -> Result<Option<String>, String> {
    match entry(key)?.get_password() {
        Ok(v) => Ok(Some(v)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("자격 증명을 읽을 수 없어요: {e}")),
    }
}

#[tauri::command]
pub fn secret_set(key: String, value: String) -> Result<(), String> {
    let e = entry(&key)?;
    if value.trim().is_empty() {
        return Err("빈 값은 저장할 수 없어요.".into());
    }
    e.set_password(value.trim())
        .map_err(|e| format!("자격 증명을 저장할 수 없어요: {e}"))
}

#[tauri::command]
pub fn secret_delete(key: String) -> Result<(), String> {
    match entry(&key)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("자격 증명을 삭제할 수 없어요: {e}")),
    }
}

#[tauri::command]
pub fn secret_exists(key: String) -> Result<bool, String> {
    Ok(read(&key)?.is_some())
}
