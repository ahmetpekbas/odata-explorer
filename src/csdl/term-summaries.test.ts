import { describe, expect, it } from 'vitest';
import type { Annotation } from './model.ts';
import { parseXml } from './parse-xml.ts';
import { resolve } from './resolve.ts';
import {
  capabilitiesOf,
  describeAnnotation,
  propertyHints,
  summarizeAnnotation,
} from './term-summaries.ts';

const VOCABULARIES = ['Core', 'Capabilities', 'Validation', 'Measures'];
const references = VOCABULARIES.map(
  (v) =>
    `<edmx:Reference Uri="${v}.xml"><edmx:Include Namespace="Org.OData.${v}.V1" Alias="${v}"/></edmx:Reference>`,
).join('');

/** The first annotation written inside a property, resolved against the standard vocabularies. */
function annotation(xml: string): Annotation {
  const doc = `<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">${references}<edmx:DataServices><Schema Namespace="N" xmlns="http://docs.oasis-open.org/odata/ns/edm"><EntityType Name="T"><Property Name="P" Type="Edm.String">${xml}</Property></EntityType></Schema></edmx:DataServices></edmx:Edmx>`;
  const { elements } = resolve(parseXml(doc), doc, { has: () => true, get: () => undefined });
  const found = elements.get('N.T/P')?.annotations[0];
  if (!found) throw new Error('no annotation');
  return found;
}
const say = (xml: string) => summarizeAnnotation(annotation(xml));

const record = (term: string, body = '') =>
  `<Annotation Term="Capabilities.${term}"><Record>${body}</Record></Annotation>`;
const bool = (name: string, value: boolean) =>
  `<PropertyValue Property="${name}" Bool="${value}"/>`;
const paths = (name: string, ...values: string[]) =>
  `<PropertyValue Property="${name}"><Collection>${values.map((v) => `<PropertyPath>${v}</PropertyPath>`).join('')}</Collection></PropertyValue>`;

describe('Core', () => {
  it('shows descriptions as they are', () => {
    expect(say('<Annotation Term="Core.Description" String="Hello"/>')).toBe('Hello');
    expect(say('<Annotation Term="Core.LongDescription" String="Long"/>')).toBe('Long');
    expect(say('<Annotation Term="Core.Description"><Path>X</Path></Annotation>')).toBeUndefined();
  });

  it('reads a bare tag as true and an explicit false as false', () => {
    expect(say('<Annotation Term="Core.Computed"/>')).toBe('Computed by the service');
    expect(say('<Annotation Term="Core.Computed" Bool="false"/>')).toBe(
      'Not computed by the service',
    );
    expect(say('<Annotation Term="Core.Immutable"/>')).toBe('Cannot be changed once it is set');
    expect(say('<Annotation Term="Core.Immutable" Bool="false"/>')).toBe('Can be changed');
  });

  it('lists permissions', () => {
    const permissions = (member: string) =>
      say(`<Annotation Term="Core.Permissions" EnumMember="${member}"/>`);
    expect(permissions('Core.Permission/Read')).toBe('Permissions: Read');
    expect(permissions('Core.Permission/Read Core.Permission/Invoke')).toBe(
      'Permissions: Read, Invoke',
    );
    expect(permissions('Core.Permission/None')).toBe('No permissions');
  });

  it('names the concurrency token', () => {
    const concurrency = (items: string) =>
      say(
        `<Annotation Term="Core.OptimisticConcurrency"><Collection>${items}</Collection></Annotation>`,
      );
    expect(concurrency('<PropertyPath>ETag</PropertyPath><PropertyPath>Ver</PropertyPath>')).toBe(
      'Concurrency token: ETag, Ver',
    );
    expect(concurrency('')).toBe('No concurrency properties');
  });
});

