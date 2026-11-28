package io.github.grenthoxha.fakultetionline;

import android.app.*;
import android.app.job.*;
import android.content.*;
import android.graphics.drawable.Icon;
import org.json.*;
import java.io.*;
import java.net.URL;
import javax.net.ssl.HttpsURLConnection;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.function.BooleanSupplier;

/** Read-only background approval checks. No password or signing key leaves Web Storage. */
public final class AdminApprovalAlerts extends JobService {
    static final int JOB=881,NOTICE=882;
    static final String PREFS="admin_approval_alerts_v1",CHANNEL="admin_approvals",OPEN="fakulteti_admin_approval_scope";
    static final long INTERVAL=15*60000L;
    private static boolean polling;
    private volatile boolean stopped;
    interface Fetcher { Reply get(String device,String token) throws Exception; }
    static final class Reply {final int status;final String body;Reply(int status,String body){this.status=status;this.body=body;}}
    static SharedPreferences prefs(Context c){return c.getSharedPreferences(PREFS,Context.MODE_PRIVATE);}
    static String scope(Context c){return prefs(c).getString("device","");}
    static boolean valid(Context c){return prefs(c).getLong("expires",0)>System.currentTimeMillis()&&!scope(c).isEmpty();}
    static boolean permitted(Context c){
        NotificationManager m=c.getSystemService(NotificationManager.class);
        NotificationChannel channel=new NotificationChannel(CHANNEL,"Kërkesat për qasje",NotificationManager.IMPORTANCE_HIGH);
        channel.enableVibration(true);m.createNotificationChannel(channel);
        return m.areNotificationsEnabled()&&m.getNotificationChannel(CHANNEL).getImportance()!=NotificationManager.IMPORTANCE_NONE;
    }
    static synchronized void clear(Context c){
        c.getSystemService(JobScheduler.class).cancel(JOB);
        c.getSystemService(NotificationManager.class).cancel(NOTICE);
        prefs(c).edit().clear().apply();
    }
    static synchronized void sync(Context c,String payload){
        if(payload.length()>1500)return;
        try{
            JSONObject p=new JSONObject(payload);String device=p.getString("deviceId"),token=p.getString("token");long expires=p.getLong("expires"),now=System.currentTimeMillis();
            if(!device.matches("[a-f0-9]{64}")||!token.matches("[a-f0-9]{64}")||expires<=now||expires>now+31*86400000L)return;
            if(!scope(c).equals(device))clear(c);
            prefs(c).edit().putString("device",device).putString("token",token).putLong("expires",expires).apply();
            schedule(c);checkAsync(c,false);
        }catch(JSONException ignored){}
    }
    static synchronized boolean schedule(Context c){
        JobScheduler scheduler=c.getSystemService(JobScheduler.class);
        if(!valid(c)||!permitted(c)){scheduler.cancel(JOB);return false;}
        if(scheduler.getPendingJob(JOB)!=null)return true;
        JobInfo job=new JobInfo.Builder(JOB,new ComponentName(c,AdminApprovalAlerts.class)).setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setPeriodic(INTERVAL).setPersisted(true).build();
        return scheduler.schedule(job)==JobScheduler.RESULT_SUCCESS;
    }
    static JSONObject state(Context c){
        try{return new JSONObject().put("registered",valid(c)).put("permission",permitted(c)).put("enabled",valid(c)&&permitted(c)&&c.getSystemService(JobScheduler.class).getPendingJob(JOB)!=null).put("expires",prefs(c).getLong("expires",0));}
        catch(JSONException ignored){return new JSONObject();}
    }
    static void checkAsync(Context c,boolean force){
        Context app=c.getApplicationContext();
        if(!force&&System.currentTimeMillis()-prefs(app).getLong("checked",0)<60000)return;
        new Thread(()->check(app,AdminApprovalAlerts::fetch,()->true),"Fakulteti-approval-check").start();
    }
    static Reply fetch(String device,String token) throws Exception {
        HttpsURLConnection connection=(HttpsURLConnection)new URL("https://fakulteti-aprovimet.personalebuds.chatgpt.site/api/admin/alerts/pending").openConnection();
        connection.setInstanceFollowRedirects(false);connection.setConnectTimeout(12000);connection.setReadTimeout(12000);
        connection.setRequestProperty("X-Fakulteti-Device",device);connection.setRequestProperty("X-Fakulteti-Alert",token);
        connection.setRequestProperty("User-Agent","Mozilla/5.0 (Linux; Android) Fakulteti/1.0.10");connection.setRequestProperty("Origin","https://grenthoxha.github.io");
        connection.setRequestProperty("Cache-Control","no-store");
        try{
            int status=connection.getResponseCode();InputStream stream=status>=400?connection.getErrorStream():connection.getInputStream();
            if(stream==null)return new Reply(status,"");
            try(stream;ByteArrayOutputStream bytes=new ByteArrayOutputStream()){
                byte[] buffer=new byte[4096];int n;while((n=stream.read(buffer))!=-1){if(bytes.size()+n>100000)throw new IOException("Response too large");bytes.write(buffer,0,n);}
                return new Reply(status,new String(bytes.toByteArray(),StandardCharsets.UTF_8));
            }
        }finally{connection.disconnect();}
    }
    static void check(Context c,Fetcher fetcher,BooleanSupplier active){
        final String device,token;
        synchronized(AdminApprovalAlerts.class){if(polling)return;if(!valid(c)){clear(c);return;}if(!permitted(c)){c.getSystemService(JobScheduler.class).cancel(JOB);return;}polling=true;device=scope(c);token=prefs(c).getString("token","");}
        try{
            Reply response=fetcher.get(device,token);
            synchronized(AdminApprovalAlerts.class){
                if(!active.getAsBoolean()||!scope(c).equals(device)||!prefs(c).getString("token","").equals(token))return;
                if(response.status==401||response.status==403){
                    // Only a JSON rejection by the approval service revokes registration; transient edge errors do not.
                    try{if(new JSONObject(response.body).has("error"))clear(c);}catch(JSONException ignored){}return;
                }
                if(response.status!=200)return;
                JSONObject data=new JSONObject(response.body);JSONArray source=data.getJSONArray("ids");int count=data.getInt("pending");
                if(count!=source.length()||count<0||count>1000)return;
                Set<String> ids=new HashSet<>(),seen=new HashSet<>(prefs(c).getStringSet("seen",Collections.emptySet()));
                for(int i=0;i<source.length();i++){String id=source.getString(i);if(!id.matches("[a-f0-9]{64}")||!ids.add(id))return;}
                Set<String> fresh=new HashSet<>(ids);fresh.removeAll(seen);
                NotificationManager manager=c.getSystemService(NotificationManager.class);
                if(count==0)manager.cancel(NOTICE);
                else if(!fresh.isEmpty()||Arrays.stream(manager.getActiveNotifications()).anyMatch(n->n.getId()==NOTICE)){
                    if(!permitted(c))return;
                    Intent intent=new Intent(c,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP).putExtra(OPEN,device);
                    PendingIntent open=PendingIntent.getActivity(c,NOTICE,intent,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
                    Notification publicView=new Notification.Builder(c,CHANNEL).setSmallIcon(R.drawable.ic_notification).setContentTitle("Fakulteti").setContentText("Kërkesa për aprovim").build();
                    String message=count==1?"1 person po pret aprovimin tënd.":count+" persona po presin aprovimin tënd.";
                    Notification notice=new Notification.Builder(c,CHANNEL).setSmallIcon(R.drawable.ic_notification).setLargeIcon(Icon.createWithResource(c,R.mipmap.ic_launcher)).setContentTitle("Kërkesa për qasje").setContentText(message)
                        .setSubText("Fakulteti · Administrimi").setStyle(new Notification.BigTextStyle().bigText(message)).setNumber(count).setContentIntent(open).setAutoCancel(true).setOnlyAlertOnce(fresh.isEmpty()).setVisibility(Notification.VISIBILITY_PRIVATE).setPublicVersion(publicView).build();
                    manager.notify(NOTICE,notice);
                }
                seen.addAll(ids);if(seen.size()>5000)seen=new HashSet<>(ids);
                prefs(c).edit().putStringSet("seen",seen).putLong("checked",System.currentTimeMillis()).apply();
            }
        }catch(Exception ignored){/* Retain registration and retry on the next scheduled check. */}
        finally{synchronized(AdminApprovalAlerts.class){polling=false;}}
    }
    @Override public boolean onStartJob(JobParameters params){stopped=false;new Thread(()->{check(this,AdminApprovalAlerts::fetch,()->!stopped);jobFinished(params,false);},"Fakulteti-approval-job").start();return true;}
    @Override public boolean onStopJob(JobParameters params){stopped=true;return true;}
}
