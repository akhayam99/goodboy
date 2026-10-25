import { useState } from 'react';
import { Upload } from 'lucide-react';
import { Button, formatError, ICON_SIZE, Notice } from '@goodboy/ui';
import type { ProjectId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { projectById } from '../../../../store/slices/projects/projectIndex';
import { projectGlyph } from '../../../../shared/components/conceptIcons';
import { PublishPanel } from '../../../bootstrap/PublishPanel';
import { FolderGitChips } from './FolderGitChips';
import { FolderGitNotice } from '../../../../shared/components/FolderGitNotice';
import { folderGitRowOf } from './folderGitRowOf';
import { folderGitSubline } from './folderGitSubline';
import { TrackWithGitFlow } from './index';

type Props = {
  readonly projectId: ProjectId;
  readonly isInitiallyOpen: boolean;
};

type Mode = 'idle' | 'review' | 'publish' | 'tracked' | 'published';

export const FolderGitCard = ({ projectId, isInitiallyOpen }: Props) => {
  const project = useAppStore((state) => projectById(state.projects, projectId) ?? null);
  const probe = useAppStore((state) => state.folderGit[projectId] ?? null);
  const notice = useAppStore((state) => state.folderGitNotice[projectId] ?? null);
  const choice = useAppStore((state) => state.folderGitChoice[projectId] ?? null);
  const purpose = useAppStore((state) => state.folderPurpose[projectId] ?? null);
  const isFirstLap = useAppStore((state) => {
    const stage = state.bootstrapPhase[projectId]?.stage;
    return stage === 'first-lap' || stage === 'moving';
  });
  const probeFolderGit = useAppStore((state) => state.probeFolderGit);
  const switchFolderToRepo = useAppStore((state) => state.switchFolderToRepo);
  const reportError = useAppStore((state) => state.reportError);
  const [mode, setMode] = useState<Mode>(isInitiallyOpen ? 'review' : 'idle');
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (project === null) {
    return null;
  }
  const row = folderGitRowOf({ project, purpose, probe, choice, notice, isFirstLap });
  const isReviewing = mode === 'review' && (row === 'no-git' || row === 'no-commits');
  const Glyph = projectGlyph({ kind: project.kind });

  const switchToRepo = async () => {
    setIsBusy(true);
    setError(null);
    try {
      await switchFolderToRepo({ projectId });
    } catch (err) {
      setError(formatError(err));
    } finally {
      setIsBusy(false);
    }
  };

  const refresh = () => {
    void probeFolderGit({ projectId }).catch((err: unknown) =>
      reportError({
        title: `Couldn't check git in ${project.name}`,
        error: err,
        severity: 'warning',
      }),
    );
  };

  const tail = (() => {
    if (row === 'no-git' && !isReviewing) {
      return (
        <Button size="xs" variant="secondary" onClick={() => setMode('review')}>
          Track with git
        </Button>
      );
    }
    if (row === 'no-commits' && !isReviewing) {
      return (
        <Button size="xs" variant="secondary" onClick={() => setMode('review')}>
          Make the first commit
        </Button>
      );
    }
    if (row === 'in-place' || (row === 'inside' && notice === null)) {
      return (
        <Button
          size="xs"
          variant="secondary"
          disabled={isBusy}
          aria-busy={isBusy}
          onClick={() => void switchToRepo()}
        >
          {row === 'inside' ? 'Use the repository' : 'Work on branches'}
        </Button>
      );
    }
    if (row === 'local' && mode !== 'publish') {
      return (
        <Button size="xs" variant="secondary" onClick={() => setMode('publish')}>
          <Upload size={ICON_SIZE.row} aria-hidden />
          Publish to GitHub
        </Button>
      );
    }
    return null;
  })();

  return (
    <div
      role="group"
      aria-label={`${project.name}, git`}
      className="flex flex-col gap-2 rounded-md bg-background py-2 pl-4 pr-3"
    >
      {notice === null ? null : <FolderGitNotice project={project} notice={notice} />}
      {row === 'hidden' ? null : (
        <div className="flex min-h-9 items-center gap-3">
          <Glyph size={ICON_SIZE.hero} aria-hidden className="shrink-0 text-muted-foreground" />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="flex min-w-0 items-center gap-2 text-row text-foreground">
              <span className="truncate">{project.name}</span>
              <FolderGitChips row={row} branch={probe?.branch ?? null} />
            </span>
            <span className="truncate text-code text-faint-foreground">{project.rootPath}</span>
            {isReviewing ? null : (
              <span className="text-meta text-faint-foreground">
                {folderGitSubline({ row, probe })}
              </span>
            )}
          </div>
          {tail}
        </div>
      )}
      {error === null ? null : (
        <span role="alert" className="text-meta text-danger">
          {error}
        </span>
      )}
      {isReviewing ? (
        <TrackWithGitFlow
          project={project}
          onCancel={() => setMode('idle')}
          onTracked={() => {
            setMode('tracked');
            refresh();
          }}
        />
      ) : null}
      {mode === 'tracked' && row === 'local' ? (
        <Notice
          tone="success"
          placement="inline"
          role="status"
          title={`${project.name} is tracked with git.`}
          body={`New sessions get their own branch from ${probe?.branch ?? 'main'}. Publish for pull requests.`}
        />
      ) : null}
      {mode === 'publish' && row === 'local' ? (
        <PublishPanel
          project={project}
          primaryLabel="Publish to GitHub"
          onPublished={() => {
            setMode('published');
            refresh();
          }}
          onCancel={() => setMode('idle')}
        />
      ) : null}
      {mode === 'published' ? (
        <Notice
          tone="success"
          placement="inline"
          role="status"
          title={`${project.name} is published.`}
          body="Pull requests are available from the next session on."
        />
      ) : null}
    </div>
  );
};
