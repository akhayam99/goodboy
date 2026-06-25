import type { Skill } from '@goodboy/types'

export type SkillScriptRunner = {
  runScript(scriptPath: string, args: ReadonlyArray<string>, cwd: string): Promise<string>
}

export class SkillScriptError extends Error {
  constructor(
    message: string,
    public readonly stderr: string,
  ) {
    super(message)
    this.name = 'SkillScriptError'
  }
}

export class SkillExecutor {
  async resolve(input: {
    skill: Skill
    args: ReadonlyArray<string>
    workingDir: string
    runner?: SkillScriptRunner
  }): Promise<string> {
    const { skill, args, workingDir, runner } = input

    const skillDir = posixDirname(normalizePath(skill.filePath))
    const allowedPrefix = skillDir

    let body = substituteArgs(skill.body, args)

    const scripts = skill.frontmatter.scripts ?? []
    if (scripts.length > 0) {
      if (runner === undefined) {
        throw new Error('runner is required when skill has scripts')
      }

      for (const scriptEntry of scripts) {
        const scriptAbsPath = joinPaths(skillDir, scriptEntry)

        if (!isUnderPrefix(scriptAbsPath, allowedPrefix)) {
          throw new SkillScriptError(
            `path traversal detected: script "${scriptEntry}" resolves outside allowed prefix "${allowedPrefix}"`,
            '',
          )
        }

        const stdout = await runner.runScript(scriptAbsPath, args, workingDir)
        const varName = posixBasenameNoExt(scriptEntry)
        body = body.replaceAll(`{{script:${varName}}}`, stdout)
      }
    }

    return body
  }
}

function substituteArgs(body: string, args: ReadonlyArray<string>): string {
  return body.replace(/\{\{arg(\d+)\}\}/g, (_, indexStr: string) => {
    const index = parseInt(indexStr, 10)
    return args[index] ?? ''
  })
}

function normalizePath(p: string): string {
  const isAbsolute = p.startsWith('/')
  const parts = p.split('/').filter((s) => s.length > 0)
  const stack: string[] = []
  for (const part of parts) {
    if (part === '.') {
      continue
    }
    if (part === '..') {
      stack.pop()
    } else {
      stack.push(part)
    }
  }
  return (isAbsolute ? '/' : '') + stack.join('/')
}

function posixDirname(p: string): string {
  const slash = p.lastIndexOf('/')
  if (slash === -1) {
    return '.'
  }
  if (slash === 0) {
    return '/'
  }
  return p.slice(0, slash)
}

function joinPaths(base: string, rel: string): string {
  if (rel.startsWith('/')) {
    return normalizePath(rel)
  }
  return normalizePath(base + '/' + rel)
}

function isUnderPrefix(absPath: string, prefix: string): boolean {
  const normalized = normalizePath(absPath)
  const normalizedPrefix = normalizePath(prefix)
  return normalized === normalizedPrefix || normalized.startsWith(normalizedPrefix + '/')
}

function posixBasenameNoExt(p: string): string {
  const base = p.slice(p.lastIndexOf('/') + 1)
  const dot = base.lastIndexOf('.')
  return dot > 0 ? base.slice(0, dot) : base
}
