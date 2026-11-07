/**
 * Gapped Sort Order Utilities
 * Items are spaced by multiples of 1024 to allow O(1) single-item updates on normal moves.
 * If a gap collapses (<= 1) or collapses at the top (newOrder < 1), the array is re-normalized
 * with 1024 spacing and the move is retried to guarantee the requested visible order.
 */

export const SORT_ORDER_STEP = 1024;

export interface SortableItem {
  id: string;
  sortOrder: number;
}

/**
 * Deterministic comparator for sortable items: sortOrder ascending, tie-broken by id.
 */
export function sortComparator<T extends SortableItem>(a: T, b: T): number {
  const diff = a.sortOrder - b.sortOrder;
  if (diff !== 0) return diff;
  return a.id.localeCompare(b.id);
}

/**
 * Re-normalizes an array so items receive sequential orders: 1024, 2048, 3072, etc.
 */
export function normalizeSortOrders<T extends SortableItem>(items: T[]): T[] {
  const sorted = [...items].sort(sortComparator);
  return sorted.map((item, index) => ({
    ...item,
    sortOrder: (index + 1) * SORT_ORDER_STEP,
  }));
}

export interface MoveOrderResult<T extends SortableItem> {
  updatedItems: T[];
  movedItem: T;
  reorderedAll: boolean;
}

/**
 * Moves an item one step 'up' or 'down' in the visible list.
 * Normal moves modify only the moved item.
 * If gap collapses, re-normalizes the entire list and retries the move.
 */
export function moveItemOrder<T extends SortableItem>(
  items: T[],
  itemId: string,
  direction: 'up' | 'down'
): MoveOrderResult<T> {
  const sorted = [...items].sort(sortComparator);
  const currentIndex = sorted.findIndex((item) => item.id === itemId);

  if (currentIndex < 0) {
    throw new Error(`Item ${itemId} not found in sortable list`);
  }

  // Already at boundary
  if ((direction === 'up' && currentIndex === 0) ||
      (direction === 'down' && currentIndex === sorted.length - 1)) {
    return {
      updatedItems: sorted,
      movedItem: sorted[currentIndex],
      reorderedAll: false,
    };
  }

  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
  const remaining = sorted.filter((item) => item.id !== itemId);

  // Helper to attempt computing new sortOrder without re-normalization
  function attemptCalculate(list: T[]): number | null {
    if (targetIndex === 0) {
      // Moving to top
      const nextOrder = list[0].sortOrder;
      const newOrder = Math.floor(nextOrder / 2);
      if (newOrder < 1) return null; // Collapsed at top
      return newOrder;
    }

    if (targetIndex === list.length) {
      // Moving to bottom
      const prevOrder = list[list.length - 1].sortOrder;
      return prevOrder + SORT_ORDER_STEP;
    }

    // Moving between two items
    const prevOrder = list[targetIndex - 1].sortOrder;
    const nextOrder = list[targetIndex].sortOrder;
    const gap = nextOrder - prevOrder;
    if (gap <= 1) return null; // Collapsed between items
    return Math.floor((prevOrder + nextOrder) / 2);
  }

  const calculated = attemptCalculate(remaining);

  if (calculated !== null) {
    // Single-item update succeeded
    const movedItem: T = { ...sorted[currentIndex], sortOrder: calculated };
    const updatedItems = sorted.map((item) => (item.id === itemId ? movedItem : item));
    return {
      updatedItems,
      movedItem,
      reorderedAll: false,
    };
  }

  // Gap collapsed! Re-normalize first, then retry move
  const normalizedRemaining = normalizeSortOrders(remaining);
  const retryCalculated = attemptCalculate(normalizedRemaining);

  if (retryCalculated === null) {
    throw new Error('Sort order calculation failed even after re-normalization');
  }

  const movedItem: T = { ...sorted[currentIndex], sortOrder: retryCalculated };
  // Reconstruct full list with normalized remaining items plus the moved item
  const updatedItems = [...normalizedRemaining, movedItem].sort(sortComparator);

  return {
    updatedItems,
    movedItem,
    reorderedAll: true,
  };
}

