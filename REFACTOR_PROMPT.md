# refactor + cleanup massivo — pre-release v1.0

## contesto

repo `kay-am` (tauri 2 + react + vite + ts + zustand + tailwind + shadcn). leggi `CLAUDE.md` root + `README.md` + ultimi 30 commit per inferire stile e direzione. user sta dormendo → autonomia totale fino a milestone chiusa.

milestone: https://github.com/akhayam99/kay-am/milestone/9 — usa questa, non crearne altre.

## mission

scansiona repo, clusterizza problemi in github issues sotto milestone v1.0, esegui in ordine di criticità (test → legacy → refactor → cosmetic), spawna subagent per ogni cluster, apri PR, mergia su main quando CI + test verdi, zero regressioni.

## modelli

- minimo: **sonnet**, anche per task semplici. livello di impegno alto sempre.
- opus solo per: fix test core, decisioni architetturali, refactor complessi.

## prerequisiti

1. crea label: `cluster:tests`, `cluster:legacy-opencode`, `cluster:refactor-logic`, `cluster:dedup`, `cluster:tailwind`, `cluster:html`, `cluster:consistency`, `cluster:comments`, `cluster:copy`, `cluster:types`, `cluster:a11y`, `cluster:dead-code`, `cluster:extra`
2. baseline: gira `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`. annota stato in issue "v1.0 baseline" (milestone 9)
3. **CI hardening** (issue dedicata, prima di tutto il resto):
   - integra `knip` in CI per unused imports/vars/exports
   - integra `pnpm test` core suite in CI se non già presente
   - se test core falliscono → blocca merge

## cluster (ordine di criticità)

### 1. test core rotti — gating

- mappa ogni test rosso, root cause
- fix vero, no `skip` no `it.todo`
- se test sbagliato (non codice) → riscrivi test
- aggiungi test mancanti per logica critica scoperta
- **modello**: opus

### 2. riferimenti opencode legacy

- grep `opencode|OpenCode|open_code` ovunque
- rimuovi da UI, docs, types, configs, copy
- **modello**: sonnet

### 3. ternari nested + condizioni illeggibili

- ternario in ternario → `const isX = ...` o early return
- catene `if` 3+ rami → named boolean (`shouldShowBanner`, `canEditConfig`) o lookup object
- elimina commenti resi inutili dal refactor
- **modello**: sonnet

### 4. codice duplicato

- pattern ricorrenti (3+ occorrenze) → hook/util/component condiviso
- niente over-engineering: 2 occorrenze restano com'è
- **modello**: sonnet

### 5. verbosità inutile

- early returns vs if annidati
- destructuring vs accessi ripetuti
- native methods (`Array.*`, `Object.entries`) vs loop manuali
- async/await vs `.then` chain
- **modello**: sonnet

### 6. tailwind cleanup

- classi dichiarate ma mai applicate
- duplicazioni di stringhe lunghe → variant shadcn o `cn()` helper
- spacing/color inconsistenti → consolida su scala
- **modello**: sonnet

### 7. html quirks

- `{' '}` inutili
- `<div>` annidati senza ragione → flatten
- semantic tag corretti (`button` non `div onClick`, `nav`, `main`)
- key mancanti, fragment inutili
- **modello**: sonnet

### 8. consistency pass

- naming: camelCase ts, kebab-case file, PascalCase component
- export style: solo named
- error handling: pattern unico
- loading/empty states uniformi
- z-index su scala
- **modello**: sonnet

### 9. typescript hygiene

- zero `any`, zero `as` non motivati → `unknown` + type guards
- magic numbers/strings → `const` con nome
- TODO/FIXME → fix o issue dedicata
- console.log/debug residui via
- **modello**: sonnet

### 10. dead code (post-knip)

- knip output → rimuovi unused
- file/export/var/import morti
- verifica cascade: grep usi prima di rimuovere
- **modello**: sonnet

