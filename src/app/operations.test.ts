import { describe, expect, it } from 'vitest';
import aliases from '../../fixtures/aliases.xml?raw';
import trippin from '../../fixtures/trippin.xml?raw';
import { load } from '../worker/load.ts';
import { importsOf, overloadsOf } from './operations.ts';

const NS = 'Microsoft.OData.SampleService.Models.TripPin';

function resolvedOf(text: string) {
  const result = load(text);
  if (!result.ok) throw new Error(result.error);
  return result.resolved;
}

describe('overloadsOf', () => {
  it('finds a bound function and an unbound action', () => {
    const resolved = resolvedOf(trippin);
    const [bound] = overloadsOf(resolved, `${NS}.GetFriendsTrips`);
    expect(bound).toMatchObject({ kind: 'function', isBound: true });
    const [unbound] = overloadsOf(resolved, `${NS}.ResetDataSource`);
    expect(unbound).toMatchObject({ kind: 'action', isBound: false });
  });

  it('groups every overload under one name', () => {
    const overloads = overloadsOf(resolvedOf(aliases), 'Org.Example.Model.Reset');
    expect(overloads).toHaveLength(2);
    expect(new Set(overloads.map((o) => o.id)).size).toBe(2);
  });

  it('finds nothing for an unknown name', () => {
    expect(overloadsOf(resolvedOf(trippin), 'NS.Nope')).toEqual([]);
  });
});

describe('importsOf', () => {
  it('finds the imports that expose an operation', () => {
    const resolved = resolvedOf(trippin);
    expect(importsOf(resolved, 'function', `${NS}.GetNearestAirport`).map((i) => i.name)).toEqual([
      'GetNearestAirport',
    ]);
    expect(importsOf(resolved, 'action', `${NS}.ResetDataSource`).map((i) => i.name)).toEqual([
      'ResetDataSource',
    ]);
    expect(importsOf(resolved, 'function', `${NS}.GetFriendsTrips`)).toEqual([]);
  });

  it('matches imports written with an alias', () => {
    const resolved = resolvedOf(aliases);
    expect(importsOf(resolved, 'action', 'Org.Example.Model.Reset').map((i) => i.name)).toEqual([
      'ResetAll',
    ]);
  });
});
