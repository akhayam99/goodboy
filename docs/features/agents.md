# Agents

Talk to agents, watch what they do and steer them while they work. You can ask questions without starting a session, see exactly what each agent was told and cost, and stop or redirect one without losing its work.

### Workspace chat

Ask about the workspace without starting a session. **Chat**, in the sidebar after **Workflows**, reads every project and never changes a file. When an answer is worth acting on, **Start work from chat** drafts a session from it and opens **Start a run** there with the brief, routed like any ask, and chats you stop using move to **Idle** so you can archive them. **Archived** at the foot of the list names itself in the studio bar as **Chat › Archived**, and **Chat** goes back to the list. Once the session is saved, the answer keeps one quiet line, **Started** and the session title, that opens it, and the session's Overview reads **From chat** with the chat's title to take you back. The title, on the same header row and height as every other page, the answers and the message box share one reading column, and every answer names its model beside the provider's mark. An answer writes itself in as it arrives and is there at once when you open the chat again.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/agents-workspace-chat-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/agents-workspace-chat-light.webp" alt="Chat in Harborline, with the sessions rail on the left: the chat list grouped by Pinned, Today, This week and Idle with Archive idle and Archived 4, and the chat Duplicate credit path: a table of three source files with Read 3 files and Sonnet 5.5 Medium, then the question Where should the check go? answered on GPT-6.1 Sol High, above a message box that reads Read only. Nothing is changed.">
</picture>

<sub>Screenshot from Goodboy 0.31.12</sub>

### Ask in a session

Ask what is happening in a session without leaving it. **Ask**, or **⌘L**, opens a panel that offers a few questions to try. Answers name the agents, runs and files they mention as chips, and the panel is read only, so it never acts for you. Ask and Chat answer the same way: **Stop** keeps what was written and marks the answer stopped, a stop pressed before the provider started means it never starts, and a failure keeps the text so far with its reason.

### Images in chat

Paste, drop or attach images in the chat message box, up to 10 per message, in PNG, JPEG, GIF or WebP. The model reads them with your question, on Claude and on Codex. The image shows as a thumbnail in the message box and in your message, and a click on it opens it large.

Images of a message or of a hint show as one row of small thumbnails. What does not fit the row folds into **+N**. The goal keeps every image in view, each with its Remove control. Other files keep their file chip.

Opening one image shows the others in a rail on the left, and the rail follows the image you are on. Press the arrow keys or click a thumbnail to move, and Esc to close. An image that cannot be read shows a quiet placeholder that still opens the viewer.

### Roles

Give each agent the job it is good at. Nine roles come with the app, **Scout**, **Debug**, **Plan**, **Implement**, **Review**, **Test**, **Resolve**, **Docs** and **Generalist**, and a role sets the agent's instructions, its default model and what it hands back. **Analyze** on a failing check starts the Debugger: it reproduces the failure and proposes one fix, or two or three options with a recommended one, and you start the one you pick.

### Agent header

Find an agent, then read who it is before you read its work. **Runs** in a session lists every run and every agent you started on one aligned grid: state dot, kind, name, origin, state word, progress, cost and age. The groups are **Needs you**, **Running**, **Idle**, **Finished** and **Archived**, newest first inside each, and a group header counts its rows from two. The group name is bold and the agent's name leads its row; every other cell is smaller and gray. The grid, the page count, the Running card and the Agents tree use the same words, so an agent waiting for a permission reads **Needs permission** in all four instead of Running, one with an open question reads **Needs you**, and one that stopped without asking reads **Needs you** in the amber of a warning. An agent you or a restart stopped stays under **Idle** as **Stopped** until you close it, its row shows **Continue** (**Connect** when its provider is signed out), and **Continue all** at the top of the page brings back two or more that a restart stopped. **Finished** holds the done and closed agents, newest first, and a reply you have not read lifts its row and shows a dot. A row opens the agent, its other actions are in the right click menu; a new agent starts from **Start a run** on Runs, or with `@` and a role in its field. On the agent, its role, its task and the mark of the provider it runs on share one row with its menu, which holds at most five actions: **Rename**, **Let Auto take it from here** (or **Detach from Auto**, or **Mark finished** on Auto), **Copy last reply** and **Delete agent**. The model control stays on the page. **Show its changes**, **Message this agent**, **Copy name** and **Change model** stay in the right click menu. An agent still named by its role is titled by its brief, and a click on the title opens the full text. A double click on the title renames the agent, a run step or Auto. A step keeps the new name in that run only. A save that fails keeps the old name and shows the error. The header never repeats the agent's state or model: the state is the line at the end of the conversation, and a footer names the model when it changes.

