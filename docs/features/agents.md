# Agents

Talk to agents, watch what they do and steer them while they work. You can ask questions without starting a session, see exactly what each agent was told and cost, and stop or redirect one without losing its work.

### Workspace chat

Ask about the workspace without starting a session. **Chat**, in the sidebar after **Workflows**, reads every project and never changes a file. When an answer is worth acting on, **Start work from chat** drafts a session from it and opens **Start a run** there with the brief, routed like any ask, and chats you stop using move to **Idle** so you can archive them. **Archived** at the foot of the list names itself in the studio bar as **Chat › Archived**, and **Chat** goes back to the list. Once the session is saved, the answer keeps one quiet line, **Started** and the session title, that opens it, and the session's Overview reads **From chat** with the chat's title to take you back. The title, on the same header row and height as every other page, the answers and the message box share one reading column, and every answer names its model beside the provider's mark. An answer writes itself in as it arrives and is there at once when you open the chat again.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/agents-workspace-chat-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/agents-workspace-chat-light.webp" alt="Chat in Harborline, opened from the left column beside the Sessions list: the chat list grouped by Pinned, Today, This week and Idle with Archive idle and Archived 4, and the answer to Where is the consent step defined? as a table of three payments-api files with Read 4 files, Sonnet 5.5 Medium and a Started note under it, above a message box that reads Read only. Nothing is changed.">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Ask in a session

Ask what is happening in a session without leaving it. **Ask**, or **⌘L**, opens a panel that offers a few questions to try. Answers name the agents, runs and files they mention as chips, and the panel is read only, so it never acts for you. Ask and Chat answer the same way: **Stop** keeps what was written and marks the answer stopped, a stop pressed before the provider started means it never starts, and a failure keeps the text so far with its reason.

### Images in chat

Paste, drop or attach images in the chat message box, up to 10 per message, in PNG, JPEG, GIF or WebP. The model reads them with your question, on Claude and on Codex. The image shows as a thumbnail in the message box and in your message, and a click on it opens it large.

### Roles

Give each agent the job it is good at. Nine roles come with the app, **Scout**, **Debug**, **Plan**, **Implement**, **Review**, **Test**, **Resolve**, **Docs** and **Generalist**, and a role sets the agent's instructions, its default model and what it hands back. **Analyze** on a failing check starts the Debugger: it reproduces the failure and proposes one fix, or two or three options with a recommended one, and you start the one you pick.

### Agent header

Find an agent, then read who it is before you read its work. **Runs** in a session lists every run and every agent you started on one aligned grid: state dot, kind, name, origin, state word, progress, cost and age. Under **In progress** what needs you comes first, then what runs, then the rest, newest first inside each, and the group header counts it ("2 need you"). The grid, the page count, the Running card and the Agents tree use the same words, so an agent waiting for a permission reads **Needs permission** in all four instead of Running, one with an open question reads **Needs you**, and a blocked one reads **Blocked** in the amber of a warning. An agent you or a restart stopped stays under **In progress** as **Stopped, Continue** until you close it, and **Resume all** in the group header brings back two or more that a restart stopped. **Finished** holds the done and closed agents, newest first, and a reply you have not read lifts its row and shows a dot. A row opens the agent, its other actions are in the right click menu; a new agent starts from **Start a run** on Runs, or with `@` and a role in its field. On the agent, its role, its task and the mark of the provider it runs on share one row with **View transcript** (it reads **Hide transcript** while open) and its menu, which holds **Rename**, **Stop**, **Close** or **Reopen**, **Let Auto take it from here** (old agents only), **Change model**, the copy actions and **Delete agent**. The header never repeats the agent's state or model: the state is the line at the end of the conversation, and each turn names its model in its footer.

### What the agent received

Check exactly what an agent was told. The top of each chat shows the message and who sent it, and opening it lists the **Goal**, **Plan** and files it carried. **View as sent to** the provider shows the exact text.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/agents-what-received-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/agents-what-received-light.webp" alt="The top of an agent chat: an Also received row with the chips Goal, Plan, 2 files and All, the Asked line holding what the agent was told, and its first answers each reduced to one line such as Searched the code, read applyWebhook.ts">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Agent transcript

Follow one agent's work as one conversation you can write in. Each finished turn says in one quiet line what it did ("Read 4 files, ran 8 commands (2 errors)"), and a click on the line opens the transcript beside the conversation at that turn; then comes the answer, never the running commentary. The answer writes itself in as the turn ends, at a pace that never trails the agent by more than a second and a half, and a click, a selection or find shows it whole. The view stops where the answer starts, so you read from its first line, and the jump button takes you to the bottom. An agent that keeps a task list shows it once, as a checklist that updates in place. The plan, report and wireframe it writes show as chips under its answer, questions and permission requests appear where you answer them, and each subagent is one line, its role, its task and its state, with **Open** showing it beside the conversation. Each turn ends with the same footer, provider mark, model and time, failed or stopped included; its tokens and cost are one click away. **Transcript** on the right shows the steps of every turn under a one line heading: each tool call, file and error, with its input and output. While a turn runs, the line at the end says what the agent does right now ("Running pnpm in payments-api", "Reading webhook.ts", "Editing ledger.ts", "Writing the answer", or "Thinking" when nothing has happened yet) and changes only when the activity does. A message you type shows once, as you wrote it. Text Goodboy writes for an agent (an Auto delivery, a delegated brief) never shows as yours: it sits in one collapsed row, **What Auto was told**, that you can open.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/agents-transcript-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/agents-transcript-light.webp" alt="An Implementer agent in a session of Harborline: its turns each reduced to one line such as Read package.json, ran a command, the checklist Remove node_modules in payments-api, Install with pnpm and Run the export tests, and the Transcript drawer open beside the conversation with each step of the turn">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Agent suggests

