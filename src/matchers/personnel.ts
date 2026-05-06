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

export function matchPersonnel(
  newsText: string,
  items: any[],
): MatchResult & { matchedItem?: any } {
  if (!items.length) {
    return { matched: false, reason: '天眼查未返回人员记录' };
  }

  const text = newsText || '';

  for (const it of items) {
    if (it.name && text.includes(String(it.name))) {
      return {
        matched: true,
        matchedItem: it,
        reason: `新闻正文提及人员「${it.name}」（${(it.typeJoin || []).join('、')}）`,
      };
    }
  }

  for (const it of items) {
    const roles = (it.typeJoin || []).join('');
    if (roles && text.includes(roles)) {
      return {
        matched: true,
        matchedItem: it,
        reason: `新闻正文提及职位「${roles}」`,
      };
    }
  }

  return {
    matched: false,
    reason: `天眼查返回 ${items.length} 名人员，但未与新闻正文对上`,
    hint: '新闻可能未提及具体人名或职位',
  };
}

export function formatPersonnelBlocks(items: any[]): any[] {
  if (!items.length) return [];
  const top = items.slice(0, 20);
  const rows = [
    tableRow(['姓名', '职位']),
    ...top.map((it: any) =>
      tableRow([
        it.name || '-',
        (it.typeJoin || []).join('、') || '-',
      ]),
    ),
  ];
  return [
    {
      type: 'heading_3',
      heading_3: {
        rich_text: [
          { type: 'text', text: { content: `👥 主要人员（共 ${items.length} 人，展示前 ${top.length}）` } },
        ],
      },
    },
    {
      type: 'table',
      table: {
        table_width: 2,
        has_column_header: true,
        has_row_header: false,
        children: rows,
      },
    },
  ];
}
