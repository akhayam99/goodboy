import type { SessionId } from '@goodboy/types';
import { analyzeFailingChecks } from '../../branch/checks/analyzeFailingChecks';
import { failingChecksOf } from '../../branch/checks/failingChecksOf';
import { pushCheckFix } from '../../branch/checks/pushCheckFix';
import { startCheckFix } from '../../branch/checks/startCheckFix';
import type { AgentKindRouting } from '../../session/agent-kind';
import { useAppStore } from '../../../store';
import { checkFixTargetOf } from '../checkFixTargetOf';
import type { SessionSuggestion } from '../types';
import type { SuggestionActions } from '.';

type FixChecksPayload = Extract<SessionSuggestion, { readonly kind: 'fix-checks' }>['payload'];

type Params = {
  readonly sessionId: SessionId;
  readonly payload: FixChecksPayload;
};

type AnalyzeParams = {
  readonly routing?: AgentKindRouting;
};

export const fixChecksActions = ({ sessionId, payload }: Params): SuggestionActions => {
  const readFailing = () =>
    failingChecksOf({
      state: useAppStore.getState(),
      sessionId,
      mountId: payload.mountId,
      prNumber: payload.prNumber,
    });
  const analyze = async ({ routing }: AnalyzeParams) => {
    const state = useAppStore.getState();
    const github = state.mountGithub[payload.mountId];
    if (
      github?.pr?.number === payload.prNumber &&
      (github.detail === null || github.detail.prNumber !== payload.prNumber)
    ) {
      await state.refreshSessionPrDetail(sessionId, {
        mountId: payload.mountId,
        force: true,
      });
    }
    const failing = readFailing();
    if (failing === null) {
      throw new Error('Refresh the failing checks and try Analyze again.');
    }
    await analyzeFailingChecks({
      sessionId,
      mountId: payload.mountId,
      pullRequest: failing.pullRequest,
      checks: failing.checks,
      ...(routing !== undefined && { routing }),
    });
  };
  const chain = payload.progress?.chain ?? 'none';
  const { mountId } = payload;
  if (chain === 'proposal') {
    return {
      primary: {
        label: 'Start fix',
        agentKind: 'implementer',
        isDisabled: false,
        failureTitle: "Couldn't start the Implementer",
        run: async () => {
          const target = checkFixTargetOf({
            state: useAppStore.getState(),
            sessionId,
            mountId,
          });
          if (target === null) {
            throw new Error('Refresh the failing checks and try Start fix again.');
          }
          await startCheckFix({ sessionId, url: target.url, mountId });
        },
      },
      onDismiss: null,
    };
  }
  if (chain === 'fixed-local') {
    return {
      primary: {
        label: 'Push',
        isDisabled: false,
        failureTitle: "Couldn't push the branch",
        run: async () => {
          const target = checkFixTargetOf({
            state: useAppStore.getState(),
            sessionId,
            mountId,
          });
          await pushCheckFix({ sessionId, mountId, fixAgentId: target?.fixAgentId });
        },
      },
      onDismiss: null,
    };
  }
  const isAnalyzedBefore = chain === 'fixed-pushed' || chain === 'fix-failed';
  return {
    primary: {
      label: isAnalyzedBefore ? 'Analyze again' : 'Analyze',
      agentKind: 'debugger',
      isDisabled: false,
      failureTitle: "Couldn't start the Debugger",
      run: () => analyze({}),
      runsOn: {
        kind: 'debugger',
        runWith: (routing) => analyze({ routing }),
      },
    },
    onDismiss: null,
  };
};
