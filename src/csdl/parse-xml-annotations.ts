// CSDL XML annotations and annotation expressions, in both attribute and element form.
import { CONSTANTS, OPERATORS, PATHS } from './expression-names.ts';
import type {
  Annotation,
  AnnotationBlock,
  Expression,
  OperatorName,
  PathType,
  PropertyValue,
} from './model.ts';
import { typeRef } from './ids.ts';
import { type Ctx, facets } from './xml-attrs.ts';
import type { XNode } from './xml-tree.ts';

const EDM_NS = 'http://docs.oasis-open.org/odata/ns/edm';

/** The `<Annotation>` children of a node; annotations of an annotation share its origin. */
export function inlineAnnotations(
  ctx: Ctx,
  node: XNode,
  origin: Annotation['origin'] = 'inline',
): Annotation[] {
  return node.children
    .filter((c) => c.name === 'Annotation')
    .map((c) => parseAnnotation(ctx, c, origin));
}

/** `<Annotations Target="..." Qualifier="...">` */
export function parseAnnotationBlock(ctx: Ctx, node: XNode): AnnotationBlock {
  const annotations = node.children
    .filter((c) => c.name === 'Annotation')
    .map((c) => parseAnnotation(ctx, c, 'external'));
  const qualifier = node.attrs.Qualifier;
  if (qualifier) {
    for (const annotation of annotations) annotation.qualifier ??= qualifier;
  }
  return { target: node.attrs.Target ?? '', annotations, span: node.span };
}

function parseAnnotation(ctx: Ctx, node: XNode, origin: Annotation['origin']): Annotation {
  const annotation: Annotation = {
    term: node.attrs.Term ?? '',
    annotations: inlineAnnotations(ctx, node, origin),
    origin,
    span: node.span,
  };
  if (!annotation.term) {
    ctx.diagnostics.push({
      severity: 'error',
      code: 'missing-attribute',
      message: '<Annotation> is missing the required attribute Term.',
      span: node.span,
    });
  }
  if (node.attrs.Qualifier) annotation.qualifier = node.attrs.Qualifier;
  const value = valueOf(ctx, node);
  if (value) annotation.value = value;
  return annotation;
}

/** The expression an element carries: an attribute form, else its first expression child. */
function valueOf(ctx: Ctx, node: XNode): Expression | undefined {
  for (const [attr, value] of Object.entries(node.attrs)) {
    const constant = CONSTANTS[attr];
    if (constant) return { kind: 'constant', type: constant, value };
    if (PATHS.has(attr)) return { kind: 'path', type: attr as PathType, value };
    if (attr === 'UrlRef') {
      return { kind: 'urlRef', value: { kind: 'constant', type: 'string', value } };
    }
  }
  for (const child of node.children) {
    if (child.name === 'Annotation' || child.name === 'PropertyValue') continue;
    const expr = parseExpression(ctx, child);
    if (expr) return expr;
  }
  return undefined;
}

function args(ctx: Ctx, node: XNode): Expression[] {
  return node.children
    .filter((c) => c.name !== 'Annotation')
    .map((c) => parseExpression(ctx, c))
    .filter((e) => e !== undefined);
}

const NULL: Expression = { kind: 'null', annotations: [] };

function parseExpression(ctx: Ctx, node: XNode): Expression | undefined {
  const constant = CONSTANTS[node.name];
  if (constant) {
    return {
      kind: 'constant',
      type: constant,
      value: constant === 'string' ? node.text : node.text.trim(),
    };
  }
  if (PATHS.has(node.name))
    return { kind: 'path', type: node.name as PathType, value: node.text.trim() };
  if (OPERATORS.has(node.name)) {
    return { kind: 'operator', operator: node.name as OperatorName, args: args(ctx, node) };
  }

  switch (node.name) {
    case 'Null':
      return { kind: 'null', annotations: inlineAnnotations(ctx, node) };
    case 'Record': {
      const record: Expression = {
        kind: 'record',
        properties: node.children
          .filter((c) => c.name === 'PropertyValue')
          .map((c) => propertyValue(ctx, c)),
        annotations: inlineAnnotations(ctx, node),
      };
      if (node.attrs.Type) record.type = node.attrs.Type;
      return record;
    }
    case 'Collection':
      return { kind: 'collection', items: args(ctx, node) };
    case 'Apply':
      return {
        kind: 'apply',
        function: node.attrs.Function ?? '',
        args: args(ctx, node),
        annotations: inlineAnnotations(ctx, node),
      };
    case 'If': {
      const [test, then, otherwise] = args(ctx, node);
      return { kind: 'if', test: test ?? NULL, then: then ?? NULL, else: otherwise ?? NULL };
    }
    case 'Cast':
    case 'IsOf':
      return {
        kind: node.name === 'Cast' ? 'cast' : 'isOf',
        type: typeRef(node.attrs.Type ?? ''),
        facets: facets(node),
        value: valueOf(ctx, node) ?? NULL,
      };
    case 'LabeledElement':
      return {
        kind: 'labeledElement',
        name: node.attrs.Name ?? '',
        value: valueOf(ctx, node) ?? NULL,
      };
    case 'LabeledElementReference':
      return { kind: 'labeledElementReference', name: node.text.trim() };
    case 'UrlRef':
      return { kind: 'urlRef', value: valueOf(ctx, node) ?? NULL };
  }

  if (node.uri === EDM_NS) {
    ctx.diagnostics.push({
      severity: 'warning',
      code: 'unknown-expression',
      message: `Unknown annotation expression <${node.name}>.`,
      span: node.span,
    });
  }
  return undefined;
}

function propertyValue(ctx: Ctx, node: XNode): PropertyValue {
  return {
    property: node.attrs.Property ?? '',
    value: valueOf(ctx, node) ?? NULL,
    annotations: inlineAnnotations(ctx, node),
  };
}
