// Rate (paise) in force on `day`: the latest history entry starting on or before it.
export function rateOn(worker, day) {
  let best = null;
  for (const entry of worker.rateHistory ?? []) {
    if (entry.effectiveFrom <= day && (!best || entry.effectiveFrom > best.effectiveFrom))
      best = entry;
  }
  return best ? best.rate : null;
}

export const latestRateEntry = (worker) =>
  (worker.rateHistory ?? []).reduce(
    (a, b) => (!a || b.effectiveFrom > a.effectiveFrom ? b : a),
    null
  );
