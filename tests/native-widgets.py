"""Exercise production widget state/render methods with JVM Android doubles and org.json.
Set JAVA_HOME and WIDGET_JSON_JAR (Maven Central org.json) before running.
"""
import os,subprocess,xml.etree.ElementTree as ET
from pathlib import Path
root=Path(__file__).resolve().parents[1]
source=(root/'android-native/src/io/github/grenthoxha/fakultetionline/FacultyWidgets.java').read_text(encoding='utf8')
def method(signature):
 a=source.index(signature);brace=source.index('{',a);depth=1;i=brace+1
 while depth:
  if source[i]=='{':depth+=1
  elif source[i]=='}':depth-=1
  i+=1
 return source[a:i]
methods=[method(s) for s in ['private static SharedPreferences prefs(', 'private static JSONObject json(', 'static JSONObject state(', 'static String scope(', 'static boolean allowed(', 'static boolean fresh(', 'static synchronized void clear(', 'static synchronized void sync(', 'private static boolean validPomo(', 'static String pending(', 'static synchronized void toggle(', 'private static String time(', 'static RemoteViews render(']]
harness=r'''
import org.json.*;import java.util.*;import java.time.*;import java.time.format.*;
public class WidgetTest {
 static final long HOUR=3600000L;static final String CHANGED="changed",TOGGLE="toggle";static final ZoneId ZONE=ZoneId.of("Europe/Tirane");static final DateTimeFormatter CLOCK=DateTimeFormatter.ofPattern("HH:mm").withZone(ZONE);
 static int checks;static void check(boolean value){if(!value)throw new AssertionError("check "+checks);checks++;}
 static class Context{static final int MODE_PRIVATE=0;SharedPreferences prefs=new SharedPreferences();int changes;SharedPreferences getSharedPreferences(String key,int mode){return prefs;}String getPackageName(){return "test";}void sendBroadcast(Intent i){changes++;}}
 static class SharedPreferences{Map<String,String> data=new HashMap<>();String getString(String key,String def){return data.getOrDefault(key,def);}SharedPreferences edit(){return this;}SharedPreferences clear(){data.clear();return this;}SharedPreferences remove(String k){data.remove(k);return this;}SharedPreferences putString(String k,String v){data.put(k,v);return this;}void apply(){}}
 static class Intent{Intent(String action){}Intent(Context c,Class<?> cl){}Intent setPackage(String p){return this;}Intent setAction(String a){return this;}}
 static class PendingIntent{static final int FLAG_IMMUTABLE=1,FLAG_UPDATE_CURRENT=2;static Object getBroadcast(Context c,int id,Intent i,int flags){return new Object();}}
 static class PomodoroWidget{}
 static class SystemClock{static long elapsedRealtime(){return 100000;}}
 static class View{static final int GONE=8,VISIBLE=0;}
 static class R{
  static class layout{static int widget_rooms=1,widget_pomodoro=2,widget_schedule=3;}
  static class id{static int widget_root=1,widget_label=2,widget_action=3,widget_clock=4,widget_title=5,widget_progress=6,widget_detail=7,widget_badge=8;}
  static class drawable{static int ic_widget_pause=11,ic_widget_play=12;}
 }
 static class RemoteViews{Map<Integer,Object> text=new HashMap<>(),visibility=new HashMap<>(),images=new HashMap<>(),actions=new HashMap<>();boolean running,countDown;long base;int progress;RemoteViews(String p,int layout){}void setOnClickPendingIntent(int id,Object intent){actions.put(id,intent);}void setTextViewText(int id,String value){text.put(id,value);}void setViewVisibility(int id,int value){visibility.put(id,value);}void setChronometerCountDown(int id,boolean v){countDown=v;}void setChronometer(int id,long b,String f,boolean r){base=b;running=r;}void setProgressBar(int id,int max,int v,boolean indeterminate){progress=v;}void setImageViewResource(int id,int res){images.put(id,res);}void setContentDescription(int id,String text){} }
 static Object open(Context c,String kind,boolean refresh){return kind+(refresh?":refresh":"");}static void updateAll(Context c){}
 __METHODS__
 static JSONObject sample(long now,String account)throws Exception{
  return new JSONObject().put("schema",1).put("scope",account).put("capturedAt",now).put("expires",now+8*HOUR)
   .put("allow",new JSONObject().put("schedule",true).put("rooms",true).put("pomodoro",true))
   .put("sessions",new JSONArray().put(new JSONObject().put("title","Sociologji").put("room","Salla 106").put("start",now+15*60000).put("end",now+75*60000)))
   .put("rooms",new JSONObject().put("checkedAt",now-1000).put("expires",now+HOUR).put("windows",new JSONArray().put(new JSONObject().put("name","Salla 103").put("from",now-1000).put("to",now+HOUR))))
   .put("pomo",new JSONObject().put("phase","focus").put("total",1500).put("left",1200).put("endsAt",now+1200000).put("task","Lexo kapitullin 3").put("taskId","task1").put("cycle",0));
 }
 public static void main(String[] args)throws Exception{
  Context c=new Context();long now=System.currentTimeMillis();JSONObject initial=sample(now,"a");sync(c,initial.toString());check(scope(c).equals("a"));
  RemoteViews view=render(c,"schedule");check(view.text.get(R.id.widget_title).equals("Sociologji"));check(view.text.get(R.id.widget_detail).toString().contains("Salla 106"));check(view.actions.get(R.id.widget_root).equals("schedule"));
  view=render(c,"rooms");check(view.text.get(R.id.widget_title).equals("Salla 103"));check(view.text.get(R.id.widget_detail).toString().contains("1 të lira"));check(view.actions.get(R.id.widget_action).equals("rooms:refresh"));
  view=render(c,"pomodoro");check(view.running&&view.countDown&&view.base>100000);check(view.images.get(R.id.widget_action).equals(R.drawable.ic_widget_pause));
  toggle(c);JSONObject paused=state(c).getJSONObject("pomo");check(paused.getLong("endsAt")==0&&paused.getLong("left")>1190);check(!pending(c).isEmpty()&&c.changes==1);
  view=render(c,"pomodoro");check(!view.running&&view.images.get(R.id.widget_action).equals(R.drawable.ic_widget_play));check(view.text.get(R.id.widget_badge).equals("Në pauzë"));
  sync(c,initial.toString());check(state(c).getJSONObject("pomo").getLong("endsAt")==0);check(!pending(c).isEmpty());
  JSONObject command=json(pending(c));JSONObject ack=sample(now,"a").put("ack",command.getString("id")).put("pomo",command.getJSONObject("pomo"));sync(c,ack.toString());check(pending(c).isEmpty());check(state(c).getJSONObject("pomo").getLong("endsAt")==0);
  toggle(c);check(state(c).getJSONObject("pomo").getLong("endsAt")>now);check(!pending(c).isEmpty());
  sync(c,sample(now,"b").toString());check(scope(c).equals("b")&&pending(c).isEmpty());
  String valid=c.prefs.data.get("snapshot");sync(c,"not json");check(c.prefs.data.get("snapshot").equals(valid));
  JSONObject bad=sample(now,"evil");bad.getJSONObject("pomo").put("total",-1);sync(c,bad.toString());check(scope(c).equals("b"));
  bad=sample(now,"expired").put("expires",now-1);sync(c,bad.toString());check(scope(c).equals("b"));
  JSONObject oldRooms=sample(now,"b");oldRooms.getJSONObject("rooms").put("expires",now-1);sync(c,oldRooms.toString());view=render(c,"rooms");check(view.text.get(R.id.widget_title).equals("Përditëso sallat"));
  JSONObject ended=sample(now,"b");ended.getJSONObject("pomo").put("endsAt",now-1000);sync(c,ended.toString());view=render(c,"pomodoro");check(!view.running&&view.text.get(R.id.widget_badge).equals("Përfundoi"));check(view.actions.get(R.id.widget_action).equals("pomodoro"));toggle(c);check(pending(c).isEmpty());
  JSONObject denied=sample(now,"b");denied.getJSONObject("allow").put("pomodoro",false);sync(c,denied.toString());toggle(c);check(pending(c).isEmpty());view=render(c,"pomodoro");check(view.visibility.get(R.id.widget_action).equals(View.GONE));
  clear(c);check(scope(c).isEmpty()&&pending(c).isEmpty());view=render(c,"rooms");check(view.text.get(R.id.widget_title).equals("Hap Fakultetin"));
  System.out.println("PASS: "+checks+" native widget state, background pause, account switch, stale data and rendered action checks.");
 }
}
'''.replace('__METHODS__','\n'.join(methods))
folder=root/'.build/widget-tests';folder.mkdir(parents=True,exist_ok=True)
file=folder/'WidgetTest.java';file.write_text(harness,encoding='utf8')
jdk=Path(os.environ['JAVA_HOME']);jar=Path(os.environ['WIDGET_JSON_JAR'])
subprocess.run([str(jdk/'bin/javac.exe'),'--release','17','-encoding','UTF-8','-cp',str(jar),str(file)],check=True)
subprocess.run([str(jdk/'bin/java.exe'),'-cp',str(folder)+os.pathsep+str(jar),'WidgetTest'],check=True)
ns={'a':'http://schemas.android.com/apk/res/android'}
manifest=ET.parse(root/'android-native/AndroidManifest.xml').getroot()
receivers=manifest.findall('application/receiver');widgets=[r for r in receivers if 'FacultyWidgets$' in r.attrib.get('{'+ns['a']+'}name','')]
assert len(widgets)==3 and all(w.attrib['{'+ns['a']+'}exported']=='false' for w in widgets)
allowed={'LinearLayout','ImageView','TextView','ImageButton','Chronometer','ProgressBar'}
for kind in ['schedule','rooms','pomodoro']:
 layout=ET.parse(root/f'android-native/res/layout/widget_{kind}.xml').getroot();assert all(e.tag in allowed for e in layout.iter())
 info=ET.parse(root/f'android-native/res/xml/widget_{kind}.xml').getroot();assert info.attrib['{'+ns['a']+'}widgetCategory']=='home_screen'
 assert int(info.attrib['{'+ns['a']+'}updatePeriodMillis'])>=1800000
print('PASS: 3 private widget providers, supported RemoteViews layouts and home-screen metadata.')
