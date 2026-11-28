# Calendar and reminders

See your meetings next to your agents. Goodboy only reads your calendar, and never changes an event.

### Your day and your week

Calendar in the places rail shows today's meetings as one list, with the start, the length and when each one begins. **Week** shows the same meetings as five or seven day columns. Each calendar keeps one colour. A calendar shown as busy only says Busy and never its title. A focus block says your agents keep working through it.

With no calendar connected, the page asks you to connect one and opens the calendar page of Connections. A day with no meeting says Nothing today in one line.

The page never shows an empty grid for a calendar it cannot read. When macOS has closed access, a notice says so and **Reconnect** asks again, or points to System Settings. When a calendar, a link or the saved connections cannot be read, a notice names it and **Retry** reads it once more. Calendar links work on every system. Calendars on this Mac are offered on macOS only.

### Before a call

Click a meeting to open its panel beside the page, with the time, where it comes from and the host of its call link. **Join call** opens the call in the app that owns the link, and **Copy link** copies it. A link from a host Goodboy does not know shows that host first and opens only after one more click. When a call starts within 30 minutes, its row counts the sessions that need you. The panel lists them under Before this call, each with **Open**. People lists who is invited.

### The call chip

A small window opens at the top of your screen, over every app, five minutes before a meeting with a call link. It shows the call and who needs you first, one row each with **Open**. One minute before, it counts down the seconds with **Join call**, **Remind me in 5m** and **Hide**. Meetings without a link, cancelled ones and those in a hidden or busy only calendar never open it.

**Join call** opens the link in the app that owns it. A link from a host Goodboy does not know shows that host first. In the call the chip says how long you have been in and offers **Return to call**.

Joining from the chip or the panel, from five minutes before the start, holds banners until the meeting ends. A failed check or a failed push still shows. Then the chip lists what happened while you were away, each with **Open**.

Turn the chip off with **Show the call chip** in Settings, under Notifications. A banner then opens Goodboy on the calendar instead. The chip does not yet know when you share your screen.

### Reminders

Write a reminder under the day and press Enter. The day and the time in the text set when it is due, and Goodboy takes those words out of the reminder. It reads a clock such as 17:00, 9.30, 11pm or 5:30pm, at noon, at midnight, and a bare hour after at or by. It reads today, tonight, tomorrow, a weekday (monday, next friday) and a delay such as in 30 minutes, in 2 hours or in 3 days. A clock already past today moves to tomorrow only when no day was written. With no time at all, a reminder is due tomorrow at 09:00.

Tick a reminder to mark it done, and **Undo** in the toast brings it back. A tick stays after a restart.

A reminder can also wait for something to happen: a call that ends, the checks of a pull request that all pass, or an agent that finishes. **Remind me when CI is green** in the menu of a pull request sets one. It comes due once, when that happens, and stays due until you close it.

A due reminder moves into Needs you, at the top of the Board's Running lane. Click it to open what it names: the pull request or the session. A reminder that names nothing, a call, or something that is gone opens Calendar. Its menu snoozes it for an hour or until tomorrow at 09:00, or marks it done, with **Undo** in the toast.

## Under the hood

- Your day and your week: the place is the `calendar` row of `apps/desktop/src/shared/navigation/destinations.ts`. `openColumnDoor` in `apps/desktop/src/app/components/ShellLeft/columnDoors.ts` opens it. The page is `apps/desktop/src/features/calendar/components/CalendarPage/index.tsx`. Its rows come from `calendarRowsOf` and its facts from `calendarFactsOf`. The week comes from `calendarWeekOf`, drawn by `WeekGrid` in `packages/ui/src/components/WeekGrid/index.tsx`. `useCalendarLoad` loads the stored sources, then the week, and returns `reload` for **Retry**. A failed read keeps its text in `calendarSourcesError` and `calendarEventsError`; `CalendarBody` and `FailedSourcesNotice` draw them, and `MacAccessLostNotice` asks macOS again. On macOS `new_ready_store` in `apps/desktop/src-tauri/src/platform/event_kit.rs` asks the system once per read, so a fresh process reads the same calendars as before. Each colour comes from `calendarIdentity` in `apps/desktop/src/features/session/timeline/calendarIdentity.ts`.
- Before a call: `apps/desktop/src/features/calendar/components/CalendarEventDetail/index.tsx` draws the panel. `CallActions.tsx` opens a known host through `joinMeeting` and asks first for any other host. Only an opened link reaches the `joined` input of `reduceCallChip`. The count and the rows read `useNowSessions`, the same sessions the Board counts.
- The call chip: `apps/desktop/src-tauri/src/calendar/alerts.rs` times the five minute, one minute, snooze and end moments in the Rust process and fires each once, recomputing within 15 seconds of a wake. It holds only an event id, a start and an end. `useCallChipBridge` in `apps/desktop/src/features/calendar/chip/hooks/useCallChipBridge/index.ts` arms it with `callsOf` and reduces alerts and clicks with `reduceCallChip`. While the chip is up, `useCallChipView` in `apps/desktop/src/features/calendar/chip/hooks/useCallChipView/index.ts` sends the view from `callChipViewOf` to the `call-chip` window. `CallChipWindow.tsx` draws it. Between calls the shell never reads who needs you. Notices wait in `callQuietStore` through `heldDuringCall` in `apps/desktop/src/features/notifications/away/`. The banner instead of the chip is `showCallBanner.ts`.
- Reminders: `apps/desktop/src/features/calendar/components/CalendarPage/CalendarReminders.tsx` lists them. `ReminderInput.tsx` reads the day and the time with `reminderDraftOf`, which uses `reminderClockOf`, `reminderDayOf` and `reminderAfterOf` in `apps/desktop/src/features/calendar/reminderPhrase/`. `markReminderDone` in `apps/desktop/src/store/slices/calendar/markReminderDone.ts` writes the done and its undo.
- Reminders in Needs you: `NeedsYouAnnouncementBridge` mounts `useReminderTriggers` from `apps/desktop/src/features/calendar/reminders/hooks/`. It loads the reminders of the current workspace. `isTriggerHeld` reads pull request checks and the agents of the session from the store. For a call end it reads the meetings `useCallEndEvents` lists while such a reminder waits, then the shown calendar day.
- Due reminders: a held trigger calls `fireReminder`, which writes `due_at` once and only while it is empty, so a red check later does not take it back. `dueRemindersOf` is the one list of due reminders; `ReminderNeedsYouCards` draws them after the session cards and `StageBoard` adds their count to the lane. `reminderOwnerOf` picks the context line and the place **Open** goes to. The row menu is `REMINDER_KIND` in `apps/desktop/src/features/actions/kinds/reminder.ts`; the pull request entry is `pullRequestWithReminder.ts`. Tested in `apps/desktop/src/features/calendar/reminders/reminders.sqlite.test.tsx`.
