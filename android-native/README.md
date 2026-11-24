# Fakulteti Android wrapper

Version: 1.0.9-preview (versionCode 10). Package: io.github.grenthoxha.fakultetionline.

The APK loads the published GitHub Pages app. An upgrade refreshes WebView resources once, without clearing local accounts or Web Storage. YouTube uses its own controls; fullscreen opens through WebChromeClient and returns with Back. Rotation keeps the current player.

Three Android home-screen widgets are available: next lecture, free classrooms and Pomodoro. Open Profile → Settings → Home screen widgets, or hold a blank area on the launcher and choose Widgets → Fakulteti. The Android launcher confirms placement; these are home-screen widgets, not lock-screen widgets.

Widgets use a private local snapshot of the active approved account. Course sessions follow the selected programme, and room windows include the same replacements as the app. Room availability is recalculated from the saved timetable; the refresh button opens the app and requests a source refresh. After eight hours without a successful source check the widget asks for a refresh instead of claiming current availability. No separate background network service is added.

Widgets provide compact, normal and expanded RemoteViews for Android 12+ and size-aware fallback on Android 10/11. Minimum resize widths are 150dp; small cards hide secondary headings, truncate long labels and keep their action separate from the text.

Pomodoro uses timestamp deadlines and the system chronometer while running. Focus sessions lead to a short break, with a long break after the configured cadence (default four). The goal stops after the final break. Automatic breaks and automatic focus are independent; automatic focus is off by default for new settings. A delayed wake advances one phase and pauses instead of inventing work sessions. Completion IDs are stable and acknowledged only after history is saved locally.

Android advances the same timer when the web page is in the background, including when no launcher widget is placed. Native notifications are optional and follow Android's notification permission, sound and vibration settings. Enabling them offers the exact-alarm setting for on-time background reminders. Without that grant, Android may defer the boundary notification. Widget progress refreshes do not wake a sleeping phone. Sign-out, account switching and approval suspension clear private widget content.

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
node tests/pomodoro.cjs
node tests/android-widgets.cjs
# WIDGET_JSON_JAR points to org.json:json:20250517 from Maven Central (test-only).
python tests/native-widgets.py
```

Run these checks from the full repository checkout. The widget test exercises production snapshot validation, responsive rendering, phase transitions and Java/JavaScript timer parity with JVM doubles. Real Samsung launcher placement and physical-device behaviour are separate checks.

## Academic reminders

Version 1.0.9 adds private local alarms for real exams, deadlines, selected timetable sessions and task reminders. In the bell panel choose **Aktivizo kujtesat**, grant Android notification permission, and optionally allow **Alarmet dhe kujtesat** for precise delivery. Exam reminders use the saved date/time (one day and one hour ahead); a date without an exam time uses 09:00 as the reminder time and explicitly says no exam time was supplied. Lessons default to 15 minutes ahead. Tasks follow their own chosen reminder, date, recurrence and completion status.

The phone stores the approved account's queue, restores it after reboot/update and cancels/replaces alarms when the app supplies edited/deleted records. Sign-out, account switching and approval suspension clear the queue on the next app check. A timestamp fingerprint prevents duplicate alerts and lets a changed exam date create a new reminder. Notification taps open the matching section. The app logo and private lock-screen visibility are used.

Exams can be planned up to one year ahead; timetable and recurring task snapshots cover 14 days and refresh when the app is opened. At most 60 upcoming reminders are retained, reserving slots for academic deadlines. Timetable notifications use the last locally saved official schedule; receiving later official changes requires reopening/syncing the app. Without exact-alarm permission Android may delay alerts. Force-stopping the app or disabling notifications can suppress delivery until it is reopened.

Browser notifications use the service worker while the app page is running; no server Web Push or online message storage is introduced. The separate Flutter preview also schedules local reminders and the active Pomodoro phase through the native notification plugin. Its iOS build still needs Apple signing for installation.

```sh
node tests/notifications.cjs
python tests/native-reminders.py
```

The JVM reminder test requires JAVA_HOME and the same local org.json jar used by the widget tests. It executes production receiver code with Android doubles. No physical Samsung/iPhone delivery test was performed.