describe('Capabilities', () => {
  it('reads an absent flag as the vocabulary default (allowed)', () => {
    expect(say(record('InsertRestrictions'))).toBe('Entries can be created');
    expect(say(record('UpdateRestrictions'))).toBe('Entries can be updated');
    expect(say(record('DeleteRestrictions'))).toBe('Entries can be deleted');
    expect(say(record('FilterRestrictions'))).toBe('Can be filtered');
    expect(say(record('SortRestrictions'))).toBe('Can be sorted');
    expect(say(record('SearchRestrictions'))).toBe('Can be searched');
    expect(say(record('ExpandRestrictions'))).toBe('Links can be expanded');
    expect(say(record('CountRestrictions'))).toBe('Can be counted');
  });

  it('reads a false flag as a restriction', () => {
    expect(say(record('InsertRestrictions', bool('Insertable', false)))).toBe(
      'Entries cannot be created',
    );
    expect(say(record('UpdateRestrictions', bool('Updatable', false)))).toBe(
      'Entries cannot be updated',
    );
    expect(say(record('DeleteRestrictions', bool('Deletable', false)))).toBe(
      'Entries cannot be deleted',
    );
    expect(say(record('FilterRestrictions', bool('Filterable', false)))).toBe('Cannot be filtered');
    expect(say(record('SortRestrictions', bool('Sortable', false)))).toBe('Cannot be sorted');
    expect(say(record('SearchRestrictions', bool('Searchable', false)))).toBe('Cannot be searched');
    expect(say(record('ExpandRestrictions', bool('Expandable', false)))).toBe(
      'Links cannot be expanded',
    );
    expect(say(record('CountRestrictions', bool('Countable', false)))).toBe('Cannot be counted');
  });

  it('adds the properties a restriction singles out', () => {
    expect(
      say(
        record(
          'FilterRestrictions',
          paths('RequiredProperties', 'Name') + paths('NonFilterableProperties', 'A', 'B'),
        ),
      ),
    ).toBe('Can be filtered (filter required on: Name; not filterable: A, B)');
    expect(say(record('SortRestrictions', paths('NonSortableProperties', 'Id')))).toBe(
      'Can be sorted (not sortable: Id)',
    );
  });

  it('reads navigation restrictions, defaulting to recursive', () => {
    expect(say(record('NavigationRestrictions'))).toBe('Links can be followed to any depth');
    expect(
      say(
        record(
          'NavigationRestrictions',
          '<PropertyValue Property="Navigability" EnumMember="Capabilities.NavigationType/None"/>',
        ),
      ),
    ).toBe('Links cannot be followed');
    expect(
      say(
        record(
          'NavigationRestrictions',
          `<PropertyValue Property="RestrictedProperties"><Collection><Record>
             <PropertyValue Property="NavigationProperty" NavigationPropertyPath="Orders"/>
             <PropertyValue Property="Navigability" EnumMember="Capabilities.NavigationType/Single"/>
           </Record></Collection></PropertyValue>`,
        ),
      ),
    ).toBe('Links can be followed to any depth (restricted: Orders)');
  });

  it('reads $top and $skip support', () => {
    expect(say('<Annotation Term="Capabilities.TopSupported"/>')).toBe('$top is supported');
    expect(say('<Annotation Term="Capabilities.TopSupported" Bool="false"/>')).toBe(
      '$top is not supported',
    );
    expect(say('<Annotation Term="Capabilities.SkipSupported"/>')).toBe('$skip is supported');
    expect(say('<Annotation Term="Capabilities.SkipSupported" Bool="false"/>')).toBe(
      '$skip is not supported',
    );
  });

  it('leaves a value of the wrong shape and unknown terms to the generic view', () => {
    expect(say('<Annotation Term="Capabilities.InsertRestrictions" Bool="true"/>')).toBeUndefined();
    expect(say('<Annotation Term="Capabilities.BatchSupported"/>')).toBeUndefined();
  });
});

