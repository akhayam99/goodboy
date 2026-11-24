# Agents

Talk to agents, watch what they do and steer them while they work. You can ask questions without starting a session, see exactly what each agent was told and cost, and stop or redirect one without losing its work.

### Workspace chat

Ask about the workspace without starting a session. **Chat**, in the places rail after **Workflows**, reads every project and never changes a file. Your first visit opens a new chat, with the message box ready when you opened Chat yourself. Archive, from the list or the chat header, shows one toast with **Undo**, and ⌘Z does the same; the chat below takes its place. A rename stays open with its error and **Retry** until it saves. When an answer is worth acting on, **Start work from chat** drafts a session from it and opens **Start a run** there with the brief, routed like any ask, and chats you stop using move to **Idle** so you can archive them. **Archived** at the foot of the list names itself in the studio bar as **Chat › Archived**, and **Chat** goes back to the list. Once the session is saved, the answer keeps one quiet line, **Started** and the session title, that opens it. The title, on the same header row and height as every other page, the answers and the message box share one reading column, and every answer names its model beside the provider's mark. An answer writes itself in as it arrives and is there at once when you open the chat again.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/agents-workspace-chat-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/agents-workspace-chat-light.webp" alt="Chat in Harborline, with the places rail on the left and the chat list beside it, grouped by Pinned, Today, This week and Idle with Archive idle and Archived 4, and the chat Where is the consent step defined?: a table of three source files, Read 4 files, Start work from chat and Sonnet 5.5 Medium, above a message box that reads Read only. Nothing is changed.">
</picture>

<sub>Screenshot from Goodboy 0.40.1</sub>

### Ask in a session

Ask what is happening in a session without leaving it. **Ask** in the right rail, or **⌘L**, opens a pane beside the page, and it stays while you move between Overview, Runs, Artifacts and Context. On a narrow window it lies over the right of the page until you close it.

A question to try asks at once. Answers name the agents and files they mention as links, the last answer stays open and earlier ones fold to one line, and **Earlier** brings back a past question. The pane is read only, so it never acts for you. Ask and Chat answer the same way: **Stop** keeps what was written and marks the answer stopped, a stop pressed before the provider started means it never starts, and a failure keeps the text so far with its reason.

### Images in chat

Paste, drop or attach images in the chat message box, up to 10 per message, in PNG, JPEG, GIF or WebP. The model reads them with your question, on Claude and on Codex. The image shows as a thumbnail in the message box and in your message, and a click on it opens it large.

Images of a message or of a hint show as one row of small thumbnails. What does not fit the row folds into **+N**. The goal keeps every image in view, each with its Remove control. Other files keep their file chip.

Opening one image shows the others in a rail on the left, and the rail follows the image you are on. Press the arrow keys or click a thumbnail to move, and Esc to close. An image that cannot be read shows a quiet placeholder that still opens the viewer.

### Roles

Give each agent the job it is good at. Nine roles come with the app, **Scout**, **Debug**, **Plan**, **Implement**, **Review**, **Test**, **Resolve**, **Docs** and **Generalist**, and a role sets the agent's instructions, its default model and what it hands back. **Analyze** on a failing check starts the Debugger: it reproduces the failure and proposes one fix, or two or three options with a recommended one, and you start the one you pick.

### Agent header

Find an agent, then read who it is before you read its work. **Runs** in a session lists every run and every agent you started on one aligned grid: state dot, kind, name, origin, state word, progress, cost and age. The groups are **Needs you**, **Running**, **Idle** and **Finished**, newest first inside each, and a group header counts its rows from two. An archived run leaves Runs and stays on its branch page behind **N archived**. The group name is bold and the agent's name leads its row; every other cell is smaller and gray. The grid, the page count, the Running card and the Agents tree use the same words, so an agent waiting for a permission reads **Needs permission** in all four instead of Running, one with an open question reads **Needs you**, and one that stopped without asking reads **Needs you** in the amber of a warning. An agent you or a restart stopped stays under **Idle** as **Stopped** until you close it, its row shows **Continue** (**Connect** when its provider is signed out), and **Continue all** at the top of the page brings back two or more that a restart stopped. **Finished** holds the done and closed agents, newest first, and a reply you have not read lifts its row and shows a dot. A row opens the agent, its other actions are in the right click menu; a new agent starts from **Start a run** on Runs, or with `@` and a role in its field. On the agent, its role, its task and the mark of the provider it runs on share one row with its menu, which holds at most five actions: **Rename**, **Let the Lead take it from here** (or **Detach from the Lead**, or **Mark finished** on a Lead) and **Delete agent**. The model control stays on the page. **Open in Changes**, **Message this agent**, **Copy name** and **Change model** stay in the right click menu. An agent still named by its role is titled by its brief, and a click on the title opens the full text. A double click on the title renames the agent, a run step or a Lead. A step keeps the new name in that run only. A save that fails keeps the old name and shows the error. The header never repeats the agent's state or model: the state is the line at the end of the conversation, and a footer names the model when it changes.

### One page per agent

Open any agent or step on its own page, in every kind of run. Every door lands there: the Runs grid, the Agents column, a chat card and a notification. The page says who the agent is, why it started, its brief and what came back. Its composer talks to that agent. The panel beside a chat reads **Steps** and keeps the error that **Failed here** points at. A failed child of a Lead has one **Retry** in the dock. The agent menu holds five rows at most.

### Agent and pull request on the Desk

Watch an agent fix what its pull request shows, side by side. On the Desk the agent and the pull request open as two short panels in the place beside the tools, the agent on top. The agent panel holds its conversation, what it does right now and a message box; when it finishes it says **Finished**, and **Open run** opens its page. **Failed here** brings the failed step into view.

The pull request panel shows **Checks**, with the log of the failing check, and **Conversation**, on GitHub, GitLab and Bitbucket. A check outside GitHub Actions shows **Open on** and its host instead of a log. A read that fails says so, with **Retry**. **Open pull request** opens its page. On the Overview the two open one at a time. Each panel has one head, one action and its X, with no crumbs and no back. Rerun and Send stay on the move in the Desk column. A row of Now opens its agent here, and the row of the open agent is selected. The Desk opens again with the agent and the pull request it had.

