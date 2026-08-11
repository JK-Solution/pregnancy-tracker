/* ================= 存储层（本地缓存 + Supabase 同步） ================= */

const LS_CFG = 'pt_config';
const LS_DATA = 'pt_data_';

/* 固定连接信息（已内置，无需填写）。配套 RLS 见 supabase-setup.sql */
const SUPABASE_URL = 'https://reuowfmjqduwpezfiyrg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_8FBad7aJHu-7-mdXwsoE1Q_yJ7qMAHz';

let config = null;
let supabase = null;
let cache = {};        // { '2026-08-10': { weight:{data,ts}, ... } }
let pending = [];      // [{d, t, data, ts, by}] 待同步
let online = navigator.onLine;

/* ---------- 本地配置 / 缓存（全部容错，localStorage 不可用时同步静默降级） ---------- */
function loadConfig(){ try{ config = JSON.parse(localStorage.getItem(LS_CFG)) || null; }catch(e){ config=null; } }
function saveConfigLocal(){ try{ localStorage.setItem(LS_CFG, JSON.stringify(config)); }catch(e){ console.warn('配置保存失败', e); } }
function loadCache(){ try{ cache = JSON.parse(localStorage.getItem(LS_DATA+(config?config.family:''))) || {}; }catch(e){ cache={}; } }
function saveCacheLocal(){ try{ localStorage.setItem(LS_DATA+config.family, JSON.stringify(cache)); }catch(e){ console.warn('缓存保存失败（可能超出存储上限）', e); } }

/* 初始化 Supabase 客户端；家庭码放入请求头，供 RLS 校验（见 supabase-setup.sql） */
function initSupabase(){
  try{
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      global: { headers: config && config.family ? { 'x-family-id': config.family } : {} },
    });
  }catch(e){ supabase = null; }
}

/* ---------- 记录读写 ---------- */
function getRec(d, t){ return cache[d] && cache[d][t] || null; }
function setRec(d, t, data){
  cache[d] = cache[d] || {};
  const v = migrateRec(t, data);          // 版本化写入
  cache[d][t] = { data: v, ts: Date.now() };
  pending.push({ d, t, data: v, ts: cache[d][t].ts, by: config ? config.role : '' });
  saveCacheLocal();
  scheduleSync();
}
function delRec(d, t){ if(cache[d]) delete cache[d][t]; saveCacheLocal(); scheduleSync(); }

/* ---------- 云端同步 ----------
 * 并发守卫：同一时刻只跑一个同步，避免定时器/可见性/手动触发重入。
 * 条件更新：走 RPC upsert_record，本地时间戳 >= 远端才覆盖，杜绝"旧数据覆盖新数据"；
 *           老库未迁移（无该函数）时自动回退普通 upsert。
 * 失败退避：30s 后重试，不无限重试同一批。
 */
let syncing = false;
let syncTimer = null;

function setSyncBadge(cls, txt){
  const b = document.getElementById('syncBadge');
  if(b){ b.className = cls; b.textContent = txt; }
}
function scheduleSync(){ clearTimeout(syncTimer); syncTimer = setTimeout(syncNow, 800); }
function scheduleRetry(){ clearTimeout(syncTimer); syncTimer = setTimeout(syncNow, 30000); }

async function syncNow(){
  if(syncing) return;
  syncing = true;
  try{
    setSyncBadge('syncing', '同步中…');
    if(!config || !supabase){ setSyncBadge('off', '未连接'); return; }
    if(!online){ setSyncBadge('off', '离线'); return; }
    // 1. 推送待同步
    let pushFailed = false;
    while(pending.length){
      const batch = pending.splice(0, 25);
      for(const x of batch){
        const params = {
          p_family: config.family,
          p_date: x.d,
          p_type: x.t,
          p_data: JSON.parse(JSON.stringify(x.data)),
          p_by: x.by || '',
          p_ts: new Date(x.ts).toISOString(),
        };
        const { error } = await supabase.rpc('upsert_record', params);
        if(!error) continue;
        if(/function\s+upsert_record/i.test(error.message || '')){
          // 老库尚未运行新 SQL：回退为普通 upsert（全量覆盖，退步但可用）
          const { error: e2 } = await supabase.from('daily_records').upsert({
            family_id: config.family, record_date: x.d, record_type: x.t,
            data: params.p_data, by: params.p_by, updated_at: params.p_ts,
          }, { onConflict: 'family_id,record_date,record_type' });
          if(e2){ pushFailed = true; break; }
        } else {
          pushFailed = true;
          break;
        }
      }
      if(pushFailed){ pending.unshift(...batch); break; }
    }
    if(pushFailed){ setSyncBadge('off', '同步失败'); scheduleRetry(); return; }
    // 2. 拉取远端（最近 GOALS.pullDays 天）
    const start = fmtDate(addDays(new Date(), -GOALS.pullDays));
    const { data, error } = await supabase
      .from('daily_records').select('record_date,record_type,data,updated_at')
      .eq('family_id', config.family).gte('record_date', start);
    if(error) throw error;
    if(data){
      for(const row of data){
        const rt = new Date(row.updated_at).getTime();
        const local = cache[row.record_date] && cache[row.record_date][row.record_type];
        if(!local || rt > local.ts){
          cache[row.record_date] = cache[row.record_date] || {};
          cache[row.record_date][row.record_type] = { data: row.data, ts: rt };
        }
      }
      saveCacheLocal();
    }
    setSyncBadge('done', '已同步 '+new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}));
  }catch(e){
    setSyncBadge('off', '同步失败');
    console.warn('sync error', e);
    scheduleRetry();
  }finally{
    syncing = false;
  }
}
function forceSync(){ syncNow(); }
