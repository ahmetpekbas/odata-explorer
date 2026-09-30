import { describe, expect, it } from 'vitest';
import trippin from '../../fixtures/trippin.xml?raw';
import { load } from '../worker/load.ts';
import { openableTarget } from './openable.ts';

const result = load(trippin);
if (!result.ok) throw new Error(result.error);
const NS = 'Microsoft.OData.SampleService.Models.TripPin';

describe('openableTarget', () => {
  it('returns an element that has a tab of its own', () => {
    expect(openableTarget(result.resolved, `${NS}.Person`)).toEqual({
      id: `${NS}.Person`,
      kind: 'entityType',
    });
  });

  it('opens the type of a property or navigation property', () => {
    expect(openableTarget(result.resolved, `${NS}.Person/Friends`)).toEqual({
      id: `${NS}.Person`,
      kind: 'entityType',
    });
  });

  it('opens the overload group of an overload, or of its parameter', () => {
    const group = { id: `${NS}.ShareTrip`, kind: 'action' };
    expect(openableTarget(result.resolved, `${NS}.ShareTrip(${NS}.Person)`)).toEqual(group);
    expect(openableTarget(result.resolved, `${NS}.ShareTrip(${NS}.Person)/userName`)).toEqual(
      group,
    );
    expect(openableTarget(result.resolved, `${NS}.ShareTrip`)).toEqual(group);
  });

  it('returns undefined for something that is not in the model', () => {
    expect(openableTarget(result.resolved, `${NS}.Nope`)).toBeUndefined();
    expect(openableTarget(result.resolved, '')).toBeUndefined();
  });
});
