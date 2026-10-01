import { vi } from 'vitest';

/**
 * jsdom does no layout, so every element is 0x0 and a virtualized list renders nothing. Gives elements
 * a size; undo it with `vi.restoreAllMocks()`.
 */
export function stubLayout(width = 800, height = 480) {
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(width);
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(height);
}
