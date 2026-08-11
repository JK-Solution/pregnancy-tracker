/* ================= 纯函数（日期 / 计算 / 安全转义 / 数据迁移，无 DOM、无存储依赖，可单元测试） ================= */

/* ---------- 日期 ---------- */
function fmtDate(d){ const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const dd=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${dd}`; }
function parseDate(s){ return new Date(s+'T00:00:00'); }
function addDays(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
function daysBetween(a,b){ return Math.round((parseDate(b)-parseDate(a))/86400000); }
function todayStr(){ return fmtDate(new Date()); }
function humanDate(s){
  const d=parseDate(s);
  const wd=['日','一','二','三','四','五','六'][d.getDay()];
  return `${s} 周${wd}${s===todayStr()?' · 今天':''}`;
}

/* ---------- 统计 ---------- */
function sumDiet(items){
  let c=0, p=0;
  (items||[]).forEach(i=>{ c+=i.kcal||0; p+=i.pro||0; });
  return {c, p};
}
/* 饮食是否达到打卡达标线（热量 ≥ minKcal 即视为已打卡） */
function dietCalOk(items, minKcal){
  if(!Array.isArray(items)) return false;
  return sumDiet(items).c >= minKcal;
}
/* 某药今日已服次数：新版 doses 为实际服用时刻数组（如 ['08:30','20:15']），
   旧版 items 布尔兼容为已服 1 次。data: med 记录的数据对象 */
function medTakenCount(data, id){
  if(!data || typeof data !== 'object') return 0;
  if(data.doses && Array.isArray(data.doses[id])) return data.doses[id].length;
  if(data.items && data.items[id] === true) return 1;
  return 0;
}
/* 用药是否按每日次数全部服完（supplements: [{id, times}]，times 默认 1） */
function medAllDone(data, supplements){
  if(!data || typeof data !== 'object') return false;
  return supplements.every(s => medTakenCount(data, s.id) >= (s.times||1));
}

/* ---------- HTML 转义（防存储型 XSS，所有用户输入渲染前必须过这里） ---------- */
function esc(s){
  return String(s==null?'':s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

/* ---------- 周期 / 排卵（纯计算，events: [{d:'2026-08-01', type:'start'|'end'}]） ---------- */
function cycleStats(events){
  const starts=(events||[]).filter(e=>e.type==='start').map(e=>e.d);
  let avgLen=28, lastStart=null;
  if(starts.length>=2){
    let sum=0;
    for(let i=1;i<starts.length;i++){ sum+=daysBetween(starts[i-1],starts[i]); }
    avgLen=Math.round(sum/(starts.length-1));
  }
  lastStart = starts.length ? starts[starts.length-1] : null;
  return {avgLen, lastStart, starts};
}
function predictFertile(events, today){
  const {avgLen, lastStart}=cycleStats(events);
  if(!lastStart){
    return {text:'记录 1–2 次经期开始日后，这里会预测排卵窗口与下次经期。', fertileDays:[], inWin:false, remaining:null, ovuDate:null};
  }
  const ovuIdx = Math.max(14, avgLen-14);
  const ovuDate = addDays(parseDate(lastStart), ovuIdx);
  const nextPeriod = addDays(parseDate(lastStart), avgLen);
  const fertileDays=[];
  for(let i=0;i<=5;i++){ fertileDays.push(fmtDate(addDays(ovuDate,i-3))); }
  const inWin = fertileDays.includes(today);
  const remaining = Math.round((parseDate(ovuDate)-parseDate(today))/86400000);
  const text = `周期约 ${avgLen} 天 · 预计排卵日 ${fmtDate(ovuDate)} · 排卵窗口 ${fertileDays[0]} ~ ${fertileDays[fertileDays.length-1]}` +
    (inWin ? '\n📍 今天在排卵窗口内，是受孕好时机！' : (remaining>0 ? `\n距预计排卵还有 ${remaining} 天` : ''));
  return {text, fertileDays, inWin, remaining, ovuDate, nextPeriod};
}

/* ---------- 数据版本化：写入前规范化 + 打版本号，将来改结构时在 migrateRec 里迁移 ---------- */
const REC_VERSION = 2;
function migrateRec(type, data){
  let out;
  try{ out = data && typeof data==='object' ? JSON.parse(JSON.stringify(data)) : {}; }
  catch(e){ out = {}; }
  if(!out || typeof out!=='object') out = {};
  // 各类型核心字段的结构兜底（老数据缺字段时不会崩）
  if(type==='med'){
    if(!out.items || typeof out.items!=='object' || Array.isArray(out.items)) out.items={};
    // v2 起 doses 记录每次服药时刻；旧 items 布尔迁移为 1 次（时间未知记空串）
    if(!out.doses || typeof out.doses!=='object' || Array.isArray(out.doses)){
      out.doses={};
      for(const k in out.items){ if(out.items[k]===true) out.doses[k]=['']; }
    } else {
      // doses 存在时以它为准重建 items 派生标记（保持两键一致）
      for(const k in out.items){ delete out.items[k]; }
      for(const k in out.doses){ if(Array.isArray(out.doses[k]) && out.doses[k].length) out.items[k]=true; }
    }
  }
  if(type==='diet' && !Array.isArray(out.items)) out.items=[];
  if(type==='cycle' && !Array.isArray(out.events)) out.events=[];
  if(type==='intimacy' && !Array.isArray(out.items)) out.items=[];
  if(type==='exercise' && !Array.isArray(out.items)) out.items=[];
  if(type==='mood' && !Array.isArray(out.sym)) out.sym=[];
  out.v = REC_VERSION;
  return out;
}

/* ---------- 导入备份校验（防脏数据进入同步队列） ---------- */
function validateImport(j){
  if(!j || typeof j!=='object' || !j.cache || typeof j.cache!=='object'){
    return {ok:false, error:'格式错误：缺少 cache 数据'};
  }
  let count=0;
  for(const d in j.cache){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(d)) return {ok:false, error:'格式错误：非法日期 '+d};
    if(fmtDate(parseDate(d)) !== d) return {ok:false, error:'格式错误：非法日期 '+d};  // 拦 13月/40日 这类滚动日期
    const day = j.cache[d];
    if(!day || typeof day!=='object') return {ok:false, error:'格式错误：'+d+' 的记录损坏'};
    for(const t in day){
      const v = day[t];
      if(!v || typeof v!=='object' || !v.data || typeof v.data!=='object'){
        return {ok:false, error:'格式错误：'+d+'/'+t+' 的数据损坏'};
      }
      if(JSON.stringify(v.data).length > 100000){
        return {ok:false, error:'记录过大：'+d+'/'+t+'（超过 100KB）'};
      }
      count++;
    }
  }
  return {ok:true, count};
}

/* Node 环境（单元测试）导出 */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    fmtDate, parseDate, addDays, daysBetween, todayStr, humanDate,
    sumDiet, dietCalOk, medTakenCount, medAllDone, esc,
    cycleStats, predictFertile,
    migrateRec, validateImport, REC_VERSION,
  };
}
