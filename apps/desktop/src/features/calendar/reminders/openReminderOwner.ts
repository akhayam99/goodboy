import { useAppStore } from '../../../store';
import { openDestination } from '../../../shared/navigation/openDestination';
import type { ReminderOwner } from './reminderOwnerOf';

type Params = {
  readonly owner: ReminderOwner;
};

export const openReminderOwner = ({ owner }: Params): void => {
  if (owner.place === null) {
    openDestination({ id: 'calendar' });
    return;
  }
  useAppStore.getState().navigate({ to: owner.place });
};
