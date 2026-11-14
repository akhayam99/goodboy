import { PageColumn, Tooltip } from '@goodboy/ui';

type Props = {
  readonly error: string;
};

export const BranchCommitsNotice = ({ error }: Props) => (
  <PageColumn className="pb-2">
    <Tooltip content={error}>
      <p role="status" className="text-meta text-muted-foreground">
        Couldn't read this branch's commits.
      </p>
    </Tooltip>
  </PageColumn>
);
