package com.kurdbooking.owner;

import android.os.Bundle;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        keepPageClearOfSystemBars();
        backGoesToThePreviousPage();
    }

    // Android 15+ draws every app edge to edge, and targetSdk 36 can't opt out (zhewar's
    // windowOptOutEdgeToEdgeEnforcement stops working). The site sets viewport-fit=cover but
    // only pads the bottom tab bar, so Capacitor's own handling would put the top of the
    // dashboard under the status bar on current WebViews. Instead the page always sits
    // between the bars (the window background, #FAFAFC, fills them) and shrinks above the
    // keyboard. This is Capacitor's SystemBars code without its viewport-fit=cover branch;
    // SystemBars.insetsHandling is "disable" in capacitor.config.ts so the two don't fight.
    private void keepPageClearOfSystemBars() {
        View root = getWindow().getDecorView();
        ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> {
            int bars = WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout();
            Insets barInsets = insets.getInsets(bars);
            boolean keyboardVisible = insets.isVisible(WindowInsetsCompat.Type.ime());
            int bottom = keyboardVisible ? insets.getInsets(WindowInsetsCompat.Type.ime()).bottom : barInsets.bottom;
            v.setPadding(barInsets.left, barInsets.top, barInsets.right, bottom);
            // Zero the bar insets instead of returning CONSUMED, which stops the WebView from
            // recalculating its safe area (https://issues.chromium.org/issues/461332423).
            return new WindowInsetsCompat.Builder(insets).setInsets(bars, Insets.NONE).build();
        });
    }

    // Capacitor core has no back-button handling (that lives in @capacitor/app), so the back
    // key would close the app from any page. Go back in the dashboard's history instead, and
    // only leave (keeping the app in memory) from the first page.
    private void backGoesToThePreviousPage() {
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView webView = getBridge() == null ? null : getBridge().getWebView();
                if (webView != null && webView.canGoBack()) {
                    webView.goBack();
                } else {
                    moveTaskToBack(true);
                }
            }
        });
    }

    @Override
    public void onPause() {
        super.onPause();
        // The WebView writes cookies to disk only now and then, so an app swiped away soon after
        // login could lose the Supabase session cookie and open on /login next time (zhewar fix).
        CookieManager.getInstance().flush();
    }
}
