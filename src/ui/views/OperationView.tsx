import { Body1 } from '@fluentui/react-components';
import { importsOf, overloadsOf } from '../../app/operations.ts';
import {
  descriptionOf,
  facetEntries,
  longDescriptionOf,
  technicalType,
} from '../../csdl/humanize.ts';
import type { Operation, Parameter } from '../../csdl/model.ts';
import type { Resolved } from '../../csdl/resolve.ts';
import { DataTable, type Column } from './DataTable.tsx';
import { ElementLink } from './ElementLink.tsx';
import { yesNo } from './members.ts';
import { TypeText } from './TypeText.tsx';
import type { ViewProps } from './types.ts';
import { Chips, Facts, Section, ViewHeader } from './ViewParts.tsx';

interface ParameterRow {
  parameter: Parameter;
  isBinding: boolean;
}

/** `GetFriendsTrips(userName)`: the name with its parameters, leaving out the binding parameter. */
function friendlySignature(op: Operation): string {
  const names = op.parameters.filter((_, i) => !(op.isBound && i === 0)).map((p) => p.name);
  return `${op.name}(${names.join(', ')})`;
}

/** `NS.GetFriendsTrips(NS.Person, Edm.String): Collection(NS.Trip)`. */
function technicalSignature(op: Operation): string {
  const params = op.parameters.map((p) => `${p.name}: ${technicalType(p.type)}`).join(', ');
  return `${op.name}(${params})${op.returnType ? `: ${technicalType(op.returnType.type)}` : ''}`;
}

function Overload({
  resolved,
  op,
  mode,
}: {
  resolved: Resolved;
  op: Operation;
  mode: ViewProps<Operation>['mode'];
}) {
  const friendly = mode === 'friendly';
  const rows: ParameterRow[] = op.parameters.map((parameter, i) => ({
    parameter,
    isBinding: op.isBound && i === 0,
  }));
  const binding = rows.find((r) => r.isBinding)?.parameter;
  const columns: Column<ParameterRow>[] = friendly
    ? [
        {
          key: 'name',
          header: 'Name',
          width: 'minmax(10rem, 1fr)',
          cell: (r) => `${r.parameter.name}${r.isBinding ? ' (the element it runs on)' : ''}`,
        },
        {
          key: 'type',
          header: 'Type',
          width: 'minmax(12rem, 1fr)',
          cell: (r) => (
            <TypeText
              resolved={resolved}
              type={r.parameter.type}
              facets={r.parameter.facets}
              mode={mode}
            />
          ),
        },
        {
          key: 'required',
          header: 'Required',
          width: '6rem',
          cell: (r) => (r.parameter.nullable ? '' : 'Required'),
        },
        {
          key: 'description',
          header: 'Description',
          width: 'minmax(14rem, 2fr)',
          cell: (r) => descriptionOf(r.parameter) ?? '',
        },
      ]
    : [
        {
          key: 'name',
          header: 'Name',
          width: 'minmax(10rem, 1fr)',
          cell: (r) => `${r.parameter.name}${r.isBinding ? ' (binding)' : ''}`,
        },
        {
          key: 'type',
          header: 'Type',
          width: 'minmax(14rem, 2fr)',
          cell: (r) => (
            <TypeText
              resolved={resolved}
              type={r.parameter.type}
              facets={r.parameter.facets}
              mode={mode}
            />
          ),
        },
        {
          key: 'nullable',
          header: 'Nullable',
          width: '5rem',
          cell: (r) => yesNo(r.parameter.nullable),
        },
        {
          key: 'facets',
          header: 'Facets',
          width: 'minmax(8rem, 1fr)',
          cell: (r) =>
            facetEntries(r.parameter.facets)
              .map(([label, value]) => `${label}=${value}`)
              .join(', '),
        },
      ];

  const returnType = op.returnType;
  return (
    <Section title={friendly ? friendlySignature(op) : technicalSignature(op)}>
      <Facts
        rows={[
          [
            friendly ? 'Available on' : 'Binding parameter',
            binding ? (
              <TypeText key="binding" resolved={resolved} type={binding.type} mode={mode} />
            ) : friendly ? (
              'The service itself'
            ) : undefined,
          ],
          [
            friendly ? 'Returns' : 'ReturnType',
            returnType ? (
              <TypeText
                key="return"
                resolved={resolved}
                type={returnType.type}
                facets={returnType.facets}
                mode={mode}
              />
            ) : friendly ? (
              'Nothing'
            ) : undefined,
          ],
          [
            'Can be chained',
            friendly && op.kind === 'function' ? yesNo(op.isComposable) : undefined,
          ],
          ['IsBound', friendly ? undefined : String(op.isBound)],
          ['IsComposable', friendly || op.kind === 'action' ? undefined : String(op.isComposable)],
          ['EntitySetPath', friendly ? undefined : op.entitySetPath],
          ['Nullable return', friendly || !returnType ? undefined : yesNo(returnType.nullable)],
          ['Overload ID', friendly ? undefined : op.id],
        ]}
      />
      {rows.length === 0 ? (
        <Body1>No parameters.</Body1>
      ) : (
        <DataTable label={`Parameters of ${op.name}`} columns={columns} rows={rows} />
      )}
    </Section>
  );
}

/** An action or function: every overload with its parameters, return type and imports. */
export function OperationView({ resolved, element, tabId, mode }: ViewProps<Operation>) {
  const overloads = overloadsOf(resolved, tabId);
  const imports = importsOf(resolved, element.kind, tabId);
  const kind = element.kind === 'action' ? 'Action' : 'Function';
  const badges = [
    overloads.some((o) => o.isBound) ? 'bound' : 'unbound',
    ...(element.kind === 'function' && overloads.some((o) => o.isComposable) ? ['composable'] : []),
  ];
  return (
    <>
      <ViewHeader
        kind={kind}
        title={element.name}
        id={tabId}
        tabId={tabId}
        mode={mode}
        description={descriptionOf(element)}
        longDescription={longDescriptionOf(element)}
        badges={badges}
      />
      {overloads.map((op) => (
        <Overload key={op.id} resolved={resolved} op={op} mode={mode} />
      ))}
      <Section title="Imports">
        {imports.length === 0 ? (
          <Body1>Not exposed by any {kind.toLowerCase()} import.</Body1>
        ) : (
          <Chips>
            {imports.map((i) => (
              <ElementLink key={i.id} resolved={resolved} id={i.id}>
                {i.name}
              </ElementLink>
            ))}
          </Chips>
        )}
      </Section>
    </>
  );
}
