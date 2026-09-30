// Streams XML through saxes into a light element tree with source spans. The CSDL converter in
// parse-xml.ts walks this tree, which keeps it free of SAX state handling.
import { SaxesParser } from 'saxes';
import type { Span } from './model.ts';

export interface XNode {
  /** Local name, without a namespace prefix. */
  name: string;
  /** Namespace URI of the element. */
  uri: string;
  /** Unprefixed attributes, keyed by name. Prefixed attributes (extensions) are dropped. */
  attrs: Record<string, string>;
  children: XNode[];
  /** Concatenated character data directly inside the element. */
  text: string;
  /** Offsets of the whole element, from `<` of the start tag to `>` of the end tag. */
  span: Span;
}

export interface XmlError {
  message: string;
  line: number;
  column: number;
}

export interface XmlTree {
  root?: XNode;
  errors: XmlError[];
  /** The document declares a DOCTYPE, which is refused. */
  hasDoctype: boolean;
}

/** Thrown inside a saxes handler to abandon the parse, e.g. on a DOCTYPE. */
class Abort extends Error {}

export function readXml(text: string): XmlTree {
  const parser = new SaxesParser({ xmlns: true });
  const errors: XmlError[] = [];
  const stack: XNode[] = [];
  let root: XNode | undefined;
  let hasDoctype = false;

  parser.on('error', (e) => {
    errors.push({
      message: e.message.replace(/^\d+:\d+: /, ''),
      line: parser.line,
      column: parser.column,
    });
  });
  parser.on('doctype', () => {
    hasDoctype = true;
    throw new Abort();
  });
  parser.on('opentag', (tag) => {
    const attrs: Record<string, string> = {};
    for (const attr of Object.values(tag.attributes)) {
      if (attr.prefix === '' && attr.local !== 'xmlns') attrs[attr.local] = attr.value;
    }
    // The parser is just past `>` here, and `<` cannot occur inside a start tag.
    const start = text.lastIndexOf('<', parser.position - 1);
    const node: XNode = {
      name: tag.local,
      uri: tag.uri,
      attrs,
      children: [],
      text: '',
      span: { start, end: parser.position },
    };
    stack.at(-1)?.children.push(node);
    root ??= node;
    stack.push(node);
  });
  parser.on('closetag', () => {
    const node = stack.pop();
    if (node) node.span.end = parser.position;
  });
  const onText = (data: string) => {
    const node = stack.at(-1);
    if (node) node.text += data;
  };
  parser.on('text', onText);
  parser.on('cdata', onText);

  try {
    parser.write(text).close();
  } catch (e) {
    if (!(e instanceof Abort)) throw e;
  }
  // Elements left open by malformed input end where the input ends.
  for (const node of stack) node.span.end = text.length;
  return { root, errors, hasDoctype };
}
