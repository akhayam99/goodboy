import { Fragment, useMemo, useState } from 'react';
import { Star } from '@goodboy/ui/icons';
import {
  cn,
  EmptyLine,
  Eyebrow,
  formatError,
  ICON_SIZE,
  PopoverPin,
  ROW_INTERACTIVE,
  SearchField,
} from '@goodboy/ui';
import type { Project, ProjectId, SessionId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { useShowToast } from '../../../../../shared/components/Toast/useShowToast';
import {
  rememberExistingWorktree,
  rememberNewBranchChoice,
  rememberPickedBranch,
} from '../../../../../store/slices/sessions/branchChoiceSeeds';
import { projectGlyph } from '../../../../../shared/components/conceptIcons';
import { NAMES } from '../../../../../shared/utils/names';
import { MountPreflightCard } from './MountPreflightCard';
import { mountPickerGroups } from './mountPickerGroups';
import { mountFailure, type MountFailure } from './mountFailure';
import { useMountPreflight } from './useMountPreflight';
import { projectById } from '../../../../../store/slices/projects/projectIndex';
import { ConnectProjectRow } from './ConnectProjectRow';
import { mountWithUndo } from './mountWithUndo';

const SEARCH_THRESHOLD = 8;
const NO_IDS: ReadonlyArray<ProjectId> = [];

type Props = {
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
  readonly projects: ReadonlyArray<Project>;
  readonly recentIds: ReadonlyArray<ProjectId>;
  readonly requestedIds?: ReadonlyArray<ProjectId>;
  readonly emptyHint: string;
  readonly onDone: () => void;
};

type MountParams = {
  readonly project: Project;
  readonly isAdded: boolean;
  readonly isOneStep: boolean;
};

export const MountProjectList = ({
  sessionId,
  workspaceId,
  projects,
  recentIds,
  requestedIds = NO_IDS,
  emptyHint,
  onDone,
}: Props) => {
  const showToast = useShowToast();
  const emitNotification = useAppStore((state) => state.emitNotification);
  const [query, setQuery] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<Project['id'] | null>(null);
  const [choice, setChoice] = useState<string | null>(null);
  const [isMounting, setIsMounting] = useState(false);
  const [addedId, setAddedId] = useState<ProjectId | null>(null);
  const [failure, setFailure] = useState<MountFailure | null>(null);
  const isSearchable = projects.length > SEARCH_THRESHOLD;
  const filtered = useMemo(
    () => projects.filter((project) => project.name.toLowerCase().includes(query.toLowerCase())),
    [projects, query],
  );
  const isQueryEmpty = query.trim() === '';
  const groups = useMemo(
    () =>
      mountPickerGroups({
        filtered,
        total: projects.length,
        recentIds,
        requestedIds,
        isQueryEmpty,
      }),
    [filtered, recentIds, requestedIds, isQueryEmpty, projects.length],
  );
  const selectedProject = projectById(projects, selectedProjectId) ?? null;
  const preflightState = useMountPreflight({ sessionId, project: selectedProject, choice });

  const mountProject = async ({ project, isAdded, isOneStep }: MountParams) => {
    const preflight = isOneStep ? null : preflightState.preflight;
    setIsMounting(true);
    setFailure(null);
    try {
      await mountWithUndo({
        sessionId,
        project,
        isAdded,
        getState: useAppStore.getState,
        showToast,
        options:
          preflight === null
            ? {}
            : {
                mountId: preflight.mountId,
                dirName: preflight.targetPath.split('/').at(-1),
                ...(preflight.branch === null || preflight.isExistingBranch
                  ? {}
                  : { branch: preflight.branch }),
              },
      });
      setQuery('');
      setSelectedProjectId(null);
      onDone();
    } catch (error) {
      setSelectedProjectId(project.id);
      setFailure(mountFailure({ error, project, preflight }));
      void emitNotification({
        kind: 'error',
        severity: 'warning',
        title: "Couldn't add the folder",
        body: formatError(error),
        sessionId,
        workspaceId: project.workspaceId,
      });
    } finally {
      setIsMounting(false);
    }
  };

  if (selectedProject !== null) {
    const confirmed = {
      project: selectedProject,
      isAdded: selectedProject.id === addedId,
      isOneStep: false,
    };
    return (
      <MountPreflightCard
        project={selectedProject}
        state={preflightState}
        isBusy={isMounting}
        failure={failure}
        onConfirm={() => void mountProject(confirmed)}
        onCancel={() => {
          setFailure(null);
          setSelectedProjectId(null);
          setChoice(null);
        }}
        onPickBranch={({ branch }) => {
          rememberPickedBranch({ sessionId, branch });
          setChoice(branch);
        }}
        onUseWorktree={() => {
          const { preflight } = preflightState;
          if (preflight === null || preflight.branch === null || preflight.checkedOutAt === null) {
            return;
          }
          rememberExistingWorktree({
            sessionId,
            branch: preflight.branch,
            worktreePath: preflight.checkedOutAt,
          });
          void mountProject(confirmed);
        }}
        onNewBranch={() => {
          rememberNewBranchChoice({ sessionId });
          setChoice('new-branch');
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {isSearchable ? (
        <PopoverPin edge="start" className="flex flex-col p-2">
          <SearchField
            value={query}
            ariaLabel={NAMES.searchProjects}
            placeholder={NAMES.searchProjects}
            autoComplete="off"
            onChange={setQuery}
          />
        </PopoverPin>
      ) : null}
      {projects.length === 0 ? (
        <p className="px-3 py-2 text-meta text-muted-foreground">{emptyHint}</p>
      ) : filtered.length === 0 ? (
        <EmptyLine className="px-3">No projects match</EmptyLine>
      ) : (
        <div className="flex flex-col py-0.5">
          {groups.map((group) => (
            <Fragment key={group.key}>
              {group.label === null ? null : (
                <div className="px-3 pb-1 pt-2">
                  <Eyebrow label={group.label} muted />
                </div>
              )}
              <ul aria-label={group.label ?? undefined}>
                {group.projects.map((project) => {
                  const GlyphIcon = projectGlyph({ kind: project.kind });
                  const isStarred = project.starredAt !== undefined;
                  return (
                    <li key={project.id}>
                      <button
                        type="button"
                        aria-label={`Mount ${project.name}`}
                        onClick={() => {
                          setFailure(null);
                          setSelectedProjectId(project.id);
                        }}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-body text-foreground',
                          ROW_INTERACTIVE,
                        )}
                      >
                        <GlyphIcon
                          size={ICON_SIZE.row}
                          aria-hidden
                          className="shrink-0 text-muted-foreground"
                        />
                        <span className="min-w-0 flex-1 truncate">{project.name}</span>
                        {isStarred ? (
                          <Star
                            size={ICON_SIZE.mark}
                            weight="fill"
                            aria-hidden
                            className="shrink-0 text-warning"
                          />
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Fragment>
          ))}
        </div>
      )}
      <PopoverPin edge="end" className="flex flex-col pt-1">
        <ConnectProjectRow
          workspaceId={workspaceId}
          onConnected={(project) => {
            setAddedId(project.id);
            void mountProject({ project, isAdded: true, isOneStep: true });
          }}
        />
      </PopoverPin>
    </div>
  );
};
