/* ================= UI 渲染与交互（依赖 config / logic / storage） ================= */

let currentDate = todayStr();
let selectedTab = 'today';

/* ================= 渲染入口 ================= */
function render(){
  document.getElementById('curDate').textContent = humanDate(currentDate);
  renderToday();
  renderWeight();
  renderMed();
  renderDiet();
  renderCycle();
  renderIntimacy();
  renderExercise();
  renderSleep();
  renderMood();
  renderReport();
}

function switchPage(tab){
  selectedTab = tab;
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById('page-'+tab).classList.add('active');
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active', t.dataset.tab===tab));
}

function shiftDate(n){
  const d = parseDate(currentDate);
  d.setDate(d.getDate()+n);
  currentDate = fmtDate(d);
  render();
}

/* ================= 今日概览 ================= */
function renderToday(){
  const d = currentDate;
  const items = [
    {k:'weight', ok:!!getRec(d,'weight'), label:'体重'},
    {k:'med', ok:medAllDone(getRec(d,'med')?.data.items, SUPPLEMENTS), label:'用药'},
    {k:'diet', ok:dietCalOk(getRec(d,'diet')?.data.items, GOALS.kcalMin), label:'饮食'},
    {k:'cycle', ok:!!getRec(d,'cycle'), label:'周期'},
    {k:'intimacy', ok:!!getRec(d,'intimacy'), label:'同房'},
    {k:'exercise', ok:!!getRec(d,'exercise'), label:'运动'},
    {k:'sleep', ok:!!getRec(d,'sleep'), label:'睡眠'},
    {k:'mood', ok:!!getRec(d,'mood'), label:'情绪'},
  ];
  document.getElementById('todaySummary').innerHTML = items.map(it=>`
    <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px dashed var(--border)">
      <span style="width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;background:${it.ok?'#e2f5e9':'var(--surface2)'}">${it.ok?'✅':'⬜'}</span>
      <span style="flex:1">${it.label}</span>
      <span class="pill ${it.ok?'green':'yellow'}">${it.ok?'已记录':'未记录'}</span>
    </div>`).join('');
}

/* ================= 体重 ================= */
function renderWeight(){
  const goal = GOALS.weightKg;
  const r = getRec(currentDate,'weight');
  document.getElementById('wInput').value = r ? r.data.kg : '';
  const st = document.getElementById('wState');
  if(r){ st.textContent = r.data.kg+' kg'; st.className='state ok'; }
  else { st.textContent='未记录'; st.className='state miss'; }
  // 最近7天
  const days=[];
  for(let i=6;i>=0;i--){ days.push(fmtDate(addDays(new Date(),-i))); }
  const recs = days.map(dd=>({d:dd, r:getRec(dd,'weight')})).filter(x=>x.r);
  document.getElementById('wRecent').innerHTML = recs.length
    ? recs.map(x=>`<div class="note-item"><span>${x.d}</span><b>${x.r.data.kg} kg</b></div>`).join('')
    : '<div class="note-item">最近 7 天暂无记录</div>';
  // 目标条
  const cur = r ? r.data.kg : 0;
  const pct = cur ? Math.min(100, (cur-(goal-10))/15*100) : 0;
  document.getElementById('wBar').style.width = pct+'%';
  document.getElementById('wHint').textContent = r ? (r.data.kg>=goal ? `✅ 已达到 ${goal}kg 目标线，继续保持！` : `还差 ${(goal-r.data.kg).toFixed(1)}kg 达到 ${goal}kg 目标`) : '输入今日体重开始记录';
  document.getElementById('chartGoal').textContent = goal;
  drawWeightChart();
}
function saveWeight(){
  const v=parseFloat(document.getElementById('wInput').value);
  if(!v || v<30 || v>150){ alert('请输入合理的体重（30–150kg）'); return; }
  setRec(currentDate,'weight',{kg:v});
  renderWeight(); renderToday();
}
function fillToday(id){ document.getElementById(id).value=''; }

