# Fakulteti Online

## Instalo në Android

### [⬇️ Shkarko Fakulteti — APK 1.0.9](https://github.com/grenthoxha/fakulteti-online/releases/download/v1.0.9-android-preview/Fakulteti-Online.apk)

Lidhja më sipër shkarkon direkt APK-në, pa kërkuar te dosjet e projektit.

1. Shkarkoje në telefon dhe hape skedarin **Fakulteti-Online.apk** për instalim.
2. Nëse e ke app-in, instaloje si **përditësim**, pa e çinstaluar. Të dhënat lokale ruhen.
3. Për widget-et: **Profili → ⚙️ Cilësimet → Widget-et e telefonit**.

[Hape app-in në shfletues](https://grenthoxha.github.io/fakulteti-online/) · [Detajet e APK-së dhe versionit](https://github.com/grenthoxha/fakulteti-online/releases/tag/v1.0.9-android-preview)

## Llogaria online dhe databaza

Llogaritë, profilet dhe aprovimet ruhen në Cloudflare D1. Emaili është unik; hyrja me të njëjtin email/fjalëkalim funksionon në browser dhe APK. Shënimet, detyrat, notat, progresi dhe PDF-të mbeten lokale.

**Llogari e krijuar më herët:** nga pajisja fillestare, hape **Profili → Cilësimet → Llogaria dhe të dhënat → Lidh llogarinë online** dhe shkruaj fjalëkalimin aktual. Mjafton një herë; më pas mund të hysh nga pajisjet e tjera. Mos e çinstalo app-in ose fshi të dhënat lokale.

**Administrimi i Grentit:** **Profili → Cilësimet → Aprovimet dhe qasja**. Aty mund të shohësh kërkesat, profilet, hyrjen e fundit dhe aktivitetin; të aprovosh, refuzosh ose pezullosh; të caktosh pjesët dhe faqen fillestare të secilit përdorues. Vetëm llogaria e pronarit të verifikuar ka këto leje. Llogaritë e reja presin aprovimin.

Kodi i rikuperimit ruhet nga përdoruesi; dërgimi i emailit për verifikim/rikuperim nuk është konfiguruar. Detajet teknike dhe kufijtë: [databaza dhe llogaritë](server/account-approvals/README.md).

APK-ja 1.0.9 më sipër ngarkon app-in e përditësuar nga GitHub Pages. Ndryshimet e databazës merren pas rihapjes; nuk kërkohet instalim i pastër.

## Mesazhet lokale

Te **Mesazhet → +** mund të krijosh grup me logon e app-it si foto fillestare, ta ndryshosh foton dhe përshkrimin, të shtosh kontakte me emër/email e rol dhe të ruash mesazhe e foto në bisedë. Prek emrin e grupit për detajet dhe anëtarët. Fotot hapen veçmas; ndryshimi dhe fshirja e grupit bëhen nga detajet, me konfirmim para fshirjes.

Grupet, kontaktet, fotot, bisedat dhe draftet ruhen në IndexedDB, veçmas për çdo llogari në këtë pajisje/browser. Nuk dërgohen ftesa ose mesazhe te pajisje të tjera. Fshirja e të dhënave të browser-it ose çinstalimi mund t'i largojë; ato nuk përfshihen në backup-in e vjetër të localStorage.

## Projekti Flutter

[Repository i veçantë: fakulteti-flutter](https://github.com/grenthoxha/fakulteti-flutter). Fillimisht ruan app-in aktual brenda Flutter-it; kalimi i plotë në Dart vazhdon gradualisht. Është repository privat për testim, me kontrolle Android dhe iOS në GitHub Actions. APK-ja e qëndrueshme mbetet ajo në krye të kësaj faqeje.

## Kujtesat në telefon

Për provime, afate, orar dhe detyra instalo **APK 1.0.9** si përditësim mbi versionin ekzistues. Hape zilen → **Cilësimet e njoftimeve → Lejo njoftimet**. Kujtesat janë aktive si zgjedhje fillestare; ndalimi ose kategoritë që i ke ndryshuar vetë ruhen. Zgjidh kategoritë që dëshiron; për kohë më të saktë lejo edhe **Alarmet dhe kujtesat**. Pomodoro ka çelësin e vet të njoftimeve te cilësimet e kohëmatësit.

Kujtesat ruhen në telefon dhe mund të shfaqen kur APK-ja është në prapavijë. Provimet njoftohen një ditë dhe një orë përpara; orari pa orë të provimit përdor kujtesë në 09:00. Orari dhe detyrat e përsëritura rifreskohen për 14 ditët e ardhshme kur e hap app-in. Në browser kujtesat kontrollohen ndërsa faqja është e hapur; push nga serveri dhe mesazhe online nuk janë aktivizuar.

---

Aplikacion akademik statik për studentë, i ndërtuar me HTML, React dhe JavaScript.

## Skedarët e publikimit

- `index.html`: aplikacioni kryesor për faqen publike, identik me versionin lokal.
- `fakulteti-online.html`: kopja me emrin origjinal të aplikacionit.
- `assets/`: stilet, modulet, fotografitë, logot dhe moduli i trurit 3D.

Ngarko përmbajtjen e paketës në repository, jo vetëm skedarin HTML. Ruaje dosjen `assets` pranë HTML-së dhe mos ia ndrysho strukturën.

Faqja kryesore hap `index.html`. Edhe adresa që mbaron me `/fakulteti-online.html` hap të njëjtin aplikacion.

Bibliotekat e jashtme dhe disa integrime kërkojnë internet. Llogaritë, profilet dhe aprovimet përdorin databazën online; materialet e ngarkuara nga studenti dhe puna e tij mbeten lokale. Biblioteka e lëndëve hap materialet e publikuara në GitHub Releases drejtpërdrejt në lexuesin e app-it. Kërkimi i emrit në ASK përdor shërbimin e vet të veçantë. Shih `server/ask-name-validator/README.md`.

Pas publikimit, testo ngarkimin e materialeve, videot dhe transferimin mes pajisjeve në adresën publike.

## Modeli 3D

Burimi, atribuimi dhe licencat dokumentohen në `assets/brain/README.md`, `assets/brain/model-manifest.json` dhe `assets/brain/THREE-LICENSE.txt`.


## Artikujt dhe provimet nga arkiva

Përmbajtja vendoset te `assets/editorial-content.js`. Lista `articles` pranon artikuj të publikuar me titull, përmbledhje, paragrafë dhe fotografi; skema dokumentohet në skedar. Artikujt me fotografi shfaqen edhe si stories te Kreu. Përfshihet një artikull shembull për kontrollin e punimit para dorëzimit.

Lista `archiveExams` lidh ID-në ekzistuese të lëndës me pyetjet e provimit. Derisa të vendosen pyetjet, zgjedhja e lëndës është e mundshme dhe provimi shfaqet “Në përgatitje”. Nuk përzihen pyetje nga lëndë të tjera.

## Materialet e lëndëve brenda app-it

Biblioteka përfshin **1 335 materiale** të inventarit të 24 nëntorit 2026, në 33 lëndë të Psikologjisë dhe gjashtë semestra: 29 dosje kanë skedarë, katër janë bosh. Janë përjashtuar 11 skedarë teknikë `.DS_Store` dhe tri kopje të reklamës së verifikuar. Katalogu dhe lexuesi nuk hapin ndërfaqen e Drive-it.

Origjinalet dhe kopjet për lexim janë publikuar te [GitHub Releases](https://github.com/grenthoxha/fakulteti-online/releases), në paketa sipas lëndës. PDF-të, Word-i, slajdet dhe Excel-i lexohen brenda app-it; dokumentet Office kanë edhe kopje PDF. Fotot grupohen në galeri. Lexuesi ofron kalim faqeje, zmadhim, përshtatje, rrotullim dhe pamje teksti kur dokumenti përmban tekst. Faqja e fundit dhe materiali i hapur së fundi ruhen lokalisht, veçmas për çdo llogari. Origjinali mund të shkarkohet nga ikona përkatëse.

Skedarët SAV shfaqen si tabela, R si tekst, ndërsa raportet SPV shfaqin përmbajtjen e paketës; për analizat interaktive SPSS nevojitet programi përkatës. Origjinalet ruhen të pandryshuara. Një dokument i vjetër RTF që nuk konvertohej është përshtatur për lexim duke ruajtur të gjithë tekstin dhe figurat; origjinali mbetet i disponueshëm.

Materialet kërkojnë internet. Katalogu i lëndës dhe lexuesi PDF ngarkohen vetëm kur nevojiten. Shërbimi ekzistues i app-it ofron vetëm skedarët e miratuar, përmes pjesëve të verifikuara të paketave ZIP në Releases; app-i nuk shkarkon paketën e plotë për të hapur një material. Nuk përdoret proxy për URL arbitrare dhe ky shërbim nuk ndryshon databazën e llogarive. Kodet përkatëse gjenden te `server/account-approvals/lib/course-materials*.mjs`.

`assets/course-materials-index.js` lidh lëndët me katalogët te `assets/course-materials/`. Lexuesi është te `assets/course-material-reader.js`; PDF.js dhe licencat e tij ruhen te `assets/vendor/pdfjs/`. Biblioteka nuk krijon provime të planifikuara ose nota. Ndryshimet e ardhshme në dosjen burimore kërkojnë import dhe kontroll të ri.

Kontrollet: `node tests/course-materials.cjs`, `node tests/course-material-reader.cjs` dhe `node --test server/account-approvals/tests/course-materials.test.mjs`. Ato verifikojnë hartën e materialeve, përjashtimin e reklamës, hapjen native, ngarkimin sipas nevojës, ruajtjen sipas llogarisë, CORS dhe shërbimin e saktë të pjesëve të skedarit.

## Lëndët aktuale të Psikologjisë

Lista ndjek [programin e akredituar 2026–2029 të UP-së](https://uni-pr.edu/en/programs/fakulteti-filozofik/psikologji), kontrolluar më 24 nëntor 2026. Të 34 lëndët, semestrat dhe ECTS dokumentohen te `assets/psychology-programme-2026.json`. Lëndët e përbashkëta me programin e mëparshëm ruajnë ID-në, materialet dhe progresin; ndryshimi i semestrit nuk transferon materialin te lënda tjetër që zë pozicionin e vjetër. Katër lëndët e reja nuk trashëgojnë përmbajtje nga një lëndë tjetër. Katalogu ruan gjithashtu origjinalet e lëndëve që nuk janë më në program; ato mbeten në paketat Releases.

Për llogaritë ekzistuese, lista e zgjedhur ruhet dhe vetëm lëndët e reja obligative shtohen një herë. Nuk fshihen shënimet, progresi apo referencat e vjetra të ruajtura. Kontrolli: `node tests/psychology-programme.cjs`.
