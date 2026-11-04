# Fakulteti Online

Aplikacion akademik statik për studentë, i ndërtuar me HTML, React dhe JavaScript.

## Skedarët e publikimit

- `index.html`: aplikacioni kryesor për faqen publike, identik me versionin lokal.
- `fakulteti-online.html`: kopja me emrin origjinal të aplikacionit.
- `assets/`: stilet, modulet, fotografitë, logot dhe moduli i trurit 3D.

Ngarko përmbajtjen e paketës në repository, jo vetëm skedarin HTML. Ruaje dosjen `assets` pranë HTML-së dhe mos ia ndrysho strukturën.

Faqja kryesore hap `index.html`. Edhe adresa që mbaron me `/fakulteti-online.html` hap të njëjtin aplikacion.

Bibliotekat e jashtme dhe disa integrime kërkojnë internet. Të dhënat personale dhe dokumentet e përdoruesit ruhen në shfletues; kjo paketë nuk eksporton të dhënat e shfletuesit dhe përdor një shërbim publik të veçantë vetëm për kërkimin e emrit në ASK. Shih `server/ask-name-validator/README.md`.

Pas publikimit, testo ngarkimin e materialeve, videot dhe transferimin mes pajisjeve në adresën publike.

## Modeli 3D

Burimi, atribuimi dhe licencat dokumentohen në `assets/brain/README.md`, `assets/brain/model-manifest.json` dhe `assets/brain/THREE-LICENSE.txt`.


## Artikujt dhe provimet nga arkiva

Përmbajtja vendoset te `assets/editorial-content.js`. Lista `articles` pranon artikuj të publikuar me titull, përmbledhje, paragrafë dhe fotografi; skema dokumentohet në skedar. Artikujt me fotografi shfaqen edhe si stories te Kreu. Përfshihet një artikull shembull për kontrollin e punimit para dorëzimit.

Lista `archiveExams` lidh ID-në ekzistuese të lëndës me pyetjet e provimit. Derisa të vendosen pyetjet, zgjedhja e lëndës është e mundshme dhe provimi shfaqet “Në përgatitje”. Nuk përzihen pyetje nga lëndë të tjera.
