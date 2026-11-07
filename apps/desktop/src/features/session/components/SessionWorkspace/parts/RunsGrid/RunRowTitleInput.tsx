import { Input, Tooltip } from '@goodboy/ui';
import type { useInlineRename } from '../../../../../../shared/hooks/useInlineRename';

type Props = {
  readonly rename: ReturnType<typeof useInlineRename>;
};

export const RunRowTitleInput = ({ rename }: Props) => (
  <Tooltip content={rename.error ?? undefined}>
    <Input
      autoFocus
      value={rename.draft}
      aria-label="Rename run"
      aria-invalid={rename.error !== null}
      onChange={(event) => rename.setDraft(event.target.value)}
      onKeyDown={rename.onKeyDown}
      onBlur={rename.onBlur}
    />
  </Tooltip>
);
