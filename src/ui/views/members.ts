import { shortName } from '../../csdl/humanize.ts';

/** ID of the type that declares a property or navigation property. */
export const ownerOf = (memberId: string) => memberId.slice(0, memberId.lastIndexOf('/'));

/** The "Declared on" cell: the short name of the declaring type, empty for the type's own members. */
export const declaredOn = (memberId: string, typeId: string) => {
  const owner = ownerOf(memberId);
  return owner === typeId ? '' : shortName(owner);
};

/** Whether any of the texts contains the filter, ignoring case. An empty filter matches everything. */
export const matchesFilter = (filter: string, ...texts: (string | undefined)[]) => {
  const needle = filter.trim().toLowerCase();
  return needle === '' || texts.some((t) => t?.toLowerCase().includes(needle));
};

export const yesNo = (value: boolean | undefined) =>
  value === undefined ? '' : value ? 'Yes' : 'No';
