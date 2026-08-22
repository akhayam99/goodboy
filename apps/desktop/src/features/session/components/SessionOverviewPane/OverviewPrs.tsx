import { GitPullRequest } from 'lucide-react';
import { Chip, Eyebrow } from '@goodboy/ui';
import type { PullRequestStateKind, Session, SessionProjectMount } from '@goodboy/types';
import type { LensKind } from '../../../../store';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';

type Props = {
  readonly session: Session;
  readonly onSelectLens: (lens: LensKind) => void;
};

const STATE_TONE: Readonly<
  Record<PullRequestStateKind, 'success' | 'accent' | 'neutral' | 'danger'>
> = {
  draft: 'neutral',
  open: 'success',
  approved: 'success',
  queued: 'accent',
  merged: 'accent',
  closed: 'danger',
};

export const OverviewPrs = ({ session, onSelectLens }: Props) => {
  const projectPrs = useAppStore((s) => s.sessionProjectPrs[session.id]);
  const mounts = useAppStore(
    (s) =>
      s.sessionProjectMounts[session.id] ?? (EMPTY_ARRAY as ReadonlyArray<SessionProjectMount>),
  );
  const setSessionActiveProject = useAppStore((s) => s.setSessionActiveProject);

  const groups = mounts.flatMap((mount) => {
    const prs = projectPrs?.[mount.projectId] ?? [];
    return prs.length === 0 ? [] : [{ mount, prs }];
  });
  if (groups.length === 0) {
    return null;
  }
  const showProjectNames = mounts.length > 1;

  return (
    <section aria-label="Pull requests" className="flex flex-col gap-2">
      <Eyebrow label="Pull requests" />
      <div className="flex flex-col gap-2">
        {groups.map(({ mount, prs }) => (
          <div key={mount.projectId} className="flex flex-col gap-1">
            {showProjectNames ? (
              <span className="text-xs font-medium text-muted-foreground">{mount.mountName}</span>
            ) : null}
            <ul className="flex flex-col gap-1">
              {prs.map((pr) => (
                <li key={pr.number}>
                  <button
                    type="button"
                    onClick={() => {
                      setSessionActiveProject({
                        sessionId: session.id,
                        projectId: mount.projectId,
                      });
                      onSelectLens('pr');
                    }}
                    className="flex w-full items-center gap-2 rounded-lg border-l-2 border-border-soft px-3 py-1.5 text-left hover:bg-muted/40"
                  >
                    <GitPullRequest
                      size={13}
                      aria-hidden
                      className="shrink-0 text-muted-foreground"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                      {pr.title}
                    </span>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      #{pr.number}
                    </span>
                    <Chip
                      tone={STATE_TONE[pr.state]}
                      size="3xs"
                      bordered={false}
                      label={pr.isDraft && pr.state === 'open' ? 'draft' : pr.state}
                    />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
};
