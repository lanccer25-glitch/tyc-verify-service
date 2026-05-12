import { toNgrams, overlapScore, extractDates } from './_util';

function tableRow(cells: string[]) {
  return {
    type: 'table_row' as const,
    table_row: {
      cells: cells.map((v) => [
        { type: 'text' as const, text: { content: v || '-' } },
      ]),
    },
  };
}

export interface MatchResult {
  matched: boolean;
  reason: string;
  hint?: string;
}

export function matchPunishment(
  newsText: string,
  items: any[],
): MatchResult & { matchedItem?: any } {
  if (!items?.length) {
    return { matched: false, reason: '天眼查未返回行政处罚记录' };
  }

  const newsGrams = toNgrams(newsText);
  const newsDates = extractDates(newsText);

  let best = { score: 0, item: null as any, dateHit: false };

  for (const it of items) {
    const itText = [
      it.punishNumber, it.punishName, it.reason,
      it.departmentName, it.content,
    ].filter(Boolean).join('|');
    const itGrams = toNgrams(itText);
    const score = overlapScore(newsGrams, itGrams);

    const itDate =
      (typeof it.decisionDate === 'string' ? it.decisionDate : '') ||
      '';
    const dateHit = !!itDate && newsDates.includes(itDate);

    const composite = score + (dateHit ? 0.15 : 0);
    if (composite > best.score) best = { score: composite, item: it, dateHit };
  }

  if (best.score >= 0.25) {
    return {
      matched: true,
      matchedItem: best.item,
      reason: `命中行政处罚记录（重叠度 ${(best.score * 100).toFixed(0)}%${best.dateHit ? ' + 日期命中' : ''}）`,
    };
  }

  return {
    matched: false,
    reason: `共 ${items.length} 条处罚记录，但与短讯关联度低（最高 ${(best.score * 100).toFixed(0)}%）`,
    hint: '可能是处罚事由或时间与新闻不一致',
  };
}

export function formatPunishmentBlocks(items: any[]): any[] {
  if (!items.length) return [];
  const top = items.slice(0, 10);
  const rows = [
    tableRow(['处罚文号', '处罚机关', '处罚日期', '罚款金额', '事由']),
    ...top.map((it: any) =>
      tableRow([
        (it.punishNumber || '-').slice(0, 30),
        it.departmentName || '-',
        it.decisionDate || '-',
        it.pecuniary ? `${it.pecuniary}元` : '-',
        (it.reason || '').slice(0, 60),
      ]),
    ),
  ];
  return [
    {
      type: 'heading_3',
      heading_3: {
        rich_text: [
          { type: 'text', text: { content: `⚡ 行政处罚（共 ${items.length} 条，展示前 ${top.length}）` } },
        ],
      },
    },
    {
      type: 'table',
      table: {
        table_width: 5,
        has_column_header: true,
        has_row_header: false,
        children: rows,
      },
    },
  ];
}
