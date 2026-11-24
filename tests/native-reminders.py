"""Run the production reminder receiver against JVM Android doubles and real JSON."""
import os,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[1]
source=(root/'android-native/src/io/github/grenthoxha/fakultetionline/ScheduledReminders.java').read_text(encoding='utf-8')
body=source[source.index('public final class ScheduledReminders'):].replace('public final class ScheduledReminders','static final class ScheduledReminders',1)
prefix=r'''
import java.util.*;import org.json.*;
public class ReminderTest {
 static class BroadcastReceiver { public void onReceive(Context c,Intent i){} }
 static class MainActivity{}
 static class DemoNotifications {static final String OPEN_ITEM="item",OPEN_SCOPE="scope";}
 static class R {static class drawable{static int ic_notification=1;}static class mipmap{static int ic_launcher=2;}}
 static class Build {static class VERSION{static int SDK_INT=35;}}
 static class Icon {static Icon createWithResource(Context c,int id){return new Icon();}}
 static class Context {static final int MODE_PRIVATE=0;SharedPreferences p=new SharedPreferences();AlarmManager alarm=new AlarmManager();NotificationManager notifications=new NotificationManager();Intent opened;
  SharedPreferences getSharedPreferences(String n,int m){return p;}
  <T>T getSystemService(Class<T> t){return t.cast(t==AlarmManager.class?alarm:notifications);}}
 static class SharedPreferences {Map<String,Object> values=new HashMap<>();String getString(String k,String d){return (String)values.getOrDefault(k,d);}long getLong(String k,long d){return ((Number)values.getOrDefault(k,d)).longValue();}boolean getBoolean(String k,boolean d){return (Boolean)values.getOrDefault(k,d);}
  @SuppressWarnings("unchecked") Set<String> getStringSet(String k,Set<String>d){return (Set<String>)values.getOrDefault(k,d);}Editor edit(){return new Editor();}
  class Editor {Map<String,Object> next=new HashMap<>();boolean clear;Editor putString(String k,String v){next.put(k,v);return this;}Editor putLong(String k,long v){next.put(k,v);return this;}Editor putBoolean(String k,boolean v){next.put(k,v);return this;}Editor putStringSet(String k,Set<String>v){next.put(k,new HashSet<>(v));return this;}Editor clear(){clear=true;return this;}void apply(){if(clear)values.clear();values.putAll(next);}}}
 static class Intent {static final int FLAG_ACTIVITY_CLEAR_TOP=1,FLAG_ACTIVITY_SINGLE_TOP=2;String action;Map<String,String> extras=new HashMap<>();Intent(){}Intent(Context c,Class<?>t){}Intent setAction(String s){action=s;return this;}String getAction(){return action;}Intent addFlags(int f){return this;}Intent putExtra(String k,String v){extras.put(k,v);return this;}}
 static class PendingIntent {static final int FLAG_IMMUTABLE=1,FLAG_UPDATE_CURRENT=2;static PendingIntent getBroadcast(Context c,int id,Intent i,int f){return new PendingIntent();}static PendingIntent getActivity(Context c,int id,Intent i,int f){c.opened=i;return new PendingIntent();}}
 static class AlarmManager {static final int RTC_WAKEUP=0;boolean exact=true;long due;int exactCalls,inexactCalls;boolean canScheduleExactAlarms(){return exact;}void cancel(PendingIntent p){due=0;}void setExactAndAllowWhileIdle(int kind,long at,PendingIntent p){due=at;exactCalls++;}void setAndAllowWhileIdle(int kind,long at,PendingIntent p){due=at;inexactCalls++;}}
 static class NotificationChannel {int importance;NotificationChannel(String i,String n,int p){importance=p;}int getImportance(){return importance;}}
 static class NotificationManager {static final int IMPORTANCE_HIGH=4,IMPORTANCE_NONE=0;boolean enabled=true;NotificationChannel channel;int posts;Map<Integer,Notification> active=new HashMap<>();void createNotificationChannel(NotificationChannel v){if(channel==null)channel=v;}NotificationChannel getNotificationChannel(String k){return channel;}boolean areNotificationsEnabled(){return enabled;}void notify(int id,Notification n){posts++;active.put(id,n);}void cancel(int id){active.remove(id);}}
 static class Notification {static final int VISIBILITY_PRIVATE=0;static final String CATEGORY_REMINDER="reminder";String title;
 static class BigTextStyle{BigTextStyle bigText(String t){return this;}}
 static class Builder{Notification n=new Notification();Builder(Context c,String ch){}Builder setSmallIcon(int v){return this;}Builder setLargeIcon(Icon v){return this;}Builder setColor(int v){return this;}Builder setContentTitle(String v){n.title=v;return this;}Builder setContentText(String v){return this;}Builder setStyle(BigTextStyle v){return this;}Builder setContentIntent(PendingIntent v){return this;}Builder setAutoCancel(boolean v){return this;}Builder setVisibility(int v){return this;}Builder setCategory(String v){return this;}Notification build(){return n;}}}
 static int checks;static void ok(boolean value){checks++;if(!value)throw new AssertionError("check "+checks);}
 static JSONObject job(String id,long at)throws Exception{return new JSONObject().put("id",id).put("title","Provimi im").put("detail","Salla 103").put("at",at).put("target","student");}
 static String snapshot(String scope,boolean enabled,JSONArray jobs)throws Exception{return new JSONObject().put("schema",1).put("scope",scope).put("enabled",enabled).put("expires",System.currentTimeMillis()+86400000).put("jobs",jobs).toString();}
 public static void main(String[] args)throws Exception{
  Context c=new Context();long now=System.currentTimeMillis();String a="reminder:exam:a:one",b="reminder:exam:a:two";
  ScheduledReminders.sync(c,snapshot("account-a",true,new JSONArray().put(job(a,now+60000))));ok(c.alarm.due==now+60000);ok(c.alarm.exactCalls==1);
  ScheduledReminders.sync(c,snapshot("account-a",true,new JSONArray().put(job(b,now+120000))));ok(c.alarm.due==now+120000);
  ScheduledReminders.sync(c,snapshot("account-a",true,new JSONArray()));ok(c.alarm.due==0);
  ScheduledReminders.sync(c,snapshot("account-a",true,new JSONArray().put(job(a,now-100))));
  new ScheduledReminders().onReceive(c,new Intent().setAction("io.github.grenthoxha.fakultetionline.REMINDER_TICK"));ok(c.notifications.posts==1);ok(c.alarm.due==0);ok(c.opened.extras.get("scope").equals("account-a"));
  new ScheduledReminders().onReceive(c,new Intent().setAction("io.github.grenthoxha.fakultetionline.REMINDER_TICK"));ok(c.notifications.posts==1);
  ScheduledReminders.sync(c,snapshot("account-a",true,new JSONArray().put(job(a,now-100))));ok(c.alarm.due==0);
  ScheduledReminders.sync(c,snapshot("account-a",true,new JSONArray().put(job(b,now+120000))));c.alarm.due=0;new ScheduledReminders().onReceive(c,new Intent().setAction("android.intent.action.BOOT_COMPLETED"));ok(c.alarm.due==now+120000);
  c.alarm.exact=false;ScheduledReminders.reschedule(c);ok(c.alarm.inexactCalls==1);
  ScheduledReminders.sync(c,snapshot("account-a",false,new JSONArray().put(job(b,now+120000))));ok(c.alarm.due==0);
  ScheduledReminders.sync(c,snapshot("account-b",true,new JSONArray().put(job(b,now+120000))));ok(c.notifications.active.isEmpty());ok(ScheduledReminders.scope(c).equals("account-b"));
  long due=c.alarm.due;ScheduledReminders.sync(c,snapshot("account-b",true,new JSONArray().put(job("bad",now+100000))));ok(c.alarm.due==due);
  c.notifications.enabled=false;ScheduledReminders.reschedule(c);ok(c.alarm.due==0);
  ScheduledReminders.clear(c);ok(c.p.values.isEmpty());ok(c.notifications.active.isEmpty());
  System.out.println("PASS: "+checks+" native reminder schedule/edit/delete/deduplication/boot/permission/account isolation checks");
 }
'''
folder=root/'.build/reminder-tests';folder.mkdir(parents=True,exist_ok=True)
(folder/'ReminderTest.java').write_text(prefix+body+'\n}',encoding='utf-8')
java=Path(os.environ['JAVA_HOME'])/'bin';jar=root/'.build/widget-tests/json.jar'
subprocess.run([str(java/'javac.exe'),'--release','17','-cp',str(jar),str(folder/'ReminderTest.java')],check=True)
subprocess.run([str(java/'java.exe'),'-cp',str(folder)+os.pathsep+str(jar),'ReminderTest'],check=True)
