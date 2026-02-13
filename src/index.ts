import { scanTrackedTraders } from './trader-monitor/scanner';

async function main() {
  const snapshots = await scanTrackedTraders();
  console.table(snapshots);
}

main();
