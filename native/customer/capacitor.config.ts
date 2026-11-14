import type { CapacitorConfig } from "@capacitor/cli";

// The customer app: a thin native shell around the live site's home page, the
// list of shops. Customers browse freely, and create a profile (name, phone,
// password) when they book. Every web deploy updates the app; no new APK.
// The owner app (native/mobile) is separate and opens /dashboard.
//
// The live site. To point the app elsewhere, set KB_APP_URL before `npx cap sync`:
//   PowerShell:  $env:KB_APP_URL = "https://kurdbooking.com"; npx cap sync
const APP_URL = (process.env.KB_APP_URL || "https://kurdbooking-dlpz.vercel.app").replace(/\/$/, "");
const host = new URL(APP_URL).host;

const config: CapacitorConfig = {
  appId: "com.kurdbooking.app",
  appName: "KurdBooking",
  webDir: "www",
  server: {
    url: `${APP_URL}/`,
    cleartext: false,
    // Hosts not listed here (WhatsApp, maps, Instagram …) open in the system browser.
    allowNavigation: [host, `www.${host}`],
  },
  plugins: {
    // Android: MainActivity keeps the page between the status and navigation bars itself.
    // "LIGHT" = dark bar icons on the white strips.
    SystemBars: {
      insetsHandling: "disable",
      style: "LIGHT",
    },
  },
  android: {
    backgroundColor: "#ffffff", // the customer pages' white header: no flash of another colour
  },
};

export default config;
