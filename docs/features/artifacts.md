# Plans, reports and wireframes

Plans, reports and wireframes live next to the task, not inside a chat. You can read, comment on, version and run them, and every one stays available as a file on disk.

### Artifacts

Keep everything a session made in one list. The tabs **All**, **Plans**, **Reports** and **Wireframes** filter it, and the rows group under plain labels by what needs you first: **Needs you** (for a plan, only while its own planner waits for your answer), **Running**, **Ready** (plans), **To read** (reports and wireframes), **Used** (a plan that ran, or a version a newer one replaced) and **Recently deleted**, every row in view except the deleted ones, behind **Show**. Each row shows one action, such as **Run plan**, **Approve** or **Answer**, and **Delete** moves an artifact to **Recently deleted**, where **Restore** brings it back. Resting on the state of a row opens a fact card.

With two or more branches among the artifacts a switch groups the list **By branch** or **By state**, the same choice as on Runs and Questions. A branch comes from the mounts the artifact was made for, else its agent, else its run. Each branch or series is a group, with the ones that need you first and **No branch** for what is not tied to one.

The state is a word on the row, used ones fold into **N used**, and **Recently deleted** stays its own group at the end. The tabs stay on top and filter over the groups. An artifact on two branches is drawn in both with **Also on**, and a plan on a series sits once in the series group. Each copy has its own row key, so Stop, Delete and the row menu act on the one artifact you press.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/artifact-list-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/artifact-list-light.webp" alt="The Artifacts list of the Harborline session grouped By branch, under the tabs All, Plans and Reports and the By branch and By state switch: payments-api fix/duplicate-credit, notify-relay feat/retry-budget and ledger-core rec/2-backfill, each with Open branch and its rows marked Ready or Ready to run, a report marked Also on another branch, then No branch and Recently deleted with Show">
</picture>

<sub>Screenshot from Goodboy 0.31.12</sub>

### Plan parts and Run plan

Check a plan before it runs. A plan can give each part done-when checks and the files it expects to touch, and **Run plan** turns each part into a sub-agent. Parts that touch the same file never run at the same time. The plan page groups parts into **Runs first** and **Then, in parallel**. It names a shared file and shows each part as a block of its files. On a plan that came from a workflow, the action reads **Approve** and continues that workflow.

One line under **Parts** says how they run. It reads `3 parts, one after the other.` or `3 parts, 2 at once.` A part with no chosen model reads **Default model**. A plan version reads `v3`.

### Plan beside the planner

Read the plan without leaving the planner. It shows as one row in the planner's chat, and pressing it opens the plan in a drawer on the right, with **Open page** and **Edit**. Reports and wireframes open the same way from Activity or from their chip in a transcript.

### Comment on a plan

Point at a part, a paragraph or a few words and leave a comment. Comments stay drafts until **Send to planner** posts them in plan order and asks for an updated plan. When the new version lands, each comment reads **Addressed** or **Not changed in v2**.

While comments wait, **Send to planner** is the one filled button. **Run plan** and **Approve** ask before they go on without them. Text you typed and did not add is kept as a draft. It is saved when you leave the box, press Esc, press a button, close the page or reload.

**Send to planner**, **Send to** the agent, **Copy**, **Run plan**, **Approve** and **Start implementer** wait for that save, from the header, the menu, the palette and the chat row. If it made a new comment, they ask again instead of starting. A comment that failed to save keeps its text and place and comes back as an open box. Those buttons stay off until you save it or press Cancel.

Drafts load when the session opens, so a restart keeps them in the chat row, the list and the palette too.

After the plan ran, the bar reads **Not sent**, with **Send to** the agent and **Copy**. A stopped agent, or a plan with no known agent, leaves only **Copy**. An agent that is still writing takes the comments in its queue, as a chat message does, and they read Sent once the turn starts or the queue is saved. A second batch goes through once the first was taken. Comments sent this way are never read back as a plan revision.

### Report as a document

Read a report as one document. The **Outline** on the left jumps to each section, and **Edit** changes the text in place. Its page shows no glyph above its own title.

While an agent still writes an artifact, its page says so in one sentence, with no placeholder bars. **Follow** opens that agent, and each scout under **Agents on this run** opens its own. The wireframe **Flow** view says Flow once, on its tab.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/artifact-report-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/artifact-report-light.webp" alt="The report Retried webhooks no longer double credit, rev 2, with an Outline (What was wrong, Where it came from, What changed, Evidence, Sources, Open questions, Next steps), the section What was wrong and the What changed table">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Files on disk

