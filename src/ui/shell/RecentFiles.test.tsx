import 'fake-indexeddb/auto';
import { fireEvent, render, screen } from '@testing-library/react';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearRecent, saveRecent } from '../../app/persistence.ts';
import { formatBytes } from './format-bytes.ts';
import { RecentFiles } from './RecentFiles.tsx';

function renderList(onOpen = vi.fn()) {
  render(
    <FluentProvider theme={webLightTheme}>
      <RecentFiles onOpen={onOpen} />
    </FluentProvider>,
  );
  return onOpen;
}

beforeEach(() => clearRecent());

describe('RecentFiles', () => {
  it('says where files are stored and that there are none yet', async () => {
    renderList();
    expect(screen.getByText('Stored only in this browser.')).toBeInTheDocument();
    expect(await screen.findByText('No recent files yet.')).toBeInTheDocument();
  });

  it('lists, opens, forgets, and clears', async () => {
    await saveRecent({ id: 'a', name: 'a.xml', format: 'xml' }, '<a/>', 1);
    await saveRecent({ id: 'b', name: 'b.json', format: 'json' }, '{}', 2);
    const onOpen = renderList();

    fireEvent.click(await screen.findByRole('button', { name: 'Open b.json' }));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'b' }));

    fireEvent.click(screen.getByRole('button', { name: 'Forget b.json' }));
    await vi.waitFor(() => expect(screen.queryByText('b.json')).not.toBeInTheDocument());
    expect(screen.getByText('a.xml')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(await screen.findByText('No recent files yet.')).toBeInTheDocument();
  });

  it('picks up files saved while it is shown', async () => {
    renderList();
    await screen.findByText('No recent files yet.');
    await saveRecent({ id: 'a', name: 'late.xml', format: 'xml' }, '<a/>', 1);
    expect(await screen.findByText('late.xml')).toBeInTheDocument();
  });
});

describe('formatBytes', () => {
  it('picks a unit', () => {
    expect(formatBytes(12)).toBe('12 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.0 MB');
  });
});
