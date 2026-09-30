use super::{predict, predict_with};
use crate::history::commits::is_ancestor;
use crate::history::fixtures::{
    branch, commit, git_ok, init_repo, ledger, ledger_plan, picks, plan, run_ok, slug, step,
    subjects,
};
use crate::history::merge_tree::PREDICT_REF;
use crate::history::plan::{order_steps, resolve_plan};
use crate::history::runner::supports_batched_replay;
use crate::history::trial::trial;
use crate::history::types::{HistoryStep, HistoryVerb, PlanPrediction, StepOutcome};

#[test]
fn a_plan_without_moves_predicts_the_same_tree() {
    let b = branch("predict-same");
    let args = plan(
        &b.root,
        &b.base,
        &b.c,
        vec![
            step(&b.a, HistoryVerb::Pick),
            step(&b.b, HistoryVerb::Pick),
            step(&b.c, HistoryVerb::Pick),
        ],
    );
    let prediction = predict(&args).unwrap();
    assert!(prediction.is_supported);
    assert!(prediction.is_tree_equal);
    assert!(prediction
        .steps
        .iter()
        .all(|step| step.outcome == StepOutcome::Clean));
    assert_eq!(git_ok(&b.root, &["status", "--porcelain"]), "");
}

#[test]
fn moving_a_commit_above_its_neighbour_predicts_the_conflict() {
    let b = branch("predict-reorder");
    let args = plan(
        &b.root,
        &b.base,
        &b.c,
        vec![
            step(&b.b, HistoryVerb::Pick),
            step(&b.a, HistoryVerb::Pick),
            step(&b.c, HistoryVerb::Pick),
        ],
    );
    let prediction = predict(&args).unwrap();
    assert_eq!(prediction.steps[0].outcome, StepOutcome::Conflict);
    assert_eq!(prediction.steps[0].files, vec!["policy.txt".to_string()]);
    assert_eq!(prediction.steps[1].outcome, StepOutcome::Blocked);
    assert_eq!(prediction.head, None);
}

#[test]
fn dropping_a_commit_its_neighbour_builds_on_conflicts() {
    let b = branch("predict-drop");
    let args = plan(
        &b.root,
        &b.base,
        &b.c,
        vec![
            step(&b.a, HistoryVerb::Drop),
            step(&b.b, HistoryVerb::Pick),
            step(&b.c, HistoryVerb::Pick),
        ],
    );
    let prediction = predict(&args).unwrap();
    assert_eq!(prediction.steps[0].outcome, StepOutcome::Dropped);
    assert_eq!(prediction.steps[1].outcome, StepOutcome::Conflict);
}

#[test]
fn dropping_an_independent_commit_changes_the_code() {
    let b = branch("predict-drop-clean");
    let args = plan(
        &b.root,
        &b.base,
        &b.c,
        vec![
            step(&b.a, HistoryVerb::Pick),
            step(&b.b, HistoryVerb::Pick),
            step(&b.c, HistoryVerb::Drop),
        ],
    );
    let prediction = predict(&args).unwrap();
    assert!(!prediction.is_tree_equal);
    assert_eq!(prediction.changed_files, vec!["notes.txt".to_string()]);
}

#[test]
fn a_commit_whose_changes_are_already_there_predicts_empty() {
    let root = init_repo("predict-empty");
    let base = commit(&root, "a.txt", "one\n", "base");
    git_ok(&root, &["checkout", "-b", "feature"]);
    let first = commit(&root, "a.txt", "two\n", "first");
    let revert = commit(&root, "a.txt", "one\n", "revert");
    let again = commit(&root, "a.txt", "two\n", "again");
    let args = plan(
        &root,
        &base,
        &again,
        vec![
            step(&first, HistoryVerb::Pick),
            step(&revert, HistoryVerb::Drop),
            step(&again, HistoryVerb::Pick),
        ],
    );
    let prediction = predict(&args).unwrap();
    assert_eq!(prediction.steps[2].outcome, StepOutcome::Empty);
    assert!(prediction.is_tree_equal);
}

#[test]
fn folding_moves_the_commit_under_its_target_and_keeps_the_target_message() {
    let b = branch("predict-fold");
    let mut fold = step(&b.c, HistoryVerb::Fixup);
    fold.target = Some(b.a.clone());
    let args = plan(
        &b.root,
        &b.base,
        &b.c,
        vec![
            step(&b.a, HistoryVerb::Pick),
            step(&b.b, HistoryVerb::Pick),
            fold,
        ],
    );
    let prediction = predict(&args).unwrap();
    assert!(prediction.is_tree_equal);
    let head = prediction.head.unwrap();
    assert_eq!(
        subjects(&b.root, &format!("{}..{head}", b.base)),
        vec!["B edits the policy again", "A edits the policy"]
    );
    assert_eq!(prediction.steps[0].new_sha, prediction.steps[2].new_sha);
}

#[test]
fn squash_needs_an_older_commit() {
    let b = branch("predict-squash-first");
    let args = plan(
        &b.root,
        &b.base,
        &b.c,
        vec![
            step(&b.a, HistoryVerb::Squash),
            step(&b.b, HistoryVerb::Pick),
        ],
    );
    assert!(predict(&args).is_err());
}

