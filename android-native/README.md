# Fakulteti Android wrapper

Version: 1.0.6-preview (versionCode 7). Package: io.github.grenthoxha.fakultetionline.

The APK loads the published GitHub Pages app. An upgrade refreshes WebView resources once, without clearing local accounts or Web Storage. YouTube uses its own controls; fullscreen opens through WebChromeClient and returns with Back. Rotation keeps the current player.

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
