// Mocks for chrome APIs
Object.defineProperty(global, 'chrome', {
  value: {
    storage: {
      sync: {
        get: jest.fn((keys, cb) => cb({})),
        set: jest.fn((items, cb) => cb && cb()),
        clear: jest.fn((cb) => cb && cb()),
      },
    },
    runtime: {
      lastError: null,
      onMessage: { addListener: jest.fn() },
    },
    tabs: {
      query: jest.fn((query, cb) => cb([{ id: 1, url: 'https://linkedin.com/feed' }])),
      sendMessage: jest.fn((id, msg, cb) => cb && cb()),
    },
  },
});
