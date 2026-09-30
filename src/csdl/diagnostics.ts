// Helpers for the diagnostics sink: positions in the source text.
import type { Diagnostic } from './model.ts';

/** Offsets at which each line starts. */
export function lineStarts(text: string): number[] {
  const starts = [0];
  for (let i = text.indexOf('\n'); i >= 0; i = text.indexOf('\n', i + 1)) starts.push(i + 1);
  return starts;
}

/** 1-based line and column of an offset. */
export function positionAt(
  starts: readonly number[],
  offset: number,
): { line: number; column: number } {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if ((starts[mid] ?? 0) <= offset) lo = mid;
    else hi = mid - 1;
  }
  return { line: lo + 1, column: offset - (starts[lo] ?? 0) + 1 };
}

/** Fills in line and column on diagnostics that only carry a span. */
export function locateDiagnostics(diagnostics: Diagnostic[], text: string): void {
  let starts: number[] | undefined;
  for (const d of diagnostics) {
    if (d.line !== undefined || !d.span) continue;
    starts ??= lineStarts(text);
    Object.assign(d, positionAt(starts, d.span.start));
  }
}
