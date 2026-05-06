import { BiddingItem } from '../tyc-types';

export interface MatchResult {
  matched: boolean;
  reason: string;
  hint?: string;
}

function tsToDate(ts?: number | string): string {
  if (ts == null || ts === '') return '-';
  const d = new Date(typeof ts === 'string' ? Number(ts) || ts : ts);
  return isNaN(d.getTime()) ? '-' : d.toISOString().slice(0, 10);
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

/** 把招投标 items 渲染成 Notion blocks（最多 10 条） */
export function formatBiddingBlocks(items: BiddingItem[]): any[] {
  if (!items.length) return [];
  const top = items.slice(0, 10);
  const rows = [
    tableRow(['标题', '发布时间', '采购人', '中标金额']),
    ...top.map((it) =>
      tableRow([
        (it.title || '').slice(0, 60),
        tsToDate(it.publishTime),
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
  const hit = items.find((it) => {
    const title = (it.title || '').slice(0, 20);
    return title && text.includes(title);
  }) || items.find((it) => it.purchaser && text.includes(it.purchaser as string));
  if (hit) {
    return { matched: true, reason: `命中招投标：${hit.title}`, matchedItem: hit };
  }
  return { matched: false, reason: `天眼查返回 ${items.length} 条招投标，未与新闻对上` };
}
