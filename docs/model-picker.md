# Model picker

> **Read this when** building or changing how a user picks a model or effort.
> **Not for** installing/connecting a provider CLI (`docs/providers.md`).

Owns one question: how a user chooses which model runs the next turn, and how
much thinking to buy, without learning a different control per provider. The
catalog data behind it is [providers.md](providers.md).

The rule that keeps this alive: **the catalog describes, the picker renders.**
Every grouping, ordering and label decision is authored data on the catalog
entry. No component parses a model id, and no component branches on a provider.

## One picker, many mounts

Choosing a model happens in a dozen places and has to read as the same act in
all of them. There is one implementation; a mount composes it, never forks it.
A surface needing a different arrangement composes the same parts differently.
It never grows a private model list, a private effort control, or a native
`select`.

## What a catalog entry declares

Grouping, ordering and chip text come from the `presentation` object on the
entry, authored, not derived at render time. Two invariants, both guarded by
`catalog.test.ts`: `order` is unique within a provider, and all entries sharing
a `group` share a `family`.

The trap the types do not catch: `presentation.version` is the only source of
visible chip text. The sibling `label` field looks interchangeable and is not,
it carries the accessible name and the tooltip only.

## Axes: one shape for every provider

Providers disagree about what tuning is: an effort ladder, a named variant, an
independent toggle, an account-level gate. The picker refuses to learn those
differences. One provider-aware layer, `modelAxes`, normalizes them into a
single shape, and every surface renders that shape.

- **An axis the model does not have is omitted. An axis the current selection
  cannot reach stays mounted and disabled.** The ladder must not jump around as
  the user toggles things.
- **Every control here is a chip**, never a `select`.
- **One effort control exists in the app.** A second one anywhere is a bug.
- A tuning concept that is not a ladder, a variant list or a toggle is added to
  the axes shape and renders for everyone, never special-cased in a mount.

The picker renders one ladder in this order: Provider, Model, Model Version,
Variant and Effort. Model names and versions come directly from the catalog
entry's authored `presentation.group` and `presentation.version`. `modelAxes`
turns those entries into separate model and version axes alongside variant and
effort, so mounts never regroup catalog entries themselves.

An absent axis is `null` in `modelAxes` and renders no row. A model whose
`presentation.group` is `null` has no version axis. A model with no variants
has no variant axis, and a model or provider with no effort control has no
effort axis. Opus 5 therefore renders no Variant row.

A present axis remains mounted when the current selection makes some or all of
its authored choices unreachable. Those choices render disabled. A partially
reachable effort ladder keeps every authored level visible and disables only
the unavailable chips. This preserves the ladder's height, reading order and
keyboard order while the user changes a higher selection.

## Selection to spawn

The picker owns and persists a selection: a catalog key plus its tuning. One
resolver turns that into CLI arguments. Provider quirks live there, not in the
UI: clamping an effort the chosen combination cannot serve, a flag only one
provider needs. A clamp is reported back so the surface can say what it did,
rather than silently changing the user's choice.

In the other direction, an id resolves from the catalog descriptor only when it
is a catalog key. Raw CLI ids and provider slugs keep their regex parsing,
because transcripts store what the provider echoed and those strings carry
effort suffixes the catalog key does not.

## Max Mode

Cursor gates some models behind Max Mode, an account preference that also
changes billing. A gated model refuses the turn with
`ActionRequiredError: Max Mode Required` and exits non-zero.

Max Mode is a persisted preference in the Cursor CLI config (`cli-config.json`,
top-level `maxMode`), and the CLI resolves its config directory from
`CURSOR_CONFIG_DIR`, then `XDG_CONFIG_HOME/cursor`, then `~/.cursor`. When a
spawn resolves to a combo that requires it, Goodboy mirrors the user's config
into a Goodboy-owned directory with `maxMode` set and points that one spawn at
it with `CURSOR_CONFIG_DIR`. **The user's own config is never written to.**

Which combos need it is authored on the catalog from probing the CLI, never
inferred from the slug. To check a new slug:

```
cursor-agent -p "say ok" --output-format stream-json --workspace /tmp --model <slug> --force
```

Exit 0 means no Max Mode needed; a `Max Mode Required` stderr means it does.
The picker says so before the first turn is spent.

## Adding to the catalog

**A model** in an existing family: add the entry with its `presentation` and an
`order`, and for Cursor probe each combo's Max Mode. Nothing in the picker
changes; if something has to change, the entry was under-authored. **A
family**: add the `ModelFamily` value. **A provider**: author its catalog, then
teach `modelAxes` its tuning.

## Settled decisions

Tried, or shipped and reverted. Do not reintroduce:

- A flat searchable model list. It lost the version ladder, the cost signal and
  the tuning context.
- A native `select` for variants or effort. Every control here is a chip.
- Provider or family bands above the model rows. Removed on purpose: the user
  already knows which provider they selected.
- Deriving family, version or cost from the model id with a regex. That is what
  authored `presentation` replaces.
- Hiding levels the current toggle combination cannot reach, instead of
  disabling them.
