# Work

One page lists every Lead of a workspace, whatever session it runs in. A Lead is the agent that plans a job, hands it to helpers and asks you only for what your permission rows say.

### Work section

Open **Work** to see every Lead of the workspace in one list, and see which ones need you. A row opens the Lead in its session.

- Work is off until you turn on **Work** under Experiments in Settings › App › General. While it is off, the section, the word Lead and the permission rows stay hidden, and Goodboy keeps the word Auto and its level chip.
- Four filters sit above the list: **All open**, **Needs you**, **Working** and **Finished**. Each shows its count, and the filter you pick comes back after a reload or a Back.
- A row shows the title, then the session goal, the project and the branch under it. At the right it shows the state in words, how many agents run, what the Lead spent and how long ago it changed.
- A Lead that waits for you has a button on its row: **Review plan**, **Answer** or **Open**. A Lead on two branches is one row.
- **Start work** opens the composer at the top of the page, as [Start work](start.md#start-work) describes. ⌘K lists Work and one row per open Lead.
- If a refresh fails, the list keeps what it read last, says "Couldn't refresh Leads" and offers **Retry**.

### Lead

A Lead reads one of five words: **Working**, **Waits for you**, **Resting**, **Stopped** or **Finished**. The reason for a wait, a plan to review, a question, the limit or a failure, stands next to it.

- The Lead page shows its chat and the tree of its agents. For the agent you select it also shows the record of what it was given at launch. Under 860 pixels of width the tree opens from the **Agents** count in the header.
- Write to a Lead while its agents work and the note goes in at once. Its tree row reads **Not read yet**, then **Read at turn 3**, and you can still edit or remove it until it is read.
- An ask to push, open a pull request, add a dependency or change a protected file appears in the action bar. It has one main answer and one quiet one.
- With **Close the work** at Lead, a Lead that decides the work is done ends in **Finished**, once no agent is open and nothing waits. A message from you opens it again.

### Permission rows

A Lead's autonomy is nine rows you can read and change.

- The rows are: approve the plan, start agents that read, start agents that write, push, and open a pull request. The rest are add dependencies, change protected files, add a project and close the work.
- The three levels, **Every step**, **After the plan** and **Never**, are presets of these rows. **Custom** lights up by itself when the rows match none of them.
- Each row has its own value on a Lead and a default for the workspace. A row set on a Lead shows **This Lead** with **Reset**. A row you did not set follows the default live.
- The workspace default sits under **Asks you** in the workspace settings. The panel opens from the **Start work** composer and from the Lead page.
- A row saves the moment you change it. A failed save keeps the old value and shows the error under the row.
- A row you tighten while an agent runs applies to its next start. One you loosen never releases a start that already waits.
- The spend limit shows on the same panel, read only. Four rules never change: a force push asks and takes a backup, you merge, agents never push, and the Lead never writes code.

## Under the hood

This part is for contributors and agents who change the feature.

- The switch is the `work.enabled` setting (`SETTING_WORK_ENABLED`, `WorkSwitchField`). `flowWordOf` (`shared/lib/`) picks Auto or Lead, and `flowRulesOf` (`features/work/`) holds the rest of the on and off rules.
- The page is `WorkPage` in `features/work/components/WorkPage/`. `useWorkLeads` polls and keeps only the latest read, `workRowsOf` owns every number and filter count, and `workStateOf` writes the state and the button of a row. The read is `listAutoWorkTreesOfWorkspace` in `packages/db/src/queries/auto-work-trees.ts`.
- The five words come from `leadStopOf` in `packages/core/src/auto/leadStopOf.ts`, through `autoTreeWordOf`.
- The rows, presets and precedence are `packages/core/src/auto/permissions.ts`. A Lead's own rows live in `auto_trees.permissions` and the default in the workspace value `auto.permissions` (m243). The panel is `LeadPermissionsPanel` in `features/auto/permissions/`.
- Asks are listed by `leadAsksOf` and answered by `answerAsk`. The action bar draws them in `AutoDockAsk`.
- docs/auto.md holds the engine side: the Lead page, state words, permission rows, asks, publish gates, the launch guard and the landing backstop.
