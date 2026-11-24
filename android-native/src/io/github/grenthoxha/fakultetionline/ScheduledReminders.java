package io.github.grenthoxha.fakultetionline;

import android.app.*;
import android.content.*;
import android.graphics.drawable.Icon;
import android.os.Build;
import org.json.*;
import java.util.*;

/** Private, local calendar reminders. No student data is sent to a server. */
public final class ScheduledReminders extends BroadcastReceiver {
    private static final String PREFS="scheduled_reminders_v1",CHANNEL="academic_reminders";
    private static final String TICK="io.github.grenthoxha.fakultetionline.REMINDER_TICK";
    private static final long DAY=86400000L;
    private static SharedPreferences prefs(Context c){return c.getSharedPreferences(PREFS,Context.MODE_PRIVATE);}
    static String scope(Context c){return prefs(c).getString("scope","");}
    static boolean permitted(Context c){
        NotificationManager m=c.getSystemService(NotificationManager.class);
        m.createNotificationChannel(new NotificationChannel(CHANNEL,"Provime dhe kujtesa",NotificationManager.IMPORTANCE_HIGH));
        return m.areNotificationsEnabled()&&m.getNotificationChannel(CHANNEL).getImportance()!=NotificationManager.IMPORTANCE_NONE;
    }
    static JSONArray jobs(Context c){try{return new JSONArray(prefs(c).getString("jobs","[]"));}catch(JSONException e){return new JSONArray();}}
    static Set<String> delivered(Context c){return new HashSet<>(prefs(c).getStringSet("delivered",Collections.emptySet()));}
    static synchronized void sync(Context c,String payload){
        if(payload.length()>70000)return;
        try{
            JSONObject p=new JSONObject(payload);long now=System.currentTimeMillis(),expires=p.getLong("expires");String scope=p.getString("scope");
            if(p.optInt("schema")!=1||scope.isEmpty()||scope.length()>300||expires<=now||expires>now+366*DAY)return;
            JSONArray source=p.getJSONArray("jobs"),clean=new JSONArray();
            if(source.length()>60)return;
            Set<String> ids=new HashSet<>();
            for(int i=0;i<source.length();i++){
                JSONObject j=source.getJSONObject(i);String id=j.getString("id"),title=j.getString("title"),detail=j.getString("detail"),target=j.getString("target");long at=j.getLong("at");
                if(!id.startsWith("reminder:")||id.length()>240||title.trim().isEmpty()||title.length()>180||detail.length()>500||!Arrays.asList("home","week","student").contains(target)||at<now-600000||at>now+366*DAY||!ids.add(id))return;
                clean.put(new JSONObject().put("id",id).put("title",title).put("detail",detail).put("target",target).put("at",at));
            }
            if(!scope.equals(scope(c)))clear(c);
            prefs(c).edit().putString("scope",scope).putString("jobs",clean.toString()).putLong("expires",expires).putBoolean("enabled",p.optBoolean("enabled")).apply();
            if(!p.optBoolean("enabled"))cancel(c);else reschedule(c);
        }catch(JSONException invalid){ }
    }
    private static PendingIntent alarm(Context c){return PendingIntent.getBroadcast(c,720,new Intent(c,ScheduledReminders.class).setAction(TICK),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);}
    private static void cancel(Context c){c.getSystemService(AlarmManager.class).cancel(alarm(c));}
    static synchronized void clear(Context c){
        cancel(c);NotificationManager manager=c.getSystemService(NotificationManager.class);
        for(String id:prefs(c).getStringSet("posted",Collections.emptySet()))try{manager.cancel(Integer.parseInt(id));}catch(NumberFormatException ignored){}
        prefs(c).edit().clear().apply();
    }
    static synchronized void reschedule(Context c){
        cancel(c);long now=System.currentTimeMillis();SharedPreferences p=prefs(c);
        if(!p.getBoolean("enabled",false)||p.getLong("expires",0)<=now||!permitted(c))return;
        Set<String> sent=delivered(c);long next=Long.MAX_VALUE;JSONArray jobs=jobs(c);
        for(int i=0;i<jobs.length();i++){JSONObject j=jobs.optJSONObject(i);if(j!=null&&!sent.contains(j.optString("id"))&&j.optLong("at")>=now-600000)next=Math.min(next,j.optLong("at"));}
        if(next==Long.MAX_VALUE)return;
        AlarmManager m=c.getSystemService(AlarmManager.class);long when=Math.max(now+1000,next);
        try{if(Build.VERSION.SDK_INT<31||m.canScheduleExactAlarms())m.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,when,alarm(c));else m.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,when,alarm(c));}
        catch(SecurityException revoked){m.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,when,alarm(c));}
    }
    @Override public void onReceive(Context c,Intent intent){
        if(!TICK.equals(intent.getAction())){reschedule(c);return;}
        synchronized(ScheduledReminders.class){
            long now=System.currentTimeMillis();SharedPreferences p=prefs(c);
            if(!p.getBoolean("enabled",false)||p.getLong("expires",0)<=now||!permitted(c))return;
            Set<String> sent=delivered(c),posted=new HashSet<>(p.getStringSet("posted",Collections.emptySet()));JSONArray jobs=jobs(c);
            for(int i=0;i<jobs.length();i++){
                JSONObject j=jobs.optJSONObject(i);if(j==null||sent.contains(j.optString("id"))||j.optLong("at")>now)continue;
                if(j.optLong("at")>=now-600000){
                    int id=10000+Math.floorMod(j.optString("id").hashCode(),Integer.MAX_VALUE-10000);
                    Intent open=new Intent(c,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP).putExtra(DemoNotifications.OPEN_ITEM,j.optString("id")).putExtra(DemoNotifications.OPEN_SCOPE,scope(c));
                    PendingIntent action=PendingIntent.getActivity(c,id,open,PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
                    try{c.getSystemService(NotificationManager.class).notify(id,new Notification.Builder(c,CHANNEL).setSmallIcon(R.drawable.ic_notification).setLargeIcon(Icon.createWithResource(c,R.mipmap.ic_launcher)).setColor(0xff1859ae).setContentTitle(j.optString("title")).setContentText(j.optString("detail")).setStyle(new Notification.BigTextStyle().bigText(j.optString("detail"))).setContentIntent(action).setAutoCancel(true).setVisibility(Notification.VISIBILITY_PRIVATE).setCategory(Notification.CATEGORY_REMINDER).build());posted.add(String.valueOf(id));}
                    catch(SecurityException denied){continue;}
                }
                sent.add(j.optString("id"));
            }
            if(sent.size()>400)sent.retainAll(activeIds(jobs));
            p.edit().putStringSet("delivered",sent).putStringSet("posted",posted).apply();reschedule(c);
        }
    }
    private static Set<String> activeIds(JSONArray jobs){Set<String> result=new HashSet<>();for(int i=0;i<jobs.length();i++)if(jobs.optJSONObject(i)!=null)result.add(jobs.optJSONObject(i).optString("id"));return result;}
}
