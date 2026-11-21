package io.github.grenthoxha.fakultetionline;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.os.SystemClock;
import android.os.Build;
import android.util.SizeF;
import android.util.TypedValue;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

/** Private local snapshots only. Launchers receive no credentials or account identifiers. */
public final class FacultyWidgets {
    static final String CHANGED = "io.github.grenthoxha.fakultetionline.WIDGET_CHANGED";
    static final String OPEN = "widget_target", SCOPE = "widget_scope", REFRESH = "widget_refresh";
    private static final String TICK = "io.github.grenthoxha.fakultetionline.WIDGET_TICK";
    private static final String TOGGLE = "io.github.grenthoxha.fakultetionline.WIDGET_POMO_TOGGLE";
    private static final long HOUR = 3600000L;
    private static final ZoneId ZONE = ZoneId.of("Europe/Tirane");
    private static final DateTimeFormatter CLOCK = DateTimeFormatter.ofPattern("HH:mm").withZone(ZONE);
    private static SharedPreferences prefs(Context c) { return c.getSharedPreferences("faculty_widgets", Context.MODE_PRIVATE); }
    private static JSONObject json(String value) { try { return new JSONObject(value); } catch (JSONException e) { return new JSONObject(); } }
    static JSONObject state(Context c) { return json(prefs(c).getString("snapshot", "{}")); }
    static String scope(Context c) { return state(c).optString("scope"); }
    static boolean allowed(JSONObject state, String kind) { return state.optJSONObject("allow") != null && state.optJSONObject("allow").optBoolean(kind); }
    static boolean fresh(JSONObject state, long now) { return !state.optString("scope").isEmpty() && state.optLong("expires") > now; }

    static synchronized void clear(Context c) {
        prefs(c).edit().clear().apply(); PomodoroNotifications.clear(c); updateAll(c);
    }

    static synchronized void sync(Context c, String payload) {
        if (payload.length() > 250000) return;
        try {
            JSONObject value = new JSONObject(payload); long now = System.currentTimeMillis();
            if (value.optInt("schema") != 1 || value.getString("scope").trim().isEmpty() || value.getString("scope").length() > 240
                    || value.getLong("expires") <= now || value.getLong("expires") > now + 9 * HOUR
                    || value.getLong("capturedAt") > now + 60000 || value.getJSONObject("allow") == null) return;
            JSONArray sessions = value.getJSONArray("sessions"), windows = value.getJSONObject("rooms").getJSONArray("windows");
            if (sessions.length() > 100 || windows.length() > 1500) return;
            for (int i=0;i<sessions.length();i++) {
                JSONObject s=sessions.getJSONObject(i);
                if (s.getString("title").length()>180 || s.getString("room").length()>80 || s.getLong("end")<=s.getLong("start")) return;
            }
            for (int i=0;i<windows.length();i++) {
                JSONObject w=windows.getJSONObject(i);
                if (w.getString("name").length()>80 || w.getLong("to")<=w.getLong("from")) return;
            }
            JSONObject p=value.optJSONObject("pomo"); if (p!=null && !validPomo(p,now)) return;
            SharedPreferences storage=prefs(c); JSONObject command=json(storage.getString("pending", "{}"));
            boolean sameScope=value.getString("scope").equals(command.optString("scope"));
            boolean accepted=command.optString("id").equals(value.optString("ack"));
            if (!sameScope || accepted || !allowed(value,"pomodoro")) storage.edit().remove("pending").apply();
            else if (command.has("pomo")) value.put("pomo",command.getJSONObject("pomo"));
            storage.edit().putString("snapshot",value.toString()).apply();updateAll(c);
        } catch (JSONException ignored) { /* Discard malformed messages without replacing a valid snapshot. */ }
    }

    private static boolean validPomo(JSONObject p,long now) {
        String phase=p.optString("phase");long total=p.optLong("total"),left=p.optLong("left"),end=p.optLong("endsAt");
        return (phase.equals("focus")||phase.equals("short")||phase.equals("long")) && total>=1 && total<=10800 && left>=0 && left<=total
                && end>=0 && end<=now+3*HOUR && p.optString("task").length()<=180 && p.optString("taskId").length()<=120;
    }

