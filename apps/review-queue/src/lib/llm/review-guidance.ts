const GENERAL_RULES = `Review the design as a senior engineer, not only what the code does:
- SOLID: each unit has one reason to change; depend on small interfaces, not concrete details, where it matters.
- KISS: is there a simpler way that does the same job?
- YAGNI: flag options, parameters, abstractions or branches that nothing needs yet.
- Logic that repeats an existing helper elsewhere in the repo, dead or unused code, unclear names, functions doing more than one thing.
- Errors handled at the boundaries; new behaviour covered by tests.
Prefer a few real problems over many nitpicks. Say which affect correctness and which are taste.
Do not invent problems: when the code is fine, say so.`;

const DEPENDENCY_UPDATE_RULES = `This pull request is an automated dependency update from Dependabot. Review it as a version bump, not as hand-written code:
- Versions: name each package with its old and new version, and say whether the bump is major, minor or patch. A major bump, or any bump of a 0.x package, may break callers.
- Changelog: read the release notes, changelog and commits in <pr_description>. Breaking changes, removed or renamed APIs, deprecations, changed defaults, and new requirements for the runtime or for peer dependencies matter most.
- Security: say when the notes name a fixed vulnerability (a CVE or GHSA id) and how severe it is. In the lockfile, flag a package resolved from a new registry or URL, a new install script, and added or changed packages that the named bump does not explain.
- Impact here: is it a runtime dependency or a development-only one, and does this repository use what changed? When you can look up code, search for where the package is imported.
- Consistency: the manifest and the lockfile change together, and no package is left on two versions without a reason.
You cannot open links or read anything online. Use only the notes you are given: when they do not cover something, say so and name what the reviewer should read, such as the package's changelog between the two versions. Do not invent breaking changes, advisories or version numbers.`;

const TYPESCRIPT_RULES = `TypeScript and JavaScript:
- No \`any\`, unchecked \`as\` casts or non-null \`!\`; narrow \`unknown\` instead.
- Discriminated unions over loose optional fields or boolean flags; exhaustive \`switch\` with \`never\`.
- Immutable updates; \`readonly\` where data should not change.
- Validate external data (requests, JSON, env) at the boundary, for example with zod.
- Every promise awaited or its rejection handled.`;

const REACT_RULES = `React:
- Rules of hooks; effect dependency lists complete; effects clean up what they start.
- Derive values during render instead of copying them into state or syncing them with effects.
- Stable \`key\`s, not array indexes on lists that reorder.
- Keep logic out of components, in pure modules or hooks; state no higher than needed.
- Memoize only where it measurably helps.
- Accessible markup: real buttons and labels, alt text; no \`dangerouslySetInnerHTML\`.`;

const TYPESCRIPT_EXTENSION = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/i;
const REACT_EXTENSION = /\.(tsx|jsx)$/i;

export function dependencyNotesOf(pullRequest: {
  author: string;
  body: string;
}): string | undefined {
  return pullRequest.author === "dependabot[bot]" ? pullRequest.body : undefined;
}

export function reviewGuidance(paths: string[], isDependencyUpdate = false): string {
  return [
    isDependencyUpdate ? DEPENDENCY_UPDATE_RULES : GENERAL_RULES,
    ...(paths.some((path) => TYPESCRIPT_EXTENSION.test(path)) ? [TYPESCRIPT_RULES] : []),
    ...(paths.some((path) => REACT_EXTENSION.test(path)) ? [REACT_RULES] : []),
  ].join("\n\n");
}
