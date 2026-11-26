# Text reveal

> **Read this when** you change how live agent text is written in, add a host
> that shows model text, or make a card fade in when an answer lands. **Not
> for** how deltas reach the store ([stream.md](stream.md#partial-output)).

Live agent text is written in at a steady pace instead of landing as one
block. The engine lives in `features/chat/reveal/`.

## The engine

- `revealNumbers.ts` holds every number: a floor of 80 characters a second,
  the model's own rate of the last 600 ms (capped at 600 a second, times 1.1),
  the backlog over a 1.2 s drain, a 1.5 s lag cap, a 220 ms fade. Change a
  number there, nowhere else.
- `revealPacer.ts` is one `requestAnimationFrame` loop for every live text in
  the window. Each frame it moves a cut (a character index) per text and
  notifies at most once per text. It stops when nothing is revealing.
- The lag cap means a whole message is on screen about 1.5 s after it
  arrived. A text that stops growing mid word is settled after 3 s. If the
  loop throws, every live text is shown whole.
- `healMarkdownPrefix.ts` snaps a cut to what can render: word ends, whole
  lines inside a fence, never inside `**`, a backtick span or a link.
- A table stays out until its end is in the text (a line that is not a row
  follows it, or the text is complete), then every row lands at once, so the
  columns are sized once. Pipe lines without a divider are prose.
  A table piece lives for the fade plus 40 ms per body row, capped at 8
  (`pieceLifetimeMs.ts`), and the pacer holds the words after it for that
  time. The lag cap is not held: the whole message still lands about 1.5 s
  after it arrived. `freshenNode` gives each body `tr` a `--reveal-delay`; only opacity
  animates.

## What counts as live

`liveTextRegistry.ts` marks a run when an `assistant_text` event reaches the
store through `readTurnStream`, which also marks `agentLiveKey({ agentId })`.
Load, a reload re-attach replay and another window never mark. A text whose
host mounts more than 1.5 s after the last mark shows whole.

## Hooks a host calls

- `useRevealedText` gives the prefix to render and the pieces still fading.
  Reduced motion, a text that was not live and an engine error return the full
  text. `finish` shows it all.
- `useRevealedMarkdown` wraps it for `Markdown`: the last block renders the
  prefix with its newest characters in `<span data-fresh>`, one span per piece,
  fading in for 220 ms (`[data-fresh]` in `styles.css`). Earlier blocks stay
  cached and untouched.
- `useRevealedMarkdown` finishes the reveal on a pointer down in the row, on a
  non empty selection and when find in view starts, so copy gets the full
  text.
- A stream `error` and a stop flush the run first (`revealPacer.flushRun`), and
  with an `agentId` the text keyed on that agent too, so the error row never
  lands above half written text.

### Hosts

| Host                   | Where                                                                 | Key        |
| ---------------------- | --------------------------------------------------------------------- | ---------- |
| `AssistantText`        | Agent chat, run step page, agent overlay, Auto, the transcript drawer | Run id     |
| `ChatAssistantMessage` | Workspace chat (`sendChatMessage` marks and flushes)                  | Message id |
| `AskTurn`              | Ask, feeding `InlineMarkdown` per text run through `sliceFreshTail`   | Message id |
| `RevealedMarkdown`     | `DelegationResult`, `AgentConversationEnd`, `CheckAnalysisDrawer`     | Agent key  |

The `assistant_text` item carries its `runId`, which with the item key is the
pacer key. In the conversation the final answer row is added when `activeRunId` goes
null, inside the 1.5 s live window of the run's last delta, so it reveals as
the turn ends; later than that it shows whole. The chips and the copy button
of an answer wait until the reveal ends.

## Blocks that land whole

`useFreshLanding` is the entry point for a block that lands or is replaced
whole. When its live key was marked inside the landing window, it returns a new
React key and `data-fresh`, so the block fades in once and is never typed out.
A null key never fades, and reduced motion drops the fade through the
`[data-fresh]` media rule.

The landing window (`liveTextRegistry.isLanding`) is about 2 s: the lag cap,
one frame and the longest piece. That is the latest a live reveal can end, so a
card that mounts when its answer finishes revealing still fades.

Keys:

- Run id: cards mounted when `AssistantText` ends its reveal
  (`ResolverThreadsCard`, `ScribeTextCard`).
- Agent key: the Debugger's proposed fix.
- Workflow run id, marked by `persistRunSummary`: `OrchestratedResult`.
- One key per write from `landingLiveKey`
  (`features/chat/reveal/landingLiveKey.ts`), each with the host that fades:
  - `resolve-thread` and `resolve-agent` (`persistResolveTurn`):
    `ReviewComment`, `ResolverQuestionCard`, `AnswerCard`, `FixRunSummary`.
  - `decisions` (`noteDecisionChanges`; a decision the user wrote never fades):
    `DecisionRowItem`.
  - `questions` (`finalizeTurnStream`): `AgentAnsweringFor`.
  - `handoff` (`recordAgentHandoff`): `HandoffBlock`; `ClampedText` still
    measures the final text, only opacity moves.
  - `transcript-event` keyed by the event `at` (`orchestrateNextStep`,
    `startTurnRun`): the orchestrator decision card and the step transition
    card.

A key per write, not the agent key, so opening a page while the agent still
streams shows its older rows whole. `ScribeTextCard` wraps the shared
`ScribeProposalView` so `shared/` never imports the engine.

## Not revealed

Not revealed: a posted reply note (`ReplyNote` `posted`), plans, reports and
artifacts (opened later), and session titles and state words (not model
text).

## Screen readers

The revealing row carries `aria-busy="true"` inside the polite list, and the
final text is read once when the flag clears. The flag derives from the reveal
state, so it clears on finish, flush, error, stop and unmount, and a text shown
whole never has it.
