# Shared context

What one agent learns, the next one reads. The goal, decisions and a running summary travel with the session, so a new agent starts informed instead of from a blank chat.

### Decisions

Record a decision once and have the agents after it read it. Each one gets a number, and replacing or withdrawing it needs a reason that stays next to it.

Changed decisions appear first, marked **Added**, **Reworded**, **Withdrawn** or with their replacement number. Closed rows stay struck through until **Mark as read** succeeds.

Click a decision for **Edit** and **Remove**. **Undo** stays while the **Context** tab is open.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/context-decisions-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/context-decisions-light.webp" alt="The Decisions card of the Context tab with 5 decisions and Mark as read: 7 Show the stuck-delivery banner after the third failed retry marked Added, 5 struck through and Replaced by 7, 8 struck through and Withdrawn, 1 marked Reworded with Show previous, then 6, 4 and 2, each with its reason, Replaced and removed 2 and Add a decision">
</picture>

<sub>Screenshot from Goodboy 0.40.1</sub>

### See why each decision was made

Read the reason behind a decision without opening the run. When Goodboy records a decision from a session, it keeps the reason and shows it as a muted line under the decision, with **Show more** when it runs long.

### Running summary

Hand the next agent where things stand. After a reply the Context tab opens on the **State**: a glyph, a count of blockers or of steps left, and the State's first sentence. Each blocker gets its own row with a warning glyph.

The Summary card has two groups:

- **Next**: numbered steps, the first one leading.
- **Learned**: facts.

Each group shows three and opens the rest with **Show all**. A long path is shortened in the middle, with the full path on hover. Open questions have their own **Questions** tab. Copied context and agent prompts keep the complete summary.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/context-summary-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/context-summary-light.webp" alt="The Summary card of the Context tab: Next 3, with Wire the retry state into notify-relay leading, and Learned 2, with The handler had no idempotency key first">
</picture>

<sub>Screenshot from Goodboy 0.40.1</sub>

### Context tab

Open goal, decisions, summary and explanations in the **Context** tab, with Projects and Linked beside them, and copy them with **Copy context**. The **State** of the running summary leads the tab, then Projects and Linked, then the cards from Goal down.

Every card has the same head: its title, a count from two, and its actions on the right. Goal, Decisions and Summary each have one menu with **Edit**, **Versions** and **Change visibility**. An empty card says what it will hold and offers one action.

**Context updates** heads the tab, with **Copy context** on the same line. It shows the last update with its model and cost, and **Update now** runs one on demand. The Goal section can write a title and goal from linked work, and nothing changes until you apply it.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/context-drawer-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/context-drawer-light.webp" alt="The session Stop retried webhooks posting a second credit on its Context tab, between the places rail and the tools rail, at Decisions 5 with Mark as read, each decision carrying its own mark inline: Added, Replaced by 7, Withdrawn and Reworded, and Show previous">
</picture>

<sub>Screenshot from Goodboy 0.40.1</sub>

### Who receives what

See which agents read each part of the context. **Change visibility** in the card menu lists the roles that receive that part.

- Planners, implementers, reviewers, debuggers and resolvers get the decisions. Scouts and docs agents do not.
- You always see everything.
- Agents the Lead starts read only their brief, so every part but the goal says "Lead children read only their brief".

The **What Goodboy sends** card shows what each agent gets before it starts. It lists the default parts for each role, and roles that receive the same parts share a row. Each part shows its size in tokens, and each row its total against the brief's limit. A part with nothing in it is greyed out.

Two roles have their own row. Agents the Lead starts read only the goal. An Ask question shows its live work limit. Under **Context window**, each running agent shows how full its context is.

### Explanations

Read back what agents explained about the topics you follow. List topics under **Explain more when it touches** in About you, and a short explanation appears on the **Explanations** card when an agent explains one. **Dismiss** hides it, with **Undo**. It is not the summary's **Learned** block, which is what the work found out, written for the next agent.

### Context budgets

Keep prompts small as a session grows. Each part of the shared brief has its own size, and when decisions run over, the newest are kept.

An Ask question reads the live work, not only the summary: the last ten tool calls of each running agent, every check with its result, the state of each worktree and each script run with the end of its output. That part stays under 4,000 tokens, and secrets in terminal and script output are hidden before it is sent.

### Plans handed to the next agent

Hand a plan straight to the implementer. The plan goes from **Ready to run** to **Ran** and shows which agent used it.

## Under the hood

- Decision marks: `DecisionsSection` renders one list and `markContextRead` clears marks after persistence.
- Summary: `summaryStatusOf` reads State into the status box (`SummaryStatus`): a State line that says blocked, blocker, cannot or can't, or starts with waiting or stuck, is a blocker. `summaryStatusWordOf` counts blockers or Next steps and never names a run state. `summaryDisplayBlocks` leaves State out of the card, `SummaryBlock` folds a group past three, `shortPathOf` shortens a path, and `shareableContext` keeps the complete text.
- Card controls: `SlotSourceActions` keeps the three menu entries together.
- Ask pane: `AskPane` draws `AskPaneBody` in a `DrawerFrame` titled Ask with no icon: `AskEarlierMenu` (the five latest earlier threads), New question and Close. `AskStarters` sends a chip through `sendAskQuestion` at once, `AskFoldedTurn` folds every turn but the last, and `AskTurn` renders each answer through `parseAskAnswer` (bold, inline code, bullets and numbered lists).
- Ask answers: a fenced block or a table goes through `Markdown`, and `AskCodeActions` adds Copy. `SessionWorkspace` draws `AskPane` in `data-session-dock-row`, beside the head frame. `ASK_STYLE_RULES` in `buildAskSystemPrompt` holds the writing rules. `AskChip` draws an agent as its role glyph (`askAgentKindOf`) and a file in mono. `showAskThread` loads before it shows and claims `askThreadPicks`, so a late load is dropped; `sendAskQuestion` sets the new thread only while no other was picked. `askPane.test.ts`, `AskPane/index.test.tsx` and `SessionAskScene.test.tsx` prove each case.
- Ask pack: `askLiveOf` gathers the live work and reads checks through `mountRequestOf` on every host. It redacts each tool call before cutting it. `askLiveSection` redacts script output before keeping its tail. It keeps the section under `ASK_LIVE_BUDGET_TOKENS` and runs `redactSecrets` on every line. `buildAskPack` adds it as the Live work section.
- What Goodboy sends: `sendRowsOf` groups the roles of `ROLE_SLOTS` by their parts and weighs each one with `serializeSlotsBudgeted`, the function the preamble uses, against `PREAMBLE_SLOT_TOTAL_BUDGET`. Its Lead children row takes its parts from `briefSlotsOf`. `SendsSection` draws it with the `ASK_LIVE_BUDGET_TOKENS` row and one `AgentFillRow` per agent from `liveAgentsOf`, filled by `contextFillOf`. The agent usage footer and the turn footer read the same share from `contextShareOf`. `activeUsageOf` feeds it the latest turn of the agent's current provider. `sendRowsOf.test.ts`, `activeUsageOf.test.ts` and `SendsSection/index.test.tsx` prove it.
- Card head: `ContextCardHead` draws the head row of every Context card, Projects and Linked included, and `ContextExpander` every fold inside a card.
