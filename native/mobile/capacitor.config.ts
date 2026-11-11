import type { CapacitorConfig } from "@capacitor/cli";

// The app is a thin native shell around the live owner dashboard, like the
// zhewar admin app: every web deploy updates the app, no store release needed.
//
// Set the address before `npx cap sync`:
//   PowerShell:  $env:KB_APP_URL = "https://kurdbooking.com"; npx cap sync
// Before the domain is bought, use the Vercel address (https://<project>.vercel.app).
const APP_URL = (process.env.KB_APP_URL || "https://REPLACE-ME.vercel.app").replace(/\/$/, "");
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
