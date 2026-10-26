# Versioning

> **Read this when** you pick the number for the next release or wonder why a
> pull request waits for a minor release. **Not for** the release steps
> themselves ([release-command.md](release-command.md)).

Goodboy is on `0.x`. The number tells you one thing: can you go back to the
version you had before?

## Patch: you can go back

A patch release (`0.5.0` to `0.5.1`) is anything you can undo by installing
the previous version. New features, fixes, and redesigns are patches. So is a
removed screen, because the previous version brings it back.

Patch is the default.

## Minor: a one-way door

A minor release (`0.5.x` to `0.6.0`) holds at least one change the previous
version cannot live with:

- a database migration
- a new on-disk format, a file under `~/.goodboy` that older builds cannot
  read
- a higher minimum version for an agent CLI

An older build refuses to open a database that a newer one migrated. It shows
a screen that offers to restore the copy taken before the migration, or to
quit. See [architecture.md](architecture.md) → Database migrations.

## State outside SQLite

Database migrations have a runner, a backup and convergence tests. State kept
anywhere else has none of that, so it follows one rule. It covers browser
local and session storage, the keychain, files under `~/.goodboy` or inside a
repository checkout, and settings keys.

A change that moves, renames or reshapes such state:

- reads the old shape for two minor releases after the one that writes the new
  shape, and writes only the new shape;
- names the release that stops reading the old shape, in the code and in the
  doc that owns the state;
- ships a test that boots from the old shape and finds the same value in the
  new one;
- counts as a one-way door when an older build cannot read the new shape (add
  the `One-way-door:` line below).

## Retired state

A state shape that Goodboy still reads, or that it stopped reading, has a row
here. The row names the release that writes the new shape and the release that
stops reading the old one. `legacy-state-sunset.test.ts` fails when the
running version reaches that release while the row is still listed: remove the
read in the code, then delete the row.

| State                                                     | Old shape                    | New shape written since | Old shape read until (excluded) |
| --------------------------------------------------------- | ---------------------------- | ----------------------- | ------------------------------- |
| local storage key `goodboy:diffReviewed:<session>:<view>` | no mount id in the key       | 0.18.1                  | 0.30.0                          |
| skills folder of a project                                | `<project-root>/.kay/skills` | 0.28.0                  | 0.31.0                          |

Gone already:

- The setting `context.roleMap` (introduced in 0.16.0) switched the role map off
  for a person who edited the database by hand; no screen set it. It is not
  read since 0.28.8, a stored `false` changes nothing, and the row stays in
  the database untouched. `store.sqlite-context-items.test.ts` boots from that
  old value.

The skills folder is also a one-way door: a build before 0.28.0 does not read
`.goodboy/skills`, so a skill written there is invisible to it. The commit that
made the change carries `One-way-door: new skills are written to
.goodboy/skills`, and 0.28.0 is a minor release.

A change to derived state that reshuffles what an existing user sees, such as a
lane or a sort order computed on launch, carries one line in the changelog.

## How a one-way door is spotted

- A new migration file under `packages/db/src/migrations/` counts on its own.
  Pull requests that touch a migration file get the `db-migration` label and
  wait for the next minor release.
- For a new on-disk format or a higher minimum CLI version, add a
  `One-way-door: <what changed>` line to the commit message body.

`node scripts/release-kind.mjs` reads both since the last tag that is not an
rc and prints `minor` or `patch` with the reason. Pass `--requested patch` and
it exits with an error when a one-way door is present.

## Major

`1.0.0` comes only when the owner asks for a major release in those words.
