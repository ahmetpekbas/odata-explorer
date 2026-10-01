// Readable text for annotation values. `expressionText` renders one expression on a line, in a
// `$filter`-like syntax for functions and logic and plain path notation; `expressionTree` keeps records
// and collections as a tree for a generic viewer. Pure TypeScript, so search and exports can use it too.
import { facetEntries, shortName, technicalType } from './humanize.ts';
import type { Annotation, Expression, Facets, OperatorName, PropertyValue } from './model.ts';

const BINARY_WORDS: Partial<Record<OperatorName, string>> = {
  And: 'and',
  Or: 'or',
  Eq: 'eq',
  Ne: 'ne',
  Gt: 'gt',
  Ge: 'ge',
  Lt: 'lt',
  Le: 'le',
  Has: 'has',
  In: 'in',
  Add: 'add',
  Sub: 'sub',
  Mul: 'mul',
  Div: 'div',
  DivBy: 'divby',
  Mod: 'mod',
};

const quote = (text: string) => `'${text.replaceAll("'", "''")}'`;

/** `Ex.Color/Red Ex.Color/Blue` -> `Color/Red, Color/Blue`. */
function enumMembers(value: string): string {
  return value
    .split(/\s+/)
    .filter((m) => m !== '')
    .map(shortName)
    .join(', ');
}

function constantText(type: Extract<Expression, { kind: 'constant' }>['type'], value: string) {
  switch (type) {
    case 'string':
      return quote(value);
    case 'enumMember':
      return enumMembers(value);
    default:
      return value;
  }
}

function facetText(facets: Facets): string {
  const entries = facetEntries(facets).map(([label, value]) => `${label} ${value}`);
  return entries.length > 0 ? ` (${entries.join(', ')})` : '';
}

/** An argument of an operator: a nested operator or conditional is parenthesized. */
function operand(expression: Expression): string {
  const text = expressionText(expression);
  const nested =
    expression.kind === 'if' ||
    (expression.kind === 'operator' &&
      expression.operator !== 'Not' &&
      expression.operator !== 'Neg');
  return nested ? `(${text})` : text;
}

function operatorText(operator: OperatorName, args: Expression[]): string {
  const [first, second] = args;
  if (operator === 'Not') return `not ${first ? operand(first) : ''}`;
  if (operator === 'Neg') return `-${first ? operand(first) : ''}`;
  const word = BINARY_WORDS[operator] ?? operator.toLowerCase();
  if (operator === 'In' && second?.kind === 'collection') {
    return `${first ? operand(first) : ''} in (${second.items.map(expressionText).join(', ')})`;
  }
  return args.map(operand).join(` ${word} `);
}

/** One line of text for an expression. Records and collections are inlined as `{...}` and `[...]`. */
export function expressionText(expression: Expression): string {
  switch (expression.kind) {
    case 'constant':
      return constantText(expression.type, expression.value);
    case 'path':
      return expression.value;
    case 'null':
      return 'null';
    case 'record': {
      const fields = expression.properties.map((p) => `${p.property}: ${expressionText(p.value)}`);
      const body = `{${fields.join(', ')}}`;
      return expression.type ? `${shortName(expression.type)} ${body}` : body;
    }
    case 'collection':
      return `[${expression.items.map(expressionText).join(', ')}]`;
    case 'apply': {
      // `odata.concat` reads as `concat`, the way a $filter function does.
      const name = expression.function.replace(/^odata\./, '');
      return `${name}(${expression.args.map(expressionText).join(', ')})`;
    }
    case 'if':
      return `${operand(expression.test)} ? ${operand(expression.then)} : ${operand(expression.else)}`;
    case 'operator':
      return operatorText(expression.operator, expression.args);
    case 'cast':
    case 'isOf': {
      const type = `${technicalType(expression.type)}${facetText(expression.facets)}`;
      const name = expression.kind === 'cast' ? 'cast' : 'isof';
      return `${name}(${expressionText(expression.value)}, ${type})`;
    }
    case 'labeledElement':
      return `${expressionText(expression.value)} as ${expression.name}`;
    case 'labeledElementReference':
      return `label(${expression.name})`;
    case 'urlRef':
      return `url(${expressionText(expression.value)})`;
  }
}

/** The value of an annotation as text; a bare boolean annotation such as `Core.Computed` is `true`. */
export function annotationText(annotation: Annotation): string {
  return annotation.value ? expressionText(annotation.value) : 'true';
}

// ---------------------------------------------------------------------------------------------
// Generic tree

export interface ValueNode {
  /** What the node is: a record property name, or the position in a collection. */
  label?: string;
  /** The value of a leaf, or the heading of a record or collection. */
  text: string;
  kind: 'value' | 'expression' | 'record' | 'collection';
  children: ValueNode[];
}

function labeled(label: string | undefined, node: ValueNode): ValueNode {
  return label === undefined ? node : { ...node, label };
}

function propertyNode({ property, value }: PropertyValue): ValueNode {
  return labeled(property, expressionTree(value));
}

/**
 * Records and collections become nodes with children; everything else is a leaf with its one-line
 * text. Dynamic expressions (Apply, If, operators, ...) stay a leaf, as readable text.
 */
export function expressionTree(expression: Expression, label?: string): ValueNode {
  switch (expression.kind) {
    case 'record':
      return labeled(label, {
        text: expression.type ? shortName(expression.type) : 'Record',
        kind: 'record',
        children: expression.properties.map(propertyNode),
      });
    case 'collection': {
      const n = expression.items.length;
      return labeled(label, {
        text: `${n} ${n === 1 ? 'item' : 'items'}`,
        kind: 'collection',
        children: expression.items.map((item, i) => expressionTree(item, String(i + 1))),
      });
    }
    case 'constant':
    case 'path':
    case 'null':
      return labeled(label, { text: expressionText(expression), kind: 'value', children: [] });
    default:
      return labeled(label, { text: expressionText(expression), kind: 'expression', children: [] });
  }
}
