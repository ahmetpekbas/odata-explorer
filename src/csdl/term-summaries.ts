// One-sentence summaries of the standard vocabulary terms (Core, Capabilities, Validation, Measures).
// A term without a summarizer falls back to the generic value tree. The vocabularies define defaults
// for what an annotation leaves out (`Insertable` is true unless it says otherwise), so a missing
// property reads as its default here too.
import { annotationText, expressionText } from './annotations.ts';
import type { Annotation, Expression } from './model.ts';

const CORE = 'Org.OData.Core.V1.';
const CAPABILITIES = 'Org.OData.Capabilities.V1.';
const VALIDATION = 'Org.OData.Validation.V1.';
const MEASURES = 'Org.OData.Measures.V1.';

/** The value as a reader would write it: strings without quotes, paths as `{Path}`. */
function plain(expression: Expression): string {
  if (expression.kind === 'constant' && expression.type === 'string') return expression.value;
  if (expression.kind === 'path') {
    return expression.type === 'Path' ? `{${expression.value}}` : expression.value;
  }
  return expressionText(expression);
}

function boolOf(expression: Expression | undefined, fallback: boolean): boolean {
  return expression?.kind === 'constant' && expression.type === 'bool'
    ? expression.value === 'true'
    : fallback;
}

/** A Core.Tag-typed annotation: bare means true. */
function tag(annotation: Annotation): boolean {
  return boolOf(annotation.value, true);
}

function fieldOf(annotation: Annotation, name: string): Expression | undefined {
  const value = annotation.value;
  return value?.kind === 'record'
    ? value.properties.find((p) => p.property === name)?.value
    : undefined;
}

function flag(annotation: Annotation, name: string, fallback: boolean): boolean {
  return boolOf(fieldOf(annotation, name), fallback);
}

/** The items of a collection of paths or strings; empty when the property is absent. */
function listOf(annotation: Annotation, name: string): string[] {
  const value = fieldOf(annotation, name);
  return value?.kind === 'collection' ? value.items.map(plain) : [];
}

interface Restriction {
  /** The Boolean property that switches the capability on or off, and its two phrases. */
  flag: string;
  on: string;
  off: string;
  /** Collections of paths that narrow the capability, as property name and label. */
  lists: [name: string, label: string][];
}

function restriction(annotation: Annotation, r: Restriction): string {
  const base = flag(annotation, r.flag, true) ? r.on : r.off;
  const details = r.lists.flatMap(([name, label]) => {
    const items = listOf(annotation, name);
    return items.length > 0 ? [`${label}: ${items.join(', ')}`] : [];
  });
  return details.length > 0 ? `${base} (${details.join('; ')})` : base;
}

const RESTRICTIONS: Record<string, Restriction> = {
  InsertRestrictions: {
    flag: 'Insertable',
    on: 'Entries can be created',
    off: 'Entries cannot be created',
    lists: [
      ['NonInsertableProperties', 'not insertable'],
      ['NonInsertableNavigationProperties', 'not insertable links'],
      ['RequiredProperties', 'required'],
    ],
  },
  UpdateRestrictions: {
    flag: 'Updatable',
    on: 'Entries can be updated',
    off: 'Entries cannot be updated',
    lists: [
      ['NonUpdatableProperties', 'not updatable'],
      ['NonUpdatableNavigationProperties', 'not updatable links'],
      ['RequiredProperties', 'required'],
    ],
  },
  DeleteRestrictions: {
    flag: 'Deletable',
    on: 'Entries can be deleted',
    off: 'Entries cannot be deleted',
    lists: [['NonDeletableNavigationProperties', 'not deletable links']],
  },
  FilterRestrictions: {
    flag: 'Filterable',
    on: 'Can be filtered',
    off: 'Cannot be filtered',
    lists: [
      ['RequiredProperties', 'filter required on'],
      ['NonFilterableProperties', 'not filterable'],
    ],
  },
  SortRestrictions: {
    flag: 'Sortable',
    on: 'Can be sorted',
    off: 'Cannot be sorted',
    lists: [
      ['AscendingOnlyProperties', 'ascending only'],
      ['DescendingOnlyProperties', 'descending only'],
      ['NonSortableProperties', 'not sortable'],
    ],
  },
  SearchRestrictions: {
    flag: 'Searchable',
    on: 'Can be searched',
    off: 'Cannot be searched',
    lists: [],
  },
  ExpandRestrictions: {
    flag: 'Expandable',
    on: 'Links can be expanded',
    off: 'Links cannot be expanded',
    lists: [['NonExpandableProperties', 'not expandable']],
  },
  CountRestrictions: {
    flag: 'Countable',
    on: 'Can be counted',
    off: 'Cannot be counted',
    lists: [
      ['NonCountableProperties', 'not countable'],
      ['NonCountableNavigationProperties', 'not countable links'],
    ],
  },
};

