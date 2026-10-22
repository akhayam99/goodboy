# Tasks and your tools

Connect your trackers, code hosts and Slack once. Their work lands in one list called Tasks, and agents can read and act on it without leaving Goodboy.

### Supported tools

Connect GitHub, GitLab, Bitbucket, Jira, Linear, Sentry and Slack in **Settings**, **Integrations**. Each one feeds Tasks and can start a session with its brief drafted.

### Agents use your tools

Agents on any provider can read and act on the tools you connected, without holding your keys. The agent asks Goodboy over a local socket only your user can open, and Goodboy makes the call.

### Tasks

Work from one list instead of seven tabs. Issues, Slack threads, Sentry errors and your pull and merge requests sit together, and the header reads **Tasks** with how many are open beside it. Tasks opens on **For me**: issues assigned to you, what you starred and what is linked to your sessions. **All** next to it shows everything your tools sent.

Items come in groups, by source unless you pick **Status**, **Project** or **None** from the grouping button, which names the current one (**Group: Source**). Each group names its total once, beside its label, shows its first five rows and **Show all**, and a starred item still counts in its source group; an expanded group draws only the rows on screen and names where you are ("41 of 312"), so a thousand open items never scroll forever. Every row has the same columns: source, key, title, status, priority and age. The key shows what tells rows apart (a Sentry error shows its number, a Slack thread has none), and a thread has no status. Rows carry no buttons: the row is the button.

Narrow the list from one **Filters** button in the header, the same lines icon as every filter: **Source** with its counts, **Show** (starred, in progress, with a session, closed), **Type** and **Project**; a choice with nothing in it is dimmed and shows no number, and the button shows how many filters are on. A search that is a key shows the issue found and the rows that match. A tool that did not load, or is rate limited, says so in one gray line inside its group, with a **Retry** button. **Refresh** and **Manage tools** sit in `⋯`.

Click a row or press **Enter** to open it in the pane on the right, and move with **j** and **k** while the pane follows. **Enter** again starts from the open item. **Open full** in the pane shows it at full width; **Back** at the top returns to the list.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/inbox-list-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/inbox-list-light.webp" alt="The Tasks page with the For me and All switch, the search box, the Filters button and Group: Source, listing 10 items from Linear, GitHub, Jira, Sentry and Slack, with Linear issue CAS-231 open on the right with Start session, Link to a session and its conversation">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Find any issue by code or link

Paste `HBL-412`, `#318` or a link in the search box and open the issue, even when it is not assigned to you. It appears under **Not in Tasks** with its full details beside it.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/inbox-lookup-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/inbox-lookup-light.webp" alt="The Tasks search box holding HBL-412, with the Linear issue Retried webhooks post a second credit listed under Not in Tasks above the Starred, Linear and Slack groups, and its details open on the right with Start session and its conversation">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Starred issues

Star an issue from the star next to its key in the pane, or press **s** on its row, to keep it in the **Starred** group on top of Tasks. Stars belong to the workspace, not to one session.

### Start from any item

Press **Start session** on an issue or an error (or **Start from HBL-412** from the row's menu) and the New session draft opens with the issue picked and its brief being written. On a pull request waiting for your review, **Review pull request** starts a read-only reviewer instead.

### Link an item to a session

Attach a task to work that already exists with **Link to a session**, under the properties of the item, or use **Link work** (or **L**) in a session's Overview header. A link closes the task when its pull request merges, and **Don’t close** turns that into "Part of" in the pull request body. **Unlink** has an Undo for about 10 seconds.

### Trackers

Read Sentry errors with stack trace, breadcrumbs and tags inside Goodboy, and filter them by project. Comment, assign, edit and move issues in Linear and Jira the same way.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/inbox-sentry-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/inbox-sentry-light.webp" alt="Tasks with 4 Sentry errors listed, and DuplicateChargeError: charge already captured for order open on the right, showing status Unresolved, culprit settle_batch, 42 events, 9 users, Start session and a 2 frame stack trace">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Code hosts

Work on GitHub pull requests and issues, GitLab merge requests, and Bitbucket comments, approvals and merges without leaving Goodboy. GitHub and GitLab can work side by side, one for code and one for tickets.

### Slack: what agents can do

Decide how far agents go in Slack. Tick the channels they follow, then set each action: reading threads is **Allowed** or **Off**, and replying and reacting are **Allowed**, **Ask first** or **Never**. Replies default to **Ask first**, and agents never start new conversations or send direct messages.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/inbox-slack-permissions-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/inbox-slack-permissions-light.webp" alt="Settings, Integrations, Slack: the channels #payments-oncall and #ledger-dev ticked and #releases not, and under What agents can do, Read threads in followed channels Allowed, Read other channels you're in Off, Reply in threads Ask first, Add reactions Allowed, then the Signature note Written with Goodboy">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Reply ready for #channel

Approve what goes out in Slack from where you already are. Under **Ask first**, the agent's reply waits in the session as a card with the message it answers and the draft. You choose **Send**, **Edit** or **Discard**.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/inbox-slack-reply-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/inbox-slack-reply-light.webp" alt="An agent chat with a card titled Reply ready for #payments-oncall, waiting for you, quoting Omar T. and holding a drafted answer about payments-api #318 and notify-relay #57, with the buttons Send, Edit and Discard above the message box">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Slack signature

Let people in a thread see when an agent wrote a reply. Under **Signature** in the Slack settings, the note under agent messages reads "Written with Goodboy" by default, and you can change the text or switch it off.

### Images from your tools

See screenshots attached in Linear, Jira and GitHub inside Goodboy. Your key goes only to that tool's own image host.

### Records read the same way

Read items from any tool the same way. The header holds the tool mark, the key and the star, with the start action, **Open full** and `⋯` (open in the tool, copy the link, refresh) beside them, and the title on its own line. Under it, the properties sit in groups spaced apart on one grid of labels and values: status, priority and assignee, then project and labels, then pull requests and sessions, then details. A Sentry error shows its level as a word and its culprit once, with no made up description. The conversation ends with its reply box, **Reply on Linear** or **Reply on GitHub**, which scrolls with it. On the full page the studio band reads **Tasks › key**, and the Tasks crumb leads back. Values you can change, like the status or the assignee of a Linear issue, open their menu from the value.

### Comment threads

Follow replies under the comment they answer, in Linear and GitLab, and fold long threads behind **Show earlier replies**. Press **Reply** on a comment to answer inside its thread.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/inbox-comment-threads-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/inbox-comment-threads-light.webp" alt="Three conversation panels: a GitLab merge request conversation with Robin V. and a threaded reply from Sam K., a Show 2 earlier replies fold and a Resolved thread row above Reply on GitLab, a GitHub issue conversation quoting leo-t in the Write a comment box, and a read only conversation">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>
