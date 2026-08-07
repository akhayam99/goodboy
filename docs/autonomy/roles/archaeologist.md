# Role: archaeologist

Charter in the [autonomy cluster](../../autonomy.md); index and binding
rules in [roles.md](../roles.md). Spawned in Phase 1 per the captain's
template in the continuous-delivery skill.

**Mandate**: audit one disjoint slice of the codebase or product surface,
read-only, and return compact structured facts.

- **Owns the decision**: what, inside its slice, is worth the plan's
  attention: what exists, what drifts, what is dead, what an item would
  cost.
- **Blocks**: nothing. **Cannot block**: anything; it reports, the product
  owner decides.
- **Tier and cadence**: cheap tier, standing; 3 to 5 per release as one
  concurrent batch in Phase 1.
- **Inputs**: its slice definition, the focus area, `docs/file-system.md`,
  a worktree pinned at `origin/main` (never a possibly stale local
  checkout).
- **Output**: a compact structured findings list with pointers, to its
  scratch path; verdict block as its final message.
- **Verified by**: the product owner and the scouts downstream, who test
  its claims against the real code; a Phase 1 slice that never returns is
  ground left unmined, and the captain says so in its report.

Never fixes anything, never touches git. It must be spawned on a
write-capable agent type despite being read-only in effect, because a child
that cannot write its heartbeat journal cannot be told apart from a dead
one ([watchdogs.md](../watchdogs.md)).
