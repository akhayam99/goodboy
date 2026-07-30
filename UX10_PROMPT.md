# UX10: workflow dinamico + rework integrazioni, creation grammar, overview, open questions, resolve, impact

> Documento locale di orchestrazione. NON committare mai questo file (niente regole .gitignore: si cancella a lavoro consumato). Sostituisce ogni prompt UX precedente.

## Obiettivo

Otto aree, otto PR stacked. La feature di punta: un workflow **dinamico** dove un orchestratore legge il risultato di ogni step e decide il successivo, invece della lista statica pianificata al attach. Attorno: portare tutte le form di creazione alla "one creation grammar" già scritta in DESIGN.md, riscrivere interamente il dettaglio PR GitHub e allineare i tre dettagli integrazione, trasformare la session overview da recap statico a hub di shortcut, sistemare le open questions (bug di visibilità in chat + restyle), rifare il popover di resolve e riscrivere Impact Studio. Barra di qualità, parole dell'utente: "come riferimento di qualità, guarda il bel lavoro fatto sulla creazione della sessione e sul modal provider picker. fammi un lavoro con i fiocchi e non creare regressioni sul codice."

## Ruolo

Sei l'orchestratore autonomo di questa iterazione. Nessuna conferma, nessuna alternativa proposta, nessun checkpoint con l'utente. Tie-breaker per trade-off indecidibili: scegli l'opzione che massimizza la coerenza col pattern esistente più vicino citato in questo file (create session / StudioDetailLayout / CreateAgentPopover); a parità, quella che tocca meno file.

Ordine di dipendenza e una PR per area, stacked in quest'ordine:

1. **PR1** workflow dinamico (core+db+store+builder)
2. **PR2** open questions (fix visibilità + empty state + restyle)
3. **PR3** session overview hub + header dedup + footer panel
4. **PR4** integration lens panes (IntegrationPane collapse, Link ticket, PrPane dashboard)
5. **PR5** riscrittura PR detail + pattern comune dettagli integrazione
6. **PR6** creation grammar (CreatePrPanel + MrDetailPanel)
7. **PR7** resolve popover rework
8. **PR8** Impact Studio rewrite

PR1, PR2, PR8 sono mutuamente indipendenti e parallelizzabili in worktree separati; PR3→PR7 toccano superfici contigue (SessionOverviewPane, PrDetailPanel), tienile sequenziali. PR5, PR6 e PR7 toccano tutte PrDetailPanel e i suoi figli: mai in parallelo.

---

## Area 1 (PR1): workflow dinamico

### Stato attuale (verificato sul codice)

- Builder a 3 stage: goal+attachments, approach (`preset`/`custom`), tune steps. Il "come/cosa fare" è `processText` (`WorkflowBuilderView/index.tsx:973-981`) che chiama `PlannerClient.plan` una volta sola, up-front, producendo 1-6 step (`packages/core/src/planner/prompt.ts:3-42`, client `packages/core/src/planner/client.ts:50-94`).
- Attach = un `WorkflowRunId` per attach (`attachWorkflowToSession.ts:46`) + **pre-spawn di un agent `pending` per ogni step** (`attachWorkflowToSession.ts:91-120`). Path duplicato con risoluzione modelli diversa in `createSession.ts:272-300`.
- Advance edge-triggered: `sendTurn.ts:875-886` → `completeResolvedAgent` → `finalizeWorkflowStep` (marker `<<step-done id>>`, `MAX_CONTINUE = 1`, `finalizeWorkflowStep.ts:18,62-93`) → `maybeAutoAdvanceWorkflow` con gate in ordine: run autoRun+immediate, summarizer running, budget alert, open questions (`maybeAutoAdvanceWorkflow.ts:50-100`). Ordine `enqueueSummarizer`/advance in `sendTurn.ts:1042,1083` coperto dal re-fire al drain della coda (`turn-helpers.ts:130-147`).
- Risultato step: `agents.output_summary` con contract (prima riga ≤120 char, ≤1200 totale, `packages/core/src/summarizer/step-output.ts:12-23`); carry-forward al successivo via `buildChainCarryForward` (`packages/core/src/workflows/propagator.ts:57-94`), iniettato in `sendTurn.ts:280-286,326-330`.
- Prior art di spawn a runtime: `fanOutClusters` (`clusterImplementation.ts:96-144`) e `fanOutScouts` (`scoutTree.ts:147-222`) inseriscono agent via `invokeAgentInsert` a runtime, senza `stepId`, con `parentAgentId` e `workflowRunId` ereditato.
- I path di advance leggono solo `phaseTemplates`, mai `sessionWorkflows` (`maybeAutoAdvanceWorkflow.ts:71`, `skipStuckStepAndAdvance.ts:18`).
- Punti di estensione UI: sezione "Launch options" del builder con `LaunchToggleRow` (badge `beta` supportato, `WorkflowBuilderView/index.tsx:1190-1267`); stage "approach" con `SegmentedTabs` (`:850-875`). `WorkflowTriggerMode` (`packages/types/src/workspace.ts:60`).
- Prossima migration: **m091** (ultime: m088/m089/m090; registro `packages/db/src/migrations/index.ts:185-187`).
- Task model registry per ruoli headless: `ProviderStudio/DefaultsPanel/index.tsx:31-66` (es. `pr_draft`, `rebase`).

