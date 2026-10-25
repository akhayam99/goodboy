import { useId } from 'react';
import { Button, Input } from '@goodboy/ui';
import type { NewProjectModel } from '../../hooks/useNewProject';
import { nameFromFolder } from '../../../features/workspace/nameFromFolder';
import { tildePath } from './tildePath';

type Props = {
  readonly scratch: NewProjectModel;
  readonly isBusy: boolean;
};

export const ScratchFields = ({ scratch, isBusy }: Props) => {
  const nameId = useId();
  const problemId = useId();
  const locationId = useId();
  const location =
    scratch.parent === null ? null : tildePath({ path: scratch.parent, home: scratch.home });
  const created =
    scratch.folderPath === null || scratch.nameProblem !== null
      ? null
      : tildePath({ path: scratch.folderPath, home: scratch.home });

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-subtle p-4 ring-1 ring-inset ring-border-soft">
      <div className="flex flex-col gap-2">
        <label htmlFor={nameId} className="text-meta text-muted-foreground">
          Folder name
        </label>
        <Input
          id={nameId}
          size="md"
          value={scratch.name}
          disabled={isBusy}
          autoFocus
          spellCheck={false}
          placeholder="acme-api"
          aria-invalid={scratch.nameProblem !== null}
          aria-describedby={scratch.nameProblem === null ? undefined : problemId}
          onChange={(event) => scratch.setName(event.target.value)}
          className="text-ui"
        />
        {scratch.nameProblem === null ? null : (
          <p id={problemId} className="text-meta text-danger">
            {scratch.nameProblem}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <span id={locationId} className="text-meta text-muted-foreground">
          Location
        </span>
        <div
          aria-labelledby={locationId}
          className="flex h-8 items-center gap-2 rounded-md border border-border bg-background pl-3 pr-1"
        >
          <span className="min-w-0 flex-1 truncate text-code text-foreground">
            {location ?? 'Choose where the folder goes'}
          </span>
          <Button
            variant="ghost"
            size="xs"
            disabled={isBusy}
            onClick={() => void scratch.changeParent()}
          >
            Change
          </Button>
        </div>
      </div>
      <p className="text-meta text-faint-foreground">
        {created === null ? (
          'A new folder with git on main and a first commit.'
        ) : (
          <>
            Creates <span className="text-code text-muted-foreground">{created}</span> with git on
            main, and a workspace called {nameFromFolder({ path: created })}.
          </>
        )}
      </p>
    </div>
  );
};
