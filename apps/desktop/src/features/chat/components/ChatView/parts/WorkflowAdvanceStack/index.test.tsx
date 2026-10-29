// @vitest-environment happy-dom

vi.mock('../../../../../workflows/StepEndedNotice', () => ({
  StepEndedNotice: ({ agentId }: { readonly agentId: string }) => (
    <div data-testid="step-ended-notice">{agentId}</div>
  ),
}));
vi.mock('../WorkflowAdvanceRow', () => ({
  WorkflowAdvanceRow: () => <div data-testid="workflow-advance-cta" />,
}));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { brandId, type AgentId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../../store/storyHarness';
import { WorkflowAdvanceStack } from './index';

const SESSION = aSession();
const AGENT_ID = brandId<AgentId>({ value: 'agent-scout-acme' });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

describe('WorkflowAdvanceStack', () => {
  it('puts the ended-step notice for the open agent above the next-step call to action', () => {
    useAppStore.setState({ selectedAgentId: { [SESSION.id]: AGENT_ID } });
    render(<WorkflowAdvanceStack session={SESSION} />);

    const notice = screen.getByTestId('step-ended-notice');
    const cta = screen.getByTestId('workflow-advance-cta');
    expect(notice.textContent).toBe(AGENT_ID);
    expect(notice.compareDocumentPosition(cta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows only the call to action when no agent is open', () => {
    useAppStore.setState({ selectedAgentId: {} });
    render(<WorkflowAdvanceStack session={SESSION} />);

    expect(screen.queryByTestId('step-ended-notice')).toBeNull();
    screen.getByTestId('workflow-advance-cta');
  });
});
