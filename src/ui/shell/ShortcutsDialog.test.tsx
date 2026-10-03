import { render, screen } from '@testing-library/react';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { describe, expect, it } from 'vitest';
import { SHORTCUTS } from '../../app/shortcuts.ts';
import { ShortcutsDialog } from './ShortcutsDialog.tsx';

describe('ShortcutsDialog', () => {
  it('lists every shortcut when open, and nothing when closed', () => {
    const { rerender } = render(
      <FluentProvider theme={webLightTheme}>
        <ShortcutsDialog open={false} onOpenChange={() => {}} />
      </FluentProvider>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    rerender(
      <FluentProvider theme={webLightTheme}>
        <ShortcutsDialog open onOpenChange={() => {}} />
      </FluentProvider>,
    );
    expect(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeInTheDocument();
    for (const { items } of SHORTCUTS) {
      for (const [keys, action] of items) {
        // Some keys, such as Enter, appear under several areas.
        expect(screen.getAllByText(keys).length).toBeGreaterThan(0);
        expect(screen.getByText(action)).toBeInTheDocument();
      }
    }
  });
});
