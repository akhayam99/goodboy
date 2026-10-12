# Security, backup and updates

Keep tokens out of what you save, move your setup between machines, and update without losing data. Goodboy checks locally, backs up before it changes your data, and tells you what each release does.

### Security findings

Catch a token pasted into a saved script before it travels. Each time you save a project script, Goodboy checks it for keys and tokens on your Mac, and findings show in **Settings**, **App**, **Security findings**. **Not a secret** dismisses one and **Flag again** brings it back.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/security-findings-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/security-findings-light.webp" alt="Security findings: 1 saved script looks like it contains a token, seed-sandbox in payments-api, Token ending 9f2c, with Details and the Not a secret button">
</picture>

<sub>Screenshot from Goodboy 0.13.1</sub>

### Findings kept out of the export

Move your setup to a new machine without carrying a flagged token: an export leaves out the script that holds it, unless you include it on purpose.

### Export and import your setup

Move your setup to another Mac, or keep a copy. **Backup** exports in groups such as workspaces, workflows and saved scripts, and **Never included** lists what always stays behind, keys and sign-ins first. **Import** shows what it adds before writing and never deletes.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/security-export-import-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/security-export-import-light.webp" alt="Settings, App, Backup, Export: checkboxes for Workspaces, Projects, Folder paths (off), Your profile, Workflows you made, Workflows the orchestrator wrote (off), Saved scripts, Permission rules, Budget rules, Linked integrations and App preferences, and a Never included box listing API keys and tokens, sign-ins, sessions, artifacts, worktree folders, usage history and notifications">
</picture>

<sub>Screenshot from Goodboy 0.13.1</sub>

### Backup before a data update

Update without worrying about your data. Before an update changes it, Goodboy makes a full copy and keeps the last two, and if the copy fails, the update does not start. A release that changes data in one direction says so in its changelog entry.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/security-backup-notice-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/security-backup-notice-light.webp" alt="The changelog entry for Goodboy 0.13.0, In the update, 3 features and 1 fix, with the notice: This version updates your data in one direction. To go back to 0.12, restore the backup Goodboy made before updating">
</picture>

<sub>Screenshot from Goodboy 0.13.1</sub>

### Newer data guard

Open an older Goodboy on newer data without damage. It stops before touching anything and offers **Restore backup** or **Quit**, and your current data stays in a copy next to the database.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/security-newer-data-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/security-newer-data-light.webp" width="680" alt="The screen an older Goodboy shows on newer data: This database was upgraded by a newer Goodboy, with the buttons Restore backup and Quit">
</picture>

<sub>Screenshot from Goodboy 0.13.1</sub>

### Updates

Get updates in the background, then see what is new. When one is ready, the chip in the Goodboy row offers **Restart now**, **Later** and **What's new**. With agents running, **Restart when they finish** waits for them.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/security-updates-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/security-updates-light.webp" width="500" alt="The 0.13.1 available pill in the top bar with its confirm open: Goodboy 0.13.1 is available, Nothing is running, and the buttons What's new, Not now and Download and restart">
</picture>

<sub>Screenshot from Goodboy 0.13.1</sub>

### Changelog in the app

Read release notes inside the app, searchable, with links into the screen each change touched. Before an update, **What's new** shows every release it brings, and after one it covers the releases you skipped.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/security-changelog-update-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/security-changelog-update-light.webp" alt="The Changelog opened from the update, Installed 0.12.3: a search box, releases 0.13.1 and 0.13.0 marked in the update, 0.12.3 marked installed, and Goodboy 0.13.1 with two fixes linked to Sessions and App">
</picture>

<sub>Screenshot from Goodboy 0.13.1</sub>

### Before and after pictures

See a change instead of reading about it. Release notes can show **Before** and **After** pictures, with a lightbox, in light and dark.

### Guide

Learn how Goodboy works in short chapters that follow a task, with search and links that open each screen. Open **Guide** from the Goodboy menu or the palette.

**Also in this area**

| Feature     | What it does for you                 |
| ----------- | ------------------------------------ |
| Update pill | A quiet pill when an update is ready |