### What the agent received

Check exactly what an agent was told. The top of each chat shows the message and who sent it, and opening it lists the **Goal**, **Plan** and files it carried. **View as sent to** the provider shows the exact text.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/agents-what-received-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/agents-what-received-light.webp" alt="The top of an agent chat: an Also received row with the chips Goal, Plan, 2 files and All, the Asked line holding what the agent was told, and its first answers each reduced to one line such as Searched the code, read applyWebhook.ts">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Agent transcript

Follow one agent's work as one conversation you can write in. Each finished turn says in one quiet line what it did ("Read 4 files, ran 8 commands (2 errors)"), and a click on the line opens **Steps** beside the conversation at that turn; then comes the answer, never the running commentary. The answer writes itself in as the turn ends, at a pace that never trails the agent by more than a second and a half, and a click, a selection or find shows it whole. A message you send sits 40px under the top of the view. The reply grows below it, so the text starts at the top and never piles against the message box. The last line keeps 48px of air above the box. The view does not follow the reply: **Jump to latest** shows when it passes the bottom and takes you to the last line. An answer that arrives while you are at the bottom stops the view where it starts. An agent that keeps a task list shows it once, as a checklist that updates in place. The plan, report and wireframe it writes show as chips under its answer, questions and permission requests appear where you answer them, and each subagent is one line, its role, its task and its state, with **Open** taking you to its page. Every door to an agent or a step lands on that same page. It holds the brief, why it was started, the conversation, what came back and one message box. Each turn ends with a quiet footer with its time. It shows the provider mark and the model once, again when they change, and on a stopped or failed turn. Its tokens and cost are one click away. **Steps** on the right holds only the tool rows of every turn: each tool call and file, with its input and output, and no message and no action. While a turn runs, the line at the end says what the agent does right now ("Running pnpm in payments-api", "Reading webhook.ts", "Editing ledger.ts", "Writing the answer", or "Thinking" when nothing has happened yet) and changes only when the activity does. The conversation reads in one centred 720px column, the message box included. Messages are 15 on 24, and the outcome of a message is a heading. Turns sit 32px apart and the blocks of a turn 16px. A finished answer of plain text shows its first 12 lines with **Show more**, and an answer that holds a code block or a table always shows whole. A heading sits close to the text it opens and 24px under the text before it. Earlier notes stay folded. **Copy** appears at the end of a message when you point at it or tab to it. The right click menu of a message always has it. A message you type shows once, as you wrote it. Text Goodboy writes for an agent (an Auto delivery, a delegated brief) never shows as yours: it sits in one collapsed row, **What Auto was told**, that you can open.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/agents-transcript-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/agents-transcript-light.webp" alt="An Implementer agent in a session of Harborline: its turns each reduced to one line such as Read package.json, ran a command, the checklist Remove node_modules in payments-api, Install with pnpm and Run the export tests, and the Steps drawer open beside the conversation with each step of the turn">
</picture>

<sub>Screenshot from Goodboy 0.31.12</sub>

### Agent suggests

When an agent recommends another role, its transcript shows **Agent suggests** with the reason. Pick the provider, model and effort on the card, then press **Start**. The new agent starts with that reason and what the previous agent wrote.

### Queue or send now

Keep talking while an agent works. **Enter** queues your message for its next turn, and **Send now** (**⌘Enter**), in view beside **Queue** for as long as the turn runs, reads it now, interrupting the turn. The queue survives a restart. A queued message stays saved until the provider accepts it, so a refused send puts it back and a crash does not lose it.

**Send** to an idle agent saves the message the same way first. When it starts at once, you see nothing extra. When it cannot start, it stays above the box as a row that reads **Not delivered**, with the reason on hover and **Retry**. Click the row to put the text back in the box. A message for a stopped agent reads **Sends when you Continue**. A message that reads **Not delivered** keeps that after a reload and waits for **Retry**. Other saved messages start on their own when the session opens, and never twice.

### Message and document fields

