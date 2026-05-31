use portable_pty::CommandBuilder;

/// Run `command` through the platform shell, non-interactively.
/// Unix: bash -c <command>.  Windows: cmd /C <command>.
pub fn command_in_shell(command: &str) -> CommandBuilder {
    #[cfg(windows)]
    {
        let mut cmd = CommandBuilder::new("cmd");
        cmd.arg("/C");
        cmd.arg(command);
        cmd
    }
    #[cfg(not(windows))]
    {
        let mut cmd = CommandBuilder::new("bash");
        cmd.arg("-c");
        cmd.arg(command);
        cmd
    }
}

/// Interactive login shell for the embedded terminal.
/// Unix: bash -l -i.  Windows: cmd.exe.
pub fn interactive_shell() -> CommandBuilder {
    #[cfg(windows)]
    {
        CommandBuilder::new("cmd")
    }
    #[cfg(not(windows))]
    {
        let mut cmd = CommandBuilder::new("bash");
        cmd.arg("-l");
        cmd.arg("-i");
        cmd
    }
}
