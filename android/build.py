#!/usr/bin/env python3
"""Build the offline APK using Android SDK tools; no Gradle or npm dependencies."""
import argparse, hashlib, json, os, pathlib, secrets, shutil, subprocess, zipfile

HERE=pathlib.Path(__file__).resolve().parent
ROOT=HERE.parent

def run(args):
    subprocess.run([str(x) for x in args],check=True)

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--sdk-root',type=pathlib.Path,required=True)
    parser.add_argument('--signing-dir',type=pathlib.Path,default=HERE/'signing')
    args=parser.parse_args()
    sdk=args.sdk_root.resolve()
    aapt=next(sdk.rglob('aapt2'))
    tools=aapt.parent
    jar=sdk/'android-35/android.jar'
    if not jar.is_file(): jar=next(sdk.glob('platforms/android-35/android.jar'))
    for tool in ['aapt2','d8','zipalign','apksigner']:
        (tools/tool).chmod(0o755)
    build=HERE/'build'
    if build.exists():shutil.rmtree(build)
    for d in ['gen','classes','dex','assets/www']: (build/d).mkdir(parents=True)
    assets=build/'assets/www'
    shutil.copytree(ROOT/'public',assets,dirs_exist_ok=True)
    # Dependencies are committed and available without networking.
    downloads = assets/'downloads'
    if downloads.exists(): shutil.rmtree(downloads)
    shutil.copyfile(HERE/'native.js',assets/'native.js')
    html=assets/'index.html'
    html.write_text(html.read_text().replace('<script>var exports', '<script src="native.js"></script>\n<script>var exports'))
    (assets/'android-build.json').write_text(json.dumps({'version':'1.0.0','source_commit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'offline':True},indent=2))
    run([tools/'aapt2','compile','--dir',HERE/'res','-o',build/'resources.zip'])
    base=build/'unsigned.apk'
    run([tools/'aapt2','link','-I',jar,'--manifest',HERE/'AndroidManifest.xml','--min-sdk-version','26','--target-sdk-version','35','--auto-add-overlay','-R',build/'resources.zip','-A',build/'assets','--java',build/'gen','-o',base])
    sources=list((HERE/'src').rglob('*.java'))+list((build/'gen').rglob('*.java'))
    run(['java','com.sun.tools.javac.Main','--release','8','-classpath',jar,'-encoding','UTF-8','-d',build/'classes',*sources])
    classes=list((build/'classes').rglob('*.class'))
    run([tools/'d8','--lib',jar,'--min-api','26','--output',build/'dex',*classes])
    with zipfile.ZipFile(base,'a',compression=zipfile.ZIP_DEFLATED) as archive:
        archive.write(build/'dex/classes.dex','classes.dex')
    aligned=build/'aligned.apk'
    run([tools/'zipalign','-f','-p','4',base,aligned])
    signing=args.signing_dir.resolve();signing.mkdir(mode=0o700,parents=True,exist_ok=True)
    key=signing/'natal-release.keystore';password=signing/'password.txt'
    if not key.exists():
        password.write_text(secrets.token_urlsafe(32));password.chmod(0o600)
        run(['keytool','-genkeypair','-keystore',key,'-storetype','PKCS12','-storepass:file',password,'-keypass:file',password,'-alias','natal-release','-keyalg','RSA','-keysize','3072','-validity','10000','-dname','CN=Kipin Natal, O=Kipin, C=RU'])
        key.chmod(0o600)
    out=HERE/'dist';out.mkdir(exist_ok=True)
    apk=out/'Natal-Chart-1.0.0.apk'
    run([tools/'apksigner','sign','--ks',key,'--ks-key-alias','natal-release','--ks-pass','file:'+str(password),'--out',apk,aligned])
    run([tools/'apksigner','verify','--verbose',apk])
    run([tools/'zipalign','-c','-p','4',apk])
    run([tools/'aapt2','dump','badging',apk])
    digest=hashlib.sha256(apk.read_bytes()).hexdigest()
    (out/'SHA256SUMS').write_text(digest+'  '+apk.name+'\n')
    # Keep this private backup: subsequent APKs must use the same signing identity.
    backup=out/'Natal-Chart-signing-backup.zip'
    with zipfile.ZipFile(backup,'w',compression=zipfile.ZIP_DEFLATED) as archive:
        archive.write(key,key.name);archive.write(password,password.name)
        archive.writestr('README.txt','Private signing key for ru.kipin.natal. Keep private. Alias: natal-release. Password: password.txt. Supply --signing-dir with these files for update builds. Never publish this archive in GitHub.\n')
    backup.chmod(0o600)
    print('APK:',apk)
    print('SHA256:',digest)

if __name__=='__main__':main()