/* 体重图表 */
function drawWeightChart(){
  const goal = GOALS.weightKg;
  const cv=document.getElementById('weightChart'); const ctx=cv.getContext('2d');
  const W=cv.clientWidth||cv.offsetWidth||300; const H=180;
  cv.width=W; cv.height=H;
  ctx.clearRect(0,0,W,H);
  const pts=[];
  for(let i=60;i>=0;i--){
    const d=fmtDate(addDays(new Date(),-i));
    const r=getRec(d,'weight'); if(r) pts.push({d, kg:r.data.kg});
  }
  if(!pts.length){
    ctx.fillStyle=getComputedStyle(document.body).getPropertyValue('--muted');
    ctx.font='13px sans-serif'; ctx.textAlign='center';
    ctx.fillText('暂无数据，开始记录后这里会显示趋势', W/2, H/2);
    return;
  }
  const vals=pts.map(p=>p.kg);
  const lo=Math.min(...vals, goal-4)-1, hi=Math.max(...vals, goal+1)+1;
  const pad=30;
  const X=i=>pad+(W-pad*2)*i/(pts.length-1);
  const Y=v=>H-20-(H-40)*(v-lo)/(hi-lo);
  // 目标线
  ctx.strokeStyle=getComputedStyle(document.body).getPropertyValue('--good');
  ctx.setLineDash([5,4]); ctx.beginPath();
  ctx.moveTo(0,Y(goal)); ctx.lineTo(W,Y(goal)); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle='#16a34a'; ctx.font='11px sans-serif'; ctx.fillText(`目标 ${goal}kg`, W-60, Y(goal)-4);
  // 折线
  ctx.strokeStyle=getComputedStyle(document.body).getPropertyValue('--accent');
  ctx.lineWidth=2; ctx.beginPath();
  pts.forEach((p,i)=>{ i?ctx.lineTo(X(i),Y(p.kg)):ctx.moveTo(X(i),Y(p.kg)); });
  ctx.stroke();
  // 点
  pts.forEach((p,i)=>{
    ctx.fillStyle='#e11d48'; ctx.beginPath(); ctx.arc(X(i),Y(p.kg),3,0,Math.PI*2); ctx.fill();
  });
  // 轴
  ctx.fillStyle=getComputedStyle(document.body).getPropertyValue('--muted');
  ctx.font='10px sans-serif';
  ctx.fillText(lo.toFixed(1)+'kg', 4, H-14);
  ctx.fillText(hi.toFixed(1)+'kg', 4, 14);
  const last=pts[pts.length-1].kg;
  ctx.textAlign='center'; ctx.fillText('最近：'+last.toFixed(1)+'kg', W/2, H-2);
  // 汇总
  document.getElementById('chartCur').textContent = last.toFixed(1)+'kg';
  const wk=pts.filter(p=>p.d>=fmtDate(addDays(new Date(),-7)));
  document.getElementById('chartDelta').textContent = wk.length>=2 ? (last-wk[0].kg>=0?'+':'')+(last-wk[0].kg).toFixed(1)+'kg' : '—';
}

/* ================= 用药 ================= */
function renderMed(){
  const r=getRec(currentDate,'med');
  const st=document.getElementById('mState');
  if(r){
    const n=SUPPLEMENTS.filter(s=>r.data.items[s.id]).length;
    st.textContent=n+'/'+SUPPLEMENTS.length+' 项已服';
    st.className='state '+(n===SUPPLEMENTS.length?'ok':'miss');
  }
  else { st.textContent='未打卡'; st.className='state miss'; }
  const items = r ? r.data.items : {};
  document.getElementById('medGrid').innerHTML = SUPPLEMENTS.map(s=>`
    <div class="chip ${items[s.id]?'active':''}" onclick="toggleMed('${s.id}')">${esc(s.name)}<br><small style="font-size:10px">${esc(s.dose)}</small></div>
  `).join('');
  // 最近 N 天叶酸
  const days=[];
  for(let i=GOALS.medStreakDays-1;i>=0;i--){ days.push(fmtDate(addDays(new Date(),-i))); }
  const recs=days.map(dd=>{const x=getRec(dd,'med'); return {d:dd, ok:!!(x&&x.data.items.folic)};});
  document.getElementById('medRecent').innerHTML =
    `<div class="note-item"><span>近${GOALS.medStreakDays}天叶酸</span><span>${recs.map(x=>`<span class="pill ${x.ok?'green':'red'}" style="margin:0 2px">${x.ok?'✓':'✗'}</span>`).join('')}</span></div>`
    + `<div class="note-item"><span>漏服提醒</span><b>${recs.filter(x=>!x.ok).length} 天未服</b></div>`;
}
function toggleMed(id){
  const r=getRec(currentDate,'med');
  const items = r ? JSON.parse(JSON.stringify(r.data.items)) : {};
  if(!items[id]) items[id]=true; else delete items[id];
  setRec(currentDate,'med',{items});
  renderMed(); renderToday();
}

