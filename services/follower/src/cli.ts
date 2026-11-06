import { Rpc } from "../../title-search/src/rpc";
import { backfillRegistry,backfillName } from "./backfill";
import { HistoryStore, followBlock } from "./index";
const rpc = Rpc.fromEnv(),
  store = new HistoryStore(process.env.ATTO_DB_PATH ?? "../../workbench/atto.sqlite");
if (process.argv.includes("--backfill")) {
  const baseline = await backfillRegistry(rpc, store);
  console.log(JSON.stringify(baseline));
  if (store.cursor("blocks") === null && !process.env.ATTO_FOLLOWER_FROM_HEIGHT)
    await followBlock(rpc, store, baseline.baseline_height);
}
let running = true;
process.on("SIGINT", () => {
  running = false;
});
while (running) {
  try {
    const head = await rpc.call<{ header: { height: number; prev_hash: string } }>("block", { finality: "final" });
    const cursor = store.cursor("blocks");
    if (cursor === null && !process.env.ATTO_FOLLOWER_FROM_HEIGHT) {
      await followBlock(rpc, store, head.header.height);
    } else {
      const stop = cursor ?? Number(process.env.ATTO_FOLLOWER_FROM_HEIGHT) - 1;
      if (!Number.isSafeInteger(stop) || stop < 0)
        throw new Error("ATTO_FOLLOWER_FROM_HEIGHT must be a positive block height.");
      const pending: number[] = [];
      let current = head;
      while (current.header.height > stop) {
        pending.push(current.header.height);
        if (pending.length > 10000) throw new Error("Backfill exceeds 10,000 blocks. Set a closer start height.");
        current = await rpc.call("block", { block_id: current.header.prev_hash });
      }
      if (cursor !== null && current.header.height !== cursor)
        throw new Error("Saved cursor is not on the current finalized chain.");
      for (const height of pending.reverse()) if (running) await followBlock(rpc, store, height);
    }
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
  }
  if (running) await new Promise((resolve) => setTimeout(resolve, 10000));
}
store.close();
