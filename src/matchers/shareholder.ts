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
    return { matched: false, reason: '天眼查未返回股东记录' };
  }

  const text = newsText || '';

  for (const it of items) {
    if (it.name && text.includes(String(it.name))) {
      const pct = it.capital?.[0]?.percent || '';
      return {
        matched: true,
        matchedItem: it,
        reason: `新闻正文提及股东「${it.name}」${pct ? `（持股${pct}）` : ''}`,
      };
    }
  }

  for (const it of items) {
    const pct = it.capital?.[0]?.percent || '';
    if (pct && text.includes(pct)) {
      return {
        matched: true,
        matchedItem: it,
        reason: `新闻正文提及持股比例「${pct}」，对应股东「${it.name}」`,
      };
    }
  }

  return {
    matched: false,
    reason: `天眼查返回 ${items.length} 名股东，但未与新闻正文对上`,
    hint: '新闻可能未提及具体股东名称或持股比例',
  };
}

export function formatShareholderBlocks(items: any[]): any[] {
  if (!items.length) return [];
  const top = items.slice(0, 20);
  const rows = [
    tableRow(['股东名称', '持股比例', '认缴额', '持股日期']),
    ...top.map((it: any) => {
      const cap = it.capital?.[0] || {};
      return tableRow([
        it.name || '-',
        cap.percent || '-',
        cap.amomon || '-',
        tsToDate(it.ftShareholding),
      ]);
    }),
  ];
  return [
    {
      type: 'heading_3',
      heading_3: {
        rich_text: [
          { type: 'text', text: { content: `📊 股东信息（共 ${items.length} 名，展示前 ${top.length}）` } },
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
