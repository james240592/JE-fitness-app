// 本地饮食文字 -> 营养估算。不调用任何外部服务，纯字符串匹配 + foods 表数据。
//
// 思路：
// 1. 在全文里一次性找出所有"食物名/别名"出现的位置（长关键词优先，避免"鸡胸肉"被"鸡肉"抢先命中）。
// 2. 在全文里一次性找出所有"数字+分量"标记（150g / 半碗 / 两个 …），按位置记录。
// 3. 按文本里出现的先后顺序，给每个食物就近分配一个"还没被用过"的分量标记，就近优先、用过的标记不能再给别的食物用，
//    避免出现"两种食物挨在一起，同一个数字被重复计算"的问题。

const UNIT_GRAMS = { 碗: 150, 份: 100, 个: 100, 根: 100, 颗: 50, 杯: 200, 块: 100, 片: 30, 只: 100 };
const NUM_WORDS = { 半: 0.5, 一: 1, 两: 2, 二: 2, 三: 3, 四: 4, 五: 5 };
const MAX_GAP = 6; // 数字标记离食物名太远（超过6个字符）就不认为是同一处描述

function buildKeywords(foods) {
  const list = [];
  for (const food of foods) {
    const names = [food.name, ...(food.aliases || [])];
    for (const kw of names) {
      if (kw) list.push({ kw, food });
    }
  }
  return list.sort((a, b) => b.kw.length - a.kw.length);
}

function findNameMatches(text, foods) {
  const keywords = buildKeywords(foods);
  const consumed = new Array(text.length).fill(false);
  const matches = [];
  const seenFoodIds = new Set();

  for (const { kw, food } of keywords) {
    if (seenFoodIds.has(food.id)) continue;
    let idx = text.indexOf(kw);
    while (idx !== -1) {
      const end = idx + kw.length;
      if (!consumed.slice(idx, end).some(Boolean)) {
        for (let i = idx; i < end; i++) consumed[i] = true;
        seenFoodIds.add(food.id);
        matches.push({ food, start: idx, end });
        break;
      }
      idx = text.indexOf(kw, idx + 1);
    }
  }
  return matches.sort((a, b) => a.start - b.start);
}

function findQuantityMarks(text) {
  const marks = [];
  const gramsRe = /(\d+(?:\.\d+)?)\s*(?:g|G|克)/g;
  let m;
  while ((m = gramsRe.exec(text))) {
    marks.push({ start: m.index, end: m.index + m[0].length, grams: parseFloat(m[1]) });
  }
  const unitRe = /(\d+(?:\.\d+)?|[一二两三四五半])\s*(碗|份|个|根|颗|杯|块|片|只)/g;
  while ((m = unitRe.exec(text))) {
    marks.push({ start: m.index, end: m.index + m[0].length, numRaw: m[1], unit: m[2] });
  }
  return marks;
}

function markToGrams(mark, food) {
  if (mark.grams != null) return mark.grams;
  const num = NUM_WORDS[mark.numRaw] !== undefined ? NUM_WORDS[mark.numRaw] : parseFloat(mark.numRaw);
  const perUnit = (food.default_unit_grams && food.default_unit_grams[mark.unit]) || UNIT_GRAMS[mark.unit] || 100;
  return num * perUnit;
}

function gapToMatch(mark, nameStart, nameEnd) {
  if (mark.end <= nameStart) return nameStart - mark.end; // 标记在食物名前面
  if (mark.start >= nameEnd) return mark.start - nameEnd; // 标记在食物名后面
  return Infinity; // 与食物名重叠，不可能发生，保险起见排除
}

// 返回 { matched: [{food, grams}], unmatchedFoods: [food], totals: {calories,protein,fat,carbs} | null }
export function estimateNutrition(text, foods) {
  if (!text || !foods?.length) return { matched: [], unmatchedFoods: [], totals: null };

  const nameMatches = findNameMatches(text, foods);
  const quantityMarks = findQuantityMarks(text);
  const usedMarks = new Array(quantityMarks.length).fill(false);

  const matched = [];
  const unmatchedFoods = [];

  for (const { food, start, end } of nameMatches) {
    let bestIdx = -1;
    let bestGap = Infinity;
    quantityMarks.forEach((mark, i) => {
      if (usedMarks[i]) return;
      const gap = gapToMatch(mark, start, end);
      if (gap <= MAX_GAP && gap < bestGap) { bestGap = gap; bestIdx = i; }
    });
    if (bestIdx === -1) {
      unmatchedFoods.push(food);
      continue;
    }
    usedMarks[bestIdx] = true;
    const grams = markToGrams(quantityMarks[bestIdx], food);
    if (grams > 0) matched.push({ food, grams });
    else unmatchedFoods.push(food);
  }

  if (matched.length === 0) return { matched: [], unmatchedFoods, totals: null };

  const raw = matched.reduce((acc, { food, grams }) => {
    const ratio = grams / 100;
    acc.calories += food.calories_per_100g * ratio;
    acc.protein += food.protein_per_100g * ratio;
    acc.fat += food.fat_per_100g * ratio;
    acc.carbs += food.carbs_per_100g * ratio;
    return acc;
  }, { calories: 0, protein: 0, fat: 0, carbs: 0 });

  const round1 = (n) => Math.round(n * 10) / 10;
  return {
    matched,
    unmatchedFoods,
    totals: {
      calories: Math.round(raw.calories),
      protein: round1(raw.protein),
      fat: round1(raw.fat),
      carbs: round1(raw.carbs),
    },
  };
}