Write to an agent the same way everywhere. Every message and document field takes markdown with **Write** and **Preview**, and files by paste, drop or **Attach**. A message sends on **Enter** with the same **Send** button in the session, Ask and Chat composers, and a document saves on **⌘Enter**. What you type in the message box, in **New session** and in an answer to a question survives a reload and an archive, and a send that lands clears it. When every provider is over its limit, a button that sends says so instead of doing nothing.

**Agents** in the tool column (⌘⌥A) shows the tree of the run or Auto you have open. With none open it shows what is live. **All runs** at the foot goes to Runs, the one list of work. An agent you started yourself is a launch of one row with its state word. Picking a row opens that agent in the center and keeps the panel open, so hopping is one click. The panel stays open on every page of the session, and a row never opens it for you. **j** and **k** hop from the keyboard. With nothing live it says "Nothing live right now".

Each agent row shows its model by name with the effort, muted. It hides when the panel is too narrow to keep the title whole.

### One dock

Everything that needs you sits in one block joined to the box you type in. The header keeps the state word, the spend and **Settings**, and the dock says the sentence. A permission asks there, with **Allow and continue**, **Always allow**, **Deny** and a `⋯` for the rarer answers. One line stays in the chat for each answer, such as "Allowed rm -rf node_modules". A question asks there too, with its pager, and the chat keeps "You answered". When two asks wait, the dock shows `1 of 2` and the agent goes on once you answered both. On Auto, a subagent's permission reaches the same dock and names the agent. **Open Implementer** goes to its page.

A failed turn keeps **Retry** in the dock and **Failed here** in the chat. The latter opens its explanation in Steps, even after a later success. On an older failure it shows the reason on hover.

A stopped agent reads **Stopped by you. What it wrote is kept.** with a filled **Continue**, and a stopped subagent offers **Continue**, never **Retry**. Auto's limit, failure and project ask sit there too: **Raise to $20.00**, **Retry**, **Use payments-api**. When a run ends with changes, the dock reads **2 files changed on hl/reinstall-deps** with **Review changes**, and nothing when nothing changed. When this conversation asks nothing and the session waits on you elsewhere, it offers the next item from the Overview, as in **Next: Tester asks · 1 more**. A next step Auto proposes waits there too.

An **Always allow** that could not resume reads **Stopped before your answer** with a filled **Continue**.

A message you send while a permission waits denies it, and your text is the reason the agent reads. The box says so first: **Your message will deny this, with your text as the reason**, and Send reads **Send and deny**, and so does Retry on a **Not delivered** row. On Auto the message goes to the agent that asks, and if that agent can't take it the message comes back to the box with the reason. If the message can't be sent, the ask stays open. A message you queued during the turn waits in the tray while a permission is open, and you can still edit it. It goes on once you answer.

### Stop and Continue

Stop an agent without losing its work. While a turn runs, the dock says what the agent does now, with its clock and one labeled **Stop**. On Auto it names what it stops, as in **Stop Auto and 2 agents**. On a step page it reads **Stop this reply**: the step reads Stopped and the run is paused. A single subagent stops from its right click, or from its own page. **Send now** and **Queue** come with a draft, and the box never moves. The agent header has no **Stop** and no state word. The palette and the right click menu say **Stop** too. **Esc** twice presses that same button, when no menu, drawer or dialog is open. Stopping keeps what the agent wrote and offers **Continue**. A turn that waits on a permission ask stops the same way, and the ask stays undecided. **Stop** waits until the process has exited: the button and the line read **Stopping** and stay busy, and when the exit takes more than 5 seconds they read **Still stopping** with **Force stop**, which asks again. One word halts each thing: **Stop** an agent, **Stop run** a run (it asks first), and **Pause run** exists on the run page only. One word picks it up: **Continue** an agent, a step or a run, and **Continue all** several. If Goodboy cannot stop the agent, the agent stays running with the error shown. **Stop all running agents (N)** in the session menu and the palette, and **Stop all (N)** in the **In progress** header of Runs, stop every running agent of the session without asking, one waiting for your permission included, since **Continue** brings each back with its work kept, and report "Stopped 4, 1 still running". An agent that was working when you restart or update Goodboy picks up where it stopped, and **Continue all** brings back every one a restart stopped.

### Quiet agents

