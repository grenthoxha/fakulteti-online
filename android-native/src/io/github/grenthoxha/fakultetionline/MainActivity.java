package io.github.grenthoxha.fakultetionline;

import android.Manifest;
import android.app.Activity;
import android.app.ActivityManager;
import android.app.AlertDialog;
import android.app.KeyguardManager;
import android.app.admin.DevicePolicyManager;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebMessage;
import android.webkit.WebMessagePort;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;
import android.window.OnBackInvokedDispatcher;

public final class MainActivity extends Activity {
    private static final Uri APP_ORIGIN = Uri.parse("https://grenthoxha.github.io");
    private static final String APP_PATH = "/fakulteti-online/";
    private static final int WEB_REVISION = 7;
    private static final String START_URL = APP_ORIGIN + APP_PATH + "?source=homescreen&app=1.0.6";
    private static final int FILE_PICKER = 1;
    private static final int NOTIFICATION_PERMISSION = 2;
    private static final int REPEAT_NOTIFICATION_PERMISSION = 3;
    private static final String FOCUS_LOCKED = "focus_locked";
    private static final String AWAITING_ALARM_SETTINGS = "awaiting_alarm_settings";
    private static final int DARK_SURFACE = 0xff111827;
    private static final int LEGACY_LAYOUT_FLAGS = View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION;

    // The app origin receives a private port for appearance and fixed commands.
    private static final String CONNECT_PAGE = """
        (() => {
          if (window.__fakultetiAndroidTheme) return true;
          window.__fakultetiAndroidTheme = true;
          window.dispatchEvent(new Event('appinstalled'));
          const connect = event => {
            if (event.data !== 'fakulteti:system-bars' || !event.ports[0]) return;
            window.removeEventListener('message', connect);
            const port = event.ports[0];
            const root = document.documentElement;
            let focusLocked = false;
            let demoRepeating = false;
            port.onmessage = event => {
              if (event.data === 'focus-restore') {
                focusLocked = true;
                window.dispatchEvent(new Event('fakulteti:focus-restore'));
              } else if (event.data === 'demo-repeat-on' || event.data === 'demo-repeat-off') {
                demoRepeating = event.data === 'demo-repeat-on';
                window.dispatchEvent(new Event('fakulteti:demo-repeat-state'));
              } else if (typeof event.data === 'string' && event.data.startsWith('notification-open:')) {
                window.dispatchEvent(new CustomEvent('fakulteti:notification-open', { detail: event.data.slice(18) }));
              }
            };
            window.fakultetiAndroid = Object.freeze({
              get focusLocked() { return focusLocked; },
              get demoRepeating() { return demoRepeating; },
              demoRepeatSupported: true,
              notificationFeedSupported: true,
              send(command) {
                port.postMessage(command);
                if (command === 'focus-lock') focusLocked = true;
                if (command === 'focus-unlock') focusLocked = false;
              }
            });
            window.dispatchEvent(new Event('fakulteti:android-ready'));
            let previous;
            const update = () => {
              const appearance = root.classList.contains('unit-media-open') ? 'media'
                : root.classList.contains('dark') ? 'dark' : 'light';
              if (appearance === previous) return;
              previous = appearance;
              port.postMessage(appearance);
            };
            new MutationObserver(update).observe(root, { attributes: true, attributeFilter: ['class'] });
            update();
          };
          window.addEventListener('message', connect);
          return true;
        })()
        """;

    private FrameLayout frame;
    private WebView page;
    private View fullscreenView;
    private WebChromeClient.CustomViewCallback fullscreenCallback;
    private WebMessagePort pagePort;
    private boolean connectingPage;
    private boolean focusLocked;
    private boolean awaitingAlarmSettings;
    private boolean notificationFeedReady;
    private String pendingNotificationId;
    private String pendingNotificationScope;
    private int pageRevision;
    private ValueCallback<Uri[]> fileResult;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        readNotificationIntent(getIntent());
        if (state != null && pendingNotificationId == null) {
            pendingNotificationId = state.getString(DemoNotifications.OPEN_ITEM);
            pendingNotificationScope = state.getString(DemoNotifications.OPEN_SCOPE);
        }
        focusLocked = state != null && state.getBoolean(FOCUS_LOCKED);
        awaitingAlarmSettings = state != null && state.getBoolean(AWAITING_ALARM_SETTINGS);
        configureWindow();
        frame = new FrameLayout(this);
        frame.setOnApplyWindowInsetsListener((view, insets) -> applyInsets(insets));

