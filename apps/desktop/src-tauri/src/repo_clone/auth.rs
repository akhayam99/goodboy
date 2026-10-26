use super::source::CloneHost;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ProbeCall {
    pub(crate) binary: &'static str,
    pub(crate) args: Vec<String>,
    pub(crate) input: Option<String>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub(crate) struct ProbeOutput {
    pub(crate) is_success: bool,
    pub(crate) stdout: String,
    pub(crate) stderr: String,
}

pub(crate) type Runner<'a> = &'a dyn Fn(&ProbeCall) -> Option<ProbeOutput>;

fn cli_call(binary: &'static str, host: CloneHost) -> ProbeCall {
    ProbeCall {
        binary,
        args: vec![
            "auth".to_string(),
            "status".to_string(),
            "--hostname".to_string(),
            host.domain().to_string(),
        ],
        input: None,
    }
}

fn credential_call(host: CloneHost) -> ProbeCall {
    ProbeCall {
        binary: "git",
        args: vec!["credential".to_string(), "fill".to_string()],
        input: Some(format!("protocol=https\nhost={}\n\n", host.domain())),
    }
}

pub(crate) fn login_tool(host: CloneHost, run: Runner<'_>) -> Option<&'static str> {
    match host.cli() {
        Some(binary) => run(&cli_call(binary, host))
            .filter(|output| output.is_success)
            .map(|_| binary),
        None => run(&credential_call(host))
            .filter(|output| output.is_success && output.stdout.contains("password="))
            .map(|_| "git"),
    }
}
