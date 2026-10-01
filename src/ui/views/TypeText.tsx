import type { DetailMode } from '../../app/store.ts';
import { friendlyType, technicalType } from '../../csdl/humanize.ts';
import type { Facets, TypeRef } from '../../csdl/model.ts';
import type { Resolved } from '../../csdl/resolve.ts';
import { ElementLink } from './ElementLink.tsx';

interface TypeTextProps {
  resolved: Resolved;
  type: TypeRef;
  facets?: Facets;
  mode: DetailMode;
}

/** A type in the words of the mode; a link to the type when the model defines it. */
export function TypeText({ resolved, type, facets, mode }: TypeTextProps) {
  const text =
    mode === 'friendly'
      ? friendlyType(type, facets, (name) => resolved.elements.get(name)?.kind)
      : technicalType(type);
  return (
    <ElementLink resolved={resolved} id={type.name}>
      {text}
    </ElementLink>
  );
}
