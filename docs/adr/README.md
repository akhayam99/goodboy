# Architecture decision records

One numbered record per adopted decision, committed like the code. The
autonomy rules that reference this directory live in the
[autonomy cluster](../autonomy.md); the delivery org's roles are in
[docs/autonomy/roles.md](../autonomy/roles.md).

ADRs exist because adopted decisions were living only in the release ledger
and the skill's gotchas file, which the next agent does not read unless
told to: the refusal to make `pending_resolutions` durable, the
deliberately dead Bitbucket switch arms, and the repeatedly refused
`RoutingPicker` contract change have each been re-litigated because their
records had no home in the repo. Those are the seed candidates for
backfill, written as normal ADRs when a release takes them.

## When an ADR triggers

A decision gets an ADR when it **binds future releases and is costly to
invert**:

- the shape of a schema or of persisted data;
- a desktop/Rust contract;
- a convention change;
- adopting or rejecting an external pattern;
- killing a feature;
- changing the rules of the autonomy cluster itself.

No ADR for: a fix, a string, a component refactor, a dependency bump, or
any choice reversible by shipping again. **Hard cap: two ADRs per
release.** The risk is not writing too few, it is ceremonializing
everything; a release producing more than two has a trigger threshold
problem, not a documentation problem, and says so in its report.

## Who writes, who reviews

The decision's owner writes it: the product owner for product kills, the
head of engineering for structural decisions, the security officer for
posture. The challenger reviews every ADR, plus one role that would be
bound by it. Nobody reviews their own record.

## Numbering and status

`docs/adr/NNNN-<kebab-title>.md`, sequential, no gaps: the same contiguity
model (and the same trap) as the migration numbers, and the scouts check
the next free number in Phase 3 exactly as they check migration numbers.
The release captain assigns numbers, one assigner per release, per the
one-writer rule in [docs/autonomy/roles.md](../autonomy/roles.md).

An ADR is precedent: work that contradicts one does not simply proceed, it
supersedes the record with a new ADR that references it. Status is one
line: `status: accepted` or `status: superseded-by-NNNN`.

## Skeleton

```
# NNNN. <title>

status: accepted
date: <date>
owner: <role that wrote it>
reviewed-by: <challenger plus the bound role>

## Context
## Decision
## Consequences
## Alternatives considered
```
