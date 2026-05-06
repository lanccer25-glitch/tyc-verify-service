import { InvestmentItem } from '../tyc-types';
import { toNgrams, overlapScore, extractDates, normalize } from './_util';

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

export function matchInvestment(
  newsText: string,
  items: InvestmentItem[],
  historyItems?: any[],
): MatchResult & { matchedItem?: InvestmentItem; exitedItems?: any[] } {
  if (!items.length) {
    return { matched: false, reason: '天眼查未返回对外投资记录' };
  }
  const text = newsText || '';
  const hit =
    items.find((it) => it.name && text.includes(it.name as string)) ||
    items.find((it) => it.legalPersonName && text.includes(it.legalPersonName as string));

  if (hit) {
    const hitName = normalize(hit.name);
    const hitLegal = normalize(hit.legalPersonName || '');

    const exitRecords = (historyItems || []).filter((h: any) => {
      if (!h.withdrawalTime) return false;
      const hName = normalize(h.name || '');
      const hLegal = normalize(h.legalPersonName || '');
      return h.name && (
        hName === hitName ||
        hLegal === hitLegal ||
        (hitLegal && hName.includes(hitLegal)) ||
        (hitLegal && hLegal.includes(hitLegal))
      );
    });

    if (exitRecords.length > 0) {
      const exitDates = exitRecords.map((h: any) => tsToDate(h.withdrawalTime)).join('、');
      return {
        matched: true,
        matchedItem: hit,
        exitedItems: exitRecords,
        reason: `命中被投资企业：${hit.name}（⚠️ 该企业已于 ${exitDates} 退出，新闻称"${newsText.includes('退出') ? '退出' : '新增'}"需人工复核）`,
        hint: '该投资已退出，与新闻动态类型可能不符',
      };
    }

    return { matched: true, reason: `命中被投资企业：${hit.name}`, matchedItem: hit };
  }
  return { matched: false, reason: `天眼查返回 ${items.length} 条对外投资，未与新闻对上` };
}

export function formatInvestmentHistoryBlocks(items: any[]): any[] {
  if (!items.length) return [];
  const top = items.slice(0, 10);
  const rows = [
    tableRow(['被投资企业', '法人', '注册资本', '登记状态', '成立日期', '投资比例', '退出时间']),
    ...top.map((it: any) =>
      tableRow([
        it.name || '-',
        it.legalPersonName || '-',
        it.regCapital || '-',
        it.regStatus || '-',
        tsToDate(it.estiblishTime),
        (it.percent ?? '-'),
        tsToDate(it.withdrawalTime),
      ]),
    ),
  ];
  return [
    {
      type: 'heading_3',
      heading_3: {
        rich_text: [
          { type: 'text', text: { content: `💰 对外投资退出（共 ${items.length} 条，展示前 ${top.length}）` } },
        ],
      },
    },
    {
      type: 'table',
      table: {
        table_width: 7,
        has_column_header: true,
        has_row_header: false,
        children: rows,
      },
    },
  ];
}

export function matchInvestmentHistory(
  newsText: string,
  items: any[],
): MatchResult & { matchedItem?: any } {
  if (!items.length) {
    return { matched: false, reason: '天眼查未返回对外投资退出记录' };
  }
  const text = newsText || '';

  const hit =
    items.find((it: any) => it.name && text.includes(String(it.name))) ||
    items.find((it: any) => it.legalPersonName && text.includes(String(it.legalPersonName)));
  if (hit) {
    return { matched: true, reason: `命中退出企业：${hit.name}`, matchedItem: hit };
  }

  const newsGrams = toNgrams(text);
  const newsDates = extractDates(text);
  let best = { score: 0, item: null as any, dateHit: false };

  for (const it of items) {
    const itText = [it.name, it.legalPersonName, it.regCapital].filter(Boolean).join('|');
    const itGrams = toNgrams(itText);
    const score = overlapScore(newsGrams, itGrams);

    const itDate = tsToDate(it.withdrawalTime);
    const dateHit = !!itDate && itDate !== '-' && newsDates.includes(itDate);

    const composite = score + (dateHit ? 0.15 : 0);
    if (composite > best.score) best = { score: composite, item: it, dateHit };
  }

  if (best.score >= 0.25) {
    return {
      matched: true,
      matchedItem: best.item,
      reason: `命中退出记录（重叠度 ${(best.score * 100).toFixed(0)}%${best.dateHit ? ' + 日期命中' : ''}）`,
    };
  }

  return {
    matched: false,
    reason: `共 ${items.length} 条退出记录，但未与新闻对上（最高重叠度 ${(best.score * 100).toFixed(0)}%）`,
    hint: '可能是重名企业，或天眼查入库延迟',
  };
}
