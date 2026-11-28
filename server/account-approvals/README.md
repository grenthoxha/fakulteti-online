# Fakulteti — accounts, profiles and approvals

Cloudflare D1 stores unique normalized email accounts, password hashes, recovery-code hashes, profile fields, signed device bindings, approvals and an administrative activity log. Tasks, notes, messages, grades, learning progress, PDFs and private device keys remain on their device. No learning-data keys are accepted by the profile API.

Passwords travel only over HTTPS and are hashed server-side with scrypt (N=32768, r=8, p=3, random 16-byte salt). Neither passwords nor recovery codes are stored in plaintext. The recovery code replaces the password and revokes existing device bindings. Email verification and email-delivered password reset are not configured; the recovery code must be kept by the user.

Authentication enrolls an account-specific P-256 public key after the password verifies. Other requests require its signature, a timestamp and a one-use nonce. Local storage is not trusted for administrator privileges. Knowing or registering `grent@gmail.com` grants no rights: its initial migration requires a device linked by the verified Sites owner. Later password-authenticated devices inherit that canonical account's administrator privileges. Existing linked owner devices remain valid.

New accounts stay pending until Grent approves them. The administrator can search accounts, inspect account/profile and last-login information, approve/reject/suspend, select visible sections and set a landing page. The bounded activity log records registrations, logins, recovery and access decisions; credentials are never logged. Suspensions and permission changes apply to every bound device of that account.

Legacy accounts are not silently uploaded: from their original device, open **Profili → Cilësimet → Llogaria dhe të dhënat → Lidh llogarinë online** and enter the current password. Signing in on that original device also offers the same automatic migration after local password verification. Existing local account IDs/namespaces and original recovery codes are preserved. A new device cannot claim a reserved legacy email without its original signed device proof. After the first successful connection, use the same email/password on other devices.

Profile changes use optimistic versions. If two devices edit the profile, local pending edits are retained and the account screen offers an explicit retry rather than silently overwriting them. Active approved local work can continue with the cached approval during a service outage; online admin actions always require server authorization.

During approval the verified administrator assigns the faculty, Bachelor/Master programme, year and semester. The assignment and approval are saved together, guarded by both approval and profile versions; identity fields and device-local work are preserved. The approval form requires valid academic details for online applicants. An approved student without an assigned programme/year waits for the administrator instead of receiving an academic chooser; the app opens when profile synchronization supplies the assignment. Existing valid assignments do not need to be selected again. Legacy local-only accounts must first connect online. The admin list exposes only academic profile fields, never private study data. To refresh the allowed academic options after a curriculum change, run `node scripts/build-academic-catalog.cjs` from the full app checkout and deploy `lib/academic-catalog.json` with the service. Run `node --test tests/admin-academic.test.mjs` in this service checkout for authorization, assignment and concurrency checks.

The existing Android APK loads the live GitHub Pages app, so these web/database changes also apply after reopening that APK. There is no need to uninstall it or clear its data.

Tests:

```sh
node --test tests/cloud-accounts.test.mjs
```

The full app checkout also provides `node --test tests/cloud-accounts.mjs` for browser-module integration and local-data preservation. Drizzle migrations are append-only and applied by Sites during deployment. `.openai/hosting.json` retains D1 `DB`, with no R2 file upload binding.

## Administrator phone alerts

APK 1.0.10 uses a persisted Android JobScheduler check around every 15 minutes. The verified administrator enrolls the current signed device through `POST /api/admin/alerts`; `DELETE` revokes it. The service stores only a SHA-256 hash of its random 256-bit credential in `approval_settings`, bound to the canonical administrator, authenticated device, account revision and a 30-day expiry. The credential is renewed while the app is used. It permits only `GET /api/admin/alerts/pending`, which returns pending request IDs and a count, excluding duplicate login-device requests. Names, emails, profiles and signing keys are not returned. Every poll rechecks verified-owner binding, admin approval and device/session revision. The token cannot approve anyone or call signed administrative APIs. Password recovery, suspension and explicit revocation stop background access.

The APK keeps this limited credential in private preferences with Android backup disabled. Logout/account switching clears the job and posted alert. Notification permission is required; Android battery restrictions and force-stop can delay or prevent checks. Browser/Flutter builds do not receive this native background capability. This is periodic polling, not Firebase or server Web Push.

```sh
node --test tests/admin-alerts.test.mjs
```

## Public study-material reader

`lib/course-materials.mjs` serves only reviewed, content-addressed resources from `lib/course-materials-manifest.mjs`. The originals and native previews are stored inside ZIP_STORED course packages in the repository’s semester Releases. The manifest provides exact byte offsets, lengths and SHA-256 hashes. HTTP ranges are translated to the corresponding package range; a response that ignores or changes the requested range is rejected. CORS permits the public Pages app and its Android WebView. No account cookies or authorization are forwarded to GitHub; no database writes or arbitrary upstream URLs are accepted.

The deployed Sites Worker routes `/api/materials/` to `handleCourseMaterial(request)` before the existing account API handler. Keep all other routes and D1 bindings unchanged. The generated allowlist and reader must be deployed together with the public catalogues.

```sh
node --test tests/course-materials.test.mjs
```
