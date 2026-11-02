// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { PlanPartBlock } from '.';
import type { PlanPartRow } from '../planPartRows';

afterEach(cleanup);

const rowOf = (touches: ReadonlyArray<string>): PlanPartRow => ({
  index: 0,
  clusterId: null,
  after: [],
  title: 'Add the retry guard',
  instructions: 'Guard the retry path in notify-relay.',
  doneWhen: [],
  touches,
  node: { state: 'queued', label: 'Queued' },
  agentId: null,
  model: null,
  effort: null,
});

describe('PlanPartBlock', () => {
  it('says a part lists no files instead of claiming it touches every file', () => {
    render(
      <PlanPartBlock row={rowOf([])}>
        <span>Part</span>
      </PlanPartBlock>,
    );

    screen.getByText('Lists no files');
    expect(screen.queryByText('Touches every file')).toBeNull();
  });

  it('lists the files a part touches', () => {
    render(
      <PlanPartBlock row={rowOf(['src/retry.ts'])}>
        <span>Part</span>
      </PlanPartBlock>,
    );

    screen.getByText('src/retry.ts');
  });
});