/* ================= 饮食 ================= */
function renderDiet(){
  const r=getRec(currentDate,'diet');
  const items = r ? r.data.items : [];
  const {c,p}=sumDiet(items);
  document.getElementById('dCalSum').textContent=c;
  document.getElementById('dProSum').textContent=p;
  const pct=Math.min(100,Math.round(c/GOALS.kcalPerDay*100));
  document.getElementById('dGoalPct').textContent=pct+'%';
  document.getElementById('dCalGoalTxt').textContent=`/${GOALS.kcalPerDay} kcal`;
  document.getElementById('dProGoalTxt').textContent=`/${GOALS.proteinPerDay} g 蛋白`;
  const st=document.getElementById('dState');
  if(c>=GOALS.kcalPerDay&&p>=GOALS.proteinPerDay){st.textContent='目标达成';st.className='state ok';}
  else if(c>=Math.round(GOALS.kcalPerDay*2/3)){st.textContent='进行中';st.className='state miss';}
  else {st.textContent='未达标';st.className='state miss';}
  // 餐次 chips
  document.getElementById('mealChips').innerHTML=MEALS.map(m=>`<span class="chip ${m===curMeal?'active':''}" onclick="curMeal='${m}';renderDiet()">${esc(m)}</span>`).join('');
  // 快捷食物
  document.getElementById('foodQuick').innerHTML=FOOD_PRESETS.map((f,i)=>`<span class="chip" onclick="quickFood(${i})">${esc(f.n)}<br><small style="font-size:10px">${f.k}kcal</small></span>`).join('');
  // 列表（用户输入过 esc 防 XSS）
  document.getElementById('dList').innerHTML = items.length
    ? items.map((it,i)=>`<div class="note-item"><span>${esc(it.meal)} · ${esc(it.name)}</span><span>${it.kcal||0}kcal · ${it.pro||0}g <span class="del" onclick="delDietItem(${i})">✕</span></span></div>`).join('')
    : '<div class="note-item">今日暂无饮食记录</div>';
}
let curMeal=MEALS[0];
function quickFood(i){
  const f=FOOD_PRESETS[i];
  setRec(currentDate,'diet',{items:[...(getRec(currentDate,'diet')?.data.items||[]), {meal:curMeal,name:f.n,kcal:f.k,pro:f.p}]});
  renderDiet(); renderToday();
}
function addDietItem(){
  const name=document.getElementById('dName').value.trim();
  const k=parseFloat(document.getElementById('dKcal').value)||0;
  const pr=parseFloat(document.getElementById('dPro').value)||0;
  if(!name){ alert('请输入食物名称'); return; }
  const items=[...(getRec(currentDate,'diet')?.data.items||[]), {meal:curMeal,name,kcal:k,pro:pr}];
  setRec(currentDate,'diet',{items});
  document.getElementById('dName').value=''; document.getElementById('dKcal').value=''; document.getElementById('dPro').value='';
  renderDiet(); renderToday();
}
function delDietItem(i){
  const items=[...(getRec(currentDate,'diet')?.data.items||[])]; items.splice(i,1);
  setRec(currentDate,'diet',{items});
  renderDiet(); renderToday();
}
function clearDiet(){
  if(!confirm('确定清空今日所有饮食记录？')) return;
  setRec(currentDate,'diet',{items:[]});
  renderDiet(); renderToday();
}

