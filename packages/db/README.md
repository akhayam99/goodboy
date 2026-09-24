# @goodboy/db

> **Read this when** you need an overview of `@goodboy/db` before you touch the schema, migrations, or queries. **Not for** the detailed rules. See `CONVENTIONS.md`.

The SQLite schema, migrations, and typed query functions. Data stays on the user's machine, stored through the desktop's `rusqlite` connection, and `apps/desktop` uses it. Every query takes a `Database` (`exec`, `execute`, `select`, `transaction`). The app passes `tauriDatabase`, tests pass a `better-sqlite3` database from `@goodboy/db/test-helpers`. No business logic, no Tauri bindings.

## Conventions

See [CONVENTIONS.md](./CONVENTIONS.md).
