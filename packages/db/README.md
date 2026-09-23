# @goodboy/db

> **Read this when** you need an overview of `@goodboy/db` before you touch the schema, migrations, or queries. **Not for** the detailed rules. See `CONVENTIONS.md`.

The SQLite schema, migrations, and typed query functions. Data stays on the user's machine, stored through `tauri-plugin-sql`, and `apps/desktop` uses it. No business logic, no Tauri bindings.

## Conventions

See [CONVENTIONS.md](./CONVENTIONS.md).
