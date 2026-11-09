import type { ArtifactId, ArtifactKind, SessionArtifact } from '@goodboy/types';
import type { NewDrawerForm, OpenDrawer } from '../../../store/slices/drawer/state';

export type SlotChipLabel = {
  readonly kind: string;
  readonly title: string | null;
};

type Params = {
  readonly drawer: OpenDrawer;
  readonly artifacts: ReadonlyArray<SessionArtifact>;
};

type ArtifactParams = {
  readonly artifacts: ReadonlyArray<SessionArtifact>;
  readonly artifactId: ArtifactId;
  readonly fallback: string;
};

type PathParams = {
  readonly path: string | null;
};

const ARTIFACT_WORDS = {
  plan: 'Plan',
  report: 'Report',
  wireframe: 'Wireframe',
} as const satisfies Record<ArtifactKind, string>;

const NEW_WORDS = {
  report: 'Report',
  wireframe: 'Wireframe',
} as const satisfies Record<NewDrawerForm, string>;

const artifactLabel = ({ artifacts, artifactId, fallback }: ArtifactParams): SlotChipLabel => {
  const artifact = artifacts.find((candidate) => candidate.id === artifactId);
  if (artifact === undefined) {
    return { kind: fallback, title: null };
  }
  return { kind: ARTIFACT_WORDS[artifact.kind], title: artifact.title };
};

const fileName = ({ path }: PathParams): string | null => {
  if (path === null || path === '') {
    return null;
  }
  return path.split('/').pop() ?? path;
};

export const slotChipLabelOf = ({ drawer, artifacts }: Params): SlotChipLabel => {
  switch (drawer.kind) {
    case 'ask':
      return { kind: 'Ask', title: null };
    case 'context':
      return { kind: 'Context', title: null };
    case 'explore':
      return { kind: 'Explore', title: null };
    case 'scripts':
      return { kind: 'Scripts', title: null };
    case 'spawned':
      return { kind: 'Agents', title: null };
    case 'terminal':
      return { kind: 'Terminal', title: null };
    case 'explore-file':
      return { kind: 'File', title: drawer.payload.entry.name };
    case 'scriptRun':
      return { kind: 'Script', title: drawer.payload.scriptKey };
    case 'question':
      return { kind: 'Question', title: null };
    case 'new':
      return { kind: 'New', title: NEW_WORDS[drawer.payload.form] };
    case 'fix-comments':
      return { kind: 'Comments', title: null };
    case 'artifact':
      return artifactLabel({
        artifacts,
        artifactId: drawer.payload.artifactId,
        fallback: 'Artifact',
      });
    case 'artifact-document':
      return artifactLabel({
        artifacts,
        artifactId: drawer.payload.artifactId,
        fallback: 'Document',
      });
    case 'plan-part':
      return artifactLabel({ artifacts, artifactId: drawer.payload.planId, fallback: 'Plan' });
    case 'check-analysis':
      return { kind: 'Check', title: null };
    case 'conversation':
      return { kind: 'Comment', title: null };
    case 'transcript':
      return { kind: 'Transcript', title: null };
    case 'session-log':
      return { kind: 'Log', title: null };
    case 'history-versions':
      return { kind: 'Versions', title: null };
    case 'file-diff':
      return { kind: 'Changes', title: fileName({ path: drawer.payload.path }) };
    case 'identifier-peek':
      return { kind: 'Definition', title: drawer.payload.word };
    case 'browser':
      return { kind: 'Browser', title: null };
    default: {
      const exhaustive: never = drawer;
      return exhaustive;
    }
  }
};
