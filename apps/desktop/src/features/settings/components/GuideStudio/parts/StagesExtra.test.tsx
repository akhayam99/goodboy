// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { BOARD_STAGES } from '../../../../workspace/components/StageBoard/boardStages';
import { ARCHIVED_LANE, SESSION_STAGE_META } from '../../../../session/session-stage';
import { StagesExtra } from './StagesExtra';

afterEach(cleanup);

const termsOf = (): ReadonlyArray<string> =>
  screen
    .getAllByRole('listitem')
    .map((item) => item.children[1]?.firstElementChild?.textContent ?? '');

describe('StagesExtra', () => {
  it('lists every board lane in the board order, Archived last', () => {
    render(<StagesExtra />);

    expect(termsOf()).toEqual([
      ...BOARD_STAGES.map((stage) => SESSION_STAGE_META[stage].label),
      ARCHIVED_LANE.label,
    ]);
    expect(termsOf()).toEqual([
      'building',
      'running',
      'needs you',
      'in review',
      'done',
      'archived',
    ]);
  });

  it('says what each lane holds, Archived in the words the board uses', () => {
    render(<StagesExtra />);

    expect(screen.getByText('Put away, still here if you need it back.')).toBeDefined();
    expect(screen.getByText('Nothing left to do here.')).toBeDefined();
  });
});
