import { render } from '@testing-library/react';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import type { ReactElement } from 'react';
import { load } from '../worker/load.ts';
import type { Resolved } from '../csdl/resolve.ts';

/** Parses and resolves a fixture document, failing the test when it does not load. */
export function loadResolved(text: string): Resolved {
  const result = load(text);
  if (!result.ok) throw new Error(result.error);
  return result.resolved;
}

export function renderView(ui: ReactElement) {
  return render(<FluentProvider theme={webLightTheme}>{ui}</FluentProvider>);
}
