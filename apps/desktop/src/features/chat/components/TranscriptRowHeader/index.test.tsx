// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TranscriptRowHeader } from './index';

afterEach(cleanup);

describe('TranscriptRowHeader', () => {
  it('renders a collapsible row on the tone rail', () => {
    const onToggle = vi.fn();
    render(
      <TranscriptRowHeader tone="primary" eyebrow="step" preview="1. plan" onToggle={onToggle} />,
    );
    const row = screen.getByRole('button');
    expect(row.className).toContain('border-l-2');
    expect(row.className).toContain('border-primary/40');
    expect(row.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(row);
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('never paints a background at rest', () => {
    render(<TranscriptRowHeader tone="warning" eyebrow="step" onToggle={() => undefined} />);
    expect(screen.getByRole('button').className).not.toContain('bg-warning');
  });

  it('drops the chevron for non-collapsible rows', () => {
    render(<TranscriptRowHeader tone="operations" eyebrow="skill" data-testid="skill-row" />);
    expect(screen.queryByTestId('transcript-chevron')).toBeNull();
    expect(screen.getByTestId('skill-row').tagName).toBe('DIV');
  });

  it('reads the row as a nested row: eyebrow, step-grade preview, metadata time', () => {
    render(<TranscriptRowHeader tone="primary" eyebrow="tool" preview="read a file" meta="1.2s" />);

    expect(screen.getByText('tool').className).toContain('text-2xs');
    expect(screen.getByText('read a file').className).toContain('text-xs');
    expect(screen.getByText('1.2s').className).toContain('text-3xs');
  });

  it('keeps the time off the grade its own label uses, so the row reads as one column', () => {
    render(<TranscriptRowHeader tone="primary" eyebrow="tool" preview="read a file" meta="1.2s" />);

    expect(screen.getByText('1.2s').className).not.toContain('text-2xs');
  });
});
