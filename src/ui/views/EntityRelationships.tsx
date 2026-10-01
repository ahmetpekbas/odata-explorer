import { useMemo } from 'react';
import {
  descriptionOf,
  friendlyLink,
  labelOf,
  shortName,
  technicalType,
} from '../../csdl/humanize.ts';
import type { NavigationProperty, StructuredType } from '../../csdl/model.ts';
import type { Resolved } from '../../csdl/resolve.ts';
import { DataTable, type Column } from './DataTable.tsx';
import { ElementLink } from './ElementLink.tsx';
import { declaredOn, yesNo } from './members.ts';
import type { ViewProps } from './types.ts';
import { Chips, Facts, Section } from './ViewParts.tsx';

/** A row of links to elements, or undefined when there are none. */
function links(resolved: Resolved, ids: string[], label: (id: string) => string) {
  return ids.length === 0 ? undefined : (
    <Chips>
      {ids.map((id) => (
        <ElementLink key={id} resolved={resolved} id={id}>
          {label(id)}
        </ElementLink>
      ))}
    </Chips>
  );
}

/** The partner as `Type/Property`, the way a reader would look for it. */
const partnerName = (id: string | undefined) => (id ? id.slice(id.lastIndexOf('.') + 1) : '');

/** "Links to", the type hierarchy, and "Exposed as" of a structured type. */
export function EntityRelationships({ resolved, element, mode }: ViewProps<StructuredType>) {
  const info = resolved.types.get(element.id);
  const technical = mode === 'technical';

  const navigations = useMemo(
    () =>
      (info?.navigationPropertyIds ?? []).flatMap((id) => {
        const nav = resolved.elements.get(id);
        return nav?.kind === 'navigationProperty' ? [nav] : [];
      }),
    [info, resolved],
  );
  const hasInherited = navigations.some((n) => declaredOn(n.id, element.id) !== '');

  const target = (nav: NavigationProperty) => (
    <ElementLink resolved={resolved} id={nav.type.name}>
      {technical ? technicalType(nav.type) : friendlyLink(nav.type)}
    </ElementLink>
  );
  const owner: Column<NavigationProperty>[] = hasInherited
    ? [
        {
          key: 'owner',
          header: 'Declared on',
          width: '10rem',
          cell: (nav) => declaredOn(nav.id, element.id),
        },
      ]
    : [];
  const columns: Column<NavigationProperty>[] = technical
    ? [
        { key: 'name', header: 'Name', width: 'minmax(10rem, 1fr)', cell: (n) => n.name },
        { key: 'type', header: 'Type', width: 'minmax(14rem, 2fr)', cell: target },
        { key: 'nullable', header: 'Nullable', width: '5rem', cell: (n) => yesNo(n.nullable) },
        {
          key: 'containment',
          header: 'ContainsTarget',
          width: '7rem',
          cell: (n) => yesNo(n.containsTarget),
        },
        {
          key: 'partner',
          header: 'Partner',
          width: '10rem',
          cell: (n) => n.partner ?? partnerName(resolved.partners.get(n.id)),
        },
        {
          key: 'constraints',
          header: 'Referential constraints',
          width: 'minmax(12rem, 1fr)',
          cell: (n) =>
            n.referentialConstraints
              .map((c) => `${c.property} → ${c.referencedProperty}`)
              .join(', '),
        },
        { key: 'onDelete', header: 'OnDelete', width: '6rem', cell: (n) => n.onDelete ?? '' },
        ...owner,
      ]
    : [
        { key: 'name', header: 'Name', width: 'minmax(10rem, 1fr)', cell: (n) => labelOf(n) },
        {
          key: 'target',
          header: 'Leads to',
          width: 'minmax(14rem, 1fr)',
          cell: (n) => (
            <>
              {target(n)}
              {n.containsTarget && ' · contained'}
            </>
          ),
        },
        {
          key: 'description',
          header: 'Description',
          width: 'minmax(14rem, 2fr)',
          cell: (n) => descriptionOf(n) ?? '',
        },
        ...owner,
      ];

  const hasHierarchy = Boolean(element.baseType) || (info?.derived.length ?? 0) > 0;
  const exposure = resolved.exposure.get(element.id);
  const nameOf = (id: string) => resolved.elements.get(id)?.name ?? shortName(id);

  return (
    <>
      {navigations.length > 0 && (
        <Section title={`Links to (${navigations.length})`}>
          <DataTable
            label="Navigation properties"
            columns={columns}
            rows={navigations}
            rowId={(n) => n.id}
          />
        </Section>
      )}
      {hasHierarchy && (
        <Section title="Type hierarchy">
          <Facts
            rows={[
              [
                'Inherits from',
                element.baseType
                  ? links(
                      resolved,
                      info?.baseChain.length ? info.baseChain : [element.baseType.name],
                      shortName,
                    )
                  : undefined,
              ],
              ['Derived types', links(resolved, info?.derived ?? [], shortName)],
              [
                'All derived types',
                technical && (info?.descendants.length ?? 0) > (info?.derived.length ?? 0)
                  ? links(resolved, info?.descendants ?? [], shortName)
                  : undefined,
              ],
            ]}
          />
        </Section>
      )}
      {element.kind === 'entityType' && exposure && (
        <Section title="Exposed as">
          <Facts
            rows={[
              ['Entity sets', links(resolved, exposure.entitySets, nameOf)],
              ['Singletons', links(resolved, exposure.singletons, nameOf)],
            ]}
          />
        </Section>
      )}
    </>
  );
}