### What the agent received

Check exactly what an agent was told. The top of each chat shows the message and who sent it, and opening it lists the **Goal**, **Plan** and files it carried. **Show text as sent to** the provider shows the exact text.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/agents-what-received-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/agents-what-received-light.webp" alt="The top of an agent chat: an Also received row with the chips Goal, Plan, 2 files and All, the message the agent was given, and its first answers each reduced to one line such as Searched the code, read applyWebhook.ts">
</picture>

<sub>Screenshot from Goodboy 0.40.1</sub>

### Transcript

Follow one agent's work as one conversation you can write in. Each finished turn says in one quiet line what it did ("Read 4 files, ran 8 commands (2 errors)"), and a click on the line opens **Steps** beside the conversation at that turn; then comes the answer, never the running commentary. The answer writes itself in as the turn ends, at a pace that never trails the agent by more than a second and a half, and a click, a selection or find shows it whole. A message you send sits 40px under the top of the view. The reply grows below it, so the text starts at the top and never piles against the message box. The last line keeps 32px of air above the box, the gap between two turns. The view does not follow the reply: **Scroll to latest** shows when it passes the bottom and takes you to the last line. An answer that arrives while you are at the bottom stops the view where it starts. An agent that keeps a task list shows it once, as a checklist that updates in place. The plan, report and wireframe it writes show as chips under its answer, questions and permission requests appear where you answer them, and each subagent is one line, its role, its task and its state, with **Open** taking you to its page. Every door to an agent or a step lands on that same page. It holds the brief, why it was started, the conversation, what came back and one message box. Each turn ends with a quiet footer with its time. It shows the provider mark and the model once, again when they change, and on a stopped or failed turn. Its tokens and cost are one click away. **Steps** on the right holds only the tool rows of every turn: each tool call and file, with its input and output, and no message and no action. While a turn runs, the line at the end says what the agent does right now ("Running pnpm in payments-api", "Reading webhook.ts", "Editing ledger.ts", "Writing the answer", or "Thinking" when nothing has happened yet) and changes only when the activity does. The conversation reads in one 880px column, centred in the space it has, with the session title, the crumbs and the message box on the same edges. Scrolling up through older turns keeps the line you read still: the turns a screen above and below are drawn before they come into view. The agent's name is the last crumb of the session head. Its state, spend and settings sit on the line under it, with the one action and the menu at its end. A lead's **Agents** column stands beside them, its header on the title line. It draws the agents the way the Activity page does. Each agent is one line on the trace, with its state as the node, its role and its task. A child hangs on an elbow under the agent that started it, and no group folds. Messages are 15 on 24, and the outcome of a message is a heading. Turns sit 32px apart and the blocks of a turn 16px. A finished answer of plain text shows its first 12 lines with **Show more**, and an answer that holds a code block or a table always shows whole. A heading sits close to the text it opens and 24px under the text before it. Earlier notes stay folded. **Copy** appears at the end of a message when you point at it or tab to it. The right click menu of a message always has it. A message you type shows once, as you wrote it. Text Goodboy writes for an agent (a Lead delivery, a delegated brief) never shows as yours. It sits in one collapsed row, **What the Lead was told**, that you can open.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/agents-transcript-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/agents-transcript-light.webp" alt="An Implementer agent in a session of Harborline: its turns each reduced to one line such as Read package.json, ran a command, the checklist Remove node_modules in payments-api, Install with pnpm and Run the export tests, and the Steps drawer open beside the conversation with each step of the turn">
</picture>

<sub>Screenshot from Goodboy 0.40.1</sub>

### Agent suggests

When an agent recommends another role, its transcript shows **Agent suggests** with the reason. Pick the provider, model and effort on the card, then press **Start**. The new agent starts with that reason and what the previous agent wrote.

### Queue or send now

Keep talking while an agent works. **Enter** queues your message for its next turn, and **Send now** (**⌘Enter**), in view beside **Queue** for as long as the turn runs, reads it now, interrupting the turn. The queue survives a restart. A queued message stays saved until the provider accepts it, so a refused send puts it back and a crash does not lose it.

**Send** to an idle agent saves the message the same way first. When it starts at once, you see nothing extra. When it cannot start, it stays above the box as a row that reads **Not delivered**, with the reason on hover and **Retry**. Click the row to put the text back in the box. A message for a stopped agent reads **Sends when you Continue**. A message that reads **Not delivered** keeps that after a reload and waits for **Retry**. Other saved messages start on their own when the session opens, and never twice.

### Message and document fields

Write to an agent the same way everywhere. Every message and document field takes markdown with **Write** and **Preview**, and files by paste, drop or **Attach**. A message sends on **Enter** with the same **Send** button in the session, Ask and Chat composers, and a document saves on **⌘Enter**. What you type in the message box, in **New session** and in an answer to a question survives a reload and an archive, and a send that lands clears it. When every provider is over its limit, a button that sends says so instead of doing nothing.

### Agents column

See every agent of a run beside its page. A Lead run and every agent under it share one page. It keeps one session head and an **Agents** column on the left, like the files of the Changes page. The header reads **Agents** with a count that includes every agent. The first row is the run itself; under it one row per agent with its role, task, state and cost, and the activity trace on its left edge.

- The column opens wide, can be resized and remembers its width. On a narrow window it folds to **Show agents**.
- Picking a row shows that agent's conversation in the middle and marks the row; picking the run row shows the run again. The column keeps its place. **↑** and **↓** move through the rows, **Enter** opens one.
- An agent's page starts with why the Lead started it: the reason for the role, when it is done, what went in, the model and the attempt.
- A note you queued in the composer shows as a row of the tree, with **Edit** and **Remove**.
- A page has one **Stop**. On a running agent it sits in the box you type in, and the line at the end of the conversation leaves it there. **Esc** goes one crumb up.
- An agent says its state with the word of its row: in the head, in the lines of the agents it started and in the column.
- The run reads the same name everywhere: its crumb, the run page and the first row of the column. A deep agent keeps the first crumb and the last two; the crumbs between them fold into one **…** that lists them.
- The box you type in on an agent's page names the model the Lead chose for that agent.

Each agent row shows its model by name with the effort, muted. It hides when the panel is too narrow to keep the title whole.

