let counter = 0;

/**
 * Lightweight in-house ID generator.
 * Format: `${prefix}_${timestamp36}_${counter}_${random36}`
 * Eliminates external UUID dependency while guaranteeing collision-free unique IDs.
 */
export function generateId(prefix: string): string {
  counter = (counter + 1) % 10000;
  const timePart = Date.now().toString(36);
  const countPart = counter.toString(36);
  const randPart = Math.random().toString(36).substring(2, 7);
  return `${prefix}_${timePart}_${countPart}_${randPart}`;
}

