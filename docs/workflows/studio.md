# The Workflows studio

> **Read this when** you change how workflows and saved steps are listed,
> imported, restored, edited or titled, or when a preset run starts. **Not
> for** the Every run tab ([rules.md](rules.md)) or the pages of a run
> ([run-pages.md](run-pages.md)).

The Workflows studio keeps the workflows of a workspace. Its tabs are
**Workflows**, **Every run** and **Saved steps** (`StudioHomeTabs`).

## The list

- **New workflow** opens a draft. The page `⋯` holds **Import workflows…** and
  **Restore built-in workflows…** (the `workflowList` kind of the action
  registry).
- Each row opens its workflow; its last cell ("3 runs") opens the runs pane.
  Built-in rows say **Built in**, and **Edited** once you change them.
- **Import** lists the custom presets of every other workspace and copies the
  checked ones at once. A copy whose name is taken gets its workspace name
  added, for example `Settlement replay (Northwind)`.

Goodboy comes with three built-ins: **Refactor** (scout, plan, implement,
test), **Plan and ship** (scout, plan, implement, review) and **Fix a bug**
(investigate, implement, test).

**Restore built-in workflows** asks first and names only the built-ins you
edited or deleted in this workspace. It puts back their name and steps, drops
the steps you added, and leaves your own workflows alone. A built-in whose name
one of your workflows now holds is left out, and one you never had is not
counted as deleted. A new built-in from an update reaches every workspace at
the next launch, unless the name is taken. The ids and the seeder are in
[code-map.md](code-map.md#built-in-rows).

## The workflow page

A row opens the workflow page: the guide fields, the step tree, **Keep steps in
order** and **Models**. A saved workflow autosaves.

- **Draft steps** asks an agent to write the steps from **Use it when** and
  **First, check**. With steps already there it reads **Redraft steps**,
  starts at once, and offers an undo once the new steps land.
- **New workflow** and **Duplicate workflow** open the page for a workflow
  that does not exist yet. It asks for a name first and writes once, on
  **Create workflow**; nothing autosaves before that. **Discard** goes back at
  once and the toast's **Undo** reopens the draft.
- **Models** pins a model on every step of a role, and **Reset** clears it. The
  Lead's per-agent routing reads it as any step pin.
- Renaming a preset gives you a new workflow of your own; the shared preset
  keeps its name.
- **Delete** on a workflow and **Remove** on a saved step act at once with
  **Undo** in the toast.

### Editing a step

Click a step to edit it in place: title, role, instruction and expected output,
and the model.

- Instruction and expected output are markdown fields with **Polish** and
  **Undo polish**.
- The model is **Follow role** (the default, what Auto picks for the role from
  the providers you can use now) or **Pin a model**, with **Reply length** under
  both. A pinned step carries a dot on its row, like an edited one.
- The footer has one primary, **Done**, and a `⋯` with **Duplicate**, **Save
  as step**, **Move up**, **Move down** and **Delete step** (at once, with
  **Undo**). The grip drags a step and its arrow keys move it.
- A step added to a running run opens the same editor (`RunStepDraft`), with
  **Add step** as its primary and **Discard step** in place of Delete.

### Saved steps

**Add step** offers a search, **Blank step**, the built-in steps and the
workspace's saved steps; the pick lands at the end of the tree with its editor
open. **Save as step** saves a step to the workspace, and the **Saved steps**
tab manages them.

- Built-in steps, one per role that works in the repo, cannot be edited or
  removed. **Save a copy** makes a workspace copy that says what it is based
  on.
- A saved step saves once, on **Done** or when you move to another row, never
  on every field.

## Run titles

Each run gets its own title, at most six words, written from the run goal by
the `agent_naming` task model when the run starts. The prompt asks for a verb
plus an object in the language of the goal, inside one tag:
`<title>Block double credits</title>`. Only the tag is read (`titleInTag` in
`@goodboy/db`, plain `indexOf`, no regex).

- A missing, empty or unclosed tag, a title over six words, a sentence that
  reads as the model talking, or a text about the title, role, task or routing
  is discarded. Only the leading phrase of a talk reply is matched, so "Fix
  title generation crash" stays.
- A discarded title falls back to `heuristicAgentTitle` in `@goodboy/db`: the
  first clause of the goal, at most ten words and 60 characters, cut on a word.
- One parser serves run, agent and session titles (`parseGeneratedTitle`, then
  `cleanWorkflowRunTitle`). A stored title goes through the same check when the
  rows load; one that fails shows the goal title and the row is not written.
- A generated write never replaces a name you chose:
  `updateGeneratedWorkflowRunTitle` and `renameSession` with `titleUserEdited`
  false both carry `title_user_edited = 0` in the `WHERE` clause.

Until the title arrives, or when the run has no goal, screens show the workflow
name. An orchestrated run keeps the name generated for its workflow
(`generateWorkflowTitle` renames one that started on the fallback name). You
rename a run from its title on the run page or its row on Runs
(`useRunTitleRename`, `useRunRowRename`).

## When a run starts

A preset run starts as soon as it is attached, unless it was attached queued;
then it waits for **Start run**. A run saved to start **After** another run
starts by itself once that run completes, and **Start run** starts it by hand.
Nothing in the desktop creates a new chained run.

**Asks you** comes from the workspace rules, **Every step** until you change
them:

- **Every step**: the run waits for your go after each step.
- **After the plan**: the run goes on its own but holds once the plan is
  written, until you approve it ([plans.md](plans.md)).
- **Never**: each next step starts by itself.

The words live in `NAMES` (`asksYou`, `everyStep`, `afterThePlan`,
`asksNever`); search finds older names through `FORMER_NAMES`. The choice is
stored as the run's autorun flag plus the run's copy of the rules, and changes
later from the run's **Asks you** chip.
