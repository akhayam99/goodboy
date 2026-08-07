# Autonomy: visibility

Part of the [autonomy cluster](../autonomy.md). This file owns the run log:
the structured line every spawn leaves behind, where it lives, and what the
engagement report derives from it. The state files it sits beside are listed
in AUTONOMY.md; the liveness checks that read the same disk are in
[watchdogs.md](./watchdogs.md).

## Why a run log

At 3 to 6 items per release, a captain could reconstruct its release from
memory and the roster. At 20 slots ([composition.md](./composition.md)) a
release runs dozens of spawns across waves, and nobody's context survives
holding all of them: one real engagement's release count was capped by a
lead whose context filled with narratives it never needed
([roles.md](./roles.md)), and the engagement that closed 2026-08-07 could
state its own composition only because the ledger happened to record enough.
The run log makes the record deliberate instead of incidental: first you see
the machine, then you change it.

## The schema

One file per release: `~/.goodboy-autonomous/v<version>/run-log.md`. One
line per spawn, written by the **parent that spawned the child**, when the
child's roster entry resolves. The parent writes it, not the child, for the
same reason watchdogs read git instead of self-descriptions: a dead child
writes nothing, and the log must record deaths too.

```
| time | role | tier | item or slot | duration | verdict | report pointer |
```

- `time`: spawn time, UTC.
- `role`: the charter name from [roles/](./roles.md).
- `tier`: the tier actually used, from the table in
  [roles.md](./roles.md); with it, the effort when the brief set one.
- `item or slot`: what it worked on, or `release` for release-wide passes.
- `duration`: spawn to resolution, coarse is fine.
- `verdict`: the child's verdict line, or `died`, `replaced`, `dropped`
  per the ladder in [watchdogs.md](./watchdogs.md).
- `report pointer`: the child's scratch path, so a reader can descend
  without anyone's context carrying the narrative.

The log is append-only and single-writer per parent scope: the captain logs
its children, the delivery lead logs captains and triage officers in its own
engagement-level `run-log.md` at the state-directory root. Nobody edits
another parent's lines; the one-writer rule in [roles.md](./roles.md)
covers this file like every other state file.

## What derives from it

The delivery lead derives, at engagement close, without opening any child
narrative:

- **The timeline**: which phases and waves dominated wall time, which spawns
  died or were replaced. Cross-checked against the watchdog one-liners the
  same directory holds.
- **The `self:` accounting**: every org-class spawn named, so the report can
  state what the machine spent on itself against what it spent on product
  work, which [item-classes.md](./item-classes.md) requires.
- **Tier discipline**: spawns that ran above the tier their charter names
  are visible as lines, not as a feeling. The tier rules exist as cost
  controls, and a cost control nobody can audit is a suggestion.
- **The engagement report's per-release lines**: spawn counts and verdict
  ratios per role, which is how a role like the integrations owner, hired
  with an explicit sunset clause
  ([roles/integrations-owner.md](./roles/integrations-owner.md)), gets
  judged on record instead of on impression.

The log records; it never steers mid-release. A captain does not re-plan
because the log looks expensive, and a lead does not kill a live spawn over
a slow line: liveness decisions belong to [watchdogs.md](./watchdogs.md),
and cost decisions belong to the next release's plan, made from a complete
log rather than a partial one.
