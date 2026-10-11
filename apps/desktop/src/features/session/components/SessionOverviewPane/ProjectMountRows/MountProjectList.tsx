import { Fragment, useMemo, useState } from 'react';
import { Star } from 'lucide-react';
import { ROW_INTERACTIVE, EmptyLine, Eyebrow, ScrollFade, cn, formatError } from '@goodboy/ui';
import type { Project, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { ICON_SIZE, projectGlyph } from '../../../../../shared/components/conceptIcons';
import { shouldGroupStarred } from '../../../../../shared/utils/shouldGroupStarred';
import { MountPreflightCard } from './MountPreflightCard';
import { mountFailure, type MountFailure } from './mountFailure';
import { useMountPreflight } from './useMountPreflight';
import { projectById } from '../../../../../store/slices/projects/projectIndex';

const MANUAL_REASON = 'added manually by the user';
const SEARCH_THRESHOLD = 8;

type Props = {
  readonly sessionId: SessionId;
  readonly projects: ReadonlyArray<Project>;
  readonly onDone: () => void;
};

export const MountProjectList = ({ sessionId, projects, onDone }: Props) => {
  const ensureProjectMounted = useAppStore((state) => state.ensureProjectMounted);
  const emitNotification = useAppStore((state) => state.emitNotification);
  const [query, setQuery] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<Project['id'] | null>(null);
  const [isMounting, setIsMounting] = useState(false);
  const [failure, setFailure] = useState<MountFailure | null>(null);
  const isSearchable = projects.length > SEARCH_THRESHOLD;
  const filtered = useMemo(
    () => projects.filter((project) => project.name.toLowerCase().includes(query.toLowerCase())),
    [projects, query],
  );
  const isGrouped =
    query.trim() === '' &&
    shouldGroupStarred({
      starredCount: projects.filter((project) => project.starredAt !== undefined).length,
      total: projects.length,
    });
  const groups = useMemo(() => {
    if (!isGrouped) {
      return [{ key: 'all', label: null, projects: filtered }];
    }
    const starred = filtered.filter((project) => project.starredAt !== undefined);
    const others = filtered.filter((project) => project.starredAt === undefined);
    return [
      { key: 'starred', label: 'Starred', projects: starred },
      { key: 'other', label: 'Other projects', projects: others },
    ].filter((group) => group.projects.length > 0);
  }, [filtered, isGrouped]);
  const selectedProject = projectById(projects, selectedProjectId) ?? null;
  const preflightState = useMountPreflight({ sessionId, project: selectedProject });

  const mountProject = async ({ project }: { readonly project: Project }) => {
    const { preflight } = preflightState;
    setIsMounting(true);
    setFailure(null);
    try {
      await ensureProjectMounted({
        sessionId,
        projectId: project.id,
        reason: MANUAL_REASON,
        ...(preflight === null
          ? {}
          : {
              mountId: preflight.mountId,
              slug: preflight.slug,
              ...(preflight.branch === null ? {} : { branch: preflight.branch }),
            }),
      });
      setQuery('');
      setSelectedProjectId(null);
      onDone();
    } catch (error) {
      setFailure(mountFailure({ error, project, preflight }));
      void emitNotification({
        kind: 'error',
        severity: 'warning',
        title: "Couldn't add the project",
        body: formatError(error),
        sessionId,
        workspaceId: project.workspaceId,
      });
    } finally {
      setIsMounting(false);
    }
  };

  if (selectedProject !== null) {
    return (
      <MountPreflightCard
        project={selectedProject}
        state={preflightState}
        isBusy={isMounting}
        failure={failure}
        onConfirm={() => void mountProject({ project: selectedProject })}
        onCancel={() => {
          setFailure(null);
          setSelectedProjectId(null);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col">
      {isSearchable ? (
        <input
          type="text"
          value={query}
          aria-label="Search projects"
          placeholder="Search projects…"
          autoComplete="off"
          onChange={(event) => setQuery(event.target.value)}
          className="border-b border-border-soft bg-transparent px-3 py-2 text-body text-foreground outline-none placeholder:text-faint-foreground"
        />
      ) : null}
      {filtered.length === 0 ? (
        <EmptyLine className="px-3">No matching projects</EmptyLine>
      ) : (
        <ScrollFade className="max-h-56" viewportClassName="py-0.5" fadeFrom="subtle">
          <div className="flex flex-col">
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
                          aria-label={`Add ${project.name}`}
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
                              aria-hidden
                              className="shrink-0 fill-current text-warning"
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
        </ScrollFade>
      )}
    </div>
  );
};
