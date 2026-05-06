// 共用：从中文文本里抽关键短语，做轻量重叠度打分
// 不引外部依赖，够用即可；后续要升级可替换为 jieba + TF-IDF

export function normalize(s: string): string {
  return (s || '').replace(/\s+/g, '').toLowerCase();
}

/** 把新闻文本切成 2~4 字 n-gram 的集合 */
export function toNgrams(text: string, n = 3): Set<string> {
  const t = normalize(text);
  const out = new Set<string>();
  for (let i = 0; i <= t.length - n; i++) out.add(t.slice(i, i + n));
  return out;
}

export function overlapScore(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let hit = 0;
  for (const g of a) if (b.has(g)) hit++;
  return hit / Math.min(a.size, b.size);
}

/** 从文本抽出 YYYY-MM-DD / YYYY年M月D日 形式的日期 */
export function extractDates(text: string): string[] {
  const res: string[] = [];
  const re1 = /(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/g;
  const re2 = /(\d{4})年(\d{1,2})月(\d{1,2})日/g;
  let m: RegExpExecArray | null;
  while ((m = re1.exec(text)))
    res.push(`${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`);
  while ((m = re2.exec(text)))
    res.push(`${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`);
  return res;
}

export function tsToDate(ts?: number | string): string {
  if (ts == null || ts === '') return '';
  const d = new Date(typeof ts === 'string' ? Number(ts) || ts : ts);
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

export interface MatchResult {
  matched: boolean;
  matchedItem?: any;
  reason: string;
  hint?: string;
}
