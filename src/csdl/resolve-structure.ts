// Structural resolution: inheritance, partners, exposure by sets and singletons, navigation bindings.
// Runs after names are qualified (resolve.ts), so every reference is a full qualified name.
import { childId } from './ids.ts';
import type {
  Diagnostic,
  Element,
  KeyProperty,
  Model,
  NavigationProperty,
  Property,
  StructuredType,
} from './model.ts';

export interface TypeInfo {
  /** Ancestors, nearest first. Stops at a base type that cannot be found or at a cycle. */
  baseChain: string[];
  /** Direct subtypes. */
  derived: string[];
  /** All subtypes, at any depth. */
  descendants: string[];
  /** The key, inherited from the nearest ancestor that declares one. Empty for keyless types. */
  key: KeyProperty[];
  /** The type that declares `key`. */
  keyOwner?: string;
  /** IDs of own and inherited properties, base type first. */
  propertyIds: string[];
  /** IDs of own and inherited navigation properties, base type first. */
  navigationPropertyIds: string[];
}

/** Entity sets and singletons whose declared type is exactly this type. */
export interface Exposure {
  entitySets: string[];
  singletons: string[];
}

export interface ResolvedBinding {
  path: string;
  target: string;
  /** ID of the navigation property the path ends in, when it can be found. */
  navigationId?: string;
  /** ID of the entity set or singleton the binding points at, when it can be found. */
  targetId?: string;
}

export interface Structure {
  /** Structured types (entity and complex) by ID. */
  types: Map<string, TypeInfo>;
  /** Navigation property ID -> ID of its inverse, from `Partner`. Both directions are present. */
  partners: Map<string, string>;
  /** Entity type ID -> the sets and singletons that expose it. */
  exposure: Map<string, Exposure>;
  /** Entity set or singleton ID -> its navigation property bindings. */
  bindings: Map<string, ResolvedBinding[]>;
}

type Structured = StructuredType;