Open any artifact as a folder, in your browser or your file manager. The folder is rewritten on each revision and follows renames.

### Create a wireframe

Describe the screen, add attachments, and choose how faithful it is and which device it targets. **Draw a wireframe** is the last entry of the **New** menu in a session, after **Start a run** and **Write a report**. Describe the screen in a **Brief**, add **Attachments**, and choose the **Fidelity** (**Plain wireframe** or **Repository styled wireframe**) and the **Target** (**Phone**, **Desktop** or **Phone and desktop**). **Included context** lists exactly what goes into the pack.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/artifact-create-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/artifact-create-light.webp" alt="The Draw a wireframe form with a Brief, Fidelity set to Repository styled wireframe, Target set to Phone and desktop, a Context line of 10 sections and the Model chooser above Generate wireframe">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Wireframes scouted first

Get wireframes that start from your code. Before drawing, two scouts read the repo, one for **screens and routes** and one for **data and contracts**. Each claim they make has to cite a file that exists, and the run shows how many were verified.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/artifact-scouts-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/artifact-scouts-light.webp" alt="The wireframe Deliveries screen, high fidelity, with Agents on this run: screens and routes done in 14s with 8 of 11 claims verified, and data and contracts still running">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Wireframe versions

Go back to any wireframe version with **View**, **Compare** and **Restore**.

### Compare

See what changed between two wireframe versions side by side. Pick the versions at the top and a screen on the left, and the change list sits underneath.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/artifact-compare-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/artifact-compare-light.webp" alt="Compare v2 to v3 of the Deliveries wireframe: the screens Deliveries (Changed), Delivery detail (Same) and Endpoints (Same), the two frames side by side, and Changes on this screen with Added Stuck delivery: evt_4Q2x for 14 min and Changed Deliveries table">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Ask for a change

Point at what you want changed: pick elements on the wireframe, choose this screen or all screens, and ask.

### Import wireframe JSON

Bring in a wireframe made elsewhere, with a preview of any fixes before it lands.

### Revisions and Restore

Bring back an earlier plan, report or wireframe as a new revision, with its author, without losing the later ones.

### Save a copy and New variant

Export a wireframe as a folder of pages, or redraw it at the other fidelity.

## Under the hood

This part is for contributors and agents who change the feature.

- Branch Work tab: `branchWorkArtifactsRegistration` gives the Branch page the artifacts of one branch. `useArtifactBranchGroup` reads the same `groupArtifactRowsByBranch` group as this list. `ArtifactBranchWork` draws it as `ArtifactWorkGroup`, a group of the tab's one grid. Its `ArtifactWorkRow` rows fill the runs' columns: state dot, kind glyph, title, state word, time and action. A plan opens its parts from **N parts** after the title. Both row shapes read `useArtifactRowModel`. **Open branch** here lands on that tab (`openBranchWorkTab`).
- Fact card on a row: `artifactStateCardOf` builds the card that opens on the state of a row.
- A plan's Needs you: `artifactStateOf` reads only `plannerQuestionCount`, the open questions of the plan's own planner (`plannerQuestionsOf`). The list rows, the reader and the plan model pass the same count, so a question from another agent leaves every plan where it was.

- Work tab return: `ArtifactBranchWork` remembers the opened row with `useRowReturn` and unfolds the used rows when it was one of them. `useArtifactBranchGroup` is loaded only once `useArtifactBranchItems` is settled. The regressions are in `apps/desktop/src/features/session/components/BranchWork/index.test.tsx` and `apps/desktop/src/features/artifacts/hooks/useArtifactBranchGroup/index.test.ts`.
- Branch return: `ArtifactBranchList` unfolds the saved row before `useRowReturn` scrolls to it. `useArtifactBranchItems` keys provenance retries by state, and `useArtifactMountIds` follows a pending empty or failed read with the latest requested phase. The Back regression is in `apps/desktop/src/features/artifacts/components/ArtifactStudio/byBranch.test.tsx`; retry coverage is in `apps/desktop/src/features/artifacts/hooks/useArtifactBranchItems/index.test.ts`.
