import { stripControlMarkers } from '@goodboy/core/context';
import { findSecretMatches } from '@goodboy/core/secret-scan';
import { autoTreeWordOf } from '../../auto/autoTreeWordOf';
import { blockedQuestionOf } from '../../workflows/blockedQuestionOf';
import { safeTextOf } from './safeTextOf';
import type { WorkspaceScope } from './workspaceScope';

export const LEAD_ASK_MAX = 600;

const MASK = '[hidden]';

type Params = {
  readonly scope: WorkspaceScope;
  readonly sessionId: string;
};

type MaskParams = {
  readonly text: string;
};

const withoutSecrets = ({ text }: MaskParams): string =>
  findSecretMatches({ text }).reduce((value, match) => value.split(match.value).join(MASK), text);

export const leadAskOf = ({ scope, sessionId }: Params): string | null => {
  for (const view of scope.trees[sessionId] ?? []) {
    const rootId = view.tree.rootAgentId;
    const rootTurn = scope.turnStates[rootId] ?? null;
    if (autoTreeWordOf({ view, rootTurn }).state !== 'asking') {
      continue;
    }
    const question = blockedQuestionOf({ events: scope.transcripts[rootId] ?? [] });
    if (question === null) {
      continue;
    }
    const text = safeTextOf({
      text: withoutSecrets({ text: stripControlMarkers(question.text) }),
      max: LEAD_ASK_MAX,
    });
    if (text.trim().length > 0) {
      return text;
    }
  }
  return null;
};
