"""Exercise production approval scheduling, deduplication, privacy and revocation with JVM Android doubles.
The sync method's immediate network thread is suppressed; tests call the same check with a fake HTTPS reply.
"""
import os,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[1]
source=(root/'android-native/src/io/github/grenthoxha/fakultetionline/AdminApprovalAlerts.java').read_text(encoding='utf-8')
body=source[source.index('public final class AdminApprovalAlerts'):].replace('public final class AdminApprovalAlerts','static final class AdminApprovalAlerts',1)
assert body.count('schedule(c);checkAsync(c,false);')==1
body=body.replace('schedule(c);checkAsync(c,false);','schedule(c);')
prefix=r'''
import java.util.*;import org.json.*;import java.io.*;import java.net.URL;import javax.net.ssl.HttpsURLConnection;import java.nio.charset.StandardCharsets;import java.util.function.BooleanSupplier;
public class ApprovalAlertTest {
 static class MainActivity{} static class R{static class drawable{static int ic_notification=1;}static class mipmap{static int ic_launcher=2;}}
 static class Icon{static Icon createWithResource(Context c,int i){return new Icon();}}
 static class ComponentName{ComponentName(Context c,Class<?> t){}}
 static class Context {static final int MODE_PRIVATE=0;Map<String,SharedPreferences> stores=new HashMap<>();JobScheduler jobs=new JobScheduler();NotificationManager notifications=new NotificationManager();Intent opened;
  Context getApplicationContext(){return this;}SharedPreferences getSharedPreferences(String n,int m){return stores.computeIfAbsent(n,k->new SharedPreferences());}
  <T>T getSystemService(Class<T> t){return t.cast(t==JobScheduler.class?jobs:notifications);}}
 static class JobService extends Context{public boolean onStartJob(JobParameters p){return false;}public boolean onStopJob(JobParameters p){return false;}void jobFinished(JobParameters p,boolean retry){}}
 static class JobParameters{}
 static class JobInfo{static final int NETWORK_TYPE_ANY=1;long interval;boolean persisted;int network;static class Builder{JobInfo j=new JobInfo();Builder(int id,ComponentName c){}Builder setRequiredNetworkType(int n){j.network=n;return this;}Builder setPeriodic(long p){j.interval=p;return this;}Builder setPersisted(boolean p){j.persisted=p;return this;}JobInfo build(){return j;}}}
 static class JobScheduler{static final int RESULT_SUCCESS=1;JobInfo job;int scheduled,cancelled;JobInfo getPendingJob(int id){return job;}int schedule(JobInfo j){job=j;scheduled++;return RESULT_SUCCESS;}void cancel(int id){job=null;cancelled++;}}
 static class SharedPreferences {Map<String,Object> values=new HashMap<>();String getString(String k,String d){return (String)values.getOrDefault(k,d);}long getLong(String k,long d){return ((Number)values.getOrDefault(k,d)).longValue();}
  @SuppressWarnings("unchecked") Set<String> getStringSet(String k,Set<String>d){return (Set<String>)values.getOrDefault(k,d);}Editor edit(){return new Editor();}
  class Editor{Map<String,Object> next=new HashMap<>();boolean clear;Editor putString(String k,String v){next.put(k,v);return this;}Editor putLong(String k,long v){next.put(k,v);return this;}Editor putStringSet(String k,Set<String> v){next.put(k,new HashSet<>(v));return this;}Editor clear(){clear=true;return this;}void apply(){if(clear)values.clear();values.putAll(next);}}}
 static class Intent{static final int FLAG_ACTIVITY_CLEAR_TOP=1,FLAG_ACTIVITY_SINGLE_TOP=2;Map<String,String> extras=new HashMap<>();Intent(Context c,Class<?> t){}Intent addFlags(int f){return this;}Intent putExtra(String k,String v){extras.put(k,v);return this;}}
 static class PendingIntent{static final int FLAG_UPDATE_CURRENT=1,FLAG_IMMUTABLE=2;static PendingIntent getActivity(Context c,int id,Intent i,int flags){c.opened=i;return new PendingIntent();}}
 static class NotificationChannel{int importance;NotificationChannel(String id,String name,int p){importance=p;}void enableVibration(boolean v){}int getImportance(){return importance;}}
 static class Active{int id;Active(int i){id=i;}int getId(){return id;}}
 static class NotificationManager{static final int IMPORTANCE_HIGH=4,IMPORTANCE_NONE=0;boolean enabled=true;NotificationChannel channel;int posts;Map<Integer,Notification> active=new HashMap<>();
  void createNotificationChannel(NotificationChannel c){if(channel==null)channel=c;}NotificationChannel getNotificationChannel(String id){return channel;}boolean areNotificationsEnabled(){return enabled;}void cancel(int id){active.remove(id);}void notify(int id,Notification n){active.put(id,n);posts++;}Active[] getActiveNotifications(){return active.keySet().stream().map(Active::new).toArray(Active[]::new);}}
 static class Notification{static final int VISIBILITY_PRIVATE=0;String title,text;int number,visibility;boolean onlyOnce,autoCancel;Notification publicVersion;
  static class BigTextStyle{BigTextStyle bigText(String s){return this;}}
  static class Builder{Notification n=new Notification();Builder(Context c,String channel){}Builder setSmallIcon(int i){return this;}Builder setLargeIcon(Icon i){return this;}Builder setContentTitle(String s){n.title=s;return this;}Builder setContentText(String s){n.text=s;return this;}Builder setSubText(String s){return this;}Builder setStyle(BigTextStyle s){return this;}Builder setNumber(int i){n.number=i;return this;}Builder setContentIntent(PendingIntent p){return this;}Builder setAutoCancel(boolean b){n.autoCancel=b;return this;}Builder setOnlyAlertOnce(boolean b){n.onlyOnce=b;return this;}Builder setVisibility(int v){n.visibility=v;return this;}Builder setPublicVersion(Notification v){n.publicVersion=v;return this;}Notification build(){return n;}}}
 static int checks;static void ok(boolean v){checks++;if(!v)throw new AssertionError("check "+checks);}
 static String id(char c){return String.valueOf(c).repeat(64);}
 static String grant(String device,String token)throws Exception{return new JSONObject().put("deviceId",device).put("token",token).put("expires",System.currentTimeMillis()+30*86400000L).toString();}
 static AdminApprovalAlerts.Reply pending(String... ids)throws Exception{return new AdminApprovalAlerts.Reply(200,new JSONObject().put("ids",new JSONArray(Arrays.asList(ids))).put("pending",ids.length).toString());}
 public static void main(String[] args)throws Exception{
  Context c=new Context();String device=id('a'),token=id('b'),one=id('c'),two=id('d');
  AdminApprovalAlerts.sync(c,grant(device,token));ok(c.jobs.job!=null);ok(c.jobs.job.persisted&&c.jobs.job.interval==15*60000L&&c.jobs.job.network==JobInfo.NETWORK_TYPE_ANY);
  AdminApprovalAlerts.schedule(c);ok(c.jobs.scheduled==1);
  AdminApprovalAlerts.check(c,(d,t)->{ok(d.equals(device)&&t.equals(token));return pending(one);},()->true);ok(c.notifications.posts==1);
  Notification n=c.notifications.active.get(AdminApprovalAlerts.NOTICE);ok(n.number==1&&n.autoCancel&&!n.onlyOnce);ok(n.visibility==Notification.VISIBILITY_PRIVATE&&n.publicVersion.text.equals("Kërkesa për aprovim"));ok(c.opened.extras.get(AdminApprovalAlerts.OPEN).equals(device));
  AdminApprovalAlerts.check(c,(d,t)->pending(one),()->true);ok(c.notifications.posts==2&&c.notifications.active.get(AdminApprovalAlerts.NOTICE).onlyOnce);
  c.notifications.cancel(AdminApprovalAlerts.NOTICE);AdminApprovalAlerts.check(c,(d,t)->pending(one),()->true);ok(c.notifications.posts==2&&c.notifications.active.isEmpty());
  AdminApprovalAlerts.check(c,(d,t)->pending(one,two),()->true);ok(c.notifications.posts==3&&c.notifications.active.get(AdminApprovalAlerts.NOTICE).number==2&&!c.notifications.active.get(AdminApprovalAlerts.NOTICE).onlyOnce);
  AdminApprovalAlerts.check(c,(d,t)->pending(),()->true);ok(c.notifications.active.isEmpty());
  AdminApprovalAlerts.sync(c,grant(device,id('e')));AdminApprovalAlerts.check(c,(d,t)->pending(one,two),()->true);ok(c.notifications.posts==3);
  c.notifications.enabled=false;AdminApprovalAlerts.check(c,(d,t)->{throw new AssertionError("must not fetch without permission");},()->true);ok(c.jobs.job==null);
  c.notifications.enabled=true;AdminApprovalAlerts.schedule(c);ok(c.jobs.job!=null);
  AdminApprovalAlerts.check(c,(d,t)->{throw new IOException("offline");},()->true);ok(AdminApprovalAlerts.valid(c)&&c.jobs.job!=null);
  AdminApprovalAlerts.check(c,(d,t)->new AdminApprovalAlerts.Reply(503,"unavailable"),()->true);ok(AdminApprovalAlerts.valid(c));
  AdminApprovalAlerts.check(c,(d,t)->new AdminApprovalAlerts.Reply(403,"<html>temporary edge error</html>"),()->true);ok(AdminApprovalAlerts.valid(c));
  AdminApprovalAlerts.check(c,(d,t)->pending("invalid"),()->true);ok(c.notifications.posts==3);
  AdminApprovalAlerts.check(c,(d,t)->pending(one,one),()->true);ok(c.notifications.posts==3);
  AdminApprovalAlerts.check(c,(d,t)->pending(id('f')),()->false);ok(c.notifications.posts==3);
  AdminApprovalAlerts.check(c,(d,t)->{AdminApprovalAlerts.clear(c);return pending(id('f'));},()->true);ok(c.notifications.posts==3&&AdminApprovalAlerts.scope(c).isEmpty()&&c.jobs.job==null);
  AdminApprovalAlerts.sync(c,grant(id('1'),id('2')));AdminApprovalAlerts.check(c,(d,t)->pending(one),()->true);ok(c.notifications.posts==4&&c.opened.extras.get(AdminApprovalAlerts.OPEN).equals(id('1')));
  AdminApprovalAlerts.check(c,(d,t)->new AdminApprovalAlerts.Reply(401,"{\"error\":\"ALERT_TOKEN_INVALID\"}"),()->true);ok(AdminApprovalAlerts.scope(c).isEmpty()&&c.notifications.active.isEmpty()&&c.jobs.job==null);
  AdminApprovalAlerts.sync(c,grant(device,token));AdminApprovalAlerts.prefs(c).edit().putLong("expires",1).apply();AdminApprovalAlerts.check(c,(d,t)->{throw new AssertionError("expired token must not fetch");},()->true);ok(AdminApprovalAlerts.scope(c).isEmpty()&&c.jobs.job==null);
  System.out.println("PASS: "+checks+" native approval scheduling, deduplication, permission, privacy, scope, expiry and revocation checks");
 }
'''
folder=root/'.build/approval-alert-tests';folder.mkdir(parents=True,exist_ok=True)
(folder/'ApprovalAlertTest.java').write_text(prefix+body+'\n}',encoding='utf-8')
java=Path(os.environ['JAVA_HOME'])/'bin';jar=root/'.build/widget-tests/json.jar'
subprocess.run([str(java/'javac.exe'),'--release','17','-cp',str(jar),str(folder/'ApprovalAlertTest.java')],check=True)
subprocess.run([str(java/'java.exe'),'-cp',str(folder)+os.pathsep+str(jar),'ApprovalAlertTest'],check=True)
