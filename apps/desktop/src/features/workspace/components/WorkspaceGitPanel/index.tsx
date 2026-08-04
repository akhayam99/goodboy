import { AlertTriangle } from 'lucide-react';
import type { WorkspaceGitStatus } from '@goodboy/types';
import { InitGuide } from './InitGuide';
import { MainStatus } from './MainStatus';

type Props = {
  readonly rootPath: string;
  readonly status: WorkspaceGitStatus;
};

export const WorkspaceGitPanel = ({ rootPath, status }: Props) => {
  if (status.state === 'missing') {
    return (
      <section
        aria-label="Project folder missing"
        className="flex items-start gap-2 text-xs leading-relaxed text-danger"
      >
        <AlertTriangle size={13} aria-hidden className="shrink-0" />
        <span>
          Goodboy cannot reach <span className="font-mono text-2xs">{rootPath}</span>. Reconnect the
          workspace once the folder is back.
        </span>
      </section>
    );
  }
  if (status.state === 'ready') {
    return <MainStatus rootPath={rootPath} status={status} />;
  }
  return <InitGuide rootPath={rootPath} state={status.state} />;
};