        page = new WebView(this);
        configurePage();
        frame.addView(page, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(frame);
        // Installing the content initializes the window decor used by getInsetsController().
        updateSystemAppearance();
        if (focusLocked) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        frame.requestApplyInsets();
        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::navigateBack);
        }
        // Refresh web resources once per APK upgrade; leave accounts and Web Storage intact.
        boolean updated = getPreferences(MODE_PRIVATE).getInt("web_revision", 0) != WEB_REVISION;
        if (updated) {
            page.clearCache(true);
            getPreferences(MODE_PRIVATE).edit().putInt("web_revision", WEB_REVISION).apply();
        }
        if (updated || state == null || page.restoreState(state) == null) {
            page.loadUrl(START_URL, java.util.Collections.singletonMap("Cache-Control", "no-cache"));
        }
    }

    @SuppressWarnings("deprecation")
    private void configureWindow() {
        Window window = getWindow();
        if (Build.VERSION.SDK_INT >= 30) {
            window.setDecorFitsSystemWindows(false);
        } else {
            window.getDecorView().setSystemUiVisibility(LEGACY_LAYOUT_FLAGS);
        }
        window.setStatusBarColor(Color.TRANSPARENT);
        window.setNavigationBarColor(Color.TRANSPARENT);
        window.setStatusBarContrastEnforced(false);
        window.setNavigationBarContrastEnforced(false);
    }

    @SuppressWarnings("deprecation")
    private WindowInsets applyInsets(WindowInsets insets) {
        if (fullscreenView != null) {
            frame.setPadding(0, 0, 0, 0);
            return Build.VERSION.SDK_INT >= 30 ? WindowInsets.CONSUMED
                    : insets.consumeSystemWindowInsets().consumeDisplayCutout();
        }
        // The native frame draws behind the bars. Only the WebView is padded.
        if (Build.VERSION.SDK_INT >= 30) {
            Insets padding = insets.getInsets(WindowInsets.Type.systemBars()
                    | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
            frame.setPadding(padding.left, padding.top, padding.right, padding.bottom);
            return WindowInsets.CONSUMED;
        }
        frame.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
        return insets.consumeSystemWindowInsets().consumeDisplayCutout();
    }

    @SuppressWarnings("deprecation")
    private void setAppearance(String appearance) {
        boolean light = "light".equals(appearance);
        frame.setBackgroundColor(light ? Color.WHITE
                : "media".equals(appearance) ? Color.BLACK : DARK_SURFACE);
        Window window = getWindow();
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController controller = window.getInsetsController();
            int flags = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                    | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
            if (controller != null) controller.setSystemBarsAppearance(light ? flags : 0, flags);
        } else {
            int lightFlags = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
            window.getDecorView().setSystemUiVisibility(LEGACY_LAYOUT_FLAGS | (light ? lightFlags : 0));
        }
    }

    private void updateSystemAppearance() {
        setAppearance(focusLocked ? "media" : getPreferences(MODE_PRIVATE).getString("appearance", "light"));
    }

    private void configurePage() {
        WebSettings settings = page.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        page.setBackgroundColor(Color.TRANSPARENT);
        page.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) return false;
                Uri url = request.getUrl();
                if (isAppPage(url)) return false;
                if (request.hasGesture()) openExternal(url);
                return true;
            }

            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                pageRevision++;
                connectingPage = false;
                notificationFeedReady = false;
                closePagePort();
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                if (isAppPage(Uri.parse(url))) connectPage(view);
            }
        });
        page.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onShowCustomView(View view, CustomViewCallback callback) {
                if (fullscreenView != null) { callback.onCustomViewHidden(); return; }
                fullscreenView = view;
                fullscreenCallback = callback;
                page.setVisibility(View.GONE);
                frame.addView(view, new FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
                setAppearance("media");
                if (Build.VERSION.SDK_INT >= 30) {
                    WindowInsetsController controller = getWindow().getInsetsController();
                    if (controller != null) {
                        controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                        controller.hide(WindowInsets.Type.systemBars());
                    }
                } else {
                    getWindow().getDecorView().setSystemUiVisibility(LEGACY_LAYOUT_FLAGS
                            | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
                }
                frame.requestApplyInsets();
            }

            @Override
            public void onHideCustomView() { hideFullscreenVideo(); }

            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                    FileChooserParams params) {
                finishFilePicker(null);
                fileResult = callback;
                try {
                    startActivityForResult(params.createIntent(), FILE_PICKER);
                } catch (ActivityNotFoundException unavailable) {
                    finishFilePicker(null);
                }
                return true;
            }
        });
        page.setDownloadListener((url, agent, disposition, mime, size) -> openExternal(Uri.parse(url)));
    }

    private static boolean isAppPage(Uri uri) {
        if (!"https".equals(uri.getScheme()) || !APP_ORIGIN.getHost().equals(uri.getHost())
                || (uri.getPort() != -1 && uri.getPort() != 443)) return false;
        String path = uri.getEncodedPath();
        return APP_PATH.equals(path) || (APP_PATH + "index.html").equals(path)
                || (APP_PATH + "fakulteti-online.html").equals(path);
    }

    private void connectPage(WebView view) {
        if (connectingPage || pagePort != null) return;
        connectingPage = true;
        int revision = pageRevision;
        view.evaluateJavascript(CONNECT_PAGE, result -> {
            if (revision != pageRevision || isFinishing() || isDestroyed()) return;
            connectingPage = false;
            if (!"true".equals(result)) return;
            WebMessagePort[] ports = view.createWebMessageChannel();
            pagePort = ports[0];
            pagePort.setWebMessageCallback(new WebMessagePort.WebMessageCallback() {
                @Override
                public void onMessage(WebMessagePort port, WebMessage message) {
                    if (port == pagePort && message.getData() != null && !isFinishing()) {
                        handlePageMessage(message.getData());
                    }
                }
            });
            view.postWebMessage(new WebMessage("fakulteti:system-bars", new WebMessagePort[]{ports[1]}),
                    APP_ORIGIN);
            if (focusLocked) pagePort.postMessage(new WebMessage("focus-restore"));
            sendRepeatState();
        });
    }

    private void handlePageMessage(String message) {
        if (message.startsWith("notification-state:")) {
            DemoNotifications.sync(this, message.substring(19));
            notificationFeedReady = true;
            openPendingNotification();
            sendRepeatState();
            return;
        }
        switch (message) {
            case "notification-clear" -> {
                DemoNotifications.sync(this, "{\"scope\":\"signed-out\",\"expires\":"
                        + (System.currentTimeMillis() + 60000) + ",\"items\":[]}");
                notificationFeedReady = false;
            }
            case "light", "dark" -> {
                getPreferences(MODE_PRIVATE).edit().putString("appearance", message).apply();
                updateSystemAppearance();
            }
            case "media" -> setAppearance("media");
            case "demo-notification" -> {
                if (!focusLocked && hasWindowFocus()) requestDemoNotification(false);
            }
            case "demo-repeat-toggle" -> {
                if (!focusLocked && hasWindowFocus()) toggleRepeatingDemo();
            }
            case "focus-lock" -> lockFocus();
            case "focus-unlock" -> unlockFocus();
        }
    }

    private void readNotificationIntent(Intent intent) {
        pendingNotificationId = intent.getStringExtra(DemoNotifications.OPEN_ITEM);
        pendingNotificationScope = intent.getStringExtra(DemoNotifications.OPEN_SCOPE);
        intent.removeExtra(DemoNotifications.OPEN_ITEM);
        intent.removeExtra(DemoNotifications.OPEN_SCOPE);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        readNotificationIntent(intent);
        openPendingNotification();
    }

    private void openPendingNotification() {
        if (!notificationFeedReady || pagePort == null || focusLocked || pendingNotificationId == null) return;
        if (DemoNotifications.scope(this).equals(pendingNotificationScope)) {
            pagePort.postMessage(new WebMessage("notification-open:" + pendingNotificationId));
        }
        pendingNotificationId = null;
        pendingNotificationScope = null;
    }

    private void closePagePort() {
        if (pagePort != null) {
            pagePort.close();
            pagePort = null;
        }
    }

    private void requestDemoNotification(boolean repeat) {
        if (!DemoNotifications.hasContent(this)) {
            Toast.makeText(this, "Nuk ke njoftime të palexuara për t'i dërguar.", Toast.LENGTH_SHORT).show();
            return;
        }
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            if (getPreferences(MODE_PRIVATE).getBoolean("asked_notifications", false)
                    && !shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS)) {
                showNotificationSettings();
                return;
            }
            getPreferences(MODE_PRIVATE).edit().putBoolean("asked_notifications", true).apply();
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},
                    repeat ? REPEAT_NOTIFICATION_PERMISSION : NOTIFICATION_PERMISSION);
            return;
        }
        sendDemoNotification(repeat);
    }

    @Override
    public void onRequestPermissionsResult(int request, String[] permissions, int[] grants) {
        super.onRequestPermissionsResult(request, permissions, grants);
        if ((request == NOTIFICATION_PERMISSION || request == REPEAT_NOTIFICATION_PERMISSION) && grants.length > 0
                && grants[0] == PackageManager.PERMISSION_GRANTED) {
            sendDemoNotification(request == REPEAT_NOTIFICATION_PERMISSION);
        }
    }

    private void sendDemoNotification(boolean repeat) {
        if (!DemoNotifications.hasContent(this)) {
            Toast.makeText(this, "Nuk ke njoftime të palexuara për t'i dërguar.", Toast.LENGTH_SHORT).show();
        } else if (!DemoNotifications.canPost(this)) {
            showNotificationSettings();
        } else if (!repeat) {
            DemoNotifications.post(this, false);
            Toast.makeText(this, "Njoftimi provë u dërgua.", Toast.LENGTH_SHORT).show();
        } else if (DemoNotifications.canSchedule(this)) {
            if (DemoNotifications.start(this)) {
                Toast.makeText(this, "Prova çdo 5 minuta filloi.", Toast.LENGTH_SHORT).show();
            }
            sendRepeatState();
        } else {
            new AlertDialog.Builder(this)
                    .setMessage("Për provën çdo 5 minuta, lejo alarmet dhe kujtesat për Fakulteti.")
                    .setNegativeButton("Anulo", null)
                    .setPositiveButton("Hap cilësimet", (dialog, button) -> openExactAlarmSettings())
                    .show();
        }
    }

    private void toggleRepeatingDemo() {
        if (DemoNotifications.isRepeating(this)) {
            DemoNotifications.stop(this);
            sendRepeatState();
            Toast.makeText(this, "Prova u ndal.", Toast.LENGTH_SHORT).show();
        } else {
            requestDemoNotification(true);
        }
    }

    private void openExactAlarmSettings() {
        awaitingAlarmSettings = true;
        try {
            startActivity(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
                    Uri.parse("package:" + getPackageName())));
        } catch (ActivityNotFoundException unavailable) {
            awaitingAlarmSettings = false;
            Toast.makeText(this, "Hap Alarmet dhe kujtesat te cilësimet e Android-it.",
                    Toast.LENGTH_LONG).show();
        }
    }

    private void sendRepeatState() {
        if (pagePort != null) {
            pagePort.postMessage(new WebMessage(DemoNotifications.isRepeating(this)
                    ? "demo-repeat-on" : "demo-repeat-off"));
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) sendRepeatState();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (awaitingAlarmSettings) {
            awaitingAlarmSettings = false;
            if (DemoNotifications.canSchedule(this)) sendDemoNotification(true);
        }
    }

    private void showNotificationSettings() {
        new AlertDialog.Builder(this)
                .setMessage("Lejo njoftimet për Fakulteti te cilësimet e Android-it dhe provo përsëri.")
                .setNegativeButton("Mbyll", null)
                .setPositiveButton("Hap cilësimet", (dialog, button) -> startActivity(
                        new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                                .putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName())))
                .show();
    }

    private void lockFocus() {
        if (focusLocked) return;
        focusLocked = true;
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        updateSystemAppearance();
        if (getSystemService(ActivityManager.class).getLockTaskModeState() != ActivityManager.LOCK_TASK_MODE_NONE
                || getSystemService(KeyguardManager.class).isKeyguardLocked()
                || getSystemService(DevicePolicyManager.class).isLockTaskPermitted(getPackageName())) {
            return;
        }
        try {
            startLockTask();
        } catch (IllegalStateException | SecurityException unavailable) {
            Toast.makeText(this, "Aktivizo gozhdimin e aplikacioneve te cilësimet e Android-it.",
                    Toast.LENGTH_LONG).show();
        }
    }

    private void unlockFocus() {
        if (!focusLocked) return;
        focusLocked = false;
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        updateSystemAppearance();
        openPendingNotification();
        if (getSystemService(ActivityManager.class).getLockTaskModeState() == ActivityManager.LOCK_TASK_MODE_PINNED) {
            try {
                stopLockTask();
            } catch (IllegalStateException | SecurityException unavailable) {
                Toast.makeText(this, "Përdor gjestin e Android-it për ta hequr gozhdimin.",
                        Toast.LENGTH_LONG).show();
            }
        }
    }

    private void openExternal(Uri uri) {
        if (focusLocked) return;
        String scheme = uri.getScheme();
        if (!"https".equals(scheme) && !"mailto".equals(scheme) && !"tel".equals(scheme)) return;
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException unavailable) {
            Toast.makeText(this, "Lidhja nuk mund të hapet.", Toast.LENGTH_SHORT).show();
        }
    }

    @SuppressWarnings("deprecation")
    private void hideFullscreenVideo() {
        if (fullscreenView == null) return;
        frame.removeView(fullscreenView);
        fullscreenView = null;
        WebChromeClient.CustomViewCallback callback = fullscreenCallback;
        fullscreenCallback = null;
        page.setVisibility(View.VISIBLE);
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_DEFAULT);
                controller.show(WindowInsets.Type.systemBars());
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(LEGACY_LAYOUT_FLAGS);
        }
        updateSystemAppearance();
        frame.requestApplyInsets();
        if (callback != null) callback.onCustomViewHidden();
    }

    private void navigateBack() {
        if (fullscreenView != null) { hideFullscreenVideo(); return; }
        if (focusLocked) return;
        if (page.canGoBack()) page.goBack();
        else finish();
    }

    @Override
    public void onBackPressed() {
        navigateBack();
    }

    @Override
    protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == FILE_PICKER) {
            finishFilePicker(WebChromeClient.FileChooserParams.parseResult(result, data));
        }
    }

    private void finishFilePicker(Uri[] files) {
        if (fileResult != null) {
            fileResult.onReceiveValue(files);
            fileResult = null;
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle state) {
        page.saveState(state);
        state.putBoolean(FOCUS_LOCKED, focusLocked);
        state.putBoolean(AWAITING_ALARM_SETTINGS, awaitingAlarmSettings);
        state.putString(DemoNotifications.OPEN_ITEM, pendingNotificationId);
        state.putString(DemoNotifications.OPEN_SCOPE, pendingNotificationScope);
        super.onSaveInstanceState(state);
    }

    @Override
    protected void onDestroy() {
        hideFullscreenVideo();
        closePagePort();
        finishFilePicker(null);
        frame.removeView(page);
        page.destroy();
        super.onDestroy();
    }
}
