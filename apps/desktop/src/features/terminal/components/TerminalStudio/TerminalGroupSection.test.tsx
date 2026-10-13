// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { TerminalGroupSection } from './TerminalGroupSection';
import type { TerminalGroup } from './terminalGroups';

afterEach(cleanup);

const TITLE = 'Round settlement totals to minor units in ledger-core';

const GROUP: TerminalGroup = {
  key: 'session-1',
  kind: 'session',
  sessionId: null,
  title: TITLE,
  branch: null,
  tabs: [],
};

describe('a terminal group section', () => {
  it('names its disclosure button with the full title', () => {
    render(
      <TerminalGroupSection group={GROUP} isOpen={false} onToggle={vi.fn()}>
        {null}
      </TerminalGroupSection>,
    );
    expect(screen.getByRole('button', { name: new RegExp(TITLE) })).toBeDefined();
    expect(screen.getByRole('region', { name: TITLE })).toBeDefined();
  });
});
