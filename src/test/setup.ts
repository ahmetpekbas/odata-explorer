import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

// jsdom has no ResizeObserver, which Fluent's MessageBar uses.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// jsdom has no layout, so CodeMirror's measuring finds no Range geometry.
const noRects = Object.assign([], { item: () => null }) as unknown as DOMRectList;
Range.prototype.getClientRects = () => noRects;
Range.prototype.getBoundingClientRect = () => new DOMRect();