describe('Validation', () => {
  it('lists the allowed values', () => {
    expect(
      say(
        `<Annotation Term="Validation.AllowedValues"><Collection>
           <Record><PropertyValue Property="Value" String="S"/></Record>
           <Record><PropertyValue Property="Value" String="M"/></Record>
         </Collection></Annotation>`,
      ),
    ).toBe('One of: S, M');
  });

  it('describes bounds, inclusive unless marked exclusive', () => {
    expect(say('<Annotation Term="Validation.Minimum" Int="0"/>')).toBe('At least 0');
    expect(say('<Annotation Term="Validation.Maximum" Decimal="9.5"/>')).toBe('At most 9.5');
    expect(
      say(
        '<Annotation Term="Validation.Minimum" Int="0"><Annotation Term="Validation.Exclusive"/></Annotation>',
      ),
    ).toBe('More than 0');
    expect(
      say(
        '<Annotation Term="Validation.Maximum" Int="9"><Annotation Term="Validation.Exclusive"/></Annotation>',
      ),
    ).toBe('Less than 9');
    expect(
      say(
        '<Annotation Term="Validation.Maximum" Int="9"><Annotation Term="Validation.Exclusive" Bool="false"/></Annotation>',
      ),
    ).toBe('At most 9');
  });

  it('shows the pattern', () => {
    expect(say('<Annotation Term="Validation.Pattern" String="^[A-Z]+$"/>')).toBe(
      'Matches: ^[A-Z]+$',
    );
  });
});

describe('Measures', () => {
  it('shows currency and unit', () => {
    expect(say('<Annotation Term="Measures.ISOCurrency" String="EUR"/>')).toBe('Currency: EUR');
    expect(say('<Annotation Term="Measures.Unit" String="kg"/>')).toBe('Unit: kg');
    expect(say('<Annotation Term="Measures.ISOCurrency"><Path>Cur</Path></Annotation>')).toBe(
      'Currency: {Cur}',
    );
  });
});

describe('describeAnnotation', () => {
  it('falls back to the expression text for other terms', () => {
    expect(describeAnnotation(annotation('<Annotation Term="Ex.Thing" Int="3"/>'))).toBe('3');
    expect(describeAnnotation(annotation('<Annotation Term="Ex.Flag"/>'))).toBe('true');
    expect(describeAnnotation(annotation('<Annotation Term="Core.Computed"/>'))).toBe(
      'Computed by the service',
    );
  });
});

describe('capabilitiesOf', () => {
  const caps = (...xml: string[]) => capabilitiesOf(xml.map(annotation));

  it('says nothing when no restriction is annotated', () => {
    expect(caps()).toEqual([]);
    expect(caps('<Annotation Term="Capabilities.TopSupported"/>')).toEqual([]);
  });

  it('lists every capability, defaulting the ones that are not annotated to enabled', () => {
    const list = caps(record('InsertRestrictions', bool('Insertable', false)));
    expect(list.map((c) => c.label)).toEqual([
      'Insertable',
      'Updatable',
      'Deletable',
      'Filterable',
      'Sortable',
      'Searchable',
      'Expandable',
      'Countable',
    ]);
    expect(list[0]).toEqual({ label: 'Insertable', enabled: false, explicit: true });
    expect(list[1]).toEqual({ label: 'Updatable', enabled: true, explicit: false });
  });

  it('treats an annotation without its flag as enabled but explicit', () => {
    const [insertable] = caps(record('InsertRestrictions', paths('RequiredProperties', 'A')));
    expect(insertable).toEqual({ label: 'Insertable', enabled: true, explicit: true });
  });
});

describe('propertyHints', () => {
  const hints = (...xml: string[]) => propertyHints(xml.map(annotation));

  it('is empty for a property without annotations', () => {
    expect(hints()).toEqual({ computed: false, immutable: false, rules: [] });
  });

  it('marks Computed and Immutable, a bare tag being true and false being off', () => {
    expect(
      hints('<Annotation Term="Core.Computed"/>', '<Annotation Term="Core.Immutable"/>'),
    ).toMatchObject({
      computed: true,
      immutable: true,
    });
    expect(hints('<Annotation Term="Core.Computed" Bool="false"/>').computed).toBe(false);
  });

  it('collects the validation rules in document order', () => {
    expect(
      hints(
        '<Annotation Term="Validation.Maximum" Int="9"/>',
        '<Annotation Term="Core.Description" String="ignored"/>',
        '<Annotation Term="Validation.Minimum" Int="1"/>',
        '<Annotation Term="Validation.Pattern" String="^a"/>',
      ).rules,
    ).toEqual(['At most 9', 'At least 1', 'Matches: ^a']);
  });
});
