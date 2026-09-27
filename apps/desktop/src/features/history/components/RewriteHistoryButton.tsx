import { Button } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../shared/components/conceptIcons';
import { REWRITE_HISTORY_TITLE } from '../rewriteHistoryTitle';

type Props = {
  readonly count: number;
  readonly onOpen: () => void;
};

export const RewriteHistoryButton = ({ count, onOpen }: Props) => (
  <Button
    size="sm"
    variant="ghost"
    onClick={onOpen}
    title="Reword, squash, fold, drop or reorder the commits of this branch"
  >
    <CONCEPT_ICONS.history size={ICON_SIZE.row} aria-hidden />
    {REWRITE_HISTORY_TITLE}
    <span className="tabular-nums text-muted-foreground">{count}</span>
  </Button>
);