### 11. a11y baseline

- aria-label su icon button
- alt su img
- focus ring visibile
- ordine tab
- **modello**: sonnet

### 12. commenti

- rimuovi commenti che spiegano WHAT
- mantieni solo WHY non-ovvio (workaround, vincolo nascosto)
- commento c'è perché codice opaco → refactor codice
- **modello**: sonnet

### 13. copy + cta + refusi

- CTA: prima lettera maiuscola
- refusi sweep
- tone of voice da readme
- copy verbose → conciso
- include descrizioni test (`describe`/`it`)
- **modello**: sonnet

### 14. extra (proposte mie)

- localStorage keys prefissati + costanti centralizzate
- error boundaries su route principali
- date/number formatting via `Intl`
- tauri commands rust: verifica che logica business resti in ts (vedi CLAUDE.md)
- ognuna come issue, label `cluster:extra`, prioritizza tu

## parallelismo

cluster indipendenti → run in parallelo (spawn subagent concorrenti).

dipendenze gating:

- **#1 (test core)** + **CI hardening** vanno prima di tutto (gating su ogni merge successivo)
- **#10 (dead code)** dopo knip in CI
- tutti gli altri possono andare in parallelo

conflitti su file condivisi → rebase main sul branch in ritardo. se conflitto complesso → spawn agent dedicato per risolvere, non auto-mergiare.

## workflow per cluster

1. crea issue github sotto milestone 9, titolo `[cluster:X] descrizione`, label cluster, scope + acceptance criteria nel body
2. branch da main: `feat/<short>` | `fix/<short>` | `chore/<short>` (mai il nome auto-generato del worktree)
3. spawna subagent con modello del cluster, prompt include:
   - link issue
   - scope esatto (no scope creep)
   - guardrails (no dipendenze, no logica funzionale alterata, no `--no-verify`)
   - acceptance criteria
4. subagent apre PR draft, link issue, checklist
5. attendi CI verde (test + knip + typecheck + lint + build)
6. self-review diff: zero regressioni funzionali
7. mark ready, squash merge, delete branch, chiudi issue
8. se PR successiva ha conflitto → rebase main sul branch, risolvi, re-push

## decisioni ai bivi (autonomia)

1. **leggi prima**: `CLAUDE.md`, `README.md`, `git log --oneline -50`, `docs/` se esiste, ultime 5 PR mergiate
2. **principi guida** (da CLAUDE.md):
   - typescript strict, no `any`, no default exports
   - no commenti tranne WHY
   - no dead code, no codice commentato
   - named exports, tailwind only
   - dipendenze: necessario + MIT/Apache/BSD/ISC + mantenute + >100k weekly downloads
   - branch naming `feat|fix|chore/<desc>`
   - conventional commits in inglese
3. **conservativo se ambiguo**: preserva comportamento esistente, opzione meno invasiva
4. **mai**: skip test, `--no-verify`, force push, cambi a `package.json` deps senza issue dedicata, toccare credentials

## guardrails

- una preoccupazione per PR
- cluster troppo grande → split
- test rotto vs logica rotta → PR separate
- rust tauri commands: tocca solo se strettamente necessario
- sqlite schema: no migrazioni senza issue esplicita

## done criteria v1.0

- [ ] tutte le issue milestone 9 chiuse
- [ ] main verde
- [ ] `pnpm test` 100%
- [ ] `pnpm typecheck` clean
- [ ] `pnpm lint` clean
- [ ] `knip` clean
- [ ] `pnpm build` ok
- [ ] CI runna test core + knip + typecheck + lint + build
- [ ] draft release notes in issue dedicata

## report

ogni 3 cluster completati → commenta su issue "v1.0 baseline" con: cluster done, PR mergiate, regressioni (se zero, dillo esplicitamente), prossimo step.

al risveglio user → single-message report con stato milestone, blockers, decisioni prese ai bivi e razionale.
