import { IStorageAdapter } from './IStorageAdapter';
import { AsyncStorageAdapter, storageAdapter } from './AsyncStorageAdapter';

let currentStorage: IStorageAdapter = storageAdapter;

/**
 * Access the active storage adapter singleton.
 * Prepares the architecture for dependency injection, testing mocks,
 * and Milestone B without touching UI components.
 */
export function getStorage(): IStorageAdapter {
  return currentStorage;
}

/**
 * Test helper to swap the active storage adapter (e.g. for mocked unit testing).
 */
export function setStorageForTesting(adapter: IStorageAdapter): void {
  currentStorage = adapter;
}

export { IStorageAdapter, AsyncStorageAdapter, storageAdapter };