Tell a working agent from a stuck one. When a running agent has written nothing and used no processor time for 5 minutes, its row says **Quiet for 12 min** instead of showing only the running time. It keeps running until you stop it, and the note clears the moment it writes again. Goodboy looks every 30 seconds and only says it when it can read the processor time of the agent's processes.

### Turn footer

See what each turn cost: the model with its provider mark, the duration and the estimated cost on the line, and tokens, cache share and context window in its detail.

### Tool call states

Tell at a glance what a tool call did: **Running**, **Done**, **Failed**, **Needs permission**, **Stopped** or **Denied**, with elapsed time and readable input and output. A command (Bash, shell) opens to its command as `$ command` and its output in monospace, the output cut to its last 40 lines with **Show all N lines**, and the exit code in the heading when the provider reports one. Under them: **Copy command**, **Copy output**, **Run in terminal** and **Ask about this output**. **Run in terminal** opens a new tab of the session terminal on the folder the agent ran in and types the command; it never presses Enter, and several lines go in as one paste so none of them runs by itself. **Ask about this output** attaches the command and its output to the composer of the agent that ran it, without sending it. A code block in an agent's message has its own header with the language on the left and **Wrap** and **Copy** on the right; a shell block (`bash`, `sh`, `zsh`, `console`, or untagged and starting like a command) also shows **Run in terminal**. A long line scrolls inside the block until you turn **Wrap** on. An archived session keeps **Copy** and drops the other verbs.

### Composer plus menu

Do more from the message box. The **+** opens **Attach files**, **Run a script** (`$`), **Start workflow** (`~`) and **Ask another agent** (`@`). `$` lists your saved scripts and the `package.json` scripts you pinned.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/agents-composer-menu-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/agents-composer-menu-light.webp" alt="The message box of a chat with the plus menu open, listing Attach files, Run a script ($), Run a workflow (~) and Ask another agent (@), next to Ask first and the GPT-5.6 Sol model">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Attach files

Hand an agent images, PDFs, CSV and text files, up to 10 at a time and 10 MB each, by paste, drop or pick. **Send to the agent** on a script's output or a terminal adds the text the same way, as a file titled with where it came from, redacted and cut to its last 24,000 characters.

### Drift warning

Hear about it when an agent steps outside its role, like a planner editing files. Goodboy checks each turn against the role and sends a notification.

### Subagents from plan parts

Run a plan part by part. An implementer given a plan splits into one sub-agent per part, shown as 3.1 and 3.2, and a plan can give each part done-when checks and the files it expects to touch.

### Auto agent

Try an agent that picks the roles for you. **Auto** answers a question itself. When there is something to make, it hands the work to a Planner, Implementer, Tester, Reviewer or another role. It picks a model for each and reads what comes back.

Auto is always available. Start it from **Start a run**, which hands one-agent asks to Auto. There is no switch in Settings. Auto shows up as one row in the Overview.

**Where you see it**

- The **Work** list shows Auto, then every agent it started with its state.
- Each agent has a short name for what it does, such as **Review the payments-api side**. Auto gives it, or the first sentence of the task stands in. The role is the glyph beside it.
- The same name shows in the **Agents** panel, the chat lines, the result cards and what Auto reads.
- In the **Agents** panel, each Auto conversation is titled by what you asked it.
- Open a conversation there and Auto sits on top. Its subagents sit below in four groups: **Running**, **Needs you**, **Queued** and **Done**, each with a count of its subagents. Queued holds queued and ready agents; Needs you holds any agent that needs you. One line under the title sums them up, such as "2 running, 1 needs you, 1 queued, 7 done". With no subagent yet there is no summary and no group, only "No agents started yet".
- An agent takes two lines. The first is its name, at most two lines long. The second is its role, then who asked it when another agent did ("from Planner"), then its time. A working agent reads stronger, in medium weight; waiting and done agents read quieter.
- **Done** is folded. Open or fold it with a click or the arrow keys. It stays open while the agent you opened is in it, and once Auto has stopped working and every helper is done. Your choice to open or fold it holds in every other case.
- Inside a group the agent started last comes first, a helper of another agent included. A new agent arrives at the top of its group without moving what you are reading. Keyboard focus stays on a row that changes group.
- In the list of all conversations, a conversation row never folds. A finished one keeps its helpers behind one line under it, such as "3 helpers", with the most urgent state of those helpers beside the count. An agent with helpers of its own folds the same way. A fold opens by itself when a hidden helper needs you.
- The chat shows each agent Auto starts as one line with its role, task, state and elapsed time. The whole line opens the agent, by a click or by Enter, and it has no buttons. To stop that agent, right click the line and pick **Stop**. **Open** on a finished agent reveals it in **Agents** and keeps Auto in view.
- When agents report back, each report sits in that agent's card right above Auto's reply. The card shows role, name, model, state and **Open**.
- Auto's reply adds only what the reports mean together. The plan waits in the dock joined to the message field with **Approve and start Build**, **Ask for changes** and **Open plan**.
- Auto's state shows once, in the dock, as in **Implementer running, Tester queued**.

