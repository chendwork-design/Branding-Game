/**
 * Comparison is deliberately a client-side reading aid: it never changes the
 * submitted visual decision or the game result. Keeping it pure makes the
 * three-item limit predictable on touch devices as well as easy to test.
 */
export function toggleVisualComparison(
  currentIds: readonly string[],
  visualId: string,
  limit = 3,
): string[] {
  if (currentIds.includes(visualId)) return currentIds.filter((id) => id !== visualId);
  if (currentIds.length >= limit) return [...currentIds];
  return [...currentIds, visualId];
}

export function canAddVisualComparison(
  currentIds: readonly string[],
  visualId: string,
  limit = 3,
): boolean {
  return currentIds.includes(visualId) || currentIds.length < limit;
}
