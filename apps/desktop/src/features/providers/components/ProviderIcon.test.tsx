// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ProviderIcon } from './ProviderIcon';

afterEach(cleanup);

describe('ProviderIcon, unknown provider', () => {
  it('falls back to the raw provider name as text', () => {
    render(<ProviderIcon provider="opencode" />);
    expect(screen.getByText('opencode')).toBeDefined();
  });

  it('renders no brand mark alongside the fallback text', () => {
    const { container } = render(<ProviderIcon provider="opencode" />);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('renders nothing at all in the glyph variant', () => {
    const { container } = render(<ProviderIcon provider="opencode" variant="glyph" />);
    expect(container.innerHTML).toBe('');
  });
});

describe('ProviderIcon, known provider', () => {
  it('labels the anthropic mark claude', () => {
    render(<ProviderIcon provider="anthropic" />);
    expect(screen.getByLabelText('claude')).toBeDefined();
  });
});