**Limit and control**

- Set a **Limit** once per workspace.
- Change, raise or remove the **Limit** of a running conversation from **Settings** under its title, such as "Limit $5.00 from Harborline". Clear the amount to remove it. **Undo** is there. When the limit comes from the workspace, the "from Harborline" tag in the popover is a link to the Run defaults.
- A message you send to Auto while it works waits in one list above the message box, in the order you sent it. It stays there until Auto has read it. Each row reads **Waits for this reply**, **Waits for** the task it waits for, or **Not delivered** with the reason on hover. Its images show as small thumbnails. **Send now**, **Retry** or **Change limit** sit on the row. **Edit** or **Remove** take the message back, with its text and images, until Auto has read it. Once it has, the message shows in the chat before the turn that read it.
- The smallest limit pauses Auto. A session limit under Auto's own lowers it, and the chip says which one wins.
- An agent's page, a run's page and an Auto page have the same one line under their title: the state, one sentence, what that agent spent and **Settings**. A running agent shows the state word alone, and an Auto page drops the sentence while its dock says it. **Settings** opens the settings in place: how it runs, when it asks you, the **Limit** and its **Models**. Each setting is plain text with no border. Its border appears when you point at it or tab to it. The composer keeps only the message.
- An Auto page shows **Asks you** in that chip line: **Every step**, **After the plan** or **Never**. It starts on the workspace default, a pick changes this Auto only, and it applies to what Auto starts next. An agent already waiting for your go keeps waiting. The message field stays under the conversation at every level.
- When Auto needs a choice, it shows one **Next step** card, never a yes or no question. The proposed agent is the first option, such as **Spawn implementer**, labeled **Recommended**, with one or two others in one row, and the main button always reads **Continue**. The picked option is filled and outlined. The card is small and plain, and only a small dot says it waits for you. A hint stays hidden until you press **Add a hint**. The keys 1 to 3 and the arrow keys pick an option once you are in the card. An option other than the first declines the proposal and tells Auto your pick. **Not now** declines and tells nothing.
- When the work rests, Auto reads **Idle**. Only you close it, with **Mark finished** in its header menu. Writing to it again reopens it.
- When Auto cannot decide its next step, it reads **Failed** with the reason and a **Retry**. A message you send retries too. The reason shows on two lines at most, and the whole text opens when you point at it or tab to it. **Open transcript** opens the conversation.
- **Stop** and **Retry** work from every Goodboy window. A failure says why under them.

**Hand an agent to Auto**

Use **Let Auto take it from here** in the menu of an agent you started yourself. That means an Implementer, Tester, analysis agent or Generalist that is not part of a Run. Agents that Start a run started never show it.

The **Continue** cards at the end of a finished agent, such as **Continue with Planner**, do the same. The card says what Auto should do next, so the next role starts inside that run. A Next card that names a role sends the same message to the Auto run of the session. When there is none, it starts that role at once. Say what Auto should do next, or leave the field empty and Auto decides from the chat.

The agent keeps its chat and its files, but you can only read it from then on. **Detach from Auto** takes it back. Inside an Auto conversation, the other next-step buttons stay out of the way.

**Checks and push**

- In a project's settings, a script row has a second button, **Use as an Auto check**.
- After an agent that writes finishes on a clean tree, Goodboy runs the scripts you ticked. It runs them one at a time with a 5 minute limit each.
- The agent's card says **Checks green**, **Checks red** with the script names, or **Not checked** with the reason. Auto reads the same line.
- **Not checked** gives one of these reasons: nothing ticked, timed out, the tree changed or has uncommitted changes, or the checks could not run.
- **Retry checks** on the card repeats them on the same commit from any window.
- When you ask Auto to push, Goodboy pushes the checked commit after the agent finishes and its checks are not red. The card says **Pushed**, **Not pushed** with the reason, or **Waiting for you to confirm**.
- A force push keeps a backup of the online version it replaces. It pushes exactly the commit that was checked and waits for one **Force push** for the whole batch. **Put back** on the card restores the branch online first, then here.
- **Retry push** appears once, for a failure that can still pass.