Rest on an agent's role glyph to read its whole story. The card shows the task in full and its state with the time. Each model it ran on gets a line with the provider's mark and a small effort meter. Then come its start, its tokens and its cost.

### One dock

Everything that needs you sits in one block joined to the box you type in. The header keeps the state word, the spend and the settings, and the dock says the sentence. A permission asks there, with **Allow and continue**, **Always allow**, **Deny** and a `⋯` for the rarer answers. One line stays in the chat for each answer, such as "Allowed rm -rf node_modules". A question asks there too, with its pager, and the chat keeps "You answered". When two asks wait, the dock shows `1 of 2` and the agent goes on once you answered both. On a Lead, a subagent's permission reaches the same dock and names the agent. **Open Implementer** goes to its page.

A failed turn keeps **Retry** in the dock and **Failed here** in the chat. The latter opens its explanation in Steps, even after a later success. On an older failure it shows the reason on hover.

A stopped agent reads **Stopped by you. What it wrote is kept.** with a filled **Continue**, and a stopped subagent offers **Continue**, never **Retry**. The Lead's limit, failure and project ask sit there too: **Raise to $20.00**, **Retry**, **Use payments-api**. When a run ends with changes, the dock reads **2 files changed on hl/reinstall-deps** with **Review changes**, and nothing when nothing changed. A wait elsewhere in the session stays in the agents rail and in **Needs you** at the top, never in this dock. A next step the Lead proposes waits there too.

An **Always allow** that could not resume reads **Stopped before your answer** with a filled **Continue**.

A message you send while a permission waits denies it, and your text is the reason the agent reads. The box says so first: **Your message will deny this, with your text as the reason**, and Send reads **Send and deny**, and so does Retry on a **Not delivered** row. On a Lead the message goes to the agent that asks, and if that agent can't take it the message comes back to the box with the reason. If the message can't be sent, the ask stays open. A message you queued during the turn waits in the tray while a permission is open, and you can still edit it. It goes on once you answer.

### Stop and Continue

Stop an agent without losing its work. While a turn runs, the dock says what the agent does now, with its clock and one labeled **Stop**. On a Lead it names what it stops, as in **Stop Lead and 2 agents**. On that page the button ends the crumb row. On a step page it reads **Stop this reply**: the step reads Stopped and the run is paused. A single subagent stops from its right click, or from its own page. **Send now** and **Queue** come with a draft, and the box never moves. The agent header has no **Stop** and no state word. Search or run and the right click menu say **Stop** too. **Esc** twice presses that same button, when no menu, drawer or dialog is open. Stopping keeps what the agent wrote and offers **Continue**. A turn that waits on a permission ask stops the same way, and the ask stays undecided. **Stop** waits until the process has exited: the button and the line read **Stopping** and stay busy, and when the exit takes more than 5 seconds they read **Still stopping** with **Force stop**, which asks again. One word halts each thing: **Stop** an agent, **Stop run** a run (it acts at once, and the toast offers **Continue**), and **Pause run** exists on the run page only. One word picks it up: **Continue** an agent, a step or a run, and **Continue all** several. If Goodboy cannot stop the agent, the agent stays running with the error shown. **Stop all running agents (N)** in the session menu and Search or run, and **Stop all (N)** at the top of Runs, stop every running agent of the session without asking, one waiting for your permission included, and report "Stopped 4, 1 still running" in a toast whose **Continue** brings back each agent that really stopped, with its work kept. It never touches one that is still running. **Continue** retries only the agents not yet brought back. It skips an agent that has started again. A review fix closes only once its process has exited. A fix stopped in a lane offers **Continue** for every fix the lane closed. A run stopped between steps offers **Continue** for the run. An agent that was working when you restart or update Goodboy picks up where it stopped, and **Continue all** brings back every one a restart stopped.

### Quiet agents

Tell a working agent from a stuck one. When a running agent has written nothing and used no processor time for 5 minutes, its row says **Quiet for 12 min** instead of showing only the running time. It keeps running until you stop it, and the note clears the moment it writes again. Goodboy looks every 30 seconds and only says it when it can read the processor time of the agent's processes.

### Turn footer

See what each turn cost: the model with its provider mark, the duration and the estimated cost on the line, and tokens, cache share and context window in its detail.

### Tool call states

Tell at a glance what a tool call did: **Running**, **Done**, **Failed**, **Needs permission**, **Stopped** or **Denied**, with elapsed time and readable input and output. A command (Bash, shell) opens to its command as `$ command` and its output in monospace, the output cut to its last 40 lines with **Show all N lines**, and the exit code in the heading when the provider reports one. Under them: **Copy command**, **Copy output**, **Run in terminal** and **Ask about this output**. **Run in terminal** opens a new tab of the session terminal on the folder the agent ran in and types the command; it never presses Enter, and several lines go in as one paste so none of them runs by itself. **Ask about this output** attaches the command and its output to the composer of the agent that ran it, without sending it. A code block in an agent's message has its own header with the language on the left and **Wrap** and **Copy** on the right; a shell block (`bash`, `sh`, `zsh`, `console`, or untagged and starting like a command) also shows **Run in terminal**. A long line scrolls inside the block until you turn **Wrap** on. An archived session keeps **Copy** and drops the other verbs.

### Composer plus menu

Do more from the message box. The **+**, named **Add to message**, opens **Attach files**, **Run a script** (`$`), **Start workflow** (`~`) and **Message an agent** (`@`). `$` lists your saved scripts and the `package.json` scripts you pinned.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/agents-composer-menu-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/agents-composer-menu-light.webp" alt="The message box of a chat with the plus menu open, listing Attach files, Run a script ($), Start workflow (~) and Ask another agent (@), next to Ask first and the GPT-5.6 Sol model">
</picture>

<sub>Screenshot from Goodboy 0.40.1</sub>

### Attach files

Hand an agent images, PDFs, CSV and text files, up to 10 at a time and 10 MB each, by paste, drop or pick. The reply to an agent takes them too. **Add to message** on a script's output or a terminal adds the text the same way, as a file titled with where it came from, redacted and cut to its last 24,000 characters.

### Drift warning

Hear about it when an agent steps outside its role, like a planner editing files. Goodboy checks each turn against the role and sends a notification.

