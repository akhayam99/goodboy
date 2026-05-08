# Phase Templates

Phase templates let you structure multi-step goals. Chain agents across phases, share context, and optionally run agents in parallel.

## What's a phase template

A sequence of **phase definitions**. Each phase is a discrete step with its own prompt and agent. Phases run sequentially (or in parallel groups). Output from phase N becomes context for phase N+1.

Use templates to:

- Avoid context bloat (split a large goal into focused phases)
- Reuse patterns (planner → coder → reviewer workflows)
- Run agents in parallel (experimental, see [docs/parallel-agents.md](./parallel-agents.md))

## Structure

A phase template is a YAML-like structure with:

```
name: template-name
phases:
  - name: phase-1
    prompt: "Directive for agent 1"
    transitions: [phase-2]
  - name: phase-2
    prompt: "Directive for agent 2"
    transitions: []
parallelGroups: []
```

**PhaseDefinition fields**:

- **name**: unique phase identifier (alphanumeric + dash)
- **prompt**: directive for the agent running this phase (can reference synthetic context from prior phases)
- **transitions**: list of next phase names (empty = terminal phase)

**Parallel groups** (optional):

- **enabled**: run phases concurrently?
- **maxConcurrency**: max agents running at once (default 3)
- **phases**: list of PhaseDefinitions to run in parallel

## Create via UI

1. **Left sidebar → PhasesPanel**
2. **+ new template** (or edit existing)
3. **+ add phase** → fill name + prompt → set transitions
4. **(optional) group into parallel execution** → toggle parallel mode, adjust concurrency
5. **Save** → apply to current session or save as reusable template

## Examples

### Sequential: planner → coder → reviewer

Three-phase pipeline. Planner breaks down the task → coder implements → reviewer checks quality.

**Phase 1: Plan**

- Name: `planner`
- Prompt: "Break down the goal: {goal}. List deliverables, risks, and dependencies."
- Transitions: `[coder]`

**Phase 2: Code**

- Name: `coder`
- Prompt: "Given the plan from phase 1, implement the changes. Focus on {goal}."
- Transitions: `[reviewer]`

**Phase 3: Review**

- Name: `reviewer`
- Prompt: "Review the implementation. Check for: edge cases, tests, docs. Suggest fixes."
- Transitions: `[]` (terminal)

Flow: planner → coder → reviewer → done.

### Parallel: decompose → fan-out → merge

Large refactor split into 3 parallel agents.

**Phase 0: Decompose**

- Name: `decompose`
- Prompt: "Plan a refactor of {goal}. Break into 3 independent modules. List each scope."
- Transitions: `[parallel-group-1]`

**Parallel group 1**:

- enabled: true
- maxConcurrency: 3
- phases:
  - `refactor-a`: "Refactor module A per decompose plan"
  - `refactor-b`: "Refactor module B per decompose plan"
  - `refactor-c`: "Refactor module C per decompose plan"
- All 3 run concurrently on separate worktrees

**Phase 1: Merge**

- Name: `merge`
- Prompt: "Integrate the 3 modules. Resolve any conflicts. Ensure tests pass."
- Transitions: `[]`

Flow: decompose → (a|b|c in parallel) → merge → done.

## Prompt building

Synthetic context flows from phase to phase. When phase 2 starts, kAY.am injects:

```
—— Context from prior phases ——
Phase 1 (planner):
{entire turn history and outputs from phase 1}

Now execute phase 2:
{your phase 2 prompt}
```

Write phase prompts assuming prior context is available. Use placeholders:

- `{goal}`: the session goal
- `{phase-N-output}`: explicit reference to a prior phase's output
- `{workspace}`: repo path
- `{worktree}`: current worktree path

Example phase 2 prompt:

```
Build on the plan from phase-1. Focus on the deliverables:
{phase-1-output}

Now write the code.
```

## Best practices

- **Narrow prompts**: Each phase should have one job. Avoid kitchen-sink prompts.
- **Single responsibility**: Don't ask a phase to plan AND implement AND review. Split it.
- **Test early**: Create a phase template on a sandbox repo. Verify flow before production use.
- **Explicit context**: If phase 2 depends on phase 1 output, mention it in the prompt. Don't assume.
- **Parallel limits**: Keep max parallelism ≤ 5 (provider quota + machine limits).
- **Error recovery**: If a phase fails, kAY.am rolls back that phase's worktree. Re-run or abort.

## Save and reuse

Templates are stored locally (SQLite). After creating a template, **save as reusable** to apply it to future sessions without re-authoring.

See [docs/parallel-agents.md](./parallel-agents.md) for experimental parallel mode caveats and enable/disable instructions.
