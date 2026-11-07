/* eslint-disable no-undef */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn().mockResolvedValue({ canceled: true }),
}));

jest.mock('expo-file-system', () => {
  class MockFile {
    constructor(parentOrUri, name) {
      this.parentOrUri = parentOrUri;
      this.name = name;
      this.uri = 'file:///mock/cache/backup.json';
      this.exists = true;
      this.size = 1024;
    }
    async write(content) {}
    async text() {
      return '{}';
    }
  }

  return {
    File: MockFile,
    Paths: {
      cache: 'file:///mock/cache',
      document: 'file:///mock/document',
    },
  };
});
