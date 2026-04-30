// AUTO-GENERATED universal formatter — 自动检测数据结构生成 Notion 表格

function tsToDateStr(ts?: any): string {
  if (!ts) return '';
  const d = new Date(Number(ts));
  if (isNaN(d.getTime())) return String(ts || '').slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function tableRow(cells: string[]) {
  return {
    type: 'table_row' as const,
    table_row: { cells: cells.map((v) => [{ type: 'text' as const, text: { content: v || '-' } }]) },
  };
}

export function formatUniversalBlocks(items: any[]): any[] {
  if (!items?.length) return [];
  const top = items.slice(0, 20);

  const sample = top[0];
  const keys = Object.keys(sample).filter(
    (k) =>
      k !== 'id' &&
      k !== 'uuid' &&
      k !== 'content' &&
      k !== 'businessId' &&
      k !== 'announce_id' &&
      !k.startsWith('_') &&
      typeof sample[k] !== 'object' &&
      !Array.isArray(sample[k]),
  ).slice(0, 5);

  if (!keys.length) {
    const blocks: any[] = [
      { type: 'heading_3', heading_3: { rich_text: [{ type: 'text', text: { content: `📊 记录（共 ${items.length} 条）` } }] } },
      { type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: JSON.stringify(items.slice(0, 5)).slice(0, 2000) } }] } },
    ];
    return blocks;
  }

  const blocks: any[] = [
    { type: 'heading_3', heading_3: { rich_text: [{ type: 'text', text: { content: `📊 记录（共 ${items.length} 条，展示前 ${top.length}）` } }] } },
    {
      type: 'table',
      table: {
        table_width: keys.length,
        has_column_header: true,
        has_row_header: false,
        children: [
          tableRow(keys),
          ...top.map((it: any) =>
            tableRow(
              keys.map((k: string) => {
                const v = it[k];
                if (v == null) return '-';
                if (typeof v === 'number' && k.toLowerCase().includes('time'))
                  return tsToDateStr(v);
                return String(v).slice(0, 100) || '-';
              }),
            ),
          ),
        ],
      },
    },
  ];
  return blocks;
}

/** 通用对象格式化：把单个对象渲染成 key-value 表 */
export function formatUniversalObject(obj: any, title: string): any[] {
  if (!obj || typeof obj !== 'object') return [];
  const keys = Object.keys(obj).filter((k) => !k.startsWith('_') && typeof obj[k] !== 'object' && !Array.isArray(obj[k]));
  if (!keys.length) return [];
  const top = keys.slice(0, 20);
  const blocks: any[] = [
    { type: 'heading_3', heading_3: { rich_text: [{ type: 'text', text: { content: title } }] } },
    {
      type: 'table',
      table: {
        table_width: 2,
        has_column_header: false,
        has_row_header: true,
        children: top.map((k: string) =>
          tableRow([k, String(obj[k] ?? '-').slice(0, 200)]),
        ),
      },
    },
  ];
  return blocks;
}
