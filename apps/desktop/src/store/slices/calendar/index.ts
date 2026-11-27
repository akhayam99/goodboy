import type { SliceDeps } from '../../slice-types';
import { addCalendarSource } from './addCalendarSource';
import { addReminder } from './addReminder';
import { fireReminder } from './fireReminder';
import { loadCalendarEvents } from './loadCalendarEvents';
import { loadCalendarSources } from './loadCalendarSources';
import { loadReminders } from './loadReminders';
import { markReminderDone } from './markReminderDone';
import { removeCalendarSource } from './removeCalendarSource';
import { setCalendarRole } from './setCalendarRole';
import { snoozeReminder } from './snoozeReminder';

export const createCalendarSlice = ({ set, get }: SliceDeps) => ({
  loadCalendarSources: loadCalendarSources({ set, get }),
  addCalendarSource: addCalendarSource({ set, get }),
  removeCalendarSource: removeCalendarSource({ set, get }),
  setCalendarRole: setCalendarRole({ set, get }),
  loadCalendarEvents: loadCalendarEvents({ set, get }),
  loadReminders: loadReminders({ set, get }),
  addReminder: addReminder({ set, get }),
  markReminderDone: markReminderDone({ set, get }),
  snoozeReminder: snoozeReminder({ set, get }),
  fireReminder: fireReminder({ set, get }),
});
