# Native apps

Both apps are thin native shells around the live owner dashboard (`<site>/dashboard`), like zhewar's admin APK. Deploy the website first; the apps load it.

The app icon comes from `native/icon.svg`. It is a placeholder in zhewar's indigo → violet. Replace it with the final logo.

## Android + iOS (Capacitor 8): `native/mobile`

The `android/` and `ios/` projects are already generated.

### 1. Point the app at the live site and copy the config into the native projects

Do this every time `capacitor.config.ts` changes. In PowerShell:

```bash
cd native/mobile
```

```bash
npm install
```

```bash
$env:KB_APP_URL = "https://YOUR-SITE"; npx cap sync
```

Use your Vercel address until you have the domain.

### 2. Android

```bash
npm run android
```

This opens Android Studio. Use **Build → Generate Signed Bundle** for the Play Store.

### 3. iOS

`npm run ios` opens Xcode. It needs a **Mac**. Without one, build in the cloud with a GitHub Actions macOS runner or Codemagic.

You also need an Apple Developer account ($99/year).

Apple may reject apps that only show a website. Push notifications (next step) and the offline screen in `www/` help with review.

### App icons and splash

```bash
npx @capacitor/assets generate --iconBackgroundColor "#4f46e5" --splashBackgroundColor "#fafafc"
```

Put a 1024×1024 `assets/icon.png` (and optionally `assets/splash.png`) in `native/mobile` first.

### Push notifications (roadmap, phase 5)

`@capacitor/push-notifications` is already installed. To finish it:

1. Create a Firebase project.
2. Put `google-services.json` in `android/app/`.
3. Add the APNs key in Firebase for iOS.
4. Port zhewar's `lib/pushNotifications.ts` + `components/admin/PushNotificationInit.tsx`, saving tokens to the `device_tokens` table.
5. Send a push from `app/s/[shop]/book/actions.ts` when a booking arrives.

## Windows (Tauri 2): `native/windows`

### 1. Install once

- Rust: install from [rustup.rs](https://rustup.rs).
- Visual Studio Build Tools: tick "Desktop development with C++".
- WebView2 is already part of Windows 11.

### 2. Set the address

Change `app.windows[0].url` in `src-tauri/tauri.conf.json` to `https://YOUR-SITE/dashboard`.

### 3. Build

```bash
cd native/windows
```

```bash
npm install
```

```bash
npm run build
```

The installers land in `src-tauri/target/release/bundle/` (`nsis/*.exe`, `msi/*.msi`).

Icons are already generated in `src-tauri/icons/`. After changing `native/icon.svg`, run `npm run icons` again.

Windows notifications for new bookings come later: add `tauri-plugin-notification` and allow the site in `src-tauri/capabilities/default.json`.
