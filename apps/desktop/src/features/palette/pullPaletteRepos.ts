import type { Project } from '@goodboy/types';
import type { useToast } from '../../shared/components/Toast';
import { useAppStore } from '../../store';
import { CHECK_STATE } from '../../store/slices/notifications/errorRecovery';
import { pullBaseInRepos } from '../workspace/pullBase/pullBaseInRepos';
import { pullBaseSummary } from '../workspace/pullBase/pullBaseSummary';

type Params = {
  readonly projects: ReadonlyArray<Project>;
  readonly showToast: ReturnType<typeof useToast>['showToast'];
};

export const pullPaletteRepos = ({ projects: repos, showToast }: Params): void => {
  const { reportError } = useAppStore.getState();
  showToast({
    kind: 'info',
    title: `Pulling in ${repos.length} ${repos.length === 1 ? 'repo' : 'repos'}…`,
    message: repos.map((repo) => repo.name).join(', '),
    dedupeKey: 'pull-base',
  });
  void pullBaseInRepos({ projects: repos })
    .then((outcomes) => {
      const summary = pullBaseSummary({ outcomes });
      showToast({
        kind: summary.kind,
        title: summary.title,
        message: summary.lines.join('\n'),
        dedupeKey: 'pull-base',
      });
      for (const outcome of outcomes) {
        if (outcome.kind === 'updated') {
          void useAppStore.getState().loadProjectGitStatus({ projectId: outcome.projectId });
        }
      }
    })
    .catch((error: unknown) =>
      reportError({ recovery: CHECK_STATE, title: "Couldn't pull the base branch", error }),
    );
};
