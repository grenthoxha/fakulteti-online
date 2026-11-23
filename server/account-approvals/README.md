# Fakulteti — accounts, profiles and approvals

Cloudflare D1 stores unique normalized email accounts, password hashes, recovery-code hashes, profile fields, signed device bindings, approvals and an administrative activity log. Tasks, notes, messages, grades, learning progress, PDFs and private device keys remain on their device. No learning-data keys are accepted by the profile API.

Passwords travel only over HTTPS and are hashed server-side with scrypt (N=32768, r=8, p=3, random 16-byte salt). Neither passwords nor recovery codes are stored in plaintext. The recovery code replaces the password and revokes existing device bindings. Email verification and email-delivered password reset are not configured; the recovery code must be kept by the user.

Authentication enrolls an account-specific P-256 public key after the password verifies. Other requests require its signature, a timestamp and a one-use nonce. Local storage is not trusted for administrator privileges. Knowing or registering `grent@gmail.com` grants no rights: its initial migration requires a device linked by the verified Sites owner. Later password-authenticated devices inherit that canonical account's administrator privileges. Existing linked owner devices remain valid.

New accounts stay pending until Grent approves them. The administrator can search accounts, inspect account/profile and last-login information, approve/reject/suspend, select visible sections and set a landing page. The bounded activity log records registrations, logins, recovery and access decisions; credentials are never logged. Suspensions and permission changes apply to every bound device of that account.

Legacy accounts are not silently uploaded: from their original device, open **Profili → Cilësimet → Llogaria dhe të dhënat → Lidh llogarinë online** and enter the current password. Signing in on that original device also offers the same automatic migration after local password verification. Existing local account IDs/namespaces and original recovery codes are preserved. A new device cannot claim a reserved legacy email without its original signed device proof. After the first successful connection, use the same email/password on other devices.

Profile changes use optimistic versions. If two devices edit the profile, local pending edits are retained and the account screen offers an explicit retry rather than silently overwriting them. Active approved local work can continue with the cached approval during a service outage; online admin actions always require server authorization.

The existing Android APK loads the live GitHub Pages app, so these web/database changes also apply after reopening that APK. There is no need to uninstall it or clear its data.

Tests:

```sh
node --test tests/cloud-accounts.test.mjs
```

The full app checkout also provides `node --test tests/cloud-accounts.mjs` for browser-module integration and local-data preservation. Drizzle migrations are append-only and applied by Sites during deployment. `.openai/hosting.json` retains D1 `DB`, with no R2 file upload binding.
