import { Lock } from 'lucide-react';
import { Button, ICON_SIZE, ICON_STROKE, StatusDot } from '@goodboy/ui';
import { useAppStore } from '../../../store';
import { openPrivacySettings } from '../../lib/privacySettings';
import { currentPlatform } from '../../platform';
import type { FolderProblem, UnreadableFolder } from './folderEntry';
import { FolderNotice } from './FolderNotice';
import type { FolderRowContext } from './folderRowContext';
import { FolderRowFrame } from './FolderRowFrame';
import { tildePath } from './tildePath';

type Props = FolderRowContext & {
  readonly folder: UnreadableFolder;
};

const STATUS_LABEL = {
  permission_denied: "Can't read",
  not_found: 'Not found',
  not_a_directory: 'Not a folder',
  git_failed: "Can't read",
} as const satisfies Record<FolderProblem, string>;

const PROTECTED_FOLDERS: ReadonlyArray<string> = ['Desktop', 'Documents', 'Downloads'];

type PlaceParams = {
  readonly shown: string;
};

const protectedPlace = ({ shown }: PlaceParams): string => {
  const top = shown.startsWith('~/') ? shown.slice(2).split('/')[0] : undefined;
  return top !== undefined && PROTECTED_FOLDERS.includes(top)
    ? `your ${top} folder`
    : 'this folder';
};

export const UnreadableFolderRow = ({ folder, draft, home, isBusy, lead, trailing }: Props) => {
  const reportError = useAppStore((state) => state.reportError);
  const shown = tildePath({ path: folder.path, home });
  const retry = (
    <Button
      variant="ghost"
      size="xs"
      disabled={isBusy}
      onClick={() => void draft.retry({ pick: folder.pick, path: folder.path })}
    >
      Retry
    </Button>
  );
  const another = (
    <Button
      variant="ghost"
      size="xs"
      disabled={isBusy}
      onClick={() => void draft.chooseAnother({ pick: folder.pick })}
    >
      Choose another folder
    </Button>
  );
  const notice = (() => {
    switch (folder.problem) {
      case 'permission_denied':
        return (
          <FolderNotice
            tone="danger"
            title={`Goodboy can't read ${shown}.`}
            body={`Access to ${protectedPlace({ shown })} was turned down in macOS.`}
            actions={
              <>
                {currentPlatform() !== 'darwin' ? null : (
                  <Button
                    variant="secondary"
                    size="xs"
                    disabled={isBusy}
                    onClick={() =>
                      void openPrivacySettings().catch((error: unknown) =>
                        reportError({ title: "Couldn't open Privacy settings", error }),
                      )
                    }
                  >
                    Open Privacy settings
                  </Button>
                )}
                {retry}
                {another}
              </>
            }
          />
        );
      case 'not_found':
        return (
          <FolderNotice
            tone="danger"
            title={`Goodboy can't find ${shown}.`}
            body="It may have moved or been deleted."
            actions={
              <>
                {retry}
                {another}
              </>
            }
          />
        );
      case 'not_a_directory':
        return (
          <FolderNotice
            tone="danger"
            title={`${folder.name} is a file, not a folder.`}
            actions={another}
          />
        );
      case 'git_failed':
        return (
          <FolderNotice
            tone="danger"
            title={`git couldn't read ${folder.name}.`}
            body={folder.detail ?? undefined}
            actions={
              <>
                {retry}
                {another}
              </>
            }
          />
        );
      default: {
        const unreachable: never = folder.problem;
        return unreachable;
      }
    }
  })();
  return (
    <FolderRowFrame
      name={folder.name}
      path={shown}
      icon={<Lock size={ICON_SIZE.hero} strokeWidth={ICON_STROKE.hero} aria-hidden />}
      lead={lead}
      trailing={trailing}
      meta={
        <span className="flex items-center gap-2 text-meta text-muted-foreground">
          <StatusDot tone="danger" size="sm" />
          {STATUS_LABEL[folder.problem]}
        </span>
      }
      notice={notice}
    />
  );
};
