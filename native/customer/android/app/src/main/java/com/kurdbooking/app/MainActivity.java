package com.kurdbooking.app;

import android.content.Intent;
import android.net.Uri;
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
        openLink(getIntent());
    }

    // The app was already open (launchMode singleTask) and a shop link was tapped.
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        openLink(intent);
    }

    // The site's first address: links and QR codes made with it open on the current one.
    private static final String OLD_HOST = "kurdbooking-dlpz.vercel.app";

    // A shop link or QR code (App Links, see AndroidManifest.xml) opens that page here.
    // Capacitor core only loads the start page; following the link is @capacitor/app's job,
    // which this app doesn't use. Only https links to the site's own hosts are followed.
    private void openLink(Intent intent) {
        if (intent == null || !Intent.ACTION_VIEW.equals(intent.getAction()) || getBridge() == null) return;
        Uri link = intent.getData();
        String server = getBridge().getServerUrl();
        if (link == null || server == null || !"https".equals(link.getScheme()) || link.getHost() == null) return;
        String host = Uri.parse(server).getHost();
        if (!link.getHost().equalsIgnoreCase(host) && !link.getHost().equalsIgnoreCase(OLD_HOST)) return;
        String target = link.buildUpon().authority(host).build().toString();
        WebView webView = getBridge().getWebView();
        // After the start page, so the back key returns to the shop list.
        webView.post(() -> webView.loadUrl(target));
    }

    // Same shell as the owner app (native/mobile). Android 15+ draws every app edge to edge,
    // and targetSdk 36 can't opt out. The site sets viewport-fit=cover, so Capacitor's own
    // handling would put the sticky header under the status bar on current WebViews. Instead
    // the page always sits between the bars (the window background, white, fills them) and
    // shrinks above the keyboard. This is Capacitor's SystemBars code without its
    // viewport-fit=cover branch; SystemBars.insetsHandling is "disable" in capacitor.config.ts.
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
    // key would close the app from any page. Go back in the site's history instead, and
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
