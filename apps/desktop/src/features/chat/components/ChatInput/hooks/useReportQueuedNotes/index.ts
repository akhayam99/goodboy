import { useCallback, useContext, useEffect, useRef } from 'react';
import { EMPTY_QUEUED_NOTES } from '../../../../emptyQueuedNotes';
import type { QueuedNotes } from '../../../../queuedNotes';
import { QueuedNotesReportContext } from '../../../../queuedNotesReport';

type Params = {
  readonly queued: QueuedNotes;
};

export const useReportQueuedNotes = ({ queued }: Params): void => {
  const report = useContext(QueuedNotesReportContext);
  const latest = useRef(queued);
  useEffect(() => {
    latest.current = queued;
  });
  const onEdit = useCallback((id: string) => latest.current.onEdit(id), []);
  const onRemove = useCallback((id: string) => latest.current.onRemove(id), []);
  const { rows } = queued;
  useEffect(() => {
    if (report === null) {
      return;
    }
    report({ rows, onEdit, onRemove });
    return () => report(EMPTY_QUEUED_NOTES);
  }, [report, rows, onEdit, onRemove]);
};
