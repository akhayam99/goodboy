# Plans, reports and wireframes

Plans, reports and wireframes live next to the task, not inside a chat. You can read, comment on, version and run them, and every one stays available as a file on disk.

### Artifacts

Keep everything a session made in one list. The tabs **All**, **Plans**, **Reports** and **Wireframes** filter it, and the rows group under plain labels by what needs you first: **Needs you**, **Ready**, **Running**, **Consumed** (a plan that ran, or a version a newer one replaced) and **Recently deleted**, every row in view except the deleted ones, behind **Show**. Each row shows one action, such as **Run plan**, **Approve** or **Answer**, and **Delete** moves an artifact to **Recently deleted**, where **Restore** brings it back. Resting on the state of a row opens a fact card (`artifactStateCardOf`) with the state, its detail and what it means.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/artifact-list-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/artifact-list-light.webp" alt="The Artifacts list of the Harborline session under the tabs All, Plans, Reports and Wireframes: a Needs you group with a plan marked Partly ran, a Ready group of wireframes, reports and plans with Ready to run, a Running group with a wireframe and a plan with Stop, a Consumed group and Recently deleted with Show">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Plan parts and Run plan

Check a plan before it runs. A plan can give each part done-when checks and the files it expects to touch, and **Run plan** turns each part into a sub-agent. On a plan that came from a workflow, the action reads **Approve** and continues that workflow.

### Plan beside the planner

Read the plan without leaving the planner. It shows as one row in the planner's chat, and pressing it opens the plan in a drawer on the right, with **Open in Artifacts** and **Edit**. Reports and wireframes open the same way from Activity or from their chip in a transcript.

### Comment on a plan

Point at a part, a paragraph or a few words and leave a comment. Comments stay drafts until **Send to planner** posts them in plan order and asks for an updated plan. When the new version lands, each comment reads **Addressed** or **Not changed in v2**.

### Report as a document

Read a report as one document. The **Outline** on the left jumps to each section, and **Edit** changes the text in place.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/artifact-report-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/artifact-report-light.webp" alt="The report Retried webhooks no longer double credit, rev 2, with an Outline (What was wrong, Where it came from, What changed, Evidence, Sources, Open questions, Next steps), the section What was wrong and the What changed table">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Files on disk

Open any artifact as a folder, in your browser or your file manager. The folder is rewritten on each revision and follows renames.

### Create a wireframe

Describe the screen in a **Brief**, add **Attachments**, and choose the **Fidelity** (**Plain wireframe** or **Repository styled wireframe**) and the **Target** (**Phone**, **Desktop** or **Phone and desktop**). **Included context** lists exactly what goes into the pack.

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
