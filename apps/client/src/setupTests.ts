import '@testing-library/jest-dom';

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (!('ResizeObserver' in globalThis)) {
  // @ts-expect-error - jsdom does not implement ResizeObserver by default
  globalThis.ResizeObserver = ResizeObserverMock;
}
