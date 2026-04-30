import { InvestmentItem } from '../tyc-endpoints';

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

export function formatInvestmentBlocks(items: InvestmentItem[]): any[] {
  if (!items.length) return [];
  const top = items.slice(0, 10);
  const rows = [
    tableRow(['被投资企业', '法人', '注册资本', '登记状态', '成立日期', '投资比例']),
    ...top.map((it) =>
      tableRow([
        it.name || '-',
        it.legalPersonName || '-',
        it.regCapital || '-',
        it.regStatus || '-',
        tsToDate(it.estiblishTime),
        it.percent || '-',
      ]),
    ),
  ];
  return [
    {
      type: 'heading_3',
      heading_3: {
        rich_text: [
          { type: 'text', text: { content: `💰 对外投资（共 ${items.length} 条，展示前 ${top.length}）` } },
        ],
      },
    },
    {
      type: 'table',
      table: {
        table_width: 6,
        has_column_header: true,
        has_row_header: false,
        children: rows,
      },
    },
  ];
}

import { MatchResult } from './bidding';

export function matchInvestment(
  newsText: string,
  items: InvestmentItem[],
): MatchResult & { matchedItem?: InvestmentItem } {
  if (!items.length) {
    return { matched: false, reason: '天眼查未返回对外投资记录' };
  }
  const text = newsText || '';
  const hit =
    items.find((it) => it.name && text.includes(it.name as string)) ||
    items.find((it) => it.legalPersonName && text.includes(it.legalPersonName as string));
  if (hit) {
    return { matched: true, reason: `命中被投资企业：${hit.name}`, matchedItem: hit };
  }
  return { matched: false, reason: `天眼查返回 ${items.length} 条对外投资，未与新闻对上` };
}
