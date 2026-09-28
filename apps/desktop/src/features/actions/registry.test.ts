import { Copy } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { AGENT_KIND } from './kinds/agent';
import { LINK_KIND } from './kinds/link';
import { SESSION_KIND } from './kinds/session';
import { SESSIONS_KIND } from './kinds/sessions';
import { WORKFLOW_RUN_KIND } from './kinds/workflowRun';
import { REVIEW_KIND } from './kinds/review';
import { REVIEW_COMMENT_KIND } from './kinds/reviewComment';
import { resolveActions } from './resolveActions';
import { ACTION_GROUPS, type ActionDefinition } from './types';

type AnyDefinition = ActionDefinition<never>;

const KINDS: ReadonlyArray<readonly [string, ReadonlyArray<AnyDefinition>]> = [
  ['session', SESSION_KIND.actions],
  ['sessions', SESSIONS_KIND.actions],
  ['agent', AGENT_KIND.actions],
  ['workflowRun', WORKFLOW_RUN_KIND.actions],
  ['link', LINK_KIND.actions],
  ['review', REVIEW_KIND.actions],
  ['reviewComment', REVIEW_COMMENT_KIND.actions],
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
      .filter((action) => action.confirm === undefined && action.isUndoable !== true)
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
