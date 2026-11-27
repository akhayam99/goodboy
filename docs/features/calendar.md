# Calendar

See your meetings next to your agents. Goodboy only reads your calendar, and never changes an event.

### Your day and your week

Calendar in the places rail shows today's meetings as one list, with the start, the length and when each one begins. **Week** shows the same meetings as five or seven day columns. Each calendar keeps one colour. A calendar shown as busy only says Busy and never its title. A focus block says your agents keep working through it.

With no calendar connected, the page asks you to connect one and opens Connections. A day with no meeting says Nothing today in one line.

### Before a call

Click a meeting to open its panel beside the page, with the time, where it comes from and the host of its call link. **Join call** opens the call in the app that owns the link, and **Copy link** copies it. A link from a host Goodboy does not know shows that host first and opens only after one more click. When a call starts within 30 minutes, its row counts the sessions that need you. The panel lists them under Before this call, each with **Open**. People lists who is invited.

### Reminders

Write a reminder under the day and press Enter. A time in the text, such as 17:00 or 9.30, sets when it is due, and with no time it is due tomorrow at 09:00. Tick a reminder to mark it done, and **Undo** in the toast brings it back.

## Under the hood

- Your day and your week: the place is the `calendar` row of `apps/desktop/src/shared/navigation/destinations.ts`. `openColumnDoor` in `apps/desktop/src/app/components/ShellLeft/columnDoors.ts` opens it. The page is `apps/desktop/src/features/calendar/components/CalendarPage/index.tsx`. Its rows come from `calendarRowsOf` and its facts from `calendarFactsOf`. The week comes from `calendarWeekOf`, drawn by `WeekGrid` in `packages/ui/src/components/WeekGrid/index.tsx`. Each colour comes from `calendarIdentity` in `apps/desktop/src/features/session/timeline/calendarIdentity.ts`.
- Before a call: `apps/desktop/src/features/calendar/components/CalendarEventDetail/index.tsx` draws the panel. `CallActions.tsx` opens a known host through `joinCall` and asks first for any other host. The count and the rows read `useNowSessions`, the same sessions the Board counts.
- Reminders: `apps/desktop/src/features/calendar/components/CalendarPage/CalendarReminders.tsx` lists them. `ReminderInput.tsx` reads the time with `reminderDraftOf`. `markReminderDone` in `apps/desktop/src/store/slices/calendar/markReminderDone.ts` writes the done and its undo.
