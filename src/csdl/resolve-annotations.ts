// Annotation attachment. After this runs, `element.annotations` holds every annotation that applies
// to the element: the inline ones, then those from `<Annotations Target>` blocks in document order.
// Each annotation records its qualifier (a block's qualifier is copied down), its origin, and the
// target path it was written against; for external targets that may be longer than the element's ID
// (`NS.Type/Complex/Prop`, `NS.Container/Set/Prop`).
import { annotationId, childId, overloadGroupId } from './ids.ts';
import type { Annotation, Diagnostic, Element, Model, Operation } from './model.ts';
import { memberLookup, type Structure } from './resolve-structure.ts';

export function attachAnnotations(
  model: Model,
  elements: Map<string, Element>,
  structure: Structure,
  qualifyName: (name: string) => string,
): void {
  const { followPath } = memberLookup(structure, elements, qualifyName);
  const ownNamespaces = new Set(model.schemas.map((s) => s.namespace));

  const groups = new Map<string, Operation[]>();
  for (const e of elements.values()) {
    if (e.kind !== 'action' && e.kind !== 'function') continue;
    const group = groups.get(overloadGroupId(e.id));
    if (group) group.push(e);
    else groups.set(overloadGroupId(e.id), [e]);
  }

  // Inline annotations know their target already, and so do their nested annotations.
  const stamp = (annotation: Annotation, target: string) => {
    annotation.target = target;
    const own = annotationId(target, annotation.term, annotation.qualifier);
    for (const nested of annotation.annotations) stamp(nested, own);
  };
  for (const element of elements.values()) {
    for (const annotation of element.annotations) stamp(annotation, element.id);
  }

  const qualifyTypeString = (t: string): string => {
    const m = /^Collection\((.*)\)$/.exec(t);
    return m ? `Collection(${qualifyName(m[1] ?? '')})` : qualifyName(t);
  };

  /** `Alias.Fn(Alias.T, Edm.Int32)` -> `NS.Fn(NS.T,Edm.Int32)`. */
  const normalizeHead = (head: string): string => {
    const open = head.indexOf('(');
    if (open < 0) return qualifyName(head);
    const inner = head.slice(open + 1, head.lastIndexOf(')')).trim();
    const types = inner === '' ? [] : inner.split(',').map((t) => qualifyTypeString(t.trim()));
    return `${qualifyName(head.slice(0, open))}(${types.join(',')})`;
  };

  /** The elements a target path names, and the path normalized to full namespaces. */
  const resolveTarget = (raw: string): { elements: Element[]; path: string } => {
    const slash = raw.indexOf('/');
    const head = normalizeHead((slash < 0 ? raw : raw.slice(0, slash)).trim());
    const rest = slash < 0 ? [] : raw.slice(slash + 1).split('/');
    const path = [head, ...rest].join('/');

    // `NS.Fn` alone names every overload; `NS.Fn(Type)` exactly one.
    const starts = head.includes('(')
      ? [elements.get(head)]
      : (groups.get(head) ?? [elements.get(head)]);

    const found: Element[] = [];
    for (const root of starts) {
      if (!root) continue;
      const hit = descend(root, rest);
      if (hit) found.push(hit);
    }
    return { elements: found, path };
  };

  const descend = (root: Element, segments: string[]): Element | undefined => {
    if (segments.length === 0) return root;
    switch (root.kind) {
      case 'entityType':
      case 'complexType':
        return followPath(root.id, segments.join('/'));
      case 'enumType':
      case 'action':
      case 'function':
        // A member or a parameter; a return type is written `$ReturnType`.
        return segments.length === 1
          ? elements.get(childId(root.id, segments[0] ?? ''))
          : undefined;
      case 'entityContainer': {
        const holder = elements.get(childId(root.id, segments[0] ?? ''));
        if (segments.length === 1) return holder;
        if (holder?.kind === 'entitySet' || holder?.kind === 'singleton') {
          const typeName = holder.kind === 'entitySet' ? holder.entityType.name : holder.type.name;
          return followPath(typeName, segments.slice(1).join('/'));
        }
        return undefined;
      }
      default:
        return undefined;
    }
  };

  const report = (
    severity: Diagnostic['severity'],
    code: string,
    message: string,
    span?: Diagnostic['span'],
  ) => {
    const d: Diagnostic = { severity, code, message };
    if (span) d.span = span;
    model.diagnostics.push(d);
  };

  for (const schema of model.schemas) {
    for (const block of schema.annotationBlocks) {
      // `Target/@Term#Qualifier` annotates another annotation.
      const at = block.target.indexOf('/@');
      const targetText = at < 0 ? block.target : block.target.slice(0, at);
      const { elements: targets, path } = resolveTarget(targetText);
      let attachTo: { annotations: Annotation[] }[] = targets;
      let targetId = path;

      if (at >= 0) {
        const [termText = '', qualifier] = block.target.slice(at + 2).split('#');
        const term = qualifyName(termText);
        attachTo = targets.flatMap((e) =>
          e.annotations.filter((a) => a.term === term && a.qualifier === qualifier),
        );
        targetId = annotationId(path, term, qualifier);
      }

      if (attachTo.length === 0) {
        const namespace = namespaceOf(path);
        const external = !ownNamespaces.has(namespace);
        report(
          external ? 'info' : 'warning',
          external ? 'external-annotation-target' : 'unresolved-annotation-target',
          external
            ? `The annotation target ${block.target} is in ${namespace || 'no namespace'}, which this document does not define.`
            : `The annotation target ${block.target} does not match any element.`,
          block.span,
        );
        continue;
      }

      for (const annotation of block.annotations) {
        if (block.qualifier && !annotation.qualifier) annotation.qualifier = block.qualifier;
        stamp(annotation, targetId);
        for (const holder of attachTo) holder.annotations.push(annotation);
      }
    }
  }
}

/** The namespace of a qualified path: everything before the last dot of its first segment. */
function namespaceOf(path: string): string {
  const head = path.split(/[/(]/)[0] ?? '';
  return head.slice(0, Math.max(head.lastIndexOf('.'), 0));
}
