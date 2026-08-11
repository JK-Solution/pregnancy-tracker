/* ================= 初始化 ================= */
async function init(){
  loadConfig();
  buildTabs();
  if(!config){
    document.getElementById('setupPage').classList.remove('hidden');
    setSyncBadge('off', '未配置');
    return;
  }
  document.getElementById('roleTag').textContent = '· '+(config.role==='妻子'?'👩 妻子':'👨 丈夫');
  loadCache();
  initSupabase();
  render();
  // 匿名登录（auth.uid() 由 RLS 校验成员关系），成功后开始同步
  const auth = await ensureAuth();
  if(auth.error==='anonymous_disabled'){ setSyncBadge('off','匿名登录未开启'); }
  else if(auth.error){ setSyncBadge('off','登录失败'); }
  else { syncNow(); }
  window.addEventListener('online', ()=>{ online=true; syncNow(); });
  window.addEventListener('offline', ()=>{ online=false; setSyncBadge('off','离线'); });
  // 回到前台时刷新云端数据
  setInterval(()=>{ if(document.visibilityState==='visible') syncNow(); }, 60000);
  registerSW();
}

/* PWA 离线支持：仅 http(s) 环境下注册（本地直接打开文件时静默跳过） */
function registerSW(){
  try{
    if('serviceWorker' in navigator && location.protocol.indexOf('http')===0){
      navigator.serviceWorker.register('./sw.js').catch(()=>{});
    }
  }catch(e){ /* 忽略 */ }
}

init();
