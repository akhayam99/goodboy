import { useState } from 'react';
import { Button, FormActions, Input } from '@goodboy/ui';

type Props = {
  readonly repoName: string | null;
  readonly onCreate: (params: { readonly branch: string }) => Promise<boolean>;
  readonly onCancel: () => void;
};

export const NewBranchForm = ({ repoName, onCreate, onCancel }: Props) => {
  const [branch, setBranch] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  const submit = async (): Promise<void> => {
    if (isBusy) {
      return;
    }
    setIsBusy(true);
    await onCreate({ branch: branch.trim() });
    setIsBusy(false);
  };

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex flex-col gap-1">
        <span className="text-label text-foreground">
          {repoName === null ? 'New branch' : `New branch in ${repoName}`}
        </span>
        <span className="text-meta text-muted-foreground">
          It gets its own worktree. The branches already here keep their pull requests.
        </span>
      </div>
      <Input
        value={branch}
        autoFocus
        disabled={isBusy}
        aria-label="Branch name"
        placeholder="Leave empty to name it automatically"
        onChange={(event) => setBranch(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') {
            return;
          }
          event.preventDefault();
          void submit();
        }}
      />
      <FormActions>
        <Button size="sm" variant="ghost" disabled={isBusy} onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" isBusy={isBusy} busyLabel="Creating…" onClick={() => void submit()}>
          Create branch
        </Button>
      </FormActions>
    </div>
  );
};
