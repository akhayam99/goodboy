import type {
  ArtifactId,
  ArtifactStatus,
  PlanWithCount,
  SessionArtifact,
  SessionId,
} from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import type { PaletteEntry } from '../types';

type ArtifactOpenParams = {
  readonly sessionId: SessionId;
  readonly artifactId: ArtifactId;
};

type Params = {
  readonly sessionId: SessionId;
  readonly plans: ReadonlyArray<PlanWithCount>;
  readonly artifacts: ReadonlyArray<SessionArtifact>;
  readonly open: (params: ArtifactOpenParams) => void;
  readonly openPlan: (params: ArtifactOpenParams) => void;
};

const KIND_TAG = {
  plan: 'Plan',
  report: 'Report',
  wireframe: 'Wireframe',
} as const;

const PLAN_STATUS = {
  active: 'Ready to run',
  consumed: 'Ran',
  superseded: 'Superseded',
  discarded: 'Discarded',
} as const satisfies Record<ArtifactStatus, string>;

const ARTIFACT_STATUS = {
  active: '',
  consumed: '',
  superseded: 'Superseded',
  discarded: 'Discarded',
} as const satisfies Record<ArtifactStatus, string>;

const artifactKey = (artifactId: string): string => `artifact:${artifactId}`;

export const artifactEntries = ({
  sessionId,
  plans,
  artifacts,
  open,
  openPlan,
}: Params): ReadonlyArray<PaletteEntry> => {
  const planEntries = plans.map((plan): PaletteEntry => {
    const artifactId = plan.id as unknown as ArtifactId;
    return {
      key: artifactKey(artifactId),
      label: plan.title,
      secondary: [plan.bodyMd.slice(0, 400)],
      kind: 'artifact',
      group: null,
      icon: CONCEPT_ICONS.plans,
      detail: PLAN_STATUS[plan.status],
      tag: KIND_TAG.plan,
      run: () => openPlan({ sessionId, artifactId }),
    };
  });
  const otherEntries = artifacts
    .filter((artifact) => artifact.kind !== 'plan')
    .map((artifact): PaletteEntry => ({
      key: artifactKey(artifact.id),
      label: artifact.title,
      secondary: [],
      kind: 'artifact',
      group: null,
      icon: artifact.kind === 'report' ? CONCEPT_ICONS.report : CONCEPT_ICONS.wireframe,
      detail: ARTIFACT_STATUS[artifact.status],
      tag: KIND_TAG[artifact.kind],
      run: () => open({ sessionId, artifactId: artifact.id }),
    }));
  return [...planEntries, ...otherEntries];
};
