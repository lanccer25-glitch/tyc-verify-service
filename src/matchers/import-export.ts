import { MatchResult, toNgrams, overlapScore } from './_util';

export function matchImportExport(newsText: string, items: any[]): MatchResult {
  if (!items?.length) {
    return {
      matched: false,
      reason: '天眼查未返回进出口信用记录',
      hint: '主体可能未备案进出口资质',
    };
  }
  // 进出口通常只需证明"存在备案记录"即可认为事件真实
  const newsGrams = toNgrams(newsText);
  const sample = items[0];
  const itText = [
    sample.creditCode, sample.companyName,
    sample.registrationDate, sample.managementCategory,
  ].filter(Boolean).join('|');
  const score = overlapScore(newsGrams, toNgrams(itText));

  return {
    matched: true,
    matchedItem: sample,
    reason: `找到 ${items.length} 条进出口备案记录${
      score > 0.2 ? '，与短讯关键信息吻合' : ''
    }`,
  };
}
