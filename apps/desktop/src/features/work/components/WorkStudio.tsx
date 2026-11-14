import { Fragment, type ReactNode } from 'react';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../shared/components/conceptIcons';
import { StudioShell } from '../../../shared/components/StudioShell';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import {
  WORK_FILTERS,
  type StartWorkSeed,
  type WorkFilter,
} from '../../../store/slices/work/state';
import type { StartWorkPort } from '../startWorkPort';
import { WorkPage } from './WorkPage';

type ComposerParams = {
  readonly workspaceId: WorkspaceId;
  readonly seed: StartWorkSeed;
  readonly onClose: () => void;
};

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly filter: WorkFilter | undefined;
  readonly onClose: () => void;
  readonly renderComposer: (params: ComposerParams) => ReactNode;
};

export const WorkStudio = ({ workspaceId, filter, onClose, renderComposer }: Props) => {
  const amendStudio = useAppStore((state) => state.amendStudio);
  const seed = useAppStore((state) => state.workStart);
  const openWorkStart = useAppStore((state) => state.openWorkStart);
  const closeWorkStart = useAppStore((state) => state.closeWorkStart);
  const shown = filter !== undefined && WORK_FILTERS.includes(filter) ? filter : 'open';
  const startWork: StartWorkPort = {
    onStart: () =>
      openWorkStart({ seed: { sessionId: null, projectId: null, branch: null, text: '' } }),
  };
  return (
    <StudioShell icon={CONCEPT_ICONS.work} tone={CONCEPT_TONE.work} title="Work" onClose={onClose}>
      {() => (
        <WorkPage
          workspaceId={workspaceId}
          filter={shown}
          onFilterChange={(next) => amendStudio({ studio: { kind: 'work', filter: next } })}
          startWork={startWork}
          composer={
            seed === null ? null : (
              <Fragment
                key={`${seed.sessionId ?? 'new'}|${seed.projectId ?? ''}|${seed.branch ?? ''}|${seed.text}`}
              >
                {renderComposer({ workspaceId, seed, onClose: closeWorkStart })}
              </Fragment>
            )
          }
        />
      )}
    </StudioShell>
  );
};
