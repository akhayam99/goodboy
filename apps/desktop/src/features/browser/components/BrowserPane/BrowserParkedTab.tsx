import { Moon } from '@goodboy/ui/icons';
import { Button, EmptyState } from '@goodboy/ui';
import { NAMES } from '../../../../shared/utils/names';
import type { BrowserTab } from '../../../../store/slices/browser/types';
import { hostOf } from '../../hostOf';

type Props = {
  readonly tab: BrowserTab;
  readonly onWake: () => void;
};

export const BrowserParkedTab = ({ tab, onWake }: Props) => (
  <div className="flex min-h-0 flex-1 items-center justify-center p-6">
    <EmptyState
      icon={Moon}
      title={`${hostOf({ url: tab.url })} · ${NAMES.browserAsleep}`}
      description="The page closed while you were away. It reloads at its address."
      action={
        <Button variant="secondary" size="sm" onClick={onWake}>
          {NAMES.wake}
        </Button>
      }
    />
  </div>
);
