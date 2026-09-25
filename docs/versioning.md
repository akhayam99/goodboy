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
