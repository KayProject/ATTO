// Lets the hero start its entrance as the preloader opens onto it.
let done = false;
const waiting = new Set<() => void>();

/** Starts a fresh wait, for when the preloader is about to play. */
export function resetPreloader() {
  done = false;
}

export function markPreloaderDone() {
  done = true;
  waiting.forEach((run) => run());
  waiting.clear();
}

/** Runs `run` once the preloader has revealed the page; returns a cancel function. */
export function whenPreloaderDone(run: () => void): () => void {
  if (done) {
    run();
    return () => {};
  }
  waiting.add(run);
  return () => waiting.delete(run);
}
