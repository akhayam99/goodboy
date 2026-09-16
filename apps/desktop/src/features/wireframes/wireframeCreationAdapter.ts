import {
  artifactSpawnBrief,
  artifactSpawnScope,
  type ArtifactCreationAdapter,
} from '../artifacts/artifactCreationAdapter';
import { resolveWireframeRouting } from '../../store/slices/artifacts/spawnWireframeAgent';
import { WIREFRAME_DEFAULT_REQUEST } from './buildWireframeContext';
import {
  asWireframeFidelity,
  WIREFRAME_FIDELITIES,
  WIREFRAME_FIDELITY_CHOICE_LABEL,
  WIREFRAME_FIDELITY_HINT,
} from './wireframeFidelity';

const choiceOf = ({ draft }: Parameters<ArtifactCreationAdapter['choiceOf']>[0]): string =>
  draft.kind === 'wireframe' ? draft.fidelity : 'low';

export const wireframeCreationAdapter: ArtifactCreationAdapter = {
  kind: 'wireframe',
  crumbLabel: 'Create wireframe',
  generateLabel: 'Generate wireframe',
  ctaTitle: 'Draw a screen or flow from a brief and what this session did',
  brief: { label: 'Brief', placeholder: 'which screen or flow should this show?' },
  choice: {
    label: 'Fidelity',
    ariaLabel: 'Fidelity',
    options: WIREFRAME_FIDELITIES.map((fidelity) => ({
      value: fidelity,
      label: WIREFRAME_FIDELITY_CHOICE_LABEL[fidelity],
      hint: WIREFRAME_FIDELITY_HINT[fidelity],
    })),
  },
  scopeCopy: {
    session: 'agents and plans come from the whole session.',
    run: 'agents come from this run. session plans are included either way.',
  },
  defaultRequest: () => WIREFRAME_DEFAULT_REQUEST,
  repoLine: ({ choice, repo }) => {
    if (choice !== 'high') {
      return 'plain wireframe, no design files read.';
    }
    if (repo === null) {
      return 'no mounted project, so the generic theme is used.';
    }
    const branch = repo.branch === null ? 'a detached head' : repo.branch;
    return `design files read from ${repo.mountName} on ${branch}.`;
  },
  choiceOf,
  withChoice: ({ draft, choice }) => {
    const fidelity = asWireframeFidelity({ value: choice });
    if (draft.kind !== 'wireframe' || fidelity === null) {
      return draft;
    }
    return { ...draft, fidelity };
  },
  resolveRouting: ({ state, sessionId, choice }) =>
    resolveWireframeRouting({
      state,
      sessionId,
      fidelity: asWireframeFidelity({ value: choice }) ?? 'low',
      picked: null,
    }),
  spawn: ({ actions, sessionId, draft }) =>
    actions.spawnWireframeAgent({
      sessionId,
      fidelity: asWireframeFidelity({ value: choiceOf({ draft }) }) ?? 'low',
      workflowRunId: artifactSpawnScope({ draft }),
      routing: draft.routing,
      brief: artifactSpawnBrief({ draft }),
      focus: 'none',
    }),
};