**Safety**

- Goodboy refuses an agent Auto started that asks it to push your branch, open a pull request or merge one. It gives that agent no git host token.
- The agent can read and comment. Its report says what should be pushed.
- When an agent that writes finishes and its branch changed online while it worked, its card says so: "The branch changed online while this agent worked." The report Auto reads says so too. When Goodboy could not check, the card says that instead.
- The files an agent that writes changed include the ones it committed.

**Helpers**

An agent that waits on a question can say it needs a Scout or an Investigator. Auto answers it itself or starts one. The helper shows one level under the agent that waits in the **Work** list, and Auto hands its report back with the answer.

A helper counts as one agent and two attempts of the limit. An agent has two helpers at most.

### History rewriter and Scribe

Let two helpers work on your history and your pull request text without the power to push. **Write with Scribe** in the create form writes the title and description, and you read and edit them before you press Create. If it fails, the card says so and offers **Retry**.

### One language per session

Get agents and summaries in the language of your goal.

## Under the hood

This part is for contributors and agents who change the feature.

- Durable send: `useTurnDispatch` calls `sendAgentMessage`, which writes the row (`enqueueAgentMessage` with `isDirect`, saved as `sending`) and then delivers it through `deliverQueuedTurn` with the `queue:<id>` delivery id. A held row carries `hold.reason`; `queuedRowsOf` draws it as Not delivered with Retry (`retryQueuedMessage`), hides a direct row for its first 500 ms (`directRevealAtOf`) and words a stopped agent's row. `drainSessionQueues` runs after `loadAgentQueues` and skips a held head row, whose hold is saved with the row. The transcript drawer sends through `sendAgentMessage` too. `store.sqlite-send-durable.test.ts` proves one delivery per row across a refusal, a reload, two drains and a crash replay. It also covers a cancelled start and a turn that failed before it started. The `u36-p2-send-held` and `u36-p2-send-stopped` scenes show the rows.
- Refusals: `throwIfRefused` raises `TurnRefused`, whose words come from `turnRefusalMessage` alone (`store/slices/turn/refusal/`). `refusal/turnRefused.test.ts` covers each press.
- Drafts: `storedAgentDraft`, `storedSessionDraftText` and `storedQuestionDrafts` keep the three boxes in local storage; `hydrateAgentDraft` and `hydrateSessionDraft` read them back and never over typed text. Archive keeps `agentDraft`; a delete sweeps it (`evictSession`, `deleteAgent`, `detachWorkflowFromSession`). `deleteTask` reads the agents and open questions from the database first, so an archived or unopened session loses its drafts too. A dismissed question forgets its draft (`storedQuestionDrafts.forget`). `storedQuestionDrafts` writes one question into the stored map, so a second window keeps its own drafts.

