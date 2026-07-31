# Round UX12: disciplina dell'orchestratore, verita' unica sul routing, grafo degli step

Obiettivo: il workflow dinamico oggi non e' governabile. Non ha regole di terminazione, non pianifica mai,
sceglie modelli a sorpresa, e la stessa informazione (quale modello sta girando) compare con tre valori
diversi in tre punti della UI. In piu' il pannello del run ha due CTA che fanno cose diverse in due posti
diversi, la lista "why these steps" non dice il perche', e il collegamento fra step e' una fila di frecce
che non rappresenta i fan-out. Chiudi tutto: regole al workflow, una sola verita' sul modello, un grafo
leggibile. "intuitivita' deve sempre essere il nostro must".

## Ruolo

Sei l'orchestratore di questo lavoro. Piena autonomia: nessuna conferma, nessun checkpoint, nessuna
domanda all'utente, nessun elenco di alternative. Decidi e implementi.

Tie-breaker per trade-off indecidibili: **scegli l'opzione che elimina una fonte di verita' duplicata**.
Se due strade sono equivalenti, vince quella che lascia in piedi un solo posto dove il dato viene deciso.

Quattro aree, quattro PR **stacked in quest'ordine** (ognuna parte dal branch della precedente,
ognuna aperta verso il branch della precedente e infine ribasata su main):

1. `ak/feat-orchestrator-rules` - motore dell'orchestratore (core + store + db)
2. `ak/fix-routing-single-truth` - verita' unica su provider/modello di uno step
3. `ak/feat-workflow-run-ui` - card orchestratore, why-these-steps, kickoff, conferme, breadcrumb
4. `ak/feat-step-graph` - grafo degli step

Le PR 3 e 4 dipendono dalla 2 per il badge di routing. Non invertire.

---

## Area 1: motore dell'orchestratore

### Stato attuale (verificato sul codice)

- Il system prompt e' una singola costante: `packages/core/src/orchestrator/prompt.ts:6-21`
  (`ORCHESTRATOR_SYSTEM_PROMPT`). Dice `decide the single next step` (`:8`) e
  `Return done when the goal and operator process are satisfied` (`:8`). Non esiste una sola parola su
  quanti step totali, su un budget, su una fase di planning, su cosa fare quando lo scout ha gia' risposto.
- Ruoli ammessi: `prompt.ts:10`, sette stringhe (`scout, planner, implementer, reviewer, investigator,
tester, custom`). `planner` non e' mai richiesto ne' suggerito da nessuna riga del prompt.
- Lo user prompt e' `prompt.ts:23-85`. Contiene goal, processo operatore, `Open questions: N` (solo il
  conteggio), menu modelli, ladder di effort, role defaults, step completati (solo l'ultimo summary
  intero, gli altri troncati a 280 char, `prompt.ts:4`), hints operatore.
- **Terminazione: non esiste alcun cap.** Solo `done`/`blocked` del modello chiudono il run
  (`orchestrateNextStep.ts:438-443` -> `session-workflow.ts:225-234`). `appendStep`
  (`orchestrateNextStep.ts:227`) fa `max(ordinal)+1` senza limite. Nessun cap di costo nel path
  dell'orchestratore: `client.ts:118-128` calcola `usage.estimatedCostUsd` e
  `orchestrateNextStep.ts:382` legge solo `result.decision`, buttando `result.usage` e `result.model`.
- Il gate di budget esiste solo per l'autorun (`maybeAutoAdvanceWorkflow.ts:66-74`); la CTA manuale
  `next step` (`WorkflowRow.tsx:525`) lo scavalca del tutto.
- Nessuna detection di ripetizione: se il modello richiede due volte lo stesso step, `uniqueStepName`
  (`orchestrateNextStep.ts:196-206`) si limita a suffissare `Scout 2`, `Scout 3`.
- **Scelta del modello per step**: `prompt.ts:14`, `omit both to accept the role default listed in the
request` + `Pick a stronger model when the step genuinely needs it`. Il menu modelli
  (`prompt.ts:42-50`, costruito da `modelMenuFor` `orchestrateNextStep.ts:79-84`) elenca **tutti** i
  modelli del provider con nota `cheap, fast` / `balanced default` / `deepest reasoning`
  (`MODEL_NOTE`, `orchestrateNextStep.ts:68-72`). I role default arrivano davvero dagli override di
  workspace (`roleDefaultsFor` `:86-94` -> `recommendedModelForRole`), ma il prompt non dice mai che
  sono la scelta dell'utente ne' che deviare va motivato.
- `types.ts:3-10`: lo step ha `model` e `effort`, **non ha `provider`**. Ogni step eredita il provider
  di sessione.
- **Il `reason`**: dichiarato in `types.ts:15,20,24`, ma nel prompt compare solo come placeholder
  `"reason":"..."` (`prompt.ts:17,20,21`). Nessuna indicazione su cosa scriverci, per chi, quanto lungo.
  Il parser lo degrada a stringa vuota se manca (`parser.ts:158`). E' salvato su `steps.orchestrator_reason`
  (m093) solo per l'azione `next` (`orchestrateNextStep.ts:423`): **le motivazioni di `done` e `blocked`
  non vengono persistite da nessuna parte**, vivono solo nell'evento di transcript
  (`orchestrateNextStep.ts:106-132`) e nella notifica.
