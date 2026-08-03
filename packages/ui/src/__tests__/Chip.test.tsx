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
});
