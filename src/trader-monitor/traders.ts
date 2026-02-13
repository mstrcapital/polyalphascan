// traders.ts
// 在这里维护 trader handle 和钱包地址（可直接增删）

export interface Trader {
  handle: string;
  address: string;
}

// 初始示例，可按需修改、扩展
export const traders: Trader[] = [
  {
    handle: 'trader_alan',
    address: '0x1234567890abcdef1234567890abcdef12345678'
  },
  {
    handle: 'trader_bob',
    address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'
  }
  // 增删都在此处
];