import { Tooltip } from '@goodboy/ui';

type Props = {
  readonly error: string;
};

export const BranchCommitsNotice = ({ error }: Props) => (
  <div className="flex h-8 shrink-0 items-center pl-4 pr-6">
    <Tooltip content={error}>
      <p role="status" className="text-meta text-muted-foreground">
        Couldn't read this branch's commits.
      </p>
    </Tooltip>
  </div>
);
