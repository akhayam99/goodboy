import { CircleAlert } from '@goodboy/ui/icons';
import { Button, ICON_SIZE, Tooltip, countTextOf } from '@goodboy/ui';
import type { BrowserErrorsShow } from '../../types';

type Props = {
  readonly errors: BrowserErrorsShow;
};

export const BrowserErrorCount = ({ errors }: Props) => {
  if (errors.count <= 0) {
    return null;
  }
  return (
    <Tooltip content="Show errors" side="top">
      <Button
        variant="ghost-danger"
        size="xs"
        aria-label={`Show ${errors.count} ${errors.count === 1 ? 'error' : 'errors'}`}
        data-browser-errors=""
        onClick={errors.onShow}
        className="shrink-0 rounded-full bg-danger-subtle tabular-nums"
      >
        <CircleAlert size={ICON_SIZE.row} aria-hidden />
        {countTextOf({ count: errors.count })}
      </Button>
    </Tooltip>
  );
};
