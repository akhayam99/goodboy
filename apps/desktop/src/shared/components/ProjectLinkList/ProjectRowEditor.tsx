import type { ReactNode } from 'react';
import { ExternalLink, FolderOpen, Unplug } from 'lucide-react';
import type { Project } from '@goodboy/types';
import { Button, CopyButton } from '@goodboy/ui';
import { useAppStore } from '../../../store';
import { openInEditor } from '../../lib/editor';
import { resolveEditorBinary } from '../../lib/editorSettings';
import { revealInFileManager } from '../../lib/reveal';
import { formatSpan } from '../../utils/time/formatSpan';
import { ICON_SIZE } from '../conceptIcons';
import { NAMES } from '../../names';
import { BaseBranchSelect } from '../../../features/worktree/BaseBranchSelect';
import { commitBaseBranch } from '../../../features/worktree/commitBaseBranch';
import { ProjectAfterMergeField } from './ProjectAfterMergeField';
import { ProjectDescriptionField } from './ProjectDescriptionField';
import { useNow } from '../../hooks/useNow';

type Props = {
  readonly project: Project;
  readonly busy: boolean;
  readonly onArmUnlink: () => void;
  readonly ignoreField?: ReactNode;
};

export const ProjectRowEditor = ({ project, busy, onArmUnlink, ignoreField }: Props) => {
  const now = useNow(30_000);
  const reportError = useAppStore((state) => state.reportError);
  const editor = useAppStore((state) => resolveEditorBinary({ settings: state.settings }));
  const updateProjectBaseBranch = useAppStore((state) => state.updateProjectBaseBranch);
  const isRepo = project.kind === 'repo';
  const linkedLabel = project.createdAt ? formatSpan({ from: project.createdAt, to: now }) : '';

  const openProject = async () => {
    try {
      await openInEditor({ path: project.rootPath, editor });
    } catch (error) {
      void reportError({ title: `Couldn't open ${project.name}`, error });
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
        <span className="text-label text-muted-foreground">Description</span>
        <ProjectDescriptionField project={project} busy={busy} />
      </div>
      {isRepo ? (
        <div className="flex flex-col gap-1">
          <span className="text-label text-muted-foreground">Base branch</span>
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
        <span className="text-label text-muted-foreground">Folder</span>
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-code text-meta">{project.rootPath}</span>
          <Button variant="ghost" size="sm" onClick={() => void reveal()} disabled={busy}>
            <FolderOpen size={ICON_SIZE.row} aria-hidden />
            Show in Finder
          </Button>
          <CopyButton value={project.rootPath} label="path" />
        </div>
        {ignoreField}
      </div>
      <span className="text-label text-faint-foreground">
        {isRepo ? 'Repository' : 'Folder'}
        {linkedLabel !== '' ? ` · linked ${linkedLabel}` : ''}
      </span>
      <div className="flex items-center justify-between">
        <Button variant="secondary" size="sm" onClick={() => void openProject()} disabled={busy}>
          <ExternalLink size={ICON_SIZE.row} aria-hidden />
          Open in editor
        </Button>
        <Button variant="ghost" size="sm" onClick={onArmUnlink} disabled={busy}>
          <Unplug size={ICON_SIZE.row} aria-hidden />
          {NAMES.removeLink}
        </Button>
      </div>
    </div>
  );
};
