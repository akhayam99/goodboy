use crate::integrations::http::require_secure_scheme;

const TRUSTED_HOSTS: [&str; 6] = [
    "meet.google.com",
    "teams.microsoft.com",
    "teams.live.com",
    "whereby.com",
    "discord.com",
    "app.slack.com",
];
const TRUSTED_HOST_SUFFIXES: [&str; 2] = ["zoom.us", "webex.com"];
const SLACK_HOST: &str = "app.slack.com";
const SLACK_HUDDLE_PATH: &str = "/huddle";
const LINK_START: &str = "https://";
const LINK_ENDS: [char; 9] = ['<', '>', '"', '\'', '(', ')', '[', ']', '|'];
const LINK_TRAILERS: [char; 6] = ['.', ',', ';', ':', '!', '?'];

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct CallLink {
    pub url: String,
    pub is_trusted: bool,
}

pub(crate) fn https_url(text: &str) -> Option<reqwest::Url> {
    let text = text.trim();
    if require_secure_scheme(text).is_err() {
        return None;
    }
    let url = reqwest::Url::parse(text).ok()?;
    if url.scheme() != "https" || url.host_str().is_none() {
        return None;
    }
    Some(url)
}

fn host_is_on_the_list(host: &str) -> bool {
    let host = host.to_ascii_lowercase();
    if TRUSTED_HOSTS.contains(&host.as_str()) {
        return true;
    }
    TRUSTED_HOST_SUFFIXES
        .iter()
        .any(|suffix| host == *suffix || host.ends_with(&format!(".{suffix}")))
}

pub(crate) fn is_trusted_call_url(url: &reqwest::Url) -> bool {
    let Some(host) = url.host_str() else {
        return false;
    };
    if !host_is_on_the_list(host) {
        return false;
    }
    if host.eq_ignore_ascii_case(SLACK_HOST) {
        return url.path().starts_with(SLACK_HUDDLE_PATH);
    }
    true
}

fn links_in(text: &str) -> impl Iterator<Item = &str> {
    text.match_indices(LINK_START).map(move |(index, _)| {
        let rest = &text[index..];
        let end = rest
            .find(|character: char| character.is_whitespace() || LINK_ENDS.contains(&character))
            .unwrap_or(rest.len());
        rest[..end].trim_end_matches(LINK_TRAILERS)
    })
}

fn trusted_link_in(text: &str) -> Option<reqwest::Url> {
    links_in(text)
        .filter_map(https_url)
        .find(is_trusted_call_url)
}

pub(crate) fn call_link_of(
    conference: &[&str],
    location: Option<&str>,
    description: Option<&str>,
) -> Option<CallLink> {
    let from_conference = conference
        .iter()
        .find_map(|field| https_url(field).or_else(|| links_in(field).find_map(https_url)));
    let url = from_conference.or_else(|| {
        [location, description]
            .into_iter()
            .flatten()
            .find_map(trusted_link_in)
    })?;
    Some(CallLink {
        is_trusted: is_trusted_call_url(&url),
        url: url.to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn url(text: &str) -> reqwest::Url {
        reqwest::Url::parse(text).unwrap()
    }

    #[test]
    fn the_allowlist_holds_the_call_hosts_and_nothing_near_them() {
        for listed in [
            "https://meet.google.com/abc-defg-hij",
            "https://northwind.zoom.us/j/123",
            "https://zoom.us/j/123",
            "https://teams.microsoft.com/l/meetup-join/1",
            "https://teams.live.com/meet/1",
            "https://acme.webex.com/meet/ana",
            "https://whereby.com/harborline",
            "https://app.slack.com/huddle/T1/C1",
            "https://discord.com/channels/1/2",
        ] {
            assert!(is_trusted_call_url(&url(listed)), "{listed}");
        }
        for refused in [
            "https://meet.google.com.evil.example/abc",
            "https://notzoom.us/j/1",
            "https://zoom.us.evil.example/j/1",
            "https://app.slack.com/client/T1/C1",
            "https://calendar.northwind.example/join",
            "https://evilwebex.com/meet",
        ] {
            assert!(!is_trusted_call_url(&url(refused)), "{refused}");
        }
    }

    #[test]
    fn only_https_links_count() {
        assert!(https_url("https://meet.google.com/abc").is_some());
        for refused in [
            "http://meet.google.com/abc",
            "http://localhost:8080/call",
            "javascript:alert(1)",
            "ftp://acme.example/file",
            "meet.google.com/abc",
            "",
        ] {
            assert!(https_url(refused).is_none(), "{refused}");
        }
    }

    #[test]
    fn the_conference_field_wins_over_location_and_description() {
        let link = call_link_of(
            &["https://northwind.zoom.us/j/999"],
            Some("https://meet.google.com/aaa-bbbb-ccc"),
            None,
        )
        .unwrap();
        assert_eq!(link.url, "https://northwind.zoom.us/j/999");
        assert!(link.is_trusted);
    }

    #[test]
    fn a_conference_link_on_an_unknown_host_is_kept_but_not_trusted() {
        let link = call_link_of(&["https://video.cascadia.example/room/7"], None, None).unwrap();
        assert_eq!(link.url, "https://video.cascadia.example/room/7");
        assert!(!link.is_trusted);
    }

    #[test]
    fn a_known_host_is_found_inside_the_location_or_the_description() {
        let link = call_link_of(
            &[],
            Some("Room Harborline"),
            Some("Agenda first.\nJoin: <https://meet.google.com/abc-defg-hij>. Thanks"),
        )
        .unwrap();
        assert_eq!(link.url, "https://meet.google.com/abc-defg-hij");
        assert!(link.is_trusted);
    }

    #[test]
    fn an_unknown_link_in_the_description_is_not_a_call_link() {
        assert_eq!(
            call_link_of(
                &[],
                None,
                Some("Docs at https://wiki.acme.example/plan and http://meet.google.com/x")
            ),
            None
        );
    }

    #[test]
    fn a_plain_http_conference_field_is_dropped() {
        assert_eq!(
            call_link_of(&["http://northwind.zoom.us/j/1"], None, None),
            None
        );
    }
}
