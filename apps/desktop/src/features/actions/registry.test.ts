import { Copy } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { AGENT_KIND } from './kinds/agent';
import { ARTIFACT_KIND } from './kinds/artifact';
import { LINK_KIND } from './kinds/link';
import { PLAN_PART_KIND } from './kinds/planPart';
import { PULL_REQUEST_KIND } from './kinds/pullRequest';
import { COMMIT_KIND } from './kinds/commit';
import { DIFF_FILE_KIND } from './kinds/diffFile';
import { MOUNT_KIND } from './kinds/mount';
import { SCRIPT_KIND } from './kinds/script';
import { WORKTREE_KIND } from './kinds/worktree';
import { RECORD_KIND } from './kinds/record';
import { SESSION_KIND } from './kinds/session';
import { SESSIONS_KIND } from './kinds/sessions';
import { WORKFLOW_RUN_KIND } from './kinds/workflowRun';
import { resolveActions } from './resolveActions';
import { ACTION_GROUPS, type ActionDefinition } from './types';

type AnyDefinition = ActionDefinition<never>;

const KINDS: ReadonlyArray<readonly [string, ReadonlyArray<AnyDefinition>]> = [
  ['session', SESSION_KIND.actions],
  ['sessions', SESSIONS_KIND.actions],
  ['agent', AGENT_KIND.actions],
  ['workflowRun', WORKFLOW_RUN_KIND.actions],
  ['planPart', PLAN_PART_KIND.actions],
  ['artifact', ARTIFACT_KIND.actions],
  ['record', RECORD_KIND.actions],
  ['pullRequest', PULL_REQUEST_KIND.actions],
  ['commit', COMMIT_KIND.actions],
  ['diffFile', DIFF_FILE_KIND.actions],
  ['mount', MOUNT_KIND.actions],
  ['worktree', WORKTREE_KIND.actions],
  ['script', SCRIPT_KIND.actions],
  ['link', LINK_KIND.actions],
];

describe('action registry', () => {
  it.each(KINDS)('%s: ids are unique and namespaced by the kind', (kind, actions) => {
    const ids = actions.map((action) => action.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter((id) => !id.startsWith(`${kind}.`))).toEqual([]);
  });

  it.each(KINDS)('%s: every danger verb confirms or offers undo', (_kind, actions) => {
    const unguarded = actions
      .filter((action) => action.group === 'danger')
      .filter(
        (action) =>
          action.confirm === undefined &&
          action.isUndoable !== true &&
          action.hasCustomConfirm !== true,
      )
      .map((action) => action.id);
    expect(unguarded).toEqual([]);
  });

  it('resolves in the order Open, Act, Copy, Danger whatever the definition order', () => {
    const make = (id: string, group: (typeof ACTION_GROUPS)[number]): ActionDefinition<null> => ({
      id,
      label: id,
      icon: Copy,
      group,
      when: () => true,
      run: () => undefined,
    });
    const resolved = resolveActions({
      definitions: [make('d', 'danger'), make('c', 'copy'), make('a', 'act'), make('o', 'open')],
      facts: null,
    });
    expect(resolved.map((action) => action.group)).toEqual([...ACTION_GROUPS]);
  });
});
