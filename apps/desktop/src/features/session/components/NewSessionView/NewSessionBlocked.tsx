import { GitBranch } from 'lucide-react';
import { Button, Divider, ScrollFade } from '@goodboy/ui';
import type { WorkspaceGitStatus } from '@goodboy/types';
import { OverlayHeader } from '../../../../shared/components/OverlayHeader';
import { WorkspaceGitPanel } from '../../../workspace/components/WorkspaceGitPanel';

type Props = {
  readonly rootPath: string;
  readonly status: WorkspaceGitStatus;
  readonly onClose: () => void;
};

export const NewSessionBlocked = ({ rootPath, status, onClose }: Props) => {
  return (
    <div className="flex h-full w-full items-center justify-center bg-background py-6 motion-safe:animate-studio-in">
      <div className="flex h-full max-h-full w-full max-w-2xl flex-col overflow-hidden">
        <OverlayHeader
          icon={GitBranch}
          title="A session needs a repository first"
          subtitle={rootPath}
          onClose={onClose}
          closeLabel="close new session"
        />
        <Divider />
        <ScrollFade className="min-h-0 flex-1" viewportClassName="px-6 py-5" fadeSize={24}>
          <div className="flex flex-col gap-4">
            <p className="text-xs leading-relaxed text-muted-foreground">
              Goodboy gives every session its own git worktree and branch, so this project cannot
              start one yet. Run the commands below yourself and this form opens on its own.
            </p>
            <Divider />
            <WorkspaceGitPanel rootPath={rootPath} status={status} />
          </div>
        </ScrollFade>
        <Divider />
        <footer className="flex items-center justify-end gap-2 px-6 py-4">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </footer>
      </div>
    </div>
  );
};
