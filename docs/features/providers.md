# Providers, limits and cost

Watch how much of each plan is left, keep work moving when a provider runs out, and see what it all costs. Goodboy shows limits in the top bar and spend in one place, so you decide where work goes before a limit stops it.

### Usage limits chip

See how much of your Claude and Codex plans is left before a run stops. Each provider gets a chip in the top bar with one bar, the tighter of the 5-hour window and the week, and its percent once it passes 70%. Hover it for the plan and reset time, or click it to open the providers menu. When the bar has no room for every chip, the rest sit behind a count such as **+2** with each hidden provider's mark beside it.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/providers-limits-chip-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/providers-limits-chip-light.webp" width="460" alt="The top bar with the Claude limits chip at 84% and its card open: Claude max, Claude is about to run out, Weekly 84% used, resets Tue 13:07, and Click for details">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Use reset

Spend a free Codex reset at the right moment. When Codex offers one, its page shows the expiry and **Use reset**, and Goodboy asks you to confirm. If spending it now would waste most of the week, **Keep my reset** is the default.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/providers-codex-reset-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/providers-codex-reset-light.webp" alt="The Codex provider page, Usage group: 5-hour window 41% used, Weekly 58% used, a row reading 1 free reset that expires Oct 3 with the Use reset button, and Open in Impact">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Fallback when a limit is hit

Keep a task moving when a provider runs out. With another eligible provider connected, the turn can move there, and the chat records where it went.

### Provider order and Auto

Choose which providers a workspace uses and in what order. **When a provider is out** in Defaults lists them, and you set each one to **On**, **Backup only** or **Off**. Auto starts new work on the first On provider that can work, and each role shows what Auto picks for it on fixed columns (model with its mark, effort, Auto or Pinned). A pin that cannot run shows a warning glyph whose tooltip says why, and one line above the roles offers **Back to Auto** for those.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/providers-fallback-auto-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/providers-fallback-auto-light.webp" alt="Settings, Providers and models, Models: the line When a provider is out with Claude, Codex and Cursor as backup, the Chat row for new chats, and the roles Scout, Debugger and Planner, Implementer, Tester and Resolver, then Reviewer, Docs and Report, each with its model, effort and an Auto picker">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Model picker

Pick a model with the reason next to it. The picker leads with **Auto** and what it resolves to now, then the provider, model family, version and effort. When a provider is not a plain choice, it says why, such as **Backup only** or **At limit until 18:40**.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/providers-model-picker-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/providers-model-picker-light.webp" alt="The model picker opened on the New chats row in Models: Auto with what it resolves to now, then Provider icons, Model chips Haiku, Sonnet, Opus and Fable, Version 4.6, 5 and 5.5, and Effort from Low to Max">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Impact

See what Goodboy got done and what it cost over **7 days**, **30 days** or **All time**. **Overview** shows sessions, merged pull requests, resolved reviews and runs by workflows, and **Shipped**, **Flow** and **Spend** go deeper. The cost in the top bar opens **Spend**.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/providers-impact-overview-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/providers-impact-overview-light.webp" alt="Impact, Overview, over 30 days: the tiles Sessions 24, Pull requests merged 17, Reviews resolved 46, Run by workflows 63% and Median session 1.4h, and the sessions that shipped the most">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>

### Monthly cap and budget alert

Set a monthly cap per provider and hear about it before you reach it. In **Spend**, open a provider, enter the cap and the share of it where Goodboy warns you. Past that share, the next turn goes to another provider with room.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/providers-monthly-cap-dark.webp">
  <img src="https://raw.githubusercontent.com/akhayam99/goodboy-media/main/features/providers-monthly-cap-light.webp" alt="Impact, Spend, Claude: 90% of cap with spent this month $152.37, cap $170.00 and remaining $17.63, and the monthly cap form with a $170 cap, an alert at 80% of the cap, and the note that Goodboy warns you and routes the next turn to another provider">
</picture>

<sub>Screenshot from Goodboy 0.27.1</sub>
