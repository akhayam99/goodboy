import type { ReactNode } from 'react';
import { SquareArrowOutUpRight, FolderOpen, Unplug } from 'lucide-react';
import type { Project } from '@goodboy/types';
import { Button, CopyButton, ICON_SIZE } from '@goodboy/ui';
import { useAppStore } from '../../../store';
import { openInEditor } from '../../lib/editor';
import { resolveEditorBinary } from '../../lib/editorSettings';
import { revealInFileManager } from '../../lib/reveal';

import { NAMES } from '../../utils/names';
import { BaseBranchSelect } from '../../../features/worktree/BaseBranchSelect';
import { commitBaseBranch } from '../../../features/worktree/commitBaseBranch';
import { ProjectAfterMergeField } from './ProjectAfterMergeField';
import { ProjectDescriptionField } from './ProjectDescriptionField';
import { OPEN_APP_SETTINGS_GENERAL } from '../../../store/slices/notifications/errorRecovery';

type Props = {
  readonly project: Project;
  readonly busy: boolean;
  readonly onUnlink: () => void;
  readonly ignoreField?: ReactNode;
  readonly scriptsField?: ReactNode;
};

export const ProjectRowEditor = ({ project, busy, onUnlink, ignoreField, scriptsField }: Props) => {
  const reportError = useAppStore((state) => state.reportError);
  const editor = useAppStore((state) => resolveEditorBinary({ settings: state.settings }));
  const updateProjectBaseBranch = useAppStore((state) => state.updateProjectBaseBranch);
  const isRepo = project.kind === 'repo';

  const openProject = async () => {
    try {
      await openInEditor({ path: project.rootPath, editor });
    } catch (error) {
      void reportError({
        title: `Couldn't open ${project.name}`,
        error,
        recovery: OPEN_APP_SETTINGS_GENERAL,
      });
    }
  };

  const reveal = async () => {
    try {
      await revealInFileManager({ path: project.rootPath });
    } catch (error) {
      void reportError({ title: `Couldn't reveal ${project.name}`, error });
    }
  };

  const commitBranch = async (candidate: string | null) => {
    try {
      await commitBaseBranch({
        projectId: project.id,
        currentBaseBranch: project.baseBranch ?? null,
        candidate,
        updateProjectBaseBranch,
      });
    } catch (error) {
      void reportError({ title: `Couldn't update the base branch of ${project.name}`, error });
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-subtle p-3">
      <div className="flex flex-col gap-1">
        <span className="text-meta text-muted-foreground">Description</span>
        <ProjectDescriptionField project={project} busy={busy} />
      </div>
      {isRepo ? (
        <div className="flex flex-col gap-1">
          <span className="text-meta text-muted-foreground">Base branch</span>
          <BaseBranchSelect
            repoPath={project.rootPath}
            value={project.baseBranch ?? null}
            disabled={busy}
            onCommit={(candidate) => void commitBranch(candidate)}
          />
        </div>
      ) : null}
      {isRepo ? <ProjectAfterMergeField project={project} busy={busy} /> : null}
      <div className="flex flex-col gap-1">
        <span className="text-meta text-muted-foreground">Folder</span>
        <span className="min-w-0 truncate text-code text-meta">{project.rootPath}</span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => void reveal()} disabled={busy}>
            <FolderOpen size={ICON_SIZE.row} aria-hidden />
            Show in Finder
          </Button>
          <CopyButton value={project.rootPath} label="path" />
        </div>
        {ignoreField}
      </div>
      {scriptsField}
      <div className="flex items-center justify-between">
        <Button variant="secondary" size="sm" onClick={() => void openProject()} disabled={busy}>
          <SquareArrowOutUpRight size={ICON_SIZE.row} aria-hidden />
          Open in editor
        </Button>
        <Button variant="ghost" size="sm" onClick={onUnlink} disabled={busy}>
          <Unplug size={ICON_SIZE.row} aria-hidden />
          {NAMES.removeLink}
        </Button>
      </div>
    </div>
  );
};
