# Composer

> **Read this when** you change the agent composer (`ChatInput`), Send, Queue
> and Stop, the durable send, or any field that talks to an agent
> (`PromptField`) and its attachments. **Not for** delivery ids
> ([recovery.md](recovery.md#one-delivery-starts-one-run)).

## The agent composer

`ChatInput` is one shell: field, then a 32px action row. Focus shows as a
stronger border plus a soft shadow, never a full ring.

`ChatInput/index.tsx` only composes: state in `hooks/use*`, sections in
`parts/`, derived flags in `composerView.ts`. It stays one component so the
draft and pending nudges survive a re-render. An optional `agentId` (a drawer)
pins every hook to that agent; without it the composer follows the session's
selected agent.

### The action row

- Left: `ComposerPlusMenu` (`+`), where the prefix syntax (`$` script, `~`
  workflow, `@` agent) is learned, plus Attach files. It reads
  `CHAT_PREFIXES`, so a new prefix group appears on its own. Then
  `PermissionModePicker` and the attachment count.
- Right, on every surface: `ComposerRoutingPicker` (which renders
  `RoutingPicker` with a `budget` prop) and `SendControl`. The model of the
  next turn is picked in the box that sends it, nowhere else on the page.
- On an agent or Auto page, `ComposerToolbar` portals only
  `PermissionModePicker` into the settings line (`AgentSettingsLine`) through
  `controlSlots`.

The toolbar is a container (`@container` on `ComposerToolbar`), so it answers
to the composer's width. Labels never wrap. Under 512px, 448px and 384px it
drops, in order, the usage pill and "pinned", then the effort, the `Auto`
prefix and the Send now and Queue key hints, then the model name and access
label; the hidden words stay in the tooltip and accessible
name. The main composer keeps every label.

### Send, Queue and the placeholder

- Idle: `SendControl` is the shared `SendStopControl`, the same button the Ask
  and Chat composers use.
- Running with a draft: Queue (Enter) is primary and Send now (⌘Enter) quiet,
  both disabled until there is something to deliver. An empty running box
  shows no send control.
- `composerPlaceholder` (`ChatInput/lib.ts`): a role's first turn gets its
  `firstMessagePrompt`, otherwise `Message <role>`, and `Message the agent`
  when the role is unknown.
- A message starting with `/` sends as plain text; no slash command is
  resolved.
- The quick-actions popover blocks the send keys while it is open.

### Stop

Stop is one labeled button in the dock (`DockLiveLine`, `DockStopButton`), fed
by `useConversationStop`. The agent header has none.

- Auto hands in `autoDockStopOf`, which stops the tree.
- Anything else stops the agent, a turn waiting on a permission ask included
  (`useAgentStop` reads it as live; the ask stays undecided).
- A step page labels it **Stop this reply**.
- It reads Stopping, then Force stop once it stalls
  ([spawn.md](spawn.md#stop-is-confirmed)).

Esc twice presses it (`useEscapeStop`, id `agent.stop`): the first press shows
"Esc again to stop" for 3 s. Any open menu, drawer or dialog
(`transientEscapeLayerCount`, `isOverlayOpen`) takes the key first. The
session's Esc ladder (`escapeLadder`) is a base layer the escape stack asks
last, whatever order the layers mounted in.

### The tray

Queued messages and the agent's suggestion sit in a tray above the shell when
either has something to show. A routing fallback or all-budgets-exceeded
notice (`RoutingIndicator`) sits above that, as a warning.

## A send is durable

Send to an idle agent saves the row first: `sendAgentMessage` writes it
(status `sending`, `isDirect`), then `deliverQueuedTurn` sends it with
`queue:<id>`, so the delivery dedup covers it. The transcript drawer sends the
same way.

- A row that could not be saved sends nothing, and `isUnwritten` keeps the text
  in the box.
- `useComposerSend` restores saved attachments to the captured agent even
  after its composer unmounts.
- A refusal, a cancelled writer wait or an error puts the row back as `queued`
  with `hold.reason`. The hold and `writtenTexts` are saved in `override_json`
  under `queueState`, so a reload keeps them.
- The row owns Retry (`retryQueuedMessage`). RoutingIndicator's Send anyway
  forces the held row when the box is empty.
- Deleting or editing a row drains again, so rows behind a held head move on.
- A sending row hides from the tray once its text is in the transcript.

`drainAgentQueue` sends nothing while any row of the agent is `sending`, the
head row is held, a permission ask is open (a reloaded agent reads its
transcript first; a failed read keeps the row), or the agent is a stopped or
skipped step (`isQueueParked`). A step cut keeps the agent stopping until its
cut status is read back. A resolver row with attachments is refused in a busy
lane, since a queued attempt holds text only.

A refusal the caller must see is raised with `throwIfRefused` (`TurnRefused`).
`turnRefusalMessage` is the only owner of its words, `routeTurn` included.

## One composer

Every field that talks to an agent is a `PromptField`
(`shared/components/PromptField`) of one of two kinds:

| Kind     | Fields                                                                    | Keys                                                  |
| -------- | ------------------------------------------------------------------------- | ----------------------------------------------------- |
| message  | Agent chat, workspace Chat, orchestrator hint, kickoff boxes              | `Enter` sends, `Shift+Enter` new line, `⌘Enter` sends now |
| document | Diff comment, review reply and hint, goals, guidance, step instruction, brief, change request, answers | `Enter` new line, `⌘Enter` saves or sends |

- The keys come from the registry (`composer.send`, `composer.newLine`,
  `composer.submit` through `isSubmitChord`); `promptKeyAction` decides one
  press. The Start a run field starts on `Enter`.
- A document can offer **Write** and **Preview**, rendered when you switch
  (never per key) and loaded through a dynamic import.

Every composer has one look. `ComposerSurface` is the box (border, focus,
drop overlay, flat top under a tray), `ComposerAttachments` puts the file chips
above the text, and `ComposerFooter` is the row under it (attach, notes, file
count on the left; model picker and Send on the right). `PromptField` in its
`card` variant and `ChatInput` both draw from these; a variant is a prop
(`drop`, `isJoinedAbove`, the `model` slot), never a second box.

Files ride on `usePendingAttachments` (`shared/hooks`): paste, drop and
**Attach files**, up to 10 files of 10 MB each.

- A drop that cannot be read gets one notice with a sentence per cause
  (`dropFailureCauseOf`, `dropFailureNotice`), each ending on **Attach files**.
- A staged file stays a `Blob` with an object url thumbnail, read into base64
  only when the message leaves.
- The agent queue keeps its stored data url format (`StoredAttachment`).

## Under the hood

- `composer-ratchet.test.ts` lists every file that renders a text area and its
  kind. A new agent field must be a `PromptField` of its kind.
- `ChatInput/childComposer.test.tsx` covers restored attachments after a
  composer unmounts.
