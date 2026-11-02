# Shared context

What one agent learns, the next one reads. The goal, decisions and a running summary travel with the session, so a new agent starts informed instead of from a blank chat.

### Decisions

Record a decision once and have the agents after it read it. Each one gets a number, and replacing or withdrawing it needs a reason that stays next to it. Click a decision to open it, with **Edit** and **Remove**, and **Undo** is there while the drawer is open.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/context-decisions-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/context-decisions-light.webp" alt="The Context drawer beside an Implementer chat: the Decisions card with two active decisions, 3 Dedupe on the event id inside the transaction and 2 Keep the processor event id on every credit row, Replaced and removed 1 and Add a decision, above the Summary card, next to the message Sent by Run step 3 of 5 that says Why: D3 moved the dedupe inside the transaction">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### See why each decision was made

Read the reason behind a decision without opening the run. When Goodboy records a decision from a session, it keeps the reason and shows it as a muted line under the decision, with **Show more** when it runs long.

### Running summary

Hand the next agent where things stand. After a turn the summary is updated with **State**, **Next**, **Open questions** and **Learned**, and an edit you made in the meantime is kept.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/context-summary-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/context-summary-light.webp" alt="The Context drawer on the Summary card with the blocks State 4, Next 3, Open questions and Learned 2, each with its key line first and Show more links for the rest, above the Explanations card">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Context drawer

Open goal, decisions, summary and explanations from any session page with the **Context** button, and copy them all with **Copy context**. They read as one scroll of cards: each card has its title, a count from two, and its quiet controls (**Versions**, **Edit source**, the eye for who receives it) on its header row, with the content and its folds inside. **Context updates** shows the last update and its model and cost, and **Update now** runs one on demand. The Goal section can write a title and goal from linked work, and nothing changes until you apply it.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/context-drawer-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/context-drawer-light.webp" alt="The Context drawer of the session Stop retried webhooks posting a second credit on Decisions 5, with Changed since you last looked (4 rows: Added, Replaced by 7, Withdrawn, Reworded) and Mark as read above the active decisions">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Who receives what

See which agents read each part of the context. The eye on a card's header, **Visible to**, lists the roles that receive that part. Planners, implementers, reviewers, debuggers and resolvers get the decisions, scouts and docs agents do not, and you always see everything. Agents that Auto starts read only their brief, so the line says "Auto children read only their brief" on every part but the goal.

### Explanations

Read back what agents explained about the topics you follow. List topics under **Explain more when it touches** in About you, and a short explanation appears on the **Explanations** card when an agent explains one. **Dismiss** hides it, with **Undo**. It is not the summary's **Learned** block, which is what the work found out, written for the next agent.

### Context budgets

Keep prompts small as a session grows. Each part of the shared brief has its own size, and when decisions run over, the newest are kept.

### Plans handed to the next agent

Hand a plan straight to the implementer. The plan goes from **Ready to run** to **Ran** and shows which agent used it.
