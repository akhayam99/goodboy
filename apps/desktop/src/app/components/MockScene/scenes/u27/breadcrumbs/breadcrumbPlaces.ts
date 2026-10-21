import type { AgentId, Session } from '@goodboy/types';
import {
  agentPlace,
  branchPlace,
  sessionPlace,
} from '../../../../../../store/slices/navigation/place';
import type { PlaceRequest } from '../../../../../../store/slices/navigation/types';
import { handlersFor } from '../../brand/DiffStage';
import { APPLY_WEBHOOK_PATH, BRANCH_FILES_PATCH } from '../../brand/contextDiffPatch';
import type { FakeHandlers } from '../../brand/fakeTauri';
import {
  AGENT_BACKFILL_ID,
  CHAT_AGENT_RESOLVER_ID,
  CHAT_AGENTS,
  CHAT_ARTIFACTS,
  CHAT_SESSION,
  CHAT_SESSION_ID,
  DYNAMIC_RUN_ID,
  FLOW_MOUNTS,
  FLOW_SESSION,
  FLOW_SESSION_ID,
} from '../../flow-audit/fixtures';
import { seedChatSurfaces, seedWorkflowRun } from '../../flow-audit/seeds';

export type BreadcrumbPlaceId = 'run' | 'step' | 'agent' | 'artifact' | 'branchFile';

export type BreadcrumbPlace = {
  readonly session: Session;
  readonly seed: () => void;
  readonly to: PlaceRequest;
  readonly handlers: FakeHandlers | null;
};

const RUN_PLACE = sessionPlace({
  sessionId: FLOW_SESSION_ID,
  lens: 'workflows',
  target: { kind: 'run', runId: DYNAMIC_RUN_ID },
});

const FIRST_MOUNT_PATH = FLOW_MOUNTS[0]?.worktreePath ?? null;

const FIRST_ARTIFACT_ID = CHAT_ARTIFACTS[0]?.id ?? null;

const STANDALONE_AGENT_ID: AgentId =
  CHAT_AGENTS.find((agent) => agent.id !== CHAT_AGENT_RESOLVER_ID)?.id ?? CHAT_AGENT_RESOLVER_ID;

export const BREADCRUMB_PLACES: Readonly<Record<BreadcrumbPlaceId, BreadcrumbPlace>> = {
  run: {
    session: FLOW_SESSION,
    seed: seedWorkflowRun,
    to: RUN_PLACE,
    handlers: null,
  },
  step: {
    session: FLOW_SESSION,
    seed: seedWorkflowRun,
    to: agentPlace({ sessionId: FLOW_SESSION_ID, agentId: AGENT_BACKFILL_ID }),
    handlers: null,
  },
  agent: {
    session: CHAT_SESSION,
    seed: seedChatSurfaces,
    to: agentPlace({ sessionId: CHAT_SESSION_ID, agentId: STANDALONE_AGENT_ID }),
    handlers: null,
  },
  artifact: {
    session: CHAT_SESSION,
    seed: seedChatSurfaces,
    to: sessionPlace({
      sessionId: CHAT_SESSION_ID,
      lens: 'plans',
      target:
        FIRST_ARTIFACT_ID === null ? null : { kind: 'artifact', artifactId: FIRST_ARTIFACT_ID },
    }),
    handlers: null,
  },
  branchFile: {
    session: FLOW_SESSION,
    seed: seedWorkflowRun,
    to: branchPlace({
      sessionId: FLOW_SESSION_ID,
      mountPath: FIRST_MOUNT_PATH,
      tab: 'files',
      focus: { kind: 'branch', path: APPLY_WEBHOOK_PATH },
    }),
    handlers: {
      ...handlersFor(BRANCH_FILES_PATCH),
      db_select: () => [],
      session_budget_get: () => null,
    },
  },
};
