import { describe, expect, it } from 'vitest';
import type { SearchEntry, SearchKind } from '../csdl/search-index.ts';
import { prepareIndex, searchIndex } from './search.ts';

const entry = (kind: SearchKind, label: string, parent = 'N'): SearchEntry => ({
  kind,
  id: `${parent}/${label}`,
  label,
  parent,
});

const index = prepareIndex([
  entry('property', 'Order'),
  entry('entityType', 'OrderLine'),
  entry('entityType', 'Customer'),
  entry('entitySet', 'Orders'),
  entry('entityType', 'PurchaseOrder'),
  entry('entityType', 'Order'),
  entry('property', 'CustomerOrderTotal'),
  entry('navigationProperty', 'Ord'),
]);

const labels = (query: string, kinds?: SearchKind[]) =>
  searchIndex(index, query, { kinds: kinds && new Set(kinds) }).map(
    (h) => `${h.tier}:${h.entry.kind}:${h.entry.label}`,
  );

describe('searchIndex', () => {
  it('ranks exact before prefix before substring before fuzzy', () => {
    const tiers = searchIndex(index, 'order').map((h) => h.tier);
    expect(tiers).toEqual(['exact', 'exact', 'prefix', 'prefix', 'substring', 'substring']);
    expect(searchIndex(index, 'ordr').map((h) => h.tier)).toEqual(
      expect.arrayContaining(['fuzzy']),
    );
  });

  it('orders a tier by kind, then length', () => {
    expect(labels('order')).toEqual([
      'exact:entityType:Order',
      'exact:property:Order',
      'prefix:entityType:OrderLine',
      'prefix:entitySet:Orders',
      'substring:entityType:PurchaseOrder',
      'substring:property:CustomerOrderTotal',
    ]);
  });

  it('ignores case and surrounding space', () => {
    expect(labels('  ORDER ')).toEqual(labels('order'));
  });

  it('finds a fuzzy match after the better ones, and lists nothing twice', () => {
    const found = labels('custmer');
    expect(found[0]).toBe('fuzzy:entityType:Customer');
    expect(new Set(labels('ord')).size).toBe(labels('ord').length);
  });

  it('filters by kind', () => {
    expect(labels('order', ['property'])).toEqual([
      'exact:property:Order',
      'substring:property:CustomerOrderTotal',
    ]);
  });

  it('returns nothing for an empty query or a miss, and honors the limit', () => {
    expect(labels('')).toEqual([]);
    expect(labels('zzzz')).toEqual([]);
    expect(searchIndex(index, 'order', { limit: 2 })).toHaveLength(2);
  });
});

describe('searchIndex on a large model', () => {
  // Microsoft Graph beta has about 3,000 types with some 40,000 properties and navigation properties.
  const words = [
    'user',
    'group',
    'mail',
    'folder',
    'message',
    'event',
    'calendar',
    'team',
    'drive',
  ];
  const large = prepareIndex(
    Array.from({ length: 60_000 }, (_, i) =>
      entry(
        i % 30 === 0 ? 'entityType' : 'property',
        `${words[i % words.length]}${words[(i * 7) % words.length]}${i}`,
        `N.T${i % 3000}`,
      ),
    ),
  );

  it.each(['user', 'mesage', 'calendarevent', 'x'])('answers %j in under 30 ms', (query) => {
    // The best of several runs, so that a busy machine does not fail what is a measure of the code.
    const times = Array.from({ length: 7 }, () => {
      const start = performance.now();
      searchIndex(large, query);
      return performance.now() - start;
    });
    expect(Math.min(...times)).toBeLessThan(30);
  });
});
