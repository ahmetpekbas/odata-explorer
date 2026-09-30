import { fireEvent, render, screen } from '@testing-library/react';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { describe, expect, it, vi } from 'vitest';
import trippin from '../../../fixtures/trippin.xml?raw';
import { load } from '../../worker/load.ts';
import type { AppDocument } from '../../app/store.ts';
import { StartPage } from './StartPage.tsx';

function renderPage(document: AppDocument | undefined, onOpen = vi.fn()) {
  render(
    <FluentProvider theme={webLightTheme}>
      <StartPage document={document} onOpen={onOpen} />
    </FluentProvider>,
  );
  return onOpen;
}

const base = { id: 'a', name: 'trippin.xml', size: 1 };

describe('StartPage', () => {
  it('opens a dropped file', () => {
    const onOpen = renderPage(undefined);
    const file = new File(['<a/>'], 'a.xml');
    fireEvent.drop(screen.getByTestId('drop-zone'), { dataTransfer: { files: [file] } });
    expect(onOpen).toHaveBeenCalledWith(file);
  });

  it('opens a file chosen with the picker', () => {
    const onOpen = renderPage(undefined);
    const file = new File(['<a/>'], 'a.xml');
    fireEvent.change(screen.getByLabelText('Choose a metadata file'), {
      target: { files: [file] },
    });
    expect(onOpen).toHaveBeenCalledWith(file);
  });

  it('shows progress while loading', () => {
    renderPage({
      ...base,
      status: 'loading',
      progress: { stage: 'parsing', done: 1, total: 2 },
    });
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0.5');
  });

  it('shows the reason a load failed', () => {
    renderPage({ ...base, status: 'error', error: 'OData v2 is not supported' });
    expect(screen.getByText('OData v2 is not supported')).toBeInTheDocument();
  });

  it('shows type and set counts when ready', () => {
    const result = load(trippin);
    if (!result.ok) throw new Error(result.error);
    renderPage({ ...base, status: 'ready', resolved: result.resolved, text: trippin });
    expect(screen.getByText(/\d+ entity types/)).toBeInTheDocument();
    expect(screen.getByText(/\d+ entity sets/)).toBeInTheDocument();
  });
});
