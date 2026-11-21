# Shared context

What one agent learns, the next one reads. The goal, decisions and a running summary travel with the session, so a new agent starts informed instead of from a blank chat.

### Decisions

Record a decision once and have the agents after it read it. Each one gets a number, and replacing or withdrawing it needs a reason that stays next to it. Changed decisions appear first with **Added**, **Reworded**, **Withdrawn** or their replacement number. Each decision appears once, and closed rows stay struck through until **Mark as read** succeeds. Click a decision for **Edit** and **Remove**; **Undo** stays while the **Context** tab is open.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/context-decisions-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/context-decisions-light.webp" alt="The Decisions card of the Context tab with 5 decisions and Mark as read: 7 Show the stuck-delivery banner after the third failed retry marked Added, 5 struck through and Replaced by 7, 8 struck through and Withdrawn, 1 marked Reworded with Show previous, then 6, 4 and 2, each with its reason, Replaced and removed 2 and Add a decision">
</picture>

<sub>Screenshot from Goodboy 0.40.1</sub>

### See why each decision was made

Read the reason behind a decision without opening the run. When Goodboy records a decision from a session, it keeps the reason and shows it as a muted line under the decision, with **Show more** when it runs long.

### Running summary

Hand the next agent where things stand. After a reply the Context tab opens on the **State**: a glyph, a count of blockers or of steps left, and the State's first sentence. Each blocker gets its own row with a warning glyph, and the rest of the State follows. The Summary card lists **Next** as numbered steps, the first one leading, and **Learned** as facts. Each group shows three and opens the rest with one **Show all**. Code reads in quiet mono, and a long path is shortened in the middle with the full path on hover. Open questions have their own **Questions** tab. Copied context and agent prompts keep the complete summary.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/context-summary-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/context-summary-light.webp" alt="The Summary card of the Context tab: Next 3, with Wire the retry state into notify-relay leading, and Learned 2, with The handler had no idempotency key first">
</picture>

<sub>Screenshot from Goodboy 0.40.1</sub>

### Context tab

Open goal, decisions, summary and explanations in the **Context** tab, with Projects and Linked beside them, and copy them with **Copy context**. The **State** of the running summary leads the tab, then Projects and Linked, then the cards from Goal down.

Every card has the same head: its title, a count from two, and its actions on the right. Goal, Decisions and Summary each have one menu: **Edit**, **Versions** and **Change visibility**. **Context updates** heads the tab with **Copy context** on the same line; it shows the last update and its model and cost, and **Update now** runs one on demand. An empty card says what it will hold and offers one action. The Goal section can write a title and goal from linked work, and nothing changes until you apply it.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/context-drawer-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/context-drawer-light.webp" alt="The session Stop retried webhooks posting a second credit on its Context tab, between the places rail and the tools rail, at Decisions 5 with Mark as read, each decision carrying its own mark inline: Added, Replaced by 7, Withdrawn and Reworded, and Show previous">
</picture>

<sub>Screenshot from Goodboy 0.40.1</sub>

### Who receives what

See which agents read each part of the context. **Change visibility** in the card menu lists the roles that receive that part. Planners, implementers, reviewers, debuggers and resolvers get the decisions, scouts and docs agents do not, and you always see everything. Agents the Lead starts read only their brief, so the line says "Lead children read only their brief" on every part but the goal.

### Explanations

Read back what agents explained about the topics you follow. List topics under **Explain more when it touches** in About you, and a short explanation appears on the **Explanations** card when an agent explains one. **Dismiss** hides it, with **Undo**. It is not the summary's **Learned** block, which is what the work found out, written for the next agent.

### Context budgets

Keep prompts small as a session grows. Each part of the shared brief has its own size, and when decisions run over, the newest are kept.

### Ask the session

The Ask line answers two questions from the session itself. **What are you doing?** says what each running agent does right now and the step of each branch. **What is left?** lists the parts of the plan that are not done. These answers say **From the session · free** and cost nothing. Without a plan, the answer says **No plan on this session** and never guesses. Any other question is one turn to the model, marked **Asked the model · 1 turn** with its cost. **Message the Implementer** puts a message in that agent's queue without interrupting it, and a message that could not be saved stays in the field with **Retry**. **Open in Ask** continues in the Ask panel.

### What Ask reads

Ask a question the session cannot answer alone, and the model reads the live work, not only the summary. It sees the last ten tool calls of each running agent, every check with its result, the state of each worktree and each script run with the end of its output. That part stays under 4,000 tokens, and secrets in terminal and script output are hidden before it is sent.

### Plans handed to the next agent

Hand a plan straight to the implementer. The plan goes from **Ready to run** to **Ran** and shows which agent used it.

## Under the hood

- Decision marks: `DecisionsSection` renders one list and `markContextRead` clears marks after persistence.
- Summary: `summaryStatusOf` reads State into the status box (`SummaryStatus`): a State line that says blocked, blocker, cannot or can't, or starts with waiting or stuck, is a blocker. `summaryStatusWordOf` counts blockers or Next steps and never names a run state. `summaryDisplayBlocks` leaves State out of the card, `SummaryBlock` folds a group past three, `shortPathOf` shortens a path, and `shareableContext` keeps the complete text.
- Card controls: `SlotSourceActions` keeps the three menu entries together.
- Ask line: `SessionAskLine` draws the shared `AskLine`. `askStarterOf` sends the two free questions to `doingAnswerOf` (live work from `readDoingRuns`, branch words from `branchEntriesOf`) and `leftAnswerOf` (plan parts from `planPartsLeftOf`); every other question goes to `sendAskQuestion`. `askAnswerOriginOf` writes the origin chip. `messageAgentFromAsk` queues with `enqueueAgentMessage` and `shouldDropUnsaved`, so a failed save leaves the queue as it was. `SessionAskLine/index.test.tsx` and `sessionAnswers.test.ts` prove each case.
- Ask pack: `askLiveOf` gathers the live work, `askLiveSection` keeps it under `ASK_LIVE_BUDGET_TOKENS` and runs `redactSecrets` on every line, and `buildAskPack` adds it as the Live work section.
- Card head: `ContextCardHead` draws the head row of every Context card, Projects and Linked included, and `ContextExpander` every fold inside a card.
