use super::ExportGroups;

#[test]
fn default_groups_exclude_folder_paths_and_orchestrated_workflows() {
    let groups = ExportGroups::default();
    assert!(groups.workspaces);
    assert!(!groups.folder_paths);
    assert!(groups.workflows_yours);
    assert!(!groups.workflows_orchestrated);
}