    static String pending(Context c) { return prefs(c).getString("pending", ""); }

    static synchronized boolean advance(Context c) {
        JSONObject value=state(c),p=value.optJSONObject("pomo");long now=System.currentTimeMillis();
        if(!fresh(value,now)||!allowed(value,"pomodoro")||p==null||p.optLong("endsAt")<=0||p.optLong("endsAt")>now)return false;
        try{
            String previous=p.optString("phase");JSONObject result=PomodoroClock.finish(p,value.optJSONObject("settings"),now);
            JSONObject old=json(pending(c));JSONArray completions=old.optJSONArray("completions");if(completions==null)completions=new JSONArray();
            if(result.has("completion")&&completions.length()<50)completions.put(result.getJSONObject("completion"));
            JSONObject next=result.getJSONObject("state");
            JSONObject command=new JSONObject().put("kind","pomo").put("scope",value.optString("scope")).put("id",UUID.randomUUID().toString()).put("pomo",next).put("completions",completions);
            value.put("pomo",next);prefs(c).edit().putString("snapshot",value.toString()).putString("pending",command.toString()).apply();
            PomodoroNotifications.post(c,value,previous);return true;
        }catch(JSONException invalid){return false;}
    }
    static void finishActive(Context c,String deadline){
        JSONObject p=state(c).optJSONObject("pomo");
        if(p!=null&&Long.toString(p.optLong("endsAt")).equals(deadline)){updateAll(c);c.sendBroadcast(new Intent(CHANGED).setPackage(c.getPackageName()));}
    }

    static synchronized void toggle(Context c) {
        JSONObject value=state(c); long now=System.currentTimeMillis();JSONObject p=value.optJSONObject("pomo");
        if (!fresh(value,now)||!allowed(value,"pomodoro")||p==null||!validPomo(p,now)) {updateAll(c);return;}
        long end=p.optLong("endsAt"),left=p.optLong("left");
        // A completed phase is reconciled by the app, preserving its existing history/auto-break logic.
        if (end>0&&end<=now) {updateAll(c);return;}
        try {
            if(p.optBoolean("done")){JSONObject settings=value.optJSONObject("settings");long total=60L*Math.max(1,Math.min(180,settings==null?25:settings.optInt("focus",25)));p.put("phase","focus").put("cycle",0).put("total",total).put("left",total).put("done",false);left=total;}
            if (end>0) {left=Math.max(1,(end-now+999)/1000);p.put("left",Math.min(p.optLong("total"),left)).put("endsAt",0);}
            else {left=left>0?left:p.optLong("total");p.put("left",left).put("endsAt",now+left*1000).put("done",false);}
            JSONArray completions=json(pending(c)).optJSONArray("completions");
            JSONObject command=new JSONObject().put("kind","pomo").put("scope",value.getString("scope"))
                    .put("id",UUID.randomUUID().toString()).put("pomo",p).put("completions",completions==null?new JSONArray():completions);
            prefs(c).edit().putString("snapshot",value.put("pomo",p).toString()).putString("pending",command.toString()).apply();
            updateAll(c);c.sendBroadcast(new Intent(CHANGED).setPackage(c.getPackageName()));
        } catch (JSONException ignored) { }
    }

