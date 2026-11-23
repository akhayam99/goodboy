import { useAppStore } from '../../store';
import { shownDeskStackOf } from '../../store/slices/drawer/shownDeskStackOf';
import { drawerKey } from '../../store/slices/drawer/drawerKey';
import type { OpenDrawer } from '../../store/slices/drawer/state';
import { DeskAgent } from '../../features/session/components/DeskAgent';
import { DeskPr } from '../../features/session/components/DeskPr';
import { PanelBoundary } from './PanelBoundary';

type CloseParams = {
  readonly entry: OpenDrawer;
};

export const DeskDetailStack = () => {
  const agent = useAppStore((state) => shownDeskStackOf({ state })?.agent);
  const pr = useAppStore((state) => shownDeskStackOf({ state })?.pr);
  const closeEntry = useAppStore((state) => state.closeDrawerEntry);
  if (agent === undefined || pr === undefined) {
    return null;
  }
  const close = ({ entry }: CloseParams) => closeEntry({ entry });
  return (
    <div data-desk-stack="" className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
      <div data-desk-stack-panel="agent" className="flex min-h-0 min-w-0 flex-1 flex-col">
        <PanelBoundary
          key={drawerKey(agent)}
          leaveLabel="Close drawer"
          onLeave={() => close({ entry: agent })}
        >
          <DeskAgent
            sessionId={agent.sessionId}
            agentId={agent.payload.agentId}
            focus={agent.payload}
            onClose={() => close({ entry: agent })}
          />
        </PanelBoundary>
      </div>
      <div data-desk-stack-panel="pr" className="flex min-h-0 min-w-0 flex-1 flex-col">
        <PanelBoundary
          key={drawerKey(pr)}
          leaveLabel="Close drawer"
          onLeave={() => close({ entry: pr })}
        >
          <DeskPr
            sessionId={pr.sessionId}
            mountId={pr.payload.mountId}
            tab={pr.payload.tab}
            check={pr.payload.check ?? null}
            onClose={() => close({ entry: pr })}
          />
        </PanelBoundary>
      </div>
    </div>
  );
};
