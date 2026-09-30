import type { Diagnostic } from '../../csdl/model.ts';

/** Where a diagnostic is: a line and column when it has them, otherwise its target element. */
export function locationOf(d: Diagnostic): string {
  if (d.line !== undefined) return `${d.line}:${d.column ?? 1}`;
  return d.target ?? '';
}
