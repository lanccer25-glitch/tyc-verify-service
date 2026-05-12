import { MatchResult } from './_util';

export interface PersonnelChangeRecord {
  name: string;
  time: string;
  relation?: number;
  toco?: number | null;
  type: 'staff' | 'legal';
}

interface HiMembersResult {
  pastStafferList?: Array<Array<{
    name: string;
    time: string;
    type?: number;
    toco?: number | null;
    relation?: number;
    logo?: string;
    id?: number;
    hcgid?: string;
  }>>;
  pastLegalPersonList?: Array<{
    name: string;
    time: string;
    id?: number;
    hcgid?: string;
  }>;
}

function flattenChanges(result: HiMembersResult): PersonnelChangeRecord[] {
  const changes: PersonnelChangeRecord[] = [];

  for (const group of result.pastStafferList || []) {
    for (const item of group) {
      if (item.name && item.time) {
        changes.push({
          name: item.name,
          time: item.time,
          relation: item.relation,
          toco: item.toco,
          type: 'staff',
        });
      }
    }
  }

  for (const item of result.pastLegalPersonList || []) {
    if (item.name && item.time) {
      changes.push({
        name: item.name,
        time: item.time,
        type: 'legal',
      });
    }
  }

  changes.sort((a, b) => b.time.localeCompare(a.time));
  return changes;
}

function changeLabel(record: PersonnelChangeRecord): string {
  if (record.type === 'legal') {
    return '法定代表人变更';
  }
  if (record.toco != null) {
    return '人员退出';
  }
  return '人员新增/变更';
}

export function matchPersonnel(
  newsText: string,
  result: HiMembersResult,
): MatchResult & { matchedItem?: PersonnelChangeRecord } {
  const changes = flattenChanges(result);

  if (!changes.length) {
    return { matched: false, reason: '天眼查未返回人员变更记录' };
  }

  const text = newsText || '';

  for (const record of changes) {
    if (text.includes(record.name)) {
      return {
        matched: true,
        matchedItem: record,
        reason: `新闻正文提及「${record.name}」${record.type === 'legal' ? '（法定代表人变更，' + record.time + '）' : '（' + changeLabel(record) + '，' + record.time + '）'}`,
      };
    }
  }

  return {
    matched: false,
    reason: `天眼查返回 ${changes.length} 条人员变更记录，但未与新闻正文对上`,
    hint: '新闻可能未提及具体人名',
  };
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

export function formatPersonnelBlocks(result: HiMembersResult): any[] {
  const changes = flattenChanges(result);

  if (!changes.length) return [];

  const top = changes.slice(0, 20);

  const rows = [
    tableRow(['姓名', '日期', '变更类型']),
    ...top.map((r) =>
      tableRow([
        r.name,
        r.time,
        changeLabel(r),
      ]),
    ),
  ];

  return [
    {
      type: 'heading_3',
      heading_3: {
        rich_text: [
          { type: 'text', text: { content: `🔄 人员变更历史（共 ${changes.length} 条，展示前 ${top.length}）` } },
        ],
      },
    },
    {
      type: 'table',
      table: {
        table_width: 3,
        has_column_header: true,
        has_row_header: false,
        children: rows,
      },
    },
  ];
}
