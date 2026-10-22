import { useState, type ComponentType } from 'react';
import { DrawerFrame } from '@goodboy/ui';
import type { AgentId, Session } from '@goodboy/types';
import { sessionPlace, useAppStore } from '../../../../store';
import type { NewDrawerPayload } from '../../../../store/slices/drawer/state';
import { NEW_DRAWER_FORMS } from '../../newDrawerForms';
import type { WritePanelProps } from '../../../artifacts/writePanelProps';

type Props = {
  readonly session: Session;
  readonly payload: NewDrawerPayload;
  readonly writePanel: ComponentType<WritePanelProps>;
  readonly onClose: () => void;
};

export const NewDrawerBody = ({ session, payload, writePanel: WritePanel, onClose }: Props) => {
  const sessionId = session.id;
  const form = payload.form;
  const meta = NEW_DRAWER_FORMS[form];
  const [actionsHost, setActionsHost] = useState<HTMLElement | null>(null);

  const onStarted = (agentId: AgentId): void => {
    const state = useAppStore.getState();
    state.awaitArtifactAgent({ sessionId, agentId });
    state.navigate({ to: sessionPlace({ sessionId, lens: 'plans' }) });
  };

  return (
    <DrawerFrame title={meta.title} icon={meta.icon} onClose={onClose}>
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex min-w-0 flex-col gap-6">
          <WritePanel
            session={session}
            kind={form}
            note={payload.note ?? null}
            actionsHost={actionsHost}
            onStarted={onStarted}
            onClose={onClose}
          />
        </div>
        <div ref={setActionsHost} className="flex flex-col pb-4" />
      </div>
    </DrawerFrame>
  );
};