When an agent recommends another role, its transcript shows **Agent suggests** with the reason. Pick the provider, model and effort on the card, then press **Start**. The new agent starts with that reason and what the previous agent wrote.

### Queue or send now

Keep talking while an agent works. **Enter** queues your message for its next turn, and **Send now** (**⌘Enter**), in view beside **Queue** for as long as the turn runs, reads it now, interrupting the turn. The queue survives a restart. A queued message stays saved until the provider accepts it, so a refused send puts it back and a crash does not lose it.

### Message and document fields

Write to an agent the same way everywhere. Every message and document field takes markdown with **Write** and **Preview**, and files by paste, drop or **Attach**. A message sends on **Enter** with the same **Send** button in the session, Ask and Chat composers, and a document saves on **⌘Enter**. A refused send puts your message back unless you typed something new meanwhile.

**Agents** in the tool column (⌘⌥L) lists every agent of the session, the same set as the Runs page. Each run and Auto tree has its agents under it, and an agent you started yourself is a launch of one row with its state word. Picking a row opens that agent in the center, on the same page a top-level agent has. The panel stays open with the row selected, so hopping from one agent to the next is one click. With focus on a row of the tree, **j** and **k** do it from the keyboard. A session without agents says "No agents in this session yet".

Each agent row shows its model by name with the effort, muted. It hides when the panel is too narrow to keep the title whole.

### Stop and Continue

Stop an agent without losing its work. While a turn runs, a **Stop** square sits in the message box beside **Send now** and **Queue**, a live chip in the agent header reads **Running** with its clock and a **Stop**, and the line at the end of the conversation keeps its own; all three say one word, **Stop**, and so does the agent's menu, the palette and the Runs header. **Esc** twice stops it too, when no menu, drawer or dialog is open. Stopping keeps what the agent wrote and offers **Continue**. **Stop** waits until the process has exited: the square, the chip and the line read **Stopping** and stay busy, and when the exit takes more than 5 seconds they read **Still stopping** with **Force stop**, which asks again. If Goodboy cannot stop the agent, the agent stays running with the error shown. **Stop all running agents (N)** in the session menu and the palette, and **Stop all (N)** in the **In progress** header of Runs, stop every running agent of the session without asking, since **Continue** brings each back with its work kept, and report "Stopped 4, 1 still running". An agent that was working when you restart or update Goodboy picks up where it stopped, and **Resume all** brings back every one a restart stopped.

### Quiet agents

Tell a working agent from a stuck one. When a running agent has written nothing and used no processor time for 5 minutes, its row says **Quiet for 12 min** instead of showing only the running time. It keeps running until you stop it, and the note clears the moment it writes again. Goodboy looks every 30 seconds and only says it when it can read the processor time of the agent's processes.

### Turn footer

See what each turn cost: the model with its provider mark, the duration and the estimated cost on the line, and tokens, cache share and context window in its detail.

### Tool call states

Tell at a glance what a tool call did: **Running**, **Done**, **Failed**, **Needs permission**, **Stopped** or **Denied**, with elapsed time and readable input and output. A command (Bash, shell) opens to its command as `$ command` and its output in monospace, the output cut to its last 40 lines with **Show all N lines**, and the exit code in the heading when the provider reports one. Under them: **Copy command**, **Copy output**, **Run in terminal** and **Ask about this output**. **Run in terminal** opens a new tab of the session terminal on the folder the agent ran in and types the command; it never presses Enter, and several lines go in as one paste so none of them runs by itself. **Ask about this output** attaches the command and its output to the composer of the agent that ran it, without sending it. A shell block in an agent's message (`bash`, `sh`, `zsh`, `console`, or untagged and starting like a command) shows **Copy** and **Run in terminal** when you rest on it; any other block shows only **Copy**. An archived session keeps **Copy** and drops the other verbs.

### Composer plus menu

Do more from the message box. The **+** opens **Attach files**, **Run a script** (`$`), **Start workflow** (`~`) and **Ask another agent** (`@`). `$` lists your saved scripts and the `package.json` scripts you pinned.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/agents-composer-menu-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/agents-composer-menu-light.webp" alt="The message box of a chat with the plus menu open, listing Attach files, Run a script ($), Run a workflow (~) and Ask another agent (@), next to Ask first and the GPT-5.6 Sol model">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Attach files