### Problemi

1. La lista step è congelata al attach: pre-spawn di N agent, nessun punto dove un risultato può cambiare il piano. Un flusso "debug → se no muori, se sì planning → implementation" oggi è irrappresentabile.
2. Pre-spawn duplicato (`createSession.ts:272-300` vs `attachWorkflowToSession.ts:91-120`) con risoluzione override diversa: `createSession` non setta mai `agentProviderOverride`/`agentEffortOverride`.
3. `forceAdvanceWorkflowStep` e `skipStuckStepAndAdvance` sono quasi identici (differisce solo il guard `blocked`), chiamati da CTA diverse.
4. Type drift: la firma `AppStore.attachWorkflowToSession` (`store/store.ts:234-243`) omette `attachmentInputs` che l'impl accetta.

### Scope

**MUST**

- Nuova modalità di esecuzione `dynamic` accanto alla statica: scelta nel builder (terza opzione dello stage "approach" oppure toggle in Launch options, scegli tu la collocazione più pulita), persistita su `session_workflows` via **m091**, rappresentata su `WorkflowRun` e nel draft (`slices/workflowDrafts/types.ts:21-32`).
- In dynamic: goal + attachments + processText come oggi, ma **nessun pre-spawn della lista**. Un orchestratore headless (stile `PlannerClient`/summarizer, task model dedicato registrato nel DefaultsPanel, es. `workflow_orchestrator`) viene invocato al kickoff e dopo ogni `finalizeWorkflowStep` e decide: `{next: step}` (name, role, promptPrefix, expectedOutput, routing) | `{done: motivo}` | `{blocked: motivo}`.
- Ogni step deciso viene **materializzato come step reale** (riga `steps` + agent, ordinal progressivo) così step strip, inspector, carry-forward, summarizer contract e impact continuano a funzionare invariati.
- Input dell'orchestratore: goal, processText, `outputSummary` degli step precedenti (contract esistente), open questions aperte del run. Output parse con marker dedicato (pattern `<<workflow>>` di `format.ts:112-171` come riferimento).
- I gate esistenti restano identici e si applicano anche al dynamic: summarizer gate, open questions gate, budget alert gate, `MAX_CONTINUE`, `advanceInFlight`.
- La decisione è visibile: in chat/workflow lens l'utente vede perché è stato spawnato lo step successivo (motivazione breve dell'orchestratore) e un run terminato dall'orchestratore mostra il motivo (`done`/`blocked`). Riusa il pattern `step_transition` (`sendTurn.ts:297-309`).
- Path statico invariato: tutti i test workflow correnti verdi senza modifiche semantiche.
- Nel fare m091, unifica il pre-spawn duplicato (problema 2) in un solo helper condiviso.

**SHOULD**

- Collassare `forceAdvanceWorkflowStep` in `skipStuckStepAndAdvance` con parametro.
- Fix del type drift sulla firma di `attachWorkflowToSession`.

**MUST NOT**

