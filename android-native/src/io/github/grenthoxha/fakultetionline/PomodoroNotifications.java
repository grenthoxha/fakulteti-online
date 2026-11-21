package io.github.grenthoxha.fakultetionline;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.drawable.Icon;
import org.json.JSONObject;

final class PomodoroNotifications {
    static boolean enabled(Context c){return c.getSystemService(NotificationManager.class).areNotificationsEnabled();}
    static void post(Context c,JSONObject state,String previous){
        JSONObject settings=state.optJSONObject("settings"),p=state.optJSONObject("pomo");
        if(settings==null||!settings.optBoolean("notify")||p==null||!enabled(c))return;
        boolean sound=settings.optBoolean("sound",true),vibrate=settings.optBoolean("vibrate",true);
        String channel="pomodoro_"+(sound?"sound":"quiet")+(vibrate?"_vibrate":"");
        NotificationManager manager=c.getSystemService(NotificationManager.class);
        NotificationChannel category=new NotificationChannel(channel,"Pomodoro",NotificationManager.IMPORTANCE_DEFAULT);
        if(!sound)category.setSound(null,null);category.enableVibration(vibrate);manager.createNotificationChannel(category);
        Intent intent=new Intent(c,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP)
                .putExtra(FacultyWidgets.OPEN,"pomodoro").putExtra(FacultyWidgets.SCOPE,state.optString("scope"));
        PendingIntent open=PendingIntent.getActivity(c,310,intent,PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
        String title=p.optBoolean("done")?"Përfunduan sesionet":previous.equals("focus")?"Fokusi përfundoi":"Pushimi përfundoi";
        String detail=p.optBoolean("done")?"Bravo! Përfundove "+p.optInt("cycle")+" sesione fokusi.":p.optString("phase").equals("focus")?"Gati për fokusin e radhës.":(p.optString("phase").equals("long")?"Pushim i gjatë":"Pushim")+" · "+(p.optInt("total")/60)+" min";
        try{manager.notify(30,new Notification.Builder(c,channel).setSmallIcon(R.drawable.ic_notification)
                .setLargeIcon(Icon.createWithResource(c,R.mipmap.ic_launcher)).setColor(0xff1859ae)
                .setContentTitle(title).setContentText(detail).setContentIntent(open).setAutoCancel(true)
                .setCategory(Notification.CATEGORY_ALARM).setVisibility(Notification.VISIBILITY_PRIVATE).build());}
        catch(SecurityException revoked){ }
    }
    static void clear(Context c){c.getSystemService(NotificationManager.class).cancel(30);}
}
