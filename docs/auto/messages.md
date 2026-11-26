# Messages to the Lead

> **Read this when** you change what happens to a message typed to the Lead:
> how it is queued and delivered, the one queue above the composer, Edit,
> Remove, Send now, Send to Lead, or the files a message carries. **Not for**
> a message to a child of the tree ([children.md](children.md#talking-to-a-child))
> or the Lead's chat layout ([chat.md](chat.md)).

## A message is an outbox row

A message to the root of an Auto tree is never a plain turn.

1. `sendTurn` hands it to the runtime (`routeAutoUserTurn`), which creates the
   tree if missing and queues the text as a `user` outbox row.
2. Once taken, the user's words go to the transcript as an `operator_text`
   event carrying the outbox row id, drawn once Auto read it
   ([One queue](#one-queue)).
3. Auto reads the row with the next delivery. Approving a plan takes the same
   path ("Approved plan v1.").

A turn that is neither an operator message nor a child's is left to the plain
turn.

A message the runtime cannot take, or one with a file that is not an image, is
refused "The Lead didn't get your message". With no Auto door registered yet,
the refusal is `AUTO_STARTING_SENTENCE` ("The Lead is still starting. Retry in a
moment."), shared by every Auto action that finds no door. The composer keeps its
text either way.

The text Auto builds for its own agent (the ledger, the budget line, the
results, "MESSAGES FROM THE USER") is stored with `deliveredBy: 'auto'` on its
`user_text` event, set by `startTurnRun` when the turn's origin is `delegation`
(the root's deliveries and a child's first brief). It draws as one collapsed row,
**What the Lead was told**, never a bubble. An event with no origin is a bubble:
there is no text sniffing.

Another window forwards the message over the bridge with an id that stays the
same until taken, so sending the same words again reuses it. Main remembers each
id for 10 minutes and answers a repeat with the first answer; a message main lost
is sent again. No answer in 30 seconds counts as not taken.

## Answer while working

A `user` row is delivered in every phase that takes a turn, `waiting` included
(`chooseDeliveryRows`, `isMessageAtOnce` in `deliverNext`), all pending rows in
one turn, while the agents keep running.

- The turn moves the tree to `deciding`. Results that settle meanwhile send it to
  `merging` (`settleAutoTurn`), so they go in the next turn, once.
- Delivery is once per outbox row id: a claimed or accepted row is never
  `pending` again, and a lapsed lease reuses the stored delivery and its id.
- Stop wins: a stopping tree delivers nothing.

The claim stores the turn number (`turns_used + 1`), read back as
`readMessages`, so a note reads "Not read yet" or "Read at turn n"
(`noteWordOf`). Remove is the undo until it is read.

## One queue

The chat holds only what Auto has read. Everything not delivered sits above the
composer in one list in send order (`QueuedMessages`, rows from `queuedRowsOf`):
the tree's `user` outbox rows (`pendingMessages`, with images), then the agent
queue (`store/slices/agentQueue`, used while the root's turn runs).

- A message the drain moves from the agent queue to the outbox keeps its place:
  `routeAutoUserTurn` reads the trees again before the tray lets go, and the
  `sending` tray row is hidden once its outbox row is in the view.
- `rowsByDeliveryOf` draws an echo with an `outboxId` only right before the
  delivery event that lists that id in `outboxIds`, so it never jumps above
  earlier rows. A pending or withdrawn echo is never drawn, after a restart too.
- A row dropped for another reason (`droppedMessageIds`) keeps its echo where it
  was written. Events from before the ids have no `outboxId` and stay put.

A row reads one status word: "Waits for this reply", "Waits for <task of the
child>" or "Waits for 2 agents" (`pendingMessageLineOf`, `waitingForOf`), or
"Not delivered" with the reason in its tooltip.

**Send now** (`runtime.sendNow`, `registerSendNowPort`, the window bridge)
delivers one row at once as its own Auto turn and leaves the children running.
It claims the row in the tree's queue with the phase revision and `claimed_by`,
so a child ending at the same moment cannot deliver it twice.

A waiting tree with no child in `starting` or `running` (a lost turn end) is the
watchdog's case: `deliverNext` delivers the pending `user` rows and logs one
`[auto] ... waited with no running agent` line.

## Edit and Remove

Both use one withdraw (`runtime.withdraw`, `registerWithdrawPort`, the bridge,
`withdrawMessage`). In the tree's queue it checks the phase revision and ends the
`pending` row as `dropped`, reason `withdrawn` (`withdrawAutoOutboxStatement`,
guarded on `claimed_by IS NULL`); a row the stop dropped as `stopped` can be
withdrawn too.

- The row leaves, and for Edit the text and images return to the composer, only
  after the withdraw succeeded. The images are read first, so a failed read keeps
  the row.
- An already claimed row answers `delivered`: it arrives in the chat as any
  other, so words are never lost.
- A refused withdraw (another window runs the tree) shows its message and keeps
  the row.

## Send to Lead

A Move, a comment or a check can go to an open Lead without opening its chat
(`store/slices/send-to-lead`): queued for the root with its own id, drained at
once. Its source turns into one quiet row, "The Lead of X has it · Not read yet"
with Edit and Undo, then "The Lead of X is on it". Undo removes the message or
withdraws its row through the same withdraw, and frees a comment it bound.

A Lead stopped before the send reads "Not delivered: the Lead stopped" with Start
new Lead, which starts a run with the item as its ask and no form
(`startRoutedRun`); Undo while it starts stops that tree.

## A message the tree cannot take

A `user` row is never sent to a tree that cannot run a turn; it reads "Not
delivered".

| Tree                  | Row action                                                       |
| --------------------- | ---------------------------------------------------------------- |
| Blocked by the budget | **Change limit**; a raise delivers it                            |
| Blocked otherwise     | **Retry** resumes the tree and delivers it (the send tries once) |
| Stopped or stopping   | None; Edit or Remove still take it back                          |
| `finished` or `done`  | Taken as a normal follow-up turn                                 |

Stopping drops pending rows as `stopped`, but `readAutoTreeViews` keeps them in
`pendingMessages` while the tree is stopping or stopped, so they still show. Rows
of old trees show the same way on load and are never auto-sent.

## Images and files

A message may carry what the session chat takes: images, a PDF, other files.

1. `routeAutoUserTurn` writes them once to the session's scratch folder
   (`storeAutoImages`; `attachmentKindFor` makes a PDF a `file`) and queues them
   on the row (`images` in the payload, files included).
2. The queued row shows image thumbs and a file count; the echo keeps them
   (`operator_text` `attachments`).
3. The delivery hands them to Auto's turn by full path (`storedAttachments` on
   `sendTurn`), never written again.
4. Every child started after the message gets them in its brief
   (`childImagesOf`), named as chips on its page. The launch reads them once into
   the attempt's snapshot ([children.md](children.md#why-an-agent-exists)), so a
   relaunch hands over the same images.

A file that cannot be written refuses the message with "The Lead couldn't keep
the files. Attach them again.": nothing is dropped silently.
