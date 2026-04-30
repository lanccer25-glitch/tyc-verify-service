import { MatchResult, toNgrams, overlapScore } from './_util';

export function matchImportExport(newsText: string, items: any[]): MatchResult {
  if (!items?.length) {
    return {
      matched: false,
      reason: '天眼查未返回进出口信用记录',
      hint: '主体可能未备案进出口资质',
    };
  }
  // 进出口通常只需证明"存在备案记录"即可认为事件真实
  const newsGrams = toNgrams(newsText);
  const sample = items[0];
  const itText = [
    sample.creditCode, sample.companyName,
    sample.registrationDate, sample.managementCategory,
  ].filter(Boolean).join('|');
  const score = overlapScore(newsGrams, toNgrams(itText));

  return {
    matched: true,
    matchedItem: sample,
    reason: `找到 ${items.length} 条进出口备案记录${
      score > 0.2 ? '，与短讯关键信息吻合' : ''
    }`,
  };
}

export function formatImportExportBlocks(items: any[]): any[] {
  if (!items.length) return [];
  const blocks: any[] = [{ type: 'heading_3', heading_3: { rich_text: [{ type: 'text', text: { content: '🚢 进出口（共 ' + items.length + ' 条）' } }] } }];
  for (const it of items.slice(0, 10)) {
    blocks.push({ type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: ((it.companyName||'-') + ' | 信用代码:' + (it.creditCode||'-') + ' | ' + (it.registrationDate||'') + ' | ' + (it.managementCategory||'')).slice(0,200) } }] } });
  }
  return blocks;
}
