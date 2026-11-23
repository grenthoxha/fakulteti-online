# Fakulteti Online

## Instalo në Android

### [⬇️ Shkarko Fakulteti — APK 1.0.8](https://github.com/grenthoxha/fakulteti-online/releases/download/v1.0.8-android-preview/Fakulteti-Online.apk)

Lidhja më sipër shkarkon direkt APK-në, pa kërkuar te dosjet e projektit.

1. Shkarkoje në telefon dhe hape skedarin **Fakulteti-Online.apk** për instalim.
2. Nëse e ke app-in, instaloje si **përditësim**, pa e çinstaluar. Të dhënat lokale ruhen.
3. Për widget-et: **Profili → ⚙️ Cilësimet → Widget-et e telefonit**.

[Hape app-in në shfletues](https://grenthoxha.github.io/fakulteti-online/) · [Detajet e APK-së dhe versionit](https://github.com/grenthoxha/fakulteti-online/releases/tag/v1.0.8-android-preview)

## Llogaria online dhe databaza

Llogaritë, profilet dhe aprovimet ruhen në Cloudflare D1. Emaili është unik; hyrja me të njëjtin email/fjalëkalim funksionon në browser dhe APK. Shënimet, detyrat, notat, progresi dhe PDF-të mbeten lokale.

**Llogari e krijuar më herët:** nga pajisja fillestare, hape **Profili → Cilësimet → Llogaria dhe të dhënat → Lidh llogarinë online** dhe shkruaj fjalëkalimin aktual. Mjafton një herë; më pas mund të hysh nga pajisjet e tjera. Mos e çinstalo app-in ose fshi të dhënat lokale.

**Administrimi i Grentit:** **Profili → Cilësimet → Aprovimet dhe qasja**. Aty mund të shohësh kërkesat, profilet, hyrjen e fundit dhe aktivitetin; të aprovosh, refuzosh ose pezullosh; të caktosh pjesët dhe faqen fillestare të secilit përdorues. Vetëm llogaria e pronarit të verifikuar ka këto leje. Llogaritë e reja presin aprovimin.

Kodi i rikuperimit ruhet nga përdoruesi; dërgimi i emailit për verifikim/rikuperim nuk është konfiguruar. Detajet teknike dhe kufijtë: [databaza dhe llogaritë](server/account-approvals/README.md).

APK-ja 1.0.8 më sipër ngarkon app-in e përditësuar nga GitHub Pages. Ndryshimet e databazës merren pas rihapjes; nuk kërkohet instalim i pastër.

## Projekti Flutter

[Repository i veçantë: fakulteti-flutter](https://github.com/grenthoxha/fakulteti-flutter). Fillimisht ruan app-in aktual brenda Flutter-it; kalimi i plotë në Dart vazhdon gradualisht. Është repository privat për testim, me kontrolle Android dhe iOS në GitHub Actions. APK-ja e qëndrueshme mbetet ajo në krye të kësaj faqeje.

---

Aplikacion akademik statik për studentë, i ndërtuar me HTML, React dhe JavaScript.

## Skedarët e publikimit

- `index.html`: aplikacioni kryesor për faqen publike, identik me versionin lokal.
- `fakulteti-online.html`: kopja me emrin origjinal të aplikacionit.
- `assets/`: stilet, modulet, fotografitë, logot dhe moduli i trurit 3D.

Ngarko përmbajtjen e paketës në repository, jo vetëm skedarin HTML. Ruaje dosjen `assets` pranë HTML-së dhe mos ia ndrysho strukturën.

Faqja kryesore hap `index.html`. Edhe adresa që mbaron me `/fakulteti-online.html` hap të njëjtin aplikacion.

Bibliotekat e jashtme dhe disa integrime kërkojnë internet. Llogaritë, profilet dhe aprovimet përdorin databazën online; materialet dhe puna e studentit mbeten lokale. Kërkimi i emrit në ASK përdor shërbimin e vet të veçantë. Shih `server/ask-name-validator/README.md`.

Pas publikimit, testo ngarkimin e materialeve, videot dhe transferimin mes pajisjeve në adresën publike.

## Modeli 3D

Burimi, atribuimi dhe licencat dokumentohen në `assets/brain/README.md`, `assets/brain/model-manifest.json` dhe `assets/brain/THREE-LICENSE.txt`.


## Artikujt dhe provimet nga arkiva

Përmbajtja vendoset te `assets/editorial-content.js`. Lista `articles` pranon artikuj të publikuar me titull, përmbledhje, paragrafë dhe fotografi; skema dokumentohet në skedar. Artikujt me fotografi shfaqen edhe si stories te Kreu. Përfshihet një artikull shembull për kontrollin e punimit para dorëzimit.

Lista `archiveExams` lidh ID-në ekzistuese të lëndës me pyetjet e provimit. Derisa të vendosen pyetjet, zgjedhja e lëndës është e mundshme dhe provimi shfaqet “Në përgatitje”. Nuk përzihen pyetje nga lëndë të tjera.
