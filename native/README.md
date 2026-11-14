# Native apps

Three thin native shells around the live website. Deploy the website first; the apps load it, so a web deploy updates them with no new build.

| App | Folder | Opens | Id |
|---|---|---|---|
| Owner app (Android + iOS) | `native/mobile` | `<site>/dashboard` | `com.kurdbooking.owner` |
| Owner app (Windows) | `native/windows` | `<site>/dashboard` | |
| Customer app (Android) | `native/customer` | `<site>/` (the shop list) | `com.kurdbooking.app` |

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

The app loads the live site, so a Vercel deploy updates it with no new APK. Build a new APK only after a native change: anything in `android/`, `capacitor.config.ts`, the icon or a plugin.

#### Install once

- JDK 21 (Temurin) and Android Studio.
- The Android SDK, in `%LOCALAPPDATA%\Android\Sdk`. Android Studio's first-run wizard installs it. Without the wizard, use the command-line tools **19.0** (`commandlinetools-win-13114758`) and run `sdkmanager "platform-tools" "platforms;android-36" "build-tools;35.0.0"`. Newer command-line tools hand `sdkmanager` over to the new `android` CLI, whose bundled Java is blocked by Windows Application Control on this PC.
- `android/local.properties` (not in git) with `sdk.dir=C:/Users/<you>/AppData/Local/Android/Sdk`. Android Studio writes it for you.

#### Build

In `native/mobile/android`:

```bash
.\gradlew.bat assembleDebug
```

This makes `app/build/outputs/apk/debug/app-debug.apk`, for testing on a phone.

```bash
.\gradlew.bat assembleRelease bundleRelease
```

This makes the signed `app/build/outputs/apk/release/app-release.apk`, to send to owners directly, and `app/build/outputs/bundle/release/app-release.aab` for Google Play.

`npm run android` opens the same project in Android Studio instead.

Before each new release, raise `versionCode` (and `versionName`) in `android/app/build.gradle`. Google Play refuses a `versionCode` it has seen, and phones won't install a lower one over a higher one.

#### Signing key

Release builds are signed with `android/keystore/kurdbooking-upload.jks`. Its passwords are in `android/keystore.properties`. Both are git-ignored.

**Back up both files** somewhere private (a password manager or a private drive). Every update must be signed with the same key. If it is lost, phones that installed the APK directly have to uninstall the app before they can install a new version. On Google Play, keep **Play App Signing** on (the default): then this file is only the upload key, and Google support can reset it.

Without `keystore.properties`, release builds come out unsigned and debug builds still work. To make a new key on another machine:

```bash
keytool -genkeypair -keystore keystore/kurdbooking-upload.jks -storetype PKCS12 -alias upload -keyalg RSA -keysize 4096 -validity 10000 -dname "CN=KurdBooking, O=KurdBooking, C=IQ"
```

Then write `keystore.properties` with `storeFile=keystore/kurdbooking-upload.jks`, `storePassword=…`, `keyAlias=upload`, `keyPassword=…` (the same password for a PKCS12 key).

#### What the Android shell adds (`MainActivity.java`)

- Keeps the page between the status bar and the navigation bar, and above the keyboard. targetSdk 36 is always edge to edge, and the site's `viewport-fit=cover` would otherwise put the top of the dashboard under the status bar. `SystemBars.insetsHandling` is `"disable"` in `capacitor.config.ts` so Capacitor doesn't do it a second time.
- The back key goes back a page. On the first page it leaves the app.
- Saves cookies when the app goes to the background, so the login survives the app being swiped away (zhewar fix).
- A light theme only: the bars and the launch screen use the dashboard's `#FAFAFC`.

### 3. iOS

`npm run ios` opens Xcode. It needs a **Mac**. Without one, build in the cloud with a GitHub Actions macOS runner or Codemagic.

You also need an Apple Developer account ($99/year).

Apple may reject apps that only show a website. Push notifications and the offline screen in `www/` help with review.

### App icons and splash

All of them come from `native/icon.svg`.

**Android:**
- Android 8 and newer use the adaptive icon: `android/app/src/main/res/drawable/ic_launcher_background.xml` (the gradient) and `ic_launcher_foreground.xml` (the white calendar, also the Android 13 themed icon). Both are hand-copied from the SVG, so update them when the logo changes.
- Android 7 uses the `mipmap-*/ic_launcher.png` and `ic_launcher_round.png` files. They are copied from `native/windows/src-tauri/icons/android/` (`npm run icons` in `native/windows` makes them).
- The launch screen is the round icon (`drawable/splash_icon.xml`) on `#FAFAFC`, set in `values/styles.xml`. Without it, `Theme.SplashScreen` shows the generic Android robot.

**iOS:**

```bash
npx @capacitor/assets generate --ios --iconBackgroundColor "#4f46e5" --splashBackgroundColor "#fafafc"
```

Put a 1024×1024 `assets/icon.png` (and optionally `assets/splash.png`) in `native/mobile` first. Leave out `--ios` only if you also want it to replace the Android files above.

### Push notifications

- **Android: done.** FCM through Firebase project `kurdbooking`. `google-services.json` is in `android/app/`, and Vercel needs `FIREBASE_SERVICE_ACCOUNT`. The site side is `components/push/native.ts` (asks for permission, saves the token) and `lib/push.ts` (sends). The app asks for permission on first open.
- **iOS: not yet.** It needs an Apple Developer account, an APNs key uploaded to Firebase, and `GoogleService-Info.plist` in `ios/App/App/`.

## Customer app (Android, Capacitor 8): `native/customer`

Opens the shop list. Customers browse freely and create a profile (name, phone, password) when they book; `/account` shows their bookings. It is the owner app's shell (`MainActivity.java`: page clear of the system bars, back key, cookie flush) with a white background, a blue → red adaptive icon and no push yet.

```bash
cd native/customer
```

```bash
npm install
```

```bash
$env:KB_APP_URL = "https://YOUR-SITE"; npx cap sync android
```

Then in `native/customer/android`, with `JAVA_HOME` set to JDK 21:

```bash
.\gradlew.bat assembleDebug assembleRelease
```

Release builds are signed with the **same upload key** as the owner app: `android/keystore.properties` (git-ignored) holds the same passwords with `storeFile=../../mobile/android/keystore/kurdbooking-upload.jks`. Copy it from the owner app's file and change that line.

**Publishing a new APK:** copy `app/build/outputs/apk/release/app-release.apk` to `public/kurdbooking.apk` and deploy. The site serves it at `<site>/kurdbooking.apk` and shows a download link in the footer of the customer pages (browsers only, not iPhones, not inside the app). Raise `versionCode` and `versionName` in `android/app/build.gradle` first, or phones won't install it over the old one.

Still to do: its own final icon (Android 7 still uses the owner app's indigo `mipmap-*` PNGs), push for booking status, an iOS project, a store listing.

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
