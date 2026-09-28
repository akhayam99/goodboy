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

const renderRow = (release: ReleaseEntry) =>
  render(
    <ReleaseRow release={release} isActive={false} installedVersion={null} onSelect={vi.fn()} />,
  );

describe('ReleaseRow', () => {
  it('never renders a date', () => {
    renderRow(buildRelease({ version: '0.12.0', oneWayFrom: '0.11' }));

    expect(screen.queryByText(/2026|ago|yesterday|today/i)).toBeNull();
  });

  it('has no one-way mark on a patch release, even with one-way metadata', () => {
    renderRow(buildRelease({ version: '0.12.1', oneWayFrom: '0.11' }));

    expect(screen.queryByRole('img')).toBeNull();
  });

  it('has no one-way mark on a release without one-way metadata', () => {
    renderRow(buildRelease({ version: '0.12.0', oneWayFrom: null }));

    expect(screen.queryByRole('img')).toBeNull();
  });

  it('marks a minor one-way release with the door glyph', () => {
    renderRow(buildRelease({ version: '0.12.0', oneWayFrom: '0.11' }));

    const mark = screen.getByRole('img');
    expect(mark.getAttribute('aria-label')).toMatch(/changes your data/i);
  });

  it('marks a major one-way release with a distinct glyph', () => {
    renderRow(buildRelease({ version: '1.0.0', oneWayFrom: '0.12' }));

    const mark = screen.getByRole('img');
    expect(mark.getAttribute('aria-label')).toMatch(/major release/i);
  });

  it('keeps the installed chip', () => {
    render(
      <ReleaseRow
        release={buildRelease({ version: '0.12.0' })}
        isActive={false}
        installedVersion="0.12.0"
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText('installed')).toBeDefined();
  });
});
