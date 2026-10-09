import { useEffect, useState } from 'react';
import { Eyebrow } from '@goodboy/ui';
import type { IsoDateTime, Session, SessionId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { ProviderDisplayInfo } from '../../../../features/providers/providers';
import { NextStepRow } from '../../../../features/suggestions/components/NextStepSlot/NextStepRow';
import type { SessionSuggestion } from '../../../../features/suggestions/types';
import type { SuggestionActions } from '../../../../features/suggestions/useSuggestionActions';
import type { AgentKind } from '../../../../features/session/agent-kind';
import { RunsOnKickoffLine } from './RunsOnKickoffLine';

const SESSION_ID = 'mock-runs-on-session' as SessionId;
const WORKSPACE_ID = 'mock-runs-on-harborline' as WorkspaceId;
const NOW = '2026-10-02T09:30:00.000Z' as IsoDateTime;

const SESSION = {
  id: SESSION_ID,
  workspaceId: WORKSPACE_ID,
  goal: 'Round ledger totals half to even',
  state: { kind: 'idle', lastActivityAt: NOW },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
  permissionMode: 'default',
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: false,
  createdAt: NOW,
  updatedAt: NOW,
} as unknown as Session;

const PROVIDERS = [
  { id: 'anthropic', connection: 'connected', version: '2.1.288', error: null },
  { id: 'codex', connection: 'connected', version: '0.160.0', error: null },
  { id: 'cursor', connection: 'connected', version: null, error: null },
] as unknown as ReadonlyArray<ProviderDisplayInfo>;

type CardSeed = {
  readonly id: string;
  readonly kind: SessionSuggestion['kind'];
  readonly title: string;
  readonly detail: string;
  readonly label: string;
  readonly agentKind: AgentKind;
};

const CARDS: ReadonlyArray<CardSeed> = [
  {
    id: 'resolve-threads:ledger-core',
    kind: 'resolve-threads',
    title: '3 review comments to resolve',
    detail: 'Mara Quint left them on #418',
    label: 'Fix 3',
    agentKind: 'resolver',
  },
  {
    id: 'check-changes:ledger-core',
    kind: 'check-changes',
    title: 'Check the changes before you push',
    detail: 'Reviewer is pinned to Claude in this workspace',
    label: 'Start reviewer',
    agentKind: 'reviewer',
  },
  {
    id: 'fix-checks:ledger-core',
    kind: 'fix-checks',
    title: 'Checks failed on ledger-core',
    detail: 'unit, 2 failures',
    label: 'Start debugger',
    agentKind: 'debugger',
  },
];

const noopRun = async () => undefined;

type CardParams = {
  readonly card: CardSeed;
};

const suggestionOf = ({ card }: CardParams): SessionSuggestion =>
  ({
    id: card.id,
    kind: card.kind,
    priority: 40,
    band: 1,
    title: card.title,
    detail: card.detail,
    sessionId: SESSION_ID,
    targetKey: card.id,
    fingerprint: card.id,
    payload: {},
  }) as unknown as SessionSuggestion;

const actionsOf = ({ card }: CardParams): SuggestionActions => ({
  primary: {
    label: card.label,
    isDisabled: false,
    failureTitle: 'Failed',
    run: noopRun,
    runsOn: { kind: card.agentKind, runWith: noopRun },
  },
  onDismiss: null,
});

export const RunsOnScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    useAppStore.setState({
      providers: PROVIDERS,
      sessions: [SESSION],
      currentSessionId: SESSION_ID,
      workspaceOverrides: {
        [WORKSPACE_ID]: {
          defaultProviderId: 'codex',
          roleModels: {
            reviewer: { providerId: 'anthropic', model: 'claude-opus-5', effort: 'high' },
          },
        },
      } as never,
    });
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <main className="flex min-h-screen flex-col gap-6 bg-background p-8 text-foreground">
      <section className="flex w-[34rem] flex-col gap-2">
        <Eyebrow label="Next steps, Harborline defaults to Codex" />
        {CARDS.map((card) => (
          <NextStepRow
            key={card.id}
            suggestion={suggestionOf({ card })}
            actions={actionsOf({ card })}
            compact={false}
            isPending={false}
            onNotNow={() => undefined}
          />
        ))}
      </section>
      <section className="flex w-[34rem] flex-col gap-2">
        <Eyebrow label="New session, Implementer" />
        <RunsOnKickoffLine workspaceId={WORKSPACE_ID} />
      </section>
    </main>
  );
};
