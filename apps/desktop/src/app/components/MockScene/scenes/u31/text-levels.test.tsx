// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { MOCK_SCENES } from '../..';
import { U31_TEXT_LEVELS_SCENES } from './text-levels';
import {
  LEVELS_GROUP,
  LEVELS_HYPHEN,
  LEVELS_PROSE,
  LEVELS_RUNS,
  LEVELS_TITLE,
} from './textLevelsSeed';

afterEach(cleanup);

const mount = () => {
  const Scene = U31_TEXT_LEVELS_SCENES['u31-text-levels'];
  return render(<Scene />);
};

describe('the text levels scene', () => {
  it('registers the scene for the capture', () => {
    expect(Object.keys(U31_TEXT_LEVELS_SCENES)).toEqual(['u31-text-levels']);
    expect(MOCK_SCENES['u31-text-levels']).toBe(U31_TEXT_LEVELS_SCENES['u31-text-levels']);
  });

  it('frames the capture on one 680px element whose padding sits on an inner element', () => {
    const { container } = mount();

    const frames = container.querySelectorAll<HTMLElement>('[data-shot]');
    expect(frames).toHaveLength(1);
    const frame = frames[0];
    expect(frame?.style.width).toBe('680px');
    expect(frame?.style.padding).toBe('');
    expect(frame?.children).toHaveLength(1);
  });

  it('draws every level on a real surface', () => {
    mount();

    screen.getByRole('heading', { level: 1, name: LEVELS_TITLE });
    screen.getByRole('heading', { level: 2, name: LEVELS_GROUP });
    screen.getByText(LEVELS_PROSE);
    for (const run of LEVELS_RUNS) {
      screen.getByText(run.title);
      screen.getByText(run.second);
      screen.getByText(run.state);
    }
    screen.getByText(LEVELS_HYPHEN);
  });

  it('draws a time, a count and a cost for every run', () => {
    const { container } = mount();

    expect(container.querySelectorAll('time')).toHaveLength(LEVELS_RUNS.length);
    for (const text of ['3', '12', '104', '$0.12', '$1.48', '$10.09']) {
      screen.getByText(text);
    }
  });

  it('has no accessibility violations', async () => {
    const { container } = mount();
    const { violations } = await runA11yCheck(container);
    expect(violations.map((violation) => violation.id)).toEqual([]);
  });
});
