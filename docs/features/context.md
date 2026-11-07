# Shared context

What one agent learns, the next one reads. The goal, decisions and a running summary travel with the session, so a new agent starts informed instead of from a blank chat.

### Decisions

Record a decision once and have the agents after it read it. Each one gets a number, and replacing or withdrawing it needs a reason that stays next to it. Changed decisions appear first with **Added**, **Reworded**, **Withdrawn** or their replacement number. Each decision appears once, and closed rows stay struck through until **Mark as read** succeeds. Click a decision for **Edit** and **Remove**; **Undo** stays while the drawer is open.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/context-decisions-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/context-decisions-light.webp" alt="The Context drawer beside an Implementer chat: the Decisions card with two active decisions, 3 Dedupe on the event id inside the transaction and 2 Keep the processor event id on every credit row, Replaced and removed 1 and Add a decision, above the Summary card, next to the message Sent by Run step 3 of 5 that says Why: D3 moved the dedupe inside the transaction">
</picture>

<sub>Screenshot from Goodboy 0.31.12</sub>

### See why each decision was made

Read the reason behind a decision without opening the run. When Goodboy records a decision from a session, it keeps the reason and shows it as a muted line under the decision, with **Show more** when it runs long.

### Running summary

Hand the next agent where things stand. After a reply the drawer shows **Next** and **Learned**, and **State** when it says more than the one sentence the Overview shows. Open questions stay on the Overview. The Overview owns the State sentence and calls its age **Updated**. Copied context and agent prompts keep the complete summary.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/context-summary-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/context-summary-light.webp" alt="The Context drawer on the Summary card with the blocks State 4, Next 3, Open questions and Learned 2, each with its key line first and Show more links for the rest, above the Explanations card">
</picture>

<sub>Screenshot from Goodboy 0.31.12</sub>

### Context drawer

Open goal, decisions, summary and explanations from any session page with the **Context** button, and copy them all with **Copy context**. It opens on Goal. Each card has its title and a count from two. Goal, Decisions and Summary each have one menu: **Edit**, **Versions** and **Who reads this**. **Context updates** shows the last update and its model and cost, and **Update now** runs one on demand. The Goal section can write a title and goal from linked work, and nothing changes until you apply it.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/context-drawer-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/context-drawer-light.webp" alt="The session Stop retried webhooks posting a second credit on its Overview, with Needs you 1, Branches 2 and Done 4, and the Context drawer open on Decisions 5, with Changed since you last looked (4 rows: Added, Replaced by 7, Withdrawn, Reworded) and Mark as read above the active decisions 7, 6, 4 and 2">
</picture>

<sub>Screenshot from Goodboy 0.31.12</sub>

### Who receives what

See which agents read each part of the context. **Who reads this** in the card menu lists the roles that receive that part. Planners, implementers, reviewers, debuggers and resolvers get the decisions, scouts and docs agents do not, and you always see everything. Agents that Auto starts read only their brief, so the line says "Auto children read only their brief" on every part but the goal.

### Explanations

Read back what agents explained about the topics you follow. List topics under **Explain more when it touches** in About you, and a short explanation appears on the **Explanations** card when an agent explains one. **Dismiss** hides it, with **Undo**. It is not the summary's **Learned** block, which is what the work found out, written for the next agent.

### Context budgets

Keep prompts small as a session grows. Each part of the shared brief has its own size, and when decisions run over, the newest are kept.

### Plans handed to the next agent

Hand a plan straight to the implementer. The plan goes from **Ready to run** to **Ran** and shows which agent used it.

## Under the hood

- Decision marks: `DecisionsSection` renders one list and `markContextRead` clears marks after persistence.
- Summary: `summaryDisplayBlocks` draws State only when `stateBodyHasMore` says it exceeds the sentence, `summaryStateOf` owns its Overview sentence, and `shareableContext` keeps the complete text.
- Card controls: `SlotSourceActions` keeps the three menu entries together.
