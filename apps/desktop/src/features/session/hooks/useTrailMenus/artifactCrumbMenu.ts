import type { CrumbMenuModel } from '@goodboy/ui';
import { openLens } from '../../openLens';
import { formatAge } from '../../../../shared/utils/time/formatAge';
import { artifactFolderName } from '../../../artifacts/artifactFolderName';
import {
  locateArtifactMirror,
  revealArtifactMirror,
} from '../../../artifacts/artifactMirror/artifactMirrorInvoke';
import { artifactEntryOf, artifactMenu } from '../../trail/menus/artifactMenu';
import { savedCopyActions } from '../../trail/menus/crumbActions';
import type { TrailMenuScope } from './trailMenuScope';

export const artifactCrumbMenu = (scope: TrailMenuScope): CrumbMenuModel | null => {
  const { sessionId, artifacts, phaseRuns, focusedArtifactId, workspaceSlug, reportError, copy } =
    scope;
  if (artifacts.length === 0) {
    return null;
  }
  const nowMs = Date.now();
  const focused = artifacts.find((artifact) => artifact.id === focusedArtifactId);
  return artifactMenu({
    artifacts: artifacts
      .filter((artifact) => artifact.status !== 'discarded')
      .map((artifact) =>
        artifactEntryOf({
          artifact,
          author: (() => {
            const author = phaseRuns.find((agent) => agent.id === artifact.agentId);
            return author === undefined ? null : scope.roleOf(author).label;
          })(),
        }),
      ),
    currentId: focusedArtifactId,
    ageOf: (iso) => formatAge({ from: iso, now: nowMs }),
    actions:
      focused === undefined
        ? []
        : savedCopyActions({
            hasWorkspace: workspaceSlug !== null,
            onReveal: () => {
              if (workspaceSlug === null) {
                return;
              }
              void revealArtifactMirror({
                workspaceSlug,
                folder: artifactFolderName({ artifact: focused }),
              }).catch((error: unknown) =>
                reportError({ title: "Couldn't show the saved copy", error, sessionId }),
              );
            },
            onCopyPath: () => {
              if (workspaceSlug === null) {
                return;
              }
              void locateArtifactMirror({
                workspaceSlug,
                folder: artifactFolderName({ artifact: focused }),
              })
                .then((location) => copy({ text: location.path }))
                .catch((error: unknown) =>
                  reportError({ title: "Couldn't copy the path", error, sessionId }),
                );
            },
          }),
    onSelect: (id) => {
      scope.setFocusedArtifactId(sessionId, id);
      openLens({ sessionId, lens: 'plans' });
    },
  });
};
