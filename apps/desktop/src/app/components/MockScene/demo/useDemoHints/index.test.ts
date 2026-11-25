// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { DEMO_CHAPTERS } from '../demoChapters';
import { DEMO_PROTOCOL } from '../director/demoProtocol';
import type { HintProgress } from '../hints/hintProgressTypes';
import { useDemoHints } from '.';

const guideOf = () => {
  const guide = DEMO_CHAPTERS.find((chapter) =>
    chapter.hints.some((hint) => hint.id === 'plan-comment'),
  );
  if (guide === undefined) {
    throw new Error('no guide chapter');
  }
  return guide;
};

type ReportParams = {
  readonly isRecovering: boolean;
};

describe('the demo hints on a way back', () => {
  it('asks to reopen the plan while the step points at the plan row, then goes back to the step', () => {
    const chapter = guideOf();
    const progress: HintProgress = {
      [chapter.id]: { tried: ['plan-open', 'plan-mark'], epoch: 0 },
    };
    const { result } = renderHook(() =>
      useDemoHints({
        chapter,
        progressControls: {
          progress,
          markTried: () => undefined,
          reset: () => undefined,
          settle: () => undefined,
          resetAll: () => undefined,
        },
      }),
    );
    const report = ({ isRecovering }: ReportParams) => {
      act(() => {
        result.current.onHintReport({
          key: 'guide',
          report: {
            channel: DEMO_PROTOCOL.channel,
            version: DEMO_PROTOCOL.version,
            generation: 0,
            type: 'anchor',
            hintId: 'plan-comment',
            rect: { x: 10, y: 20, width: 40, height: 24 },
            isOffscreen: false,
            isRecovering,
          },
        });
      });
    };
    report({ isRecovering: true });
    expect(result.current.isRecovering).toBe(true);
    expect(result.current.coach).toMatchObject({
      hintId: 'plan-comment',
      copy: 'Reopen the plan',
      side: 'left',
      isSideLocked: true,
    });
    report({ isRecovering: false });
    expect(result.current.isRecovering).toBe(false);
    expect(result.current.coach).toMatchObject({ copy: 'Add the prepared comment' });
  });
});

describe('the demo hints on a step with an offer', () => {
  it('keeps the coach and its button after the visitor pressed the highlighted field', () => {
    const chapter = DEMO_CHAPTERS[0];
    if (chapter === undefined) {
      throw new Error('no first chapter');
    }
    const progress: HintProgress = {};
    const { result } = renderHook(() =>
      useDemoHints({
        chapter,
        progressControls: {
          progress,
          markTried: () => undefined,
          reset: () => undefined,
          settle: () => undefined,
          resetAll: () => undefined,
        },
      }),
    );
    act(() => {
      result.current.onHintReport({
        key: 'bring',
        report: {
          channel: DEMO_PROTOCOL.channel,
          version: DEMO_PROTOCOL.version,
          generation: 0,
          type: 'anchor',
          hintId: 'bring-connect',
          rect: { x: 10, y: 20, width: 40, height: 24 },
          isOffscreen: false,
          isClicked: true,
          isPressed: true,
        },
      });
    });
    expect(result.current.coach?.offer?.label).toBe('Paste example key');
  });
});
