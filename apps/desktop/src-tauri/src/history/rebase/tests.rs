use super::{rebase_plan, RebasePlan};
use crate::history::fixtures::{branch, commit, git_ok, init_repo, step, with_remote};
use crate::history::predict::predict;
use crate::history::types::{HistoryPlanArgs, HistoryVerb, StepOutcome};
use std::path::Path;

#[test]
fn a_rebase_plan_lists_the_branch_commits_onto_origin() {
    let b = branch("rebase-plan");
    with_remote(&b);
    git_ok(&b.root, &["checkout", "main"]);
    let upstream = commit(&b.root, "readme.txt", "hello\n", "main moves on");
    git_ok(&b.root, &["push", "origin", "main"]);
    git_ok(&b.root, &["checkout", "feature"]);
    let plan = rebase_plan(&b.root, Some("main"), true).unwrap();
    assert_eq!(plan.onto, upstream);
    assert_eq!(plan.onto_ref, "origin/main");
    assert_eq!(plan.merge_base, b.base);
    assert_eq!(plan.behind, 1);
    assert_eq!(
        plan.commits
            .iter()
            .map(|c| c.sha.clone())
            .collect::<Vec<_>>(),
        vec![b.a.clone(), b.b.clone(), b.c.clone()]
    );
    let args = plan_args_for_rebase(&b.root, &plan);
    let prediction = predict(&args).unwrap();
    assert!(prediction
        .steps
        .iter()
        .all(|step| step.outcome == StepOutcome::Clean));
}

#[test]
fn a_rebase_plan_without_a_named_base_rebases_onto_the_develop_branch() {
    let root = init_repo("rebase-plan-develop");
    git_ok(&root, &["branch", "-m", "main", "develop"]);
    let base = commit(&root, "policy.txt", "one\n", "base");
    let work = root.join("wt-feature");
    git_ok(
        &root,
        &[
            "worktree",
            "add",
            "-b",
            "feature",
            work.to_str().unwrap(),
            "develop",
        ],
    );
    let own = commit(&work, "notes.txt", "notes\n", "C adds notes");
    let upstream = commit(&root, "readme.txt", "hello\n", "develop moves on");

    let plan = rebase_plan(&work, None, false).unwrap();

    assert_eq!(plan.onto_ref, "develop");
    assert_eq!(plan.onto, upstream);
    assert_eq!(plan.merge_base, base);
    assert_eq!(plan.behind, 1);
    assert_eq!(
        plan.commits
            .iter()
            .map(|c| c.sha.clone())
            .collect::<Vec<_>>(),
        vec![own]
    );
}

fn plan_args_for_rebase(root: &Path, plan: &RebasePlan) -> HistoryPlanArgs {
    HistoryPlanArgs {
        worktree_path: root.to_string_lossy().into_owned(),
        base: plan.merge_base.clone(),
        head: plan.head.clone(),
        steps: plan
            .commits
            .iter()
            .map(|c| step(&c.sha, HistoryVerb::Pick))
            .collect(),
        onto: Some(plan.onto.clone()),
    }
}
