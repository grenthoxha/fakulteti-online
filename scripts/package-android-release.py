"""Package only public Android sources and checksums; signing material is never included."""
from pathlib import Path
import hashlib,zipfile
root=Path(__file__).resolve().parents[1]
source=root/'android-native';output=source/'build';apk=output/'Fakulteti-Online.apk'
assert apk.is_file(),'Build the APK first.'
files=[source/'AndroidManifest.xml',source/'build.ps1',source/'README.md']
files += sorted((source/'src').rglob('*.java'))
files += sorted(p for p in (source/'res').rglob('*') if p.is_file())
archive=output/'Fakulteti-Android-source.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for path in files:
        assert '.signing' not in path.parts and 'build' not in path.relative_to(source).parts
        z.write(path,path.relative_to(root).as_posix())
checks=output/'SHA256SUMS.txt'
checks.write_text(''.join(hashlib.sha256(p.read_bytes()).hexdigest()+'  '+p.name+'\n' for p in [apk,archive]),encoding='utf-8')
print(f'Packaged {len(files)} public Android source files; APK and source checksums saved.')
