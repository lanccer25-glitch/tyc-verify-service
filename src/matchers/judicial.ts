import {
  MatchResult, overlapScore, toNgrams, extractDates, tsToDate,
} from './_util';

export type JudicialSubtype =
  | 'announcement'     // 开庭公告
  | 'court_notice'     // 法院公告
  | 'zhixing'          // 被执行人
  | 'restriction'      // 限高
  | 'dishonest';       // 失信

export function matchJudicial(
  newsText: string,
  items: any[],
  subtype: JudicialSubtype,
): MatchResult {
  if (!items?.length) {
    return {
      matched: false,
      reason: `天眼查未返回任何 ${subtype} 记录`,
      hint: '公司可能确无此类事件，或 keyword 精确度不足',
    };
  }

  const newsDates = extractDates(newsText);
  const newsGrams = toNgrams(newsText, 3);

  let best = { score: 0, item: null as any, dateHit: false };

  for (const it of items) {
    const itText = [
      it.title, it.bltntypename, it.caseReason, it.reason,
      it.caseNo, it.caseCode, it.caseno, it.bltnno, it.content,
      it.execCourtName, it.courtcode, it.court, it.courtName,
      it.partyInfo, it.party1, it.party2, it.litigant,
      it.xname, it.qyinfo, it.applicant,
    ].filter(Boolean).join('|');
    const itGrams = toNgrams(itText, 3);
    const score = overlapScore(newsGrams, itGrams);

    const itDate =
      tsToDate(it.publishdate) ||
      tsToDate(it.publishDate) ||
      tsToDate(it.startDate) ||
      tsToDate(it.caseCreateTime) ||
      tsToDate(it.regDate);
    const dateHit = !!itDate && newsDates.includes(itDate);

    const composite = score + (dateHit ? 0.15 : 0);
    if (composite > best.score) best = { score: composite, item: it, dateHit };
  }

  if (best.score >= 0.25) {
    return {
      matched: true,
      matchedItem: best.item,
      reason: `命中 ${subtype} 记录（重叠度 ${(best.score * 100).toFixed(0)}%${
        best.dateHit ? ' + 日期命中' : ''
      }）`,
    };
  }

  return {
    matched: false,
    reason: `共 ${items.length} 条 ${subtype} 记录，但与短讯正文重叠度低（最高 ${(best.score * 100).toFixed(0)}%）`,
    hint: '可能是重名企业，或天眼查入库延迟',
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

function pick(o: any, ...keys: string[]): string {
  for (const k of keys) {
    const v = o?.[k];
    if (v == null || v === '') continue;
    return String(v).slice(0, 100);
  }
  return '-';
}

function pickDate(o: any, ...keys: string[]): string {
  for (const k of keys) {
    const v = o?.[k];
    if (v == null || v === '') continue;
    const d = tsToDate(v);
    if (d) return d;
  }
  return '-';
}

function extractCaseNo(o: any): string {
  if (o?.content) {
    const m = o.content.match(/[（(]\d{4}[）)][^。；(（),\n]{2,}号/);
    if (m) return m[0].slice(0, 40);
  }
  return pick(o, 'caseCode', 'caseno', 'caseNo');
}

export function formatJudicialBlocks(items: any[], subtype: JudicialSubtype): any[] {
  if (!items.length) return [];
  const top = items.slice(0, 20);
  const isRestriction = subtype === 'restriction';
  const header = isRestriction
    ? tableRow(['被限人', '案号', '申请人', '日期', '内容'])
    : tableRow(['标题', '案号', '公告编号', '法院/机关', '日期', '内容摘要']);
  const rows = top.map((it) =>
    isRestriction
      ? tableRow([
          pick(it, 'xname', 'title'),
          extractCaseNo(it),
          pick(it, 'applicant'),
          pickDate(it, 'publishDate', 'caseCreateTime'),
          pick(it, 'qyinfo') + amountLabel(it),
        ])
      : tableRow([
          pick(it, 'title', 'xname', 'bltntypename', 'caseReason', 'reason', 'partyInfo').slice(0, 30),
          extractCaseNo(it),
          pick(it, 'bltnno'),
          pick(it, 'courtcode', 'court', 'courtName', 'execCourtName'),
          pickDate(it, 'publishdate', 'publishDate', 'startDate', 'caseCreateTime', 'regDate'),
          pick(it, 'content', 'qyinfo').slice(0, 80),
        ]),
  );
  return [
    {
      type: 'heading_3',
      heading_3: {
        rich_text: [
          { type: 'text', text: { content: `⚖️ 记录（共 ${items.length} 条，展示前 ${top.length}）` } },
        ],
      },
    },
    {
      type: 'table',
      table: {
        table_width: isRestriction ? 5 : 6,
        has_column_header: true,
        has_row_header: false,
        children: [header, ...rows],
      },
    },
  ];
}

function amountLabel(o: any): string {
  const v = o?.amountInvolved;
  return (v != null && v !== 0) ? ` | 涉事金额: ${Number(v).toLocaleString()}元` : '';
}
