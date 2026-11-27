import { brandId, type CalendarSourceId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { useAppStore } from '../../../store';
import { calendarCommands } from './calendarCommands';

type Params = {
  readonly label: string;
  readonly url: string;
  readonly nowMs: number;
};

export type LinkConnectOutcome =
  { readonly kind: 'connected' } | { readonly kind: 'failed'; readonly message: string };

const STORE_FAILED = 'The calendar was not saved, and its link was taken off the Keychain.';

export const connectCalendarLink = async ({
  label,
  url,
  nowMs,
}: Params): Promise<LinkConnectOutcome> => {
  let link: Awaited<ReturnType<typeof calendarCommands.addLink>>;
  try {
    link = await calendarCommands.addLink({ label: label.trim(), url: url.trim() });
  } catch (error) {
    return { kind: 'failed', message: formatError(error) };
  }
  const added = await useAppStore.getState().addCalendarSource({
    source: {
      id: brandId<CalendarSourceId>({ value: link.id }),
      kind: 'ics',
      label: link.label,
      host: link.host,
      createdAt: nowMs,
    },
  });
  if (added.isOk) {
    return { kind: 'connected' };
  }
  try {
    await calendarCommands.removeLink({ id: link.id });
  } catch (error) {
    return { kind: 'failed', message: formatError(error) };
  }
  return { kind: 'failed', message: STORE_FAILED };
};
