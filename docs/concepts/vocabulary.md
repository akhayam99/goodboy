# Vocabulary

> **Read this when** you name something on screen, write a button or menu
> label, rename a word, or touch a guard that checks copy words. **Not for**
> punctuation, casing and help text ([../tone-of-voice.md](../tone-of-voice.md))
> or the state word table ([../concepts.md](../concepts.md#sessions)).

One verb per job, one noun per object, each written once.

## Names live in one place

The names of lenses, roles, handoff sections, session stages, the autonomy
header and the reply length live in `NAMES` (`apps/desktop/src/shared/utils/names.ts`),
and the maps that show them read from there. Check there before a change adds a
word.

- `names.test.ts` fails when a former name is also a current name or sits under
  two names: an alias leads to one place.
- A word that goes away goes into `RETIRED_NAMES` with the word to use instead,
  and `copy-budget.test.ts` fails on it. The shared list is
  `__tests__/regressions/retiredNames.ts`; a unit of a round adds its own file
  under `__tests__/regressions/retired/`, and the guard reads every file there.
- A pattern carries no `^…$` anchor unless the short phrase is a fair part of
  longer copy (Folders, Sign out, Resume), so a longer label with the old phrase
  fails too.
- A renamed label keeps its old name as a ⌘K alias (`formerNamesOf`,
  `FORMER_NAMES`). A former name is a search alias, never a label on a screen.
- A round that adds a word removes one, and the PR description lists both.
- A word that stays and still needs a sentence (workflow, orchestrated,
  artifact) gets a tooltip of six words at most, written once, such as the
  `tooltip` of a mode option in the workflow builder.

## One meaning per word

**workspace** is the container, **project** is a repository it holds on screen
(`project` in code), **folder** is a plain folder only, **session** is the goal,
**agent** is the chat. No screen uses another word for any of these.

- Every surface that creates, adds, lists or manages a repository says project,
  aria-labels included. Counts read **Projects** (`NAMES.projects`, "3 projects,
  1 plain folder"), and the door is **Add project** (`NAMES.addProject`) beside
  **Add a plain folder**. The retired names guard fails `Folders` and `Add
folder` as labels.
- Folder stays in the file picker and for a plain folder.
- **Task** is a work item that lives in another tool (a Linear or Jira issue, a
  GitHub issue or pull request, a Sentry error): what the **Tasks** door lists
  and a task link attaches. A session is never a task, the field that holds its
  goal says **Goal**, and a script that runs and ends is a **Command**.
- A **workflow** is the saved definition in the Workflows library, and it spawns
  runs. It is a **preset** only on a run made from it (**Save as preset**, the
  **Preset run** glyph), and the Guide never says preset. A **plan** is what an
  agent writes before it builds. **Runs** is the session tab that lists its
  runs, and a verb on one execution says run (**Stop run**, **Archive run**,
  **Delete run**).
- **Run**, **Plan**, **Workflow**, **Lead** and **Scout** each have one sentence
  in At a glance and in the Guide's Words chapter; `guideChapters.test.ts` keeps
  them that way.
- **Needs you** is the one name for anything that waits on you, followed by its
  reason ("Needs your answer in step 2"). A tool asks for **permission** (Allow,
  Deny); only a plan waits for **approval**.
- **Asks you** decides how often a run stops for you: **Every step**, **After
  the plan** or **Never**. An agent's permission mode sits under the same chip,
  with **Ask first** as its asking word.
- **Reply length** is **Short**, **Normal** or **Long**; the stored keys
  (`brief`, `normal`, `verbose`) and the provider directive do not change.
  **Brief** stays the agent tab and a text you edit before something starts.
- **Limit** is the most a provider, a run or a session may spend, everywhere it
  shows. The `budget-cap` kind id stays, and stored notifications keep their
  text.
- **Your job** is the About you field; **Role** is what an agent plays.
- A reply is a reply on screen; turn stays in usage detail only.

### Internal words stay in code

The screen says the word the user already knows from git, the file system or
the rest of the app:

| Internal word                    | On screen                                                |
| -------------------------------- | -------------------------------------------------------- |
| mount, branch mount              | branch (repo), plain folder                              |
| mount a project                  | Mount a project in a session, Add project in a workspace |
| fork a mount                     | New branch                                               |
| unmount                          | Unmount for a project, Close branch for one branch       |
| spawn                            | Start (an agent, a reviewer, an implementer)             |
| handoff                          | Suggested next: Implementer, the next brief              |
| cluster                          | part (in a plan), subagent (once it runs)                |
| lens                             | tab                                                      |
| studio                           | the page name alone: Workflows, Impact, Providers        |
| materialize                      | add to this session                                      |
| column, lane, grid, tier, drawer | panel (Close the panel, Reset panel layout)              |

`jargon-copy.test.ts` fails when rendered copy under `features/`,
`app/components/` or `shared/components/` uses an internal word, `help` and
`meta` props included. Its baseline lists only text agents read (prompts, bridge
errors) and can only shrink. The layout words have no guard yet.

## Labels

An action label is a verb and an object in the developer's words: **Rebase on
their commits**, **Abort rebase**, **Restore stashed files**. Never a metaphor
(**Bring them in**) and never a bare verb when the object is not obvious
(**Keep**). `action-labels-say-what-they-do.test.ts` fails on the phrases that
went away.

- Name the git verb the action runs. When it also pushes or rewrites history,
  the label or its line says so, and `actionIntentOf` gives it the caution
  intent.
- An action's `label` keeps the verb and the object (**Pin session**), because
  Search or run lists it out of its context. `menuLabel` names it inside an Open
  or Copy submenu; without one the submenu drops the leading Open or Copy.
- A bare **Open** lives only inside a row that names its target
  (`NAMES.openTranscript`, `NAMES.openAgent`). **Open full page**
  (`NAMES.openFullPage`) stays; **Open full** alone is retired.
- One gesture has one label and one icon in every menu: the map is `VERBS` in
  `shared/utils/verbs.ts`, and `menu-words.test.ts` fails a menu that spells one
  differently.
- A tool runs **in** a tab or an app (**Open in Terminal**); a pull request
  lives **on** a host (**Open on GitHub**). The link of a request is named by
  `copyRequestLinkLabelOf`, never by a literal.
- A copy action exists only where the content is not already selectable.
- An ellipsis follows a label only when an input comes before the action runs
  (**Set limit…**), and a `NAMES` value never carries it, so aliases keep
  matching. A progress word ends in one (**Starting…**).
- `placement: 'palette'` keeps an action in Search or run only
  (`toMenuEntries`). `isInputFirst` is typed on the action and read by nothing
  yet.

## Verbs

### One verb per move

The retired labels fail the retired names guard.

| Verb              | Means                       | Retires                                              |
| ----------------- | --------------------------- | ---------------------------------------------------- |
| Open              | Go to a place               | Open full, View, See, Go to chat, See what it did    |
| Show, Hide        | Fold in place               | Expand, Collapse                                     |
| Follow            | Track what just started     | Open the run                                         |
| Create            | Make a new thing            | Open PR, where it opens the create form              |
| Retry             | Repeat what failed          | Restart step, Retry through Auto, Try the push again |
| Continue          | Go on and keep the work     | Ask it to continue, Resume                           |
| Skip step         | Pass over a step            | Skip and go on                                       |
| Decline           | Refuse the Lead's next step | Discard request                                      |
| Mark as read      | Clear what is new           | Mark all seen, Mark read, Mark all read              |
| Mark as unread    | Show it as new again        | Mark unread                                          |
| Fix with an agent | Give work to an agent       | Hand it to an agent                                  |
| Send to Lead      | Message the active Lead     | Send to Implementer, Fix with the Implementer        |
| Start new Lead    | Start a Lead with the item  | Resolve with the Lead                                |
| Add to message    | Attach to the composer      | Send to the agent                                    |

- A **Send to X** verb always sends; a verb that only attaches is **Add to
  message**. **Message the Implementer** stays: it writes to a named agent and
  hands no work over.
- One obvious Lead is one click. **Send to Lead…** opens a short choice only
  when several Leads fit and none holds the item; with none it is **Start new
  Lead**, with the item attached and no form.
- **Stop step** stays: **Continue** resumes it, so it is not a **Skip step**.
  **Keep working** on a skipped step sends a new turn and does not resume the
  cut one.
- **Start a run** opens the picker; **Start workflow** starts one workflow.
  **Start work** is a former name of **Start a run** only.

### One verb per intention

A button or menu entry takes its verb from this table, and the old verb stays a
⌘K alias:

| Verb           | Means                                              | Retired                                |
| -------------- | -------------------------------------------------- | -------------------------------------- |
| **Delete**     | The object is gone (Undo where it can be)          | Wipe (now **Delete all data**)         |
| **Remove**     | Taken out of a list, it still exists elsewhere     | Detach                                 |
| **Unmount**    | A project leaves the session, Undo mounts it again | Remove from session                    |
| **Unlink**     | Removes a task link, keeps the task in its tool    | Remove link on a task                  |
| **Archive**    | Hidden, restorable                                 | Discard on a run (now **Archive run**) |
| **Disconnect** | Cuts the tie to an account, a tool or a workspace  |                                        |
| **Stop**       | Ends what is running and keeps what it wrote       | Close workflow (now **Stop run**)      |
| **Dismiss**    | Hides a notification or a suggestion               |                                        |
| **Clear**      | Resets filters or a selection                      |                                        |
| **Retry**      | Runs a failed action again                         | Try again                              |

- **Discard** stays for a draft you abandon. **Close** stays for a panel and for
  sending an agent away without deleting it. **Check again** only re-reads a
  state, and **Run again** starts a run that succeeded once more.
- A task link says **Unlink** (`NAMES.unlink`), **Unlinked** in the Undo toast
  and **Re-link** on the Activity event. **Remove link** stays for a project's
  link in Settings. Moving a task between the session and its branches never
  says unlink (**Move to session**, **Take off project / branch**), and its
  toast names the new place. **Link work** is the single linking entry.
- **Stop** is the one name for ending a running turn, in the dock, the right
  click menu and Search or run; the agent header has none. While the process
  exits it reads **Stopping**, and after 5 seconds **Still stopping** with
  **Force stop**. A button that stops more or less than the open agent names
  its scope (**Stop run**, **Stop this reply**).
- A reversible act runs at once and says how to go back. **Stop**, **Archive
  run** and **Remove limit** ask nothing: a stop leaves a toast with
  **Continue** (`offerResume`), the other two a toast with **Undo**. Only a
  delete for good, a send to a host and the loss of written text ask first.

## Pages and settings

- The Settings rail has two groups, **This Mac** and the workspace name, one page
  per job you open Settings for (`appSections.ts`, `workspacePages.ts`). iPhone
  stays out of the rail until a phone is paired. **Updates** is a band at the
  end of Look and alerts, and **Secrets in saved scripts** a band of the
  workspace's Permissions page.
- **Models** is the workspace page that sets what each role runs on. The last
  workspace row, **Run defaults are in Workflows**, opens Workflows, **Every
  run**, which holds the run defaults, the edit mode new sessions start in, the
  Lead and the role models. **Limits** is the backup group that holds the
  limits.
- **Copy context** is the drawer button, **Context window** the share of a model
  window a turn filled, and **What's new** the release notes page.
- **Pair an iPhone** is the one verb that opens the iPhone page, **Edit
  commits** the one name for changing a branch's commits, and **Disconnect** the
  one verb for a provider or tool.
- A dot on a settings row means only that something needs you; a healthy
  provider or tool shows none.
- **Add a plain folder** and **Add existing** put a folder or a repository under
  a project. **Link** stays for tying a ticket to a session or a pull request.
- **The Guide is one page per chapter**: at most 60 words a point, 7 points a
  chapter and 4,000 words in all, pinned by `guideChapters.test.ts`.
- **Impact** and **Monitoring** are doors of their own with a header of one
  title and one meta line; `pageLayout.test.ts` and `secondaryHeaders.test.ts`
  keep every secondary page on that header.
- Every screen follows the task order: the task, then integrations, then code,
  then chat.
- Integrations share the layout, never the logic: a Sentry issue and a GitHub
  pull request use the same page layout component.

## Words we use

- **Show in Finder**: opens a file or folder in the file manager; **Show in
  folder** on Linux (`revealLabelOf` in `shared/utils/revealLabelOf.ts`).
- **In merge queue**: a pull request waiting in its host's merge queue. **No
  pull request** (**No merge request** on GitLab), never No PR.
- **External terminal**: the terminal app outside Goodboy; **Terminal** is the
  one inside it.
- **Delete local branch**: removes the branch from this Mac, never from the
  remote.
- **Message an agent**: the invitation to write to an agent.
- **Fix**: start fixing comments. The count is the comments a fix can start now
  (`Fix 3`), the same on every surface. The drawer's own **Start fix for 3**
  stays.
- **Reply**: answer a thread yourself. **Reply only** drops the code change and
  keeps the reply. **Publish reply** sends a decided reply that did not go out.
  **Resolve** ends a thread without a reply (a note says **Close**).
- **Push**: sends commits (**Retry push** after a failure). **Publish 2
  replies** sends replies without a push. **Sync and retry** is about the remote
  branch that moved, not the base.
- **Apply**: accepts the fixes a run made (**Apply 3 fixes**), never **Apply and
  resolve**.
- **Comment**: the one noun for what a reviewer wrote, in counts too. **Fix
  ready** is a comment whose fix waits for you. **Notes** are comments you write
  on your own diff before they become a review draft.
- **On origin**: the copy of a branch on the remote.
- **The rebase needs you**: a rebase job that stopped.
- **Not ready to merge**: the merge box verdict, then each reason on its own row,
  never the word twice.
- **Rebase on main**: brings the base in, with the base branch's own name.
  **Update 2** is for local clones only.
- **Branch**: a line of work on a project. **New branch** starts one with its
  worktree, **Switch branch** moves, **Close branch** finishes it; the branch and
  its commits stay in the repository.
- **Start**: begin work from a thing, named after it (**Start from HBL-412**,
  **Start from #318**). **Review pull request** is the one exception. Pick the
  issue first with **Pick HBL-412**.
- **Follow**: watch what you started. Anything you start offers it in its toast.
- **Approve**: accept a plan (**Approve** when the run waits for it, **Run plan**
  when it does not).
- **Pin session** and **Unpin session**: keep a session at the top. They are the
  `label`, and every menu shows them.
- **Notifications**: the bell and its list, capitalised everywhere.
- **Send**: the button that sends a message in the composer, Ask and Chat. Its
  tooltip shows the `composer.send` shortcut. While an answer streams the slot is
  **Stop**. A refused send puts the message back in the field unless you typed
  something new (`restoreDraftOnFailedSend`).
