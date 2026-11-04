# ASK given-name lookup

This small Node.js service reads the same public endpoint used by [ASK NameSearch](https://ask.rks-gov.net/NameSearch). It is needed because that website does not allow the GitHub Pages frontend to read lookup responses directly across origins.

Run with Node.js 20 or later:

```sh
node server.cjs
node --test server.test.cjs
```

Deploy this directory to an HTTPS Node.js host and use its `/api/ask-name` endpoint from the frontend. GitHub Pages can store this source, but cannot run the service.

`PORT` defaults to `8787`. `ALLOWED_ORIGINS` defaults to `https://grenthoxha.github.io,null`; `null` supports the app opened from a local HTML file. It does not require cookies or an API key.

The request takes only `name`, for example `/api/ask-name?name=Arta`. The response distinguishes `exists: false` (ASK returned a zero count) from `ASK_UNAVAILABLE` (the lookup could not be completed). Results are cached in memory for one hour. Request names are not written to logs.

Surnames remain a local check against the 100 ASK surnames already in the frontend. No surname, full-name pair or identity document is sent to this endpoint. A name match is not identity verification or account approval.

The frontend is not connected to this service until its deployed HTTPS address is provided.
