// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => Promise.resolve(null)),
}));
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async () => () => undefined),
  emit: vi.fn(async () => undefined),
}));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import {
  AGENT,
  SESSION,
  agentFixture,
  mountFixture,
  seedActionState,
} from '../../../../__tests__/helpers/actionFixtures';
import type { ObjectTarget } from '../../types';
import { ObjectOverflowMenu } from './index';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  seedActionState({
    useAppStore,
    seed: { agents: [agentFixture({ status: 'completed' })], mounts: [mountFixture()] },
  });
});

afterEach(cleanup);

const TARGET: ObjectTarget = { kind: 'agent', sessionId: SESSION, agentId: AGENT };

describe('ObjectOverflowMenu', () => {
  it('draws the ellipsis glyph by default, never the vertical dots', () => {
    render(<ObjectOverflowMenu target={TARGET} label="More actions" />);

    const trigger = screen.getByRole('button', { name: 'More actions' });
    expect(trigger.querySelector('svg.lucide-ellipsis')).not.toBeNull();
    expect(trigger.querySelector('svg.lucide-ellipsis-vertical')).toBeNull();
  });

  it('is a 24px square in a list row and a 28px square in a header', () => {
    const { rerender } = render(<ObjectOverflowMenu target={TARGET} label="More actions" />);
    const row = screen.getByRole('button', { name: 'More actions' });
    expect(row.getAttribute('data-size')).toBe('compact');

    rerender(<ObjectOverflowMenu target={TARGET} label="More actions" size="control" />);
    const header = screen.getByRole('button', { name: 'More actions' });
    expect(header.getAttribute('data-size')).toBe('control');
  });

  it('draws nothing in a header when every action is left out', () => {
    const { container } = render(
      <ObjectOverflowMenu
        target={TARGET}
        label="More actions"
        size="control"
        hideWhenEmpty
        omit={[
          'agent.open',
          'agent.changes',
          'agent.message',
          'agent.interrupt',
          'agent.close',
          'agent.reopen',
          'agent.model',
          'agent.copyReply',
          'agent.copyName',
          'agent.delete',
        ]}
      />,
    );

    expect(container.firstChild).toBeNull();
    expect(screen.queryByRole('button', { name: 'More actions' })).toBeNull();
  });

  it('hands a confirming action to the page instead of confirming inside the menu', () => {
    const onArm = vi.fn();
    render(
      <ObjectOverflowMenu target={TARGET} label="More actions" size="control" onArm={onArm} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Delete agent/ }));

    expect(onArm).toHaveBeenCalledTimes(1);
    expect(onArm.mock.calls[0]?.[0].action.id).toBe('agent.delete');
    expect(screen.queryByRole('group', { name: 'Delete agent?' })).toBeNull();
  });
});
