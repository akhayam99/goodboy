// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Chip } from '../components/Chip';
import { StateBadge } from '../components/StateBadge';

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
        <Chip tone="primary" label="ORCHESTRATED" width="lg" />
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

  it('maps the old sizes onto the kinds, so a small size is a state pill and a large one a reference badge', () => {
    render(
      <>
        <Chip tone="neutral" label="tiny" size="3xs" />
        <Chip tone="neutral" label="small" size="xs" />
        <Chip tone="neutral" label="medium" size="md" />
      </>,
    );

    expect(classesOf('tiny')).toContain('h-5');
    expect(classesOf('small')).toContain('rounded-full');
    expect(classesOf('medium')).toContain('h-6');
    expect(classesOf('medium')).toContain('rounded-md');
  });

  it('draws each kind at its own height and radius', () => {
    render(
      <>
        <Chip tone="neutral" kind="state" label="state" />
        <Chip tone="neutral" kind="reference" label="reference" />
        <Chip tone="neutral" kind="id" label="id" />
        <Chip tone="neutral" kind="count" label="3" />
      </>,
    );

    expect(classesOf('state').split(' ')).toEqual(
      expect.arrayContaining(['h-5', 'rounded-full', 'text-chip']),
    );
    expect(classesOf('reference').split(' ')).toEqual(
      expect.arrayContaining(['h-6', 'rounded-md', 'text-meta']),
    );
    expect(classesOf('id').split(' ')).toEqual(
      expect.arrayContaining(['h-5', 'rounded-sm', 'font-mono']),
    );
    expect(classesOf('3').split(' ')).toEqual(
      expect.arrayContaining(['h-4', 'min-w-4', 'rounded-full', 'tabular-nums']),
    );
  });

  it('ignores a legacy shape once the kind is named', () => {
    render(<Chip tone="neutral" kind="state" shape="badge" label="state" />);

    expect(classesOf('state')).toContain('rounded-full');
    expect(classesOf('state')).not.toContain('rounded-md');
  });

  it('makes StateBadge the state kind', () => {
    const { container: badge } = render(<StateBadge tone="success">merged</StateBadge>);
    const { container: chip } = render(<Chip kind="state" tone="success" label="merged" />);

    expect(badge.innerHTML).toBe(chip.innerHTML);
  });

  it('never shouts its label', () => {
    render(<Chip tone="neutral" label="quiet" />);

    expect(classesOf('quiet')).not.toContain('uppercase');
  });

  it('keeps every emphasis label exposed', () => {
    render(
      <>
        <Chip tone="success" label="subtle" emphasis="subtle" />
        <Chip tone="success" label="soft" />
        <Chip tone="success" label="strong" emphasis="strong" />
      </>,
    );

    expect(screen.getByText('subtle')).toBeDefined();
    expect(screen.getByText('soft')).toBeDefined();
    expect(screen.getByText('strong')).toBeDefined();
  });

  it('hangs an accessible name on a role screen readers expose', () => {
    render(<Chip tone="success" label="merged" ariaLabel="PR #12 merged, integrated" />);

    expect(screen.getByRole('img', { name: 'PR #12 merged, integrated' })).toBeDefined();
  });

  it('stays a plain decoration when it carries no accessible name', () => {
    render(<Chip tone="neutral" label="plain" />);

    expect(screen.getByText('plain').getAttribute('role')).toBeNull();
  });

  it('frames a control chip at the h-6 control height', () => {
    render(<Chip as="button" tone="neutral" shape="badge" size="control" label="Context" />);

    const chip = screen.getByRole('button', { name: 'Context' });
    expect(chip.className).toContain('h-6');
    expect(chip.className).toContain('rounded-md');
  });

  it('gives a button chip the focus ring and a tone hover instead of fading', () => {
    render(<Chip as="button" tone="neutral" label="Open" onClick={() => undefined} />);

    const chip = screen.getByRole('button', { name: 'Open' });
    expect(chip.className).toContain('focus-visible:ring-2');
    expect(chip.className).toContain('hover:bg-hover');
    expect(chip.className).not.toContain('hover:opacity-80');
  });
});
