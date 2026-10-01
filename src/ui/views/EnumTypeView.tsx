import { Body1 } from '@fluentui/react-components';
import { descriptionOf, labelOf, longDescriptionOf } from '../../csdl/humanize.ts';
import type { EnumMember, EnumType } from '../../csdl/model.ts';
import { DataTable, type Column } from './DataTable.tsx';
import type { ViewProps } from './types.ts';
import { Facts, Section, ViewHeader } from './ViewParts.tsx';

export function EnumTypeView({ element, tabId, mode }: ViewProps<EnumType>) {
  const rows = element.members;
  const friendly = mode === 'friendly';
  const columns: Column<EnumMember>[] = friendly
    ? [
        {
          key: 'name',
          header: 'Name',
          width: 'minmax(10rem, 1fr)',
          cell: (r) => labelOf(r),
        },
        { key: 'value', header: 'Value', width: '6rem', cell: (r) => r.value ?? '' },
        {
          key: 'description',
          header: 'Description',
          width: 'minmax(14rem, 2fr)',
          cell: (r) => descriptionOf(r) ?? '',
        },
      ]
    : [
        { key: 'name', header: 'Name', width: 'minmax(10rem, 1fr)', cell: (r) => r.name },
        { key: 'value', header: 'Value', width: '6rem', cell: (r) => r.value ?? '' },
        { key: 'id', header: 'ID', width: 'minmax(14rem, 2fr)', cell: (r) => r.id },
      ];

  return (
    <>
      <ViewHeader
        kind="Enum type"
        title={friendly ? labelOf(element) : element.name}
        id={element.id}
        tabId={tabId}
        mode={mode}
        description={descriptionOf(element)}
        longDescription={longDescriptionOf(element)}
        badges={element.isFlags ? ['IsFlags'] : []}
      />
      <Section title="About">
        {friendly ? (
          <Body1>
            {element.isFlags
              ? 'A choice of one or more of these values at once.'
              : 'A choice of exactly one of these values.'}
          </Body1>
        ) : (
          <Facts
            rows={[
              ['UnderlyingType', element.underlyingType],
              ['IsFlags', element.isFlags ? 'true' : 'false'],
            ]}
          />
        )}
      </Section>
      <Section title={`Members (${rows.length})`}>
        <DataTable
          label="Members"
          columns={columns}
          rows={rows}
          rowId={(r) => r.id}
          emptyText="This enum has no members."
        />
      </Section>
    </>
  );
}
