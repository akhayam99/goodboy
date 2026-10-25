import { Info } from 'lucide-react';
import { ChoiceCards, ICON_SIZE, tintClasses } from '@goodboy/ui';
import { folderName } from '../../../store/slices/terminal/terminalOwner';
import type { RepositoryFolder, RepositoryScope } from './folderEntry';
import type { WorkspaceDraft } from './useWorkspaceDraft';

type Props = {
  readonly folder: RepositoryFolder;
  readonly snappedFrom: string;
  readonly draft: WorkspaceDraft;
  readonly isBusy: boolean;
};

export const InsideRepositoryChoice = ({ folder, snappedFrom, draft, isBusy }: Props) => {
  const inner = folderName({ path: snappedFrom }) ?? snappedFrom;
  const choose = (scope: RepositoryScope) => {
    if (!isBusy) {
      draft.setScope({ path: folder.path, scope });
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-muted p-3 text-meta text-muted-foreground motion-safe:animate-fade-in">
      <p className="flex items-start gap-2">
        <span className="flex h-5 shrink-0 items-center">
          <Info size={ICON_SIZE.row} aria-hidden className={tintClasses('info').icon} />
        </span>
        <span className="min-w-0">
          <span className="text-foreground">
            {inner} is inside the git repository {folder.name}.
          </span>{' '}
          Pick what agents work on.
        </span>
      </p>
      <ChoiceCards
        ariaLabel={`What agents work on in ${inner}`}
        options={[
          {
            value: 'repository',
            label: 'The whole repository',
            hint: `${folder.name}, on its own branch per session. Pull requests when you push.`,
          },
          {
            value: 'folder',
            label: 'Only this folder',
            hint: `Only ${inner}, as documents, edited in place. Every change can be restored.`,
          },
        ]}
        value={folder.scope}
        onChange={choose}
        isHintWrapped
        className="sm:grid-cols-2"
      />
    </div>
  );
};