#[test]
fn predicting_a_thirty_commit_plan_stays_inside_the_budget() {
    let root = init_repo("predict-timing");
    for dir in 0..40 {
        let folder = root.join(format!("src/module{dir}"));
        std::fs::create_dir_all(&folder).unwrap();
        for file in 0..10 {
            std::fs::write(
                folder.join(format!("file{file}.ts")),
                format!("export const value{dir}_{file} = {file};\n"),
            )
            .unwrap();
        }
    }
    git_ok(&root, &["add", "."]);
    git_ok(
        &root,
        &["commit", "--no-verify", "-m", "base with 400 files"],
    );
    let base = git_ok(&root, &["rev-parse", "HEAD"]);
    git_ok(&root, &["checkout", "-b", "feature"]);
    let shas: Vec<String> = (0..30)
        .map(|index| {
            commit(
                &root,
                &format!("src/module{}/file{}.ts", index % 40, index % 10),
                &format!("export const changed{index} = true;\n"),
                &format!("change {index}"),
            )
        })
        .collect();
    let head = shas.last().unwrap().clone();
    let mut steps: Vec<HistoryStep> = shas
        .iter()
        .map(|sha| step(sha, HistoryVerb::Pick))
        .collect();
    steps.swap(3, 4);
    steps[10].verb = HistoryVerb::Squash;
    steps[20].verb = HistoryVerb::Drop;
    let mut fold = step(&shas[25], HistoryVerb::Fixup);
    fold.target = Some(shas[12].clone());
    steps[25] = fold;
    let args = plan(&root, &base, &head, steps);

    let started = std::time::Instant::now();
    let prediction = predict(&args).unwrap();
    let elapsed = started.elapsed().as_millis();

    let resolved = resolve_plan(&root, &args).unwrap();
    let ordered = order_steps(&resolved.steps).unwrap();
    let direct_started = std::time::Instant::now();
    let direct = predict_with(&root, &resolved, &ordered, false).unwrap();
    let direct_elapsed = direct_started.elapsed().as_millis();

    let probe = std::time::Instant::now();
    for _ in 0..10 {
        git_ok(&root, &["rev-parse", "HEAD"]);
    }
    let per_spawn = probe.elapsed().as_millis() / 10;
    eprintln!(
        "history prediction of a 30 commit plan over 400 files: {elapsed} ms batched, {direct_elapsed} ms one spawn per commit, one git spawn: {per_spawn} ms"
    );
    let outcomes = |found: &PlanPrediction| {
        found
            .steps
            .iter()
            .map(|step| (step.sha.clone(), step.outcome, step.files.clone()))
            .collect::<Vec<_>>()
    };
    assert_eq!(outcomes(&prediction), outcomes(&direct));
    assert_eq!(prediction.changed_files, direct.changed_files);
    assert_eq!(prediction.is_tree_equal, direct.is_tree_equal);
    let head = prediction.head.unwrap();
    assert_eq!(
        git_ok(&root, &["rev-parse", &format!("{head}^{{tree}}")]),
        git_ok(
            &root,
            &["rev-parse", &format!("{}^{{tree}}", direct.head.unwrap())]
        )
    );
    assert_eq!(git_ok(&root, &["for-each-ref", PREDICT_REF]), "");
    if supports_batched_replay() {
        assert!(
            elapsed < 1_000 || elapsed < per_spawn * 12,
            "prediction took {elapsed} ms with {per_spawn} ms per git spawn"
        );
    }
}

#[test]
fn commits_before_the_first_change_keep_their_shas() {
    let l = ledger("run-keep-prefix");
    let mut steps = picks(&[&l.export, &l.batch, &l.webhook, &l.retries]);
    steps.push(step(&l.logging, HistoryVerb::Drop));
    steps.extend(picks(&[&l.tests, &l.typo]));
    let prediction = predict(&ledger_plan(&l, steps.clone())).unwrap();
    assert_eq!(
        prediction.steps[3].new_sha.as_deref(),
        Some(l.retries.as_str())
    );
    assert_ne!(
        prediction.steps[5].new_sha.as_deref(),
        Some(l.tests.as_str())
    );
    let result = run_ok(&l, steps, "run-keep-prefix");
    let head = result.head.clone().unwrap();
    assert!(is_ancestor(&l.root, &l.retries, &head));
    assert!(!is_ancestor(&l.root, &l.tests, &head));
}

#[test]
fn an_empty_commit_is_kept_and_a_redundant_one_is_never_dropped_silently() {
    let root = init_repo("empty-commits");
    let base = commit(&root, "a.txt", "one\n", "base");
    git_ok(&root, &["checkout", "-q", "-b", "feature"]);
    let first = commit(&root, "a.txt", "two\n", "first");
    git_ok(
        &root,
        &[
            "commit",
            "-q",
            "--no-verify",
            "--allow-empty",
            "-m",
            "Mark the release",
        ],
    );
    let marker = git_ok(&root, &["rev-parse", "HEAD"]);
    let revert = commit(&root, "a.txt", "one\n", "revert");
    let again = commit(&root, "a.txt", "two\n", "again");
    let mut reword = step(&marker, HistoryVerb::Reword);
    reword.message = Some("Mark the ledger release".to_string());
    let args = plan(
        &root,
        &base,
        &again,
        vec![
            step(&first, HistoryVerb::Pick),
            reword,
            step(&revert, HistoryVerb::Drop),
            step(&again, HistoryVerb::Pick),
        ],
    );
    let result = trial(&args, &slug("empty-commits"), false).unwrap();
    let check = result.check.clone().unwrap();
    assert!(check.is_passed, "{:?}", check.problems);
    let head = result.head.unwrap();
    assert_eq!(
        subjects(&root, &format!("{base}..{head}")),
        vec!["again", "Mark the ledger release", "first"]
    );
    let prediction = predict(&args).unwrap();
    assert_eq!(prediction.steps[3].outcome, StepOutcome::Empty);
    assert!(prediction.steps[3].new_sha.is_some());
}
