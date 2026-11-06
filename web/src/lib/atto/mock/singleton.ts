import { World } from "./world";

const BOT_TICK_MS = 1400;

const store = globalThis as unknown as { __attoWorld?: World };

export function getWorld(): World {
  store.__attoWorld ??= new World();
  return store.__attoWorld;
}

export function resetWorld() {
  store.__attoWorld = new World();
}

/** Plays the bot: keeps stepping a sale until there is nothing left for it to do. */
export function runBot(id: string) {
  const tick = () => {
    if (getWorld().botStep(id)) setTimeout(tick, BOT_TICK_MS);
  };
  setTimeout(tick, BOT_TICK_MS);
}
