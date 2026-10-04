# Plans, reports and wireframes

Plans, reports and wireframes live next to the task, not inside a chat.

### Artifacts

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/artifact-list-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/artifact-list-light.webp" width="694" alt="The Artifacts list of the Harborline session, 8 items under the tabs All, Plans, Reports and Wireframes: a wireframe at 1 of 2 scouts done, Deliveries screen with 4 screens, a plan marked Ready to run, two reports and two plans marked Ran, each with its kind on the right">
</picture>

Keep plans, reports and wireframes next to the task. The tabs **All**, **Plans**, **Reports** and **Wireframes** filter the list, and the rows sit in groups: **Needs you**, **Ready** and **Running** on top, then **Ran** and **Recently deleted**, both closed until you open them. Each row shows the kind, the title, a state (**Needs you**, **Ready to run**, **Running**, **Ran**, **Partly ran**, **Replaced**, **Ready** for a report or wireframe at rest, or **New** for one made in the last day that you have not opened) with a short detail such as **part 2 of 3**, and when it was made. The same word heads the artifact when you open it. A plan with parts opens in the list to show them.

Each row has its action in place: **Run plan** or **Answer**, **Stop** while it generates, **Retry** when it produced nothing. Edit, Copy and Open in browser show when you point at the row, and **Delete** and the **...** menu are always there. **Delete** works on every kind in every state except a generation in progress. It acts at once, shows **Undo**, and moves the artifact to **Recently deleted**, where **Restore** brings it back. **Delete permanently** exists only there; it asks first and says the **Run by** history goes with it.

### Plan parts and Run plan

Check a plan before it runs. A plan can give each part done-when checks and the files it expects to touch, and **Run plan** turns each part into a sub-agent.

### Report as a document

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/artifact-report-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/artifact-report-light.webp" alt="The report Retried webhooks no longer double credit, rev 2, with an Outline (What was wrong, What changed, Evidence, Sources, Open questions, Next steps), the section What was wrong and the What changed table">
</picture>

Read a report as one document. The **Outline** on the left jumps to each section, and **Edit** changes the text in place. The same file opens in a browser on another machine.

### Files on disk

Open any artifact as a folder, in your browser or your file manager. The folder is rewritten on each revision and follows renames.

### Create a wireframe

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/artifact-create-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/artifact-create-light.webp" alt="The Create wireframe form with a Brief, Attachments, Fidelity set to Repository styled wireframe, Target set to Phone and desktop, Read from payments-api and notify-relay, Based on a run and the Included context list">
</picture>

Describe the screen in a **Brief**, add **Attachments**, and choose the **Fidelity** (**Plain wireframe** or **Repository styled wireframe**) and the **Target** (**Phone**, **Desktop** or **Phone and desktop**). **Read from** picks the project branches the agent looks at, and **Included context** lists exactly what goes in the pack.

### Wireframes scouted first

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/artifact-scouts-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/artifact-scouts-light.webp" alt="The wireframe Deliveries screen, high fidelity in the Generating state, with Agents on this run: screens and routes done in 14s with 8 of 11 claims verified, and data and contracts still running">
</picture>

Get wireframes that start from your code. Before drawing, two scouts read the repo, one for **screens and routes** and one for **data and contracts**. Each claim they make has to cite a file that exists, and the run shows how many were verified. **Stop** ends the run.

### Wireframe versions

Go back to any wireframe version with **View**, **Compare** and **Restore**.

### Compare

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/artifact-compare-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/artifact-compare-light.webp" alt="Compare v2 to v3 of the Deliveries wireframe: the screens Deliveries (Changed), Delivery detail (Same) and Endpoints (Same), the two frames side by side, and Changes on this screen with Added Stuck delivery: evt_4Q2x for 14 min and Changed Deliveries table">
</picture>

See what changed between two wireframe versions side by side. Pick the versions at the top, pick a screen on the left, and read the change list underneath. The added banner and the changed table are outlined in the right frame.

### Ask for a change

Point at what you want changed: pick elements on the wireframe, choose this screen or all screens, and ask.

### Import wireframe JSON

Bring in a wireframe made elsewhere, with a preview of any fixes before it lands.

### Revisions and Restore

Bring back an earlier plan, report or wireframe as a new revision, with its author, without losing the later ones.

### Save a copy and New variant

Export a wireframe as a folder of pages, or redraw it at the other fidelity.
