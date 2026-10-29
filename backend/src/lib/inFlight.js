// Runs `fn` once per key while it is still running: identical requests that
// arrive in the meantime (a double-click, a second tab) wait for it and share
// its result instead of repeating the work. Once it settles, the key is free
// again. Kept in memory, so it covers one server process.
export function createInFlight() {
  const running = new Map();
  return function shareInFlight(key, fn) {
    if (running.has(key)) return running.get(key);
    const promise = Promise.resolve().then(fn).finally(() => running.delete(key));
    running.set(key, promise);
    return promise;
  };
}
