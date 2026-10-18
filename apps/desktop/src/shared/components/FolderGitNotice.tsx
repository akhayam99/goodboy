import { useState } from 'react';
import { Button, Notice, formatError } from '@goodboy/ui';
import type { Project } from '@goodboy/types';
import { useAppStore } from '../../store';
import type { FolderGitNotice as Found } from '../../store/slices/folder-purpose/state';
import { pluralize } from '../utils/pluralize';
import { formatClock } from '../utils/time/formatClock';

type Props = {
  readonly project: Project;
  readonly notice: Found;
};

type Choice = {
  readonly label: string;
  readonly run: () => Promise<void> | void;
};

type ChooseParams = {
  readonly choice: Choice;
};

type Copy = {
  readonly title: string;
  readonly body: string;
  readonly primary: Choice;
  readonly secondary: Choice;
};

export const FolderGitNotice = ({ project, notice }: Props) => {
  const projectId = project.id;
  const dismiss = useAppStore((state) => state.dismissFolderGitNotice);
  const keepInPlace = useAppStore((state) => state.keepFolderInPlace);
  const switchToRepo = useAppStore((state) => state.switchFolderToRepo);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const at = formatClock({ at: notice.foundAt });

  const copyOf = (): Copy => {
    switch (notice.kind) {
      case 'above':
        return {
          title: `${project.name} is inside a git repository.`,
          body: `The repository is at ${notice.rootPath}. Use it, or keep editing only this folder.`,
          primary: { label: 'Use the repository', run: () => switchToRepo({ projectId }) },
          secondary: { label: 'Keep only this folder', run: () => keepInPlace({ projectId }) },
        };
      case 'ask':
        return {
          title: `Goodboy found git in ${project.name}.`,
          body: 'Keep it as documents, or make it a code project with branches.',
          primary: { label: 'Keep as documents', run: () => keepInPlace({ projectId }) },
          secondary: { label: 'Switch to code project', run: () => switchToRepo({ projectId }) },
        };
      case 'switched': {
        const commits = pluralize(notice.commitCount, 'commit');
        const branch = notice.branch ?? 'its branch';
        return {
          title: `${project.name} is now a git repository.`,
          body: `Set up outside the app, with ${commits} on ${branch}. Found at ${at}.`,
          primary: { label: 'Got it', run: () => dismiss({ projectId }) },
          secondary: { label: 'Keep editing in place', run: () => keepInPlace({ projectId }) },
        };
      }
      default: {
        const exhaustive: never = notice;
        return exhaustive;
      }
    }
  };
  const copy = copyOf();

  const choose = async ({ choice }: ChooseParams) => {
    setBusy(choice.label);
    setError(null);
    try {
      await choice.run();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Notice
      tone="info"
      placement="inline"
      role="status"
      title={copy.title}
      body={copy.body}
      detail={error}
      actions={
        <>
          <Button
            size="xs"
            variant="secondary"
            disabled={busy !== null}
            aria-busy={busy === copy.primary.label}
            onClick={() => void choose({ choice: copy.primary })}
          >
            {copy.primary.label}
          </Button>
          <Button
            size="xs"
            variant="ghost"
            disabled={busy !== null}
            aria-busy={busy === copy.secondary.label}
            onClick={() => void choose({ choice: copy.secondary })}
          >
            {copy.secondary.label}
          </Button>
        </>
      }
    />
  );
};