/* ================= 周期 / 排卵 ================= */
function getPeriodEvents(){
  const evs=[];
  for(const d in cache){
    const r=cache[d] && cache[d]['cycle'];
    if(r && r.data.events){ r.data.events.forEach(e=>evs.push({d, ...e})); }
  }
  return evs.sort((a,b)=>a.d.localeCompare(b.d));
}
function renderCycle(){
  const evs=getPeriodEvents().filter(e=>e.d===currentDate);
  const st=document.getElementById('cState');
  st.textContent = evs.length ? evs.map(e=>e.type==='start'?'经期开始':'经期结束').join('、') : '未记录';
  st.className = evs.length?'state ok':'state miss';
  const days=[];
  for(let i=20;i>=0;i--){ days.push(fmtDate(addDays(new Date(),-i))); }
  const rows=days.map(dd=>{
    const r=getRec(dd,'cycle');
    const es=r?r.data.events:null;
    return {d:dd, es};
  }).filter(x=>x.es&&x.es.length);
  document.getElementById('cycleRecent').innerHTML = rows.length
    ? rows.map(x=>`<div class="note-item"><span>${x.d}</span><span>${x.es.map(e=>e.type==='start'?'🩸开始':'◼︎结束').join(' ')}</span></div>`).join('')
    : '<div class="note-item">暂无经期记录</div>';
  // 事件chips
  document.getElementById('cycleChips').innerHTML = ['经期开始','经期结束'].map((m,i)=>`<span class="chip ${cycleSel===i?'active':''}" onclick="cycleSel=${i};renderCycle()">${m}</span>`).join('');
  // 预测
  const fp=predictFertile(getPeriodEvents(), todayStr());
  document.getElementById('cycleHint').textContent=fp.text;
  if(fp.fertileDays.length){
    document.getElementById('cycleHint2').innerHTML =
      '<b>📅 排卵窗口</b><br>'+fp.fertileDays.map(x=>`<span class="pill ${x===todayStr()?'red':'green'}">${x}${x===todayStr()?' (今天)':''}</span>`).join('');
  } else {
    document.getElementById('cycleHint2').innerHTML=fp.text;
  }
  renderOpk();
}
let cycleSel=0;
function addCycleEvent(){
  const type = cycleSel===0?'start':'end';
  const cur=getRec(currentDate,'cycle');
  const events = cur ? JSON.parse(JSON.stringify(cur.data.events||[])) : [];
  events.push({type, ts:Date.now()});
  setRec(currentDate,'cycle',{events});
  renderCycle(); renderToday();
}
/* 排卵试纸 */
let opkSel=null;
function renderOpk(){
  const r=getRec(currentDate,'opk');
  const val = r?r.data.test:null;
  document.getElementById('opkChips').innerHTML = ['阴性','弱阳','强阳'].map((m,i)=>{
    const v=['neg','weak','pos'][i];
    return `<span class="chip ${val===v?'active':''}" onclick="opkSel='${v}';saveOpk()">${m}</span>`;
  }).join('');
  const bbt=r&&r.data.bbt?r.data.bbt:'';
  document.getElementById('bbtInput').value=bbt;
}
function saveOpk(){
  const r=getRec(currentDate,'opk');
  const data = r ? JSON.parse(JSON.stringify(r.data)) : {};
  if(opkSel) data.test=opkSel;
  const bbt=parseFloat(document.getElementById('bbtInput').value);
  if(bbt) data.bbt=bbt;
  setRec(currentDate,'opk',{...data});
  renderOpk(); renderToday();
}

