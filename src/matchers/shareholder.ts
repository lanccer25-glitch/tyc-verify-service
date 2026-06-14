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

export interface MatchResult {
  matched: boolean;
  reason: string;
  hint?: string;
}

export function matchShareholder(
  newsText: string,
  items: any[],
): MatchResult & { matchedItem?: any } {
  if (!items.length) {
    return { matched: false, reason: '天眼查未返回股权变更记录' };
  }

  const text = newsText || '';

  for (const it of items) {
    const name = it.investor_name || it.name;
    if (name && text.includes(String(name))) {
      return {
        matched: true,
        matchedItem: it,
        reason: `新闻正文提及股东「${name}」（持股 ${it.ratio_before} → ${it.ratio_after}，${tsToDate(it.change_time)}）`,
      };
    }
  }

  for (const it of items) {
    const ratio = it.ratio_after || it.ratio_before || '';
    if (ratio && text.includes(ratio)) {
      const name = it.investor_name || it.name;
      return {
        matched: true,
        matchedItem: it,
        reason: `新闻正文提及持股比例「${ratio}」，对应股东「${name}」`,
      };
    }
  }

  return {
    matched: false,
    reason: `天眼查返回 ${items.length} 条股权变更记录，但未与新闻正文对上`,
    hint: '新闻可能未提及具体股东名称或持股比例',
  };
}

export function formatShareholderBlocks(items: any[]): any[] {
  if (!items.length) return [];
  const top = items.slice(0, 20);
  const rows = [
    tableRow(['股东名称', '变更前', '变更后', '变更日期']),
    ...top.map((it: any) => {
      return tableRow([
        it.investor_name || it.name || '-',
        it.ratio_before || '-',
        it.ratio_after || '-',
        tsToDate(it.change_time),
      ]);
    }),
  ];
  return [
    {
      type: 'heading_3',
      heading_3: {
        rich_text: [
          { type: 'text', text: { content: `📊 股权变更记录（共 ${items.length} 条，展示前 ${top.length}）` } },
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
