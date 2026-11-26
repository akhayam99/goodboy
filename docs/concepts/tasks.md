# Tasks

> **Read this when** you change what the Tasks page lists, how it groups,
> filters or marks a record as new, how a record links to a session, or which
> project Start mounts. **Not for** how far each tool goes
> ([integrations.md](integrations.md)) or the word task
> ([vocabulary.md](vocabulary.md)).

Tasks is the workspace's queue of incoming work from every connected source:
issues, pull and merge requests, Slack threads and Sentry errors, one record and
one line each on the shared task grid (`taskColumns`). Its stored keys, events
and scene ids say `inbox`.

## The list

- It opens on For you (`isForMeRecord`: tracker issues with an assignee, pull
  requests, starred records, records linked to a session) and switches to All in
  the header. The title is the open count. The choice and the grouping are kept
  per workspace (`taskListViewStorage`).
- A record is new when it was first seen after the look the visit began with
  (`arrivedKeysOf`); the first visit marks nothing. The stamps live in
  `taskArrivalsStorage` (the `taskArrivals` slice), and the sidebar door reads
  `taskNewKeys`, filled by every `useInboxRecords` caller, so nothing is fetched
  for it.
- `taskGroupsOf` groups by source, by source and status word, by project or not
  at all, largest group first and newest first inside. A group shows five rows
  and a Show all row (`TaskGroupFoot`); an expanded group of 60 rows or more
  draws only a window (`useVirtualRows`) and names the cursor position.
- A row's name is its key, title, status and priority (`taskRowLabelOf`), and its
  status and priority marks explain themselves in a tooltip.
- One Filter menu holds the facets, one pick per section with counts: source,
  show (assigned, starred, in progress, has a session, closed), type (only the
  types a connected tool can produce) and project.
- A tool that did not load says so in its source row and in one gray line inside
  its group that retries.

## A record

A record opens in the reader pane beside the list; Open shows it at the 720
measure in place of the list, with the source's own actions. From it you start a
session, link it with Link to a session, or open the session already linked.
The record shows its session whichever way the link was made.

The session's own link button searches the issues of every Sentry project
linked to the workspace. A pasted code or link goes through the same lookup as
the Tasks search (`useWorkspaceIssueLookup`, scoped to the picked tracker) and
links the task `launchSpecFor` builds from the resolved record, so a Sentry
short code such as `PAYMENTS-API-3` resolves. A paste the lookup cannot resolve
falls back to the fields read from the URL.

### Start from a record

Start in Tasks mounts the item's project when it maps to one (`launchMountFor`).
A Sentry error reads the projects linked to its Sentry project and those a code
mapping points at; a GitHub or GitLab item reads the project whose remote is its
repo; Linear, Jira and Slack items never mount one. One match is mounted,
several preselect the best (linked and mapped, then a name equal to the Sentry
project) in a popover that allows another or none, and no match mounts nothing.
The mount keeps the reason the popover names ("from Sentry project
payments-api").

## Pull and merge requests

GitHub lists the open pull requests of the workspace root repo that ask for your
review, plus your own open ones updated in the last seven days
(`listInboxPullRequests`, the same `gh` login as issues). GitLab lists open
merge requests assigned to you, Bitbucket the pull requests of the linked repo.
Merged and closed ones show as closed.

## Project filter

With two or more projects, the rail filters by project, but only when the view
includes a source that maps to projects (`PROJECT_MAPPED_PROVIDERS`: Sentry,
GitHub, GitLab) and a record there belongs to one.

- A GitHub or GitLab record belongs to the project whose `Project.remoteUrl` is
  its repo. A tracker record never belongs to a project; its row shows the
  tracker's own project or team.
- A Sentry error belongs to every project linked to its Sentry project in
  Connections, Sentry, many to many (`project_sentry_links`, m191). Links can be
  suggested from Sentry code mappings and wait for your Link. A project that
  reads Sentry shows the Sentry glyph in Settings.
- The filter applies to mapped sources only: a Sentry, GitHub or GitLab record
  of another project, or of none, leaves the list, while every Linear, Jira,
  Slack or Bitbucket record stays. In a mixed view one quiet line says so
  (`projectFilterNote`).
- A view of only unmapped sources shows no Project section, and a pick that
  leaves no mapped source drops the filter.
- Projects with no records hide behind "Show N empty"; the selected project
  stays listed at zero.

Tasks reads the first page of every linked Sentry project, in one load that
starts once the links are read. A Sentry call that hits a rate limit or a
gateway error is retried up to twice, waiting what `Retry-After` asks (at most 5
seconds), before the tool says it did not load.
