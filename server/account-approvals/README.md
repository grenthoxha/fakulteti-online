# Fakulteti — approval metadata only

This service stores the registration name, email, requested role, public device
key, approval state and per-user visible sections/landing page. Passwords,
recovery codes, private device keys, PDFs, notes, messages, grades, progress and
study materials never leave the local app through this service.

Every request is signed with an account-specific P-256 key. Timestamp bounds
and one-use nonces prevent replay. Public enrolment cannot assign privileges.
The local email `grent@gmail.com` gains approval rights only after the verified
Site owner links that device using Sites' server-provided ChatGPT identity.
Knowing or registering the email alone cannot grant administrative access.
All list/update operations verify the linked administrator server-side.
`APPROVAL_OWNER_EMAIL` is a server-only Sites environment value. The verified
owner identity is not embedded in the public frontend or source mirror.

Applicants remain pending until approved. An approved offline device can use
its cached access to local data; current permissions are fetched on resume and
every 30 seconds while visible. These visibility controls govern this local
app and are not DRM for source files already on a user's own device.

Run tests with `node --test tests/approval-service.test.mjs`. Database schema
changes use the starter's Drizzle migrations, applied by Sites on deployment.
