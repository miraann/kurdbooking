package com.kurdbooking.owner;

import android.app.ActivityManager;
import android.content.ActivityNotFoundException;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

// High-priority FCM that shows a notification is already exempt from stock
// Android's Doze. What still stops a swiped-away app from getting pushes is
// the battery setting being "Restricted", or a vendor task killer (Xiaomi
// Autostart, Huawei app launch, Samsung sleeping apps) leaving the app in a
// stopped state that FCM isn't allowed to wake. This lets the dashboard
// check for that and send the user to the screen that fixes it. Ported from zhewar;
// used by components/push/BackgroundCard.tsx (Dashboard → Settings).
@CapacitorPlugin(name = "BackgroundReliability")
public class BackgroundReliabilityPlugin extends Plugin {

    // Vendors whose builds kill swiped-away apps unless they're whitelisted
    private static final List<String> AGGRESSIVE_OEMS = Arrays.asList(
        "xiaomi", "redmi", "poco", "huawei", "honor", "oppo", "realme", "oneplus",
        "vivo", "iqoo", "samsung", "asus", "meizu", "letv", "tecno", "infinix", "itel"
    );

    // Each vendor's autostart / background-launch whitelist screen. Each
    // package is vendor-specific, so trying them in order is safe.
    private static final String[][] AUTOSTART_SCREENS = {
        { "com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity" },
        { "com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity" },
        { "com.huawei.systemmanager", "com.huawei.systemmanager.optimize.process.ProtectActivity" },
        { "com.hihonor.systemmanager", "com.hihonor.systemmanager.startupmgr.ui.StartupNormalAppListActivity" },
        { "com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity" },
        { "com.coloros.safecenter", "com.coloros.safecenter.startupapp.StartupAppListActivity" },
        { "com.oppo.safe", "com.oppo.safe.permission.startup.StartupAppListActivity" },
        { "com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity" },
        { "com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.BgStartUpManager" },
        { "com.oneplus.security", "com.oneplus.security.chainlaunch.view.ChainLaunchAppListActivity" },
        { "com.samsung.android.lool", "com.samsung.android.sm.battery.ui.BatteryActivity" },
        { "com.samsung.android.lool", "com.samsung.android.sm.ui.battery.BatteryActivity" },
        { "com.asus.mobilemanager", "com.asus.mobilemanager.autostart.AutoStartActivity" },
        { "com.meizu.safe", "com.meizu.safe.permission.SmartBGActivity" },
        { "com.letv.android.letvsafe", "com.letv.android.letvsafe.AutobootManageActivity" },
    };

    @PluginMethod
    public void getStatus(PluginCall call) {
        call.resolve(status());
    }

    // Shows the system "Let app always run in background?" dialog
    @PluginMethod
    public void requestIgnoreBatteryOptimizations(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M || isIgnoringBatteryOptimizations()) {
            call.resolve(status());
            return;
        }
        Intent dialog = new Intent(
            Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
            Uri.parse("package:" + getContext().getPackageName())
        );
        try {
            startActivityForResult(call, dialog, "batterySettingsClosed");
        } catch (ActivityNotFoundException e) {
            // Some vendor builds strip the dialog but keep the full list screen
            try {
                startActivityForResult(call, new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS), "batterySettingsClosed");
            } catch (ActivityNotFoundException e2) {
                call.resolve(status());
            }
        }
    }

    @ActivityCallback
    private void batterySettingsClosed(PluginCall call, ActivityResult result) {
        if (call == null) return;
        call.resolve(status());
    }

    // There's no API to read autostart state, so this only opens the screen.
    // Falls back to the app's own settings page.
    @PluginMethod
    public void openAutostartSettings(PluginCall call) {
        for (String[] screen : AUTOSTART_SCREENS) {
            Intent intent = new Intent().setComponent(new ComponentName(screen[0], screen[1]));
            if (tryStart(intent)) {
                call.resolve();
                return;
            }
        }
        openAppSettings(call);
    }

    // App info page — battery usage ("Unrestricted") lives here on Android 12+
    @PluginMethod
    public void openAppSettings(PluginCall call) {
        Intent intent = new Intent(
            Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
            Uri.parse("package:" + getContext().getPackageName())
        );
        if (tryStart(intent)) call.resolve();
        else call.reject("No settings screen available");
    }

    private boolean tryStart(Intent intent) {
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(intent);
            return true;
        } catch (ActivityNotFoundException | SecurityException e) {
            // Missing on this build, or not exported to other apps
            return false;
        }
    }

    private boolean isIgnoringBatteryOptimizations() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return true;
        PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
        return pm != null && pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
    }

    // The user picked "Restricted" for this app's battery usage
    private boolean isBackgroundRestricted() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) return false;
        ActivityManager am = (ActivityManager) getContext().getSystemService(Context.ACTIVITY_SERVICE);
        return am != null && am.isBackgroundRestricted();
    }

    private JSObject status() {
        String manufacturer = Build.MANUFACTURER == null ? "" : Build.MANUFACTURER.toLowerCase(Locale.ROOT);
        JSObject ret = new JSObject();
        ret.put("ignoringBatteryOptimizations", isIgnoringBatteryOptimizations());
        ret.put("backgroundRestricted", isBackgroundRestricted());
        ret.put("manufacturer", manufacturer);
        ret.put("aggressiveOem", AGGRESSIVE_OEMS.contains(manufacturer));
        return ret;
    }
}
