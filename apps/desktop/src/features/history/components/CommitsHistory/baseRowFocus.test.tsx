// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { brandId, type SessionId } from '@goodboy/types';
import { HISTORY_FOCUS_BASE_EVENT, diffEventName } from '../../../actions/kinds/diff';
import { HistoryBaseRow } from './HistoryBaseRow';

afterEach(cleanup);

const LEDGER = brandId<SessionId>({ value: 'session-ledger-core' });
const NOTIFY = brandId<SessionId>({ value: 'session-notify-relay' });

type PaneProps = {
  readonly sessionId: SessionId;
  readonly label: string;
};

const Pane = ({ sessionId, label }: PaneProps) => (
  <div data-branch-pane="">
    <button type="button" data-base-rebase="">
      {label}
    </button>
    <HistoryBaseRow
      sessionId={sessionId}
      graph={null}
      baseBranch="main"
      baseSha="9d4b1f7"
      forkAge="2 days ago"
      isDone={false}
    />
  </div>
);

describe('HistoryBaseRow', () => {
  it('focuses the Rebase of its own page when another page is kept alive before it', () => {
    Element.prototype.scrollIntoView = vi.fn();
    render(
      <>
        <Pane sessionId={NOTIFY} label="Rebase notify-relay" />
        <Pane sessionId={LEDGER} label="Rebase ledger-core" />
      </>,
    );

    act(() => {
      window.dispatchEvent(
        new CustomEvent(diffEventName({ name: HISTORY_FOCUS_BASE_EVENT, sessionId: LEDGER })),
      );
    });

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Rebase ledger-core' }));
  });
});
