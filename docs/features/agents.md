# Agents

Talk to agents, watch what they do and steer them while they work. You can ask questions without starting a session, see exactly what each agent was told and cost, and stop or redirect one without losing its work.

### Workspace chat

Ask about the workspace without starting a session. **Chat**, in the left column under **Board**, reads every project and never changes a file. When an answer is worth acting on, **Start work from chat** drafts a session from it, and chats you stop using move to **Idle** so you can archive them. Once the session is saved, the answer keeps one quiet line, **Started** and the session title, that opens it, and the session's Overview reads **From chat** with the chat's title to take you back. The title, on the same header row and height as every other page, the answers and the message box share one reading column, and every answer names its model beside the provider's mark.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/agents-workspace-chat-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/agents-workspace-chat-light.webp" alt="Chat in Harborline, opened from the left column beside the Sessions list: the chat list grouped by Pinned, Today, This week and Idle with Archive idle and Archived 4, session marks on two chats, and the answer to Where is the consent step defined? as a table of three payments-api files with Read 4 files, Sonnet 5.5 · Medium under it and a Started a session note, below the header chip 1 session and above a message box that reads Sonnet 5.5 · Medium and Read-only · 3 projects">
</picture>

<sub>Screenshot from Goodboy 0.21.1</sub>

### Ask in a session

Ask what is happening in a session without leaving it. **Ask**, or **⌘L**, opens a panel that offers a few questions to try. Answers name the agents, runs and files they mention as chips, and the panel is read only, so it never acts for you.

### Images in chat

Paste, drop or attach images in the chat message box, up to 10 per message, in PNG, JPEG, GIF or WebP. The model reads them with your question, on Claude and on Codex. The image shows as a thumbnail in the message box and in your message, and a click on it opens it large.

### Roles

Give each agent the job it is good at. Nine roles come with the app, **Scout**, **Debug**, **Plan**, **Implement**, **Review**, **Test**, **Resolve**, **Docs** and **Generalist**, and a role sets the agent's instructions, its default model and what it hands back. **Analyze** on a failing check starts the Debugger: it reproduces the failure and proposes one fix, or two or three options with a recommended one, and you start the one you pick.

### Agent header

Find an agent, then read who it is before you read its work. **Agents** in a session lists its agents on one aligned grid, role, name, state, model with its provider and time, with finished ones muted at the bottom; a row opens the agent, its other actions are in the right click menu, and **Start agent** in the header opens the start form. On the agent, its role, its task and the mark of the provider it runs on share one row with **View transcript** (it reads **Hide transcript** while open) and its menu, which holds **Rename**, **Interrupt**, **Close** or **Reopen**, **Move to Auto**, **Change model**, the copy actions and **Delete agent**. The header never repeats the agent's state or model: the state is the line at the end of the conversation, and each turn names its model in its footer.

### What the agent received

Check exactly what an agent was told. The top of each chat shows the message and who sent it, and opening it lists the **Goal**, **Plan** and files it carried. **View as sent to** the provider shows the exact text.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/agents-what-received-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/agents-what-received-light.webp" alt="The top of the Credit once per event id chat: an Also received row with the chips Goal, Plan, 2 files and All, above the message sent by Codex about payments-api and notify-relay, then an Operations row with 1 Grep and 1 Read">
</picture>

<sub>Screenshot from Goodboy 0.13.1</sub>

### Agent transcript

Follow one agent's work as one conversation you can write in. Each finished turn says in one quiet line what it did ("Read 4 files, ran 8 commands (2 errors)"), and a click on the line opens the transcript beside the conversation at that turn; then comes the answer, never the running commentary. An agent that keeps a task list shows it once, as a checklist that updates in place. The plan, report and wireframe it writes show as chips under its answer, questions and permission requests appear where you answer them, and each subagent is one line, its role, its task and its state, with **Open** showing it beside the conversation. Each turn ends with the same footer, provider mark, model and time, failed or stopped included; its tokens and cost are one click away. **Transcript** on the right shows the steps of every turn under a one line heading: each tool call, file and error, with its input and output. A message you type shows once, as you wrote it. Text Goodboy writes for an agent (an Auto delivery, a delegated brief) never shows as yours: it sits in one collapsed row, **What Auto was told**, that you can open.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/agents-transcript-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/agents-transcript-light.webp" alt="An agent transcript: the ask about the retried webhooks and payments-api#318, the agent's answer, chips for the plan Dedupe on the event id, the report Where the second credit comes from and the wireframe Deliveries screen, retry state, and a Resolve findings group with thread 1 explained, thread 2 closed with commit 9f2c1ab and thread 3 no change">
</picture>

