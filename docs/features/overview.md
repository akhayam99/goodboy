# Overview and activity

Open a session to see everything about its task in one place: the goal, the projects and branches it touches, what happened so far and what waits on you.

### Session overview

See the goal, linked issues, projects and branches of a session on one screen, with the buttons to start an agent or a workflow. Each branch is one row with its pull request, its changes and the one action its state asks for, such as **Rebase**, **Push** or **Create PR**. Merged or closed branches fold away under their project.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/overview-session-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/overview-session-light.webp" alt="The overview of the session Stop retried webhooks posting a second credit, with Context, Artifacts 3, the linked pull request #57, HBL-412 and PAYMENTS-API-3F2, and Link work, then the projects payments-api (pull request #318, and #311 under Show finished with Close branch) and notify-relay (pull request #57), each with New branch, above the Activity and Log tabs with the cost $3.47 and New">
</picture>

<sub>Screenshot from Goodboy 0.23.0</sub>

### Refresh a session

Pull requests opened outside Goodboy, by an agent or from a terminal, show up when a turn ends or when you come back to the window. **Refresh** in the session's `...` menu, or **⌘⇧R**, re-reads projects, branches and pull requests right away.

### Activity

Follow what happened in a session in two views. **Activity** has one row per agent, workflow run or fix run, with its state, model, time and cost, and a **Needs you** block on top lists what waits on you. **Log** lists the plain facts, such as context changes, branch events and links, newest first with a search box.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/overview-activity-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/overview-activity-light.webp" alt="The Activity timeline of a session: the Activity and Log tabs with the cost $12.87 and New, a Needs you block with #318 and Surface retry state in notify-relay, each with Open, and below Now the steps, each row with a role icon, its title, the model with its effort and the time: Cover the console retry states on Haiku 4.5 Medium with a range of 11 to 14 minutes, Report the session outcome, a Fix run on #318 with 4 need you and 4 working, and Add the stuck-delivery banner on Kimi K3 marked Needs you">
</picture>

<sub>Screenshot from Goodboy 0.23.0</sub>

### Next

Know the one move that unblocks the task, such as answering a question, fixing a failing check or opening a pull request. **Next** offers it as one button, and **Not now** puts a suggestion away until the situation changes.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/overview-next-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/overview-next-light.webp" alt="The Next row of a session: the plan Show the attempts on each delivery, marked Ready to implement, with a Start implementer button and a more menu">
</picture>

<sub>Screenshot from Goodboy 0.13.1</sub>

### Time left

See how long a step has left, estimated from your own past runs. Queued steps show a range, and a run slower than usual turns its time warm.

### File versions

Undo an agent's edit in a session without a branch: each file it changed is kept as it was, with **Restore**.
