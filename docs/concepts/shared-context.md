# Shared context, lenses and Ask

> **Read this when** you change what agents of one session share, what a lens
> is, or what Ask reads. **Not for** where a lens opens on screen
> ([../navigation/lens-surfaces.md](../navigation/lens-surfaces.md)) or how a
> turn streams ([../architecture.md](../architecture.md)).

Agents in one session do **not** see each other's chats. They share the
**session record** on the **Overview**: the goal, the decisions and the summary,
in that order, in the **Context** tab, and what the session produces
(workflows, agents, review, questions, diff and plans) as sections of the same
page. The overview keeps one `Goal` line under the title when the goal says more
than the title.

- The summary has Learned, State and Next. State becomes its status line, and
  Next and Learned follow as blocks (`summaryStatusOf`, `summaryDisplayBlocks`).
- Goodboy writes the goal when the session starts and updates the decisions and
  the summary when the summarizer runs after a turn. You can edit all three.
- Each decision keeps its number for the life of the session. Agents and the
  summarizer replace or withdraw it by that number, with a reason, and one
  nobody names stays.
- When a run finishes or a pull request merges, Goodboy consolidates the
  decisions and the summary once more.

## Lenses and turns

Each section is a **lens**, a view of the session, opened from rows and chips on
the Overview, in place or in a side panel, with text as formatted markdown. Chat
is one lens like the others, not the frame around them: switching agents changes
the chat, not the Overview, because the record belongs to the session.

A **turn** is one message from you and one answer from the agent, with
everything that streams in between.

## Ask

**Ask** answers a question about the whole session. ⌘L, **Ask about this
session** in Search or run, or **Ask** in the right rail opens its pane, and the
foot of the Overview keeps a field that opens it.

- It is not an agent: never on the board, in the agent count or in an agent's
  chat, and it never changes the work.
- It reads the session record, the agents' reports, questions, runs, review
  comments, branch, pull request and the session worktrees, read only, and
  answers with chips that open what it names.
- It keeps one thread per session (`chats.session_id`, m227), never shown in the
  Chat list. Its spend is in [spend.md](spend.md#what-is-measured).

Three surfaces stay apart: **Chat** asks about the workspace code, **Ask** about
one session, and an agent's chat gives that agent work.
