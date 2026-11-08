import { describe, expect, it } from 'vitest';
import { brandId, type ArtifactId, type SessionId } from '@goodboy/types';
import { aStoredPlan } from '../../../test/planFixtures';
import type { TerminalTabId } from '../../../shared/types/terminal';
import { slotChipLabelOf } from './slotChipLabelOf';

const SESSION_ID = brandId<SessionId>({ value: 'session-1' });
const PLAN_ID = brandId<ArtifactId>({ value: 'plan-1' });

describe('the back chip label', () => {
  it('names a plan by its kind and its title', () => {
    const plan = aStoredPlan({ id: PLAN_ID, title: 'Add tax to the checkout total' });

    expect(
      slotChipLabelOf({
        drawer: {
          kind: 'artifact-document',
          sessionId: SESSION_ID,
          payload: { artifactId: PLAN_ID, revision: null },
        },
        artifacts: [plan],
      }),
    ).toEqual({ kind: 'Plan', title: 'Add tax to the checkout total' });
  });

  it('names a tool by its kind alone', () => {
    expect(
      slotChipLabelOf({
        drawer: {
          kind: 'terminal',
          sessionId: SESSION_ID,
          payload: { terminalId: brandId<TerminalTabId>({ value: 'term-1' }) },
        },
        artifacts: [],
      }),
    ).toEqual({ kind: 'Terminal', title: null });
  });

  it('falls back to the drawer word while the artifact is not loaded', () => {
    expect(
      slotChipLabelOf({
        drawer: {
          kind: 'plan-part',
          sessionId: SESSION_ID,
          payload: { planId: PLAN_ID, index: 1 },
        },
        artifacts: [],
      }),
    ).toEqual({ kind: 'Plan', title: null });
  });
});