### Subagents from plan parts

Run a plan part by part. An implementer given a plan splits into one sub-agent per part, shown as 3.1 and 3.2, and a plan can give each part done-when checks and the files it expects to touch.

### Lead

A Lead plans a run, hands the work to helpers and asks you only for what your [permission rows](start.md#permission-rows) say. It answers a question itself. When there is something to make, it hands the work to the narrowest role that fits. That is a CI fixer for a red check, a Scribe for pull request text, a Tester for tests, and Docs for the README or changelog. The Implementer is the fallback for code changes. It picks a model for each and reads what comes back.

When the provider a role would use is at its usage limit, the work moves to another connected provider on a model you have not hidden. A Scout, a Planner, an Investigator or a Reviewer can run wherever the Lead can, Cursor included. A role that writes code runs only on Claude or Codex. When no provider can take a role, the Lead hears each provider and why. It reads "Claude: usage limit until 16:10. Cursor: runs only reading roles for Auto." and points to Settings › Models.

A new Implementer child whose task fits a narrower role is refused once, with the role named. The Lead can resend it with a reason, and the child page shows **Why not Tester** under why the Lead chose Implementer.

Every new run from **Start a run** has a Lead, unless you named one role. There is no switch in Settings. Its row on Runs and in the Overview reads "Lead", or "Lead · plan Fix flaky tests" when it follows a preset. A run started from review comments reads "From comment LedgerPage.tsx:24", or "From 2 comments".

**The Lead page**

- A Lead reads the same words as every other row: **Running**, **Needs you**, **Idle**, **Stopped** or **Done**. A plan that waits for you reads **Needs approval**. The reason for a wait, a question, the limit or a failure, stands next to it.
- The Lead page is the page of its run, inside Runs. It shows the chat and the tree of its agents. For the agent you select it also shows the record of what it was given at launch. Under 860 pixels of width the tree opens from the **Agents** count in the header.
- A run started from review comments opens with **From N comments**. Each comment is quoted with its source and whether it is still open. **Open comment** opens it on its branch.
- Write to a Lead while its agents work and the note goes in at once. Its tree row reads **Not read yet**, then **Read at turn 3**, and you can still edit or remove it until it is read.
- An ask to push, open a pull request, add a dependency or change a protected file appears in the action bar. It has one main answer and one quiet one.
- With **Close the work** at Lead, a Lead that decides the work is done ends in **Finished**, once no agent is open and nothing waits. A message from you opens it again.
- ⌘K lists one row per open Lead, and the [Board](board.md#session-card) shows which session waits for you. There is no Work page: a window left on it opens on the Board.

**Where you see it**

- The **Agents** column shows the Lead, then every agent it started with its state.
- Each agent has a short name for what it does, such as **Review the payments-api side**. The Lead gives it, or the first sentence of the task stands in. The role is the glyph beside it.
- The same name shows in the **Agents** column, the chat lines, the result cards and what the Lead reads.
- Each Lead conversation is titled by what you asked it.
- Open a conversation and the Lead sits on top of its column. Its subagents sit below in four groups: **Running**, **Needs you**, **Queued** and **Done**, each with a count of its subagents. Queued holds queued and ready agents; Needs you holds any agent that needs you. One line under the title sums them up, such as "2 running, 1 needs you, 1 queued, 7 done". With no subagent yet there is no summary and no group, only "No agents started yet".
- A Lead can hand work to as many agents as it wants. Four run at once. The others wait under **Queued**, and each starts by itself when a running one ends. **Stop** clears the queued ones too.
- An agent takes two lines. The first is its name, at most two lines long. The second is its role, then who asked it when another agent did ("from Planner"), then its time. A working agent reads stronger, in medium weight; waiting and done agents read quieter.
- **Done** is folded. Open or fold it with a click or the arrow keys. It stays open while the agent you opened is in it, and once the Lead has stopped working and every helper is done. Your choice to open or fold it holds in every other case.
- Inside a group the agent started last comes first, a helper of another agent included. A new agent arrives at the top of its group without moving what you are reading. Keyboard focus stays on a row that changes group.
- In the list of all conversations, a conversation row never folds. A finished one keeps its helpers behind one line under it, such as "3 helpers", with the most urgent state of those helpers beside the count. An agent with helpers of its own folds the same way. A fold opens by itself when a hidden helper needs you.
- The chat shows each agent the Lead starts as one line with its role, task, state and elapsed time. The whole line opens the agent, by a click or by Enter, and it has no buttons. To stop that agent, right click the line and pick **Stop**. **Open** on a finished agent reveals it in **Agents** and keeps the Lead in view.
- When agents report back, each report sits in that agent's card right above the Lead's reply. The card shows role, name, model, state and **Open**.
- The Lead's reply adds only what the reports mean together. The plan waits in the dock joined to the message field with **Approve and start Build**, **Ask for changes** and **Open plan**. Approving from the dock or from the plan drawer clears that bar at once, in every window, and the Lead moves on to Build. A second approve of the same version does nothing. An approve of a version that is no longer current is refused and names the current one.
- While the plan waits, a message to the Lead is a request for changes. **Ask for changes** puts the cursor in the same field. The Lead reads the message at once. With two plans waiting, the Lead asks which one you mean. A message sent while the Lead is working waits in the queue as any other.
- While a change is read or a Planner writes a new plan, the dock reads **Updating plan v1 to v2**. A Planner that only waits for your go leaves plan v1 waiting. Approve and **Ask for changes** stay disabled, and hovering says why. When the Next step already asks for that change, Approve is left out so **Continue** stays the one primary. Then the dock asks for **Plan v2**, and v1 reads **Superseded**. A failed Planner reads **Plan v2 failed** with **Retry plan v2** and **Keep plan v1**. A discarded plan or Planner never asks.
- The Lead's state shows once, in the dock, as in **Implementer running, Tester queued**. While any agent waits on you the run reads **Needs you** everywhere, and the dock keeps only its actions.
- An agent that cannot finish comes back to the Lead at once, while the others keep working. The Lead must decide about it: go on with it, give the task to another role, let it go with a reason, or ask you with a **Next step** card. An agent comes back twice at most, and a task is handed over three times at most before the Lead asks you.
- Each task goes to the narrowest role that fits: a red check to a CI fixer, the pull request to a Scribe, tests to a Tester, docs to Docs. The Implementer changes code. When the Lead keeps an Implementer for work a narrower role fits, the agent's page says why, as in **Why not Tester**.
- The Lead talks to the agents it started. It can give one that ended new instructions, and it keeps its role and its work. It can send a working one a message, which the agent reads when its turn ends. It can stop one. The line reads **Stopped by the Lead** with the reason. It sends one agent four messages at most.
- The Lead also tidies its own work, so the run never waits for nothing. It can close an agent as done, mark a step skipped, or discard an agent. A discarded agent leaves the column, and its conversation is kept. A working agent stops first. The agent's line reads **Closed by the Lead**, **Skipped by the Lead** or **Discarded by the Lead**, with the reason, and a skipped step counts as done.
- The Lead can drop a plan it replaced. When you approve plans, the dock asks first, as in **The Lead wants to drop plan v1**, with **Drop plan v1** beside **Approve and start Build**. Otherwise the plan goes at once. A dropped plan no longer asks for approval, and the dock shows the newest plan that waits.
- When you ask for a new plan, the Lead makes the next version of the same plan, so the dock reads **Plan v2 needs approval**.
- When you write to an agent the Lead started, your message goes on with that agent's work, in its role and on its model. The answer goes to the Lead. While the agent works, your message waits for its turn to end.

**Limit and control**

- Set a **Limit** once per workspace.
- Change, raise or remove the **Limit** of a running conversation from its word under the title, such as "Limit $5.00". Clear the amount to remove it. **Undo** is there. When the limit comes from the workspace, the "from Harborline" tag in the popover is a link to the Runs page in Settings.
- A message to the Lead takes the same files as the session chat, a PDF included, and the Lead reads them with your words.
- A message you send to the Lead while it works waits in one list above the message box, in the order you sent it. It stays there until the Lead has read it. Each row reads **Waits for this reply**, **Waits for** the task it waits for, or **Not delivered** with the reason on hover. Its images show as small thumbnails, and the count on the row names every file. **Send now**, **Retry** or **Change limit** sit on the row. **Edit** or **Remove** take the message back, with its text and files, until the Lead has read it. Once it has, the message shows in the chat before the turn that read it.
- The smallest limit pauses the Lead. A session limit under the Lead's own lowers it, and the chip says which one wins.
- An agent's page, a run's page and a Lead page have the same one line under their title: the state, one sentence, what that agent spent and its settings. A Lead reads "Stops after the plan · Ask first · Limit $10.00", an agent "Ask first · No limit". A running agent shows the state word alone, and a Lead page drops the sentence while its dock says it. Each word is underlined with dots and opens one choice; its tooltip says what it changes. Nothing unfolds above the chat. The model is picked in the message box, beside **Send**.
- A Lead page shows **Asks you** in that chip line, which opens its permission rows. It starts on the workspace default, a pick changes this Lead only, and it applies to what the Lead starts next. An agent already waiting for your go keeps waiting. The message field stays under the conversation at every level.
- When the Lead needs a choice, it shows one **Next step** card, never a yes or no question. The proposed agent is the first option, such as **Spawn implementer**, tagged **Recommended**. One or two others follow, one row each, and the main button reads **Continue**. The picked option is filled and outlined. The card is small and plain, and only a small dot says it waits for you. A hint stays hidden until you press **Add a hint**. The keys 1 to 3 and the arrow keys pick an option once you are in the card. An option other than the first declines the proposal and tells the Lead your pick. **Not now** declines and tells nothing.
- A Lead goes on while your settings allow it. Its limit stops it: "The run reached its limit." with **Raise limit**.
- A few health checks stop it too, each with its sentence on the page. Three replies that leave the work where it was: "The Lead replied 3 times with no next step." with **Retry**. With no limit set, six returns in 30 minutes: "Agents came back to the Lead 6 times in 30 minutes with no limit set."
- An agent of a Lead has no time limit. One that shows no output for 30 minutes, with no tool still running, reads **Needs you**: "No output for 30 minutes." with **Retry**. An agent waiting on a question waits as long as you need.
- An agent that keeps coming back, or a task handed over again and again, ends in **Needs you** with its reason.
- Two helpers of one agent run at once. A third waits under **Queued** and starts when one is done. It leaves if the agent stops waiting for it.
- When the work rests, the Lead reads **Idle**. **Mark finished** in its header menu closes it, and writing to it again reopens it.
- When the Lead cannot decide its next step, it reads **Failed** with the reason and a **Retry**. A message you send retries too. The reason shows on two lines at most, and the whole text opens when you point at it or tab to it. **Open transcript** opens the conversation.
- **Stop** and **Retry** work from every Goodboy window. A failure says why under them.

**Hand an agent to a Lead**

Use **Let the Lead take it from here** in the menu of an agent you started yourself. That means an Implementer, Tester, analysis agent or Generalist that is not part of a Run. Agents that Start a run started never show it.

The **Continue** cards at the end of a finished agent, such as **Continue with Planner**, do the same. The card says what the Lead should do next, so the next role starts inside that run. A Next card that names a role sends the same message to the Lead run of the session. When there is none, it starts that role at once. Say what the Lead should do next, or leave the field empty and the Lead decides from the chat.

The agent keeps its chat and its files, but you can only read it from then on. **Detach from the Lead** takes it back. Inside a Lead conversation, the other next-step buttons stay out of the way.

**Checks and push**

- In a project's settings, a script row has a second button, **Use as an Auto check**.
- After an agent that writes finishes on a clean tree, Goodboy runs the scripts you ticked. It runs them one at a time with a 5 minute limit each.
- The agent's card says **Checks green**, **Checks red** with the script names, or **Not checked** with the reason. The Lead reads the same line.
- **Not checked** gives one of these reasons: nothing ticked, timed out, the tree changed or has uncommitted changes, or the checks could not run.
- **Retry checks** on the card repeats them on the same commit from any window.
- When you ask the Lead to push, Goodboy pushes the checked commit after the agent finishes and its checks are not red. The card says **Pushed**, **Not pushed** with the reason, or **Waiting for you to confirm**.
- A force push keeps a backup of the online version it replaces. It pushes exactly the commit that was checked and waits for one **Force push** for the whole batch. The button reads **Pushing** while it works, and it still reads so after a reload or in a second window. Then the row shows each branch in place: pushed, **Not pushed**, or the reason with **Retry push**. **Undo force push** on the card restores the branch on origin first, then here.
- A push that Goodboy lost by closing mid way turns into a failure with **Retry push**. That waits until it has been pushing for 100 minutes, longer than the three network steps of a push can take. A second window never cuts a push that is still running. A push that ran but whose result could not be saved is reported, and Goodboy keeps trying to save the real result until it can. If a restart comes first, it ends the same way as a lost push. Both show their reason and **Retry push** even when it was the first push.
- **Retry push** appears once, for a failure that can still pass. If the retry is held again, the row stays with the new reason.

**Safety**

- Goodboy refuses an agent the Lead started that asks it to push your branch, open a pull request or merge one. It gives that agent no git host token.
- The agent can read and comment. Its report says what should be pushed.
- When an agent that writes finishes and its branch changed online while it worked, its card says so: "The branch changed online while this agent worked." The report the Lead reads says so too. When Goodboy could not check, the card says that instead.
- The files an agent that writes changed include the ones it committed.

**Helpers**

An agent that waits on a question can say it needs a Scout or an Investigator. The Lead answers it itself or starts one. The helper shows one level under the agent that waits in the **Agents** column, and the Lead hands its report back with the answer.

A helper counts as one agent and two attempts of the limit. An agent has two helpers at most.

### History rewriter and Scribe

Let two helpers work on your history and your pull request text without the power to push. **Write with Scribe** in the create form writes the title and description, and you read and edit them before you press Create. If it fails, the card says so and offers **Retry**.

### One language per session

Get agents and summaries in the language of your goal.

## Under the hood

This part is for contributors and agents who change the feature.

- Chat archive and rename: every archive in `features/workspace-chat` goes through `offerArchiveUndo`, the `undoable` toast that restores the chats and opens the open one again in Chat, from any studio. The undo drops itself once the chats left Archived, and selects only a chat that came back (`offerArchiveUndo.test.ts`). `nextChatAfter` picks the chat below, then above, in the list order of `chatOrderOf`, or in the Archived order for an archived chat (`ChatStudio.test.tsx`). A row renames through `useInlineRename` and `TitleField`. The first visit autofocuses only when `isUserActivated` says a click or a key opened it, so a restore at launch leaves the focus alone (`ChatStudio.test.tsx`).
- Lead: the screens say Lead, the code keeps the engine name auto (role `auto`, `auto_trees`, `features/auto/`); [docs/auto.md](../auto.md#names) maps one to the other. The five words come from `leadStopOf` in `packages/core/src/auto/leadStopOf.ts`, through `autoTreeWordOf`. The ⌘K rows are `leadEntries` over `workRowsOf`, read by `loadWorkLeads` from `listAutoWorkTreesOfWorkspace` in `packages/db/src/queries/auto-work-trees.ts`. A saved `work` studio folds to the Board in `withoutRemovedPages`. Asks are listed by `leadAsksOf`, answered by `answerAsk` and drawn in `AutoDockAsk`.
- Desk pair: the pull request is the drawer kind `pull-request` (mount, tab, check). `slotAfterOpen` keeps a `transcript` and a `pull-request` of one session as the pair (`deskStackOf`). The tool stays in the grid beside them. `shownDeskStackOf` draws the pair only on the Desk face. There `DrawerHost` draws it with `DeskDetailStack`, and `selectSlotBack` draws no back chip for it.
- Desk agent: a lone `transcript` on the Desk is `DeskAgent`. It takes the `turn` and `toolUseId` of the request and reveals them through `useRevealToolCall`. `NowSection` opens a row's agent as a panel on the Desk and selects it (`deskAgentIdOf`).
- Desk pull request: `DeskPr` reads its request, checks and comments through `useDeskPrSource`. GitHub reads the mount detail; GitLab and Bitbucket read `usePullRequestView` and the source threads. Missing detail is asked for, and a failed read shows Retry. The failing check's log comes from `useCheckLog` (`fetchFailedCheckLog`, the latest answer only); with no log, `DeskCheckLog` names the host of the check link (`remoteHostNameOf`).
- Desk saved: the window place never saves a `pull-request` (`UNSAVED_DRAWER_KINDS`), so the previous release still opens it. The row keeps the shown readers in an optional `detail` field, never the back chip (`deskDetailOf`, `storedDockGridOf`, `parseStoredDeskDetail`). `appliedDockGrid` opens them again only when the Desk is the face once the read returns (`recallDockGrid`). It skips them when something else took the place meanwhile. `deskStack.test.ts`, `storedDeskDetail.test.ts`, `deskDetailSaved.test.ts`, `columnYields.test.ts`, `DeskPr/index.test.tsx` and the `u50-desk-kinds` scenes cover each case.
- Comment runs: `sessionRunsOf` takes `commentPlaces` (from `commentRunPlacesOf`) and `commentRunOriginOf` words the origin of a `comment_run` agent. `CommentRunSources` draws From N comments in the Lead page `context` slot from `commentRunHeadsOf` (`sessionRunsOf.test.ts`, scene `u47-comment-run-working-page`).
- Durable send: `useTurnDispatch` calls `sendAgentMessage`, which writes the row (`enqueueAgentMessage` with `isDirect`, saved as `sending`) and then delivers it through `deliverQueuedTurn` with the `queue:<id>` delivery id. A held row carries `hold.reason`; `queuedRowsOf` draws it as Not delivered with Retry (`retryQueuedMessage`), hides a direct row for its first 500 ms (`directRevealAtOf`) and words a stopped agent's row. `drainSessionQueues` runs after `loadAgentQueues` and skips a held head row, whose hold is saved with the row. The transcript drawer sends through `sendAgentMessage` too. `store.sqlite-send-durable.test.ts` proves one delivery per row across a refusal, a reload, two drains and a crash replay. It also covers a cancelled start and a turn that failed before it started. The `u36-p2-send-held` and `u36-p2-send-stopped` scenes show the rows.
- Child routing: `resolveChildRouting` takes the role's pool from `autoChildPool`. `autoChildProviders` gives `AUTO_OWN_PROVIDERS` to a reading role and `AUTO_WRITER_CHILD_PROVIDERS` to a writer. The role default is resolved only over providers not cooling down or over budget. A blocked child gets `childRoutingRefusal`. `ensure_auto_child` in `providers/cli_probe.rs` checks the same split at spawn. `resolveChildRouting.test.ts` runs the usage limit case on the real store.
- Refusals: `throwIfRefused` raises `TurnRefused`, whose words come from `turnRefusalMessage` alone (`store/slices/turn/refusal/`). `refusal/turnRefused.test.ts` covers each press.
- Drafts: `storedAgentDraft`, `storedSessionDraftText` and `storedQuestionDrafts` keep the three boxes in local storage; `hydrateAgentDraft` and `hydrateSessionDraft` read them back and never over typed text. Archive keeps `agentDraft`; a delete sweeps it (`evictSession`, `deleteAgent`, `detachWorkflowFromSession`). `deleteTask` reads the agents and open questions from the database first, so an archived or unopened session loses its drafts too. A dismissed question forgets its draft (`storedQuestionDrafts.forget`). `storedQuestionDrafts` writes one question into the stored map, so a second window keeps its own drafts.

- Model by name: `modelLineOf` is the one formatter for provider, display name and effort word. It keeps the level and the model's axis for the role card's meter (`effortLevel`, `effortLevels`, `modelLineOf.test.ts`). An id the catalog does not know keeps its own words, so a retired model still reads by name. The raw id shows in a tooltip only. "Unknown model" is only for an id with no known provider.
- Who reads it: `agentRanModels`, the Auto child card and the Runs grid model column, which renders `AgentModelLine`; the `u30-model-lines` scene shows the cards.
- Role card: `RoleCard` (`features/workTreeModel/RoleCard`) wraps the role glyph, and `AgentRoleCard` feeds it a timeline row. The pure `roleCardSpec` builds its task, state line, model lines and facts. `FactCard` draws them with `EffortMeter` (`RoleCard/index.test.tsx`, `FactCard/parts.test.tsx`). The `timeline-cards` scene and its light twin show it.
- Failure links: a failed turn offers **Open transcript** next to **Retry**. The drawer opens on the failing call when it is known (`TranscriptErrorRow`). A run that stopped on a human call offers it on its tail. Both `OrchestratedTailVerb` and `workflowRun.stepTranscript` open the step page and close the drawer. The step page's own **Step actions** menu leaves `workflowRun.stepTranscript` out, because it would reopen the page you are on. An agent page's ⋯ offers **Close** or **Reopen** with its other rows, five at most. The `u30-failure-reason` and `u30-human-call` scenes show the long Auto reason and the run tail.
- Reading column: `PAGE_MEASURE.agent` is `reading` (`--reading`). `ConversationColumn` wraps it for `ChatView`, `ChatInput` and the advance rows; `AgentHeadSlots` claims it for the session head.
- Smooth scroll: `useRowPreload` marks rows a screen above and below the view (`data-row-near`), which turns off their `content-visibility` skip, and `rowEstimatePx` sizes a finished answer at its clamp.
- Rhythm: `PANE_RHYTHM.transcript` holds the turn and block gaps. `splitTurns` groups the rows of `TranscriptRows` into one list per turn.
- Answer and Copy: the 12 line budget is `READING_BUDGETS.answerClampLines`. Copy is `row-actions` on the message root, which is a `group/row`.
- Anchoring: `useScrollPin` anchors the last `[data-turn]` at `ANCHOR_TOP_PX` when `anchorKeyOf` gives a new key, and `TRANSCRIPT_FLOOR_PX` is the 24 px tail. The `u31-chat-anchoring` scene shows a message just sent.
- Speaker: `TurnFooter` takes a `previousRunId` and names the model only on a change. The `u31-chat-reading` scene shows a long Auto exchange.
- Agent states: `agentStateOf` words an agent for the grid, the page count, the Running card and the Agents tree.
- Run cost: `runCostUsdOf` gives the Runs grid row and a step run's page one cost. An agent's spend already holds its helpers (`agentSpendById`), so it adds only the agents whose parent is outside the run (`runCostUsdOf.test.ts`).
- Header glance and dock: `useConversationGlance` and `conversationAskOf` give both one word, `useConversationAsks` lists what asks; `useAutoTreeActions` opens the child page. `AutoChildEnd` leaves a failed child's Retry to `DockFailureLine`; `p10-agent-page.test.tsx` proves there is one and it retries the child. It also leaves Stop to the dock whenever the dock draws one (`isAgentStopInDockOf`, which `isAgentStopInDockOf.test.ts` holds to `conversationStopOf`). An Auto child's head word, its rail row and the lines of the agents it started (`DelegationLines`) read `autoChildStatusOf`. That is the status of its last delegation, and `delegationGlanceOf` turns it into the head glance. The run name is `autoRunTitleOf` for the crumbs (`placeTitleOf`), the run page crumb and the rail root row. `run-agent.test.tsx` checks all of it on the run page scenes.
- Ask in the chat or the dock: `useAskDock` gives `conversationRows` the asks the dock holds. An ask it does not hold keeps its transcript card in the last turn, which is how a second window answers one. An answer there reaches this window through `agent-turn` on `goodboy:data-changed` and `refreshAgentAsks`, which reads the saved decision and the agent's status. A stopped agent or a later message lapses the ask, so it gets no card.
- File drop: `useFileDropTarget` counts a `data-drop-composer` box only when the user can see it. A box in an inert or hidden layer is no target: the page kept under an agent page, a section page or a drawer. The one box on screen takes a drop anywhere. `fileDrop.test.tsx` drops an image on the agent page while the Runs page under it keeps its own box.
- Prompt field files: a `PromptField` without `files` has no paperclip and no drop target, and it ignores a pasted image. Every message box passes the files of `usePromptFiles` or `useAttachments`. The reply to an agent sends them through `useTranscriptReply` (`followUpAttach.test.tsx`). A paste reads `clipboardData.items` when the file list is empty (`pastedFilesOf`).
- Draft restore: `useAttachments` merges the stored draft into what the box holds. It clears the box only when the agent changes. An image pasted before the worktree is known, or during the read, stays (`useAttachments.test.ts`).
- Focus after an ask: `useDockAskFocus` sends a focus that fell to the body to the message field of its own box. `focusAgentComposer` targets `data-composer-field`, never a docked answer field.
- Force push row: `PublishRunRow` draws `publishRowsOf`, and `publishLineOf` gives the row and the result chip the same words. `PublishRunRow.sqlite.test.tsx` runs the real publish on the story database and reads the row back through the store.
- Auto plan approval: the dock bar (`AutoDockPlan`) and the drawer toolbar (`AutoPlanToolbar`) share `useAutoPlanApproval`, which calls `approveAutoPlan`. Right after the write commits, `onWritten` reloads the Auto views and emits `artifactsChanged` on the bridge bus, before the turn that tells Auto. `followArtifactAnnouncements` runs in every window and reloads the Auto views (`loadAutoTrees`) as well as the plans. `AutoDock.approveSync.sqlite.test.tsx` runs both paths on the real store and database. The turn carries the plan as `focusArtifactId`; `approveAutoArtifact` answers `already_approved` without a write; `useAutoPlanApproval` drops an answer once the shown version moved (`createLatestOnly`). `approveAutoPlan.build.sqlite.test.ts` pins that Auto is told which plan and that the implementer it starts makes the tree read Build.
- Changes to a waiting plan: `submitUserMessage` gives a bare message the `explicitChange` of the one plan that waits (`waitingPlanChangeOf`). There is none at the run level or with two plans waiting. The delivery line tells the Lead to delegate with `revises` and the row as `changeFrom`. `buildDeliveryMessage` drops the fact once the plan moved past that version. `sentChangeOf` keeps the change on the view while its row is pending or read in the current turn. `dockPlanOf` picks the dock line. `planChangeMessage.sqlite.test.ts` runs the message to plan v2 on the runtime. `c07-plan-changes.test.tsx` covers the box, the queue while the Lead works and the late v1. The `c07-auto-plan-changes` scene shows the line.
- The plan dock: `dockPlanOf` reads waiting, updating, failed or settled. `planLineOf` numbers a replacement plan and marks the old one superseded. Keep writes `request.keptBase` through `keepAutoPlanBase`. `dockPlanOf.test.ts`, `keepAutoPlanBase.sqlite.test.ts` and `c07-plan-dock.test.tsx` cover each state. The `c07-auto-plan-replanning`, `c07-auto-plan-failed` and `c07-auto-plan-v2` scenes show them.
- Revises: `parseDelegateSpec` takes a bare artifact id, `revision`, `version`, and a version written as text. A missing version means the latest one (`resolveDelegateChild`), and the reason is optional. A refusal names `DELEGATE_REVISES_SHAPE`. `planChangeMessage.sqlite.test.ts` turns a replan that names the plan by id only into plan v2.
- The Lead's own work: the `close` block (`parseAutoCloseBlocks`, `closeTarget`) stores `request_json.closed` and the agent's `done_at`. `closedSentenceOf` words the line, and `readAutoTreeViews` hides a discarded agent. A plan goes through `discardAutoPlan`, the Ask first ask through `request_json.planDiscardAsk`, `planDiscardAskOf` and `drop` on `useAutoPlanApproval`. `dockPlanOf` skips a dropped plan. `leadClose.sqlite.test.ts` covers close, skip, discard, the no-op cases, the ask and the newest plan. The `c07-auto-lead-tidy` scene and `c07-lead-tidy.test.tsx` show the dock ask and the closed child.
- Next step card: `AutoNextAction` renders `nextActionOf`; `useNextAction` owns pick, hint, retry and the decline-then-message order. `ChoiceChips` (`orientation="vertical"`) draws the options. `readableTaskOf` names artifacts by title in the card title, and `taskTitleOf` drops raw ids through `withoutRawIdsOf`. Stop, the composer placeholder and Tell name the Lead.
- Next step scenes: the `c2-next-step.test.tsx` scene test proves the card mounts with no Confirm row. The `u31-next-step` scene test holds its height.
- Image strip: `AttachmentStrip` is the one strip for a message (`UserText`), a goal (`GoalAttachmentsStrip`) and a hint (`OrchestratedHintRow`). It lives in `features/attachments/AttachmentStrip/`, outside `components/` and `hooks/`, so other features import it without growing the cross-feature count.
- Strip split: `splitStripImages` is the one split into shown thumbnails and `+N`. It counts the slots from the strip's measured width (`useElementWidth`), with 48 px thumbnails and 8 px gaps, and keeps one slot for `+N`. Until the strip is measured it assumes the right drawer at `RIGHT_DRAWER_MIN` (384 px) less 32 px of padding, six slots. A strip with a removable image never folds.
- Strip reads: `useAttachmentThumbnails` reads the shown row, and the rest when the viewer opens. It numbers every read. A late answer for an old path or an earlier opening is dropped. It releases the entry of an image that left the list, the hidden ones included once the viewer closes.
- Strip viewer: the strip closes the viewer when the open image leaves the list. It takes an optional `viewer`, so a caller can keep the open image above a remount. The composer chips (`PendingAttachmentChip`, `ArtifactAttachmentChip`) keep `AttachmentChip`.
- Image viewer: `ImageLightbox` takes one `src`, or `items` with a `startId` and a `railLabel` for the rail in the `Dialog` panel. `railTargetOf` maps the four arrow keys to the next image and wraps at the ends. The `onKeyDown` of the `Dialog` reads the keys, not a window listener.
- Viewer state: the image shown is kept by id when the list re-renders. The viewer closes, and frees the page scroll, when that image leaves the list. `ImageLightboxRail` scrolls the active item into view.
- Viewer focus: a thumbnail that failed to read stays the same button, so focus has a target. The strip focuses the thumbnail before it opens, so Esc returns focus to it. Each thumbnail carries `data-attachment-control`. `useHintRowState` restores it when a hint row remounts. The strip hands the viewer a `returnFocusTo` that finds the thumbnail again. The `u32-attachments` scene shows the strip and `u32-attachments-viewer` the open viewer.
