import { describe, expect, it } from 'vitest';
import { parseXml } from './parse-xml.ts';
import { northwindXml, trippinXml } from './test-fixtures.ts';
import { allElements } from './walk.ts';
import { readXml } from './xml-tree.ts';

const EDM = 'xmlns="http://docs.oasis-open.org/odata/ns/edm"';
const EDMX = 'xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx"';

/** A minimal v4 document around `body`, which goes inside the schema. */
const doc = (body: string, sep = '') =>
  `<edmx:Edmx Version="4.0" ${EDMX}>${sep}<edmx:DataServices><Schema Namespace="N" ${EDM}>${body}</Schema></edmx:DataServices></edmx:Edmx>`;

describe('source spans', () => {
  for (const [name, source] of [
    ['TripPin', trippinXml],
    ['Northwind', northwindXml],
  ] as const) {
    it(`slices every ${name} element back to its exact source text`, () => {
      const model = parseXml(source);
      let checked = 0;
      for (const element of allElements(model)) {
        const { span } = element;
        expect(span, element.id).toBeDefined();
        if (!span) continue;
        const slice = source.slice(span.start, span.end);
        expect(slice.startsWith('<'), element.id).toBe(true);
        expect(slice.endsWith('>'), element.id).toBe(true);
        // Reading the slice on its own gives one complete element that spans all of it.
        const again = readXml(slice);
        expect(again.errors, element.id).toEqual([]);
        expect(again.root?.span, element.id).toEqual({ start: 0, end: slice.length });
        // And it is this element: same Name attribute as the model.
        if (element.kind !== 'schema' && element.kind !== 'returnType') {
          expect(again.root?.attrs.Name, element.id).toBe(element.name);
        }
        checked++;
      }
      expect(checked).toBeGreaterThan(50);
    });
  }

  it('runs from the start tag to the end tag, and to /> for empty elements', () => {
    const src = doc(
      '\r\n  <EntityType Name="A"/>\r\n  <EntityType Name="B"><Key><PropertyRef Name="x"/></Key></EntityType>',
    );
    const [a, b] = parseXml(src).schemas[0]?.entityTypes ?? [];
    expect(src.slice(a?.span?.start, a?.span?.end)).toBe('<EntityType Name="A"/>');
    expect(src.slice(b?.span?.start, b?.span?.end)).toBe(
      '<EntityType Name="B"><Key><PropertyRef Name="x"/></Key></EntityType>',
    );
  });

  it('keeps offsets right after non-ASCII text', () => {
    const src = doc('<!-- é😀 --><EntityType Name="Ünï😀"/>');
    const type = parseXml(src).schemas[0]?.entityTypes[0];
    expect(src.slice(type?.span?.start, type?.span?.end)).toBe('<EntityType Name="Ünï😀"/>');
  });
});

describe('malformed XML', () => {
  it('reports line and column and keeps the parseable part', () => {
    const src = doc(
      '\n<EntityType Name="A"/>\n<EntityType Name="B">\n<Property Name="p" Type="Edm.String" Nullable=false/>\n</EntityType>\n',
    );
    const model = parseXml(src);
    const error = model.diagnostics.find((d) => d.code === 'xml-syntax');
    expect(error).toMatchObject({ severity: 'error', line: 4 });
    expect(error?.column).toBeGreaterThan(0);
    expect(model.schemas[0]?.entityTypes.map((t) => t.name)).toEqual(['A', 'B']);
  });

  it('keeps what was read before a truncated document ends', () => {
    const src = doc('<EntityType Name="A"/><EntityType Name="B"><Prop').replace(
      '</Schema></edmx:DataServices></edmx:Edmx>',
      '',
    );
    const model = parseXml(src);
    expect(model.diagnostics.some((d) => d.code === 'xml-syntax')).toBe(true);
    expect(model.schemas[0]?.entityTypes.map((t) => t.name)).toEqual(['A', 'B']);
  });

  it('reports empty input', () => {
    expect(parseXml('').diagnostics.length).toBeGreaterThan(0);
    expect(parseXml('   ').schemas).toEqual([]);
  });

  it('reports a document that is not EDMX', () => {
    const model = parseXml('<html><body/></html>');
    expect(model.diagnostics).toMatchObject([{ code: 'not-edmx', line: 1, column: 1 }]);
    expect(model.schemas).toEqual([]);
  });

  it('stops reporting after a flood of errors', () => {
    const model = parseXml(`<a>${'<b x=1/>'.repeat(1000)}</a>`);
    expect(model.diagnostics.filter((d) => d.code === 'xml-syntax')).toHaveLength(100);
  });
});

describe('unsupported and unsafe input', () => {
  it('rejects OData v2 and v3 EDMX with a clear message', () => {
    const legacy = 'xmlns:edmx="http://schemas.microsoft.com/ado/2007/06/edmx"';
    const v2 = `<edmx:Edmx Version="1.0" ${legacy}><edmx:DataServices><Schema Namespace="X" xmlns="http://schemas.microsoft.com/ado/2008/09/edm"><EntityType Name="A"/></Schema></edmx:DataServices></edmx:Edmx>`;
    const v3 = `<edmx:Edmx Version="3.0" ${legacy}><edmx:DataServices/></edmx:Edmx>`;
    for (const src of [v2, v3]) {
      const model = parseXml(src);
      expect(model.schemas).toEqual([]);
      expect(model.diagnostics).toHaveLength(1);
      expect(model.diagnostics[0]).toMatchObject({
        code: 'unsupported-version',
        severity: 'error',
      });
      expect(model.diagnostics[0]?.message).toContain('v2/v3');
    }
  });

  it('rejects a v3 version number even under the v4 namespace', () => {
    const model = parseXml(`<edmx:Edmx Version="3.0" ${EDMX}/>`);
    expect(model.diagnostics).toMatchObject([{ code: 'unsupported-version' }]);
  });

  it('refuses DOCTYPE and entity declarations without expanding them', () => {
    const src = `<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY a "aaaa"><!ENTITY b "&a;&a;&a;">]>${doc('').replace('"N"', '"&b;"')}`;
    const model = parseXml(src);
    expect(model.diagnostics).toMatchObject([{ code: 'doctype-refused', severity: 'error' }]);
    expect(model.schemas).toEqual([]);
  });

  it('accepts the TripPin and Northwind documents without diagnostics', () => {
    expect(parseXml(trippinXml).diagnostics).toEqual([]);
    expect(parseXml(northwindXml).diagnostics).toEqual([]);
  });
});

describe('diagnostic positions', () => {
  it('locates span-only diagnostics by line and column', () => {
    const src = `<edmx:Edmx Version="4.0" ${EDMX}>\n<edmx:DataServices>\n  <Schema Namespace="N" ${EDM}>\n    <EntityType/>\n  </Schema>\n</edmx:DataServices></edmx:Edmx>`;
    expect(parseXml(src).diagnostics).toMatchObject([
      { code: 'missing-attribute', line: 4, column: 5 },
    ]);
  });
});