- **Modello dell'orchestratore stesso**: `resolveTaskModel('workflow_orchestrator', ...)`
  (`orchestrateNextStep.ts:342-346`), preferenza di workspace, fallback `getCheapModel(provider)`
  (`task-models.ts:30-38`). Unica UI: `ProviderStudio/DefaultsPanel/index.tsx:56-60`. Nel run non e'
  visibile da nessuna parte. Il retry "with another provider" (`OrchestratorPanel/index.tsx:83-91`)
  forza sempre `getCheapModel(providerId)` senza far scegliere il modello.
- Hints: `OrchestratorPanel` -> `setWorkflowOrchestratorHints` -> `session_workflows.orchestrator_hints`
  (m094) -> `prompt.ts:75-82`, iniettati per ultimi con `they override your own judgement where they
conflict`. La nota di "keep going" (`continueWorkflowRun.ts:15-17`) viene **concatenata per sempre**
  agli hints, non e' one-shot.
- Test che pinnano il prompt: `client.test.ts:36-37` (formato riga menu modelli e riga role default),
  `prompt.test.ts:21-29` (solo la sezione hints). Nessun test tocca il testo del system prompt.

### Problemi

1. **Il run non finisce mai** perche' nessuno gli ha detto quando finire. Il prompt delega la
   terminazione al giudizio del modello con una frase sola, senza budget di step, senza criterio di
   sufficienza, senza il divieto di rilanciare lavoro gia' fatto. Conseguenza: su un task semplice
   l'utente ha visto 6+ step e $5.41 senza chiusura.
2. **Non pianifica mai** perche' niente glielo chiede. Il prompt elenca `planner` fra sette ruoli e si
   ferma li'. Conseguenza: scout -> implementer diretto, senza un passo che decida cosa implementare, e
   ogni review successiva riapre lavoro.
3. **Deviazione di modello non motivata**: `Pick a stronger model when the step genuinely needs it` e'
   un invito, e il menu presenta il modello piu' costoso come `deepest reasoning`. Conseguenza:
   implementazione spawnata su fable-5 mentre l'utente aveva configurato altro nel pannello, senza che
   da nessuna parte risulti il perche'.
4. **`WHY THESE STEPS` non spiega niente** perche' il campo che alimenta quella lista non ha contratto:
   il modello scrive quello che gli pare, spesso un riassunto di cosa ha fatto lo step precedente
   invece del motivo del prossimo. Conseguenza: una sezione che occupa spazio e non informa.
5. **Le motivazioni di chiusura si perdono**: `done` e `blocked` non finiscono su nessuna riga. Il run
   finito non sa dire perche' e' finito.
6. **Il modello dell'orchestratore e' invisibile e non cambiabile in corsa**: sta solo in Provider
   Studio, e il retry ricade sempre sul modello cheap.
7. La CTA manuale `next step` scavalca il gate di budget (`maybeAutoAdvanceWorkflow.ts:66-74`).

### Scope

**MUST**

- Il system prompt detta regole di flusso esplicite, non inviti. Contenuto minimo:
  - un budget di step dichiarato, presente anche nello user prompt come `Step budget: N used of M`,
    con l'istruzione di chiudere o chiedere quando lo si sfora;
  - la regola che dopo una fase di scoperta serve un passo di decisione (planner) prima di scrivere
    codice, salvo che il goal sia dichiaratamente un fix puntuale gia' localizzato;
  - il divieto di rilanciare un lavoro gia' coperto da uno step completato: se il gap e' piccolo, si
    chiude `done` elencandolo, non si apre un nuovo step;
  - il criterio di sufficienza: cosa deve essere vero perche' `done` sia legittimo.
- **Il modello di default dell'utente e' la scelta di partenza, sempre.** Il prompt dichiara i role
  default come "the operator configured these", ammette la deviazione solo quando lo step non e'
  eseguibile bene con il default, e **quando devia obbliga a dichiararlo nel `reason`** con la parola
  del modello scelto e il motivo. Nessuna deviazione silenziosa.
- Il `reason` ha un contratto scritto nel prompt: e' rivolto all'operatore, spiega **perche' questo step
  ora** (cosa manca, cosa ha prodotto il precedente che lo rende necessario), una o due frasi, in
  markdown minimale. Non e' un riassunto dello step precedente.
- `done` e `blocked` persistono la loro motivazione sul run (nuova colonna su `session_workflows`,
  migration m095) e sono leggibili dalla UI.
- Un cap di step effettivo lato codice, non solo lato prompt: superata la soglia l'orchestratore riceve
  l'istruzione di chiudere, e se insiste il run va in `blocked` con un motivo esplicito. La soglia deve
  essere una costante esportata e testata, non un numero sparso.
- Il routing dell'orchestratore (provider + modello + effort) e' esposto nel run e modificabile in
  corsa, e la modifica vale per le decisioni successive dello stesso run (persistita sul run, non solo
  sul workspace). Il retry "another provider" smette di forzare il modello cheap.
- La CTA manuale passa per lo stesso gate di budget dell'autorun.

**SHOULD**

- La nota di "keep going" diventa one-shot invece di appiccicarsi per sempre agli hints, oppure gli
  hints diventano editabili in modo che l'utente possa toglierla. Oggi non c'e' modo di rimuoverla se
  non svuotando tutto il campo.
- `result.usage` dell'orchestratore viene registrato: oggi il costo delle decisioni non compare da
  nessuna parte.

**MUST NOT**

