import { useEffect, useState, type ComponentType } from 'react';
import { ArrowRight } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { Button, DrawerFrame } from '@goodboy/ui';
import type { AgentId, Session } from '@goodboy/types';
import { EMPTY_ARRAY, sessionPlace, useAppStore } from '../../../../store';
import type { NewDrawerPayload } from '../../../../store/slices/drawer/state';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { WorkflowBuilderView } from '../../../workflows/components/WorkflowBuilderView';
import { hasActiveWorkflowRun } from '../../../workflows/activeWorkflowRuns';
import { NEW_DRAWER_FORMS } from '../../newDrawerForms';
import { AgentPanel } from './AgentPanel';
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
  const agents = useAppStore(
    useShallow((state) => state.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY),
  );
  const isRunForm = form === 'run' || form === 'orchestrate';
  const isRunActive = hasActiveWorkflowRun({ workflowRuns: session.workflowRuns, agents });

  useEffect(() => {
    if (isRunForm) {
      document.getElementById('workflow-goal')?.focus({ preventScroll: true });
    }
  }, [isRunForm, form]);

  const openRun = (): void => {
    onClose();
    useAppStore.getState().navigate({ to: sessionPlace({ sessionId, lens: 'workflows' }) });
  };

  const onStarted = (agentId: AgentId): void => {
    const state = useAppStore.getState();
    state.awaitArtifactAgent({ sessionId, agentId });
    state.navigate({ to: sessionPlace({ sessionId, lens: 'plans' }) });
  };

  const openForm = (next: 'run' | 'orchestrate'): void => {
    useAppStore.getState().openDrawer({ kind: 'new', sessionId, payload: { form: next } });
  };

  return (
    <DrawerFrame title={meta.title} icon={meta.icon} onClose={onClose}>
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex min-w-0 items-center justify-between gap-3 empty:hidden">
          {meta.line === null ? null : (
            <p className="min-w-0 text-label text-muted-foreground">
              {meta.line}
              {form === 'auto' ? (
                <span className="text-faint-foreground"> Experimental</span>
              ) : null}
            </p>
          )}
          {isRunForm && isRunActive ? (
            <Button variant="ghost" size="sm" onClick={openRun}>
              <ArrowRight size={ICON_SIZE.control} aria-hidden />
              Open active run
            </Button>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          {form === 'run' ? (
            <WorkflowBuilderView
              mode="preset"
              session={session}
              slots={{ actionsHost }}
              onOrchestrateInstead={() => openForm('orchestrate')}
              onClose={onClose}
            />
          ) : null}
          {form === 'orchestrate' ? (
            <WorkflowBuilderView
              mode="dynamic"
              session={session}
              slots={{ actionsHost }}
              onClose={onClose}
            />
          ) : null}
          {form === 'agent' || form === 'auto' ? (
            <AgentPanel
              sessionId={sessionId}
              isAuto={form === 'auto'}
              actionsHost={actionsHost}
              onClose={onClose}
            />
          ) : null}
          {form === 'report' || form === 'wireframe' ? (
            <WritePanel
              session={session}
              kind={form}
              note={payload.note ?? null}
              actionsHost={actionsHost}
              onStarted={onStarted}
              onClose={onClose}
            />
          ) : null}
        </div>
        <div ref={setActionsHost} className="flex flex-col pb-4" />
      </div>
    </DrawerFrame>
  );
};
