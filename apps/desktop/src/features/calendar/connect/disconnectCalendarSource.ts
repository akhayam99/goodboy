import type { CalendarSource } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { useAppStore } from '../../../store';
import { calendarCommands } from './calendarCommands';

type Params = {
  readonly source: CalendarSource;
};

export type DisconnectOutcome =
  { readonly kind: 'disconnected' } | { readonly kind: 'failed'; readonly message: string };

const STORE_FAILED = 'The calendar is still listed. Try again.';

export const disconnectCalendarSource = async ({ source }: Params): Promise<DisconnectOutcome> => {
  if (source.kind === 'ics') {
    try {
      await calendarCommands.removeLink({ id: source.id });
    } catch (error) {
      return { kind: 'failed', message: formatError(error) };
    }
  }
  const removed = await useAppStore.getState().removeCalendarSource({ sourceId: source.id });
  if (!removed.isOk) {
    return { kind: 'failed', message: STORE_FAILED };
  }
  return { kind: 'disconnected' };
};
