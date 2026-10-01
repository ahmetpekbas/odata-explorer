import { describe, expect, it } from 'vitest';
import { annotationText, expressionText, expressionTree } from './annotations.ts';
import type { Annotation, Expression } from './model.ts';
import { parseXml } from './parse-xml.ts';
import { resolve } from './resolve.ts';
import { coreOnly, expressionsXml } from './test-fixtures.ts';

const { elements } = resolve(parseXml(expressionsXml), expressionsXml, coreOnly);
const annotations: Annotation[] = [...elements.values()].flatMap((e) => e.annotations);
const byTerm = (term: string): Annotation => {
  const found = annotations.find((a) => a.term === `Ex.${term}`);
  if (!found) throw new Error(`no annotation Ex.${term}`);
  return found;
};
const text = (term: string) => annotationText(byTerm(term));

describe('the 1.5 expression fixture', () => {
  it('renders every annotation as non-empty text', () => {
    const exTerms = annotations.filter((a) => a.term.startsWith('Ex.'));
    expect(exTerms.length).toBeGreaterThan(55);
    for (const a of exTerms) expect(annotationText(a), a.term).not.toBe('');
  });

  it('renders every annotation as before', () => {
    const rendered = Object.fromEntries(
      annotations.map((a) => [`${a.target} ${a.term}`, annotationText(a)]),
    );
    expect(rendered).toMatchSnapshot();
  });

  it('builds a tree for every annotation', () => {
    const trees = Object.fromEntries(
      annotations.flatMap((a) =>
        a.value ? [[`${a.target} ${a.term}`, expressionTree(a.value)]] : [],
      ),
    );
    expect(trees).toMatchSnapshot();
  });
});

describe('expressionText', () => {
  it('quotes strings and keeps other constants as written', () => {
    expect(text('String')).toBe("'text'");
    expect(text('Int')).toBe('42');
    expect(text('Bool')).toBe('false');
    expect(text('ElString')).toBe("' padded text '");
    expect(expressionText({ kind: 'constant', type: 'string', value: "it's" })).toBe("'it''s'");
  });

  it('names enum members without their namespace', () => {
    expect(text('EnumMember')).toBe('Color/Red, Color/Blue');
  });

  it('shows paths as written and a bare annotation as true', () => {
    expect(text('Path')).toBe('Name');
    expect(text('AnnotationPath')).toBe('Orders/@UI.LineItem');
    const bare = byTerm('Binary');
    expect(annotationText({ ...bare, value: undefined })).toBe('true');
  });

  it('renders functions like $filter functions', () => {
    expect(text('Apply')).toBe("concat('A', Name)");
    expect(text('UrlRef')).toBe("url(concat('http://x/', Name))");
  });

  it('renders logic and comparison with words', () => {
    expect(text('And')).toBe('true and Flag');
    expect(text('Not')).toBe('not true');
    expect(text('Ge')).toBe('Price ge 1');
    expect(text('Has')).toBe('Flags has Color/Red');
    expect(text('In')).toBe("Name in ('a')");
    expect(text('If')).toBe("true ? 'yes' : 'no'");
  });

  it('parenthesizes nested operators', () => {
    expect(text('Arithmetic')).toBe('Price add (2 mul -3)');
    expect(text('Arithmetic2')).toBe('(4 sub 1) div (6 divby (5 mod 3))');
    const not: Expression = {
      kind: 'operator',
      operator: 'Not',
      args: [
        {
          kind: 'operator',
          operator: 'Or',
          args: [
            { kind: 'path', type: 'Path', value: 'A' },
            { kind: 'path', type: 'Path', value: 'B' },
          ],
        },
      ],
    };
    expect(expressionText(not)).toBe('not (A or B)');
  });

  it('renders casts with their facets', () => {
    expect(text('Cast')).toBe('cast(Price, Edm.Decimal (Precision 10, Scale 2))');
    expect(text('IsOf')).toBe('isof(Name, Collection(Edm.String) (MaxLength 5))');
  });

  it('renders records, collections and labels inline', () => {
    expect(text('Record')).toBe("Info {Title: 'Hello', Count: 3, Where: Name}");
    expect(text('Collection')).toBe("['a', 1, {P: true}]");
    expect(text('Labeled')).toBe('Name as Label1');
    expect(text('LabeledRef')).toBe('label(Ex.Label1)');
    expect(text('Null')).toBe('null');
  });
});

describe('expressionTree', () => {
  it('turns a record into labelled children', () => {
    const value = byTerm('Record').value as Expression;
    const tree = expressionTree(value);
    expect(tree.kind).toBe('record');
    expect(tree.text).toBe('Info');
    expect(tree.children.map((c) => [c.label, c.text, c.kind])).toEqual([
      ['Title', "'Hello'", 'value'],
      ['Count', '3', 'value'],
      ['Where', 'Name', 'value'],
    ]);
  });

  it('numbers the items of a collection and nests records', () => {
    const tree = expressionTree(byTerm('Collection').value as Expression);
    expect(tree).toMatchObject({ kind: 'collection', text: '3 items' });
    expect(tree.children.map((c) => c.label)).toEqual(['1', '2', '3']);
    expect(tree.children[2]).toMatchObject({ kind: 'record', text: 'Record' });
    expect(tree.children[2]?.children[0]).toMatchObject({ label: 'P', text: 'true' });
  });

  it('keeps a dynamic expression as one readable leaf', () => {
    expect(expressionTree(byTerm('Apply').value as Expression, 'Url')).toEqual({
      label: 'Url',
      text: "concat('A', Name)",
      kind: 'expression',
      children: [],
    });
  });
});
