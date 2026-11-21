package io.github.grenthoxha.fakultetionline;
import org.json.JSONObject;
import org.json.JSONException;

/** Matches pomodoro-core.js: a delayed wake advances one phase, never fictitious work. */
public final class PomodoroClock {
    private static int number(JSONObject s,String key,int fallback,int min,int max){return Math.max(min,Math.min(max,s.optInt(key,fallback)));}
    static JSONObject finish(JSONObject input,JSONObject config,long now)throws JSONException{
        JSONObject p=new JSONObject(input.toString());JSONObject s=config==null?new JSONObject():config;
        String previous=p.optString("phase","focus"),phase="focus";int cycle=Math.max(0,p.optInt("cycle"));boolean done=false;
        long endedAt=p.optLong("endsAt",now);if(endedAt<=0)endedAt=now;
        JSONObject completion=null;
        if(previous.equals("focus")){
            cycle++;phase=cycle%number(s,"every",4,1,12)==0?"long":"short";
            completion=new JSONObject().put("id","pomo_"+endedAt+"_"+p.optString("taskId"))
                    .put("endedAt",endedAt).put("taskId",p.optString("taskId")).put("minutes",p.optLong("total")/60.0);
        }else done=cycle>=number(s,"goal",4,1,24);
        int total=60*number(s,phase.equals("focus")?"focus":phase.equals("long")?"long":"short",phase.equals("focus")?25:phase.equals("long")?15:5,1,phase.equals("focus")?180:phase.equals("long")?120:60);
        boolean auto=!done&&now-endedAt<60000&&(phase.equals("focus")?s.optBoolean("autoFocus",false):s.optBoolean("autoBreak",true));
        p.put("phase",phase).put("total",total).put("left",total).put("endsAt",auto?now+total*1000L:0).put("cycle",cycle).put("done",done);
        JSONObject result=new JSONObject().put("state",p);if(completion!=null)result.put("completion",completion);return result;
    }
}
