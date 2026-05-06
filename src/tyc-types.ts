export interface BiddingItem {
  title: string;
  abs: string;
  content?: string;
  proxyName?: string;
  purchaser?: string;
  publishTime: number;
  bidType?: string;
  bidIndustry?: string;
  projectCode?: string;
  bidAmount?: string;
  [key: string]: unknown;
}

export interface PatentItem {
  patentName: string;
  applicantName?: string;
  appNumber?: string;
  pubNumber?: string;
  appDate?: number;
  pubDate?: number;
  patentType?: string;
  [key: string]: unknown;
}

export interface InvestmentItem {
  name: string;
  legalPersonName?: string;
  regCapital?: string;
  regStatus?: string;
  estiblishTime?: number;
  percent?: string;
  amount?: string;
  withdrawalTime?: number;
  pencertileScore?: number;
  legalPersonId?: number;
  [key: string]: unknown;
}
