# Model picker

Owns how a provider, a model, and its tuning are presented and selected. The
catalog data behind it is described in [providers.md](providers.md); this doc
owns the picker's structure: what the catalog must declare, how the UI turns
that into rows and chips, and what reaches the spawn.

The rule that keeps this alive: **the catalog describes, the picker renders.**
Every grouping, ordering, and label decision is authored data on the catalog
entry. No component parses a model id, and no component branches on a provider.

## Surfaces

One implementation serves every mount: the routing picker in the composer, the
session and workspace routing rows, the workflow step cards, the agent-kind
rows, and the create-agent popover. `RoutingPicker/` holds the internals; a
mount composes them, it never forks them.

If a surface needs a different arrangement, it composes `CatalogGrid` and
`AxesSection` differently. It does not grow a private model list, a private
effort control, or a native `select`.

## Anatomy

Top to bottom, always in this order:

1. **Provider row.** Provider glyphs, one per connected provider. Picking a
   provider swaps the catalog below.
2. **Family sections.** A family is the vendor lineage of a model (`claude`,
   `gpt`, `composer`, `gemini`). The section header renders only when the
   provider has more than one family; a single-family provider shows no header.
3. **Group rows.** One row per macro model: the group label on the left, its
   versions as chips on the right, separated. `Opus` on the left, `4.6 4.7 4.8
5` on the right. A group of one still gets a row.
4. **Flat rows.** An entry with no group is a standalone chip in a shared row,
   for one-off models that have no version ladder (`Auto`, `Composer`).
5. **Axes.** Everything the selected model can be tuned by, below the catalog:
   variant, effort, toggles. Selecting a model refreshes this block.

## What a catalog entry declares

Every entry carries a `presentation` object next to its identity fields:

| Field      | Meaning                                                     |
| ---------- | ----------------------------------------------------------- |
| `family`   | Which family section the entry belongs to.                  |
| `group`    | The macro-model row label, or `null` for a flat chip.       |
| `version`  | The chip text. This is the only place chip text comes from. |
| `order`    | Sort position inside the provider. Unique per provider.     |
| `costTier` | Drives the chip color (`cheap`, `mid`, `expensive`).        |

Two invariants hold, and `catalog.test.ts` fails if either breaks:

- `order` is unique within a provider, so ordering is total and stable.
- All entries sharing a `group` share a `family`, so a group never straddles
  two sections.

Grouping consumes nothing else. Adding a model that groups correctly means
authoring these five fields, not touching the picker.

## Axes

`modelAxes({ model, selection })` in `@goodboy/core` is the only provider-aware
layer. It returns the same shape for every provider, and the UI renders that
shape without knowing which provider produced it:

- **effort**: a label plus every level with an `available` flag. Levels the
  current combination cannot reach render disabled rather than disappearing, so
  the ladder does not jump around as toggles change.
- **variant**: present only when a model has more than one variant, currently
  Codex Sol, Terra, and Luna. Chips, never a `select`.
- **toggles**: independent booleans, currently Cursor Thinking and Fast. Each
  carries `canToggle`, false when no combo exists on the other side.
- **requiresMaxMode**: true when the resolved Cursor combo only answers with
  Max Mode enabled. See below.

Effort is one component, `EffortChips`, used by every provider and every mount.
A second effort control anywhere is a bug.

## Selection to spawn

`ModelSelection` (`key`, optional `effort`, `variant`, `toggles`) is what the
picker owns and what gets persisted. `resolveModelArgs({ provider, selection })`
turns it into CLI arguments plus, for Cursor, the Max Mode flag. Cursor's
`resolveCursorCombo` picks the combo matching the toggles, then clamps effort to
what that combo pair supports and reports the clamp so the UI can say so.

Reading in the other direction, `parseModelId` resolves from the catalog
descriptor only when the id is a catalog key. Raw CLI ids and provider slugs
keep their regex parsing, because transcripts store what the provider echoed and
those strings carry effort suffixes the catalog key does not.

## Max Mode

Cursor gates some models behind Max Mode, an account preference that also
changes billing. A gated model refuses the turn with
`ActionRequiredError: Max Mode Required` and exits non-zero.

Max Mode is a persisted preference in the Cursor CLI config (`cli-config.json`,
top-level `maxMode`), and the CLI resolves its config directory from
`CURSOR_CONFIG_DIR`, then `XDG_CONFIG_HOME/cursor`, then `~/.cursor`. Goodboy
uses that: when a spawn resolves to a combo that requires Max Mode, it mirrors
the user's config into a Goodboy-owned directory with `maxMode` set and points
that one spawn at it with `CURSOR_CONFIG_DIR`. The user's own config is never
written to, and models that do not need Max Mode never get it.

Which combos need it is authored on the catalog (`CursorCombo.maxMode`) from
probing the CLI, not inferred from the slug. To check a new slug:

```
cursor-agent -p "say ok" --output-format stream-json --workspace /tmp --model <slug> --force
```

Exit 0 means no Max Mode needed; the `Max Mode Required` stderr means it does.

The picker states this before the first turn is spent: the tuning block says the
model runs in Max Mode and that Cursor prices those requests higher. The
per-account advisory remains for models that failed for a different reason, for
example an account where Max Mode itself is unavailable.

## Adding to the catalog

**A model** in an existing family: add the entry with its `presentation`, give
it an `order` that places it in the ladder, and for Cursor probe each combo's
Max Mode. Nothing in the picker changes.

**A family**: add the `ModelFamily` value and its section label. Sections appear
automatically once a provider has more than one.

**A provider**: author its catalog, then extend `modelAxes` with the axes that
provider exposes. If the new provider needs a control that is not an effort
ladder, a variant list, or a toggle, add it to `ModelAxes` and render it in
`AxesSection` for everyone. Do not special-case it in a mount.

## Settled decisions

These were tried, or shipped and reverted. Do not reintroduce them:

- A flat searchable model list. It replaced the grouped picker once and lost the
  version ladder, the cost signal, and the tuning context.
- A native `select` for variants or effort. Every control here is a chip.
- Deriving family, version, or cost from the model id with a regex. That is what
  `presentation` exists to replace.
- Hiding levels that the current toggle combination cannot reach, instead of
  disabling them.
