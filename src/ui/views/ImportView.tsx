import { descriptionOf, labelOf, longDescriptionOf, shortName } from '../../csdl/humanize.ts';
import { childId } from '../../csdl/ids.ts';
import type { ActionImport, FunctionImport } from '../../csdl/model.ts';
import { ElementLink } from './ElementLink.tsx';
import { ownerOf } from './members.ts';
import type { ViewProps } from './types.ts';
import { Facts, Section, ViewHeader } from './ViewParts.tsx';

/** An action or function import: the operation it exposes and the entity set it works on. */
export function ImportView({
  resolved,
  element,
  tabId,
  mode,
}: ViewProps<ActionImport | FunctionImport>) {
  const friendly = mode === 'friendly';
  const isAction = element.kind === 'actionImport';
  const operation = isAction ? element.action : element.function;
  // The entity set is a name in the same container, or a path to a set in another one.
  const setId = element.entitySet?.includes('/')
    ? element.entitySet
    : element.entitySet && childId(ownerOf(element.id), element.entitySet);
  return (
    <>
      <ViewHeader
        kind={isAction ? 'Action import' : 'Function import'}
        title={friendly ? labelOf(element) : element.name}
        id={element.id}
        tabId={tabId}
        mode={mode}
        description={descriptionOf(element)}
        longDescription={longDescriptionOf(element)}
        badges={!isAction && !element.includeInServiceDocument ? ['not in service document'] : []}
      />
      <Section title="Exposes">
        <Facts
          rows={[
            [
              isAction ? 'Action' : 'Function',
              <ElementLink key="operation" resolved={resolved} id={operation}>
                {friendly ? shortName(operation) : operation}
              </ElementLink>,
            ],
            [
              friendly ? 'Works on' : 'EntitySet',
              setId && (
                <ElementLink key="set" resolved={resolved} id={setId}>
                  {friendly ? shortName(element.entitySet ?? '') : element.entitySet}
                </ElementLink>
              ),
            ],
            [
              'IncludeInServiceDocument',
              friendly || isAction ? undefined : String(element.includeInServiceDocument),
            ],
          ]}
        />
      </Section>
    </>
  );
}
