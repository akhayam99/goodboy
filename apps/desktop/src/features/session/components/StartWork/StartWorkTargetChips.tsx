import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Listbox, type ListboxOption } from '@goodboy/ui';
import type { ProjectId, SessionId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { projectById } from '../../../../store/slices/projects/projectIndex';
import { sessionById } from '../../../../store/slices/sessions/sessionIndex';
import { sessionTitle } from '../../../../shared/utils/sessionTitle';
import { startWorkOptionsOf } from '../../../work/startWorkOptionsOf';
import { START_PICK_TRIGGER } from '../SessionKickoff/startPickTrigger';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly sessionId: SessionId | null;
  readonly projectId: ProjectId | null;
  readonly branch: string | null;
  readonly seedBranch: string | null;
  readonly isDisabled: boolean;
  readonly onSession: (sessionId: SessionId | null) => void;
  readonly onProject: (projectId: ProjectId | null) => void;
  readonly onBranch: (branch: string | null) => void;
};

type ChipParams = {
  readonly label: string;
  readonly value: string;
};

type ShownParams = {
  readonly options: ReadonlyArray<ListboxOption<string>>;
  readonly value: string;
};

const valueLabelOf = ({ label, value }: ChipParams) => (
  <>
    <span className="shrink-0 text-faint-foreground">{label}</span>
    <span className="min-w-0 truncate text-foreground">{value}</span>
  </>
);

const NEW_VALUE = 'new';

const NONE_VALUE = 'none';

const shownLabelOf = ({ options, value }: ShownParams): string =>
  options.find((option) => option.value === value)?.label ?? value;

export const StartWorkTargetChips = ({
  workspaceId,
  sessionId,
  projectId,
  branch,
  seedBranch,
  isDisabled,
  onSession,
  onProject,
  onBranch,
}: Props) => {
  const sessionRows = useAppStore(
    useShallow((state) =>
      state.sessions.filter(
        (session) => session.workspaceId === workspaceId && session.archivedAt == null,
      ),
    ),
  );
  const projectRows = useAppStore(
    useShallow((state) =>
      state.projects.filter(
        (project) => project.workspaceId === workspaceId && project.disconnectedAt == null,
      ),
    ),
  );
  const sessionBranch = useAppStore((state) =>
    sessionId === null ? null : (state.sessionBranches[sessionId] ?? null),
  );
  const options = useMemo(
    () =>
      startWorkOptionsOf({
        sessions: sessionRows.map((session) => ({
          id: session.id,
          title: sessionTitle({ session }),
        })),
        projects: projectRows.map((project) => ({ id: project.id, name: project.name })),
        branches: [seedBranch, sessionBranch],
      }),
    [sessionRows, projectRows, seedBranch, sessionBranch],
  );
  const sessionValue = sessionId ?? NEW_VALUE;
  const projectValue = projectId ?? NONE_VALUE;
  const branchValue = branch ?? NEW_VALUE;
  return (
    <>
      <Listbox<string>
        ariaLabel="Session"
        size="sm"
        searchable
        options={options.sessions}
        value={sessionValue}
        disabled={isDisabled}
        onChange={(next) => onSession(sessionById(sessionRows, next)?.id ?? null)}
        className={START_PICK_TRIGGER}
        valueLabel={valueLabelOf({
          label: 'Session',
          value: shownLabelOf({ options: options.sessions, value: sessionValue }),
        })}
      />
      <Listbox<string>
        ariaLabel="Project"
        size="sm"
        searchable
        options={options.projects}
        value={projectValue}
        disabled={isDisabled || sessionId !== null}
        onChange={(next) => onProject(projectById(projectRows, next)?.id ?? null)}
        className={START_PICK_TRIGGER}
        valueLabel={valueLabelOf({
          label: 'Project',
          value: shownLabelOf({ options: options.projects, value: projectValue }),
        })}
      />
      <Listbox<string>
        ariaLabel="Branch"
        size="sm"
        options={options.branches}
        value={branchValue}
        disabled={isDisabled}
        onChange={(next) => onBranch(next === NEW_VALUE ? null : next)}
        className={START_PICK_TRIGGER}
        valueLabel={valueLabelOf({
          label: 'Branch',
          value: shownLabelOf({ options: options.branches, value: branchValue }),
        })}
      />
    </>
  );
};
