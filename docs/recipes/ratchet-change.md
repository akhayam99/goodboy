# Recipe: a ratchet or baseline change

> **Read this when** a count in a baseline moves or you add a rule that counts
> something. **Not for** the rules themselves ([ratchets.md](../ratchets.md)).

## Steps

1. A count only falls. Fix the offense; never move code to dodge a count.
2. When your right change grows a count, stop and ask the owner. Only the owner approves a raise.
3. An approved raise is one entry in `baseline-exceptions.json`: `rule`, `file`, `count`, `reason`, `release`. The release PR lists it.
4. A new rule starts at its first measured count in its own baseline file, and a new file starts at zero.
5. Remove entries you fixed with the tool that owns the file (`--prune-suppressions` for `eslint-suppressions.json`), never by hand.

## Test

Run the guard that owns the baseline: `pnpm run check:rules`, then `pnpm run check:baselines`. A new rule gets a case in `scripts/rules/forbiddenPatterns.test.mjs`.

## Docs that move

[ratchets.md](../ratchets.md): the table row of a new rule or baseline.

## Failure-mode rows that apply

Not applicable: no write or state change.

## Guards

`check:baselines` fails on any grown entry and on a new key above zero that the exception file does not list.
