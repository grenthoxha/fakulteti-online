# Fakulteti Android wrapper

Version: 1.0.7-preview (versionCode 8). Package: io.github.grenthoxha.fakultetionline.

The APK loads the published GitHub Pages app. An upgrade refreshes WebView resources once, without clearing local accounts or Web Storage. YouTube uses its own controls; fullscreen opens through WebChromeClient and returns with Back. Rotation keeps the current player.

Three Android home-screen widgets are available: next lecture, free classrooms and Pomodoro. Open Profile → Settings → Home screen widgets, or hold a blank area on the launcher and choose Widgets → Fakulteti. The Android launcher confirms placement; these are home-screen widgets, not lock-screen widgets.

Widgets use a private local snapshot of the active approved account. Course sessions follow the selected programme, and room windows include the same replacements as the app. Room availability is recalculated from the saved timetable; the refresh button opens the app and requests a source refresh. After eight hours without a successful source check the widget asks for a refresh instead of claiming current availability. No separate background network service is added.

Pomodoro uses the system chronometer while running. Pause/resume works from the widget without opening the app; the pending action is reconciled before the app advances a completed phase. Android may defer boundary refreshes while idle. An existing exact-alarm grant is reused when available; widget placement does not request extra permissions. Sign-out, account switching and approval suspension clear private widget content.

Build with JDK 17+ and Android SDK platform 35/build tools:

```powershell
./android-native/build.ps1 -JavaHome <JDK> -Platform <SDK-platform> -BuildTools <SDK-build-tools>
```

Install updates over the previous app signed with the same private keystore. The signing keystore is excluded from source and releases. Keep the original key locally to preserve upgrade compatibility.

Run the native lifecycle test with JAVA_HOME set:

```powershell
python tests/native-video-lifecycle.py
```

The native test uses the production method bodies with JVM doubles. Signing and Android API compatibility are also checked during the APK build; a physical-device playback test is separate.

Widget checks:

```powershell
node tests/android-widgets.cjs
# WIDGET_JSON_JAR points to org.json:json:20250517 from Maven Central (test-only).
python tests/native-widgets.py
```

The widget test exercises production snapshot validation, rendering actions and timer reconciliation with JVM doubles. Real Samsung launcher placement and physical-device behaviour are separate checks.