- Non aggiungere un campo `provider` allo step dell'orchestratore. Lo step eredita il provider di
  sessione per costruzione (`preSpawnWorkflowAgents.ts:65`), e il parser valida i modelli contro quel
  provider (`parser.ts:86-95`). Aggiungere provider per step riaprirebbe il mismatch che l'area 2 chiude.
- Non toccare la re-entrancy guard `orchestrationInFlight` (`orchestrateNextStep.ts:54, 306-309, 465`).
- Non rendere l'orchestratore agentico: `toolsDisabled: true` (`client.ts:92-103`) e' una decisione
  presa (v0.1.48, il dynamic partiva come sessione agentica ed e' stato fixato con `--tools ""`).
- Non cambiare il formato riga del menu modelli ne' dei role default senza aggiornare
  `client.test.ts:36-37`, che li pinna.

---

## Area 2: verita' unica sul routing di uno step

### Stato attuale (verificato sul codice)

Lo stesso agente ha oggi **tre rappresentazioni divergenti** del proprio modello:

- **Strip**: `WorkflowStepStripItem.tsx:48` renderizza `<RoutingBadge model={model} />` **senza passare
  `provider`**. `RoutingBadge/index.tsx:40` fa `const named = provider ?? getModelProvider(model)`: il
  glifo del provider e' **inferito dalla stringa del modello**. `resolveStepRouting.ts:21` calcola un
  provider e **lo butta via**, il tipo `StepRouting` e' `{model, effort}`.
- **Pannello di dettaglio**: `WorkflowStepInspector/index.tsx:61-62`,
  `model = telemetry?.model ?? dominantUsage?.model ?? step.modelOverride ?? modelOverride` ma
  `provider = telemetry?.provider ?? dominantUsage?.provider ?? providerOverride` - **il provider non ha
  il fallback su `step.providerOverride`**, quindi modello e provider dello stesso badge possono venire
  da due fonti diverse.
- **Composer**: `useTurnRouting.ts:88-104`, poi `resolveModelForProvider` (`model-map.ts:31-47`)
  **rimappa un id di modello estraneo nel catalogo del provider corrente** senza dirlo. E
  `RoutingPicker/resolveRouting.ts:93` fa `catalog.find(...) ?? catalog[0]`: se l'id non e' in catalogo
  **il chip mostra silenziosamente il primo modello del provider**.

Sotto, il dato non viene mai scritto:

- `preSpawnWorkflowAgents.ts:56-81` mette provider/model/effort **solo nella mappa in memoria**, restituita
  ai chiamanti (`orchestrateNextStep.ts:292-295`). Nessuna chiamata a `updateAgentConfig`.
- `agent_insert` non sa scrivere quelle colonne: `apps/desktop/src-tauri/src/workflows.rs:975-1004` non
  le include nella INSERT e ritorna `effort: None, model_override: None, provider_override: None`
  (`:1025-1027`). Lato TS idem, `features/workflows/workflows.ts:355-378` non le manda.
- Al reload `loadPhaseRunsForSession.ts:14-27` ripopola le mappe dalle colonne NULL: **il routing
  risolto sparisce**.
- `useAgentSwitchSync.ts:53-58`: a ogni cambio agente riscrive la config dell'agente **uscente** con lo
  stato locale del picker, che e' `null` se l'utente non ha mai toccato il picker; `setAgentConfig.ts:41-49`
  a quel punto **cancella** le voci dalle mappe e mette a NULL le colonne. Navigare via da una chat di
  step cancella il routing di quell'agente.
- `sendTurn` non riscrive mai il modello risolto sulla riga dell'agente: `sendTurn.ts:555, :1109` toccano
  solo status/summary/timestamp.
- La riga `Message` persiste l'override **richiesto** (`sendTurn.ts:504`), mentre l'evento `user_text`
  porta quello **risolto** (`sendTurn.ts:512-513`).
- `apps/desktop/src-tauri/src/bridge/snapshot.rs:176-180` droppa `verbosity, effort, model_override,
provider_override` dalla SELECT dello snapshot mobile.

Precedenza reale al send (`resolveTurnModelSelection.ts:41-79`):
`retryModel > phaseModelOverride > autoStepModel > turnOverride > agentModelPin > routingDecision`.
**`autoStepModel` batte l'override del composer**, pinnato dal test `resolveTurnModelSelection.test.ts:125`.
E `resolveTurnModelSelection.ts:84-90` scarta il candidato quando `fallbackUsed` o quando il provider
non coincide. Il banner che spiegherebbe il fallback e' morto:
`RoutingIndicator/index.tsx:49-51` ritorna `null` perche' `SESSION_FEATURES.budget === false`
(`shared/lib/features.ts:10`).

### Problemi

1. **"GPT-5.6 di codex" nella strip mentre la chat mostra cursor** e' esattamente il bug del glifo
   inferito: il modello e' lo stesso, il provider mostrato dalla strip e' indovinato dalla stringa
   invece che letto. Conseguenza: l'utente non sa quale delle due schermate creda.
2. **Il routing di uno step di workflow non e' persistito**, quindi dopo un reload la UI mostra il
   default di sessione al posto di quello che ha davvero girato.
3. **Il picker del composer viene ignorato in una chat di step** (`autoStepModel` e `phaseOverride`
   vincono). L'utente seleziona un modello e il turno parte con un altro: e' il bug (a) segnalato, ed
   e' deterministico, non una race.
4. **Cambiare agente cancella il routing dell'agente che si lascia**, con conseguente reset silenzioso.
5. Il fallback di provider (`budget/router.ts:68-88`) sostituisce il modello **senza nessun segnale**
   perche' l'unico indicatore e' dietro una feature flag spenta.

### Scope

**MUST**

- Una sola funzione risolve "il routing di questo step/agente" e restituisce \*\*sempre provider + modello
  - effort insieme\*\*. `resolveStepRouting` smette di buttare via il provider e il suo tipo diventa
    `{provider, model, effort}`. Strip, riga sidebar, inspector e CTA leggono quella.
- `RoutingBadge` riceve sempre un provider esplicito nei punti di workflow. L'inferenza dalla stringa
  resta solo come ultimo fallback per i chiamanti che davvero non hanno il dato.
- Il routing risolto allo spawn viene **persistito sulla riga dell'agente**: `agent_insert` accetta e
  scrive `model_override`, `provider_override`, `effort`; `preSpawnWorkflowAgents` li manda. Al reload
  la UI mostra quello che ha girato.
- `useAgentSwitchSync` non azzera piu' la config dell'agente uscente quando lo stato locale del picker
  e' `null`. Nessuna scrittura implicita: si scrive solo quello che l'utente ha davvero scelto.
- In una chat di step, se l'utente sceglie esplicitamente un modello dal composer, quella scelta vince
  su `autoStepModel`. La scelta esplicita dell'utente non puo' essere scavalcata da una raccomandazione
  automatica. `phaseModelOverride` puo' restare sopra solo se l'utente non ha toccato nulla.
- Quando il modello effettivamente usato differisce da quello mostrato prima del send (fallback di
  provider, rimappatura di catalogo), l'utente lo vede. Un segnale nel turno, non un banner globale
  dietro una flag spenta.
- Test di coerenza: per lo stesso agente, strip, inspector e composer mostrano la stessa coppia
  provider+modello. Oggi questo test non esiste (nessun test confronta le tre superfici).

**SHOULD**

- `bridge/snapshot.rs:176-180` allinea la SELECT alle colonne di routing.
- `Message.providerOverride` registra il valore risolto, o smette di essere letto come se lo fosse.

**MUST NOT**

- Non reintrodurre `RoutingIndicator` accendendo `SESSION_FEATURES.budget`: quella flag governa
  altro.
- Non toccare `AGENT_SESSION_COLS` (`workflows.rs:914-920`) in modo da droppare colonne: la regressione
  del SELECT senza colonne di routing e' gia' capitata una volta ed e' pinnata da
  `workflows.rs:1272-1314`.
- Non rimuovere `agentPinApplies` (`store/slices/turn/agentPinApplies.ts:8-10`): un pin senza provider
  e' anthropic-only per decisione, non per svista.

---

## Area 3: la card del run

### Stato attuale (verificato sul codice)

- **Markdown**: il renderer condiviso e' `packages/ui/src/components/Markdown.tsx:704`, esportato da
  `packages/ui/src/index.ts:37`, senza dipendenze dall'app quindi importabile ovunque. **La maggior
  parte dei testi lo usa gia'**: kickoff goal/instructions/marker (`WorkflowKickoffCard/index.tsx:50,63,70,77`),
  goal del run e "how you described the process" (`WorkflowRunAsk.tsx:21,43-46`), instructions ed
  expected output dell'inspector (`WorkflowStepInspector/index.tsx:109,119,142-145`), reason nella card
  di chat (`OrchestratorDecisionCard/index.tsx:33`).
  Restano plain text: **il reason in `WorkflowOrchestratorTldr/index.tsx:46-48`** (uno `<span truncate>`
  con `title`), `run.orchestrationError` (`OrchestratorPanel/index.tsx:112-114`), `promptPrefix` e
  `expectedOutput` in `WorkflowFormatPreview/index.tsx:134-143`, `promptPrefix` in `LibraryCard/index.tsx:46-50`.
- **Kickoff card** (`WorkflowKickoffCard/index.tsx`, 82 righe): il goal sta **fuori** dal corpo
  collassabile, dentro lo slot `header` (`:35-56`); il corpo (`:58-79`) ha solo `instructions` e
  `marker`. Il chevron non esiste se non ci sono dettagli (`:44`, `hasDetails` `:26-28`). Il test
  `WorkflowKickoffCard/index.test.tsx` pinna "goal always visible / never behind chevron".
- **Why these steps** (`WorkflowOrchestratorTldr/index.tsx`, 63 righe): per riga tre span inline,
  indice + nome step (`max-w-40 truncate`) + reason (`flex-1 truncate`), tutto su una riga sola.
  `COLLAPSED_COUNT = 3` (`:5`), mostra la **coda** e nasconde la testa (`:22`), bottone `show N earlier`
  (`:52-60`). Montato solo in `WorkflowRow.tsx:391` sotto `isDynamic`.
- **Card di stato orchestratore** (`OrchestratorPanel/index.tsx`, 240 righe): sei fasi (`phaseOf` `:25-38`:
  deciding, done, blocked, failed, running, idle) con copy in `PHASE_COPY` (`:40-47`). CTA ospitate:
  `orchestrator-retry` e `orchestrator-retry-provider` (solo failed|blocked), `keep going` (solo done,
  apre una textarea e chiama `continueWorkflowRun`), `add hints` (sempre). Montata in
  `WorkflowRow.tsx:383-390` sotto `isDetail && expanded && isDynamic`.
- **Next step CTA** (`WorkflowNextStepCta/index.tsx`, 282 righe): sei esiti mutuamente esclusivi.
  Per i run dinamici: pill di stato mentre decide (`:108-121`), `null` se `done` (`:122-124`), retry se
  `blocked` (`:125-141`), bottone `next step` se nessun agente attivo (`:145-161`). Montata in
  `WorkflowRow.tsx:518-539`, **sotto la strip, in fondo al blocco**. Secondo mount in
  `ChatWorkflowAdvance.tsx:62-73` (header della chat) dove `run`/`onOrchestrate` non sono passati,
  quindi i rami dinamici sono morti li'.
  **Le due superfici sono gia' mutuamente esclusive per costruzione**: la CTA ritorna `null` esattamente
  quando il panel mostra "keep going".
- **Discard/Delete**: `WorkflowKillButton.tsx:12-27` e `WorkflowDeleteButton.tsx:12-27` sostituiscono il
  bottone con un `InlineConfirm` **senza classe di posizionamento**, dentro
  `<div className="flex shrink-0 flex-wrap items-center justify-end gap-1">` (`WorkflowRow.tsx:269-313`).
  `InlineConfirm` (`packages/ui/src/components/InlineConfirm.tsx:76-85`) e' una card
  `flex min-w-0 flex-col gap-2 rounded-lg border p-2.5` senza cap di larghezza: gonfia la riga di azioni
  e finisce sopra l'header. Discard e' montato **due volte** nella variante sidebar
  (`WorkflowRow.tsx:367` e `:372`).
  Pattern di casa: 18 conferme, tutte `InlineConfirm`, zero `window.confirm`. Dieci usano la variante
  **posizionata** (`absolute right-0 top-full z-40 mt-1 w-72 bg-background shadow-lg`), es.
  `WorkflowNextStepCta/index.tsx:181,267`, `PrActionBar.tsx:65`, `AgentInspector/ActionsSection.tsx:71`,
  `PlanStudio/index.tsx:390,406`. `packages/ui` non ha ne' `ConfirmPopover` ne' `AlertDialog`; `Dialog`
  esiste ma non e' mai usata per conferme.
- **Breadcrumb**: tre implementazioni distinte.
  `sessionBreadcrumb.ts:27-79` (chrome app, nessun dropdown).
  `AgentBreadcrumb.tsx:57` ha il gate `const canSwitch = siblings.length > 1;` (`:73-98`: senza fratelli
  rende un `<span aria-current="page">`, non un bottone).
  `WorkflowBreadcrumb.tsx:103-176` **non ha nessun equivalente di `canSwitch` sul crumb di step**:
  l'unica guardia e' `stepLabel != null`, quindi la tendina con `ChevronDown` compare sempre, anche con
  un solo step. Il crumb dell'agente invece **e' gia' gated**: `{clusterChildren.length > 0 &&
rootAgent != null && (...)}` (`:177`).
  Grep confermato: **non esiste nessun branch su `executionMode` nel codice dei breadcrumb**. Canonico e
  orchestrato passano dallo stesso componente; la differenza e' solo che il run dinamico ha meno step e
  quelli non spawnati sono `disabled` (`:136,142`).

### Problemi

1. **Il reason in "why these steps" e' l'unico testo dell'orchestratore ancora troncato su una riga**,
   quindi anche se l'area 1 gli da' un contratto, l'utente continuerebbe a leggerne 60 caratteri.
   Il resto dei testi e' gia' markdown: la percezione di "plain text illeggibile" viene da qui e dal
   fatto che il modello scrive paragrafi non strutturati (fix in area 1).
2. **Il kickoff mette il goal nell'header e i dettagli nel corpo**: la parte lunga e' sempre aperta, la
   parte corta si nasconde. E' l'opposto di quello che serve.
3. **Due CTA per la stessa cosa in due punti**: `next step` in fondo alla card, `keep going`/`add hints`
   a meta'. L'utente non sa a cosa serva quella in fondo, dato che gli hints stanno sopra.
4. **La conferma di discard/delete e' un `InlineConfirm` non posizionato in una riga di azioni**: si
   espande sul posto e copre l'header. Il pattern posizionato esiste gia' in dieci punti dell'app.
5. **Il crumb di step ha sempre la tendina**, anche con un solo step, mentre il crumb dell'agente e' gia'
   condizionato. Asimmetria fra due componenti fratelli.

### Scope

**MUST**

- Il reason di ogni riga di "why these steps" e' leggibile per intero: markdown, a capo, espandibile per
  riga. Non un `title` nativo.
- "why these steps" deve rispondere alla domanda del titolo. Se dopo l'area 1 il contenuto e' il motivo
  dello step, il titolo va bene; altrimenti rinomina la sezione per quello che mostra davvero e
  ristruttura la riga cosi' che si legga come "step N, scelto perche' X". Include anche la motivazione
  di chiusura persistita in area 1 quando il run e' `done` o `blocked`.
- La card del kickoff diventa due righe: titolo e, sotto, la descrizione **espandibile e mandata a capo**,
  collassata di default. Il goal lungo smette di stare sempre aperto nell'header.
  Aggiorna il test che pinna "goal always visible": la decisione cambia consapevolmente.
- **Tutte le CTA dell'orchestratore vivono nella card di stato dell'orchestratore.** `next step`,
  retry, keep going, hints: una sola superficie, quella che gia' porta lo stato e gli hints. La CTA in
  fondo alla card del run sparisce nei run dinamici. Verifica che i run statici mantengano la loro
  (`run next step: {name}`, `skip blocked step`) perche' li' l'orchestratore non esiste.
- La card di stato mostra provider + modello + effort dell'orchestratore, con il controllo per cambiarlo
  in corsa (area 1).
- Discard e delete usano la variante posizionata di `InlineConfirm` come gli altri dieci punti
  dell'app: ancorata al bottone, larghezza fissa, sopra il contenuto, senza gonfiare la riga di azioni.
  Rimuovi il doppio mount di discard in `WorkflowRow.tsx:367` / `:372`.
- Il crumb di step prende lo stesso gate di `AgentBreadcrumb`: tendina solo quando c'e' davvero piu' di
  una destinazione. Con un solo step, testo. La tendina resta per i cluster e i multi-scout, dove il
  crumb dell'agente la usa gia'.

**SHOULD**

- `run.orchestrationError` in markdown come il resto.
- `WorkflowFormatPreview` e `LibraryCard`: `promptPrefix` / `expectedOutput` in markdown.

**MUST NOT**

- Non introdurre una nuova primitiva di conferma. `InlineConfirm` e' il pattern di casa in 18 punti;
  `Dialog` non e' mai usata per conferme ed e' una scelta, non una dimenticanza.
- Non aggiungere un branch su `executionMode` nei breadcrumb: la differenza fra canonico e orchestrato
  non e' il codice, e' il numero di step. Il fix e' il gate su quante destinazioni ci sono.
- Non spostare `WorkflowNextStepCta` fuori dai run statici: `pickNextWorkflowStep` e' consumato anche da
  `SessionOverviewPane/PipelineLane.tsx:5`.
- Non rendere il goal del kickoff invisibile: deve restare la riga di testa, e' solo il corpo lungo che
  collassa.

---

## Area 4: grafo degli step

### Stato attuale (verificato sul codice)

- La strip e' una fila piatta: `WorkflowStepStrip/index.tsx:33-37`
  `className="flex flex-wrap items-center gap-1.5"`, ordinamento unico `sortedRuns` per `ordinal`
  (`:30`), separatori `ArrowRight size={13}` inseriti come **fratelli** del chip (`:49-52`), quindi le
  frecce vanno a capo insieme ai chip e la seconda riga inizia con una freccia orfana (visibile negli
  screenshot).
- **I figli non sono mai nodi**: `WorkflowStepStripItem.tsx:41-47` ha uno slot solo, che mostra
  **o** il contatore `completati/totali` dei figli **o** il glifo di stato del nodo. Un agente con figli
  non mostra il proprio stato.
- **Dati di linkage esistenti** (`packages/types/src/workflow.ts:82-111`): `parentAgentId` (:87, unico
  arco di parentela, m047), `stepId` (:85), `workflowRunId` (:86, m054), `ordinal` (:88, sequenza
  piatta a livello di sessione). **Non esistono `clusterId`, `sourceStepId`, `previousStepId`.**
  `Step.parallelGroup` (:63) esiste nel tipo e non e' usato dalla strip.
- **Fan-out scout** (`scoutTree.ts:174-182`): i figli ricevono `parentAgentId` + `workflowRunId` e
  **nessuno `stepId`**. Cap: `SCOUT_DEPTH_CAP = 2` (`:20`), `SCOUT_MAX_CHILDREN = 6` (`:21`).
  La sintesi del padre (`maybeSynthesizeParent` `:219-253`) e' un arco di join che **esiste solo nella
  logica runtime, non nei dati**.
- **Fan-out cluster** (`clusterImplementation.ts:101-109`): stessa forma, `parentAgentId` +
  `workflowRunId`, niente `stepId`, e i cluster girano **in sequenza** (solo `childIds[0]` parte, `:131-134`).
  L'identita' del cluster viene dal Plan (`resolveClustersPlan` `:231-266`), non dall'agente; l'indice
  del figlio si recupera posizionalmente (`:304-307`).
- **Regola gia' pinnata da test**: `clusterImplementation.test.ts:276`
  `expect(args.stepId).toBeUndefined()`. Il root si risolve con `resolveRootAgent`
  (`agent-kind.ts:27-45`, risale `parentAgentId` con guardia sui cicli).
- `useSessionAgentTree.ts:70-81` fornisce gia' `childrenByParentId`; `:57-68` `agentsByRunId` tiene
  **solo i root** (scarta chi ha `parentAgentId != null || stepId == null`) ed e' esattamente cio' che
  arriva alla strip.
- **Materiale riusabile**: `ScoutSubtree.tsx:20-104` e' gia' un albero ricorsivo n-livelli con guardia di
  profondita' (`:32`), conteggio unread ricorsivo (`:39-51`) e guida di indentazione
  `ml-3 ... border-l border-border-soft/60 pl-2` (`:53`); lo stesso indent e' ripetuto inline in
  `WorkflowRow.tsx:458-501` per i cluster. `SpawnTree/lib.ts:5-16` ha gia' il modello ricorsivo
  `SpawnNode` con `statusToNodeStatus`, `outcomeTone`, `kindEyebrow` (che etichetta gia'
  `scout: 'scout fan-out'`, `implementer: 'implementation'`) - **il renderer e' stato rimosso, il
  modello e' orfano** ma viene ancora costruito da `useWorkspaceRuns/index.ts:131-153`.
  `FileTree/TreeNodeView.tsx:30,60,145` ha il pattern `indent = depth * 10` + ricorsione.
- **Niente librerie di grafi**: nessun react-flow, d3, dagre, elkjs nel workspace. Tutta l'arte di
  connessione oggi e' bordi Tailwind + icone lucide. SVG esistenti: due sparkline, un anello di costo,
  le brand icon, il chevron della Select.
- La strip ha **un solo mount in produzione**: `WorkflowRow.tsx:397-406`, gated `isDetail`. Il transcript
  non la monta: li' la navigazione e' `WorkflowBreadcrumb`. Due componenti di glifo di stato distinti
  per la stessa semantica: `WorkflowStepStatusGlyph.tsx` e `WorkflowStripStatus.tsx`.
- Test della strip: **uno solo** (`WorkflowStepStrip/index.test.tsx:70`). Niente su frecce, wrapping,
  ordinamento, stati falliti.

### Problemi

1. **La sequenza e' rappresentata da frecce che vanno a capo**: alla seconda riga la freccia orfana
   suggerisce un collegamento che non c'e', e con sei step il flusso non si legge piu'.
2. **Il fan-out non e' rappresentato affatto**: uno scout che si e' aperto in tre sotto-scout appare
   identico a uno step normale, con un contatore `0/3` al posto del proprio stato. La struttura ad
   albero che i dati gia' contengono (`parentAgentId`) non arriva mai a schermo nella vista di dettaglio.
3. **Un nodo con figli perde il proprio stato**, perche' contatore e glifo condividono lo stesso slot.
4. Due glifi di stato diversi per la stessa semantica in due superfici.

### Scope

**MUST**

- La vista di dettaglio del run rappresenta gli step come **albero**, non come fila:
  la spina dorsale sequenziale degli step verticale, e i figli (`parentAgentId`) rientrati sotto il
  proprio genitore con una guida di connessione, ricorsivamente fino al cap di profondita' gia'
  esistente. Il modello mentale e' quello disegnato dall'utente: `Scout` con sotto `Scout 1..3`, e
  `Scout 2` che a sua volta puo' aprirsi in `2.1..2.3`; poi `Review`, poi `Implement` con i suoi cluster.
- Un nodo mostra **sempre** il proprio stato, anche quando ha figli. Il conteggio dei figli e' una
  informazione in piu', non un sostituto.
- I rami sono collassabili: un fan-out chiuso mostra genitore + conteggio, aperto mostra i figli.
  Default sensato per non allagare la vista con sei sotto-scout.
- Il click su un nodo continua a fare quello che fa oggi (aprire l'inspector nella lens di dettaglio):
  la navigazione non cambia, cambia il disegno.
- Un solo componente di glifo di stato per strip e breadcrumb.
- Disegno con i mezzi di casa: bordi/indentazione come `ScoutSubtree`, oppure SVG se serve una vera
  linea di connessione. **Nessuna nuova dipendenza** di grafi.

**SHOULD**

- Riusa o cancella `SpawnTree/lib.ts`: e' un modello ricorsivo gia' pronto ma orfano del renderer. Se il
  grafo lo usa, riusalo; se non lo usa, cancellalo (knip lo boccerebbe comunque una volta orfano del
  tutto).
- Unifica l'indentazione dei cluster inline di `WorkflowRow.tsx:458-501` con quella del nuovo albero.

**MUST NOT**

- **Non copiare `stepId` sui figli di cluster o sui sotto-scout** per semplificarti il raggruppamento.
  E' una decisione presa e pinnata (`clusterImplementation.test.ts:276`); il root si risolve con
  `resolveRootAgent`, e da li' derivano lens e unread.
- Non introdurre una libreria di layout di grafi. Il grafo e' un albero con un solo arco di parentela:
  si disegna con indentazione.
- Non toccare `SCOUT_DEPTH_CAP` / `SCOUT_MAX_CHILDREN`.
- Non mettere l'albero nel transcript: la strip ha un solo mount ed e' quello di dettaglio.

---

## Convenzioni (tassative)

Leggi `AGENTS.md` alla radice **prima** di scrivere codice, e `CLAUDE.md` per le note specifiche.
In sintesi, non negoziabile:

- **Zero commenti nel codice.** Nessun `//`, nessun `/** */`, nessuna eccezione, nemmeno negli header
  delle migration.
