# ADR-0002: Component co-location

**Status**: Accepted
**Date**: 2026-05-19
**Deciders**: Amin

---

## Context

[ADR-0001](./0001-feature-first-code-placement.md) says each feature owns a `components/<Name>/index.tsx` directory. It does not say what happens when one of those components grows past a few hundred lines.

The May 2026 audit found six components in the 800–1700-line range:

| Component                                                     | Lines | Inline sub-components |
| ------------------------------------------------------------- | ----- | --------------------- |
| `features/workspace/components/WorkspacesSidebar/index.tsx`   | 1735  | 13+                   |
| `features/permissions/components/DiffViewerDialog/index.tsx`  | 1420  | 8                     |
| `features/github/components/Card/index.tsx`                   | 1002  | 10+                   |
| `features/session/components/SessionSettingsDialog/index.tsx` | 903   | 6                     |
| `features/settings/components/GuideDialog/index.tsx`          | 842   | 10+                   |
| `features/chat/components/ChatView/index.tsx`                 | ~700  | 4                     |

Every one of these defines private React components inside the same file as the parent. The result is brittle: a small visual tweak forces a 1500-line diff, code review misses context, and any name collision (`Header`, `Toolbar`, `EmptyState`) means jumping between unrelated parents to disambiguate.

## Decision

A React component that has private children **must** live as a directory under `components/`, and each private child lives as a **sibling file in the same directory**, named for what it is — never with the parent's name as a prefix.

```
features/workspace/components/WorkspacesSidebar/
├── index.tsx              # the parent component
├── AgentRow.tsx           # private child — used only by WorkspacesSidebar
├── AgentsSection.tsx
├── SpawnAgentControl.tsx
├── WorkflowStepRow.tsx
├── AgentLifetime.tsx
└── EmptyState.tsx
```

Not this:

```
features/workspace/components/
├── WorkspacesSidebar.tsx                       # ⛔ huge single file
├── WorkspacesSidebarAgentRow.tsx               # ⛔ parent-prefixed
└── WorkspacesSidebarSpawnAgentControl.tsx
```

### Rules

1. **One component per file**. The file name matches the component name in PascalCase. `WorkspacesSidebar/index.tsx` exports `WorkspacesSidebar`; `AgentRow.tsx` exports `AgentRow`.
2. **Private children sit next to their parent**, not under `components/AgentRow/` of their own. They are private surface — only the parent imports them.
3. **No parent-prefix on children**. The directory name disambiguates. Inside `WorkspacesSidebar/`, the file is `Header.tsx`, not `WorkspacesSidebarHeader.tsx`. If you need a `Header` from outside this directory, that is the signal that it has graduated: promote it to its own `components/Header/` (with its own folder) or move it to `shared/components/`.
4. **Children only get their own subdirectory when they themselves have private children**. Use the same rule recursively.
5. **When a child grows enough to be reused**, move it. Don't import it across feature boundaries while it still lives inside `WorkspacesSidebar/` — that is a deep import from outside a private surface. Same admission criterion as `shared/`: used by 2+ features → graduate.

### How a 1500-line component gets split

For each private inline component, give it a name that describes its role (not its position), move it to a sibling file, replace the inline declaration with an import. Keep the parent's render function as the orchestrator — the parent file should not own visual sub-trees, only their composition and the state that connects them.

If the parent file is still over ~400 lines after extraction, the next step is to look at hooks. A long component is often three hooks in a trench-coat: pull each (`useAgentSpawn`, `useWorkspaceListSync`) into a sibling `use-*.ts` file in the same directory.

## Consequences

**Positive**

- A reader looking for "the spawn-agent row UI" finds `SpawnAgentRow.tsx` next to its parent, not buried at line 994 of a giant file.
- Code review sees a diff scoped to the changed sub-component, not the entire parent.
- File names match what the editor/IDE shows in tabs — no more "SidebarAgentRow.tsx" tabs that are indistinguishable from "WorkspacesSidebarAgentRow.tsx".
- The graduation rule prevents `shared/` accumulating debris: a child has to be claimed by a second feature before it leaves its parent.

**Negative / trade-offs**

- Splitting an existing 1500-line file is mechanical work. We accept it as a one-time tax; new code follows the rule from the start.
- Renames are slightly more visible (a child file moves around when its parent gets a new home). VCS handles this fine; humans can grep.

## What this does NOT cover

- File naming for non-component utilities (use kebab-case; see CONVENTIONS).
- Whether to use `function` vs `const = () =>` for the component declaration (use `function`; see [ADR-0001](./0001-feature-first-code-placement.md)).
- When a hook becomes a feature of its own (rule of thumb: when it owns a slice of Zustand state, lift it; otherwise it stays next to its caller).
