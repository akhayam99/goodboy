import type { ArtifactStatus } from '@goodboy/types';

export type ArtifactActionId =
  | 'runPlan'
  | 'runAgain'
  | 'restore'
  | 'edit'
  | 'stop'
  | 'newVariant'
  | 'export'
  | 'print'
  | 'copySource'
  | 'saveSource'
  | 'regenerate'
  | 'discard'
  | 'openAgent';

export type ArtifactActionSubject =
  | Readonly<{ kind: 'plan'; status: ArtifactStatus; isRunning: boolean }>
  | Readonly<{ kind: 'report'; status: ArtifactStatus }>
  | Readonly<{ kind: 'wireframe'; status: ArtifactStatus }>
  | Readonly<{ kind: 'generation'; canStop: boolean }>;

export type ArtifactActionSet = Readonly<{
  primary: ArtifactActionId | null;
  secondary: ArtifactActionId | null;
  overflow: ReadonlyArray<ArtifactActionId>;
}>;

const DOCUMENT_EXPORTS: ReadonlyArray<ArtifactActionId> = ['print', 'copySource', 'saveSource'];

const planActions = ({
  status,
  isRunning,
}: {
  readonly status: ArtifactStatus;
  readonly isRunning: boolean;
}): ArtifactActionSet => {
  if (isRunning) {
    return { primary: null, secondary: null, overflow: DOCUMENT_EXPORTS };
  }
  switch (status) {
    case 'active':
      return { primary: 'runPlan', secondary: 'edit', overflow: [...DOCUMENT_EXPORTS, 'discard'] };
    case 'consumed':
      return { primary: null, secondary: 'runAgain', overflow: DOCUMENT_EXPORTS };
    case 'superseded':
      return { primary: null, secondary: 'runAgain', overflow: [...DOCUMENT_EXPORTS, 'discard'] };
    case 'discarded':
      return { primary: null, secondary: 'restore', overflow: DOCUMENT_EXPORTS };
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
};

export const artifactActions = ({
  subject,
}: {
  readonly subject: ArtifactActionSubject;
}): ArtifactActionSet => {
  switch (subject.kind) {
    case 'plan':
      return planActions({ status: subject.status, isRunning: subject.isRunning });
    case 'report':
      return {
        primary: null,
        secondary: 'edit',
        overflow: ['print', 'regenerate', 'copySource', 'saveSource'],
      };
    case 'wireframe':
      return { primary: null, secondary: 'export', overflow: ['newVariant', 'print'] };
    case 'generation':
      return {
        primary: null,
        secondary: subject.canStop ? 'stop' : null,
        overflow: ['openAgent'],
      };
    default: {
      const exhaustive: never = subject;
      return exhaustive;
    }
  }
};
