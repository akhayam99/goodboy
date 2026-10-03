# Agents

Talk to agents, watch what they do and steer them while they work.

### Workspace chat

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/agents-workspace-chat-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/agents-workspace-chat-light.webp" alt="Chat in Harborline: the chat list grouped by Pinned, This week and Idle with Archive idle and Archived 4, session marks on two chats, and the answer to Where is the consent step defined? as a table of three payments-api files with Read 4 files, Sonnet 5 · Medium under it and a Started a session note, below the header chip 1 session and above a message box that reads Sonnet 5 · Medium and Read-only · 3 projects">
</picture>

Ask about the workspace without starting a session. **Chat**, next to **Board**, opens your chats on the left and one conversation on the right. Each chat reads every project of the workspace and never changes a file: the composer says **Read-only · 3 projects**, the answer streams in, **Read 4 files** lists what it opened, and the model picker beside the box is the same one you use for sessions, limited to Claude and Codex, the two providers that can be held to reading. It keeps the effort you pick for that chat and applies it from the next message. **Make default** in the picker, or **Chat** under **Defaults** in the provider settings, sets the model and effort every new chat in the workspace starts with, and **Back to automatic** clears it. Each answer names the model and effort that wrote it, so a chat that changed model shows both. Hover an answer for **Copy** and **Start work from here**. Chats you have not used for seven days move to **Idle**, dimmed, and **Archive idle** clears them with an **Undo**. Nothing is archived for you.

Hover a chat in the list for **Pin** and **⋯**. The same menu opens with a right click or Shift+F10: **Rename** edits the title in place (Enter saves, Esc cancels), **Mark as unread**, **Pin**, **Archive** and **Delete**. **Delete** asks first in the menu, removes the chat's messages from this device and leaves any session started from it alone; the confirm also offers **Archive instead**. A chat that started a session shows a session mark with the session's stage on its second line, and a chat that used more than one model shows the providers it used.

Archived chats stay one click away. When any exist, **Archived** with a count sits at the bottom of the list and switches it to the archived chats, where **Restore** and **Delete** appear on hover and **Delete all archived** asks once. An archived chat opens with an **Archived** banner above the message box, and sending a message restores it. A session started from a chat shows **From chat** in its overview, and one fed by a chat shows **Fed by chat**, one line per chat, each opening it. The session row and the Board card carry a small chat glyph that names the chat on hover, and the session mark in the chat list opens the session.

**Start work** turns a chat into work in a panel beside it: a model you choose under **Drafted by**, the chat's own by default and remembered per workspace, drafts a title, a goal, what the chat established and the files it named, and you edit any of it. **Start session** creates a session with that goal and opens it, with nothing running yet; **Runs on** sets the model and effort the new session starts from. **Add to a session** opens a session you pick with the brief waiting in its message box, unsent; the chat says **Draft added** and links to the session only once you send it there. If the link cannot be saved, the panel says so and offers **Try again**. The **Project** field searches your projects and takes none, one or several; the session list groups by Active and Recent, with their projects, stage and age. Back returns to the chat.

A chat remembers the work it started. Once a session came from it, the header shows **1 session** with a dot in the color of that session's stage; with several, the dot follows the most urgent one. The chip opens the list with each session's stage, whether it was started or added from this chat, and **Open**. The note under the answer that started it stays when you close the chat or restart Goodboy, and a deleted session drops out of both.

The top bar shows when a chat is working: a pulsing dot and "1 chat running" on **Chat**, and a still **New reply** dot in the notification color on it, and on the chat in the list, until you open the chat.

### Roles

Give each agent the job it is good at. Nine roles come with the app, **Scout**, **Debug**, **Plan**, **Implement**, **Review**, **Test**, **Resolve**, **Docs** and **Generalist**, and a role sets the agent's instructions, its default model and what it hands back.

### Agent header

Read who an agent is without giving the transcript away. The title, the **Brief** and **Transcript** tabs and the actions share one row, and role, status, time and model sit on one line under it. The title stays on one line and shows in full on hover. **Delete** is an icon that asks in a confirm anchored to it, and the menu beside it holds the rest. The transcript starts right under the header, without a leading day chip.

### What the agent received

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/agents-what-received-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/agents-what-received-light.webp" alt="The top of the Credit once per event id chat: an Also received row with the chips Goal, Plan, 2 files and All, above the message sent by Codex about payments-api and notify-relay, then an Operations row with 1 Grep and 1 Read">
</picture>

Check exactly what an agent was told. The top of each chat shows the message it got and who sent it, here **Codex**, with an **Also received** row that has a chip for each part of its brief: **Goal**, **Plan**, **2 files**. **All** opens the whole brief, and **View as sent to** the provider shows the exact text, with a copy button.

### Agent transcript

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/agents-transcript-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/agents-transcript-light.webp" alt="An agent transcript: the ask about the retried webhooks and payments-api#318, the agent's answer, chips for the plan Dedupe on the event id, the report Where the second credit comes from and the wireframe Deliveries screen, retry state, and a Resolve findings group with thread 1 explained, thread 2 closed with commit 9f2c1ab and thread 3 no change">
</picture>

Follow one agent's work in order. The plan, report and wireframe it writes show as chips under its text, and a **Resolve findings** group lists each review thread as **explained**, **closed** or **no change**. File edits group into **Operations** rows, and questions and permission cards appear in the flow where you answer them.

### Agent suggests

When an agent recommends another role, its transcript shows **Agent suggests** with the reason. Pick the provider, model and effort on the card, then press **Start**. The new agent starts with that reason and what the previous agent wrote.

### Queue or send now

Keep talking while an agent works. **Enter** queues your message for its next turn, **⌘Enter** interrupts and sends it now, and the queue survives a restart.

### Stop and Continue

Stop an agent without losing its work. Stopping keeps what it wrote and offers **Continue**. An agent that was working when you reload, restart or update Goodboy keeps going: a reload finds it still running, and after a restart it picks up where it stopped, with a note in its chat. One that cannot pick up says **Stopped by restart** and offers **Resume**. When a restart stops several, **Resume all** in overview **Next steps**, or above a workflow's steps, brings them all back.

### Turn footer

See what each turn cost: provider, model, duration, tokens, cache share, estimated cost and a context meter.

### Tool call states

Tell at a glance what a tool call did: **Running**, **Done**, **Failed**, **Needs approval**, **Stopped** or **Denied**, with elapsed time and readable input and output.

### Composer plus menu

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/agents-composer-menu-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/agents-composer-menu-light.webp" alt="The message box of a chat with the plus menu open, listing Attach files, Run a script ($), Start a workflow (~) and Ask another agent (@), next to Ask first and the GPT-5.6 Sol model">
</picture>

Do more from the message box. The **+** opens **Attach files**, **Run a script** (`$`), **Start a workflow** (`~`) and **Ask another agent** (`@`). `$` lists your saved scripts and your `package.json` scripts, across pnpm and yarn workspaces.

### Attach files

Hand an agent images, PDFs, CSV and text files, up to 10 at a time, by paste, drop or pick.

### Drift warning

Hear about it when an agent steps outside its role, like a planner editing files. Goodboy checks each turn against the role and sends a notification.

### Subagents from plan parts

Run a plan part by part. An implementer given a plan splits into one sub-agent per part, shown as 3.1 and 3.2, and a plan can give each part done-when checks and the files it expects to touch.

### History rewriter and Scribe

Let two helpers work on your history and your pull request text without the power to push. Their git points at a push address that goes nowhere, and their GitHub tokens are removed.

### One language per session

Get agents and summaries in the language of your goal.
