import { useState } from 'react';
import { Button, SectionHeader } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useTimelineOpen } from '../../hooks/useTimelineOpen';
import type { SessionWorkModel } from '../useSessionWorkModel';
import { DoneRetry } from './DoneRetry';
import { DoneRow } from './DoneRow';
import { DoneRowDetail } from './DoneRowDetail';
import type { DoneChipFor, DoneDay } from './doneTypes';

type Props = {
  readonly session: Session;
  readonly model: SessionWorkModel;
  readonly days: ReadonlyArray<DoneDay>;
  readonly initialOpenId?: string | null;
  readonly chipFor?: DoneChipFor;
};

type LogParams = {
  readonly focusEntryId: string | null;
};

export const DoneSection = ({ session, model, days, initialOpenId = null, chipFor }: Props) => {
  const sessionId = session.id;
  const openDrawer = useAppStore((state) => state.openDrawer);
  const openFor = useTimelineOpen({ sessionId });
  const [openId, setOpenId] = useState<string | null>(initialOpenId);
  if (days.length === 0) {
    return null;
  }
  const openLog = ({ focusEntryId }: LogParams) =>
    openDrawer({ kind: 'session-log', sessionId, payload: { focusEntryId } });
  return (
    <section aria-label="What was done" className="flex min-w-0 flex-col gap-2">
      <SectionHeader
        label="What was done"
        headingLevel={2}
        action={
          <Button size="sm" variant="secondary" onClick={() => openLog({ focusEntryId: null })}>
            Full log
          </Button>
        }
      />
      <div className="flex min-w-0 flex-col gap-2">
        {days.map((day) => (
          <div key={day.key} className="flex min-w-0 flex-col gap-1">
            <SectionHeader label={day.label ?? 'Today'} headingLevel={3} className="px-2" />
            <ul className="flex min-w-0 list-none flex-col gap-1">
              {day.rows.map((row) => {
                const entry = model.entries.find((candidate) => candidate.id === row.entryId);
                const openTarget = entry === undefined ? null : openFor({ entry });
                return (
                  <DoneRow
                    key={row.id}
                    row={row}
                    isOpen={openId === row.id}
                    chip={chipFor?.({ row })}
                    onToggle={() => setOpenId((current) => (current === row.id ? null : row.id))}
                  >
                    <DoneRowDetail
                      row={row}
                      openTarget={openTarget}
                      onShowInLog={() => openLog({ focusEntryId: row.entryId })}
                      retry={
                        row.retryAgentId === null ? null : (
                          <DoneRetry
                            sessionId={sessionId}
                            agentId={row.retryAgentId}
                            title={row.title}
                          />
                        )
                      }
                    />
                  </DoneRow>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
};
