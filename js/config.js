/* ================= 配置（所有可调参数集中在这里，改需求不用翻代码） ================= */

/* 用药 / 补充剂列表：id 是数据键，改名会丢历史打卡记录，慎改 */
const SUPPLEMENTS = [
  {id:'folic', name:'叶酸', dose:'400–800µg'},
  {id:'aspirin', name:'阿司匹林', dose:'~100mg'},
  {id:'hcq', name:'硫酸氢氯奎片', dose:'~200mg'},
  {id:'coq10', name:'辅酶Q10', dose:'100–200mg'},
  {id:'vitc', name:'维生素C', dose:'~100mg'},
  {id:'vitb', name:'维生素B', dose:'1片'},
  {id:'zinc', name:'葡萄糖酸锌', dose:'~70mg'},
  {id:'iron', name:'铁', dose:'~20mg'},
  {id:'vitd', name:'维生素D', dose:'400–800IU'},
  {id:'dha', name:'DHA', dose:'≥200mg'},
];

const MEALS = ['早餐','加餐1','午餐','加餐2','晚餐'];
const FOOD_PRESETS = [
  {n:'鸡胸/瘦肉', k:180, p:28},{n:'鸡蛋2个', k:160, p:13},{n:'鱼/三文鱼', k:220, p:22},
  {n:'米饭1碗', k:230, p:4},{n:'全麦面包2片', k:160, p:6},{n:'红薯/玉米', k:130, p:3},
  {n:'牛奶1杯', k:150, p:8},{n:'酸奶1杯', k:140, p:5},{n:'豆浆', k:90, p:7},
  {n:'坚果一把', k:150, p:5},{n:'牛油果', k:160, p:2},{n:'香蕉', k:100, p:1},
  {n:'蛋白粉+奶', k:220, p:25},{n:'花生酱吐司', k:220, p:6},{n:'燕麦片', k:150, p:5},
];
const EX_TYPES = ['力量训练','有氧','瑜伽/普拉提','核心训练','快走','游泳'];
const SLEEP_QUAL = ['很差','差','一般','好','很好'];
const MOODS = ['😖很差','😟差','😐一般','🙂好','😄很好'];
const SYMPTOMS = ['腹痛','腰酸','恶心','乏力','白带异常','头痛','情绪波动','失眠','食欲不振','腹胀'];

/* 目标值：改动即全应用生效（体重线、热量、蛋白、睡眠、云端拉取窗口等） */
const GOALS = {
  weightKg: 50,            // 体重目标线
  kcalPerDay: 1800,        // 每日热量目标
  proteinPerDay: 60,       // 每日蛋白目标(g)
  kcalMin: 1600,           // 饮食"今日打卡"达标下限
  sleepHours: 7,           // 睡眠目标(小时)
  pullDays: 365,           // 云端拉取窗口(天)，新设备可见的历史长度
  medStreakDays: 7,        // 用药连续打卡统计天数（近7天叶酸）
};

const TABS = [
  {id:'today', ico:'🏠', label:'今日'},
  {id:'weight', ico:'⚖️', label:'体重'},
  {id:'med', ico:'💊', label:'用药'},
  {id:'diet', ico:'🍚', label:'饮食'},
  {id:'cycle', ico:'📅', label:'周期'},
  {id:'intimacy', ico:'💞', label:'同房'},
  {id:'exercise', ico:'🏋️', label:'运动'},
  {id:'sleep', ico:'😴', label:'睡眠'},
  {id:'mood', ico:'🌤️', label:'心情'},
  {id:'report', ico:'📊', label:'报表'},
];

/* Node 环境（单元测试）导出 */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SUPPLEMENTS, MEALS, FOOD_PRESETS, EX_TYPES, SLEEP_QUAL, MOODS, SYMPTOMS, GOALS, TABS };
}
