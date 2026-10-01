import { shortName } from '../../csdl/humanize.ts';

/** ID of the type that declares a property or navigation property. */
export const ownerOf = (memberId: string) => memberId.slice(0, memberId.lastIndexOf('/'));

/** The "Declared on" cell: the short name of the declaring type, empty for the type's own members. */
export const declaredOn = (memberId: string, typeId: string) => {
  const owner = ownerOf(memberId);
  return owner === typeId ? '' : shortName(owner);
};

export const yesNo = (value: boolean | undefined) =>
  value === undefined ? '' : value ? 'Yes' : 'No';
