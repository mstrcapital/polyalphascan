// src/trader-monitor/client.ts

import fetch from 'node-fetch';

const GAMMA_BASE = 'https://gamma-api.polymarket.com';

export interface PolymarketProfile {
  handle: string;
  proxyWallet: string | null;
  createdAt: string | null;
}

export interface TraderPnLWindow {
  realizedPnlUsd: number;
  unrealizedPnlUsd: number;
  volumeUsd: number;
  winRate: number;
  from: string;
  to: string;
}

// 1) 通过 handle 获取钱包地址
export async function fetchProfileByHandle(handle: string): Promise<PolymarketProfile | null> {
  const url = `${GAMMA_BASE}/user-profile?username=${encodeURIComponent(handle)}`;

  const res = await fetch(url);
  if (!res.ok) return null;

  const data = await res.json();

  return {
    handle,
    proxyWallet: data?.proxyWallet ?? null,
    createdAt: data?.createdAt ?? null,
  };
}

// 2) 通过钱包地址获取近期 PnL
export async function fetchRecentPnLForWallet(
  wallet: string,
  windowDays: number = 7,
): Promise<TraderPnLWindow> {
  const now = new Date();
  const from = new Date(now.getTime() - windowDays * 86400 * 1000);

  const url = `${GAMMA_BASE}/fills?address=${wallet}&from=${from.toISOString()}&to=${now.toISOString()}`;

  const res = await fetch(url);
  if (!res.ok) {
    return {
      realizedPnlUsd: 0,
      unrealizedPnlUsd: 0,
      volumeUsd: 0,
      winRate: 0,
      from: from.toISOString(),
      to: now.toISOString(),
    };
  }

  const fills = await res.json() as any[];

  let realized = 0;
  let volume = 0;
  let wins = 0;
  let trades = 0;

  for (const f of fills) {
    const size = Number(f.size ?? 0);
    const price = Number(f.price ?? 0);
    const pnl = Number(f.realizedPnlUsd ?? 0);
    const isWin = Boolean(f.isWin ?? false);

    realized += pnl;
    volume += size * price;
    trades += 1;
    if (isWin) wins += 1;
  }

  return {
    realizedPnlUsd: realized,
    unrealizedPnlUsd: 0,
    volumeUsd: volume,
    winRate: trades > 0 ? wins / trades : 0,
    from: from.toISOString(),
    to: now.toISOString(),
  };
}
