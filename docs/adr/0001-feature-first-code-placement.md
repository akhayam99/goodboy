# ADR-0001: Feature-first code placement

**Status**: Accepted  
**Date**: 2026-05-17 (re-numbered from ADR-0007 on 2026-05-19)  
**Deciders**: Amin

---

## Context

The desktop codebase grew organically: domain logic, components, and utilities lived in loosely coupled top-level directories (`src/components/`, `src/hooks/`, `src/utils/`, `src/store/`, `src/data/`). As features multiplied, two problems emerged:

1. **Discoverability failure** — finding all code for a feature required searching multiple unrelated directories.
2. **Coupling risk** — shared locations created implicit dependencies between unrelated features; every refactor risked unexpected breakage.

This ADR establishes **where** code physically lives and how new code enters the codebase. Subsequent ADRs cover component co-location ([ADR-0002](./0002-component-co-location.md)), the Tauri command boundary ([ADR-0003](./0003-tauri-command-boundary.md)), dependency direction ([ADR-0004](./0004-package-dependency-direction.md)), and testing layout ([ADR-0005](./0005-test-layout.md)).

---

## Decision

### 1. Top-level layout

```
apps/desktop/src/
├── app/          # App shell only (routing, layout, boot, global error handling)
├── features/     # One directory per product domain
├── shared/       # Code used by 2+ features with no domain ownership
├── store/        # Zustand store and slices
└── main.tsx
```

**Nothing else at `src/` root.** Resist the urge to create `src/types/`, `src/constants/`, `src/models/` etc. — each of these is a magnet for undisciplined global state.

---

### 2. Feature module layout

Each feature is a self-contained directory:

```
features/<domain>/
├── <domain>.ts              # Core domain logic (pure fns, types, constants)
├── <domain>.test.ts
├── utils/                   # Domain-local utilities (not shared externally)
│   └── <util>.ts
├── components/
│   └── <ComponentName>/
│       ├── index.tsx
│       └── index.test.tsx   # Co-located test
└── pricing.json             # Assets owned by this feature live here
```

Rules:

- Domain logic file (`<domain>.ts`) contains types, constants, and pure functions specific to the domain. No React, no Zustand imports.
- `utils/` is private to the feature. If a utility is needed by another feature, move it to `src/shared/utils/`.
- Components are PascalCase directories, each with an `index.tsx`. No flat component files at feature root.
- Assets (JSON, SVG, etc.) live next to the feature that owns them — not in `public/` or `src/data/`.

---

### 3. App shell (`src/app/`)

Only code that is global by definition:

- `App.tsx`, `main.tsx`, `styles.css`
- Shell components: `BootSplash`, `ErrorBoundary`, `StatusBar`, `Toast`, `OpenInEditorButton`

If a component is only rendered in one feature's view, it belongs in that feature, not here.

---

### 4. Shared code (`src/shared/`)

```
shared/
├── lib/     # Thin wrappers over browser/Tauri APIs (db, storage, editor, repo…)
├── hooks/   # React hooks used by 2+ features
└── utils/   # Pure utility fns used by 2+ features
```

**Admission criterion**: a file enters `shared/` only when it is imported by two or more distinct features. When in doubt, keep it in the feature. Do not pre-share.

No barrel `index.ts` in `shared/` subdirectories. Import the file directly.

---

### 5. Store slices (`src/store/slices/`)

```
store/
├── store.ts            # Zustand store composition
├── selectors.ts        # Cross-slice selectors
├── slices/
│   └── <domain>.slice.ts   # State + actions for one domain
└── store.<scenario>.test.ts
```

One slice per domain. A slice owns its state shape and actions; it must not import from another slice. Cross-domain reads go through `selectors.ts`.

Slice tests live in `store/` (not `__tests__/`) to keep store behaviour tests together.

---

### 6. Import style

Direct imports. No barrel re-exports.

```ts
// correct
import { budgetGuard } from '../features/budget/budget';
import { useKeyboardShortcut } from '../shared/hooks/use-keyboard-shortcut';

// wrong — barrel layer adds indirection with no benefit
import { budgetGuard } from '../features/budget';
import { useKeyboardShortcut } from '../shared/hooks';
```

Import paths must resolve to the file that defines the symbol. If you find yourself adding a barrel to re-export a single symbol, you are adding boilerplate — don't.

---

### 7. Where to put new code (decision tree)

```
Is it used only inside one feature?
  └── yes → features/<domain>/
       Is it a React component?
         └── yes → features/<domain>/components/<Name>/index.tsx
         └── no  → Is it a utility/helper?
                     └── yes → features/<domain>/utils/<name>.ts
                     └── no  → features/<domain>/<domain>.ts

Is it used by the app shell (routing, layout, boot)?
  └── yes → app/components/<Name>/index.tsx

Is it used by 2+ features and has no domain owner?
  └── yes → shared/{lib|hooks|utils}/<name>.ts

Is it Zustand state?
  └── yes → store/slices/<domain>.slice.ts
```

---

## Consequences

**Positive**

- Feature boundary is visible from the file system — no archaeology needed to understand a change's scope.
- Deleting a feature means `rm -rf features/<domain>/` with surgical confidence.
- No barrel indirection → `go to definition` always lands on the source, not a re-export chain.
- Assets co-located with the feature that owns them → pricing changes live next to provider logic.

**Negative / trade-offs**

- Import paths are longer (`../../shared/utils/display-path` vs `../../utils`). Accepted: clarity over brevity.
- New contributors must read this ADR to know which bucket to use. Mitigated by the decision tree above.
- `shared/` can accumulate debris if the 2-feature rule is not enforced during review.

---

## What this does NOT cover

- Naming conventions for files and exports → see CLAUDE.md (named exports only, no defaults).
- State management patterns inside a slice → see store conventions doc.
- Cross-package boundaries (`packages/db`, `packages/types`) → see ADR-0004.
