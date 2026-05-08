# Parallel Agents (Experimental)

Parallel agents let you fan out a goal across multiple independent agent threads, then merge results back into your main session. Experimental as of v0.7.

## What it is

**Fan-out/fan-in**: One goal → multiple agents work in parallel on throwaway worktrees → results converge.

Example: Decompose a large refactor into 3 independent tasks (module A, B, C), run them in parallel, then merge conflicts in one place.

Each parallel agent gets:

- Its own isolated worktree (auto-cleaned on success or failure)
- Copy of the parent context (goal + phase definitions)
- Independent turn history (no bloat in main session)

## Enable it

**Settings → Experimental → toggle parallel agents** → set **max parallelism** slider (default 3, range 1–10).

Restart the app for changes to take effect.

## Create a parallel phase group

In your phase template, add a phase group with **parallel mode enabled**:

1. **PhasesPanel** (left sidebar) → **edit template** (pencil icon)
2. **+ add phase group** → toggle **parallel execution**
3. Add phase definitions (one per agent). Each phase gets its own agent instance.
4. **Save template** → apply to your session

Example:

```
parallelGroup:
  enabled: true
  maxConcurrency: 3
  phases:
    - name: refactor-module-a
      prompt: Refactor auth module...
    - name: refactor-module-b
      prompt: Refactor state module...
    - name: refactor-module-c
      prompt: Refactor api module...
```

Each phase runs on a new worktree. On completion, kAY.am merges back into main branch (interactive merge conflict resolution if needed).

## Known limitations

- **Merge conflict resolution UI**: Wired post-#281. Use CLI `git merge` as fallback if conflicts arise.
- **Turn history**: Each parallel agent has independent history; main session doesn't see sub-turn details.
- **Context sharing**: Agents copy parent context once at launch. Real-time parent updates don't propagate to running agents.
- **Provider quota**: Parallel agents count against your provider subscription cap. Running 3 agents uses 3x the quota.

See [#214](https://github.com/serenis/kay-am/issues/214) for v0.7 integration tests (fan-out/fan-in verified).

## Rollback

If a parallel run fails:

1. **Worktree auto-cleanup**: kAY.am deletes throwaway worktrees. No manual cleanup needed.
2. **Main session unaffected**: Parent worktree + branch remain intact.
3. **Git state**: Partial merges are rolled back. Re-run or abort safely.

## Best practices

- Keep parallel phases independent. Avoid cross-phase dependencies.
- Narrow phase prompts (single responsibility per agent).
- Test on a sandbox repo first.
- Merge results manually if auto-merge feels risky — use `git merge` from CLI.

See [docs/phase-templates.md](./phase-templates.md#example-decompose--fan-out-parallel--merge) for a full parallel example.
