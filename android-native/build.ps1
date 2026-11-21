param(
    [Parameter(Mandatory)] [string] $JavaHome,
    [Parameter(Mandatory)] [string] $Platform,
    [Parameter(Mandatory)] [string] $BuildTools
)

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true
$env:JAVA_HOME = (Resolve-Path -LiteralPath $JavaHome).Path
$androidJar = (Resolve-Path -LiteralPath (Join-Path $Platform 'android.jar')).Path
$BuildTools = (Resolve-Path -LiteralPath $BuildTools).Path

$outputDir = Join-Path $PSScriptRoot 'build'
$workDir = Join-Path $outputDir ([Guid]::NewGuid().ToString('N'))
$classDir = Join-Path $workDir 'classes'
$resourceDir = Join-Path $workDir 'res'
$iconDir = Join-Path $resourceDir 'mipmap-xxxhdpi'
$signingDir = Join-Path $PSScriptRoot '.signing'
New-Item -ItemType Directory -Path $classDir, $iconDir, $signingDir -Force | Out-Null
Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'res') -Directory | Copy-Item -Destination $resourceDir -Recurse
Copy-Item -LiteralPath (Join-Path $PSScriptRoot '../assets/fakulteti-online-logo-192.png') -Destination (Join-Path $iconDir 'ic_launcher.png')

$compiledResources = Join-Path $workDir 'resources.zip'
$unsignedApk = Join-Path $workDir 'unsigned.apk'
$alignedApk = Join-Path $workDir 'aligned.apk'
$classJar = Join-Path $workDir 'classes.jar'
$finalApk = Join-Path $outputDir 'Fakulteti-Online.apk'
$keyStore = Join-Path $signingDir 'preview.keystore'

& (Join-Path $BuildTools 'aapt2.exe') compile --dir $resourceDir -o $compiledResources
& (Join-Path $BuildTools 'aapt2.exe') link -I $androidJar --manifest (Join-Path $PSScriptRoot 'AndroidManifest.xml') --java $workDir -o $unsignedApk $compiledResources
$sources = @(Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'src') -Recurse -File -Filter '*.java' | Select-Object -ExpandProperty FullName)
$resourceIds = Join-Path $workDir 'io/github/grenthoxha/fakultetionline/R.java'
& (Join-Path $env:JAVA_HOME 'bin/javac.exe') --release 17 -encoding UTF-8 -classpath $androidJar -d $classDir @sources $resourceIds
& (Join-Path $env:JAVA_HOME 'bin/jar.exe') "-J-Djava.io.tmpdir=$workDir" cf $classJar -C $classDir .
& (Join-Path $BuildTools 'd8.bat') --min-api 29 --lib $androidJar --output $workDir $classJar
& (Join-Path $env:JAVA_HOME 'bin/jar.exe') "-J-Djava.io.tmpdir=$workDir" uf $unsignedApk -C $workDir classes.dex
& (Join-Path $BuildTools 'zipalign.exe') -f 4 $unsignedApk $alignedApk

if (!(Test-Path -LiteralPath $keyStore)) {
    & (Join-Path $env:JAVA_HOME 'bin/keytool.exe') -genkeypair -noprompt -keystore $keyStore -storetype JKS -storepass android -keypass android -alias preview -keyalg RSA -keysize 2048 -validity 3650 -dname 'CN=Fakulteti Online Preview'
}
& (Join-Path $BuildTools 'apksigner.bat') sign --ks $keyStore --ks-key-alias preview --ks-pass pass:android --key-pass pass:android --out $finalApk $alignedApk
& (Join-Path $BuildTools 'apksigner.bat') verify --verbose $finalApk
& (Join-Path $BuildTools 'zipalign.exe') -c 4 $finalApk
Get-Item -LiteralPath $finalApk
