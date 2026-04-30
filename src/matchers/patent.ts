import { PatentItem } from '../tyc-types';

function tsToDate(ts?: number): string {
  return ts ? new Date(ts).toISOString().slice(0, 10) : '-';
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

export function formatPatentBlocks(items: PatentItem[]): any[] {
  if (!items.length) return [];
  const top = items.slice(0, 10);
  const rows = [
    tableRow(['专利名称', '类型', '申请号', '申请日期', '公开日期']),
    ...top.map((it) =>
      tableRow([
        (it.patentName || '').slice(0, 40),
        it.patentType || '-',
        it.appNumber || '-',
        tsToDate(it.appDate),
        tsToDate(it.pubDate),
      ]),
    ),
  ];
  return [
    {
      type: 'heading_3',
      heading_3: {
        rich_text: [
          { type: 'text', text: { content: `📜 专利记录（共 ${items.length} 条，展示前 ${top.length}）` } },
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

import { MatchResult } from './bidding';

export function matchPatent(
  newsText: string,
  items: PatentItem[],
): MatchResult & { matchedItem?: PatentItem } {
  if (!items.length) {
    return { matched: false, reason: '天眼查未返回专利记录' };
  }
  const text = newsText || '';
  const hit =
    items.find((it) => it.patentName && text.includes(String(it.patentName).slice(0, 10))) ||
    items.find((it) => it.appNumber && text.includes(it.appNumber as string));
  if (hit) {
    return { matched: true, reason: `命中专利：${hit.patentName}`, matchedItem: hit };
  }
  return { matched: false, reason: `天眼查返回 ${items.length} 条专利，未与新闻对上` };
}
