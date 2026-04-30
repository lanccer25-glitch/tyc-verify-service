import { MatchResult, toNgrams, overlapScore, extractDates, tsToDate } from './_util';

export function matchLicense(newsText: string, items: any[]): MatchResult {
  if (!items?.length) {
    return { matched: false, reason: '天眼查未返回行政许可记录' };
  }
  const newsGrams = toNgrams(newsText);
  const newsDates = extractDates(newsText);

  let best = { score: 0, item: null as any, dateHit: false };
  for (const it of items) {
    const itText = [
      it.licenceName, it.licenceNumber, it.department,
      it.content, it.scope,
    ].filter(Boolean).join('|');
    const score = overlapScore(newsGrams, toNgrams(itText));
    const itDate = tsToDate(it.validFrom) || tsToDate(it.publishTime);
    const dateHit = !!itDate && newsDates.includes(itDate);
    const composite = score + (dateHit ? 0.15 : 0);
    if (composite > best.score) best = { score: composite, item: it, dateHit };
  }

  if (best.score >= 0.25) {
    return { matched: true, matchedItem: best.item,
      reason: `命中行政许可（${(best.score * 100).toFixed(0)}%${best.dateHit ? ' + 日期命中' : ''}）` };
  }
  return { matched: false,
    reason: `返回 ${items.length} 条行政许可，与短讯关联度低（最高 ${(best.score * 100).toFixed(0)}%）` };
}
