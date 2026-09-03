import type { ReactNode } from 'react';
import type { Session, SessionId } from '@goodboy/types';
import type { SessionNudge } from '../../../../../store/types';
import { AGENT_KIND_META, type AgentKind } from '../../../../session/agent-kind';
import { NudgeCard } from '../../NudgeCard';
import { RightSizeCard } from '../../RightSizeCard';
import { SuggestionRow } from '../../../../suggestions/components/SuggestionRow';
import { useSessionSuggestions } from '../../../../suggestions';
import type { ScopePending } from './useScopeNudge';
import type { RightSizePending, RightSizeSuggestion } from './useRightSizeNudge';

type UseSuggestionCardsArgs = {
  readonly session: Session;
  readonly sessionNudge: SessionNudge | null;
  readonly activeAgentKind: AgentKind | null;
  readonly scopePending: ScopePending | null;
  readonly rightSizePending: RightSizePending | null;
  readonly rightSizeSuggestion: RightSizeSuggestion | null;
  readonly effectiveModel: string;
  readonly onScopeSpawn: () => void;
  readonly onScopeSendAnyway: () => void;
  readonly onScopeDismiss: () => void;
  readonly onUseSuggested: () => void;
  readonly onKeepCurrent: () => void;
  readonly onChangeModel: () => void;
  readonly dismissSessionNudge: (
    sessionId: SessionId,
    outcome?: 'accepted' | 'dismissed',
  ) => Promise<void>;
  readonly acceptSessionNudgeHandoff: (sessionId: SessionId) => Promise<void>;
};

export const useSuggestionCards = ({
  session,
  sessionNudge,
  activeAgentKind,
  scopePending,
  rightSizePending,
  rightSizeSuggestion,
  effectiveModel,
  onScopeSpawn,
  onScopeSendAnyway,
  onScopeDismiss,
  onUseSuggested,
  onKeepCurrent,
  onChangeModel,
  dismissSessionNudge,
  acceptSessionNudgeHandoff,
}: UseSuggestionCardsArgs): { readonly key: string; readonly node: ReactNode }[] => {
  const suggestions: { readonly key: string; readonly node: ReactNode }[] = [];
  const sessionSuggestions = useSessionSuggestions({ session });
  const planReady =
    sessionSuggestions.find((suggestion) => suggestion.kind === 'plan-ready') ?? null;

  if (sessionNudge?.kind === 'plan-ready' && planReady != null) {
    suggestions.push({
      key: 'plan-ready',
      node: (
        <SuggestionRow
          suggestion={planReady}
          size="card"
          actionLabel="Spawn implementer"
          onAction={() => void acceptSessionNudgeHandoff(session.id)}
          onDismiss={() => void dismissSessionNudge(session.id, 'dismissed')}
        />
      ),
    });
  }

  if (scopePending !== null && activeAgentKind !== null) {
    suggestions.push({
      key: 'scope',
      node: (
        <NudgeCard
          severity="warning"
          ariaLabel="Scope mismatch suggestion"
          testId="scope-mismatch-nudge"
          title={
            <>
              you're on <strong>{AGENT_KIND_META[activeAgentKind].label.toLowerCase()}</strong>.
              this request fits{' '}
              <strong>
                {AGENT_KIND_META[scopePending.mismatch.suggestedAgentKind].label.toLowerCase()}
              </strong>{' '}
              better.
            </>
          }
          body={
            <>
              spawn a{' '}
              {AGENT_KIND_META[scopePending.mismatch.suggestedAgentKind].label.toLowerCase()} agent,
              or send anyway.
            </>
          }
          primary={{
            label: `spawn ${AGENT_KIND_META[scopePending.mismatch.suggestedAgentKind].label.toLowerCase()}`,
            onClick: () => void onScopeSpawn(),
            testId: 'scope-mismatch-spawn',
          }}
          secondary={{
            label: 'send anyway',
            onClick: () => void onScopeSendAnyway(),
            testId: 'scope-mismatch-override',
          }}
          onDismiss={() => void onScopeDismiss()}
        />
      ),
    });
  }

  if (rightSizePending !== null && rightSizeSuggestion !== null) {
    suggestions.push({
      key: 'right-size',
      node: (
        <RightSizeCard
          direction={rightSizeSuggestion.direction}
          kind={rightSizeSuggestion.kind}
          costMultiplier={rightSizeSuggestion.costMultiplier}
          currentModel={effectiveModel}
          suggestedModel={rightSizeSuggestion.model}
          onUseSuggested={() => void onUseSuggested()}
          onKeepCurrent={() => void onKeepCurrent()}
          onChangeModel={onChangeModel}
        />
      ),
    });
  }

  return suggestions;
};
