# Changelog

Release notes for Goodboy, newest first. `.github/workflows/release.yml` reads
the section for the version being tagged and uses it verbatim as the GitHub
release body and the in-app updater's notes. Add the entry for the next
version in the same PR that bumps the version numbers (see
`docs/release-command.md`), before the tag is pushed: the release build fails
if it can't find a matching `## Goodboy vX.Y.Z` heading.

## Goodboy v0.1.67

The footer and the top bar were reorganised, and a workspace can now hold more than one code host.

### [#1277] Connect integrations from grouped footer controls

Seven integration buttons had grown to fill half the footer, in one undifferentiated row, each carrying a text label whether or not you used it. They are now three groups, split by a divider: code hosts (GitHub, GitLab, Bitbucket), trackers (Linear, Jira, Sentry), and conversation tools (Slack).

A group shows only what you have connected, as a glyph, and ends with an add control. Opening that control lists every integration of that kind with its connection state, so the ones you have not turned on are one click away instead of taking a permanent slot. A group with nothing connected labels its add control with what it offers, so a first run reads "Code host" rather than three anonymous glyphs.

In a workspace with no repository the code-host group gives way to the same "Add a repo" action as before, and Sentry drops out of the trackers.

### [#1282] Reach settings, updates and the changelog from the footer

The top bar now reports only what is happening: what needs you, what is running, today's spend, notifications, and the theme. Settings and the update control moved down to the footer, which is where destinations live. Budget, Impact and the changelog moved behind one More control beside them.

That More control carries a dot when the notes for the version you are running have not been opened, and clears it once the changelog is open with those notes actually loaded. Offline, or while the fetch is still in flight, the dot stays put rather than being spent on an error screen. Today's spend still sits in the top bar and still opens the budget studio in one click.

### [#1278] Use GitHub for code and GitLab for tickets

Connecting GitHub used to block GitLab, and connecting GitLab used to block GitHub. Both restrictions are gone, and so is the deeper one behind them: GitHub counted as connected only when the workspace's git remote was GitHub, so a valid token reported itself as absent and GitHub disappeared from the new-session issue picker on any other repository.

A workspace can now hold any mix of the three code hosts. Six connect forms also stopped claiming your token "never leaves this machine", which was never true for a token the vendor has to receive: they now say it is stored in your keychain, sent to the vendor over HTTPS, and never touches Goodboy's own servers.

Follow-up: a mixed-host workspace was exercised through the test suite, not against live GitLab or Bitbucket accounts.

### [#1279] Disconnect an integration from its studio

The disconnect button lived inside the connect form, and the connect form unmounts the moment you connect, so from the studio there was no way back out. For Slack there was no way out anywhere in the app.

Every integration studio now carries a disconnect in its header, behind a confirm, and it clears the credential from your keychain along with the workspace's record of it. For GitHub it removes this workspace's token and says so, and it never touches a system `gh` login, so it does not appear when that login is all you have.

### [#1281] Read what went wrong when a token is refused

Pasting a bad GitHub token used to print the `gh` command's own error output into the onboarding step. It now says which of six things happened, and what to do next: the token was rejected, it expired, it is missing the repo scope or an SSO authorization, GitHub is rate limiting it, the certificate could not be verified, or github.com could not be reached. Anything unrecognised still quotes what `gh` said, rather than guessing.

Follow-up: the classification reads `gh`'s wording, so a message GitHub changes could fall through to that quoted fallback instead of a written cause.

### Fixes

