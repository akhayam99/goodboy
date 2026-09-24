import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TranscriptShell } from './index';

afterEach(cleanup);

describe('TranscriptShell', () => {
  it('renders children and merges a caller class', () => {
    render(
      <TranscriptShell tone="warning" variant="pill" className="items-center">
        <span>child content</span>
      </TranscriptShell>,
    );
    expect(screen.getByText('child content')).toBeDefined();
    expect(screen.getByText('child content').parentElement?.className).toContain('items-center');
  });

  it('preserves native button behavior for interactive shells', () => {
    const onClick = vi.fn();
    render(
      <TranscriptShell as="button" type="button" tone="primary" variant="pill" onClick={onClick}>
        interactive content
      </TranscriptShell>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'interactive content' }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
