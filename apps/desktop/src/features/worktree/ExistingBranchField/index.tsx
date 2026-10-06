import { BranchCombobox } from '../BranchCombobox';
import { useBranchChoices } from '../useBranchChoices';

type Props = {
  readonly repoRoot: string;
  readonly workspaceId: string;
  readonly projectId: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly disabled: boolean;
  readonly excludeNames?: ReadonlyArray<string>;
};

export const ExistingBranchField = ({
  repoRoot,
  workspaceId,
  projectId,
  value,
  onChange,
  disabled,
  excludeNames,
}: Props) => {
  const { choices, isLoading } = useBranchChoices({ repoRoot, workspaceId, projectId });
  return (
    <BranchCombobox
      branches={choices}
      value={value}
      onChange={onChange}
      disabled={disabled}
      loading={isLoading}
      emptyLabel="No branches"
      {...(excludeNames === undefined ? {} : { excludeNames })}
    />
  );
};