- Non riordinare `enqueueSummarizer`/`maybeAutoAdvanceWorkflow` in `sendTurn`: la race è nota e coperta dal re-fire al drain, il gate serve così (deciso in PR #1057).
- Non toccare i flag parallel agents (`AGENT_FEATURES.parallelAgents`, `parallel_group`): dead by design, non è questa l'iterazione.
- Non copiare `stepId` sui figli di cluster/scout (regola consolidata, PR #939).
- Non usare `Date.now()`-driven logic nei test timestamp-sensibili (flake timezone noto).

---

## Area 2 (PR2): open questions

### Stato attuale (verificato sul codice)

- Nessun gate workflow-only: il gate reale in chat è `q.createdByAgentId === selectedAgentId && q.turnOrdinal != null` (`ChatView/index.tsx:236`). Dismissed strutturalmente escluse (mai caricate: `loadSessionOpenQuestions.ts:8`).
- **Root cause della "non le vedo in chat"**: `turnOrdinal` è derivato dal transcript **in-memory** (`sendTurn.ts:916-918`) che al select è idratato con i soli ultimi 50 eventi (`selectAgent.ts:80-95`, tail window in `turn-event.ts:87-95`). Per agent con >50 eventi l'ordinal persistito è sottostimato → il bucket renderizza in alto nello scrollback o mai. Gli step agent freschi (<50 eventi) non triggherano mai il bug, da cui l'impressione "funziona solo nei workflow". Righe pre-m062 hanno `turn_ordinal` NULL senza backfill → mai inline.
- Empty state: `QuestionsPane.tsx:298` gates solo su `open.length === 0` e stacka `EmptyState` sopra `AnsweredHistory` (`:302-309`). Comportamento pinnato da `QuestionsPane.test.tsx:220-239`.
- Stile: `QuestionCard/index.tsx:76-150` hand-rolla bordo warning + left rail assoluto invece di `TranscriptShell variant="leftBorder"` (`TranscriptShell/index.tsx:23-69`) + `MARKER_ACCENT.warning` (`marker-accents.ts:71-81`). `AnsweredCard` è l'unico già collapsed-by-default.
- Dead code: undo dismiss (`useOpenQuestions.ts:76-95`) e `restoreDismissedOpenQuestion` (wired nello store, zero caller UI). Submit button duplicato verbatim (`OpenQuestionCluster.tsx:91-96` vs `QuestionsPane.tsx:98-103`).
- `answerOpenQuestions` non chiama `maybeAutoAdvanceWorkflow` (risponde via `sendTurn`); `dismissOpenQuestion.ts:22` sì.

### Problemi

1. OQ invisibili in chat per ordinal desync (sopra): l'utente risponde solo dalla pagina Questions, e crede sia un limite dei non-workflow.
2. Empty state "No open questions" mostrato sopra la history delle risposte: rumore permanente.
3. Card visivamente fuori sistema rispetto alle card system/workflow del transcript.
4. Dead code irreversibile: dismiss senza undo, restore mai cablato.

### Scope

**MUST**

- Una OQ aperta dell'agente selezionato non deve mai essere invisibile nella chat: fixa la derivazione di `turnOrdinal` (fonte stabile, es. conteggio da DB e non dal transcript troncato) e aggiungi fallback di rendering — bucket con ordinal fuori range o NULL renderizza in coda al transcript, mai droppato.
- Le OQ create da un altro agent della sessione devono essere raggiungibili dalla chat corrente (indicatore/cluster che porta all'agente creatore); la pagina Questions resta la vista completa.
- Empty state solo quando `open == 0 && answered == 0`; con history presente, solo la history (aggiorna il test pinnato).
- Restyle `QuestionCard` su `TranscriptShell leftBorder` + `MARKER_ACCENT.warning`, coerente con `WorkflowKickoffCard`/`PhaseTransitionCard`; dedup del submit button in un componente condiviso.
- Dead code: cabla il restore del dismiss (undo breve stile 5s già previsto da `useOpenQuestions`) oppure rimuovi undo+restore del tutto. Decidi e lascia zero orfani.

**MUST NOT**

- Non toccare l'anti-resurrezione (`auto-populate.ts:48-49` + unique index m040): consolidata.
- Non trasformare `<<oq-answers>>` in bubble visibile: la soppressione è voluta (`transcript-items.ts:134-136`).

---

## Area 3 (PR3): session overview hub + header + footer panel

### Stato attuale (verificato sul codice)

- Overview (`SessionOverviewPane/index.tsx`, 445 righe): header strip, nudges, Start, Activity/Pipeline, Resolve counters, Linked work, Completed, all-clear. Nessuna CTA git.
- Rebase: vive nel Diff lens (`DiffViewerContent.tsx:810-823`), **spawna un agent** "Rebase on main" con task model `rebase` (`:694-724`, config `:328-336`), guard su agent omonimo running (`:356-362`). Push esiste solo come store action (`pushSessionBranch.ts:17`), indicatore `↑ahead` solo nel DiffToolbar (`DiffToolbar.tsx:98`). Nessun pull/fetch CTA.
- Open worktree: `EditorMenu` nell'header overview (`index.tsx:245`, `EditorMenu.tsx:96-103`). Footer panel sinistro: `LensColumnFooter.tsx:70`, due soli figli [archive][delete] con `justify-between`. Precedente diretto del layout richiesto: `StageBoardCard/index.tsx:250-266` ([editor][terminal]...[archive][delete]).
- Duplicazioni: la sola overview mostra la PR **due volte** (`PrStatusLine` :283 + `LinkedWorkSection` row :105) e il ticket due volte (glyphs :244 + linked work :133), col ticket una terza volta nell'header sopra (`SessionDetailPanel/index.tsx:57-59`). Chip workspace-name (`index.tsx:289-294`) ridondante col WorkspaceHeader top-left; branch disponibile in `s.sessionBranches` (`store/types.ts:186`) e già mostrato dal `BranchChip` accanto (`:295-304`).
- Test pinnanti: workspace chip (`SessionOverviewPane/index.test.tsx:252`), section order (`:634-653`), footer (`LensColumn/index.test.tsx:564-591`), EditorMenu (`EditorMenu.test.tsx:46-61`).

### Problemi

1. Le azioni git sono sparse (rebase nel Diff, push invisibile, merge solo nel PR studio): l'overview, che dovrebbe essere l'hub, non ha shortcut.
2. Overview ridondante: PR 2x, ticket 2x (+1 nell'header), workspace chip inutile.
3. EditorMenu sepolto in un overflow icon-only nell'header invece che nel footer con archive/delete.

### Scope

**MUST**

- Nuova sezione shortcut azionabili nell'overview: rebase (visibile quando `commitsBehindMain > 0`, stessa logica agent-spawn estratta in helper condiviso col Diff lens), push (quando ahead), open PR/studio, e le altre azioni oggi sepolte che hanno senso qui. Stato busy/disabled coerente (guard agent running).
- Header overview: via il chip workspace-name; il branch resta l'identità (BranchChip). Una sola rappresentazione della PR (decidi tu quale delle due muore) e una sola del ticket per superficie.
- `EditorMenu` spostato in `LensColumnFooter` con layout `[open IDE] --- spazio --- [archive] [delete]`; rimosso dall'header overview. Test footer e EditorMenu aggiornati.
- L'overview riduce il recap statico: ogni riga che non naviga o non agisce deve giustificarsi.

**MUST NOT**

- Non rimuovere il rebase dal Diff lens senza rimpiazzo: l'indicatore "behind main" lì resta, può delegare all'azione condivisa.
- Non toccare la dedup nudges/rail già fatta (`index.test.tsx:390-412`).

---

## Area 4 (PR4): integration lens panes

### Stato attuale (verificato sul codice)

- Linear/Sentry/GitLab = un solo componente `IntegrationPane` (`parts/IntegrationPane/index.tsx:47`). Il blocco "Link an issue" (label + open studio + IssuePicker + form URL, `:136-192`) renderizza **sempre** quando connesso, anche con task già linkati. `PaneShell` ha uno slot `actions` (`PaneShell.tsx:8,25-29`) qui inutilizzato: è lo slot dove Agents mette `CreateAgentPopover variant="compact"` (`AgentsPane.tsx:47-56`).
- GitLab non ha task detail (solo Linear/Sentry, `:238-243`); la row linkata è hand-rolled invece di `ExternalTaskChip appearance="row"`.
- GitHub pane = `PrPane` separato (`parts/PrPane.tsx:35`): con issue GitHub linkata ma senza PR, gli early return (`:156,:164,:184`) droppano tutto e mostrano "Open a pull request" — la issue è invisibile. `IntegrationPane` supporta `provider="github"` ma non è mai montato con esso (`SessionWorkspace/index.tsx:409-429`). La row GitHub nel LensColumn non ha count badge (`LensColumn/index.tsx:160-167`).
- Test pinnanti da riscrivere: `IntegrationPane/index.test.tsx:181,193`; `PrPane.test.tsx` intero accoppiato.

### Scope

**MUST**

- Con ≥1 task linkato: il blocco link scompare; "Link ticket" va nello slot `PaneShell actions` (stile compact CTA: `Button variant="secondary" size="sm"` + Plus, coerente con "Open X studio" esistente) e apre picker+URL form in popover.
- Con 0 task: un solo empty state pulito che integra il link form (niente doppione label+form+studio button impilati).
- Parity delle row: `ExternalTaskChip appearance="row"` anche in IntegrationPane; GitLab con detail o almeno row completa.
- `PrPane` diventa la dashboard GitHub della sessione: mostra ciò che c'è (PR se esiste, issue GitHub linkate anche senza PR) e dice cosa manca ("nessuna issue collegata; PR #9546 collegata"). Gli early return non droppano più i task linkati.
- Count badge sulla row GitHub del LensColumn come per le altre integrazioni.

**MUST NOT**

- Non cambiare `resolveIntegrationConnection` semantics (`connection.ts:22`): il gate github = remoteKind è deliberato.

---

## Area 5 (PR5): riscrittura PR detail + pattern comune

### Stato attuale (verificato sul codice)

- `PrDetailPanel` (`GitHubStudio/PrDetailPanel.tsx:38`, 468 righe) è **l'unico dettaglio non su `StudioDetail`**: aside `w-72` con `PrSectionNav` verticale (bottoni nudi, niente `role="tab"`, `PrSectionNav.tsx:38-71`) + `PrReviewers`, action bar orizzontale con 8+ CTA sparse (`PrActionBar.tsx:73-191`), edit title/description nascosti dentro Overview (`PrOverview.tsx:88-99,145-152`).
- Tutti gli altri dettagli (Linear/Sentry/GitLab issue, GitLab MR, GitHub issue) usano `StudioDetailLayout` + `DetailSection` + `MetaItem` + `HeaderBand` (`shared/components/StudioDetail/`), con `LaunchSessionPanel` nel rail.
- Tab primitive: `SegmentedTabs` (ARIA completa, `packages/ui/src/components/SegmentedTabs.tsx:51`) è l'unica; `DetailPage` (`packages/ui/src/components/DetailPage.tsx:25`) è la pagina panel-less con sticky header + slot actions.
- Apertura: evento `goodboy:open-github-session` → `setSessionStudio(kind:'github')` → `SessionStudioLayer` → `GitHubSessionPane` (`App.tsx:400-413`, `SessionStudioLayer.tsx:75-82`); payload pinnato da `overlay-mutual-exclusion.test.ts:275-286`.
- Divergenze condivise da sanare: 2 sistemi di state chip, 3 refresh button hand-rolled, "Open in X" duplicato verbatim in 5 file, max-width incoerenti (5xl/3xl).

### Scope

**MUST**

- `PrDetailPanel` riscritto senza aside: `HeaderBand` con title/stato/meta + **actions nel band** (merge con confirm, ready/draft, close/reopen, open link, refresh, open session raggruppate per peso: stato-mutanti vs utilities), navigazione sezioni Overview/Conversation/Resolve/Checks via `SegmentedTabs` orizzontale, corpo full-width su layout `StudioDetail`. `PrSectionNav` eliminato. Reviewers dentro Overview/meta.
- Pattern comune sui dettagli: un componente condiviso per state chip, uno per refresh, uno per "Open in X"; max-width unificata. Non forzare identicità dove il dominio differisce, ma la struttura header/tabs/CTA deve rimare sui tre provider.
- Merge resta dietro `InlineConfirm` danger.

**MUST NOT**

- Non cambiare il contratto evento `goodboy:open-github-session` (payload pinnato).
- Non toccare il polling client-side (5min + visibilitychange, `useGithubPolling/index.ts`): tappabuchi deliberato in attesa di webhook.

---

## Area 6 (PR6): creation grammar (CreatePrPanel + MrDetailPanel)

### Stato attuale (verificato sul codice)

- La grammatica è già legge: `DESIGN.md:171-181` (sezioni bare in colonna, secondary affordances nello slot `action` del `SectionHeader`, un solo footer con un solo primary). Riferimento implementato: `NewSessionView` (FieldRow + Divider fra ogni campo, footer con ghost Cancel + un primary che cambia identità per stato, skeleton non spinner).
- `CreatePrPanel` (`GitHubStudio/CreatePrPanel.tsx`) viola tutto: `SectionHeader` usato come label di campo, zero FieldRow/Divider/help, padding `px-10 py-8` fuori standard, `datalist` nativa per il base branch invece di `BranchCombobox`, `AgentSpawnConfig` orfano a metà form, footer con **due** CTA ("Draft with an agent" secondary + "Create PR" primary) più il checkbox "Mark as draft" che collide semanticamente con "Draft with an agent".
- Twin GitLab identico: `MrDetailPanel.tsx:382-470`.
- Il precedente per la selezione modo in alto: builder stage "approach" con `SegmentedTabs` nello slot action del `SectionHeader` (`WorkflowBuilderView/index.tsx:850-875`).
- Test: `CreatePrPanel.test.tsx` copre solo il path agent (3 casi); il path manuale/draft/error è scoperto.

### Scope

**MUST**

- `CreatePrPanel` e `MrDetailPanel` (form MR) conformi alla grammar: selezione **in alto** manual-vs-agent (`SegmentedTabs` nello slot action, come il builder). Manual → title/body/base/draft con FieldRow+Divider e primary "Create PR". Agent → hint + `AgentSpawnConfig` e primary "Draft with agent". Un solo primary per modalità, Cancel ghost, error a sinistra nel footer.
- "Mark as draft" diventa un campo di sezione (non checkbox di footer), presente in entrambe le modalità; la collisione di naming sparisce perché "Draft with an agent" non esiste più come CTA parallela.
- `BranchCombobox` al posto della datalist; `Skeleton` durante il load dei branch.
- Padding e width allineati al riferimento (`px-6 py-5`, `max-w-2xl` una volta sola).
- Test: aggiungi copertura del path manuale (create, draft flag, error render).

**MUST NOT**

- Non cambiare il prompt dell'agente PR (6 righe, pinnato char-per-char da `CreatePrPanel.test.tsx:132-142`) se non per necessità della nuova UI; se lo tocchi, aggiorna il test consapevolmente.
- Non toccare `createPrForSession` argv building (`--fill`, default draft): comportamento consolidato.

---

## Area 7 (PR7): resolve popover rework

### Stato attuale (verificato sul codice)

- Il "popover" è un `ConfigPanel` hand-rolled absolutely-positioned dentro `ResolveBoard` (`ResolveBoard/index.tsx:406-479`), due trigger (toolbar `:138-177`, per-card `:337-374`). Config model/provider/effort per-thread (`configById` `:64`), ma **mode fix/analyze e hint sono singleton di board** (`:67-68`): editarli su una card li cambia per tutte (pinnato da `index.test.tsx:132`).
- Ispirazione dichiarata: `CreateAgentPopover` (`CreateAgentPopover/index.tsx:96-172`), vero Popover in portal via `useDropdown`, sezioni `PickerSection`, kind grid in alto, routing in basso, un solo primary. Non ha campo messaggio: il precedente per hint+routing è `AgentSpawnConfig` (`AgentSpawnConfig/index.tsx:43-68`).
- **Bug**: `buildCombinedCommentAgentArgs` non legge mai `choice.mode` né `choice.hint` (`spawn-from-comment.ts:151-175`) — il resolver combinato droppa silenziosamente modalità e messaggio. Solo `buildCommentAgentArgs` li usa (`:192,:199,:203`).
- Pipeline da rispettare: batch = N spawn con `deferKickoff` + **una** chiamata `activateNextResolver` (un resolver alla volta, `activateNextResolver.ts:12-18`); marker contract (`<<comment-reply>>`, `<<comment-analysis>>`, `<<comment-wontfix>>`) in `spawn-from-comment.ts:70-147`. Nota: nelle azioni post-commit, push è il primary e queue è il chip neutral (`resolverActions.ts:69-104`).
- Superficie gemella senza popover: diff viewer `handleProposeFixes` (`DiffViewerContent.tsx:655-681`), niente mode né hint.

### Scope

**MUST**

- Sostituire `ConfigPanel` con un vero popover sul pattern `CreateAgentPopover`: in alto mode fix/analyze (`SegmentedTabs`) + hint testuale, in basso routing (PickerSection/AxesSection), un solo primary col nome dell'azione.
- Config **interamente per-card** (mode e hint inclusi) con azione esplicita "applica a tutti"; il popover toolbar setta i default del batch.
- Fix del bug: `buildCombinedCommentAgentArgs` trasporta mode e hint.
- Pipeline invariata: deferKickoff+activateNextResolver per batch, marker contract intatto, push/queue semantics intatte.
- Test `ResolveBoard` aggiornati: il caso "shares mode and hint across every resolver" muore, sostituito da per-card + apply-to-all.

**SHOULD**

- Dare mode+hint anche allo spawn del diff viewer riusando il nuovo popover.

**MUST NOT**

- Non parallelizzare i resolver (un running alla volta è deliberato).
- Non toccare `pushAllResolutions`/pending_resolutions.

---

## Area 8 (PR8): Impact Studio rewrite

### Stato attuale (verificato sul codice)

- Unico studio footer a colonna singola senza rail (`ImpactStudio/index.tsx:48-49`); Budget/Provider usano `StudioRailLayout`. Hook `useImpactMetrics` = 7 query SQL dirette dal renderer, ogni `.catch` sostituisce silenziosamente un EMPTY: **errore indistinguibile da "no data"**, zero error UI (`useImpactMetrics/index.ts:130-220`).
- Evento `goodboy:open-impact-studio` registrato ma mai dispatchato da nessuno (`App.tsx:271-284`): dead path.
- Token fetched e scartati (`ModelMixEntry.inputTokens/outputTokens`, `impact.ts:353-354`); nessun costo totale, nessuna serie temporale, nessun drill-down, nessun dato outcome.
- Dati disponibili e mai usati: durate agent (`started_at/completed_at/done_at`), cache tokens (m089) e context tokens (m090) su `telemetry_records`, time-to-resolve dei `diff_comments`, `turn_events` (la fonte più ricca), `permission_audit_log` (latenza human-in-the-loop), `github_pr_cache`, `pr_review_drafts`, `pending_resolutions`, durate sessione, `parallel_groups.completed_at - created_at`.
- Overlap col Budget: entrambi leggono `telemetry_records`; Budget possiede già caps/ring/sparkline/tabelle per-model e per-session. Primitives chart hand-rolled esistenti: `Sparkline`, `CostRing`, `SpendBar` (budget), `StackedBar`, `TurnHistogram` (impact). Nessuna lib chart nel repo.
- Zero component test su tutta la feature impact (solo query + 3 util).

### Scope

**MUST**

- Riscrittura completa con un asse proprio: **outcome e tempo** (step/PR/issue/review chiusi, durate, throughput, dove si blocca il flusso), delegando la storia soldi al Budget Studio (link/CTA verso di esso, niente duplicazione tier-mix).
- Usare i dati oggi ignorati (almeno: durate agent/sessione, cache-hit ratio da m089, time-to-resolve commenti, outcome PR da `github_pr_cache`/`pending_resolutions`).
- Error UI: un fallimento query si vede (retry affordance), non si maschera da "no data".
- Drill-down: le metriche navigano alle sessioni/superfici che le generano.
- Layout coerente con gli altri studio (rail o struttura sezionale degna, scegli in base al contenuto finale); primitives chart estratte e condivise dove riusate, sempre hand-rolled, niente lib.
- Rimuovere il dead event `goodboy:open-impact-studio` oppure cablarlo da una superficie sensata.
- Component test sul nuovo studio (il precedente: `BudgetStudio/index.test.tsx`).

**MUST NOT**

- Non introdurre librerie chart.
- Non spostare le query SQL nel renderer verso nuovi pattern ad-hoc: se servono query nuove vanno in `packages/db/src/queries/impact.ts` con test come le esistenti.

---

## Convenzioni (tassative)

- Leggi `AGENTS.md` PRIMA di scrivere codice. In particolare: **zero commenti nel codice** (nessuna eccezione, né WHY né JSDoc), niente em-dash in copy e codice, solo named export, arrow function, `type` non `interface`, `rounded-lg`/`gap`, niente test-pair piatti.
- Commit: conventional, scope ammessi `desktop|ui|core|db|types|repo|ci`, header ≤72 char (oltre = il commit NON atterra, in silenzio).
- Branch: `ak/<type>-<kebab-desc>` (mai il codename del worktree). Una PR per area verso `main` (le successive stacked sulla precedente), **non mergiare**: merge solo server-side, mai avanzare main in locale.
- Worktree nuovi: `pnpm install` pieno (con `--ignore-scripts` better-sqlite3 resta senza binding). IDE search torna 0 nei worktree: usa grep shell.
- Migration: nuovo file `m091-*.ts` + registrazione nell'array di `packages/db/src/migrations/index.ts`; il runner usa un SET (collisione di versione = migration saltata per sempre): controlla di essere davvero il 91.
- CI: solo `cargo test --locked` blocca lato Rust; non riformattare file Rust non tuoi (main non è fmt-clean).
- `knip` boccia i file orfani: se una PR orfanizza un file, il delete va nella stessa PR.
- Skill files e worktree local-only, `UX10_PROMPT.md` mai committato, cancellalo a lavoro consumato.

## Meccanica di esecuzione

1. **Per ogni area**: rileggi i file chiave citati (gli audit sopra sono verificati ma il codice può essere avanzato nel frattempo; i simboli da greppare sono nei paragrafi "Stato attuale").
2. Design doc interno per PR1 e PR5 (le due riscritture grosse), NON committato.
3. Implementazione delegata a `codex exec -m gpt-5.6-sol -c model_reasoning_effort="high" --sandbox workspace-write` con commit tematici bisecabili. Gotcha codex: non committa nei worktree (index.lock) → i commit li fai tu; nei background run rediriga stdin (`< /dev/null`); tende a lanciare `cargo fmt` su tutto il crate → scarta i file non pertinenti.
4. Audit/scout/verifiche con modelli Claude leggeri in parallelo; verifica di persona i claim negativi dei subagent (storicamente riportano test verdi falsi).
5. Dopo ogni commit: typecheck + test dei file toccati; suite completa prima di ogni PR. Dead-code audit del file modificato prima del commit; prima di rimuovere simboli, grep di tutti gli usi.
6. Review avversaria per PR: un agent confronta ogni MUST col diff e riporta i gap; chiudi i gap prima di aprire la PR.
7. PR con body strutturato (Closes/Description/Scope/Note); le PR stacked si mergiano bottom-up con merge-commit + retarget, **mai** `--delete-branch` a metà cascata (chiude le figlie). MERGEABLE su GitHub non garantisce che compili: branch di integrazione locale con tutte le PR prima del merge finale.
8. Parallelismo: PR1, PR2, PR8 in worktree separati in contemporanea; PR3→PR7 sequenziali. Prima di mergiare PR parallele: `git merge-tree` per i conflitti.

## File chiave (reference)

| Area              | Path                                                                                                                                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 workflow engine | `apps/desktop/src/store/slices/workflows/{attachWorkflowToSession,finalizeWorkflowStep,maybeAutoAdvanceWorkflow,activateWorkflowAgent,clusterImplementation,scoutTree,skipStuckStepAndAdvance}.ts`                              |
| 1 builder         | `apps/desktop/src/features/session/components/WorkflowBuilderView/index.tsx`, `slices/workflowDrafts/types.ts`                                                                                                                  |
| 1 core            | `packages/core/src/planner/{prompt,client}.ts`, `packages/core/src/workflows/{sequencer,propagator,format}.ts`, `packages/core/src/summarizer/step-output.ts`                                                                   |
| 1 db              | `packages/db/src/migrations/index.ts`, `packages/db/src/queries/{workflow,session-workflow}.ts`, `packages/types/src/{workflow,workspace}.ts`                                                                                   |
| 2 OQ gate/chat    | `apps/desktop/src/features/chat/components/ChatView/index.tsx:233-286`, `TranscriptRows.tsx`, `OpenQuestionCluster.tsx`, `OpenQuestionInlineCard.tsx`                                                                           |
| 2 OQ slice        | `apps/desktop/src/store/slices/open-questions/*`, `slices/turn/sendTurn.ts:916-933`, `slices/agents/selectAgent.ts:80-129`, `packages/core/src/context/auto-populate.ts`                                                        |
| 2 OQ pane         | `apps/desktop/src/features/session/components/SessionWorkspace/parts/QuestionsPane.tsx`, `features/context/components/QuestionsTab/*`, `QuestionCard/index.tsx`                                                                 |
| 3 overview        | `apps/desktop/src/features/session/components/SessionOverviewPane/{index,EditorMenu,PrStatusLine,LinkedWorkSection,BranchChip}.tsx`                                                                                             |
| 3 footer/diff     | `apps/desktop/src/features/session/components/SessionWorkspace/parts/{LensColumnFooter,LensColumn/index}.tsx`, `features/permissions/components/DiffViewerDialog/DiffViewerContent.tsx:694-833`                                 |
| 4 panes           | `apps/desktop/src/features/session/components/SessionWorkspace/parts/{IntegrationPane/index,PrPane,PaneShell}.tsx`, `features/integrations/{ConnectIntegrationEmptyState,components/ExternalTaskChip/index}.tsx`                |
| 5 PR detail       | `apps/desktop/src/features/github/components/GitHubStudio/{PrDetailPanel,PrActionBar,PrSectionNav,PrOverview,PrReviewers}.tsx`, `shared/components/StudioDetail/*`, `packages/ui/src/components/{SegmentedTabs,DetailPage}.tsx` |
| 6 create forms    | `apps/desktop/src/features/github/components/GitHubStudio/CreatePrPanel.tsx`, `features/integrations/gitlab/GitlabStudio/MrDetailPanel.tsx`, riferimento `features/session/components/NewSessionView/*`, `DESIGN.md:171-195`    |
| 7 resolve         | `apps/desktop/src/features/github/components/GitHubStudio/ResolveBoard/*`, `features/chat/spawn-from-comment.ts`, `features/session/components/CreateAgentPopover/*`, `slices/agents/{spawnAgent,activateNextResolver}.ts`      |
| 8 impact          | `apps/desktop/src/features/impact/**`, `packages/db/src/queries/impact.ts`, confronto `features/budget/components/BudgetStudio/*`, `shared/components/{StudioShell,StudioRailLayout}/*`                                         |

Parti. Nessuna domanda, nessun checkpoint. Lavoro perfetto.
