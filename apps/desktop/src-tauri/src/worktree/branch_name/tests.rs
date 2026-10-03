use super::{branch_name_problem, MAX_BRANCH_NAME_LEN};
use serde::Deserialize;

#[derive(Deserialize)]
struct BranchCase {
    name: String,
    input: String,
    problem: Option<String>,
}

#[derive(Deserialize)]
struct BranchFixture {
    #[serde(rename = "maxLength")]
    max_length: usize,
    cases: Vec<BranchCase>,
}

const BRANCH_FIXTURE: &str =
    include_str!("../../../../../../packages/core/src/slug/branch-name.fixture.json");

#[test]
fn matches_the_shared_fixture_the_typescript_validator_is_tested_against() {
    let fixture: BranchFixture = serde_json::from_str(BRANCH_FIXTURE).unwrap();

    assert_eq!(fixture.max_length, MAX_BRANCH_NAME_LEN);
    assert!(!fixture.cases.is_empty());
    for case in fixture.cases {
        assert_eq!(
            branch_name_problem(&case.input),
            case.problem.as_deref(),
            "case: {}",
            case.name
        );
    }
}
