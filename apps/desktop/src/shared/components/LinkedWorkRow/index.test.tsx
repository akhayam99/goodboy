// @vitest-environment happy-dom

import { GitBranch } from 'lucide-react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { LinkedWorkRow } from './index';

afterEach(cleanup);

describe('LinkedWorkRow, icon leading', () => {
  it('renders identifier, title, and a tinted provider icon', () => {
    render(
      <LinkedWorkRow
        leading={{ kind: 'icon', icon: GitBranch, tone: 'info', label: 'GitHub' }}
        identifier="#9"
        title="Second issue"
        onClick={vi.fn()}
      />,
    );
    expect(screen.getByText('#9')).toBeDefined();
    expect(screen.getByText('Second issue')).toBeDefined();
    expect(screen.getByRole('img', { name: 'GitHub' })).toBeDefined();
  });

  it('invokes onClick when the row button is clicked', () => {
    const onClick = vi.fn();
    render(
      <LinkedWorkRow
        leading={{ kind: 'icon', icon: GitBranch, tone: 'info', label: 'GitHub' }}
        identifier="#9"
        title="Second issue"
        onClick={onClick}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /#9 Second issue/i }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe('LinkedWorkRow, glyph leading', () => {
  it('renders the integration glyph instead of a bespoke icon', () => {
    render(
      <LinkedWorkRow
        leading={{ kind: 'glyph', provider: 'linear' }}
        identifier="GB-123"
        title="Improve preview metadata"
        onClick={vi.fn()}
      />,
    );
    expect(screen.getByRole('img', { name: 'Linear' })).toBeDefined();
    expect(screen.getByText('GB-123')).toBeDefined();
  });
});

describe('LinkedWorkRow, actions slot', () => {
  it('renders actions outside the clickable button, never nested inside it', () => {
    render(
      <LinkedWorkRow
        leading={{ kind: 'glyph', provider: 'linear' }}
        identifier="GB-123"
        title="Improve preview metadata"
        onClick={vi.fn()}
        actions={<button type="button">Copy link</button>}
      />,
    );
    const copyButton = screen.getByRole('button', { name: 'Copy link' });
    const rowButton = screen.getByRole('button', { name: /GB-123 Improve preview metadata/i });
    expect(rowButton.contains(copyButton)).toBe(false);
  });

  it('omits the title span when no title is given', () => {
    render(
      <LinkedWorkRow
        leading={{ kind: 'glyph', provider: 'linear' }}
        identifier="GB-123"
        onClick={vi.fn()}
      />,
    );
    expect(screen.getByText('GB-123')).toBeDefined();
    expect(screen.queryByText('Improve preview metadata')).toBeNull();
  });
});
