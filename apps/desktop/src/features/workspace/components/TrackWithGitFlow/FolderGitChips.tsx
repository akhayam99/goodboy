import { Chip } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { FolderGitRow } from './folderGitRowOf';

type Props = {
  readonly row: FolderGitRow;
  readonly branch: string | null;
};

const STATE_LABEL: Record<FolderGitRow, string | null> = {
  hidden: null,
  'no-git': 'No git yet',
  'no-commits': 'No commits yet',
  found: 'Found outside the app',
  'in-place': 'Edits in place',
  inside: 'Inside a repository',
  local: 'Not published',
};

const HAS_GIT: ReadonlySet<FolderGitRow> = new Set<FolderGitRow>([
  'no-commits',
  'found',
  'in-place',
  'local',
]);

export const FolderGitChips = ({ row, branch }: Props) => {
  const label = STATE_LABEL[row];
  const BranchIcon = CONCEPT_ICONS.branch;
  return (
    <span className="flex shrink-0 items-center gap-1">
      {HAS_GIT.has(row) ? <Chip tone="neutral" shape="badge" size="xs" label="Git" /> : null}
      {HAS_GIT.has(row) && branch !== null ? (
        <Chip
          tone="neutral"
          shape="badge"
          size="xs"
          icon={<BranchIcon size={ICON_SIZE.row} aria-hidden />}
          label={branch}
        />
      ) : null}
      {label === null ? null : <Chip tone="neutral" shape="badge" size="xs" label={label} />}
    </span>
  );
};
