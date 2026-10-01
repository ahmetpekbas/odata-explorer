import type { ReactNode } from 'react';
import { descriptionOf, labelOf, longDescriptionOf, shortName } from '../../csdl/humanize.ts';
import type { EntityContainer } from '../../csdl/model.ts';
import { DataTable, type Column } from './DataTable.tsx';
import { ElementLink } from './ElementLink.tsx';
import { TypeText } from './TypeText.tsx';
import type { ViewProps } from './types.ts';
import { Facts, Section, ViewHeader } from './ViewParts.tsx';

interface Member {
  id: string;
  name: string;
  label: string;
  /** The second column: what the member exposes, in the words of the mode. */
  detail: ReactNode;
}

interface Group {
  title: string;
  /** Headers of the second column in friendly and in technical mode. */
  headers: [friendly: string, technical: string];
  rows: Member[];
}

function groups(
  container: EntityContainer,
  { resolved, mode }: Pick<ViewProps<EntityContainer>, 'resolved' | 'mode'>,
): Group[] {
  const text = (qualified: string) => (mode === 'friendly' ? shortName(qualified) : qualified);
  const row = (
    e: Pick<EntityContainer, 'id' | 'name' | 'annotations'>,
    detail: ReactNode,
  ): Member => ({
    id: e.id,
    name: e.name,
    label: labelOf(e),
    detail,
  });
  const all: Group[] = [
    {
      title: 'Entity sets',
      headers: ['Contains', 'EntityType'],
      rows: container.entitySets.map((e) =>
        row(e, <TypeText resolved={resolved} type={e.entityType} mode={mode} />),
      ),
    },
    {
      title: 'Singletons',
      headers: ['Is a single', 'Type'],
      rows: container.singletons.map((e) =>
        row(e, <TypeText resolved={resolved} type={e.type} mode={mode} />),
      ),
    },
    {
      title: 'Action imports',
      headers: ['Runs', 'Action'],
      rows: container.actionImports.map((e) => row(e, text(e.action))),
    },
    {
      title: 'Function imports',
      headers: ['Runs', 'Function'],
      rows: container.functionImports.map((e) => row(e, text(e.function))),
    },
  ];
  return all.filter((g) => g.rows.length > 0);
}

/** An entity container: what it extends and everything it exposes. */
export function ContainerView(props: ViewProps<EntityContainer>) {
  const { resolved, element, tabId, mode } = props;
  const friendly = mode === 'friendly';
  const lists = groups(element, props);
  return (
    <>
      <ViewHeader
        kind="Entity container"
        title={friendly ? labelOf(element) : element.name}
        id={element.id}
        tabId={tabId}
        mode={mode}
        description={descriptionOf(element)}
        longDescription={longDescriptionOf(element)}
      />
      {element.extends && (
        <Section title="Extends">
          <Facts
            rows={[
              [
                'Container',
                <ElementLink key="extends" resolved={resolved} id={element.extends}>
                  {friendly ? shortName(element.extends) : element.extends}
                </ElementLink>,
              ],
            ]}
          />
        </Section>
      )}
      {lists.length === 0 && <Section title="Contents">Nothing is exposed.</Section>}
      {lists.map(({ title, headers, rows }) => {
        const columns: Column<Member>[] = [
          {
            key: 'name',
            header: 'Name',
            width: 'minmax(12rem, 1fr)',
            cell: (m) => (
              <ElementLink resolved={resolved} id={m.id}>
                {friendly ? m.label : m.name}
              </ElementLink>
            ),
          },
          {
            key: 'detail',
            header: friendly ? headers[0] : headers[1],
            width: 'minmax(14rem, 2fr)',
            cell: (m) => m.detail,
          },
        ];
        return (
          <Section key={title} title={`${title} (${rows.length})`}>
            <DataTable label={title} columns={columns} rows={rows} />
          </Section>
        );
      })}
    </>
  );
}
