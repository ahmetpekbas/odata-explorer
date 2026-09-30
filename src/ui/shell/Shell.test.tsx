import { render, screen } from '@testing-library/react';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { describe, expect, it } from 'vitest';
import { Shell } from './Shell.tsx';

describe('Shell', () => {
  it('renders the three panes and an inspector toggle', () => {
    render(
      <FluentProvider theme={webLightTheme}>
        <Shell navigator="nav content" workspace="work content" inspector="inspect content" />
      </FluentProvider>,
    );
    expect(screen.getByRole('navigation', { name: 'Navigator' })).toHaveTextContent('nav content');
    expect(screen.getByRole('main')).toHaveTextContent('work content');
    expect(screen.getByRole('complementary', { name: 'Inspector' })).toHaveTextContent(
      'inspect content',
    );
    expect(screen.getByRole('button', { name: 'Collapse inspector' })).toBeInTheDocument();
  });
});