const NAVIGABILITY: Record<string, string> = {
  Recursive: 'Links can be followed to any depth',
  Single: 'Links can be followed one step',
  None: 'Links cannot be followed',
};

/** The member of an enum value: `Capabilities.NavigationType/Single` and `Single` both give `Single`. */
function memberName(expression: Expression | undefined): string | undefined {
  return expression?.kind === 'constant' ? expression.value.split('/').pop() : undefined;
}

function navigation(annotation: Annotation): string {
  const base =
    NAVIGABILITY[memberName(fieldOf(annotation, 'Navigability')) ?? 'Recursive'] ??
    NAVIGABILITY.Recursive;
  const restricted = fieldOf(annotation, 'RestrictedProperties');
  const names =
    restricted?.kind === 'collection'
      ? restricted.items.flatMap((item) => {
          const path =
            item.kind === 'record' &&
            item.properties.find((p) => p.property === 'NavigationProperty');
          return path ? [plain(path.value)] : [];
        })
      : [];
  return names.length > 0 ? `${base} (restricted: ${names.join(', ')})` : (base ?? '');
}

function permissions(annotation: Annotation): string | undefined {
  const value = annotation.value;
  if (value?.kind !== 'constant') return undefined;
  const members = value.value
    .split(/\s+/)
    .filter((m) => m !== '')
    .map((m) => m.split('/').pop() ?? m);
  if (members.length === 0 || (members.length === 1 && members[0] === 'None')) {
    return 'No permissions';
  }
  return `Permissions: ${members.join(', ')}`;
}

function bound(annotation: Annotation, inclusive: string, exclusive: string): string | undefined {
  if (!annotation.value) return undefined;
  const isExclusive = annotation.annotations.some(
    (a) => a.term === `${VALIDATION}Exclusive` && tag(a),
  );
  return `${isExclusive ? exclusive : inclusive} ${plain(annotation.value)}`;
}

function allowedValues(annotation: Annotation): string | undefined {
  const value = annotation.value;
  if (value?.kind !== 'collection') return undefined;
  const items = value.items.flatMap((item) => {
    const entry = item.kind === 'record' && item.properties.find((p) => p.property === 'Value');
    return entry ? [plain(entry.value)] : [];
  });
  return items.length > 0 ? `One of: ${items.join(', ')}` : undefined;
}

function labeled(label: string, annotation: Annotation): string | undefined {
  return annotation.value ? `${label}: ${plain(annotation.value)}` : undefined;
}

function capability(annotation: Annotation, name: string): string | undefined {
  const known = RESTRICTIONS[name];
  const isRecord = annotation.value?.kind === 'record';
  if (known) return isRecord ? restriction(annotation, known) : undefined;
  switch (name) {
    case 'NavigationRestrictions':
      return isRecord ? navigation(annotation) : undefined;
    case 'TopSupported':
      return tag(annotation) ? '$top is supported' : '$top is not supported';
    case 'SkipSupported':
      return tag(annotation) ? '$skip is supported' : '$skip is not supported';
    default:
      return undefined;
  }
}

/**
 * A short sentence for the annotation, or undefined when its term has no summarizer or its value
 * does not have the shape the term defines (the caller then shows the generic tree).
 */
