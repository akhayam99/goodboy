import { useCallback } from 'react';
import type { TerminalFileLink } from '../../../../shared/components/GenericTerminalPanel/fileLinkProvider';
import type { TerminalTab } from '../../../../shared/types/terminal';
import { useAppStore } from '../../../../store';
import { selectWritableMounts } from '../../../../store/slices/project-mounts/selectors';
import { openFileLink } from '../../../explore/openFileLink';

type Params = {
  readonly tab: TerminalTab;
};

export const useTerminalFileLinks = ({
  tab,
}: Params): ((link: TerminalFileLink) => void) | undefined => {
  const sessionId = tab.owner.kind === 'session' ? tab.owner.sessionId : null;
  const cwd = tab.cwd;
  const root = useAppStore((state): string | null => {
    const mounts = sessionId === null ? [] : selectWritableMounts({ state, sessionId });
    const byId = mounts.find((mount) => mount.mountId === tab.mountId);
    const byCwd = mounts.find(
      (mount) =>
        mount.worktreePath !== '' &&
        cwd !== null &&
        (cwd === mount.worktreePath || cwd.startsWith(`${mount.worktreePath}/`)),
    );
    return byId?.worktreePath ?? byCwd?.worktreePath ?? cwd;
  });

  return useCallback(
    (link: TerminalFileLink): void => {
      if (root === null) {
        return;
      }
      void openFileLink({ sessionId, root, baseDir: cwd ?? root, link });
    },
    [cwd, root, sessionId],
  );
};
