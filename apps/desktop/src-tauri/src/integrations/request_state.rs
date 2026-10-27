use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum RequestState {
    Open,
    Merged,
    Closed,
    Draft,
    #[default]
    Unknown,
}

impl RequestState {
    #[cfg(test)]
    pub(crate) const ALL: [RequestState; 5] = [
        RequestState::Open,
        RequestState::Merged,
        RequestState::Closed,
        RequestState::Draft,
        RequestState::Unknown,
    ];
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_wire_names_are_lowercase_and_distinct() {
        let names: Vec<String> = RequestState::ALL
            .iter()
            .map(|state| {
                serde_json::to_value(state)
                    .unwrap()
                    .as_str()
                    .unwrap()
                    .to_string()
            })
            .collect();
        assert_eq!(names, vec!["open", "merged", "closed", "draft", "unknown"]);
    }

    #[test]
    fn an_unmapped_state_defaults_to_the_visible_unknown_arm() {
        assert_eq!(RequestState::default(), RequestState::Unknown);
    }
}
