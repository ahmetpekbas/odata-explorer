import { describe, expect, it } from 'vitest';
import { tabLabel } from './tab-label.ts';

describe('tabLabel', () => {
  it.each([
    ['a schema child', { id: 'My.NS.Customer', kind: 'entityType' }, 'Customer'],
    ['a child of a container', { id: 'My.NS.Container/Customers', kind: 'entitySet' }, 'Customers'],
    ['an overload', { id: 'My.NS.GetTop(My.NS.Customer)', kind: 'function' }, 'GetTop'],
    ['an overload group', { id: 'My.NS.GetTop', kind: 'function' }, 'GetTop'],
    ['a diagram', { id: 'diagram:My.NS.Customer', kind: 'diagram' }, 'Customer diagram'],
    ['the problems tab', { id: 'problems', kind: 'diagnostics' }, 'Problems'],
  ] as const)('labels %s', (_, tab, label) => {
    expect(tabLabel(tab)).toBe(label);
  });
});