    static void pin(Context c, String kind) {
        Class<? extends AppWidgetProvider> provider=provider(kind);if(provider==null)return;
        AppWidgetManager manager=c.getSystemService(AppWidgetManager.class);
        if(manager.isRequestPinAppWidgetSupported())manager.requestPinAppWidget(new ComponentName(c,provider),null,null);
    }
    static Class<? extends AppWidgetProvider> provider(String kind) {
        return switch(kind){case "schedule"->ScheduleWidget.class;case "rooms"->RoomsWidget.class;case "pomodoro"->PomodoroWidget.class;default->null;};
    }
    static void updateAll(Context c) {
        boolean advanced=advance(c);
        AppWidgetManager manager=c.getSystemService(AppWidgetManager.class);
        for(String kind:new String[]{"schedule","rooms","pomodoro"}) {
            int[] ids=manager.getAppWidgetIds(new ComponentName(c,provider(kind)));
            for(int id:ids)manager.updateAppWidget(id,responsive(c,kind,manager.getAppWidgetOptions(id)));
        }
        schedule(c);
        if(advanced)c.sendBroadcast(new Intent(CHANGED).setPackage(c.getPackageName()));
    }
    static RemoteViews responsive(Context c,String kind,Bundle options){
        if(Build.VERSION.SDK_INT>=31){
            java.util.Map<SizeF,RemoteViews> layouts=new java.util.LinkedHashMap<>();
            int small=kind.equals("rooms")?56:kind.equals("pomodoro")?104:80,normal=kind.equals("rooms")?72:kind.equals("pomodoro")?132:120;
            layouts.put(new SizeF(150,small),sized(c,kind,150,small));layouts.put(new SizeF(260,normal),sized(c,kind,260,normal));
            layouts.put(new SizeF(260,180),sized(c,kind,260,180));return new RemoteViews(layouts);
        }
        return sized(c,kind,options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH,260),options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT,132));
    }
    static RemoteViews sized(Context c,String kind,int width,int height){
        RemoteViews v=render(c,kind);boolean small=width<240||height<(kind.equals("rooms")?70:120);
        int pad=kind.equals("rooms")?(small?8:12):(small?10:14);v.setViewPadding(R.id.widget_root,pad,pad,pad,pad);
        v.setTextViewTextSize(R.id.widget_title,TypedValue.COMPLEX_UNIT_SP,kind.equals("pomodoro")?(small?24:32):(small?14:17));
        v.setTextViewTextSize(R.id.widget_detail,TypedValue.COMPLEX_UNIT_SP,small?11:12);v.setInt(R.id.widget_detail,"setMaxLines",small||height<160?1:2);
        if(kind.equals("rooms")){v.setViewVisibility(R.id.widget_label,height<100?View.GONE:View.VISIBLE);v.setInt(R.id.widget_title,"setMaxLines",1);}
        else{v.setViewVisibility(R.id.widget_header,small?View.GONE:View.VISIBLE);if(kind.equals("pomodoro")){v.setTextViewTextSize(R.id.widget_clock,TypedValue.COMPLEX_UNIT_SP,small?24:height>=180?40:32);v.setInt(R.id.widget_title,"setMaxLines",1);}}
        if(small&&kind.equals("rooms")){
            JSONObject data=state(c),rooms=data.optJSONObject("rooms");long now=System.currentTimeMillis(),until=0;
            if(fresh(data,now)&&allowed(data,"rooms")&&rooms!=null&&rooms.optLong("expires")>now){JSONArray windows=rooms.optJSONArray("windows");if(windows!=null)for(int i=0;i<windows.length();i++){JSONObject w=windows.optJSONObject(i);if(w!=null&&w.optLong("from")<=now&&w.optLong("to")>now)until=Math.max(until,w.optLong("to"));}}
            if(until>0)v.setTextViewText(R.id.widget_detail,"Deri në "+time(until));
        }
        return v;
    }
    private static String time(long value){return CLOCK.format(Instant.ofEpochMilli(value));}
    private static PendingIntent open(Context c,String target,boolean refresh) {
        Intent intent=new Intent(c,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP)
                .setAction("faculty.widget."+target+(refresh?".refresh":""))
                .putExtra(OPEN,target).putExtra(SCOPE,scope(c)).putExtra(REFRESH,refresh);
        return PendingIntent.getActivity(c,100+target.hashCode()+(refresh?1:0),intent,PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
    }
    static RemoteViews render(Context c,String kind) {
        boolean rooms=kind.equals("rooms"),pomo=kind.equals("pomodoro");
        RemoteViews view=new RemoteViews(c.getPackageName(),rooms?R.layout.widget_rooms:pomo?R.layout.widget_pomodoro:R.layout.widget_schedule);
        JSONObject state=state(c);long now=System.currentTimeMillis();boolean available=fresh(state,now)&&allowed(state,kind);
        String title="Hap Fakultetin",detail="Lidhu me llogarinë për ta përditësuar.",badge="";
        if(!state.optString("scope").isEmpty()&&!allowed(state,kind))detail="Ky shërbim nuk është aktiv për llogarinë.";
        view.setOnClickPendingIntent(R.id.widget_root,open(c,kind,false));
        view.setTextViewText(R.id.widget_label,rooms?"Sallat e lira":pomo?"Pomodoro":"Ligjërata e radhës");
        if(rooms){
            view.setOnClickPendingIntent(R.id.widget_action,open(c,kind,true));
            if(available){
                JSONObject r=state.optJSONObject("rooms");JSONArray windows=r==null?new JSONArray():r.optJSONArray("windows");JSONObject best=null;int count=0;
                if(r!=null&&r.optLong("checkedAt")>0&&r.optLong("expires")>now&&windows!=null){
                    for(int i=0;i<windows.length();i++){JSONObject w=windows.optJSONObject(i);if(w!=null&&w.optLong("from")<=now&&w.optLong("to")>now){count++;if(best==null||w.optLong("to")>best.optLong("to"))best=w;}}
                    title=best==null?"Nuk ka sallë të lirë tani":best.optString("name");
                    detail=best==null?"Prek për të parë orarin.":"E lirë deri në "+time(best.optLong("to"))+" · "+count+" të lira";
                }else{title="Përditëso sallat";detail="Hap app-in për të marrë orarin aktual.";}
            }
        }else if(pomo){
            view.setViewVisibility(R.id.widget_clock,View.GONE);view.setViewVisibility(R.id.widget_title,View.VISIBLE);
            view.setViewVisibility(R.id.widget_action,available?View.VISIBLE:View.GONE);
            if(available){
                JSONObject p=state.optJSONObject("pomo");if(p==null)p=new JSONObject();long end=p.optLong("endsAt"),total=Math.max(1,p.optLong("total",1500)),left=end>0?Math.max(0,(end-now+999)/1000):p.optLong("left",total);
                boolean running=end>now,complete=p.optBoolean("done")||(end>0&&end<=now);
                title=String.format(java.util.Locale.ROOT,"%02d:%02d",left/60,left%60);
                if(running){view.setViewVisibility(R.id.widget_title,View.GONE);view.setViewVisibility(R.id.widget_clock,View.VISIBLE);view.setChronometerCountDown(R.id.widget_clock,true);view.setChronometer(R.id.widget_clock,SystemClock.elapsedRealtime()+(end-now),null,true);}
                detail=complete?"Përfundoi · Hap Pomodoro":p.optString("task").isEmpty()?(p.optString("phase").equals("focus")?"Koha për fokus":"Koha për pushim"):p.optString("task");
                String phase=p.optString("phase").equals("focus")?"Fokus":p.optString("phase").equals("long")?"Pushim i gjatë":"Pushim";
                badge=complete?"Përfundoi":running?phase:"Në pauzë";
                view.setProgressBar(R.id.widget_progress,100,(int)Math.max(0,Math.min(100,100*(total-left)/total)),false);
                view.setImageViewResource(R.id.widget_action,running?R.drawable.ic_widget_pause:R.drawable.ic_widget_play);
                view.setContentDescription(R.id.widget_action,running?"Ndalo përkohësisht Pomodoro":"Vazhdo Pomodoro");
                if(complete&&!p.optBoolean("done"))view.setOnClickPendingIntent(R.id.widget_action,open(c,kind,false));
                else view.setOnClickPendingIntent(R.id.widget_action,PendingIntent.getBroadcast(c,210,new Intent(c,PomodoroWidget.class).setAction(TOGGLE),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT));
            }
        }else if(available){
            JSONObject next=null;JSONArray sessions=state.optJSONArray("sessions");
            if(sessions!=null)for(int i=0;i<sessions.length();i++){JSONObject item=sessions.optJSONObject(i);if(item!=null&&item.optLong("end")>now&&(next==null||item.optLong("start")<next.optLong("start")))next=item;}
            if(next==null){title="S'ka orë të ardhshme";detail="Prek për të parë orarin.";}
            else{
                title=next.optString("title");long start=next.optLong("start");String date=Instant.ofEpochMilli(start).atZone(ZONE).toLocalDate().equals(Instant.ofEpochMilli(now).atZone(ZONE).toLocalDate())?"Sot":DateTimeFormatter.ofPattern("dd.MM").withZone(ZONE).format(Instant.ofEpochMilli(start));
                detail=date+" · "+time(start)+(next.optString("room").isEmpty()?"":" · "+next.optString("room"));
                badge=start<=now?"Në vazhdim":"Orari im";
            }
        }
        view.setTextViewText(R.id.widget_title,title);view.setTextViewText(R.id.widget_detail,detail);
        if(!rooms){view.setTextViewText(R.id.widget_badge,badge);view.setViewVisibility(R.id.widget_badge,badge.isEmpty()?View.GONE:View.VISIBLE);}
        return view;
    }

    private static void schedule(Context c){
        AppWidgetManager manager=c.getSystemService(AppWidgetManager.class);boolean any=false;
        for(String kind:new String[]{"schedule","rooms","pomodoro"})if(manager.getAppWidgetIds(new ComponentName(c,provider(kind))).length>0)any=true;
        PendingIntent tick=PendingIntent.getBroadcast(c,211,new Intent(c,ScheduleWidget.class).setAction(TICK),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
        AlarmManager alarms=c.getSystemService(AlarmManager.class);alarms.cancel(tick);
        PendingIntent progress=PendingIntent.getBroadcast(c,212,new Intent(c,ScheduleWidget.class).setAction(TICK),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);alarms.cancel(progress);
        JSONObject value=state(c);long now=System.currentTimeMillis();JSONObject p=value.optJSONObject("pomo");boolean timerDue=fresh(value,now)&&allowed(value,"pomodoro")&&p!=null&&p.optLong("endsAt")>now;if(!any&&!timerDue)return;
        long next=now+30*60000;long expires=value.optLong("expires");if(expires>now)next=Math.min(next,expires);
        for(String group:new String[]{"sessions","windows"}){
            JSONArray list=group.equals("sessions")?value.optJSONArray(group):value.optJSONObject("rooms")==null?null:value.optJSONObject("rooms").optJSONArray(group);
            if(list!=null)for(int i=0;i<list.length();i++){JSONObject item=list.optJSONObject(i);if(item!=null)for(String key:group.equals("sessions")?new String[]{"start","end"}:new String[]{"from","to"}){long at=item.optLong(key);if(at>now)next=Math.min(next,at);}}
        }
        JSONObject rooms=value.optJSONObject("rooms");if(rooms!=null&&rooms.optLong("expires")>now)next=Math.min(next,rooms.optLong("expires"));
        if(timerDue)next=Math.min(next,p.optLong("endsAt"));
        if(any&&timerDue)alarms.set(AlarmManager.ELAPSED_REALTIME,SystemClock.elapsedRealtime()+60000,progress);
        // Reuse an existing alarm grant for an active timer, without requesting it just for widgets.
        try {
            if(timerDue&&DemoNotifications.canSchedule(c))alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,Math.max(now+1000,next),tick);
            else alarms.setAndAllowWhileIdle(timerDue?AlarmManager.RTC_WAKEUP:AlarmManager.RTC,Math.max(now+1000,next),tick);
        } catch (SecurityException revoked) {alarms.setAndAllowWhileIdle(AlarmManager.RTC,Math.max(now+1000,next),tick);}
    }
    public static class Base extends AppWidgetProvider {
        @Override public void onUpdate(Context c,AppWidgetManager manager,int[] ids){updateAll(c);}
        @Override public void onAppWidgetOptionsChanged(Context c,AppWidgetManager manager,int id,Bundle options){updateAll(c);}
        @Override public void onDisabled(Context c){updateAll(c);}
        @Override public void onReceive(Context c,Intent intent){
            if(TOGGLE.equals(intent.getAction()))toggle(c);else if(TICK.equals(intent.getAction()))updateAll(c);else super.onReceive(c,intent);
        }
    }
    public static final class ScheduleWidget extends Base { }
    public static final class RoomsWidget extends Base { }
    public static final class PomodoroWidget extends Base { }
}
