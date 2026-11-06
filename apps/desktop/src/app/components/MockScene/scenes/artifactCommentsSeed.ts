import {
  brandId,
  type Agent,
  type AgentId,
  type ArtifactComment,
  type ArtifactId,
  type ArtifactStatus,
  type IsoDateTime,
} from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { SendArtifactCommentsResult } from '../../../../store/slices/artifact-comments/types';
import { sceneClock } from '../sceneClock';
import { SESSION_ID, seedArtifactScene } from './artifactSeed';

const clock = sceneClock({ anchor: '2026-09-14T16:40:00.000Z' });

const PLAN_COMMENTS_ARTIFACT_ID = 'mock-states-plan-idempotency' as ArtifactId;

const GOAL_SENTENCE = 'Add idempotency keys to payments-api charges.';

const draft = ({
  id,
  anchor,
  body,
  at,
}: Pick<ArtifactComment, 'id' | 'anchor' | 'body'> & { readonly at: string }): ArtifactComment => ({
  id,
  sessionId: SESSION_ID,
  artifactId: PLAN_COMMENTS_ARTIFACT_ID,
  revision: 1,
  anchor,
  body,
  status: 'draft',
  sentTurnId: null,
  createdAt: clock.iso({ at: `2026-09-14T${at}:00.000Z` }),
  updatedAt: clock.iso({ at: `2026-09-14T${at}:00.000Z` }),
});

const DRAFTS: ReadonlyArray<ArtifactComment> = [
  draft({
    id: 'mock-plan-comment-goal',
    anchor: { kind: 'quote', order: 0, text: 'idempotency keys', blockText: GOAL_SENTENCE },
    body: 'Say which header carries the key, and how long a key is kept.',
    at: '16:31',
  }),
  draft({
    id: 'mock-plan-comment-part',
    anchor: { kind: 'part', index: 1, title: 'Service changes' },
    body: 'Split the charge path and the refund path into two parts.',
    at: '16:33',
  }),
];

const NOW = clock.iso({ at: '2026-09-14T16:40:00.000Z' });

type SeedParams = {
  readonly hasComments: boolean;
  readonly hasRun?: boolean;
};

const RAN_AGENT_ID = brandId<AgentId>({ value: 'mock-plan-comments-agent-implementer' });

const CONSUMED: ArtifactStatus = 'consumed';

const SENT: ArtifactComment['status'] = 'sent';

const RAN_AGENT: Agent = {
  id: RAN_AGENT_ID,
  sessionId: SESSION_ID,
  ordinal: 40,
  name: 'Implementer',
  kind: 'implementer',
  status: 'running',
  startedAt: NOW,
};

const SENT_TO_AGENT: SendArtifactCommentsResult = {
  kind: 'sentToAgent',
  agentName: RAN_AGENT.name,
};

const seedRan = () => {
  useAppStore.setState((state) => ({
    sessionPlans: {
      ...state.sessionPlans,
      [SESSION_ID]: (state.sessionPlans[SESSION_ID] ?? []).map((plan) =>
        plan.id === PLAN_COMMENTS_ARTIFACT_ID
          ? {
              ...plan,
              status: CONSUMED,
              consumptionCount: 1,
              lastConsumer: { agentId: RAN_AGENT_ID, name: RAN_AGENT.name },
            }
          : plan,
      ),
    },
    sessionArtifacts: {
      ...state.sessionArtifacts,
      [SESSION_ID]: (state.sessionArtifacts[SESSION_ID] ?? []).map((artifact) =>
        artifact.id === PLAN_COMMENTS_ARTIFACT_ID ? { ...artifact, status: CONSUMED } : artifact,
      ),
    },
    sessionPhaseRuns: {
      ...state.sessionPhaseRuns,
      [SESSION_ID]: [...(state.sessionPhaseRuns[SESSION_ID] ?? []), RAN_AGENT],
    },
    sendArtifactCommentsToAgent: async () => {
      useAppStore.setState((current) => ({
        artifactComments: {
          ...current.artifactComments,
          [SESSION_ID]: (current.artifactComments[SESSION_ID] ?? []).map((comment) =>
            comment.status === 'draft' ? { ...comment, status: SENT } : comment,
          ),
        },
      }));
      return SENT_TO_AGENT;
    },
  }));
};

export const seedPlanCommentsScene = ({ hasComments, hasRun = false }: SeedParams) => {
  seedArtifactScene({ focusedArtifactId: PLAN_COMMENTS_ARTIFACT_ID, withStates: true });
  useAppStore.setState({
    artifactComments: { [SESSION_ID]: hasComments ? DRAFTS : [] },
    artifactCommentSends: {},
    loadArtifactComments: async () => undefined,
    addArtifactComment: async ({ artifactId, revision, anchor, body }) => {
      const id = `mock-plan-comment-${Date.now()}`;
      useAppStore.setState((state) => ({
        artifactComments: {
          ...state.artifactComments,
          [SESSION_ID]: [
            ...(state.artifactComments[SESSION_ID] ?? []),
            {
              id,
              sessionId: SESSION_ID,
              artifactId,
              revision,
              anchor,
              body: body.trim(),
              status: 'draft',
              sentTurnId: null,
              createdAt: NOW as IsoDateTime,
              updatedAt: NOW as IsoDateTime,
            },
          ],
        },
      }));
      return id;
    },
    editArtifactComment: async ({ commentId, body }) => {
      useAppStore.setState((state) => ({
        artifactComments: {
          ...state.artifactComments,
          [SESSION_ID]: (state.artifactComments[SESSION_ID] ?? []).map((comment) =>
            comment.id === commentId ? { ...comment, body: body.trim() } : comment,
          ),
        },
      }));
      return true;
    },
    removeArtifactComment: async ({ commentId }) => {
      useAppStore.setState((state) => ({
        artifactComments: {
          ...state.artifactComments,
          [SESSION_ID]: (state.artifactComments[SESSION_ID] ?? []).filter(
            (comment) => comment.id !== commentId,
          ),
        },
      }));
      return true;
    },
    sendArtifactComments: async () => {
      useAppStore.setState((state) => ({
        artifactComments: {
          ...state.artifactComments,
          [SESSION_ID]: (state.artifactComments[SESSION_ID] ?? []).map((comment) =>
            comment.status === 'draft' ? { ...comment, status: 'sent' } : comment,
          ),
        },
      }));
      return { kind: 'unchanged' };
    },
  });
  if (hasRun) {
    seedRan();
  }
};
