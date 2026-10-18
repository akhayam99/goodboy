// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReleaseEntry } from '../../parseChangelog';
import { ReleaseRow } from './ReleaseRow';

const buildRelease = (
  overrides: Partial<ReleaseEntry> & { readonly version: string },
): ReleaseEntry => ({
  version: overrides.version,
  shape: overrides.shape ?? 'v2',
  lead: overrides.lead ?? 'Opening line.',
  oneWayFrom: overrides.oneWayFrom ?? null,
  sections: overrides.sections ?? { new: [], improved: [], fixed: [] },
  markdown: overrides.markdown ?? null,
  publishedAt: overrides.publishedAt ?? null,
});

afterEach(() => {
  cleanup();
});

type RenderRowParams = {
  readonly release: ReleaseEntry;
  readonly dateLabel?: string | null;
  readonly installedVersion?: string | null;
};

const renderRow = ({ release, dateLabel = null, installedVersion = null }: RenderRowParams) =>
  render(
    <ReleaseRow
      release={release}
      dateLabel={dateLabel}
      isActive={false}
      installedVersion={installedVersion}
      onSelect={vi.fn()}
    />,
  );

describe('ReleaseRow', () => {
  it('puts the version and its date on one line', () => {
    renderRow({ release: buildRelease({ version: '0.27.2' }), dateLabel: '17 Oct' });

    expect(screen.getByText('0.27.2').nextElementSibling?.textContent).toBe('17 Oct');
  });

  it('shows no date line text when the date is unknown', () => {
    renderRow({ release: buildRelease({ version: '0.27.2' }) });

    expect(screen.getByText('0.27.2').nextElementSibling?.textContent).toBe('');
  });

  it('has no one-way mark on a patch release, even with one-way metadata', () => {
    renderRow({ release: buildRelease({ version: '0.12.1', oneWayFrom: '0.11' }) });

    expect(screen.queryByRole('img')).toBeNull();
  });

  it('has no one-way mark on a release without one-way metadata', () => {
    renderRow({ release: buildRelease({ version: '0.12.0', oneWayFrom: null }) });

    expect(screen.queryByRole('img')).toBeNull();
  });

  it('marks a minor one-way release with the door glyph', () => {
    renderRow({ release: buildRelease({ version: '0.12.0', oneWayFrom: '0.11' }) });

    const mark = screen.getByRole('img');
    expect(mark.getAttribute('aria-label')).toMatch(/changes your data/i);
  });

  it('marks a major one-way release with a distinct glyph', () => {
    renderRow({ release: buildRelease({ version: '1.0.0', oneWayFrom: '0.12' }) });

    const mark = screen.getByRole('img');
    expect(mark.getAttribute('aria-label')).toMatch(/major release/i);
  });

  it('writes Installed in the meta, after the date, with no chip', () => {
    renderRow({
      release: buildRelease({ version: '0.12.0' }),
      dateLabel: '5 Oct',
      installedVersion: '0.12.0',
    });

    expect(screen.getByText('5 Oct · Installed')).toBeDefined();
  });

  it('writes In the update for a release newer than the installed one', () => {
    renderRow({
      release: buildRelease({ version: '0.12.1' }),
      dateLabel: null,
      installedVersion: '0.12.0',
    });

    expect(screen.getByText('In the update')).toBeDefined();
  });
});
