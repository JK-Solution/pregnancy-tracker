import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/* logic.js 是浏览器经典脚本（无 import/export），用 vm 加载后取其导出 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
function loadLogic(){
  const ctx = { module: { exports: {} }, exports: {} };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(path.join(__dirname, '../js/logic.js'), 'utf8'), ctx, { filename: 'logic.js' });
  return ctx.module.exports;
}
const L = loadLogic();
const { fmtDate, parseDate, addDays, daysBetween, humanDate,
        sumDiet, dietCalOk, medAllDone, esc,
        cycleStats, predictFertile, migrateRec, validateImport } = L;

describe('日期工具', () => {
  it('fmtDate 格式化', () => {
    expect(fmtDate(new Date(2026, 7, 11))).toBe('2026-08-11');
  });
  it('parseDate 解析', () => {
    expect(parseDate('2026-08-11').getDate()).toBe(11);
  });
  it('addDays 跨月', () => {
    expect(fmtDate(addDays(parseDate('2026-08-31'), 1))).toBe('2026-09-01');
  });
  it('daysBetween', () => {
    expect(daysBetween('2026-08-01', '2026-08-11')).toBe(10);
  });
  it('humanDate 含星期', () => {
    expect(humanDate('2026-08-11')).toContain('周');
  });
});

describe('饮食统计', () => {
  it('sumDiet 累加热量与蛋白', () => {
    expect(sumDiet([{kcal:180, pro:28}, {kcal:160, pro:13}])).toEqual({c:340, p:41});
  });
  it('sumDiet 容忍空数组', () => {
    expect(sumDiet([])).toEqual({c:0, p:0});
  });
  it('dietCalOk 按阈值判定', () => {
    expect(dietCalOk([{kcal:1600}], 1600)).toBe(true);
    expect(dietCalOk([{kcal:1599}], 1600)).toBe(false);
    expect(dietCalOk(null, 1600)).toBe(false);
  });
});

describe('用药打卡', () => {
  const S = [{id:'folic'}, {id:'aspirin'}];
  it('全部已服才算达标', () => {
    expect(medAllDone({folic:true, aspirin:true}, S)).toBe(true);
    expect(medAllDone({folic:true}, S)).toBe(false);
  });
  it('无记录不算达标', () => {
    expect(medAllDone(null, S)).toBe(false);
    expect(medAllDone({}, S)).toBe(false);
  });
});

describe('HTML 转义（防 XSS）', () => {
  it('转义尖括号引号与 &', () => {
    expect(esc('<b onclick="x">&\'')).toBe('&lt;b onclick=&quot;x&quot;&gt;&amp;&#39;');
  });
  it('空值安全', () => {
    expect(esc(null)).toBe('');
    expect(esc(undefined)).toBe('');
  });
});

describe('周期与排卵计算', () => {
  it('无记录时给出引导文案', () => {
    expect(cycleStats([]).lastStart).toBe(null);
    expect(predictFertile([], '2026-08-11').text).toContain('记录');
  });
  it('两次经期开始算出平均周期', () => {
    const evs = [
      {d:'2026-07-01', type:'start'},
      {d:'2026-07-29', type:'start'},
    ];
    expect(cycleStats(evs).avgLen).toBe(28);
    expect(cycleStats(evs).lastStart).toBe('2026-07-29');
  });
  it('默认周期 28 天 → 排卵日 = 开始日+14', () => {
    const evs = [{d:'2026-08-01', type:'start'}];
    const fp = predictFertile(evs, '2026-08-11');
    expect(fp.fertileDays).toHaveLength(6);
    expect(fp.fertileDays[0]).toBe('2026-08-12');
    expect(fp.fertileDays[5]).toBe('2026-08-17');
    expect(fp.inWin).toBe(false);
    expect(fp.text).toContain('2026-08-15');
  });
  it('窗口内日期正确标红', () => {
    const evs = [{d:'2026-08-01', type:'start'}];
    expect(predictFertile(evs, '2026-08-14').inWin).toBe(true);
    expect(predictFertile(evs, '2026-08-18').inWin).toBe(false);
  });
  it('长周期（35天）排卵日延后', () => {
    const evs = [
      {d:'2026-07-01', type:'start'},
      {d:'2026-08-05', type:'start'},   // 35 天
    ];
    const fp = predictFertile(evs, '2026-08-11');
    // ovuIdx=21 → 排卵日 08-26 → 窗口 08-23~08-28
    expect(fp.fertileDays[0]).toBe('2026-08-23');
    expect(fp.fertileDays[5]).toBe('2026-08-28');
  });
});

describe('数据迁移', () => {
  it('写入打版本号', () => {
    expect(migrateRec('med', {items:{folic:true}}).v).toBe(2);
    expect(migrateRec('med', {items:{folic:true}}).items.folic).toBe(true);
  });
  it('容错损坏数据并兜底结构', () => {
    expect(migrateRec('med', null).items).toEqual({});
    expect(migrateRec('med', '垃圾').items).toEqual({});
    expect(migrateRec('diet', null).items).toEqual([]);
    expect(migrateRec('cycle', {events:null}).events).toEqual([]);
  });
});

describe('导入校验', () => {
  it('接受合法备份', () => {
    const r = validateImport({cache:{'2026-08-01':{weight:{data:{kg:48}}}}});
    expect(r.ok).toBe(true);
    expect(r.count).toBe(1);
  });
  it('拒绝缺少 cache 的数据', () => {
    expect(validateImport({}).ok).toBe(false);
    expect(validateImport(null).ok).toBe(false);
  });
  it('拒绝非法日期', () => {
    expect(validateImport({cache:{'2026-13-40':{x:{data:{}}}}}).ok).toBe(false);
  });
  it('拒绝超大数据', () => {
    expect(validateImport({cache:{'2026-08-01':{weight:{data:{big:'x'.repeat(200000)}}}}}).ok).toBe(false);
  });
});
