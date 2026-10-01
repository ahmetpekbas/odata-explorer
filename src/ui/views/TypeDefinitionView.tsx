import { Body1 } from '@fluentui/react-components';
import {
  descriptionOf,
  facetEntries,
  friendlyType,
  labelOf,
  longDescriptionOf,
} from '../../csdl/humanize.ts';
import { typeRef } from '../../csdl/ids.ts';
import type { TypeDefinition } from '../../csdl/model.ts';
import type { ViewProps } from './types.ts';
import { Facts, Section, ViewHeader } from './ViewParts.tsx';

export function TypeDefinitionView({ resolved, element, tabId, mode }: ViewProps<TypeDefinition>) {
  const friendly = mode === 'friendly';
  const underlying = typeRef(element.underlyingType);
  return (
    <>
      <ViewHeader
        kind="Type definition"
        title={friendly ? labelOf(element) : element.name}
        id={element.id}
        tabId={tabId}
        mode={mode}
        description={descriptionOf(element)}
        longDescription={longDescriptionOf(element)}
      />
      <Section title="Based on">
        {friendly ? (
          <Body1>
            {friendlyType(underlying, element.facets, (name) => resolved.elements.get(name)?.kind)}
          </Body1>
        ) : (
          <Facts
            rows={[
              ['UnderlyingType', element.underlyingType],
              ...facetEntries(element.facets).map(([label, value]): [string, string] => [
                label,
                value,
              ]),
            ]}
          />
        )}
      </Section>
    </>
  );
}