- **Nessun em-dash**, ne' nel codice ne' nella copy. Punto, virgola, due punti, parentesi.
- Solo **named export**. `type`, mai `interface`. Arrow function, mai `export function`.
- Spaziatura con `gap` di flex, mai `margin` o `space-y`.
- `rounded-lg` per le superfici incorniciate, `rounded-md` per i controlli piccoli.
- Test colocati: `index.test.tsx` accanto al componente. Niente coppie di test piatte.
- Migration: file `mNNN-<kebab>.ts` in `packages/db/src/migrations/`, registrata nell'index. Il runner
  usa un SET: una collisione di numero = migration saltata per sempre. Ultima presente: **m094**.
- Commit: `<type>(<scope>): <subject>`, scope fra `desktop|ui|core|db|types|repo|ci`, subject minuscolo
  <= 72 char, righe del body <= 100 char. Un commit troppo lungo non atterra, in silenzio.
- Branch `ak/<type>-<kebab-desc>`, mai il codename del worktree.
- PR verso `main`, **NON mergiare**. Non avanzare `main` in locale (riavvia l'app Goodboy in uso).
- Non committare `.claude/skills/`, `.claude/worktrees/`, ne' questo file.

## Meccanica di esecuzione

1. Audit mirato per area con agent read-only paralleli, prima di scrivere. Simboli da grep gia'
   identificati: `ORCHESTRATOR_SYSTEM_PROMPT`, `buildOrchestratorUserPrompt`, `orchestrationOutcome`,
   `resolveStepRouting`, `RoutingBadge`, `preSpawnWorkflowAgents`, `useAgentSwitchSync`,
   `resolveTurnModelSelection`, `WorkflowOrchestratorTldr`, `OrchestratorPanel`, `WorkflowNextStepCta`,
   `InlineConfirm`, `WorkflowBreadcrumb`, `childrenByParentId`, `resolveRootAgent`, `ScoutSubtree`.
2. Design interno per area (non committato): cosa cambia, quali test esistenti cadono e perche'.
3. Implementazione delegata a `codex exec -m gpt-5.6-sol -c model_reasoning_effort="high"
--sandbox workspace-write`, un commit tematico per blocco, bisectabile.
4. `pnpm typecheck` + i test dei pacchetti toccati dopo ogni commit. Full `pnpm test` prima della PR.
5. Review avversariale con un agent che confronta ogni MUST con il diff e cerca cosa e' stato saltato.
   Verifica tu i claim negativi dei subagent: riportano verde con troppa facilita'.
6. PR con body strutturato: cosa cambia, perche', cosa non e' stato fatto e perche'.
7. A valle delle quattro PR mergiate: bump di versione (5 file: `package.json`,
   `apps/desktop/package.json`, `tauri.conf.json`, `Cargo.toml`, la riga `goodboy-desktop` di
   `Cargo.lock`), tag `vX.Y.Z` sullo sha di `origin/main`, release draft -> `--draft=false` per far
   partire homebrew.

## File chiave (reference)

| Area | Path                                                                                                                                                                 |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `packages/core/src/orchestrator/prompt.ts`, `client.ts`, `parser.ts`, `types.ts`                                                                                     |
| 1    | `apps/desktop/src/store/slices/workflows/orchestrateNextStep.ts`, `continueWorkflowRun.ts`, `retryWorkflowOrchestration.ts`, `maybeAutoAdvanceWorkflow.ts`           |
| 1    | `packages/db/src/queries/session-workflow.ts`, `packages/db/src/migrations/` (prossima: m095)                                                                        |
| 1    | `packages/core/src/providers/task-models.ts`, `role-models.ts`, `auto-model.ts`, `packages/core/src/roles.ts`                                                        |
| 2    | `apps/desktop/src/features/workflows/resolveStepRouting.ts`                                                                                                          |
| 2    | `apps/desktop/src/shared/components/RoutingBadge/index.tsx`, `RoutingPicker/resolveRouting.ts`                                                                       |
| 2    | `apps/desktop/src/store/slices/workflows/preSpawnWorkflowAgents.ts`, `loadPhaseRunsForSession.ts`                                                                    |
| 2    | `apps/desktop/src/store/slices/turn/sendTurn.ts`, `resolveTurnModelSelection.ts`                                                                                     |
| 2    | `apps/desktop/src/features/chat/components/ChatInput/hooks/useTurnRouting.ts`, `useAgentSwitchSync.ts`                                                               |
| 2    | `apps/desktop/src-tauri/src/workflows.rs` (agent_insert :975-1004, AGENT_SESSION_COLS :914-920), `src/bridge/snapshot.rs:176-180`                                    |
| 3    | `apps/desktop/src/features/workflows/components/OrchestratorPanel/index.tsx`, `WorkflowOrchestratorTldr/index.tsx`, `WorkflowNextStepCta/index.tsx`                  |
| 3    | `apps/desktop/src/features/chat/components/WorkflowKickoffCard/index.tsx`                                                                                            |
| 3    | `apps/desktop/src/features/workspace/components/WorkspacesSidebar/parts/WorkflowRow.tsx`, `WorkflowKillButton.tsx`, `WorkflowDeleteButton.tsx`, `WorkflowRunAsk.tsx` |
| 3    | `apps/desktop/src/features/session/components/SessionWorkspace/parts/WorkflowBreadcrumb.tsx`, `AgentBreadcrumb.tsx`                                                  |
| 3    | `packages/ui/src/components/InlineConfirm.tsx`, `Markdown.tsx`                                                                                                       |
| 4    | `apps/desktop/src/features/workflows/components/WorkflowStepStrip/index.tsx`, `WorkflowStepStripItem.tsx`, `WorkflowStepStatusGlyph.tsx`                             |
| 4    | `apps/desktop/src/features/workspace/components/WorkspacesSidebar/parts/ScoutSubtree.tsx`, `ClusterChildRow.tsx`                                                     |
| 4    | `apps/desktop/src/features/session/components/SessionWorkspace/hooks/useSessionAgentTree.ts`, `apps/desktop/src/features/session/agent-kind.ts`                      |
| 4    | `apps/desktop/src/store/slices/workflows/scoutTree.ts`, `clusterImplementation.ts`                                                                                   |
| 4    | `apps/desktop/src/features/orchestration/components/SpawnTree/lib.ts` (modello orfano)                                                                               |

Parti. Nessuna domanda, nessun checkpoint. Lavoro perfetto.
