# Fakulteti Online

Aplikacion akademik statik për studentë, i ndërtuar me HTML, React dhe JavaScript.

## Skedarët e publikimit

- `index.html`: aplikacioni kryesor për faqen publike, identik me versionin lokal.
- `fakulteti-online.html`: kopja me emrin origjinal të aplikacionit.
- `assets/`: stilet, modulet, fotografitë, logot dhe moduli i trurit 3D.

Ngarko përmbajtjen e paketës në repository, jo vetëm skedarin HTML. Ruaje dosjen `assets` pranë HTML-së dhe mos ia ndrysho strukturën.

Faqja kryesore hap `index.html`. Edhe adresa që mbaron me `/fakulteti-online.html` hap të njëjtin aplikacion.

Bibliotekat e jashtme dhe disa integrime kërkojnë internet. Të dhënat personale dhe dokumentet e përdoruesit ruhen në shfletues; kjo paketë nuk eksporton të dhënat e shfletuesit dhe nuk përfshin backend.

Pas publikimit, testo ngarkimin e materialeve, videot dhe transferimin mes pajisjeve në adresën publike.

## Modeli 3D

Burimi, atribuimi dhe licencat dokumentohen në `assets/brain/README.md`, `assets/brain/model-manifest.json` dhe `assets/brain/THREE-LICENSE.txt`.