export function resolveStructure(
  model: Model,
  elements: Map<string, Element>,
  qualifyName: (name: string) => string,
): Structure {
  const structure: Structure = {
    types: new Map(),
    partners: new Map(),
    exposure: new Map(),
    bindings: new Map(),
  };
  const report = (element: Element, code: string, message: string) => {
    const d: Diagnostic = { severity: 'warning', code, message, target: element.id };
    if (element.span) d.span = element.span;
    model.diagnostics.push(d);
  };
  const structuredType = (id: string): Structured | undefined => {
    const e = elements.get(id);
    return e?.kind === 'entityType' || e?.kind === 'complexType' ? e : undefined;
  };

  // --- Inheritance -----------------------------------------------------------------------------
  const all: Structured[] = [];
  for (const e of elements.values())
    if (e.kind === 'entityType' || e.kind === 'complexType') all.push(e);

  for (const type of all) {
    const baseChain: string[] = [];
    const seen = new Set([type.id]);
    for (let base = type.baseType?.name; base;) {
      if (seen.has(base)) {
        report(type, 'base-type-cycle', `${type.id} inherits from itself through ${base}.`);
        break;
      }
      const baseType = structuredType(base);
      if (!baseType) break;
      seen.add(base);
      baseChain.push(base);
      base = baseType.baseType?.name;
    }
    structure.types.set(type.id, {
      baseChain,
      derived: [],
      descendants: [],
      key: [],
      propertyIds: [],
      navigationPropertyIds: [],
    });
  }

  for (const type of all) {
    const info = structure.types.get(type.id);
    if (!info) continue;
    // The chain, base first, ending with the type itself.
    const lineage = [...info.baseChain].reverse().concat(type.id);
    for (const id of lineage) {
      const t = structuredType(id);
      if (!t) continue;
      info.propertyIds.push(...t.properties.map((p) => p.id));
      info.navigationPropertyIds.push(...t.navigationProperties.map((n) => n.id));
      if (t.key.length > 0) {
        info.key = t.key;
        info.keyOwner = t.id;
      }
    }
    const parent = info.baseChain[0];
    if (parent) structure.types.get(parent)?.derived.push(type.id);
    for (const ancestor of info.baseChain) structure.types.get(ancestor)?.descendants.push(type.id);
  }

  /** Finds a member by name on a type or any of its ancestors. */
  const findMember = (typeId: string, name: string): Property | NavigationProperty | undefined => {
    const info = structure.types.get(typeId);
    for (const id of [...(info?.propertyIds ?? []), ...(info?.navigationPropertyIds ?? [])]) {
      const e = elements.get(id);
      if (e?.name === name && (e.kind === 'property' || e.kind === 'navigationProperty')) return e;
    }
    return undefined;
  };

  /**
   * Follows a path such as `Address/Country` or `NS.Derived/Nav` from a type. Type-cast segments
   * (containing a dot) switch the current type; other segments step through members.
   */
  const followPath = (
    startType: string,
    path: string,
  ): Property | NavigationProperty | undefined => {
    let current = startType;
    let member: Property | NavigationProperty | undefined;
    for (const segment of path.split('/')) {
      if (segment.includes('.')) {
        current = qualifyName(segment);
        member = undefined;
        continue;
      }
      member = findMember(current, segment);
      if (!member) return undefined;
      current = member.type.name;
    }
    return member;
  };

  // --- Partners --------------------------------------------------------------------------------
  for (const type of all) {
    for (const nav of type.navigationProperties) {
      if (!nav.partner) continue;
      const target = nav.type.name;
      if (!structure.types.has(target)) continue; // external or unresolved: reported elsewhere
      const partner = followPath(target, nav.partner);
      if (partner?.kind === 'navigationProperty') {
        structure.partners.set(nav.id, partner.id);
      } else {
        report(
          nav,
          'unresolved-partner',
          `The partner ${nav.partner} is not a navigation property of ${target}.`,
        );
      }
    }
  }
  // A partner declared on one side only still pairs both.
  for (const [a, b] of [...structure.partners])
    if (!structure.partners.has(b)) structure.partners.set(b, a);

  // --- Exposure and bindings -------------------------------------------------------------------
  const expose = (typeId: string): Exposure => {
    let e = structure.exposure.get(typeId);
    if (!e) structure.exposure.set(typeId, (e = { entitySets: [], singletons: [] }));
    return e;
  };

  for (const schema of model.schemas) {
    for (const container of schema.entityContainers) {
      const resolveTarget = (target: string): string | undefined => {
        const slash = target.indexOf('/');
        const direct = elements.get(
          slash < 0
            ? childId(container.id, target)
            : `${qualifyName(target.slice(0, slash))}${target.slice(slash)}`,
        );
        return direct?.kind === 'entitySet' || direct?.kind === 'singleton' ? direct.id : undefined;
      };

      const holders = [...container.entitySets, ...container.singletons];
      for (const holder of holders) {
        const typeName = holder.kind === 'entitySet' ? holder.entityType.name : holder.type.name;
        const exposure = expose(typeName);
        (holder.kind === 'entitySet' ? exposure.entitySets : exposure.singletons).push(holder.id);

        structure.bindings.set(
          holder.id,
          holder.bindings.map((b) => {
            const resolved: ResolvedBinding = { path: b.path, target: b.target };
            const nav = followPath(typeName, b.path);
            if (nav?.kind === 'navigationProperty') resolved.navigationId = nav.id;
            else if (structure.types.has(typeName)) {
              report(
                holder,
                'unresolved-binding',
                `The binding path ${b.path} is not a navigation property of ${typeName}.`,
              );
            }
            const targetId = resolveTarget(b.target);
            if (targetId) resolved.targetId = targetId;
            else
              report(
                holder,
                'unresolved-binding',
                `The binding target ${b.target} is not an entity set or singleton.`,
              );
            return resolved;
          }),
        );
      }
    }
  }
  return structure;
}
