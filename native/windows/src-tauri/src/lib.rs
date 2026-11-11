// The window (see tauri.conf.json) loads the live owner dashboard.
// Native notifications for new bookings come later: add
// tauri-plugin-notification and allow the dashboard's URL in
// capabilities/default.json ("remote").
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running KurdBooking");
}
