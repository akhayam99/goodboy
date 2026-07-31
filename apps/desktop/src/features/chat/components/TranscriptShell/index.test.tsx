import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TranscriptShell } from './index';

afterEach(cleanup);

type VariantCase = readonly [
  variant: 'boxed' | 'leftBorder' | 'pill',
  classes: ReadonlyArray<string>,
];

const VARIANT_CASES: ReadonlyArray<VariantCase> = [
  ['boxed', ['rounded-lg', 'border', 'px-3', 'py-2']],
  ['leftBorder', ['rounded-r-md', 'border-l-2', 'py-1', 'pl-2', 'pr-2']],
  ['pill', ['rounded-full', 'border', 'px-2.5', 'py-1']],
];

describe('TranscriptShell', () => {
  it.each(VARIANT_CASES)('applies the %s variant classes', (variant, classes) => {
    render(
      <TranscriptShell tone="info" variant={variant}>
        content
      </TranscriptShell>,
    );
    expect(screen.getByText('content').className.split(' ')).toEqual(
      expect.arrayContaining([...classes]),
    );
  });

  it('uses soft and emphasized boxed backgrounds from the tone', () => {
    const { rerender } = render(
      <TranscriptShell tone="success" variant="boxed">
        content
      </TranscriptShell>,
    );
    expect(screen.getByText('content').className).toContain('border-success/20');
    expect(screen.getByText('content').className).toContain('bg-success/5');
    rerender(
      <TranscriptShell tone="success" variant="boxed" emphasis>
        content
      </TranscriptShell>,
    );
    expect(screen.getByText('content').className).toContain('border-success/40');
    expect(screen.getByText('content').className).toContain('bg-success/10');
  });

  it('keeps a softened rail on nested left borders', () => {
    render(
      <TranscriptShell tone="merged" variant="leftBorder" nested>
        content
      </TranscriptShell>,
    );
    expect(screen.getByText('content').className.split(' ')).toEqual([
      'border-l-2',
      'py-2',
      'pl-2',
      'pr-2',
      'border-merged/20',
    ]);
  });

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
