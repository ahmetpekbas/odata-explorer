import {
  descriptionOf,
  facetEntries,
  friendlyAppliesTo,
  labelOf,
  longDescriptionOf,
} from '../../csdl/humanize.ts';
import type { Term } from '../../csdl/model.ts';
import { ElementLink } from './ElementLink.tsx';
import { yesNo } from './members.ts';
import { TypeText } from './TypeText.tsx';
import type { ViewProps } from './types.ts';
import { Facts, Section, ViewHeader } from './ViewParts.tsx';

export function TermView({ resolved, element, tabId, mode }: ViewProps<Term>) {
  const friendly = mode === 'friendly';
  const { defaultValue, ...otherFacets } = element.facets;
  return (
    <>
      <ViewHeader
        kind="Term"
        title={friendly ? labelOf(element) : element.name}
        id={element.id}
        tabId={tabId}
        mode={mode}
        description={descriptionOf(element)}
        longDescription={longDescriptionOf(element)}
      />
      <Section title="Definition">
        <Facts
          rows={[
            [
              'Type',
              <TypeText
                key="type"
                resolved={resolved}
                type={element.type}
                facets={element.facets}
                mode={mode}
              />,
            ],
            [
              'Applies to',
              element.appliesTo.length === 0
                ? friendly
                  ? 'Anything'
                  : undefined
                : (friendly ? element.appliesTo.map(friendlyAppliesTo) : element.appliesTo).join(
                    friendly ? ', ' : ' ',
                  ),
            ],
            ['Default value', defaultValue],
            [
              'Base term',
              element.baseTerm && (
                <ElementLink resolved={resolved} id={element.baseTerm}>
                  {element.baseTerm}
                </ElementLink>
              ),
            ],
            ['Nullable', friendly ? undefined : yesNo(element.nullable)],
            ...(friendly
              ? []
              : facetEntries(otherFacets).map(([label, value]): [string, string] => [
                  label,
                  value,
                ])),
          ]}
        />
      </Section>
    </>
  );
}