/* ================= 同房 ================= */
function renderIntimacy(){
  const r=getRec(currentDate,'intimacy');
  const items = r?r.data.items:[];
  const st=document.getElementById('iState');
  st.textContent = items.length ? items.length+' 次' : '未记录';
  st.className = items.length?'state ok':'state miss';
  const fp=predictFertile(getPeriodEvents(), currentDate);
  const inWin = fp.fertileDays.includes(currentDate);
  document.getElementById('intimacyHint').innerHTML = inWin
    ? '📍 <b>今天在预测排卵窗口内</b>——受孕机率高，可安排同房。'
    : (fp.text.includes('不足')?fp.text:'今天不在预测窗口内，但精子可存活 3–5 天，窗口前后 1–2 天同房同样有效。');
  // 备注为用户输入，esc 防 XSS
  document.getElementById('iRecent').innerHTML = items.length
    ? items.map((it,i)=>`<div class="note-item"><span>${currentDate} ${esc(it.time||'')}</span><span>${esc(it.note||'同房')} <span class="del" onclick="removeIntimacy(${i})">✕</span></span></div>`).join('')
    : '<div class="note-item">今日暂无记录</div>';
}
function addIntimacy(){
  const note=document.getElementById('iNote').value.trim();
  const items=[...(getRec(currentDate,'intimacy')?.data.items||[]), {note:note||'同房', time:new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})}];
  setRec(currentDate,'intimacy',{items});
  document.getElementById('iNote').value='';
  renderIntimacy(); renderToday();
}
function removeIntimacy(i){
  const items=[...(getRec(currentDate,'intimacy')?.data.items||[])]; items.splice(i,1);
  setRec(currentDate,'intimacy',{items});
  renderIntimacy(); renderToday();
}
function removeLastIntimacy(){
  const items=[...(getRec(currentDate,'intimacy')?.data.items||[])]; if(!items.length) return;
  items.pop(); setRec(currentDate,'intimacy',{items}); renderIntimacy(); renderToday();
}

/* ================= 运动 ================= */
let curEx=EX_TYPES[0];
function renderExercise(){
  const r=getRec(currentDate,'exercise');
  const items=r?r.data.items:[];
  const st=document.getElementById('eState');
  st.textContent=items.length?items.map(x=>x.type).join('、'):'未记录';
  st.className=items.length?'state ok':'state miss';
  document.getElementById('exChips').innerHTML=EX_TYPES.map(t=>`<span class="chip ${t===curEx?'active':''}" onclick="curEx='${t}';renderExercise()">${esc(t)}</span>`).join('');
  document.getElementById('exRecent').innerHTML=items.length
    ? items.map((it,i)=>`<div class="note-item"><span>${esc(it.type)} · ${it.min}min · ${esc(it.int)}</span><span class="del" onclick="delEx(${i})">✕</span></div>`).join('')
    : '<div class="note-item">今日暂无运动</div>';
}
function addExercise(){
  const min=parseInt(document.getElementById('exMin').value);
  if(!min||min<=0){alert('请输入时长');return;}
  const int=document.getElementById('exInt').value;
  const items=[...(getRec(currentDate,'exercise')?.data.items||[]),{type:curEx,min,int}];
  setRec(currentDate,'exercise',{items});
  document.getElementById('exMin').value='';
  renderExercise(); renderToday();
}
function delEx(i){
  const items=[...(getRec(currentDate,'exercise')?.data.items||[])]; items.splice(i,1);
  setRec(currentDate,'exercise',{items});
  renderExercise(); renderToday();
}

/* ================= 睡眠 ================= */
let sleepQ=2;
function renderSleep(){
  const r=getRec(currentDate,'sleep');
  const st=document.getElementById('sState');
  if(r){ st.textContent=r.data.hours+'h'; st.className=r.data.hours>=GOALS.sleepHours?'state ok':'state miss'; }
  else { st.textContent='未记录'; st.className='state miss'; }
  document.getElementById('sleepH').value = r?r.data.hours:'';
  sleepQ = r?r.data.q:2;
  document.getElementById('sleepQChips').innerHTML=SLEEP_QUAL.map((m,i)=>`<span class="chip ${i===sleepQ?'active':''}" onclick="sleepQ=${i};renderSleep()">${esc(m)}</span>`).join('');
}
function saveSleep(){
  const h=parseFloat(document.getElementById('sleepH').value);
  if(!h||h<=0){alert('请输入睡眠时长');return;}
  setRec(currentDate,'sleep',{hours:h,q:sleepQ});
  renderSleep(); renderToday();
}

