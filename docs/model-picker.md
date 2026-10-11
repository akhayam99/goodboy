# Model picker

> **Read this when** building or changing how a user picks a model or effort.
> **Not for** installing/connecting a provider CLI (`docs/providers.md`).

This page answers one question. How does a user choose which model runs the
next turn, and how much thinking to pay for, without learning a different
control for each provider? The catalog data behind it is in
[providers.md](providers.md).

The rule that keeps this working: **the catalog describes, the picker renders.**
Every grouping, ordering and label is data written on the catalog entry. No
component parses a model id, and no component branches on a provider.

## One picker, many mounts

People choose a model in a dozen places, and it has to feel like the same act
in all of them. There is one implementation. A mount builds on it and never
forks it. A surface that needs a different arrangement puts the same parts
together differently. It never grows its own model list, its own effort
control, or a native `select`.

The body lives in `RoutingPickerBody`. `RoutingPicker` wraps it in a trigger
and a popover, or mounts it inline. Start agent and Resolve mount the body
straight inside their own popovers, so both list every connected provider and
the same Model, Version, Variant and Effort rows. A launching popover seeds it
from its role: Resolve from `resolver`, Explore from `scout`.

## Auto and Suggested

The row above the provider chips is one component with two meanings.

- **Configuring surfaces** (Models, the workflow builder, the Studio) call it
  **Auto**. Saving Auto means "follow the ladder", not a model. The closed
  trigger reads `Auto` and the open row says what Auto picks right now
  (`Now: Claude · Sonnet 5.5 · Medium`). A pinned trigger shows the model and an
  x back to Auto. The row under a Models page label and the run page and builder
  orchestrator pills read that answer from `useResolution`, so they name the same
  model; when a pin is skipped, the row's muted line says why through
  `explainResolution` (see `docs/providers.md`, Defaults internals). The background
  rows are named for the agent they drive: **History rewriter** (rebase and history
  clean-up) and **Scribe** (the title and body of a pull or merge request)
- **Launching popovers** (Start agent, Resolve) call it **Suggested**. It fixes a
  concrete model at launch and says why in one line, from the ladder step that
  decided (`suggestedRouting`): the role default on the default provider, a pin
  from Models, a CLI too old for the first choice, or the next provider in the
  fallback order. It never guesses from the task content. **Last used here**
  follows when it differs from the suggestion

## Models in the picker

Which models the list shows is a per app choice, stored in the settings key
value store (`providers.hiddenModels`). Catalog entries marked `legacy` start
hidden. The body filters the catalog before `modelAxes` builds the rows, so a
family with every version hidden leaves the Model row.

Hidden also means never chosen automatically. `selectableModels` and
`isModelHidden` (`modelVisibility.ts`) are the one filter. Every automatic choice
uses it: Auto for roles and background tasks (`resolveAuto`, with no `keptHidden`
escape), the orchestrator model menu (`orchestratorModelPool`), routing availability
(`workflowRoutingAvailability` answers `hidden` unless the pick is explicit), turn and
task fallback, and the Ask and Chat defaults. An explicit choice bypasses it: a role
or task model set in Settings, a step or agent lock, and a hand pick for one agent.
A hand pick for one turn or one agent also bypasses the provider list: on a provider
that is Off it still runs, and the transcript says "Running on Cursor because you
picked it for this turn. Cursor is Off in Settings." once.
When no allowed model is left for a role, `resolveRoleRouting` sets
`noAllowedModel` and the spawn refuses inline instead of running a hidden model. The
current value always shows in the picker, marked `Hidden in the picker`. The settings
icon next to **Provider** opens that provider's **Models in the picker** section,
which carries the one line that states this rule.

## What a catalog entry declares

Grouping, ordering and chip text come from the `presentation` object on the
entry. They are written by hand, not worked out at render time. `catalog.test.ts`
guards two rules. `order` is unique within a provider. All entries that share a
`group` also share a `family`.

One trap the types do not catch: `presentation.version` is the only source of
the version chip text you see. The `label` field is the canonical display name
for the model everywhere outside the picker axes.

## Axes: one shape for every provider

Providers disagree about what tuning is. It can be an effort ladder, a named
variant, an independent toggle or an account-level gate. The
picker refuses to learn those differences. One provider-aware layer,
`modelAxes`, turns them all into a single shape (the axes), and every surface
renders that shape.

- **An axis the model does not have is left out. An axis the current selection
  cannot reach stays mounted and disabled.** The ladder must not jump around as
  the user toggles things.
- **Every control here is a chip**, never a `select`.
- **One effort control exists in the app.** A second one anywhere is a bug.
- A tuning idea that is not a ladder, a variant list or a toggle gets added to
  the axes shape and renders for everyone. It is never special-cased in a mount.

