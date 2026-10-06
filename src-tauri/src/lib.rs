mod fabrix;
mod secrets;
mod storage;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .invoke_handler(tauri::generate_handler![
            storage::load_data,
            storage::save_data,
            storage::load_settings,
            storage::save_settings,
            storage::read_text_file,
            storage::write_text_file,
            storage::data_dir_path,
            secrets::secret_set,
            secrets::secret_delete,
            secrets::secret_exists,
            fabrix::fabrix_models,
            fabrix::fabrix_test,
            fabrix::fabrix_recommend,
        ])
        .run(tauri::generate_context!())
        .expect("점심픽을 실행하는 중 오류가 발생했습니다");
}
