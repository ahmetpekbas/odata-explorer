import { vi } from 'vitest';

type Scheme = 'light' | 'dark';

/**
 * jsdom has no matchMedia. Stubs it with a controllable `prefers-color-scheme`; call `set` to
 * simulate the user changing the OS setting. The stub is removed after each test (unstubGlobals).
 */
export function stubSystemScheme(initial: Scheme) {
  let scheme = initial;
  const listeners = new Set<() => void>();

  vi.stubGlobal('matchMedia', (query: string) => ({
    media: query,
    get matches() {
      return query === `(prefers-color-scheme: ${scheme})`;
    },
    addEventListener: (_type: 'change', listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: 'change', listener: () => void) => listeners.delete(listener),
  }));

  return {
    set(next: Scheme) {
      scheme = next;
      listeners.forEach((listener) => listener());
    },
  };
}