/* ================= 情绪与症状 ================= */
let moodSel=3, symSel={};
function renderMood(){
  const r=getRec(currentDate,'mood');
  const st=document.getElementById('moState');
  if(r){ st.textContent=MOODS[r.data.mood]||'已记录'; st.className='state ok'; }
  else { st.textContent='未记录'; st.className='state miss'; }
  if(r){ moodSel=r.data.mood; symSel={}; r.data.sym.forEach(s=>symSel[s]=true); document.getElementById('moNote').value=r.data.note||''; }
  document.getElementById('moodChips').innerHTML=MOODS.map((m,i)=>`<span class="chip ${i===moodSel?'active':''}" onclick="moodSel=${i};renderMood()">${esc(m)}</span>`).join('');
  document.getElementById('symChips').innerHTML=SYMPTOMS.map(s=>`<span class="chip ${symSel[s]?'active':''}" onclick="toggleSym('${s}')">${esc(s)}</span>`).join('');
}
function toggleSym(s){ symSel[s]=!symSel[s]; renderMood(); }
function saveMood(){
  const note=document.getElementById('moNote').value.trim();
  const sym=Object.keys(symSel).filter(s=>symSel[s]);
  setRec(currentDate,'mood',{mood:moodSel,sym,note});
  renderMood(); renderToday();
}

/* ================= 报表 ================= */
function renderReport(){
  const m = new Date();
  const ym = m.getFullYear()+'-'+String(m.getMonth()+1).padStart(2,'0');
  document.getElementById('repMonthLabel').textContent=' · '+ym;
  const monthDays=[];
  for(let i=0;i<31;i++){
    const d=addDays(new Date(m.getFullYear(),m.getMonth(),1), i);
    if(d.getMonth()!==m.getMonth()) break;
    monthDays.push(fmtDate(d));
  }
  const wRecs=monthDays.map(dd=>getRec(dd,'weight')?.data.kg).filter(x=>x);
  document.getElementById('rAvgW').textContent = wRecs.length? (wRecs.reduce((a,b)=>a+b,0)/wRecs.length).toFixed(1)+'kg' : '—';
  document.getElementById('rDeltaW').textContent = wRecs.length>=2 ? (wRecs[wRecs.length-1]-wRecs[0]>=0?'+':'')+(wRecs[wRecs.length-1]-wRecs[0]).toFixed(1)+'kg' : '—';
  const folicDays=monthDays.filter(dd=>{const x=getRec(dd,'med');return x&&x.data.items.folic;}).length;
  document.getElementById('rFolic').textContent = Math.round(folicDays/monthDays.length*100)+'%';
  const calS=monthDays.map(dd=>sumDiet(getRec(dd,'diet')?.data.items||[]).c).filter(c=>c>0);
  const proS=monthDays.map(dd=>sumDiet(getRec(dd,'diet')?.data.items||[]).p).filter(p=>p>0);
  document.getElementById('rCalAvg').textContent = calS.length?Math.round(calS.reduce((a,b)=>a+b,0)/calS.length):'—';
  document.getElementById('rProAvg').textContent = proS.length?Math.round(proS.reduce((a,b)=>a+b,0)/proS.length)+'g':'—';
  const exWeeks=Math.max(1, Math.ceil(monthDays.length/7));
  const exCount=Object.keys(cache).filter(d=>d.slice(0,7)===ym&&cache[d]['exercise']).length;
  document.getElementById('rExWk').textContent=(exCount/exWeeks).toFixed(1)+'次';
  const slp=monthDays.map(dd=>getRec(dd,'sleep')?.data.hours).filter(x=>x);
  document.getElementById('rSleep').textContent=slp.length?(slp.reduce((a,b)=>a+b,0)/slp.length).toFixed(1)+'h':'—';
  const cs=cycleStats(getPeriodEvents());
  document.getElementById('rCycle').textContent = cs.starts.length>=2?cs.avgLen+'天':(cs.starts.length?'记录中':'—');
  const inCnt=Object.keys(cache).filter(d=>d.slice(0,7)===ym&&cache[d]['intimacy']).length;
  document.getElementById('rIntimacy').textContent=inCnt+'次';
  document.getElementById('rFertile').textContent=predictFertile(getPeriodEvents(), todayStr()).text;
}

