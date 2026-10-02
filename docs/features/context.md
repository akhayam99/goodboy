# Shared context

What one agent learns, the next one reads. The goal, decisions and a running summary travel with the session.

### Decisions

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/context-decisions-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/context-decisions-light.webp" alt="The Context drawer on Decisions with two Active decisions, 3 Dedupe on the event id inside the transaction (replaces 1) and 2 Keep the processor event id on every credit row, plus Replaced and removed 1 and Add a decision, next to the brief sent to Implement 3.1 that says Why: D3 moved the dedupe inside the transaction">
</picture>

Record a decision once and have the agents after it read it. Each one gets a number and a byline, and replacing or withdrawing it needs a reason that stays next to it. Here decision 3 replaces decision 1, so the brief the implementer received carries the new one and says why. Click a decision to open it, with **Edit** and **Remove** inside. A removed decision is retired at once and stays in the list with **Undo** while the drawer is open, and closed decisions are split into **Removed by you** and **Replaced**.

### See why each decision was made

Read the reason behind a decision without opening the run. When Goodboy records a decision from a session, it keeps the reason that came with it, and the context drawer shows it as a muted line under the decision, with **Show more** when it runs long.

### Running summary

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/context-summary-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/context-summary-light.webp" alt="The Context drawer on Summary with the blocks State 4, Next 3, Open questions 1 and Learned 2, each with its key line first and Show more links for the rest">
</picture>

Hand the next agent where things stand. After each turn a summary is updated with **State**, **Next**, **Open questions** and **Learned**, and an edit you made in the meantime is kept. Each block shows its key line first and folds the rest behind **Show 3 more**.

### Context drawer

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/context-drawer-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/context-drawer-light.webp" alt="The Context drawer of the session Stop retried webhooks posting a second credit on Decisions 5, with Changed since you last looked (4 rows: Added, Replaced by 7, Withdrawn, Reworded) above the Active list">
</picture>

Open goal, decisions and summary from any session page with the **Context** button, and use the copy icon at the top for **Copy as brief**. A dot on **Decisions** says something changed since you last looked, and **Changed since you last looked** lists added, removed and reworded decisions first. Active decisions show their reason under the text when they have one.

### Context budgets

Keep prompts small as a session grows. Each part of the shared brief has its own size, and when decisions run over, the newest are kept.

### Plans handed to the next agent

Hand a plan straight to the implementer. The plan goes from **Ready to run** to **Ran** and shows which agent used it.
