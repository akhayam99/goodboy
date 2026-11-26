# Connections

> **Read this when** you change the Connections page: its tiles, a provider or tool page, a key check, or a link that opens one of them. **Not for** the provider lifecycle itself ([providers.md](../providers.md)) or the places rail around it ([surfaces.md](surfaces.md#the-places-rail)).

Connections (`features/connections`) is the page of the providers on this Mac
and the integrations of the workspace. It sits after Chat on the places rail,
reads Connect there, has no shortcut and answers to Providers and Integrations
in ⌘K. It is the one home of providers and integrations.

## The index

- One tile per provider and integration that is set up, in a fixed order
  (`connectionGroups`), and a low Not set up row under each group with the verb
  that sets it up.
- Health changes a tile's word and border, never its place.
- The tile word, the word in a provider page's head and the header counts all
  come from `connectionStateOf`, which takes a tool's word from `toolStateOf`,
  the same word the tool page's head shows.
- Only workspace bindings count as connected tools, on the index, the door and
  the tool page alike (`workspaceBindingsOf`).
- GitHub has no key: its tile and page read the time of the last gh check that
  answered (`githubCheckedAt`), and whether it is connected comes from
  `isGithubConnected` alone.

## Key checks

- Each key check lives in memory in the store, one entry per key with its time
  (`integrationKeyChecks`, written by `checkIntegrationKey`, latest only).
- The index checks every key of the workspace at most once a minute unless its
  refresh forces it (`checkTools`).
- A failed read keeps the last answer and shows the error on the refresh
  button. That error is the newest check of the workspace it names
  (`toolCheckErrors`, latest only per workspace): Refresh clears it once the
  check answers, and a late check of another workspace never shows.

## Detail pages

A tile, or a Not set up row, pushes its detail page through `openConnection`:

- studio focus `{ kind: 'provider', provider }`, with the install or sign in
  step, or `{ kind: 'tool', tool }` (`IntegrationDetail`);
- under the trail Connections > Claude or Connections > GitLab;
- the trail and Esc go back to the index at the scroll it had
  (`useScrollMemory`), and the door always lands on the index.

The tool page says what the tool does in the workspace, one row per use with
its count and a link to Tasks. The counts are the open records Tasks last
loaded (`toolUseCountsOf`, read through `selectToolUseCount`); nothing shows
before Tasks loaded them. A tool whose key is missing reads Paused.

A missing or bad key is replaced in place (`replaceIntegrationKey`):

1. The host checks the new key first.
2. The keychain slot of the binding is rewritten, and the binding is kept.
3. A key check asked while the new key was checked is dropped once it is saved.

## Links into Connections

Every link to a provider or a tool, from a notification, an error, the usage
chips or ⌘K (`connectionPaletteEntries`), opens its page through
`openConnection`, as a link that stacks. Settings has no providers or tools
scope (`SettingsStudioScope` is home, app, workspace), and the Settings rail has
no row to Connections: Search settings answers Providers and Integrations with
Go to Connections (`settingsPaletteEntries`).

Old links keep working:

- a `goodboy:open-settings` event on scope providers or tools opens Connections
  (`settingsOverlayFromEvent`), and so does a stored notification action
  (`mapRecoveryAction`);
- a restored window on a provider or tool page lands on its Connections page
  (`withoutRemovedPages`);
- a remembered Settings page lands on This Mac, Look and alerts, or on This
  workspace, Models for the old Models page (`resolveSettingsFocus`).

The saved window layout is the one place the old scopes stay: it stores a
Connections page as the Settings provider or tools page 0.36 opens
(`storedStudioOf`), and restore folds it back.

## Tests

- `settings-has-no-connection-scopes.test.ts` keeps new code from opening
  Settings on the providers or tools scopes.
