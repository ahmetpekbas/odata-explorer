import { fireEvent, render, screen } from '@testing-library/react';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { describe, expect, it, vi } from 'vitest';
import unresolved from '../../../fixtures/unresolved.xml?raw';
import type { Diagnostic } from '../../csdl/model.ts';
import { load } from '../../worker/load.ts';
import { locationOf } from './diagnostic-location.ts';
import { DiagnosticsPanel } from './DiagnosticsPanel.tsx';

function renderPanel(diagnostics: Diagnostic[], onSelect?: (d: Diagnostic) => void) {
  render(
    <FluentProvider theme={webLightTheme}>
      <DiagnosticsPanel diagnostics={diagnostics} onSelect={onSelect} />
    </FluentProvider>,
  );
}

const diagnostic = (over: Partial<Diagnostic>): Diagnostic => ({
  severity: 'warning',
  code: 'c',
  message: 'm',
  ...over,
});

describe('DiagnosticsPanel', () => {
  it('says so when there are no problems', () => {
    renderPanel([]);
    expect(screen.getByText('No problems found.')).toBeInTheDocument();
  });

  it('lists errors before warnings, with severity, message, and location', () => {
    renderPanel([
      diagnostic({ message: 'a warning', target: 'NS.A' }),
      diagnostic({ severity: 'error', message: 'an error', line: 3, column: 7 }),
    ]);
    const rows = screen.getAllByRole('button');
    expect(rows[0]).toHaveTextContent('error');
    expect(rows[0]).toHaveTextContent('an error');
    expect(rows[0]).toHaveTextContent('3:7');
    expect(rows[1]).toHaveTextContent('a warning');
    expect(rows[1]).toHaveTextContent('NS.A');
  });

  it('reports the chosen entry', () => {
    const onSelect = vi.fn();
    const d = diagnostic({ message: 'pick me' });
    renderPanel([d], onSelect);
    fireEvent.click(screen.getByRole('button', { name: /pick me/ }));
    expect(onSelect).toHaveBeenCalledWith(d);
  });

  it('shows the warnings of the unresolved-type fixture', () => {
    const result = load(unresolved);
    if (!result.ok) throw new Error(result.error);
    const { diagnostics } = result.resolved.model;
    renderPanel(diagnostics);
    expect(diagnostics.length).toBeGreaterThan(0);
    expect(screen.getAllByText('unresolved-reference').length).toBeGreaterThan(0);
    expect(screen.getByText(/Broken\.Missing/)).toBeInTheDocument();
  });
});

describe('locationOf', () => {
  it('prefers line and column, then the target', () => {
    expect(locationOf(diagnostic({ line: 2, column: 5, target: 'X' }))).toBe('2:5');
    expect(locationOf(diagnostic({ target: 'X' }))).toBe('X');
    expect(locationOf(diagnostic({}))).toBe('');
  });
});
