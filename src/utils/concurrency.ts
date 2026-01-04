/**
 * Concurrency-limited Promise execution utilities
 *
 * Cloudflare Workers has subrequest limits (50 free tier, 1000 paid).
 * These utilities process promises in batches to stay within limits.
 */

const DEFAULT_CONCURRENCY = 30;

/**
 * Execute async functions with limited concurrency using a worker pool pattern.
 * Results are returned in the same order as input items.
 *
 * @param items - Array of items to process
 * @param fn - Async function to apply to each item
 * @param concurrency - Maximum concurrent operations (default: 30)
 * @returns Array of results in input order
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency: number = DEFAULT_CONCURRENCY
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  async function worker(): Promise<void> {
    while (currentIndex < items.length) {
      const index = currentIndex++;
      results[index] = await fn(items[index], index);
    }
  }

  // Start up to `concurrency` workers
  const workerCount = Math.min(concurrency, items.length);
  const workers = Array(workerCount)
    .fill(null)
    .map(() => worker());

  await Promise.all(workers);
  return results;
}

/**
 * Execute async functions with limited concurrency, filtering out null results.
 * Useful when some items may fail and should be skipped.
 *
 * @param items - Array of items to process
 * @param fn - Async function that may return null for items to skip
 * @param concurrency - Maximum concurrent operations (default: 30)
 * @returns Array of non-null results (order preserved for successful items)
 */
export async function mapWithConcurrencyFiltered<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R | null>,
  concurrency: number = DEFAULT_CONCURRENCY
): Promise<R[]> {
  const results = await mapWithConcurrency(items, fn, concurrency);
  return results.filter((r): r is R => r !== null);
}
