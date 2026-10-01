import { describe, expect, it } from 'vitest';
import aliases from '../../fixtures/aliases.xml?raw';
import trippin from '../../fixtures/trippin.xml?raw';
import { loadResolved } from '../test/views.tsx';
import { linkResolver, QUALIFIED_NAME } from './source-links.ts';

const NS = 'Microsoft.OData.SampleService.Models.TripPin';

describe('linkResolver', () => {
  const link = linkResolver(loadResolved(trippin));

  it('resolves the name of a type to its tab', () => {
    expect(link(`${NS}.Trip`)).toEqual({ id: `${NS}.Trip`, kind: 'entityType' });
    expect(link(`${NS}.PersonGender`)).toEqual({ id: `${NS}.PersonGender`, kind: 'enumType' });
  });

  it('resolves functions to their overload group and container members to themselves', () => {
    expect(link(`${NS}.GetNearestAirport`)).toEqual({
      id: `${NS}.GetNearestAirport`,
      kind: 'function',
    });
    expect(link(`${NS}.DefaultContainer/People`)).toEqual({
      id: `${NS}.DefaultContainer/People`,
      kind: 'entitySet',
    });
  });

  it('does not link names the model does not define', () => {
    expect(link('Edm.String')).toBeUndefined();
    expect(link('Org.OData.Core.V1.Description')).toBeUndefined();
    expect(link(`${NS}.Nope`)).toBeUndefined();
    expect(link('example.com')).toBeUndefined();
  });

  it('does not take a missing member for its parent', () => {
    expect(link(`${NS}.Trip/Nope`)).toBeUndefined();
  });
});

describe('linkResolver with aliases', () => {
  const resolved = loadResolved(aliases);
  const link = linkResolver(resolved);
  const [first] = resolved.model.schemas;
  const withAlias = resolved.model.schemas.find((s) => s.alias && s.entityTypes.length > 0);

  it('follows a schema alias to its namespace', () => {
    expect(first).toBeDefined();
    expect(withAlias).toBeDefined();
    const type = withAlias?.entityTypes[0];
    expect(link(`${withAlias?.alias}.${type?.name}`)).toEqual({ id: type?.id, kind: 'entityType' });
    expect(link(type?.id ?? '')).toEqual({ id: type?.id, kind: 'entityType' });
  });
});

describe('QUALIFIED_NAME', () => {
  it('finds qualified names in attributes, collections and JSON strings', () => {
    const find = (text: string) => text.match(QUALIFIED_NAME);
    expect(find('<Property Name="A" Type="NS.Trip"/>')).toEqual(['NS.Trip']);
    expect(find('Type="Collection(NS.Sub.Trip)"')).toEqual(['NS.Sub.Trip']);
    expect(find('"$Type": "NS.Trip", "$Partner": "Trips"')).toEqual(['NS.Trip']);
    expect(find('Target="NS.Container/Customers"')).toEqual(['NS.Container/Customers']);
  });
});
