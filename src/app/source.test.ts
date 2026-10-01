import { describe, expect, it } from 'vitest';
import trippin from '../../fixtures/trippin.xml?raw';
import csdlJson from '../../fixtures/csdl-schemas/csdl-16.1.json?raw';
import { loadResolved } from '../test/views.tsx';
import { MAX_FRAGMENT, sourceOf } from './source.ts';

const NS = 'Microsoft.OData.SampleService.Models.TripPin';

describe('sourceOf an XML document', () => {
  const resolved = loadResolved(trippin);

  it('slices the original text for an element', () => {
    const source = sourceOf(resolved, trippin, `${NS}.Person`);
    expect(source?.language).toBe('xml');
    expect(source?.truncated).toBe(false);
    expect(source?.text.startsWith('<EntityType Name="Person"')).toBe(true);
    expect(source?.text.endsWith('</EntityType>')).toBe(true);
  });

  it('slices a property, which follows the selection into a table row', () => {
    expect(sourceOf(resolved, trippin, `${NS}.Person/UserName`)?.text).toMatch(
      /^<Property Name="UserName"/,
    );
  });

  it('joins the overloads of an operation group', () => {
    const source = sourceOf(resolved, trippin, `${NS}.GetNearestAirport`);
    expect(source?.text).toMatch(/^<Function Name="GetNearestAirport"/);
  });

  it('has nothing for no selection or an unknown element', () => {
    expect(sourceOf(resolved, trippin, undefined)).toBeUndefined();
    expect(sourceOf(resolved, trippin, `${NS}.Nope`)).toBeUndefined();
  });

  it('cuts a fragment that is too long', () => {
    const schema = resolved.model.schemas[0];
    expect(schema).toBeDefined();
    const huge = trippin.replace('</Schema>', `<!--${'x'.repeat(MAX_FRAGMENT)}--></Schema>`);
    const source = sourceOf(loadResolved(huge), huge, NS);
    expect(source?.truncated).toBe(true);
    expect(source?.text).toHaveLength(MAX_FRAGMENT);
  });
});

describe('sourceOf a JSON document', () => {
  const resolved = loadResolved(csdlJson);
  const namespace = resolved.model.schemas[0]?.namespace ?? '';
  const type = resolved.model.schemas[0]?.entityTypes[0];

  it('re-serializes the subtree of an element as JSON', () => {
    expect(type).toBeDefined();
    const source = sourceOf(resolved, csdlJson, type?.id);
    expect(source?.language).toBe('json');
    expect(JSON.parse(source?.text ?? 'null')).toMatchObject({ $Kind: 'EntityType' });
    expect(namespace).not.toBe('');
  });

  it('has nothing for an element the document does not contain', () => {
    expect(sourceOf(resolved, csdlJson, `${namespace}.Nope`)).toBeUndefined();
  });

  it('gives up quietly when the text is not the document the model came from', () => {
    // A fresh model, as the index of `resolved` is already cached.
    expect(sourceOf(loadResolved(csdlJson), 'not json', type?.id)).toBeUndefined();
  });
});
