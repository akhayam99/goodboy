# TypeScript conventions

> **Read this when** you write TypeScript and need the right rule for what
> you're touching. **Not for** file placement (see `docs/file-system.md`).

This is how we write TypeScript across the monorepo. These are rules, not
suggestions. Each topic below has its own file under `typescript/`.

- [Data & types](typescript/data.md): `type` never `interface`, intersection over `extends`, `satisfies` over `as`, exhaustiveness with `never`, discriminated unions, branded IDs.
- [Components & exports](typescript/components.md): `export const`, one export per file, React component patterns (`ref` as prop, no `forwardRef`, no `React.FC`), `Props`/`Params` object parameters, no untyped prop spreading.
- [Control flow](typescript/control-flow.md): early return, no `if/else`, no inline `if`.
- [Readability](typescript/readability.md): speaking names, no comments.

Naming rules live in [AGENTS.md](../AGENTS.md) → Naming. Filesystem layout and
component placement live in [file-system.md](file-system.md).