export function summarizeAnnotation(annotation: Annotation): string | undefined {
  const { term } = annotation;
  if (term.startsWith(CAPABILITIES)) return capability(annotation, term.slice(CAPABILITIES.length));
  switch (term) {
    case `${CORE}Description`:
    case `${CORE}LongDescription`:
      return annotation.value?.kind === 'constant' ? plain(annotation.value) : undefined;
    case `${CORE}Computed`:
      return tag(annotation) ? 'Computed by the service' : 'Not computed by the service';
    case `${CORE}Immutable`:
      return tag(annotation) ? 'Cannot be changed once it is set' : 'Can be changed';
    case `${CORE}Permissions`:
      return permissions(annotation);
    case `${CORE}OptimisticConcurrency`: {
      const value = annotation.value;
      if (value?.kind !== 'collection') return undefined;
      return value.items.length === 0
        ? 'No concurrency properties'
        : `Concurrency token: ${value.items.map(plain).join(', ')}`;
    }
    case `${VALIDATION}AllowedValues`:
      return allowedValues(annotation);
    case `${VALIDATION}Minimum`:
      return bound(annotation, 'At least', 'More than');
    case `${VALIDATION}Maximum`:
      return bound(annotation, 'At most', 'Less than');
    case `${VALIDATION}Pattern`:
      return labeled('Matches', annotation);
    case `${MEASURES}ISOCurrency`:
      return labeled('Currency', annotation);
    case `${MEASURES}Unit`:
      return labeled('Unit', annotation);
    default:
      return undefined;
  }
}

/** The text of an annotation: its summary when the term has one, else the value as an expression. */
export function describeAnnotation(annotation: Annotation): string {
  return summarizeAnnotation(annotation) ?? annotationText(annotation);
}

// ---------------------------------------------------------------------------------------------
// Structured readings for badges and table cells

export interface Capability {
  /** `Insertable`, `Updatable`, ... */
  label: string;
  enabled: boolean;
  /** Whether an annotation of the element states it, rather than the vocabulary default applying. */
  explicit: boolean;
}

/** The restriction terms and the Boolean property of each that switches the capability. */
const CAPABILITY_TERMS = Object.entries(RESTRICTIONS).map(([name, r]) => ({
  term: `${CAPABILITIES}${name}`,
  flag: r.flag,
}));

/**
 * The capabilities an entity set or singleton states, in a fixed order. Empty when it carries no
 * restriction annotation at all: then nothing is known, and the vocabulary defaults say nothing about
 * what the service actually supports. Otherwise every capability is listed, those the annotations
 * leave out with their default (enabled).
 */
export function capabilitiesOf(annotations: readonly Annotation[]): Capability[] {
  const found = CAPABILITY_TERMS.map((c) => ({
    c,
    annotation: annotations.find((a) => a.term === c.term && a.value?.kind === 'record'),
  }));
  if (found.every((f) => !f.annotation)) return [];
  return found.map(({ c, annotation }) => ({
    label: c.flag,
    enabled: annotation ? flag(annotation, c.flag, true) : true,
    explicit: annotation !== undefined,
  }));
}

/** Whether there is anything to show for a property. */
export const hasHints = (h: PropertyHints) => h.computed || h.immutable || h.rules.length > 0;

export interface PropertyHints {
  computed: boolean;
  immutable: boolean;
  /** Validation rules as short sentences: allowed values, bounds, pattern. */
  rules: string[];
}

const RULE_TERMS = ['AllowedValues', 'Minimum', 'Maximum', 'Pattern'].map(
  (name) => `${VALIDATION}${name}`,
);

/** The Core.Computed/Core.Immutable markers and the Validation rules of a property or parameter. */
export function propertyHints(annotations: readonly Annotation[]): PropertyHints {
  const marked = (name: string) => annotations.some((a) => a.term === `${CORE}${name}` && tag(a));
  const rules = annotations
    .filter((a) => RULE_TERMS.includes(a.term))
    .flatMap((a) => summarizeAnnotation(a) ?? []);
  return { computed: marked('Computed'), immutable: marked('Immutable'), rules };
}
