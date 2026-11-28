import os,subprocess,re
from pathlib import Path
root=Path(__file__).resolve().parents[1]
s=(root/'android-native/src/io/github/grenthoxha/fakultetionline/MainActivity.java').read_text(encoding='utf8')
def method(signature):
 a=s.index(signature);brace=s.index('{',a);depth=1;i=brace+1
 while depth:
  if s[i]=='{':depth+=1
  elif s[i]=='}':depth-=1
  i+=1
 return s[a:i]
show=method('public void onShowCustomView(')
hide=method('private void hideFullscreenVideo(')
back=method('private void navigateBack(')
a=s.index('        // Refresh web resources once per APK upgrade;');b=s.index('\n    }',a)
init='void initializePage(Bundle state) {\n'+s[a:b]+'\n}'
source=r'''
import java.util.*;
public class NativeVideoTest {
 static int checks;static void check(boolean v){if(!v)throw new AssertionError("check "+checks);checks++;}
 static class Build{static class VERSION{static int SDK_INT=35;}}
 static class View{static final int GONE=8,VISIBLE=0,SYSTEM_UI_FLAG_FULLSCREEN=4,SYSTEM_UI_FLAG_HIDE_NAVIGATION=2,SYSTEM_UI_FLAG_IMMERSIVE_STICKY=4096;int visibility=VISIBLE,flags;void setVisibility(int v){visibility=v;}void setSystemUiVisibility(int f){flags=f;}}
 static class FrameLayout extends View{List<View> children=new ArrayList<>();int insets;static class LayoutParams{static final int MATCH_PARENT=-1;LayoutParams(int a,int b){}}void addView(View v,LayoutParams p){children.add(v);}void removeView(View v){children.remove(v);}void requestApplyInsets(){insets++;}}
 static class WindowInsets{static class Type{static int systemBars(){return 3;}}}
 static class WindowInsetsController{static final int BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE=2,BEHAVIOR_DEFAULT=1;boolean hidden;void setSystemBarsBehavior(int b){}void hide(int t){hidden=true;}void show(int t){hidden=false;}}
 static class Window{View decor=new View();WindowInsetsController controller=new WindowInsetsController();View getDecorView(){return decor;}WindowInsetsController getInsetsController(){return controller;}}
 static class WebChromeClient{interface CustomViewCallback{void onCustomViewHidden();}}
 interface CustomViewCallback extends WebChromeClient.CustomViewCallback{}
 static class Callback implements CustomViewCallback{int count;public void onCustomViewHidden(){count++;}}
 static class Bundle{}
 static class Page extends View{boolean cacheCleared,restoreOk=true,history;int loads,restores,backs;String url;Map<String,String> headers;void clearCache(boolean disk){cacheCleared=disk;}Object restoreState(Bundle b){restores++;return restoreOk?new Object():null;}void loadUrl(String u,Map<String,String> h){loads++;url=u;headers=h;}boolean canGoBack(){return history;}void goBack(){backs++;}}
 static class Preferences{int revision;int getInt(String key,int fallback){return revision;}Preferences edit(){return this;}Preferences putInt(String k,int value){revision=value;return this;}void apply(){}}
 static class Host{
 static final int WEB_REVISION=9,MODE_PRIVATE=0,LEGACY_LAYOUT_FLAGS=1792;
 static final String START_URL="https://grenthoxha.github.io/fakulteti-online/?source=homescreen&app=1.0.8";
 View fullscreenView;WebChromeClient.CustomViewCallback fullscreenCallback;Page page=new Page();FrameLayout frame=new FrameLayout();Window window=new Window();Preferences prefs=new Preferences();boolean focusLocked,finished;String appearance="light";
 Preferences getPreferences(int mode){return prefs;}Window getWindow(){return window;}void setAppearance(String a){appearance=a;}void updateSystemAppearance(){appearance="light";}void finish(){finished=true;}
 __METHODS__
 }
 public static void main(String[] args){
 for(int sdk:new int[]{29,35}){
 Build.VERSION.SDK_INT=sdk;Host h=new Host();View video=new View();Callback callback=new Callback();
 h.onShowCustomView(video,callback);check(h.fullscreenView==video&&h.frame.children.size()==1);check(h.page.visibility==View.GONE);check(h.appearance.equals("media"));
 if(sdk>=30)check(h.window.controller.hidden);else check((h.window.decor.flags&View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY)!=0);
 Callback other=new Callback();h.onShowCustomView(new View(),other);check(other.count==1&&h.frame.children.size()==1);
 h.navigateBack();check(!h.finished&&h.fullscreenView==null&&h.frame.children.isEmpty());check(callback.count==1&&h.page.visibility==View.VISIBLE);check(h.appearance.equals("light"));
 if(sdk>=30)check(!h.window.controller.hidden);h.hideFullscreenVideo();check(callback.count==1);
 h.focusLocked=true;h.navigateBack();check(!h.finished);h.focusLocked=false;h.page.history=true;h.navigateBack();check(h.page.backs==1);h.page.history=false;h.navigateBack();check(h.finished);
 }
 Host h=new Host();h.initializePage(new Bundle());check(h.page.cacheCleared&&h.page.restores==0&&h.page.loads==1);check(h.prefs.revision==9&&h.page.headers.get("Cache-Control").equals("no-cache"));check(h.page.url.contains("app=1.0.8"));
 h=new Host();h.prefs.revision=9;h.initializePage(new Bundle());check(!h.page.cacheCleared&&h.page.restores==1&&h.page.loads==0);
 h=new Host();h.prefs.revision=9;h.page.restoreOk=false;h.initializePage(new Bundle());check(h.page.restores==1&&h.page.loads==1);
 h=new Host();h.prefs.revision=9;h.initializePage(null);check(!h.page.cacheCleared&&h.page.loads==1);
 System.out.println("PASS: "+checks+" native video lifecycle and upgrade refresh checks");
 }
}
'''.replace('__METHODS__','\n'.join([show,hide,back,init]))
java_home=Path(os.environ['JAVA_HOME'])
folder=root/'.build/native-video-tests'
folder.mkdir(parents=True,exist_ok=True)
if True:
 p=Path(folder)/'NativeVideoTest.java';p.write_text(source,encoding='utf8')
 subprocess.run([str(java_home/'bin/javac.exe'),'--release','17',str(p)],check=True)
 subprocess.run([str(java_home/'bin/java.exe'),'-cp',str(folder),'NativeVideoTest'],check=True)
manifest=(root/'android-native/AndroidManifest.xml').read_text()
code=re.search(r'android:versionCode="(\d+)"',manifest).group(1)
version=re.search(r'android:versionName="([^"-]+)-preview"',manifest).group(1)
assert 'private static final int WEB_REVISION = '+code+';' in s
assert '&app='+version+'"' in s
assert 'orientation|screenSize|keyboardHidden' in manifest
assert 'WebStorage.deleteAllData' not in s and 'clearApplicationUserData' not in s
print('PASS: native version, rotation preservation and local data safeguards')
