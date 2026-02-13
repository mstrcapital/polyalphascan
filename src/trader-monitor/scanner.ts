// src/trader-monitor/scanner.ts

import { TRACKED_TRADERS } from './traders';
import { fetchProfileByHandle, fetchRecentPnLForWallet } from './client';

export interface TraderSnapshot {
  handle: string;
  bucket: string;
  proxyWallet: string | null;
  pnl7d: number;
  volume7d: number;
  winRate7d: number;
  timestamp: string;
}

export async function scanTrackedTraders(): Promise<TraderSnapshot[]> {
  const nowIso = new Date().toISOString();
  const results: TraderSnapshot[] = [];

  for (const t of TRACKED_TRADERS) {
    const profile = await fetchProfileByHandle(t.handle);

    if (!profile || !profile.proxyWallet) {
      results.push({
        handle: t.handle,
        bucket: t.bucket,
        proxyWallet: null,
        pnl7d: 0,
        volume7d: 0,
        winRate7d: 0,
        timestamp: nowIso,
      });
      continue;
    }

    const pnl = await fetchRecentPnLForWallet(profile.proxyWallet, 7);

    results.push({
      handle: t.handle,
      bucket: t.bucket,
      proxyWallet: profile.proxyWallet,
      pnl7d: pnl.realizedPnlUsd,
      volume7d: pnl.volumeUsd,
      winRate7d: pnl.winRate,
      timestamp: nowIso,
    });
  }

  return results;
}
