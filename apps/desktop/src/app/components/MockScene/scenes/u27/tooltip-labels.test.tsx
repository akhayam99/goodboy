// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { shortcutGlyphs } from '../../../../../shared/keyboard/registry';
import { MOCK_SCENES } from '../..';
import { U27_TOOLTIP_LABELS_SCENES } from './tooltip-labels';

afterEach(cleanup);

describe('tooltip labels scene', () => {
  it('registers the scene for the capture', () => {
    expect(Object.keys(U27_TOOLTIP_LABELS_SCENES)).toEqual(['tooltip-labels']);
    expect(MOCK_SCENES['tooltip-labels']).toBe(U27_TOOLTIP_LABELS_SCENES['tooltip-labels']);
  });

  it('opens every label on the floating surface at once', () => {
    const Scene = U27_TOOLTIP_LABELS_SCENES['tooltip-labels'];
    render(<Scene />);

    const tips = screen.getAllByRole('tooltip');
    expect(tips).toHaveLength(4);
    const searchId = screen
      .getByRole('button', { name: 'Search Harborline' })
      .getAttribute('aria-describedby');
    const search = tips.find((tip) => tip.id === searchId);
    expect(search?.textContent).toContain('Search');
    expect(search?.querySelector('kbd')?.textContent).toBe(shortcutGlyphs('ask.open'));
  });

  it('describes the time from its own tooltip', () => {
    const Scene = U27_TOOLTIP_LABELS_SCENES['tooltip-labels'];
    render(<Scene />);

    expect(screen.getByText('3 min').getAttribute('aria-describedby')).toBe(
      screen.getByText('Last run finished at 14:02, 3 minutes ago').id,
    );
  });
});
