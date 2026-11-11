import type { CapacitorConfig } from "@capacitor/cli";

// The app is a thin native shell around the live owner dashboard, like the
// zhewar admin app: every web deploy updates the app, no store release needed.
//
// The live site. To point the app elsewhere, set KB_APP_URL before `npx cap sync`:
//   PowerShell:  $env:KB_APP_URL = "https://kurdbooking.com"; npx cap sync
const APP_URL = (process.env.KB_APP_URL || "https://kurdbooking.vercel.app").replace(/\/$/, "");
const host = new URL(APP_URL).host;

const config: CapacitorConfig = {
  appId: "com.kurdbooking.owner",
  appName: "KurdBooking",
  webDir: "www",
  server: {
    url: `${APP_URL}/dashboard`,
    cleartext: false,
    // Hosts not listed here open in the system browser instead of the app.
    allowNavigation: [host, `www.${host}`],
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
  android: {
    backgroundColor: "#fafafc", // matches the dashboard background (zhewar #FAFAFC): no white flash
  },
  ios: {
    backgroundColor: "#fafafc",
    contentInset: "automatic",
  },
};

export default config;