- Model by name: `modelLineOf` is the one formatter for provider, display name and effort word. An id the catalog does not know keeps its own words, so a retired model still reads by name. The raw id shows in a tooltip only. "Unknown model" is only for an id with no known provider.
- Who reads it: `agentRanModels`, the Auto child card, the Agents tree row (`SpawnedTreeRow`, hidden under 24rem) and the Runs grid model column. The last three render `AgentModelLine`; the `u30-model-lines` scene shows the rail and the cards.
- Agents tree fold: `foldSpawnedRowsOf` decides which rows fold and `helperUrgencyOf` picks the state shown beside the count; the helper count comes from `runAgentCountOf`. The `u30-agents-fold` scene shows each case.
- Failure links: a failed turn offers **Open transcript** next to **Retry**. The drawer opens on the failing call when it is known (`TranscriptErrorRow`). A run that stopped on a human call offers it on its tail. Both `OrchestratedTailVerb` and `workflowRun.stepTranscript` open the step page and close the drawer. The step page's own **Step actions** menu leaves `workflowRun.stepTranscript` out, because it would reopen the page you are on. An agent page's ⋯ offers **Close** or **Reopen** with its other rows, five at most. The `u30-failure-reason` and `u30-human-call` scenes show the long Auto reason and the run tail.
- Reading column: `PAGE_MEASURE.agent` is `measure`. `ConversationColumn` wraps it for `ChatView`, `ChatInput` and the advance rows.
- Rhythm: `PANE_RHYTHM.transcript` holds the turn and block gaps. `splitTurns` groups the rows of `TranscriptRows` into one list per turn.
- Answer and Copy: the 12 line budget is `READING_BUDGETS.answerClampLines`. Copy is `row-actions` on the message root, which is a `group/row`.
- Anchoring: `useScrollPin` anchors the last `[data-turn]` at `ANCHOR_TOP_PX` when `anchorKeyOf` gives a new key, and `TRANSCRIPT_FLOOR_PX` is the 48 px tail. The `u31-chat-anchoring` scene shows a message just sent.
- Speaker: `TurnFooter` takes a `previousRunId` and names the model only on a change. The `u31-chat-reading` scene shows a long Auto exchange.
- Agent states: `agentStateOf` words an agent for the grid, the page count, the Running card and the Agents tree.
- Header glance and dock: `useConversationGlance` and `conversationAskOf` give both one word, `useConversationAsks` lists what asks; `useAutoTreeActions` opens the child page. `AutoChildEnd` leaves a failed child's Retry to `DockFailureLine`; `p10-agent-page.test.tsx` proves there is one and it retries the child.
- Ask in the chat or the dock: `useAskDock` gives `conversationRows` the asks the dock holds. An ask it does not hold keeps its transcript card in the last turn, which is how a second window answers one. An answer there reaches this window through `agent-turn` on `goodboy:data-changed` and `refreshAgentAsks`, which reads the saved decision and the agent's status. A stopped agent or a later message lapses the ask, so it gets no card.
- Focus after an ask: `useDockAskFocus` sends a focus that fell to the body to the message field of its own box. `focusAgentComposer` targets `data-composer-field`, never a docked answer field.
- Next step card: `AutoNextAction` renders `nextActionOf`; `useNextAction` owns pick, hint, retry and the decline-then-message order. `ChoiceChips` draws the options.
- Next step scenes: the `c2-next-step.test.tsx` scene test proves the card mounts with no Confirm row. The `u31-next-step` scene test holds its height.
- Image strip: `AttachmentStrip` is the one strip for a message (`UserText`), a goal (`GoalAttachmentsStrip`) and a hint (`OrchestratedHintRow`). It lives in `features/attachments/AttachmentStrip/`, outside `components/` and `hooks/`, so other features import it without growing the cross-feature count.
- Strip split: `splitStripImages` is the one split into shown thumbnails and `+N`. It counts the slots from the strip's measured width (`useElementWidth`), with 48 px thumbnails and 8 px gaps, and keeps one slot for `+N`. Until the strip is measured it assumes the right drawer at `RIGHT_DRAWER_MIN` (384 px) less 32 px of padding, six slots. A strip with a removable image never folds.
- Strip reads: `useAttachmentThumbnails` reads the shown row, and the rest when the viewer opens. It numbers every read. A late answer for an old path or an earlier opening is dropped. It releases the entry of an image that left the list, the hidden ones included once the viewer closes.
- Strip viewer: the strip closes the viewer when the open image leaves the list. It takes an optional `viewer`, so a caller can keep the open image above a remount. The composer chips (`PendingAttachmentChip`, `ArtifactAttachmentChip`) keep `AttachmentChip`.
- Image viewer: `ImageLightbox` takes one `src`, or `items` with a `startId` and a `railLabel` for the rail in the `Dialog` panel. `railTargetOf` maps the four arrow keys to the next image and wraps at the ends. The `onKeyDown` of the `Dialog` reads the keys, not a window listener.
- Viewer state: the image shown is kept by id when the list re-renders. The viewer closes, and frees the page scroll, when that image leaves the list. `ImageLightboxRail` scrolls the active item into view.
- Viewer focus: a thumbnail that failed to read stays the same button, so focus has a target. The strip focuses the thumbnail before it opens, so Esc returns focus to it. Each thumbnail carries `data-attachment-control`. `useHintRowState` restores it when a hint row remounts. The strip hands the viewer a `returnFocusTo` that finds the thumbnail again. The `u32-attachments` scene shows the strip and `u32-attachments-viewer` the open viewer.
