# Start a task

Begin from an issue, a workflow or a question, in one draft that turns into a session when you press Start.

### How do you want to start?

The **New session** draft has three tabs: **Pick up a task**, **Run a workflow** and **Ask an agent**. **Discard draft** throws it away. The draft becomes a session only when you press Start, so empty sessions do not pile up.

### Pick up a task, with a drafted brief

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/start-pick-task-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/start-pick-task-light.webp" alt="The New session page on Pick a task: the task HBL-412 Retried webhooks post a second credit with Dismiss, then one block titled Brief from HBL-412 with its title ready to edit, and under it the tabs Run a workflow and Ask an agent with the Orchestrated workflow and its brief in a Write and Preview editor">
</picture>

<sub>Screenshot from Goodboy 0.23.0</sub>

Turn an issue into a briefed session in one pick. Pick HBL-412 and the draft shows one block: **Brief from HBL-412** with the title Goodboy drafted, ready to edit, then **How to work on it**: the project it works in, **Run a workflow** or **Ask an agent**, and the goal under it. The goal starts as the issue text and becomes the drafted brief with its **Done when** criteria as soon as it is written, unless you already edited it. **Use the issue text** puts the plain issue back and **Use brief** brings the draft back. Remove the issue and the draft returns to the list. A Sentry error or a GitHub issue opens in the project it belongs to, and one **Start from HBL-412** links the issue, creates the session and starts the work, with a **Follow** toast.

### Start one session from several issues

Up to five issues start one session. In the list a checkbox shows in the glyph slot on hover, and on every row once anything is selected. A click toggles a row, a double click picks that row alone, **Space** toggles the focused row and **Enter** goes to the picked step with the selection. The primary reads **Pick HL-204** for one issue and **Pick 3 issues** for more. A sixth toggle is refused with one line, **Up to 5 issues start one session**.

The picked step stacks the issues. The first names the branch and carries the chip **Names the branch**; removing it moves the chip to the next. **Add another issue** returns to the list with the selection kept. The brief reads **Brief from HL-204 and 2 more** and is written from the whole set, and **Start from HL-204 and 2 more** links every issue to the one session. An issue whose project is not the chosen one says which project it belongs to; it links to the session and can be put on a branch there later. Under the button, **Will close HL-204, HL-211 when merged** lists the issues the session closes.

The selection lives in the draft as `pickedIssues` (see `apps/desktop/src/store/slices/sessionDraft/state.ts`), capped by `maxDraftIssues.ts`, and `startSessionFromDraft` writes every issue through the `externalTasks` of `createSession`, in order.

From Tasks the same flow starts in one press: **Start from HBL-412** on a Linear, Jira, GitHub or GitLab issue or a Sentry error opens this draft with the issue picked and its brief already being written. A Slack thread, a merge request, a Bitbucket pull request or a pull request of yours keeps its one-step panel, with the same verb: **Start from #318**.

### Review a pull request

A pull request waiting on you in Tasks shows **Review pull request** in place of Start. It starts a session on the pull request, with a read-only PR reviewer and the pull request checked out, and opens the **Pull request** tab of the Branch page, where **Write review** waits. Paste a GitHub pull request link in the search box of **Pick up a task** and one row, **Review pull request #318**, does the same. GitLab and Bitbucket reviews are not started this way.

### Run a workflow

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/start-run-workflow-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/start-run-workflow-light.webp" alt="New session with the Run a workflow tab selected: an Orchestrated workflow with the goal Stop retried webhooks posting a second credit, the Orchestrated, Custom and Preset switch, the Plan with an Orchestrator row and example steps Scout, Planner and Implementer, and the Starts Now, Autorun and Spend cap None controls next to Start workflow">
</picture>

<sub>Screenshot from Goodboy 0.15.2</sub>

The full workflow builder, right in the kickoff. Write the goal, pick **Orchestrated**, **Describe steps** or **Pick a workflow**, and read the **Plan** you will run. Under the plan, set **Starts**, when to ask and a **Spend cap**. **Start run** creates the session and starts the run in one step.

### Ask an agent

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/start-ask-agent-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/start-ask-agent-light.webp" alt="New session with the Ask an agent tab selected: a question field reading How does a retried webhook reach the ledger?, the Scout, Auto and payments-api choosers, the note Scout only reads. It changes nothing., and the Start Scout button">
</picture>

<sub>Screenshot from Goodboy 0.13.1</sub>

Map an unfamiliar repo before you plan. **Scout** is the default and only reads, so it changes nothing. Type an area, a file or a question, choose the model and the project, and press **Start Scout**. With an empty field it runs on the whole project. On a broad question the scout can split the search by area, and one report merges what the child scouts found.

### Start blank

Start from the goal instead. **Start blank** sits in the header of every tab and opens the session straight on its Overview, where you add the goal, projects and work.

After starting blank and linking an issue, Overview offers **Write** to draft
a title and goal from the linked issues. The hint appears while the goal is
empty; **Not now** dismisses it for that session. Nothing is generated until
you click. **Write title and goal from linked work** remains available in the
session menu and command palette.

Review and edit the proposal before **Use title and goal**, or **Replace**
when a title or goal already exists. **Dismiss** keeps the current fields.
The proposal uses up to five linked issues. Unreadable issue text uses the title and says so. A failed brief offers
**Retry**. Applying the proposal has one **Undo** for both fields; later edits
are kept if they conflict with Undo. Entry points:
`apps/desktop/src/features/session/components/SessionOverviewPane/GoalTeaser.tsx`
and `apps/desktop/src/store/slices/issue-briefs/applyGoalFromWork.ts`.

### Named by Goodboy

Get a short title without writing one. A new session is named for you and marked **Named by Goodboy** until you rename it.

### Star an issue from Link work

**Link work** links a task to the session only. To keep an issue for the whole
workspace instead, press **Star it** under the issue: it is starred for the
workspace and the toast says "HBL-204 is starred. Find it in Tasks, Starred.",
with Undo. Only tracker issues can be starred (Linear, Jira, Sentry, and GitHub
or GitLab issues, not pull requests or merge requests). An issue that is already
starred shows **Starred** and keeps its state. The Board has no row for these
issues any more: migration m229 turned every task a workspace tracked there into
a star, dated by when it was linked.

### Undo an unlink

Linked task chips open the task directly. Their unlink control appears on hover
or keyboard focus. **Put on a branch** is visible on the branch row, and
**Link work** is the single verb for adding a link. Unlink acts immediately
with a 10-second Undo toast; **Cmd+Z** also undoes the latest app operation
outside text fields. Session unlink removes every branch placement as one
operation, and Undo restores the entire snapshot atomically. A later re-link
makes Undo do nothing and say why. The unlink event keeps **Re-link**.

### Move an issue between the session and a branch

One verb moves an issue: **Move to**. Open the menu of a linked task chip (right
click or Shift+F10), or use the **Linked to** row under the header of an open
issue, and pick **This session** or one of the open branches of the issue's
project. It moves at once, with an Undo toast that names the new place
(**HL-204 is on the session again**). Branch to branch is one move and one
Undo. An issue of another project is refused with the project it belongs to.
The same entries are in the command palette while an issue is open.

On a branch row the chip's x says what it does: **Move to session** when that
branch is the only place, **Take off payments-api / hl/fix-duplicate-credit**
when the issue is somewhere else too. On the session it stays **Unlink from
session**.

Activity shows each linked task once, even across several branches. Tasks
with the same issue number in different projects keep separate rows.
