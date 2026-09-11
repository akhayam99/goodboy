// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { RESOLVE_QUEUE_NEXT_STEP, RESOLVE_QUEUE_STATUS_LABEL } from '../../resolveQueueCopy';
import { ResolveStatusBadge, resolveStatusAccessibleName } from './index';
import { BADGE_ICON_BY_STATUS, BADGE_TONE_BY_STATUS } from './statusTone';

afterEach(cleanup);

describe('the resolve status badge', () => {
  it('separates a local fix from a published one instead of one needs-you bucket', () => {
    const local = RESOLVE_QUEUE_STATUS_LABEL.fix_ready;
    const approved = RESOLVE_QUEUE_STATUS_LABEL.ready_to_push;

    expect(new Set([local, approved, RESOLVE_QUEUE_STATUS_LABEL.pushed]).size).toBe(3);
    expect(local).not.toBe(RESOLVE_QUEUE_STATUS_LABEL.reply_ready);
    expect(RESOLVE_QUEUE_STATUS_LABEL.run_failed).not.toBe(RESOLVE_QUEUE_STATUS_LABEL.run_stopped);
  });

  it('never lets a fix that is still on your machine read as closed on the provider', () => {
    expect(RESOLVE_QUEUE_NEXT_STEP.fix_ready).toContain('publish');
    expect(RESOLVE_QUEUE_NEXT_STEP.ready_to_push).toContain('Publish');
    expect(resolveStatusAccessibleName({ status: 'fix_ready' })).toBe(
      `${RESOLVE_QUEUE_STATUS_LABEL.fix_ready}. ${RESOLVE_QUEUE_NEXT_STEP.fix_ready ?? ''}`,
    );
  });

  it('carries the label and its own icon, never the tone alone', () => {
    render(<ResolveStatusBadge status="run_stopped" />);

    const badge = screen.getByTitle(resolveStatusAccessibleName({ status: 'run_stopped' }));
    expect(badge.textContent).toBe(RESOLVE_QUEUE_STATUS_LABEL.run_stopped);
    expect(badge.querySelector('svg')).not.toBeNull();
  });

  it('hands the next step to assistive technology, not to the tooltip alone', () => {
    render(<ResolveStatusBadge status="fix_ready" />);

    const badge = screen.getByLabelText(resolveStatusAccessibleName({ status: 'fix_ready' }));
    expect(badge.textContent).toBe(RESOLVE_QUEUE_STATUS_LABEL.fix_ready);
  });

  it('drops the next step from a state that asks nothing of you', () => {
    expect(RESOLVE_QUEUE_NEXT_STEP.pushed).toBeNull();
    expect(resolveStatusAccessibleName({ status: 'pushed' })).toBe(
      RESOLVE_QUEUE_STATUS_LABEL.pushed,
    );
  });

  it('gives every state a tone and an icon so none renders blank', () => {
    for (const status of Object.keys(RESOLVE_QUEUE_STATUS_LABEL) as ReadonlyArray<
      keyof typeof RESOLVE_QUEUE_STATUS_LABEL
    >) {
      expect(BADGE_TONE_BY_STATUS[status]).toBeDefined();
      expect(BADGE_ICON_BY_STATUS[status]).toBeDefined();
    }
  });
});
