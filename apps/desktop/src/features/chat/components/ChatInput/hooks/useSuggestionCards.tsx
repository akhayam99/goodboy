import type { ReactNode } from 'react';
import { ClipboardCheck, Telescope } from 'lucide-react';
import type { Session } from '@goodboy/types';
import type { SessionNudge } from '../../../../../store/store';
import { AGENT_KIND_META, type AgentKind } from '../../../../session/agent-kind';
import { NudgeCard } from '../../NudgeCard';
import { RightSizeCard } from '../../RightSizeCard';
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
    sessionId: string,
    outcome?: 'accepted' | 'dismissed',
  ) => Promise<void>;
  readonly acceptSessionNudgeHandoff: (sessionId: string) => Promise<void>;
};

export function useSuggestionCards({
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
}: UseSuggestionCardsArgs): { readonly key: string; readonly node: ReactNode }[] {
  const suggestions: { readonly key: string; readonly node: ReactNode }[] = [];

  if (sessionNudge?.kind === 'plan-ready' && session.workflowRuns.length === 0) {
    suggestions.push({
      key: 'plan-ready',
      node: (
        <NudgeCard
          severity="success"
          ariaLabel="plan ready to implement"
          testId="plan-ready-nudge"
          icon={<ClipboardCheck size={12} aria-hidden />}
          title={
            <>
              Plan looks ready: <strong>{sessionNudge.planTitle}</strong>. Spawn an implementer to
              execute it?
            </>
          }
          primary={{
            label: 'Spawn implementer',
            onClick: () => void acceptSessionNudgeHandoff(session.id),
            testId: 'plan-ready-accept',
          }}
          secondary={{
            label: 'Not now',
            onClick: () => void dismissSessionNudge(session.id, 'dismissed'),
            testId: 'plan-ready-dismiss',
          }}
          onDismiss={() => void dismissSessionNudge(session.id, 'dismissed')}
        />
      ),
    });
  }

  if (sessionNudge?.kind === 'scout-fanout-suggested') {
    suggestions.push({
      key: 'scout-fanout',
      node: (
        <NudgeCard
          severity="info"
          ariaLabel="multi-scout exploration available"
          testId="scout-fanout-nudge"
          icon={<Telescope size={12} aria-hidden />}
          title={
            <>
              Broad search across <strong>{sessionNudge.areaCount} areas</strong>. Multi-scout can
              explore them in parallel.
            </>
          }
          body={<>Enable it for this workspace to scan large codebases faster.</>}
          primary={{
            label: 'Enable multi-scout',
            onClick: () => {
              window.dispatchEvent(
                new CustomEvent('goodboy:open-workspace-settings', {
                  detail: { section: 'scout' },
                }),
              );
              void dismissSessionNudge(session.id, 'accepted');
            },
            testId: 'scout-fanout-enable',
          }}
          secondary={{
            label: 'Not now',
            onClick: () => void dismissSessionNudge(session.id, 'dismissed'),
            testId: 'scout-fanout-dismiss',
          }}
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
          ariaLabel="scope mismatch suggestion"
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
}
