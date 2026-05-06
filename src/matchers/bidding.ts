import { BiddingItem } from '../tyc-types';
import { toNgrams, overlapScore, extractDates, tsToDate } from './_util';

export interface MatchResult {
  matched: boolean;
  reason: string;
  hint?: string;
}

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

function fmtDate(ts?: any): string {
  if (ts == null || ts === '') return '-';
  const d = new Date(typeof ts === 'string' ? Number(ts) || ts : ts);
  return isNaN(d.getTime()) ? '-' : d.toISOString().slice(0, 10);
}

/** 把招投标 items 渲染成 Notion blocks（最多 10 条） */
export function formatBiddingBlocks(items: BiddingItem[]): any[] {
  if (!items.length) return [];
  const top = items.slice(0, 10);
  const rows = [
    tableRow(['标题', '发布时间', '采购人', '中标金额']),
    ...top.map((it) =>
      tableRow([
        (it.title || '').slice(0, 60),
        fmtDate(it.publishTime),
        it.purchaser || '-',
        it.bidAmount || '-',
      ]),
    ),
  ];
  return [
    {
      type: 'heading_3',
      heading_3: {
        rich_text: [
          { type: 'text', text: { content: `📋 招投标记录（共 ${items.length} 条，展示前 ${top.length}）` } },
        ],
      },
    },
    {
      type: 'table',
      table: {
        table_width: 4,
        has_column_header: true,
        has_row_header: false,
        children: rows,
      },
    },
  ];
}

export function matchBidding(
  newsText: string,
  items: BiddingItem[],
): MatchResult & { matchedItem?: BiddingItem } {
  if (!items.length) {
    return { matched: false, reason: '天眼查未返回招投标记录' };
  }
  const text = newsText || '';

  // Layer 1: 精确子串匹配（标题前 20 字 / 采购人）
  let hit = items.find((it) => {
    const title = (it.title || '').slice(0, 20);
    return title && text.includes(title);
  });
  if (!hit) {
    hit = items.find((it) => it.purchaser && text.includes(it.purchaser as string));
  }
  if (hit) {
    return { matched: true, reason: `命中招投标：${hit.title}`, matchedItem: hit };
  }

  // Layer 2: n-gram 模糊匹配
  const newsGrams = toNgrams(text);
  const newsDates = extractDates(text);

  let best = { score: 0, item: null as any, dateHit: false };
  for (const it of items) {
    const itText = [
      it.title, it.abs, it.purchaser, it.content,
      it.projectCode,
    ].filter(Boolean).join('|');
    const itGrams = toNgrams(itText);
    const score = overlapScore(newsGrams, itGrams);

    const itDate = fmtDate(it.publishTime);
    const dateHit = !!itDate && newsDates.includes(itDate);

    const composite = score + (dateHit ? 0.15 : 0);
    if (composite > best.score) best = { score: composite, item: it, dateHit };
  }

  if (best.score >= 0.25) {
    return {
      matched: true,
      matchedItem: best.item,
      reason: `命中招投标记录（重叠度 ${(best.score * 100).toFixed(0)}%${
        best.dateHit ? ' + 日期命中' : ''
      }）`,
    };
  }

  return {
    matched: false,
    reason: `${items.length} 条招投标未与新闻对上（最高重叠度 ${(best.score * 100).toFixed(0)}%）`,
    hint: '新闻标题与API标题措辞差异较大，可尝试降低阈值',
  };
}