- Escape closes the onboarding wizard wherever "Skip setup" is offered, so an accidental reopen is no longer a full-screen dead end [#1281]
- "Connect a provider" is now in the command palette, the one setup step you cannot skip [#1281]
- The onboarding checklist's hide control no longer points at the sidebar for a control that lives in the top bar [#1281]
- The code-host onboarding step no longer says you can only use one at a time [#1278]
- A GitLab failure no longer poisons the pull request panel when the GitHub half succeeded [#1278]
- Review comments resolve to one pull request deterministically, instead of following whichever linked task happened to load first [#1278]
- The empty-provider nudge in the footer now respects reduced-motion settings [#1282]

## Goodboy v0.1.66

Seven integrations shipped in five releases, and the surface around them fell behind. This one makes every connected host reachable, and makes the states they report honest.

### [#1272] Bitbucket has a way in

Bitbucket shipped whole in v0.1.64: the commands, the connect form, the studio, the eight review verbs. The footer, which is where a workspace connects an integration, never got an entry for it. If you had not already linked a Bitbucket pull request to a session, there was no route to the token field at all, and the only honest description of that is a host we shipped and you could not turn on.

The footer now carries Bitbucket with the other code hosts. Not connected, it opens the same connect panel every other integration opens. Connected, it opens a workspace view of the repository's pull requests, and Start session works from there.

The limit, stated plainly: that workspace view is read only. Approve, request changes, merge, decline, comment and reply stay where they were, inside a session, because they are keyed to the session's worktree and this release does not move them. A composite workspace has no single repository to read outside a session, so it shows an empty state and points you back into one. Connecting still works there, which is what the report was about.

Bitbucket is gated on the connection you made, not on your git remote. A `bitbucket.org` remote still does not turn anything on by itself.

### [#1271] The pull request tells the truth

Two separate things were wrong, and together they made a merge look like it had failed.

A pull request whose checks were queued or still running reported as passed. The rollup read a check's conclusion and its status field together, and an unfinished run comes back from GitHub with an empty conclusion rather than an empty value, so it fell through every branch and landed on green. Goodboy told you CI had passed on a run that had not started. The rollup now reads what a check actually reports and calls it green only on an affirmative pass. Anything it does not recognise reads as pending, never as passed. Two conclusions GitHub does return and Goodboy silently passed, action required and startup failure, now read as failures.

The queued state meant auto-merge, not the merge queue. So a pull request you had just sent to the queue read as plain open, Merge stayed on the button, and clicking it again looked like the first click had not worked. Goodboy now asks GitHub for the real queue placement and shows the position, "In merge queue #3". Auto-merge keeps its own wording instead of borrowing the queue's.

Not verified: no pull request was pushed through a real merge queue, because that needs a ruleset this repository does not have. The fields were checked against GitHub's live schema and the parsing is covered by tests, but a populated queue entry has not been observed. On a repository with more than 100 open pull requests, one queued outside that window keeps the old behaviour.

### [#1273] Reply to a Linear issue without leaving

Linear could show you an issue and start a session from it, and the only thing it could write back was the description. Commenting meant opening linear.app, which is the tab this is supposed to remove.

You can now write a comment on a Linear issue from inside Goodboy, in the studio and in the session pane, through the same composer the other hosts use. The comment Linear returns is appended to the thread you are reading.

Assign and transition are still not there. Both need the issue's team and workflow state identifiers, which Goodboy does not currently read from Linear, so they need a fetch that does not exist yet rather than a button.

Not verified: no call has run against a live Linear workspace. The mutation and its input come from Linear's published schema. If the shape is wrong, Linear's own error comes back into the composer and your draft is kept.

### [#1274] Popovers stay on top

Opening notifications or the workspace selector while an integration studio, a studio page or settings was open did nothing visible. The popover was opening, behind the page, on a layer one step too low. Every full-page surface in the app sat above every transient one.

Layering is now a named scale rather than four numbers that happened to agree, so a studio, a popover, the command palette, a tooltip and a toast each know where they stand. The four popovers are also wider and taller, and their scroll fade matches the surface it sits on instead of darkening it.

Workspace settings moved out of the workspace popover onto the workspace row itself, so the settings that apply to every session in a workspace are visible without opening anything.

### Fixes

- The board control in the collapsed session rail was grey where its expanded twin is tinted, and sat in a shorter box than the Overview row beside it. It now shares both [#1275]
- Clicking the pull request card in a GitHub session did nothing when that card was the pull request already selected, which is the usual case. Clicking it now opens the review studio, and the row says which of the two it will do [#1275]
- Plans put its "consumed" toggle inside the empty state, while workflows, agents and resolve all put it in a row underneath. Plans now matches them, with active plans and without [#1275]

## Goodboy v0.1.65

Slack is the seventh host, and the first conversation Goodboy can hold. Read the thread here, answer it here, and turn it into a session.

### [#1249, #1250, #1261] Slack, from the thread to the session

Goodboy could hold an issue, an alert and a pull request. It could not hold the conversation the work actually started in, so the one place a task is most often born was the one place you still had to go and look. Slack closes that.

Connect a workspace with a bot token from your Slack app. Goodboy checks it against Slack before it stores anything, tells you the five scopes the bot needs, and keeps the token in your operating system keychain. From the app footer, a Slack studio opens on the channels the bot has joined, then the threads inside them, then the whole thread rendered here: avatars, author names, and Slack's own markup translated for reading. Not a preview and not a link out.

What you can do to it: reply in the thread, and react to any message. A reply posts as the connected bot rather than as you, and the line above the box says so before you send. Replies go out as plain text. A control that cannot fire stays where it is and says why.

Where it takes you: Start session from thread opens a session with the goal written out of the conversation and the branch named after it. Pasting a Slack permalink into Link work does the same, and the thread then gets its own lens in the session rail, so the conversation sits beside the diff and the checks instead of behind them.

The limits, stated plainly. Public channels only, and only the ones the bot has been invited to: no private channels, no direct messages. Each channel reads its most recent 200 messages, so an old thread in a busy channel will not appear and there is no load more. The studio reads the first 12 joined channels per refresh and says so under the list when you have more. Outgoing replies are not translated back into Slack's markup. The connection is per workspace, because the company layer this belongs to is not built yet.

The honest part: none of this has run against a real Slack workspace. Every call is contract-tested against fixtures built from Slack's documentation, which proves the requests agree with the docs and proves nothing about the docs. Worst first, `auth.test`, which the whole connect flow rests on, and whether a bot carrying exactly the five scopes Goodboy asks for satisfies every call. Then the shapes of `conversations.list`, `conversations.history` and `conversations.replies`, which every channel row, every thread row and the thread itself are decoded from. Then whether a bot-authored reply actually threads under its parent instead of landing at the top of the channel, which is the riskiest single claim in this release. When a shape does differ, the pane shows Slack's own error name, `missing_scope: channels:history`, instead of an empty list that tells you nothing. Try it, break it, send the error back.

### [#1247] Workflows read newest first, and say when they started

The workflows lane listed runs oldest first while the agents lane and the resolve lane both listed newest first, so the run you just attached was at the bottom of the one lane where you went looking for it. Workflows now matches, using the same comparator the other two already use.

Each card also carries when it was attached, on a scale that degrades as it ages: `5m ago`, `3h ago`, `yesterday`, then `2 aug`, then `12 dec 2025` once the year has turned. It is GitHub's own timestamp behavior, relative while it is fresh and an absolute date once it is not, and `yesterday` is a calendar comparison, so a run from 22:00 still reads as yesterday at 01:00. The same scale replaced the bare dates in the GitHub, GitLab, Jira and Bitbucket inbox rows, where a five minute old item used to read as a plain date with the recency thrown away, and it retired two hand-rolled copies of the same idea under the permissions views.

The column the date comes from already existed and was already being written. It had been left out of the query that reads a workflow run, so nothing could reach it.

### [#1248] The Moonshot mark is the real one

The Moonshot AI provider shipped in v0.1.63 with a stock crescent moon, which is not the company's logo. It is now the vendor's own mark, taken from their published branding files, drawn to match every other provider mark in the app: one shape, one color, legible at 12 pixels. The provider color went with it, from an invented teal to the blue the vendor uses inside the mark itself.

### Fixes

- [#1247] The workflow reorder arrows moved cards the wrong way once the lane was flipped. They now move a card the direction the arrow points, and the boundaries disable at the ends you can see
- [#1247] Reordering workflows restamped every run's creation time to the moment you dragged it. It carries the original through now, which mattered the moment a card started showing it
- [#1247] Auto-run workflows advanced in whatever order the list happened to arrive in. Scheduling no longer follows display order, so several eligible runs still advance oldest first

## Goodboy v0.1.64

Bitbucket is the third code host, and the first one that arrives whole in a single release: read the pull request, review it, vote on it, merge it, and turn it into a session, without a browser tab.

### [#1241, #1243, #1245] Bitbucket, end to end

A Bitbucket pull request used to be a link Goodboy could not read. Now it is an object in the workspace. Connect a Bitbucket Cloud workspace with your account email and an Atlassian API token, and the `pr` lens starts finding the pull request that belongs to your session's branch.

What you see: the pull request in full. Number, state, title, the description as markdown, the source and destination branches, the changed files as a real diff, the build statuses, and the review conversation with each comment's author, age, and the file and line when it is inline. The checks tab opens with a line in plain words, "2 failed, 1 in progress", instead of a row of icons to decode. GitHub's checks tab got that line too.

What you can do to it: approve, revoke your approval, request changes, withdraw that request, comment, reply on a thread, merge, and decline. The vote state reads as a sentence above the buttons, "You approved this pull request. 2 approvals, 1 change request so far". Merge and decline ask before they fire, because they are the only writes here that cannot be undone. A control that cannot fire stays where it is and says why in its tooltip, rather than disappearing.

Where it takes you: Start session on any pull request opens a session with the goal and the branch name seeded from it, and the pull request linked back. Pasting a `bitbucket.org/{workspace}/{repo}/pull-requests/{id}` URL into Link work does the same.

Bitbucket did not get a lens of its own. GitHub and GitLab already share the `pr` lens with a host switcher, so Bitbucket joins them as the third tab, and the tabs only list hosts that actually have something to show.

The limits. Bitbucket Cloud only, no Server or Data Center, which runs a different API. No Bitbucket issues: Atlassian's issue tracker is Jira, and Jira shipped last release. No reopen, because Bitbucket has no reopen verb, so a declined pull request is declined. No merge strategy picker: the merge is sent without one so your repository's own default applies. Goodboy finds Bitbucket work only through the workspace connection, not by reading your git remote. The mobile companion cannot see Bitbucket.

The honest part: none of these calls has run against a real Bitbucket workspace. Every endpoint is contract-tested against fixtures built from Atlassian's documentation, which proves the request shapes agree with the docs and proves nothing about the docs. Two places to watch. The auth scheme is Basic with an Atlassian API token, which is where Atlassian says Bitbucket is heading as it retires app passwords; if a scope still wants an app password instead, every call answers 401, and the error names both schemes so you can tell which one you have. And the change request verb is the least certain path of the six: its hyphenated URL is an assumption, so a workspace on an older API surface could answer 200 without recording the vote, leaving the summary saying you have not voted after a write that reported success. If the pull request list comes back in a shape the docs did not describe, the pane is simply empty and none of the tests will have caught it. Try it, break it, send the error back.

### [#1242] One comment thread, five hosts

Every integration that renders a comment thread had hand-copied the same avatar, header and card. When Jira shipped last release it reused the shared composer and, in the same change, copied the note card and header byte for byte from GitLab. Bitbucket was about to become the sixth copy.

The note is a primitive now. One avatar, one header, one card, one composer, used by GitLab, Jira, Linear, GitHub and Bitbucket, with each host mapping its own fields onto them. Five avatar copies became one, and the three leftover composers were retired onto the one that already shipped. A broken avatar URL now falls back to the author's initial everywhere, which previously only happened on the review surface.

### [#1239] About 1,300 lines of dead code, gone

`GithubCard` and its fourteen files were an entire tabbed pull request view with no consumer: the live path has been a different component for a long time. It survived every cleanup because the repo's unused-file check treats test files as entry points, so its own tests kept it reachable. Five pieces of it were genuinely in use and moved out first, then the rest went.

### Smaller fixes

- [#1240] The GitLab approve button no longer vanishes when the approval state fails to load. It stays where it is, disabled, with the reason in its tooltip, and it now respects whether you are allowed to approve at all
- [#1240] Leaving the plans lens or the GitHub issue lens and coming back shows the list again instead of silently reopening whatever you last had focused
- [#1240] The mobile companion's issue lookups are now checked for completeness by the compiler, so a provider added without its own handling cannot quietly query GitLab instead
- [#1240] The workflow gate message on the session overview comes from the same place as everywhere else, so it cannot drift
- [#1244] A provider union and an exhaustive switch landed in separate pull requests and left the build broken between them, which this closed

## Goodboy v0.1.63

Jira is the fifth host Goodboy reads, and the first one you can assign and transition from without opening a browser tab. Moonshot joins the provider list with Kimi K3, and the Plans lens finally works like every other lens.

### [#1233, #1236, #1237] Jira, end to end

A Jira ticket used to be a URL you pasted somewhere. Now it is an object in the workspace. Connect a Jira Cloud site with your account email and an API token, and the left rail grows a Jira row next to Linear, Sentry and GitLab.

What you see: the issue rendered in full, through the same page anatomy every other host already uses. Key, summary, description, status, type, priority, assignee, reporter, labels, dates, and the comment thread. Jira's rich text is converted to markdown on the way in, and the nodes we do not model flatten to their text rather than disappearing.

What you can do to it: comment, assign or unassign, move it through its workflow, and edit the description. Assign and transition are the first of their kind anywhere in Goodboy, since no other connected host has ever had them. The move menu is built from the transitions Jira reports for that one issue, never from a fixed list of statuses, because every Jira project carries its own workflow. When the workflow cannot be read the control stays where it is and says why, instead of disappearing.

Where it takes you: Start session on any issue opens a session with the goal and the branch name already seeded from the ticket, and the ticket linked to it. Pasting an `atlassian.net/browse/KEY` URL into Link work does the same.

The limits. Jira Cloud only, no Data Center or Server. API token, no OAuth. One project key per workspace. Assignable users come back one page at a time, so on a large project the filter box searches the first page. A transition that needs a screen is offered and attempted plainly, and Jira's answer is shown as it comes. The mobile companion cannot list or create sessions from Jira issues yet.

The honest part: none of these calls has run against a real Atlassian site. Every endpoint is tested against fixtures built from Atlassian's own documentation, which proves the request shapes agree with the docs and proves nothing about the docs. If the issue search behaves differently from its documented shape, the inbox will be empty and none of those tests will have caught it. Try it, break it, send the error back.

### [#1235] Moonshot, with Kimi K3

Moonshot is a provider in its own right, not a row in someone else's catalogue. Its own connect flow, its own key, its own mark in the picker. Kimi K3 shows up everywhere a model is picked, with the full effort ladder.

It sits in the mid cost bracket, priced per token the same as Sonnet 4.5, and it is weighted so automatic routing can reach for it on mid-tier work without ever displacing the models that carry the code roles. A test now pins that band, so the next model added cannot quietly outrank them.

Unverified here too: the model id comes from opencode's registry and has not been resolved against a live Moonshot account.

### [#1234] Plans reads like every other lens

Plans had a grammar of its own. Landing on it silently opened the last plan you happened to create, and the rest lived behind an Other plans button that slid a resizable panel in from the right, with its own close control. Nothing else in the app worked that way.

It works like workflows now. No active plans shows an empty state, with the consumed ones behind a count you can reveal in place. Active plans show as a list. Clicking one opens it as a subpage with a breadcrumb and a back button. The right-hand panel is gone.

Two things that were quietly broken are fixed by the same change. Clicking a plan chip in a transcript while already on the Plans lens did nothing at all, and neither did clicking Plans in the breadcrumb while a plan was open. Both read the store once at mount and never again. Both work now.

### Smaller fixes

- [#1237] The Jira comment box says plain text, because that is what Goodboy sends, and markdown you typed would have been stored literally
- [#1237] Acting on an issue refreshes the row in the list beside it, so the detail and the list cannot show two different statuses at once
- [#1237] Switching issues in the inbox right after a write no longer paints the previous issue's title under the new issue for a frame
- [#1236] The onboarding tracker step offers Jira as a live choice instead of a greyed-out badge
- [#1236] Connecting only Jira completes the tools step of the onboarding checklist, which used to need Linear or Sentry

## Goodboy v0.1.62

Click a linked issue and you land on that issue, not on a list of them. The review thread behind a resolver reads in the chat card, and a workflow step that refuses to start finally says why.

### [#1228] A linked Linear, Sentry or GitLab issue opens focused

Clicking a named linked object from Linked work or from the pull request pane opened its provider lens on the full inbox, with nothing selected. You clicked one issue and got the list. GitHub was the only source that had a focus slot, so it was the only one that landed where you pointed.

The three other sources have one now. A click carries the provider and the external id into the store, and the pane behind the Linear, Sentry and GitLab lenses opens that task's detail instead of the list. Opening the same lens from the rail still shows the list, because the focus clears the moment you change lens, so nothing you clicked earlier is waiting for you the next time you go looking.

GitHub goes through the same action for symmetry, which fixes a smaller thing on the way: a session with two linked GitHub tasks used to always open the first one, and now it opens the one you clicked. A linked pull request chip inside a Linear issue routes to the pull request in the app rather than to a browser tab, and falls back to the browser when the session does not track that pull request or when a studio overlay is covering the surface it would navigate to.

### [#1227] The review thread reads in the chat card

When a resolve fans out, the card in the transcript listed each review thread by title and offered a button that left for a browser tab. The thread body was already in memory, fetched with the pull request detail, and the card showed none of it.

The card now docks the real thread, collapsed, and opens it in place with the comment bodies, the authors and the resolved state. It reuses the same thread view the pull request conversation renders, so the two agree. When the pull request detail has not loaded yet, or the thread is not among the ones loaded, the card falls back to the summary it always showed with an honest link out. The resolver lane's jump to a source comment now also matches its way back to a thread in the app before falling back to the browser.

Reading is all this ships. Replying and resolving from the docked thread stay where they are, in the queue that batches them, because moving them is a separate decision.

### [#1230] A workflow step that will not start says so

The advance button re-read the gate from the database, got refused, and showed nothing: the button reset, the run stalled, no message. The rejection had no catch anywhere along the chain, so it landed nowhere. This has now been the same failure twice.

A refused advance raises the notification that was already written for it, addressed to the session, and the skip-a-stuck-step path got the same treatment. Underneath both, the app now has a global handler for a rejected promise that nothing caught, so a failure with no home surfaces instead of vanishing. Expect to see failures that were silent before.

Two engine surfaces stopped lying while we were in there. One unanswered question from a free agent used to block every workflow run in the session, because a question with no run attached matched every run; only a question belonging to a run blocks that run now. And the next-step badge recomputed its model from your current preferences while the run used the model frozen when the agent was spawned, so changing a preference mid-session made the badge show a model that was not going to run. The badge reads the frozen value, on both the chat strip and the workflows list.

### [#1231] Answer chips are in English

A yes-no question from an agent rendered its two answer chips in Italian. The fallback that generates them when a question ships no answers of its own, which is most of the time, was written with Italian words in it. They read `yes` and `no` now, and the question patterns that trigger them are English only.

Completed work on an integration lens also folds behind a count instead of listing every closed issue inline, matching how the workflows lens has always handled its finished items.

### Smaller fixes

- [#1226] Opening the diff from a resolver lands on a fresh view instead of whichever commit the previous resolver was looking at
- [#1229] A resolution that failed to push loads with the session instead of waiting for you to visit the overview first, so the resolve lens shows its pending push and its rail marker without a detour
- [#1229] A resolver that fails to start reports it, rather than failing silently
- [#1231] The kind an agent gets assigned no longer prints a warning to the console in release builds

## Goodboy v0.1.61

A linked GitHub issue opens inside the session now, from every place that lists one. A plan run that gets held back says so instead of doing nothing, and a resolver verdict survives a restart.

### [#1223, #1224] Linked GitHub issues open where the work is

A GitHub issue linked to a session was the last integration object that sent you to a browser tab. Linear, Sentry and GitLab already routed theirs internally. The GitHub issue view had been write-complete for a while, comments and description edits included, but the only way to reach it was one tab inside the GitHub studio, so every other surface fell back to a link.

There is now a GitHub issue lens, and every entry point goes through it: the linked issues parsed from a pull request body's "Closes #N" lines, the work items on the pull request pane, and the linked work list on the session overview. The lens takes an issue number directly, so an issue mentioned by a pull request opens even when nothing links it to the session as a task. In the session overview, the two lists that used to disagree with each other now behave the same way.

Two labels stopped lying while we were in there. The resolver thread card said "Open on GitHub" for a click that never left the app, and the pull request pane said "Open in code host" for a button that opens the create-PR panel in place. The changelog's release view dropped its "Open on GitHub" button, which duplicated a body already rendered underneath it.

One entry point stays external on purpose: the issue links preview inside the create-PR form, because navigating away from a half-written pull request would discard the draft. Assigning an issue and moving its status are still not built, on any source.

### [#1220] A plan run that is held back says so

v0.1.60 moved the open-question gate into the engine, and the plan run path was never wired to it. Pressing Run plan with an unanswered question in the session did nothing at all: no run, no error, no message. The rejection had nowhere to land, because the app has no global handler for one.

The plan run now goes through the same wrapper the workflow paths use, so a blocked run raises the notification that was already written for it. The pipeline lane on the session overview carried the identical unguarded call, unreachable today but one refactor away from repeating this, and it is guarded now too.

A held-back run also stops reporting itself as started. The wrapper swallowed the refusal but the caller still returned an agent id, so an "Implementer started" toast fired for a run that never began, right underneath the warning saying it had not. The same false announcement on the auto-advance path is gone as well.

### [#1221] A resolver verdict survives a restart

A queued resolution stored its verdict only in memory. Restart the app before pushing, and the verdict was gone: push-all read nothing, found the reply had already been posted, did nothing about the thread, and deleted the row on its way out. The review thread stayed open on GitHub and disappeared from the pending queue with no notice.

The verdict is now written with the row. Where the thread came from an agent's settlement, it is carried through directly. Where it came from a single-thread resolve, it is derived from what was actually posted: a commit means resolved, a stated reason means wontfix, a reply on its own means analyzed, and a resolve that posted nothing records no verdict rather than inventing one.

This also fixes the display it fed. A queued thread used to read as open after a restart even when it carried a real verdict, because the same missing value was standing in for one.

### Smaller fixes

- [#1222] The session goal editor keeps what you wrote when you close it. Escape and Cancel used to wipe the draft outright, and an unsaved draft now carries a marker next to the trigger
- [#1222] Editing the goal field directly no longer leaves a stale expanded draft behind that a later save would write back over the newer text
- [#1222] Six performance logs stopped printing to the console in release builds

## Goodboy v0.1.60

GitLab stops being a read-only mirror: the merge request conversation, its approvals, and issue comments all live here now. The open-question gate moved into the engine, and a retried resolution no longer posts the same reply twice.

### [#1215] The merge request conversation, and the actions on it

Goodboy could already post to a GitLab merge request and never show you what it posted. `gitlab_create_mr_discussion` and `gitlab_create_mr_note` shipped wired only into the review publish flow, so an agent could leave an inline discussion you had no way to see without opening gitlab.com. The merge request detail rendered three things: state badges, the description, and a merge button.

There is now a Conversation tab. Threads render their head note and replies, with the file and line when the discussion is anchored to a diff position, and a resolved badge when every resolvable note in the thread is settled. GitLab system notes are filtered out and the count reported underneath, so "changed title from X to Y" does not bury the review. An Approvals row shows how many approvals are in, how many the project requires, and who gave them.

From the same panel you can reply inside a thread, post a standalone note, approve or revoke your approval, close, reopen, and toggle draft. GitLab models draft as a title prefix, so the toggle rewrites the title and handles the `[Draft]`, `(Draft)` and legacy `WIP:` forms. Every action reflects its result without a manual refresh, because the command returns the updated merge request and the panel adopts it.

Still ahead: resolving a thread from the app, emoji awards and suggestions, and anchoring an existing discussion inside the diff viewer. There is no polling. Instances without the approvals endpoint hide the row rather than taking the panel down, which also means their approval rules are not shown.

### [#1218] Comment on and edit a GitLab issue in place

A GitLab issue showed its title, description, and state, and nothing else, while GitHub issues already took comments and description edits. Both GitLab issue surfaces now carry the same tabbed layout as the merge request panel: notes render oldest first with the composer at the bottom, system notes filtered and counted the same way, and the description is editable inline through the same editor the other issue sources use.

### [#1214] The open-question gate moved into the engine

v0.1.59 closed three manual bypasses one call site at a time, but the gate still lived in the callers, so every new entry point could forget it, and one already had: the mobile bridge reimplemented next-step selection and activated a step with no gating at all, so a phone tap could force a run past a question the desktop blocks on.

Starting a pending step now refuses by default when its workflow run has an unanswered question, and only an explicit bypass gets through. Four call sites carry that bypass, each one a start the operator already confirmed. Every refusal reaches you rather than disappearing: the orchestrator records the block and the panel asks for an answer, the mobile bridge returns the real reason instead of a generic failure, and fire-and-forget starts raise a notification. Forcing a skip past a blocked step now carries that decision into dynamic runs too, where it used to be dropped.

One related fix on the same path: a stuck step could be force-skipped from the sidebar for a session you had never opened, because the check read in-memory turn state that is only filled in for the session on screen. It now reads what the database says first.

### [#1216] A retried resolution posts its reply once

Resolve posted a reply and then resolved the thread with nothing tying the two together. If the resolve failed after the reply had already landed, the queued row stayed put and the UI invited a retry, which posted the identical comment again, compounding every time. A resolution now records that its reply went out before it attempts the resolve, so a retry skips straight to resolving. The ad-hoc single-thread path had no queued row to record against, so it persists one first.

Three more on the same path: the push-all summary only counts a comment when one actually went out, the outcome dispatch is exhaustive so a new outcome cannot fall through it silently, and a resolver turn that fails now says so instead of failing quietly. Two resolvers can no longer start at the same time, and the hand-off to the next resolver in a chain still runs.

### [#1217] Review drafts stay on the pull request they were written for

Publishing a review selected every draft in the session and never checked which pull request it belonged to, so drafts staged against one PR could post onto another. v0.1.59 opened a second place to publish from, where the target and the drafts could disagree. Drafts are now matched to the resolved target, and the ones that belong elsewhere stay where they are and are reported rather than posted.

### Smaller fixes

- [#1217] Deleting a provider API key or removing a budget cap asks first, and names what it is removing
- [#1217] Switching agents no longer carries the previous agent's diff jump and merge dialog over
- [#1217] Spawning from the composer no longer pulls you into the chat view
- [#1217] A disabled Run control keeps its tooltip, so it can say why it is disabled
- [#1217] The questions pane shows a skeleton instead of flashing "no open questions" before it has loaded, and the pull request pane has a loading skeleton on first fetch
- [#1217] The companion setup reports a failure in words instead of printing the raw exception
- [#1217] The link-issue form shows its error in the footer, where the other forms put theirs

## Goodboy v0.1.59

Approving a pull request and replying to an issue both happen here now, a queued resolution never closes a thread nobody settled, and a workflow stops walking past a question nobody answered.

### [#1209] Approve or request changes from the pull request panel

The GitHub pull request panel rendered the whole PR and could merge, close, reopen and toggle draft, but it had no verdict control, so approving meant leaving for a browser tab. A Review action now sits in the same bar: approve, request changes, or comment, with an optional summary. It shares in-flight state with the other writes, so nothing else fires while a review posts, and it is hidden on merged and closed PRs where a verdict means nothing. One thing had to be fixed before it could ship: the publish path resolved its target from the session's first linked pull request rather than the one on screen, so in a session with more than one PR a verdict would have landed on the wrong one. The panel now passes the PR you are looking at. Note that submitting a verdict also publishes any review drafts staged in that session, which is how the publish path already behaved.

### [#1210] Read and write a GitHub issue conversation in place

A GitHub issue showed its title, state and description and nothing else. Its conversation was invisible, and no issue in the product had a composer at all. The issue detail now carries a Conversation tab with the full thread (author, date, markdown body) and a composer at the bottom that posts back to GitHub and reloads the thread. When a post fails it keeps what you typed and shows what GitHub returned. This is the first issue comment you can write from inside Goodboy. Linear, GitLab and Sentry issues stay read-only for now.

### [#1211] A review thread never closes on a verdict nobody gave

A queued resolution carrying no verdict was read as a fix, so the thread was resolved on GitHub. Every row written before the verdict column existed carries no verdict, so this was reachable rather than theoretical. An unknown verdict now posts its reply, leaves the thread open, and says so in the toast. Three more fixes on the same path: a batch that hits an error keeps going instead of abandoning every thread after the first one and still refreshes what it did close, a rejected push no longer marks items failed that never needed the push, and the three paths that delete queued resolutions can no longer run at the same time and post the same comment twice.

### [#1212] A blocked workflow says so at the button

The open-question gate stopped a workflow from marching past a question nobody answered, but enforcing it was left to each caller, and three manual start paths walked around it. Both run start buttons now carry the blocked state at the action itself and route through the same confirm the next-step action already used, so starting anyway is a deliberate second click. Starting a step agent refuses an unconfirmed start of a blocked run instead of relying on the caller to have checked. Engine-level enforcement, where the gate lives inside the store action rather than the buttons, is still ahead.

### Smaller fixes

- [#1208] A linked GitHub issue opens the issue instead of landing in the pull request pane
- [#1208] External links go through one shared open path rather than raw anchors that a webview may not honor

## Goodboy v0.1.58

Deleting a session no longer leaves an orphaned worktree behind, a new Storage section lets you see and reclaim what archived sessions cost on disk, the issue-to-PR loop closes on GitHub and GitLab alike, and Linear and GitLab issue descriptions get the same in-app editor GitHub already had.

### [#1202] Deleting a session cleans up its worktree, every time

Deleting a session could fail with "Directory not empty" when a dev server was still running inside its worktree: git de-registered the folder anyway and it stayed on disk forever. Closing a session now kills every process in its terminal session, not just the shell, waits for the terminals to close before touching the filesystem, retries the removal and falls back to deleting the folder directly if it still won't budge, and reports the path if it truly can't. On startup, folders git or the app lost track of are found and offered up for cleanup, never removed automatically.

### [#1203] See what archived sessions cost on disk, and reclaim it

Settings gets a Storage section, above the danger zone, showing the database size and how much archived sessions' transcripts and worktrees add up to. Two explicit actions, each confirmed twice: prune archived transcripts (deletes their `turn_events` rows and vacuums the database so the file actually shrinks; the chat view of an unarchived session comes back empty, though the session's own messages stay in the database) and remove archived worktrees (drops the folders and keeps the branches, so a worktree can be recreated later). Nothing runs on a timer, nothing runs automatically.

### [#1205] The issue-to-PR loop closes on GitHub and GitLab

An issue linked to a session after its pull request was already open never got a `Closes #N` line, so it never auto-closed. Linked issues now get a "Link issue" action that adds the reference to an already open PR. On GitLab, a work item now also completes when its merge request merges, matching the behavior GitHub already had.

### [#1204] Edit a Linear or GitLab issue description in place

GitHub issue descriptions became editable in-app in the last release. Linear and GitLab issues now get the same editor, writing straight back to the provider.

### [#1200] A resolver's verdicts survive a restart

Restarting the app used to wipe a resolver's decisions on a review thread, and the "no verdicts" warning would blame the agent for threads it had actually resolved. Verdicts are now rebuilt from the session transcript on load, so a restart no longer loses them.

### Smaller fixes

- [#1201] The "update available" chip pulses three times, then rests, instead of forever
- [#1198] Spawning a resolver shows a status dot instead of a spinner

## Goodboy v0.1.57

One visual grammar across every screen, a provider you connect in one click, diffs side by side, and the round where a workflow's orchestrator stopped hiding what it decided.

### [#1174] One grammar for every lens

The integrations lens, the inspector and the workflows lens had each grown their own way of drawing a header, a row and an empty state, so the same idea looked different depending on where you found it. They now share extracted primitives: agent cards come down to three tiers, the explore tree is a tree again, history stops crowding the present, and a pulsing dot means something is actually running rather than decorating a finished card. Creating something no longer yanks you somewhere else, and navigation is an explicit choice instead of a side effect. The theme toggle is back in reach, prose in a list has one answer, and the resolver panel is readable: replies follow a contract, comment previews stop showing their raw source, and control markers no longer reach the screen.

### [#1175] One rhythm for every pane, one click to connect a provider

Every pane measure is centred inside its surface, the chat header lines up with the transcript, the workflow builder and the provider studios sit on the shared rhythm, each region has exactly one scroll owner, and every studio panel has a real heading. Connecting a provider used to mean a terminal and a copy-pasted command: it is one button now, backed by a per-provider state machine that probes real auth, injects its own login env, opens the most auth-shaped URL it sees (never a docs link, and never an unsafe one), reads the URL across PTY chunk boundaries, and keeps probing after the login process exits. The inbox is told when a provider connects. Dates and money are formatted at one pinned locale and one precision, so the same number reads the same everywhere, and a GitHub or GitLab issue opens in full inside the session pane.

### [#1177] The orchestrator says what it decided, and who decides next

The run pill contradicted the strip, the card said "running" three times, and a run stuck on a failed step stayed frozen. The strip is rebuilt around a derived state ladder, a run gets a generated title and can be renamed from its header, lifecycle actions live in the detail header, and open questions surface even under autorun. Spend is charged to the run that made the decision rather than a faked turn, with the orchestrator's own telemetry kind, and a run records why it stopped instead of leaving you to read it off the copy.

### [#1179] One detail grammar, one diff geometry

The GitHub, Linear, Sentry and GitLab detail panes each carried a right-hand column that squeezed the content and left the labels misaligned; the properties now live in the header band as one grid, which is also what aligned the studio and session panes. The split diff had columns sized by their content, so every file came out a different width with stray horizontal scroll: both sides are exactly half now, rows wrap, and the layout is identical from file to file. The `@@ -15,15 +16,15 @@` hunk header is replaced by what it actually means, `Lines 16-30 · in export const FlowProvider`.

### [#1178] A resolution reply has a shape

A resolver's reply on a review thread is now wrapped by the app itself: the verdict, your explanation, and the resolution with a link to the commit that carries the fix. The model writes only the middle, so nothing states the outcome twice.

### [#1180] Fable stays at the top, off the coding roles

A workspace that pointed a coding role at another provider's model could be substituted onto Fable when the run landed on Anthropic, because the substitution picks the strongest model in the same cost tier and Fable outweighs Opus. It still does, and the escalation paths that depend on that ordering are untouched. Fable is marked as a thinking model instead, and the substitution skips it for anything but a role that only thinks.

### [#1181] The pull requests a session actually has

The session's code-host pane offered one CTA, "open in code host", even when the session had a pull request. It lists every pull request on that branch now, with its state, the one you are reading marked, and a click to switch between them.

### Smaller fixes

- [#1174] Reaching a resolver's diff no longer needs the inspector, and the shortcut stops claiming a file while it is still loading
- [#1175] The overview skeleton matches the pane that replaces it, and the issue inbox skeleton no longer grows unbounded
- [#1177] A step summary gets a 60s budget and its child is killed on timeout, with the retry running against the original output
- [#1177] Toasts moved to the top right, under the bell, and stay above the panels they warn about
- [#1179] A refused model pick is notified instead of silently ignored
