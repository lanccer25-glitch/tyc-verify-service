import { MatchResult, toNgrams, overlapScore, normalize } from './_util';

export function matchCustomer(
  newsText: string,
  items: any[],
  role: 'client' | 'supplier',
): MatchResult {
  if (!items?.length) {
    return {
      matched: false,
      reason: `天眼查未返回${role === 'client' ? '客户' : '供应商'}记录`,
    };
  }
  // 把新闻文本里可能出现的对手方公司名拿出来，和 items 逐个 overlap
  const newsGrams = toNgrams(newsText);
  let best = { score: 0, item: null as any };

  for (const it of items) {
    const counterparty = it.clientName || it.supplierName || it.companyName || '';
    if (!counterparty) continue;
    if (normalize(newsText).includes(normalize(counterparty))) {
      return {
        matched: true,
        matchedItem: it,
        reason: `新闻正文直接提到${role === 'client' ? '客户' : '供应商'}「${counterparty}」`,
      };
    }
    const s = overlapScore(newsGrams, toNgrams(counterparty, 2));
    if (s > best.score) best = { score: s, item: it };
  }

  if (best.score >= 0.3) {
    return { matched: true, matchedItem: best.item,
      reason: `部分匹配${role === 'client' ? '客户' : '供应商'}名（相似度 ${(best.score * 100).toFixed(0)}%）` };
  }
  return {
    matched: false,
    reason: '返回 ' + items.length + ' 条' + (role === 'client' ? '客户' : '供应商') + '，但没有与短讯对手方一致的',
  };
}

export function formatCustomerBlocks(items: any[]): any[] {
  if (!items.length) return [];
  const top = items.slice(0, 20);
  const blocks: any[] = [{ type: 'heading_3', heading_3: { rich_text: [{ type: 'text', text: { content: '🤝 记录（共 ' + items.length + ' 条，展示前 ' + top.length + '）' } }] } }];
  for (let i = 0; i < top.length; i++) {
    const it = top[i];
    blocks.push({ type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: (i+1) + '. ' + (it.clientName||it.supplierName||it.companyName||'-') + ' | ' + (it.year||'') + ' | ' + (it.amount||'') } }] } });
  }
  return blocks;
}