The picker renders one ladder in this order: Provider, Model, Model Version,
Variant and Effort. Model names and versions come straight from the catalog
entry's `presentation.group` and `presentation.version`. `modelAxes` turns
those entries into separate model and version axes, next to variant and
effort. So mounts never regroup catalog entries themselves.

A missing axis is `null` in `modelAxes` and renders no row. A model whose
`presentation.group` is `null` has no version axis. A model with no variants
has no variant axis. A model or provider with no effort control has no effort
axis. That is why Opus 5 renders no Variant row.

No shipped model has variants today. Codex was the last provider that did. Its
Sol, Terra and Luna checkpoints became separate catalog keys. The reason: one
key covering three prices let a routing slot spawn the wrong one. The axis
stays in the shape for the next provider that ships a real variant list. A
variant list is a tuning choice inside one billable model, never a set of
models that bill differently.

A present axis stays mounted when the current selection makes some or all of
its choices unreachable. Those choices render disabled. A partly reachable
effort ladder keeps every level visible and disables only the chips that are
not available. This keeps the ladder's height, reading order and keyboard
order steady while the user changes a selection higher up.

## Selection to spawn

The picker owns and saves a selection: a catalog key plus its tuning. One
resolver turns that into CLI arguments. Provider quirks live in the resolver,
not in the UI. For example, it clamps an effort the chosen combination cannot
serve, or adds a flag only one provider needs. A clamp is reported back, so the
surface can say what it did instead of quietly changing the user's choice.

A pick reaches its mount as one `onChange(route)`, where the route is
`{ provider, model, effort }` (`PickedRoute`). The provider is always the one
the pick was made under, the model is its CLI id, and the effort is already
clamped to what that model serves. Picking Auto hands over
`{ provider: '', model: '', effort }`. A mount applies the route in one patch
and never builds a change from the pick plus props it captured earlier, so
there is nothing to keep in a ref and no way to save the old provider with the
new model. A mount that stores an optional effort asks `savedRouteEffort`,
which keeps an unset effort unset until the pick changes it and drops it for a
model with no effort ladder. It compares the pick with the effort that was
requested, never with the clamped value the picker showed: a saved Max shows as
High on Sonnet, so comparing with High would call a pick of Opus unchanged and
leave Max to run on it.

Going the other way, an id resolves from the catalog descriptor only when it is
a catalog key. Raw CLI ids and provider slugs keep their regex parsing.
Transcripts store what the provider echoed, and those strings carry effort
suffixes that the catalog key does not.

`onChange` fires on every click, the provider chips included, and a mount treats
each route as the new draft. A mount where a pick does something that the next
pick cannot undo, such as appending a model to a set, never acts in `onChange`.
It passes `commit` (`{ label, onCommit }`) and the picker renders one button,
disabled while Auto is in view, that hands over the route in view once. The role
model set in Defaults does this: choosing Opus and then its version is one
choice, so it adds one model.

## Max Mode

Cursor puts some models behind Max Mode, an account preference that also
changes billing. A model that needs it refuses the turn with
`ActionRequiredError: Max Mode Required` and exits non-zero.

Max Mode is a saved preference in the Cursor CLI config (`cli-config.json`,
top-level `maxMode`). The CLI finds its config directory from
`CURSOR_CONFIG_DIR`, then `XDG_CONFIG_HOME/cursor`, then `~/.cursor`. When a
spawn resolves to a combo that needs Max Mode, Goodboy copies the user's config
into a directory Goodboy owns, with `maxMode` set. It then points that one
spawn at the copy with `CURSOR_CONFIG_DIR`. **The user's own config is never written to.**

Which combos need it is written on the catalog after probing the CLI. It is
never guessed from the slug. To check a new slug:

```
cursor-agent -p "say ok" --output-format stream-json --workspace /tmp --model <slug> --force
```

Exit 0 means Max Mode is not needed. A `Max Mode Required` stderr means it is.
The picker says so before the first turn is spent.

## Adding to the catalog

**A model** in an existing family: add the entry with its `presentation` and an
`order`. For Cursor, probe each combo for Max Mode. Nothing in the picker
changes. If something has to change, the entry is missing data. **A
family**: add the `ModelFamily` value. **A provider**: write its catalog, then
teach `modelAxes` its tuning.

## Settled decisions

These were tried, or shipped and reverted. Do not bring them back:

- A flat searchable model list. It lost the version ladder, the cost signal and
  the tuning context.
- A native `select` for variants or effort. Every control here is a chip.
- Provider or family bands above the model rows. Removed on purpose: the user
  already knows which provider they selected.
- Deriving family, version or cost from the model id with a regex. Authored
  `presentation` replaces that.
- Hiding levels the current toggle combination cannot reach, instead of
  disabling them.
