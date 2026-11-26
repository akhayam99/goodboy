# Integrations

> **Read this when** you change how a tool connects, how far each source goes,
> how an item becomes a session, or how a tracker item follows the merge.
> **Not for** what agents can ask a tool ([../query-bridge.md](../query-bridge.md))
> or the Tasks list ([tasks.md](tasks.md)).

A connection to a tool lives on the **workspace** as a **binding**: one login and
one set of options, shared by every project. A project that needs another
account gets its own override, used first. GitHub works the same way: a
workspace with no key of its own uses the key for all workspaces, then your `gh`
login, both set in **Connections › GitHub** (app settings have no GitHub
section). Secrets stay inside Goodboy; agents reach tools only through the
[query bridge](../query-bridge.md).

## What integrated means

Every tool has to be readable inside Goodboy, not behind a browser tab. A tool
is integrated when you can:

- **See it**: the whole item shows inside Goodboy.
- **Act on it**: comment, reply, assign, move, approve, merge or resolve from
  the same screen.
- **Route it**: turn it into a session with the goal written, and follow it back
  when the work ships ([The tracker follows the merge](#the-tracker-follows-the-merge)).

## Each source

- **GitHub**: pull requests (approve, request changes, comment, reply, resolve
  threads, merge, close); issues (read, comment).
- **GitLab**: merge requests (approve, change state, comment, reply, resolve and
  reopen threads; Merge and Close confirm first); issues (read, comment, edit).
- **Bitbucket**: pull requests start to finish, with description, diff, build
  results in plain words and review threads. Its actions are approve, revoke,
  request changes, withdraw, comment, reply, merge and decline, and from the
  Conversation tab rename, edit the description, add reviewers and merge with
  the strategy you pick. Its nouns are `pull request`, `PR`, `#42`, with no
  draft. Issues go through Jira.
- **Jira**: full issues; comment, assign, move to another status, edit the
  description.
- **Linear**: issues into sessions; description and comments written back, and
  the status row moves the issue to another state of its team.
- **Sentry**: read and start only. It reads issues and events and turns them
  into sessions, never resolves, ignores or assigns, and never follows the
  merge; Goodboy asks it for no write, and the connect page says so. A Sentry
  item meets See it and Route it, not Act on it.
- **Slack**: threads into sessions with the goal filled in, and replies, posted
  as the connected user. Each workspace has its own Slack connection.

Linear, Jira and Sentry connect in numbered steps (`ConnectSteps`): a button
opens the page where the key is made, the pasted key is checked on its own with
no Connect button, and the last step picks from a list (`jira_list_projects`,
`sentry_list_organizations`, `sentry_list_projects`). Each field uses the tool's
own name for the secret, and a key saved for another workspace can be picked.

## Route an item into a session

A routed goal carries the item's text up to 1,200 characters, or 2,000 for a
Slack thread. A longer text is cut at the last paragraph, line or sentence that
fits, never inside an open code block, and ends with a line naming the full item
and its link; agents read the whole item through the bridge. A proposed title is
cut at a word and ends with an ellipsis.

Start on a tracker issue in Tasks (`pickIssue`) opens New session with the issue
attached above **Start a run** and its goal in the field, with no brief. Start
then links the issue, mounts the project it maps to
([tasks.md](tasks.md#start-from-a-record)), creates the session, starts the run
the router picks and raises one Follow toast. Nothing exists before that.

In the one-step panel of a Slack thread, a merge request or a pull request of
yours, the **Issue briefs** task model drafts a brief: a title, a goal of one to
three sentences and up to five "done when" criteria, in the issue's language, as
checked JSON. It fills the goal only while you have not edited it, Start works
while it still loads, briefs are kept in memory per issue text, and with no free
provider the block shows the issue text alone. Merge and pull requests start
with their text as it is.

## The tracker follows the merge

When every branch of a session is merged or closed and at least one merged, a
linked **Linear** or **Jira** item that is not done gets one **Ship** row in
Next: **Move HBL-412 to Done** (`trackerMoveSuggestionOf`, kind
`move-tracker-item`), with its current state under the title. It is a
suggestion, never silent, owned by the `tracker-moves` slice.

- `checkTrackerMoves` reads each linked item when the session ships and keeps an
  offer only for an item not completed or canceled. It drops a late answer when
  a newer check ran, the item moved meanwhile, or the session is no longer
  shipped. An item it cannot read keeps the offer it had.
- The target is the team's completed workflow state in Linear (the one named
  Done, else the first by position) and, in Jira, the transition that lands on
  Done, Closed, Resolved or Completed. No target, no row.
- A _Part of_ link, a GitHub or GitLab issue (the host closes those from `Closes
#N`), a Slack thread and a Sentry item never get a row.

**Move to Done** re-reads the item first: if another window or the tool already
moved it, nothing is written and the row goes. Otherwise it writes with the
existing transition call, and the row leaves only after the tool accepted it. A
refusal keeps the row with the error under it. The toast's **Undo** puts the
item back (Linear by the state it left, Jira by the transition back to its old
status, or an error when Jira has none). **Not now** is the ordinary dismissal.
