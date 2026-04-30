import {
  MatchResult, overlapScore, toNgrams, extractDates, tsToDate,
} from './_util';

export type JudicialSubtype =
  | 'announcement'     // 开庭公告
  | 'court_notice'     // 法院公告
  | 'zhixing'          // 被执行人
  | 'restriction'      // 限高
  | 'dishonest';       // 失信

/**
 * 输入 newsText + items（任一司法接口返回的列表）
 * 匹配策略：
 *   1) 若 items 为空 → 无法验证
 *   2) 逐条算文本重叠度 + 日期命中，取最高分 ≥ 0.25 记为匹配
 */
export function matchJudicial(
  newsText: string,
  items: any[],
  subtype: JudicialSubtype,
): MatchResult {
  if (!items?.length) {
    return {
      matched: false,
      reason: `天眼查未返回任何 ${subtype} 记录`,
      hint: '公司可能确无此类事件，或 keyword 精确度不足',
    };
  }

  const newsDates = extractDates(newsText);
  const newsGrams = toNgrams(newsText, 3);

  let best = { score: 0, item: null as any, dateHit: false };

  for (const it of items) {
    // 从每条记录里凑一个"标题 + 内容"文本
    const itText = [
      it.title, it.caseReason, it.caseNo, it.content,
      it.execCourtName, it.courtName, it.partyInfo,
    ].filter(Boolean).join('|');
    const itGrams = toNgrams(itText, 3);
    const score = overlapScore(newsGrams, itGrams);

    const itDate =
      tsToDate(it.publishDate) ||
      tsToDate(it.startDate) ||
      tsToDate(it.caseCreateTime) ||
      tsToDate(it.regDate);
    const dateHit = !!itDate && newsDates.includes(itDate);

    const composite = score + (dateHit ? 0.15 : 0);
    if (composite > best.score) best = { score: composite, item: it, dateHit };
  }

  if (best.score >= 0.25) {
    return {
      matched: true,
      matchedItem: best.item,
      reason: `命中 ${subtype} 记录（重叠度 ${(best.score * 100).toFixed(0)}%${
        best.dateHit ? ' + 日期命中' : ''
      }）`,
    };
  }

  return {
    matched: false,
    reason: `共 ${items.length} 条 ${subtype} 记录，但与短讯正文重叠度低（最高 ${(best.score * 100).toFixed(0)}%）`,
    hint: '可能是重名企业，或天眼查入库延迟',
  };
}
