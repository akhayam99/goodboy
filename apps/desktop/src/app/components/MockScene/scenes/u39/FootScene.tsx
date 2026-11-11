import { useEffect, useState } from 'react';
import { COLLAPSED_RAIL_WIDTH } from '@goodboy/ui';
import { useAppStore } from '../../../../../store';
import type { ColumnActions } from '../../../SideColumn/columnDoors';
import { ColumnFoot } from '../../../SideColumn/ColumnFoot';
import { ColumnRail } from '../../../SideColumn/ColumnRail';
import { installSceneDatabase } from '../sceneDatabase';
import { FootPanel } from './FootPanel';

type Props = {
  readonly hasUpdate: boolean;
};

const COLUMN_WIDTH_PX = 240;
const NARROW_COLUMN_WIDTH_PX = 200;
const VERSION = '0.33.1';

const noop = () => undefined;

const ACTIONS: ColumnActions = {
  openBoard: noop,
  openInbox: noop,
  openChat: noop,
  openWorkflows: noop,
  openNewChat: noop,
  openMonitoring: noop,
  openImpact: noop,
  openSettings: noop,
  openChangelog: noop,
  openGuide: noop,
};

export const FootScene = ({ hasUpdate }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    installSceneDatabase();
    useAppStore.setState({
      updaterStatus: hasUpdate ? 'available' : 'idle',
      updateVersion: hasUpdate ? VERSION : null,
      updateNotes: null,
    });
    setIsReady(true);
  }, [hasUpdate]);

  if (!isReady) {
    return null;
  }

  return (
    <main className="flex min-h-screen flex-wrap items-end gap-6 bg-background p-6 text-foreground">
      <FootPanel caption="Open column" width={COLUMN_WIDTH_PX}>
        <ColumnFoot place="board" isPrimary actions={ACTIONS} />
      </FootPanel>
      <FootPanel caption="Help open" width={COLUMN_WIDTH_PX}>
        <ColumnFoot place="help" isPrimary={false} actions={ACTIONS} />
      </FootPanel>
      <FootPanel caption="Column at 200px" width={NARROW_COLUMN_WIDTH_PX}>
        <ColumnFoot place="board" isPrimary={false} actions={ACTIONS} />
      </FootPanel>
      <FootPanel caption="Folded rail" width={COLLAPSED_RAIL_WIDTH}>
        <ColumnRail scope="app" place="board" actions={ACTIONS} />
      </FootPanel>
    </main>
  );
};
