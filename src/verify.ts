import { Router, Request, Response } from 'express';
import { Client } from '@notionhq/client';
import { verifyNews, VerifyReport } from './news-verify';
import { getRateLimitUsage } from './tyc-api';

const notion = new Client({ auth: process.env.NOTION_TOKEN });
export const verifyRouter = Router();

function tsToDate(ts?: number): string {
  return ts ? new Date(ts).toISOString().slice(0, 10) : '-';
}

function buildTableRow(label: string, value: string) {
  return {
    type: 'table_row' as const,
    table_row: {
      cells: [
        [{ type: 'text' as const, text: { content: label } }],
        [{ type: 'text' as const, text: { content: value || '-' } }],
      ],
    },
  };
}

function buildReportBlocks(report: VerifyReport, sourceUrl: string) {
  const blocks: any[] = [
    { type: 'divider', divider: {} },
    {
      type: 'heading_3',
      heading_3: {
        rich_text: [{ type: 'text', text: { content: `🔍 核实结果：${report.status}` } }],
      },
    },
    {
      type: 'paragraph',
      paragraph: {
        rich_text: [{
          type: 'text',
          text: { content: `核实时间：${new Date().toISOString().slice(0, 19).replace('T', ' ')} | 接口：${report.usedEndpoint} | 命中：${report.items} 条记录${sourceUrl ? ' | 源：' + sourceUrl : ''}` },
          annotations: { color: 'gray' },
        }],
      },
    },
    {
      type: 'paragraph',
      paragraph: {
        rich_text: [{ type: 'text', text: { content: report.reason } }],
      },
    },
  ];

  // 直接把子接口返回的 blocks 追加
  if (Array.isArray((report as any).detailBlocks)) blocks.push(...(report as any).detailBlocks);

  // 主体背景
  if (report.baseinfo) {
    const bi = report.baseinfo;
    blocks.push({
      type: 'heading_3',
      heading_3: { rich_text: [{ type: 'text', text: { content: '🏢 主体背景' } }] },
    });
    blocks.push({
      type: 'table',
      table: {
        table_width: 2,
        has_column_header: false,
        has_row_header: true,
        children: [
          buildTableRow('企业全称', bi.name),
          buildTableRow('登记状态', bi.regStatus),
          buildTableRow('统一社会信用代码', bi.creditCode),
          buildTableRow('法定代表人', bi.legalPersonName),
          buildTableRow('注册资本', bi.regCapital),
          buildTableRow('成立日期', tsToDate(bi.estiblishTime)),
          buildTableRow('注册地址', bi.regLocation),
          buildTableRow('行业', bi.industry || '-'),
        ],
      },
    });
  }
  return blocks;
}

verifyRouter.post('/verify-company', async (req: Request, res: Response) => {
  const pageId = req.body?.pageId || req.body?.data?.id || req.body?.page?.id;
  if (!pageId) {
    console.error('[VERIFY] 无 pageId, body=', JSON.stringify(req.body));
    return res.status(400).json({ success: false, error: '缺少 pageId' });
  }
  try {
    console.log(`[VERIFY] 开始核实, pageId=${pageId}`);
    const page = (await notion.pages.retrieve({ page_id: pageId })) as any;
    const companyName: string = page.properties['主体']?.title?.[0]?.plain_text || '';
    const dynamicType: string = page.properties['动态类型']?.rich_text?.[0]?.plain_text || '';
    const newsText: string = page.properties['好的牙·Ai短讯']?.rich_text?.[0]?.plain_text || '';
    const sourceUrl: string = page.properties['URL']?.url || '';

    if (!companyName) throw new Error('「主体」为空，无法核实');

    console.log(`[VERIFY] company=${companyName} | type=${dynamicType} | url=${sourceUrl}`);

    const report = await verifyNews(companyName, dynamicType, newsText);

    await notion.pages.update({
      page_id: pageId,
      properties: {
        '核实状态': {
          status: {
            name: report.status === '已核实' || report.status === '已核实（仅主体）'
              ? '已核实' : '无法验证/错误数据',
          },
        },
        '核实时间': { date: { start: new Date().toISOString() } },
      },
    });

    const blocks = buildReportBlocks(report, sourceUrl);
    await notion.blocks.children.append({ block_id: pageId, children: blocks });
    console.log(`[VERIFY] done: ${companyName} -> ${report.status} (${report.items} items)`);
    res.json({ success: true, status: report.status, items: report.items, endpoint: report.usedEndpoint });
  } catch (err: any) {
    console.error(`[VERIFY] 失败: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

verifyRouter.get('/rate-limit', (_req, res) => {
  res.json(getRateLimitUsage());
});
