import { Copy } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { AGENT_KIND } from './kinds/agent';
import { ARTIFACT_KIND } from './kinds/artifact';
import { DIFF_KIND } from './kinds/diff';
import { LINK_KIND } from './kinds/link';
import { PLAN_PART_KIND } from './kinds/planPart';
import { PORT_KIND } from './kinds/port';
import { TERMINAL_TAB_KIND } from './kinds/terminalTab';
import { NEW_FORM_KIND } from './kinds/newForm';
import { TASK_LIST_KIND } from './kinds/taskList';
import { RUN_STEP_KIND } from './kinds/runStep';
import { WORKFLOW_LIST_KIND } from './kinds/workflowList';
import { NOTIFICATIONS_KIND } from './kinds/notifications';
import { NOTIFICATION_KIND } from './kinds/notification';
import { PROVIDER_KIND } from './kinds/provider';
import { INTEGRATION_KIND } from './kinds/integration';
import { BRANCH_KIND } from './kinds/branch';
import { PROJECT_ASK_KIND } from './kinds/projectAsk';
import { PROJECT_KIND } from './kinds/project';
import { PULL_REQUEST_KIND } from './kinds/pullRequest';
import { CHAT_KIND } from './kinds/chat';
import { CHATS_KIND } from './kinds/chats';
import { COMMIT_KIND } from './kinds/commit';
import { DIFF_FILE_KIND } from './kinds/diffFile';
import { EXPLORE_FILE_KIND } from './kinds/exploreFile';
import { MOUNT_KIND } from './kinds/mount';
import { MESSAGE_KIND } from './kinds/message';
import { SCRIPT_KIND } from './kinds/script';
import { WORKTREE_KIND } from './kinds/worktree';
import { RECORD_KIND } from './kinds/record';
import { SESSION_KIND } from './kinds/session';
import { SESSIONS_KIND } from './kinds/sessions';
import { WORKFLOW_RUN_KIND } from './kinds/workflowRun';
import { REVIEW_KIND } from './kinds/review';
import { REVIEW_COMMENT_KIND } from './kinds/reviewComment';
import { WRITE_REVIEW_KIND } from './kinds/writeReview';
import { SUGGESTION_KIND } from './kinds/suggestion';
import { ACTION_CARD_KIND } from './kinds/actionCard';
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
  ['exploreFile', EXPLORE_FILE_KIND.actions],
  ['mount', MOUNT_KIND.actions],
  ['project', PROJECT_KIND.actions],
  ['worktree', WORKTREE_KIND.actions],
  ['script', SCRIPT_KIND.actions],
  ['message', MESSAGE_KIND.actions],
  ['chat', CHAT_KIND.actions],
  ['chats', CHATS_KIND.actions],
  ['diff', DIFF_KIND.actions],
  ['port', PORT_KIND.actions],
  ['terminalTab', TERMINAL_TAB_KIND.actions],
  ['newForm', NEW_FORM_KIND.actions],
  ['taskList', TASK_LIST_KIND.actions],
  ['runStep', RUN_STEP_KIND.actions],
  ['workflowList', WORKFLOW_LIST_KIND.actions],
  ['notifications', NOTIFICATIONS_KIND.actions],
  ['notification', NOTIFICATION_KIND.actions],
  ['provider', PROVIDER_KIND.actions],
  ['integration', INTEGRATION_KIND.actions],
  ['branch', BRANCH_KIND.actions],
  ['projectAsk', PROJECT_ASK_KIND.actions],
  ['link', LINK_KIND.actions],
  ['review', REVIEW_KIND.actions],
  ['reviewComment', REVIEW_COMMENT_KIND.actions],
  ['writeReview', WRITE_REVIEW_KIND.actions],
  ['suggestion', SUGGESTION_KIND.actions],
  ['actionCard', ACTION_CARD_KIND.actions],
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

  it('puts an action without a slot in the menu only', () => {
    const [resolved] = resolveActions({
      definitions: [
        { id: 'x', label: 'x', icon: Copy, group: 'act', when: () => true, run: () => undefined },
      ],
      facts: null,
    });
    expect(resolved?.slot).toBe('menu');
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
