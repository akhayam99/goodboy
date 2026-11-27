import { Button, GhostActionButton, Notice } from '@goodboy/ui';
import { Plus } from '@goodboy/ui/icons';
import { HOME_WIDGETS } from '../grid/homeWidgets';
import type { HomeWidgetId } from '../grid/homeWidgets';
import type { WidgetGesture } from './layoutTypes';

type Props = {
  readonly tray: ReadonlyArray<HomeWidgetId>;
  readonly isSaveFailed: boolean;
  readonly onShow: (params: WidgetGesture) => void;
  readonly onRetry: () => void;
};

export const HiddenTray = ({ tray, isSaveFailed, onShow, onRetry }: Props) => {
  if (tray.length === 0 && !isSaveFailed) {
    return null;
  }
  return (
    <div data-home-tray="" className="flex flex-col gap-2 pt-3">
      {isSaveFailed ? (
        <Notice
          tone="warning"
          placement="inline"
          role="alert"
          title="Couldn't save the layout"
          body="It stays as you made it on this screen."
          actions={
            <Button size="sm" variant="secondary" onClick={onRetry}>
              Retry
            </Button>
          }
        />
      ) : null}
      {tray.length === 0 ? null : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-meta text-faint-foreground">Hidden</span>
          {tray.map((id) => (
            <GhostActionButton
              key={id}
              icon={Plus}
              label={`Show ${HOME_WIDGETS[id].title.toLowerCase()}`}
              onClick={() => onShow({ id })}
            />
          ))}
        </div>
      )}
    </div>
  );
};
