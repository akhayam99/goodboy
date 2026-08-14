// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Chip } from '../components/Chip';

afterEach(cleanup);

const classesOf = (label: string): string => screen.getByText(label).className;

describe('Chip', () => {
  it('sizes itself to its label by default', () => {
    render(<Chip tone="neutral" label="CUSTOM" />);

    expect(classesOf('CUSTOM')).not.toContain('min-w-');
  });

  it('holds a column width when asked, so short and long labels align', () => {
    render(
      <>
        <Chip tone="neutral" label="PRESET" width="lg" />
        <Chip tone="accent" label="ORCHESTRATED" width="lg" />
      </>,
    );

    for (const label of ['PRESET', 'ORCHESTRATED']) {
      expect(classesOf(label)).toContain('min-w-32');
      expect(classesOf(label)).toContain('justify-center');
    }
  });

  it('keeps the three widths distinct', () => {
    render(
      <>
        <Chip tone="neutral" label="one" width="sm" />
        <Chip tone="neutral" label="two" width="md" />
      </>,
    );

    expect(classesOf('one')).toContain('min-w-16');
    expect(classesOf('two')).toContain('min-w-24');
  });

  it('offers a smaller step than xs for dense metadata', () => {
    render(
      <>
        <Chip tone="neutral" label="tiny" size="3xs" />
        <Chip tone="neutral" label="small" size="xs" />
      </>,
    );

    expect(classesOf('tiny')).toContain('text-3xs');
    expect(classesOf('small')).toContain('text-2xs');
  });

  it('shouts the label when asked', () => {
    render(
      <>
        <Chip tone="neutral" label="loud" uppercase />
        <Chip tone="neutral" label="quiet" />
      </>,
    );

    expect(classesOf('loud')).toContain('uppercase');
    expect(classesOf('loud')).toContain('tracking-wide');
    expect(classesOf('quiet')).not.toContain('uppercase');
  });

  it('dims the fill at subtle emphasis and keeps the strong ring distinct', () => {
    render(
      <>
        <Chip tone="success" label="subtle" emphasis="subtle" />
        <Chip tone="success" label="soft" />
        <Chip tone="success" label="strong" emphasis="strong" />
      </>,
    );

    expect(classesOf('subtle')).toContain('bg-success/5');
    expect(classesOf('soft')).toContain('bg-success/10');
    expect(classesOf('strong')).toContain('ring-success/40');
  });
});
