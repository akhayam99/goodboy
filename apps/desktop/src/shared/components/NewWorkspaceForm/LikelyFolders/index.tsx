import { Checkbox } from '@goodboy/ui';
import type { LikelyFolders as LikelyFoldersModel } from '../useLikelyFolders';

type Props = {
  readonly likely: LikelyFoldersModel;
  readonly isBusy: boolean;
};

export const LikelyFolders = ({ likely, isBusy }: Props) => {
  if (likely.folders.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-meta text-faint-foreground">
        Or tick where your code lives, then press the Look in button.
      </p>
      <ul
        aria-label="Likely folders"
        className="flex flex-col gap-0.5 overflow-hidden rounded-lg ring-1 ring-border-soft"
      >
        {likely.folders.map((folder) => (
          <li
            key={folder.path}
            className="flex min-h-10 items-center gap-3 bg-subtle py-2 pl-4 pr-3 hover:bg-hover"
          >
            <Checkbox
              checked={likely.ticked.includes(folder.path)}
              disabled={isBusy}
              ariaLabel={`Look in ${folder.label}`}
              onChange={() => likely.toggle({ path: folder.path })}
            />
            <span className="truncate text-code text-foreground">{folder.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
