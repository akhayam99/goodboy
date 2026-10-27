// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import type { IsoDateTime, ProviderRunId } from '@goodboy/types';
import { AnnouncementRegion } from '../../../../../app/components/AnnouncementRegion';
import { useAnnouncementStore } from '../../../../../shared/lib/announcer';
import type { TranscriptItem } from '../../../utils/transcript-items';
import { turnEndAnnouncement } from './turnEndAnnouncement';
import { useTurnEndAnnouncement } from './index';

const RUN: ProviderRunId = JSON.parse('"run-1"');
const AT: IsoDateTime = JSON.parse('"2026-09-14T15:08:00.000Z"');

const tool = ({
  id,
  toolName,
  isError = false,
}: {
  readonly id: string;
  readonly toolName: string;
  readonly isError?: boolean;
}): TranscriptItem => ({
  kind: 'tool_call',
  key: `tool-${id}`,
  toolUseId: id,
  toolName,
  input: {},
  output: null,
  isError,
  ended: true,
  runId: RUN,
  startedAt: AT,
  endedAt: AT,
});

const SUMMARY_ROW = {
  kind: 'summary',
  key: 'summary-1',
  steps: [tool({ id: '1', toolName: 'Bash' }), tool({ id: '2', toolName: 'Bash' })],
};

const FAILED_ROW = {
  kind: 'summary',
  key: 'summary-2',
  steps: [tool({ id: '3', toolName: 'Bash', isError: true })],
};

type ProbeProps = {
  readonly isTurnLive: boolean;
  readonly rows: ReadonlyArray<{ readonly kind: string }>;
};

const Probe = ({ isTurnLive, rows }: ProbeProps) => {
  useTurnEndAnnouncement({ isTurnLive, rows });
  return null;
};

const sentence = (): string => screen.getByRole('status').textContent ?? '';

beforeEach(() => {
  useAnnouncementStore.setState({ message: '', sequence: 0 });
});

afterEach(cleanup);

describe('turnEndAnnouncement', () => {
  it('turns the last finished turn into one sentence', () => {
    expect(turnEndAnnouncement({ rows: [{ kind: 'user' }, SUMMARY_ROW] })).toBe(
      'Turn finished: Ran 2 commands',
    );
  });

  it('counts the errors in the sentence', () => {
    expect(turnEndAnnouncement({ rows: [FAILED_ROW] })).toBe(
      'Turn finished: Ran a command, 1 error',
    );
  });

  it('falls back to the bare sentence when the turn used no tool', () => {
    expect(turnEndAnnouncement({ rows: [{ kind: 'assistant_text' }] })).toBe('Turn finished');
  });
});

describe('the finished turn in the shared polite region', () => {
  it('says nothing on first render, nothing while the turn runs, and one sentence when it ends', () => {
    const { rerender } = render(
      <>
        <AnnouncementRegion />
        <Probe isTurnLive rows={[]} />
      </>,
    );
    expect(sentence()).toBe('');

    rerender(
      <>
        <AnnouncementRegion />
        <Probe isTurnLive rows={[SUMMARY_ROW]} />
      </>,
    );
    expect(sentence()).toBe('');

    act(() => {
      rerender(
        <>
          <AnnouncementRegion />
          <Probe isTurnLive={false} rows={[SUMMARY_ROW]} />
        </>,
      );
    });

    expect(sentence()).toBe('Turn finished: Ran 2 commands');
    expect(useAnnouncementStore.getState().sequence).toBe(1);
  });

  it('stays quiet when a finished transcript is simply opened', () => {
    render(
      <>
        <AnnouncementRegion />
        <Probe isTurnLive={false} rows={[SUMMARY_ROW]} />
      </>,
    );

    expect(sentence()).toBe('');
    expect(useAnnouncementStore.getState().sequence).toBe(0);
  });

  it('is a polite, atomic status region and the only one for the whole app', () => {
    render(<AnnouncementRegion />);

    const region = screen.getByRole('status');
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.getAttribute('aria-atomic')).toBe('true');
  });
});