<sub>Screenshot from Goodboy 0.13.1</sub>

### Agent suggests

When an agent recommends another role, its transcript shows **Agent suggests** with the reason. Pick the provider, model and effort on the card, then press **Start**. The new agent starts with that reason and what the previous agent wrote.

### Queue or send now

Keep talking while an agent works. **Enter** queues your message for its next turn, and **Send now** (**⌘Enter**), in view beside **Queue** for as long as the turn runs, reads it now, interrupting the turn. The queue survives a restart. A queued message stays saved until the provider accepts it, so a refused send puts it back and a crash does not lose it.

### Message and document fields

Write to an agent the same way everywhere. Every message and document field takes markdown with **Write** and **Preview**, and files by paste, drop or **Attach**. A message sends on **Enter**, and a document saves on **⌘Enter**.

### Stop and Continue

Stop an agent without losing its work. **Stop** sits on the line at the end of the conversation that says what the agent is doing. Stopping keeps what it wrote and offers **Continue**. **Stop** waits until the process has exited; if it cannot stop the agent, the agent stays running with the error shown and a second press tries again. An agent that was working when you restart or update Goodboy picks up where it stopped, and **Resume all** brings back every one a restart stopped.

### Turn footer

See what each turn cost: the model with its provider mark, the duration and the estimated cost on the line, and tokens, cache share and context window in its detail.

### Tool call states

Tell at a glance what a tool call did: **Running**, **Done**, **Failed**, **Needs permission**, **Stopped** or **Denied**, with elapsed time and readable input and output.

### Composer plus menu

Do more from the message box. The **+** opens **Attach files**, **Run a script** (`$`), **Start a run** (`~`) and **Ask another agent** (`@`). `$` lists your saved scripts and the `package.json` scripts you pinned.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/agents-composer-menu-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/agents-composer-menu-light.webp" alt="The message box of a chat with the plus menu open, listing Attach files, Run a script ($), Start a run (~) and Ask another agent (@), next to Ask first and the GPT-5.6 Sol model">
</picture>

<sub>Screenshot from Goodboy 0.21.1</sub>

### Attach files

Hand an agent images, PDFs, CSV and text files, up to 10 at a time and 10 MB each, by paste, drop or pick.

### Drift warning

Hear about it when an agent steps outside its role, like a planner editing files. Goodboy checks each turn against the role and sends a notification.

### Subagents from plan parts

Run a plan part by part. An implementer given a plan splits into one sub-agent per part, shown as 3.1 and 3.2, and a plan can give each part done-when checks and the files it expects to touch.

### Auto agent

Try an agent that picks the roles for you. **Auto** answers a question itself and, when there is something to make, hands it to a Planner, Implementer, Tester, Reviewer or another role, chooses a model for each and reads what comes back. It is always available and still marked **Experimental**: **Start Auto** in the session **New** menu starts it, while **Start agent** and **Ask an agent** keep the role grid, and there is no switch in Settings. Auto shows up as one row in the Overview and has its own entry in the session, **Auto agents** with an **Experimental** chip, next to **Agents**, which lists only the agents you started. Opening it turns the sidebar into Auto's **Work** list: Auto, then every agent it started with its state, and the limit at the foot. Its chat stays lean: one line, the role and the task, for each agent it starts, **Approve plan** right there when a Planner finished, and Auto's state once, at the end, as in **Waiting for Implementer and Tester**. Set a **Limit** once per workspace, change, raise or remove (**No limit**) the **Limit** of a running conversation from the foot of its **Work** list ("Limit $10.00 · $5.23 left"), and **Stop** or **Change approach** while it waits. An agent you started yourself, an Implementer, Tester, analysis agent or a Generalist that is not part of a Run, can be handed over with **Move to Auto** in its menu: say what Auto should do next, or leave the field empty and Auto decides from the chat. The agent keeps its chat and its files but you can only read it from then on, and **Detach from Auto** takes it back. Inside an Auto conversation the other next-step buttons stay out of the way. When the work rests, Auto reads **Idle**; only you close it, with **Mark finished** in its header, and writing to it again reopens it.

### History rewriter and Scribe

Let two helpers work on your history and your pull request text without the power to push. **Write with Scribe** in the create form writes the title and description, and you read and edit them before you press Create. If it fails, the card says so and offers **Retry**.

### One language per session

Get agents and summaries in the language of your goal.