Hand an agent images, PDFs, CSV and text files, up to 10 at a time and 10 MB each, by paste, drop or pick. **Ask the agent about this** on a script's output or a terminal adds the text the same way, as a file titled with where it came from, redacted and cut to its last 24,000 characters.

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
- In the **Agents** panel, each Auto conversation is titled by what you asked it. Its agents hang above it on the same rail as **Activity**, newest on top under a **Now** marker.
- When you open a conversation there, a new agent arrives at the top without moving what you are reading.
- A conversation row never folds. A finished one keeps its helpers behind one line under it, such as "3 helpers", with the most urgent state of those helpers beside the count. An agent with helpers of its own folds the same way. Open or fold a line with a click or the arrow keys. A fold opens by itself when a hidden helper needs you.
- The chat shows each agent Auto starts as one card with its role, name, model and state. The whole card opens the agent, by a click or by Enter, and it has no buttons. To stop that agent, right click the card and pick **Stop**. **Working now** above the message field lists running agents, newest first, with their elapsed time. It stays visible while Auto replies. A chip or **Open** reveals the agent in **Agents** and keeps Auto in view.
- When agents report back, each report sits in that agent's card right above Auto's reply. The card shows role, name, model, state and **Open**.
- Auto's reply adds only what the reports mean together. **View plan** shows right there when a Planner finished, with the first steps. Approve it from the plan view.
- Auto's state shows once, at the end, as in **Waiting for Implementer and Tester**.

**Limit and control**

- Set a **Limit** once per workspace.
- Change, raise or remove the **Limit** of a running conversation from the chip line under its title, such as "Limit $0.85 of $5.00 from Harborline". Clear the amount to remove it. **Undo** is there.
- **Change approach** while it waits. It stops Auto and puts you in the message field.
- The smallest limit pauses Auto. A session limit under Auto's own lowers it, and the chip says which one wins.
- An agent's page has the same chip line under its title: how it runs, when it asks you, the session **Limit** and its **Models**. The composer keeps only the message.
- An Auto page shows **Asks you** in that chip line: **Every step**, **After the plan** or **Never**. It starts on the workspace default, a pick changes this Auto only, and it applies to what Auto starts next. An agent already waiting for your go keeps waiting. The message field stays under the conversation at every level.
- When Auto needs a choice, it shows one **Next step** card, never a yes or no question. The proposed agent is the main button, such as **Spawn implementer**, with one or two other options and a hint field. The keys 1 to 3 pick an option once you are in the card. An option other than the first declines the proposal and tells Auto your pick. **Not now** declines and tells nothing.
- When the work rests, Auto reads **Idle**. Only you close it, with **Mark finished** in its header. Writing to it again reopens it.
- When Auto cannot decide its next step, it reads **Blocked** with the reason and a **Retry**. A message you send retries too. The reason shows on two lines at most, and the whole text opens when you point at it or tab to it. **View transcript** opens the conversation.
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
- **Run checks again** on the card repeats them on the same commit from any window.
- When you ask Auto to push, Goodboy pushes the checked commit after the agent finishes and its checks are not red. The card says **Pushed**, **Not pushed** with the reason, or **Waiting for you to confirm**.
- A force push keeps a backup of the online version it replaces. It pushes exactly the commit that was checked and waits for one **Force push** for the whole batch. **Put back** on the card restores the branch online first, then here.
- **Try the push again** appears once, for a failure that can still pass.

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

- Model by name: `modelLineOf` is the one formatter for provider, display name and effort word. An id the catalog does not know keeps its own words (a retired model still reads by name), with the raw id in a tooltip only; "Unknown model" is only for an id with no known provider.
- Who reads it: `agentRanModels`, the Auto child card, the Agents tree row (`SpawnedTreeRow`, hidden under 24rem) and the Runs grid model column. The last three render `AgentModelLine`; the `u30-model-lines` scene shows the rail and the cards.
- Agents tree fold: `foldSpawnedRowsOf` decides which rows fold and `helperUrgencyOf` picks the state shown beside the count; the helper count comes from `runAgentCountOf`. The `u30-agents-fold` scene shows each case.
- Failure links: a failed turn offers **View transcript** next to **Retry** and the drawer opens on the failing call when it is known (`TranscriptErrorRow`); a run that stopped on a human call offers it on its tail. The `u30-failure-reason` and `u30-human-call` scenes show the long Auto reason and the run tail.
- Agent states: `agentStateOf` words an agent for the grid, the page count, the Running card and the Agents tree.
- Auto's running strip: `AutoWorkingNow` uses delegation state and `DelegationClock`; `useAutoTreeActions` names the child in the Agents drawer payload. The `e2-working-now.test.tsx` scene test proves visibility, elapsed time and reveal without changing the main agent.
- Next step card: `AutoNextAction` renders `nextActionOf`; `useNextAction` owns pick, hint, retry and the decline-then-message order; the `c2-next-step.test.tsx` scene test proves the card mounts with no Confirm row.
