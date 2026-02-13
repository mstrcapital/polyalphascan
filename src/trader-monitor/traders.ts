#// src/trader-monitor/traders.ts

export type TraderBucket = 'NegRisk' | 'Basic';

export interface TrackedTrader {
  handle: string;          // Polymarket 用户名
  bucket: TraderBucket;
}

export const TRACKED_TRADERS: TrackedTrader[] = [
  // NegRisk
  { handle: 'xmgnr', bucket: 'NegRisk' },
  { handle: 'luishXYZ', bucket: 'NegRisk' },
  { handle: 'copenzafan', bucket: 'NegRisk' },
  { handle: 'carverfomo', bucket: 'NegRisk' },
  { handle: 'sorokx', bucket: 'NegRisk' },
  { handle: 'holy_moses7', bucket: 'NegRisk' },
  { handle: 'PolycoolApp', bucket: 'NegRisk' },
  { handle: 'itslirrato', bucket: 'NegRisk' },
  { handle: 'zodchiii', bucket: 'NegRisk' },
  { handle: 'Zun2025', bucket: 'NegRisk' },

  // Basic / In-Market
  { handle: 'clawdvine', bucket: 'Basic' },
  { handle: 'polytraderAI', bucket: 'Basic' },
  { handle: 'takecgcj', bucket: 'Basic' },
  { handle: 'blknoiz06', bucket: 'Basic' },
  { handle: 'cryptorover', bucket: 'Basic' },
  { handle: 'antpalkin', bucket: 'Basic' },
  { handle: 'SpotTheAnamoly', bucket: 'Basic' },
  { handle: 'AdiFlips', bucket: 'Basic' },
  { handle: 'Zun2025', bucket: 'Basic' },
  { handle: 'zodchiii', bucket: 'Basic' },
];
