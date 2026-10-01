import { Body1 } from '@fluentui/react-components';
import {
  countSchema,
  referencedNamespaces,
  summarizeReferences,
  type NamespaceStatus,
  type ReferencedNamespace,
} from '../../app/summary.ts';
import { descriptionOf, longDescriptionOf } from '../../csdl/humanize.ts';
import type { Schema } from '../../csdl/model.ts';
import { DataTable, type Column } from './DataTable.tsx';
import { ElementLink } from './ElementLink.tsx';
import type { ViewProps } from './types.ts';
import { Facts, Section, ViewHeader } from './ViewParts.tsx';

const STATUS: Record<NamespaceStatus, { friendly: string; technical: string }> = {
  defined: { friendly: 'Defined in this document', technical: 'defined' },
  bundled: { friendly: 'Built-in vocabulary', technical: 'bundled' },
  missing: { friendly: 'Not available', technical: 'unresolved' },
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The overview of a schema: what it defines and how much of what it refers to can be found. */
export function SchemaView({ resolved, element, tabId, mode }: ViewProps<Schema>) {
  const friendly = mode === 'friendly';
  const counts = countSchema(element);
  const references = summarizeReferences(resolved, element);
  const namespaces = referencedNamespaces(resolved);
  const unresolved = references.unresolved.length;

  const rows: [string, number][] = [
    ['Entity types', counts.entityTypes],
    ['Complex types', counts.complexTypes],
    ['Enum types', counts.enumTypes],
    ['Type definitions', counts.typeDefinitions],
    ['Terms', counts.terms],
    ['Actions', counts.actions],
    ['Functions', counts.functions],
    ['Entity sets', counts.entitySets],
    ['Singletons', counts.singletons],
    ['Action imports', counts.actionImports],
    ['Function imports', counts.functionImports],
  ];
  const uriColumn: Column<ReferencedNamespace> = {
    key: 'uri',
    header: 'Uri',
    width: 'minmax(16rem, 3fr)',
    cell: (r) => r.uri,
  };
  const columns: Column<ReferencedNamespace>[] = [
    {
      key: 'namespace',
      header: 'Namespace',
      width: 'minmax(14rem, 2fr)',
      cell: (r) => (r.alias ? `${r.namespace} (${r.alias})` : r.namespace),
    },
    {
      key: 'status',
      header: 'Status',
      width: '12rem',
      cell: (r) => STATUS[r.status][friendly ? 'friendly' : 'technical'],
    },
    ...(friendly ? [] : [uriColumn]),
  ];

  return (
    <>
      <ViewHeader
        kind="Schema"
        title={element.namespace}
        id={tabId}
        tabId={tabId}
        mode={mode}
        description={descriptionOf(element)}
        longDescription={longDescriptionOf(element)}
        badges={element.alias ? [`alias ${element.alias}`] : []}
      />
      <Section title="What it defines">
        <Facts
          rows={[
            ['Namespace', friendly ? undefined : element.namespace],
            ['Alias', friendly ? undefined : element.alias],
            ...rows
              .filter(([, n]) => n > 0)
              .map(([label, n]): [string, string] => [label, String(n)]),
            [
              'Overloads',
              friendly || counts.overloads === counts.actions + counts.functions
                ? undefined
                : String(counts.overloads),
            ],
          ]}
        />
        {rows.every(([, n]) => n === 0) && <Body1>This schema is empty.</Body1>}
      </Section>
      <Section title="Type references">
        <Body1>
          {references.total === 0
            ? 'This schema does not refer to any types.'
            : unresolved === 0
              ? `All ${plural(references.total, 'reference', 'references')} resolve.`
              : `${references.total - unresolved} of ${plural(references.total, 'reference', 'references')} resolve; ${unresolved} could not be found.`}
        </Body1>
        {unresolved > 0 && (
          <ul>
            {references.unresolved.map((d, i) => (
              <li key={i}>
                {d.target ? (
                  <ElementLink resolved={resolved} id={d.target}>
                    {d.message}
                  </ElementLink>
                ) : (
                  d.message
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
      {namespaces.length > 0 && (
        <Section title="Referenced namespaces">
          <DataTable label="Referenced namespaces" columns={columns} rows={namespaces} />
        </Section>
      )}
    </>
  );
}
