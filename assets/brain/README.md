# Truri 3D — Biopsikologji, faza 1

Modul i izoluar për `up_psi_02_03`. Hyrja është skeda “Truri 3D” brenda lëndës. Ngarkohet vetëm kur hapet kjo skedë. Nuk ndryshon katalogun, kapitujt, regjistrimin, progresin ose navigimin global.

## Modeli dhe licenca

**Brain for Blender**, nga **Anderson Winkler**, [Brainder](https://brainder.org/research/brain-for-blender/). Modelet janë nën [Creative Commons Attribution-ShareAlike 3.0 Unported](https://creativecommons.org/licenses/by-sa/3.0/). Edhe modeli i ripaketuar `brain-model.js` dhe pamja e tij `brain-preview.png` shpërndahen nën këtë licencë. Nuk nënkuptohet miratim i aplikacionit nga autori.

Modeli është rindërtuar me FreeSurfer 5.2.0 nga MRI e një individi, e përshkruar në faqen e autorit. Përdoren hemisferat piale, sipërfaqet kortikale të cerebelumit dhe trungu. Strukturat e thella nuk shfaqen në këtë fazë. Rrjeta e cerebelumit/trungut ka më pak hollësi se ajo e hemisferave; modeli nuk pretendon të paraqesë të gjitha foliet cerebelare. Variacionet ndërmjet njerëzve nuk përfaqësohen nga një model i vetëm.

Ndryshime: paketim i OBJ si pozicione Float32 dhe indekse Uint32, kompresim gzip pa humbje, llogaritje e normaleve për ndriçim dhe ngjyra ilustruese. Asnjë trekëndësh nuk hiqet dhe gjeometria nuk lëmohet. Rrotullimi RAS → Y-up është `(x,y,z) → (x,z,-y)`; anatomia nuk pasqyrohet. Origjina zhvendoset vetëm për të qendruar modelin në pamje.

Origjinalet:

- [Hemisferat](https://s3.us-east-2.amazonaws.com/brainder/software/brain4blender/smallfiles/pial_Full_obj.tar.bz2)
- [Strukturat subkortikale](https://s3.us-east-2.amazonaws.com/brainder/software/brain4blender/smallfiles/subcortical_obj.tar.bz2)

`model-manifest.json` dokumenton emrat origjinalë, numrin e kulmeve/trekëndëshave, kufijtë dhe SHA-256 të çdo OBJ-je. Burimi anatomik: [sistemet e koordinatave të FreeSurfer](https://surfer.nmr.mgh.harvard.edu/fswiki/CoordinateSystems).

## Ndërtimi

1. Shkarko dy arkivat e mësipërme në `.build/` dhe nxirr `pial_Full_obj/` dhe `subcortical_obj/` aty.
2. Ekzekuto `npm install`, pastaj `npm run build` në këtë dosje. Versionet janë fikse në `package.json`.
3. Shpërndaj `brain-viewer.js`, `brain-model.js`, `brain-preview.png`, `README.md`, `model-manifest.json` dhe `THREE-LICENSE.txt` bashkë me app-in.

Three.js/OrbitControls 0.180.0 (MIT, shih `THREE-LICENSE.txt`) paketohet lokalisht. ESBuild 0.25.10 përdoret vetëm gjatë ndërtimit. React merret nga app-i ekzistues. Shfletuesi ngarkon modele përmes një skripti lokal që të funksionojnë edhe kur HTML-ja hapet me `file://`; nuk kërkohet server lokal ose ndryshim i politikave të shfletuesit.

“Pamje e lehtë” ul rezolucionin dhe heq hijet, por ruan të gjithë gjeometrinë. Skena vizatohet vetëm pas ndërveprimit/rimadhësimit. Në largim lirohen gjeometria, materialet, hijet, konteksti grafik, vëzhguesit dhe dëgjuesit. Pamja statike shërben kur WebGL2 nuk hapet.

Faza 1 përfshin rrotullim, zoom, zhvendosje, pamje orientuese dhe rikthim. Përzgjedhja anatomike, strukturat e thella, mësimet dhe kuizet kërkojnë miratimin e fazave të ardhshme.
