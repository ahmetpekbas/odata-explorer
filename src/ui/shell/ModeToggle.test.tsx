import { fireEvent, render, screen } from '@testing-library/react';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { describe, expect, it, vi } from 'vitest';
import { ModeToggle } from './ModeToggle.tsx';

describe('ModeToggle', () => {
  it('shows the current mode as pressed and reports a change', () => {
    const onChange = vi.fn();
    render(
      <FluentProvider theme={webLightTheme}>
        <ModeToggle mode="friendly" onChange={onChange} label="Detail" />
      </FluentProvider>,
    );
    expect(screen.getByRole('group', { name: 'Detail' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Friendly' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Technical' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Technical' }));
    expect(onChange).toHaveBeenCalledWith('technical');
  });
});
