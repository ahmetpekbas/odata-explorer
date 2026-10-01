import { useMemo } from 'react';
import { Body1, Caption1 } from '@fluentui/react-components';
import { KeyRegular } from '@fluentui/react-icons';
import { descriptionOf, hasLabel, labelOf, longDescriptionOf } from '../../csdl/humanize.ts';
import type { Property, StructuredType } from '../../csdl/model.ts';
import { DataTable, type Column } from './DataTable.tsx';
import { Facts, Section, ViewHeader } from './ViewParts.tsx';
import { TypeText } from './TypeText.tsx';
import { declaredOn, ownerOf, yesNo } from './members.ts';
import { EntityRelationships } from './EntityRelationships.tsx';
import type { ViewProps } from './types.ts';

interface PropertyRow {
  property: Property;
  /** ID of the type that declares the property. */
  owner: string;
  isKey: boolean;
}

/** An entity type or a complex type: header, key (entities), properties, links and hierarchy. */
export function StructuredTypeView(props: ViewProps<StructuredType>) {
  const { resolved, element, tabId, mode } = props;
  const info = resolved.types.get(element.id);

  const rows = useMemo<PropertyRow[]>(() => {
    const keyNames = new Set(info?.key.map((k) => k.name));
    return (info?.propertyIds ?? []).flatMap((id) => {
      const property = resolved.elements.get(id);
      return property?.kind === 'property'
        ? [{ property, owner: ownerOf(id), isKey: keyNames.has(property.name) }]
        : [];
    });
  }, [info, resolved]);

  const isEntity = element.kind === 'entityType';
  const hasInherited = rows.some((r) => r.owner !== element.id);
  const type = (row: PropertyRow) => (
    <TypeText
      resolved={resolved}
      type={row.property.type}
      facets={row.property.facets}
      mode={mode}
    />
  );
  const name = (row: PropertyRow) => (
    <>
      {row.isKey && <KeyRegular aria-label="Key" />}{' '}
      {mode === 'friendly' ? labelOf(row.property) : row.property.name}
    </>
  );
  const declaredOnColumn: Column<PropertyRow>[] = hasInherited
    ? [
        {
          key: 'owner',
          header: 'Declared on',
          width: '10rem',
          cell: (row) => declaredOn(row.property.id, element.id),
        },
      ]
    : [];
  const columns: Column<PropertyRow>[] =
    mode === 'friendly'
      ? [
          { key: 'name', header: 'Name', width: 'minmax(10rem, 1fr)', cell: name },
          { key: 'type', header: 'Type', width: 'minmax(10rem, 1fr)', cell: type },
          {
            key: 'required',
            header: 'Required',
            width: '6rem',
            cell: (row) => (!row.property.nullable || row.isKey ? 'Required' : ''),
          },
          {
            key: 'description',
            header: 'Description',
            width: 'minmax(14rem, 2fr)',
            cell: (row) => descriptionOf(row.property) ?? '',
          },
          ...declaredOnColumn,
        ]
      : [
          { key: 'name', header: 'Name', width: 'minmax(10rem, 1fr)', cell: name },
          { key: 'type', header: 'Type', width: 'minmax(14rem, 2fr)', cell: type },
          {
            key: 'nullable',
            header: 'Nullable',
            width: '5rem',
            cell: (row) => yesNo(row.property.nullable),
          },
          {
            key: 'maxLength',
            header: 'MaxLength',
            width: '6rem',
            cell: (row) => row.property.facets.maxLength ?? '',
          },
          {
            key: 'precision',
            header: 'Precision',
            width: '5rem',
            cell: (row) => row.property.facets.precision ?? '',
          },
          {
            key: 'scale',
            header: 'Scale',
            width: '5rem',
            cell: (row) => row.property.facets.scale ?? '',
          },
          {
            key: 'srid',
            header: 'SRID',
            width: '5rem',
            cell: (row) => row.property.facets.srid ?? '',
          },
          {
            key: 'unicode',
            header: 'Unicode',
            width: '5rem',
            cell: (row) => yesNo(row.property.facets.unicode),
          },
          {
            key: 'default',
            header: 'DefaultValue',
            width: '8rem',
            cell: (row) => row.property.facets.defaultValue ?? '',
          },
          ...declaredOnColumn,
        ];

  const badges = [
    element.abstract && 'abstract',
    element.openType && 'open type',
    element.hasStream && 'media entity (HasStream)',
  ].filter((b): b is string => b !== false);
  const keyText = (info?.key ?? [])
    .map((k) => (mode === 'technical' && k.alias ? `${k.name} (as ${k.alias})` : k.name))
    .join(', ');

  return (
    <>
      <ViewHeader
        kind={isEntity ? 'Entity type' : 'Complex type'}
        title={mode === 'friendly' ? labelOf(element) : element.name}
        id={element.id}
        tabId={tabId}
        mode={mode}
        description={descriptionOf(element)}
        longDescription={longDescriptionOf(element)}
        badges={badges}
      />
      {mode === 'technical' && hasLabel(element) && (
        <Caption1 block>Label: {labelOf(element)}</Caption1>
      )}
      {isEntity && (
        <Section title={mode === 'friendly' ? 'Identified by' : 'Key'}>
          {keyText === '' ? (
            <Body1>This type has no key.</Body1>
          ) : (
            <Facts
              rows={[
                [mode === 'friendly' ? 'Properties' : 'PropertyRef', keyText],
                [
                  'Declared on',
                  mode === 'technical' && info?.keyOwner && info.keyOwner !== element.id
                    ? info.keyOwner
                    : undefined,
                ],
              ]}
            />
          )}
        </Section>
      )}
      <Section title={`Properties (${rows.length})`}>
        <DataTable
          label="Properties"
          columns={columns}
          rows={rows}
          rowId={(row) => row.property.id}
          emptyText="This type has no properties."
        />
      </Section>
      <EntityRelationships {...props} />
    </>
  );
}
