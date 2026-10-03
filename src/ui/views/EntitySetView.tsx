import { diagramTypeFor } from '../../app/diagram-tab.ts';
import { descriptionOf, labelOf, longDescriptionOf, shortName } from '../../csdl/humanize.ts';
import type { EntitySet, Singleton } from '../../csdl/model.ts';
import type { ResolvedBinding } from '../../csdl/resolve-structure.ts';
import { capabilitiesOf } from '../../csdl/term-summaries.ts';
import { CapabilityBadges } from './CapabilityBadges.tsx';
import { DataTable, type Column } from './DataTable.tsx';
import { ElementLink } from './ElementLink.tsx';
import { ownerOf } from './members.ts';
import { ShowRelationships } from './ShowRelationships.tsx';
import { TypeText } from './TypeText.tsx';
import type { ViewProps } from './types.ts';
import { Facts, Section, ViewHeader } from './ViewParts.tsx';

/** `NS.Flight/Airline` as `Flight/Airline`: type-cast segments lose their namespace. */
const friendlyPath = (path: string) =>
  path
    .split('/')
    .map((segment) => (segment.includes('.') ? shortName(segment) : segment))
    .join('/');

/** An entity set or a singleton: its type and where each navigation property leads. */
export function EntitySetView({
  resolved,
  element,
  tabId,
  mode,
}: ViewProps<EntitySet | Singleton>) {
  const friendly = mode === 'friendly';
  const isSet = element.kind === 'entitySet';
  const type = isSet ? element.entityType : element.type;
  const bindings = resolved.bindings.get(element.id) ?? [];
  const diagramType = diagramTypeFor(resolved, element.id);

  const target = (b: ResolvedBinding) =>
    b.targetId ? (
      <ElementLink resolved={resolved} id={b.targetId}>
        {friendly ? (resolved.elements.get(b.targetId)?.name ?? b.target) : b.target}
      </ElementLink>
    ) : (
      b.target
    );
  const columns: Column<ResolvedBinding>[] = friendly
    ? [
        {
          key: 'path',
          header: 'Navigation',
          width: 'minmax(12rem, 1fr)',
          cell: (b) => friendlyPath(b.path),
        },
        { key: 'target', header: 'Leads to', width: 'minmax(12rem, 1fr)', cell: target },
      ]
    : [
        { key: 'path', header: 'Path', width: 'minmax(16rem, 2fr)', cell: (b) => b.path },
        { key: 'target', header: 'Target', width: 'minmax(12rem, 1fr)', cell: target },
        {
          key: 'status',
          header: 'Resolved',
          width: '8rem',
          cell: (b) =>
            b.navigationId && b.targetId ? 'yes' : !b.navigationId ? 'no path' : 'no target',
        },
      ];

  return (
    <>
      <ViewHeader
        kind={isSet ? 'Entity set' : 'Singleton'}
        title={friendly ? labelOf(element) : element.name}
        id={element.id}
        tabId={tabId}
        mode={mode}
        description={descriptionOf(element)}
        longDescription={longDescriptionOf(element)}
        badges={isSet && !element.includeInServiceDocument ? ['not in service document'] : []}
        actions={diagramType && <ShowRelationships typeId={diagramType} />}
      />
      <Section title={isSet ? 'Contains' : 'Is a single'}>
        <Facts
          rows={[
            [
              friendly ? 'Entity type' : 'Type',
              <TypeText key="type" resolved={resolved} type={type} mode={mode} />,
            ],
            [
              'Container',
              friendly ? undefined : (
                <ElementLink resolved={resolved} id={ownerOf(element.id)}>
                  {ownerOf(element.id)}
                </ElementLink>
              ),
            ],
            [
              'IncludeInServiceDocument',
              friendly || !isSet ? undefined : String(element.includeInServiceDocument),
            ],
          ]}
        />
      </Section>
      {capabilitiesOf(element.annotations).length > 0 && (
        <Section title="Capabilities">
          <CapabilityBadges annotations={element.annotations} />
        </Section>
      )}
      <Section title={`Navigation bindings (${bindings.length})`}>
        <DataTable
          label="Navigation bindings"
          columns={columns}
          rows={bindings}
          emptyText="No navigation property is bound."
        />
      </Section>
    </>
  );
}