/* ================= 导出/导入 ================= */
function exportData(){
  const blob=new Blob([JSON.stringify({cfg:config, cache, exported:new Date().toISOString()},null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='备孕记录备份_'+todayStr()+'.json'; a.click();
  URL.revokeObjectURL(a.href);
}
function importData(e){
  const f=e.target.files[0]; if(!f) return;
  const rd=new FileReader();
  rd.onload=()=>{
    try{
      const j=JSON.parse(rd.result);
      const check = validateImport(j);
      if(!check.ok){ alert('导入失败：'+check.error); return; }
      let n=0;
      for(const d in j.cache){
        for(const t in j.cache[d]){
          const v=j.cache[d][t];
          cache[d]=cache[d]||{};
          cache[d][t]={data: migrateRec(t, v.data), ts:v.ts||Date.now()};
          n++;
        }
      }
      saveCacheLocal(); scheduleSync(); render();
      alert(`导入成功：${n} 条记录，正在同步…`);
    }catch(err){ alert('导入失败：'+err.message); }
  };
  rd.readAsText(f);
  e.target.value='';
}

/* ================= 配置页 ================= */
let selectedRole = '';
function pickRole(r){
  selectedRole = r;
  document.querySelectorAll('#roleChips .chip').forEach(c=>c.classList.toggle('active', c.dataset.role===r));
}
function openSettings(){
  if(!config){ document.getElementById('setupPage').classList.remove('hidden'); return; }
  if(confirm('重新配置或切换家庭编码？')){ document.getElementById('setupPage').classList.remove('hidden'); }
}
async function saveConfig(){
  const family=document.getElementById('cfgFam').value.trim();
  const box=document.getElementById('connResult');
  if(!selectedRole){ box.textContent='请先选择角色（丈夫/妻子）'; return; }
  if(!family){ box.textContent='请输入家庭编码'; return; }
  if(family.length<8 || !/^[A-Za-z0-9_]+$/.test(family)){ box.textContent='家庭编码需 8 位以上字母+数字混合（如 Love2026）'; return; }
  box.textContent='⏳ 正在连接云端…';
  // 1. 匿名登录（每台设备一个账户）
  const auth = await ensureAuth();
  if(auth.error==='anonymous_disabled'){
    box.textContent='请在 Supabase 控制台开启匿名登录：Authentication → Providers → Anonymous sign-ins';
    return;
  }
  if(auth.error){ box.textContent='登录失败：'+auth.error; return; }
  // 2. 加入 / 创建家庭（家庭码即钥匙，仅此一次发送）
  const jf = await joinFamily(family);
  if(jf.error){
    box.textContent = jf.error==='invalid_code' ? '家庭编码需 8 位以上字母+数字混合' : '加入家庭失败：'+jf.error;
    return;
  }
  config={family, role:selectedRole};
  saveConfigLocal();
  loadCache();
  document.getElementById('setupPage').classList.add('hidden');
  document.getElementById('roleTag').textContent = '· '+(selectedRole==='妻子'?'👩 妻子':'👨 丈夫');
  buildTabs(); render(); syncNow();
  box.textContent = jf.created
    ? '⚠️ 该编码是新家庭，已创建。请和另一半填<u>同一个编码</u>，两边数据才会共享。'
    : '✅ 已保存，记录将自动同步到云端。';
  setTimeout(()=>{ box.textContent=''; }, 5000);
}
function switchFamily(){
  if(confirm('切换家庭编码会读取该编码对应的数据。确定继续？')){
    config=null; localStorage.removeItem(LS_CFG);
    document.getElementById('setupPage').classList.remove('hidden');
  }
}

/* ================= 底部导航 ================= */
function buildTabs(){
  document.getElementById('tabbar').innerHTML=TABS.map(t=>`<button class="tab ${t.id===selectedTab?'active':''}" data-tab="${t.id}" onclick="switchPage('${t.id}')"><span class="ico">${t.ico}</span>${t.label}</button>`).join('');
}
