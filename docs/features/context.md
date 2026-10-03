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

Hand the next agent where things stand. After a turn the summary is updated with **State**, **Next**, **Open questions** and **Learned**, and an edit you made in the meantime is kept. Turns that finish while an update runs wait together and the next update reads them all, so one update can cover several turns. Each block shows its key line first and folds the rest behind **Show 3 more**.

### Context drawer

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/context-drawer-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/context-drawer-light.webp" alt="The Context drawer of the session Stop retried webhooks posting a second credit on Decisions 5, with Changed since you last looked (4 rows: Added, Replaced by 7, Withdrawn, Reworded) above the Active list">
</picture>

Open goal, decisions and summary from any session page with the **Context** button, and use the copy icon at the top for **Copy as brief**. **Context updates** at the top of the drawer says how the context engine is doing and opens to show the last update ("2 min ago, after 3 turns"), the model and effort it ran on with **Change model**, which goes to Step summaries in Defaults, the tokens and cost it used, and what it changed (Goal, 2 decisions, Summary). **Update now** joins the session's queue, one update at a time, and shows **Queued** until its turn; when an update failed the same button reads **Retry**. A dot on **Decisions** says something changed since you last looked, and **Changed since you last looked** lists added, removed and reworded decisions first. Active decisions show their reason under the text when they have one.

### Who receives what

See which agents read each part of the context. Under the tabs, **Visible to** says which roles receive the open tab ("All roles except Scout, Docs") and opens to one chip per role. Each role receives a fixed set: planners, implementers, reviewers, debuggers and resolvers get the decisions, scouts and docs agents do not, and the generalist, tester, report, scribe, wireframe and history rewriter get everything. You always see everything; the limit is only on what goes into an agent's prompt.

### Learned

Read back what agents explained about the topics you follow. When you list topics under **Explain more when it touches** in About you, and an agent concretely explains something that touches one of them, a short learning appears in the **Learned** tab with its topic, the turns it came from and who wrote it. Activity shows it as a compact **Learned · Rust · title** row. Learnings are written for you, so **Visible to** reads **You only**. **Dismiss** hides one, with **Undo**.

### Context budgets

Keep prompts small as a session grows. Each part of the shared brief has its own size, and when decisions run over, the newest are kept.

### Plans handed to the next agent

Hand a plan straight to the implementer. The plan goes from **Ready to run** to **Ran** and shows which agent used it.
