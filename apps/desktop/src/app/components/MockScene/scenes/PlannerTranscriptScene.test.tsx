// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../store/storyHarness';
import { PlannerTranscriptDrawerScene } from './PlannerTranscriptDrawerScene';
import { PlannerTranscriptReplacedScene } from './PlannerTranscriptReplacedScene';
import { PlannerTranscriptRevisingScene } from './PlannerTranscriptRevisingScene';
import { PlannerTranscriptScene } from './PlannerTranscriptScene';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const mount = (Scene: () => React.JSX.Element) =>
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );

const panel = () => screen.getByRole('complementary', { name: 'Side panel' });

describe('planner transcript scenes', () => {
  it('ready: the plan is one row on the column and Run plan is live', async () => {
    mount(() => <PlannerTranscriptScene />);

    const row = await screen.findByTestId('plan-row');
    expect(row.getAttribute('data-span')).toBe('column');
    expect(row.textContent).toContain('Plan · Retry-safe webhook credits');
    expect(row.textContent).toContain('v1');
    expect(screen.getByTestId('plan-primary').hasAttribute('disabled')).toBe(false);
  });

  it('revising: the same row says Revising to v2 and Run plan waits', async () => {
    mount(PlannerTranscriptRevisingScene);

    const row = await screen.findByTestId('plan-row');
    expect(row.getAttribute('data-span')).toBe('column');
    expect(screen.getByTestId('artifact-state-chip').textContent).toContain('Revising to v2');
    expect(screen.getByTestId('plan-primary').getAttribute('title')).toBe(
      'The planner is revising this plan',
    );
  });

  it('replaced: the old block is a slim line and the new one is the row', async () => {
    mount(PlannerTranscriptReplacedScene);

    expect((await screen.findByTestId('plan-block-replaced')).textContent).toBe(
      'Plan v1 · replaced by v2',
    );
    expect(screen.getByTestId('plan-row').textContent).toContain('v2');
    expect(screen.queryByText('Plan not in this session')).toBeNull();
  });

  it('drawer: the plan opens beside the transcript in the reader tier', async () => {
    mount(PlannerTranscriptDrawerScene);

    await screen.findByTestId('plan-drawer');
    expect(panel().getAttribute('data-drawer-sizing')).toBe('reader');
    expect(screen.getByTestId('plan-row').textContent).toContain('Retry-safe webhook credits');
  });
});
