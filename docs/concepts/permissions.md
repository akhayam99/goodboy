# Permission rules

> **Read this when** you change how a tool call is allowed, denied or asked
> for, how an answer reaches the agent, or how a rule matches. **Not for** the
> permission modes each provider honors
> ([../providers.md](../providers.md#permission-modes-per-cli)) or where rules
> sit among other settings ([settings.md](settings.md)).

A **permission rule** matches a tool and says **allow**, **deny** or **ask**. It
matches the whole tool or, for Bash, a command prefix ("pnpm test"), so
approving one command never approves the rest of Bash. It can be global or on a
workspace, project or session, and the most specific rule that fits wins.

## What a rule reaches

- Rules reach Claude only. The session's permission mode reaches every
  provider, and a mode a provider can't honor runs as a stricter one, which the
  agent's row says (`Read only · Ask first isn't available on Codex`).
- The engine audits a call after Claude ran it. The audit log records what the
  rules would have decided; what blocks a call is the permission mode and the
  tool flags the CLI receives.
- A call denied in a run with no one watching stops the turn. The agent's row,
  its session card and the top bar's Needs you read **Needs permission** until
  you answer.
- A denied workflow step pauses the run instead of finishing with whatever the
  model wrote meanwhile.
- A glob is matched in linear time. `*` stays inside one command and does not
  cross `/`, `:`, `;`, `&`, `|`, a backtick or a line break, so `Bash(git *)`
  matches `git status` and not `git status && rm -rf ~`. Only `**` crosses them.

## Answering an ask

- **Allow and continue** grants that exact call once and resumes the turn by
  itself. The "Always allow" actions (this workspace, everywhere, this session)
  write a rule (a command prefix for Bash, the whole tool for an edit) and resume
  the same way.
- Only when the turn could not resume does the card say "Stopped before your
  answer." and the dock offer a filled **Continue** (`stoppedAnswerOf`), held
  while another ask of the batch is open. A record line keeps **Continue** on an
  always allow whose turn never started (`useIsStoppedBeforeAnswer`).
- A once allow of a Read is scoped to its file: `Read(//absolute/path)`. On the
  Lead it goes through the `permissionOnceAllows` of the `user` outbox row, since
  the Lead's turn starts from the runtime, not the message.
- **Deny**, and **Deny and tell why**, answer this call only: a once decision, no
  rule, and the agent is told so it carries on another way. The session-wide ban
  is a separate overflow item, **Never allow "pnpm test" in this session**, which
  names the command prefix (the whole tool for an edit), never the bare tool.

### A message while the ask is open

A message you type while the ask is open denies it with your text as the reason
(`Denied Bash. <text>`). Only a typed message (origin `operator`) does this, and
a send that never starts leaves the ask open.

- `startTurnRun` does it right before the user text, reading the asks again so
  an ask answered during the writer wait stays answered (`turnBeforeLease` keeps
  it readable while that wait shows `starting`).
- On the Lead's own ask `routeAutoUserTurn` does the same, since its confined
  turns run in default mode and a read outside its folder can ask.
- A queued message never denies. `drainAgentQueue` holds while an ask is open
  and goes on once it is answered or lapses. Before it holds it asks the
  database (`refreshAgentAsks`), so an answer or a stop from another window
  counts. Every decision and settled turn sends `agent-turn` on
  `goodboy:data-changed`, and the other windows refresh and drain.

### Several asks and owed answers

Several asks of one agent are answered in turn (the dock shows `1 of 2`). An
answer that leaves another ask open starts no turn (`askBatchAfterAnswer`); the
last one starts one turn carrying every answer (`withHeldAnswers`,
`heldOnceAllowsOf`), because `user_text` closes an open ask and an earlier send
would drop the second undecided.

An answer stays owed until a turn writes its `user_text`. If its turn was
refused (a writer timeout, say), the decisions are saved and the next turn of
any origin carries them (`resolvedAsksAtWrite`), after a reload too. The answers
read at the write are `resolvedAsks`, which the fallback and limit retries of
`recoverTurnFailure` and Retry on a failed turn (`retryAsksOf`) resend with the
once grants. The answer paths and the Lead's delivered turn pass
`NO_RESOLVED_ASKS`, since their text already says it.

## The Permissions page

**Settings › Workspace › Permissions** lists the rules, adds one inline (`Add
rule`: Allow or Deny, a command prefix, this workspace or all), and shows the
last 50 decisions of the workspace's sessions from the audit log
(`permission_audit_list`).
