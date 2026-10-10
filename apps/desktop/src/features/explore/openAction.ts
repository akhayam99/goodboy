import type { DetectedEditor } from '../../shared/lib/editor';
import type { ExploreFileKind } from './fileKindOf';

type Params = {
  readonly projectKind: 'repo' | 'folder';
  readonly hasGit: boolean;
  readonly fileKind: ExploreFileKind;
  readonly editor: DetectedEditor | null;
};

export type ExploreOpenAction = {
  readonly label: 'Open in editor' | 'Open';
  readonly tooltip: string;
  readonly editor: DetectedEditor | null;
};

const DEFAULT_APP_ACTION: ExploreOpenAction = {
  label: 'Open',
  tooltip: 'Open with the default app',
  editor: null,
};

export const openActionOf = ({
  projectKind,
  hasGit,
  fileKind,
  editor,
}: Params): ExploreOpenAction => {
  if (projectKind !== 'repo' || !hasGit || fileKind !== 'text' || editor === null) {
    return DEFAULT_APP_ACTION;
  }
  return { label: 'Open in editor', tooltip: `Open in ${editor.label}`, editor };
};
