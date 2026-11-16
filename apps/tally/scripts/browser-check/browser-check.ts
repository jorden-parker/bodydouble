import path from "node:path";

const BASE_URL = "http://127.0.0.1:4488";
const DEFAULT_PATHS = ["/", "/work", "/tickets", "/settings"];
const SCREENSHOTS_FLAG = "--screenshots";
const VIEWPORT_FLAG = "--viewport";
const VIEWPORT_PATTERN = /^(\d+)x(\d+)$/;
const PROBLEM_INDENT = "     - ";

export interface PageObservation {
  status: number | null;
  title: string;
  visibleText: string;
  consoleErrors: string[];
  uncaughtErrors: string[];
  failedRequests: string[];
  errorOverlay: string | null;
  scrollContainers: string[];
}

export interface BrowserSession {
  signIn(loginUrl: string): Promise<void>;
  visit(url: string, screenshotPath: string): Promise<PageObservation>;
  close(): Promise<void>;
}

export interface RunningServer {
  stop(): Promise<void>;
}

export interface CheckDependencies {
  startServer(): Promise<RunningServer>;
  readAccessToken(): string | null;
  openBrowser(): Promise<BrowserSession>;
  report(line: string): void;
}

export interface Viewport {
  width: number;
  height: number;
}

export interface CheckOptions {
  baseUrl: string;
  paths: string[];
  screenshotDirectory: string;
  viewport: Viewport;
}

const DEFAULT_VIEWPORT: Viewport = { width: 1280, height: 900 };

function findResponseProblems(status: number | null): string[] {
  if (status === null) return ["did not respond"];
  return status >= 400 ? [`responded with HTTP ${status}`] : [];
}

export function findPageProblems(observation: PageObservation): string[] {
  return [
    ...findResponseProblems(observation.status),
    ...(observation.visibleText.trim() === "" ? ["rendered no visible text"] : []),
    ...observation.consoleErrors.map((text) => `console error: ${text}`),
    ...observation.uncaughtErrors.map((text) => `uncaught error: ${text}`),
    ...observation.failedRequests.map((text) => `failed request: ${text}`),
    ...observation.scrollContainers.map((text) => `unexpected scrollbar: ${text}`),
    ...(observation.errorOverlay ? [`Next.js error overlay: ${observation.errorOverlay}`] : []),
  ];
}

export function nameScreenshotFile(pagePath: string): string {
  const slug = pagePath.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `${slug || "home"}.png`;
}

function requireAppPath(candidate: string): string {
  if (!candidate.startsWith("/")) {
    throw new Error(`Expected a path starting with "/", got "${candidate}"`);
  }
  return candidate;
}

function takeFlag(
  commandLineArguments: string[],
  flag: string,
): { value: string | undefined; rest: string[] } {
  const flagIndex = commandLineArguments.indexOf(flag);
  if (flagIndex === -1) return { value: undefined, rest: commandLineArguments };
  return {
    value: commandLineArguments[flagIndex + 1],
    rest: commandLineArguments.toSpliced(flagIndex, 2),
  };
}

function parseViewport(candidate: string | undefined): Viewport {
  const match = VIEWPORT_PATTERN.exec(candidate ?? "");
  if (!match) throw new Error(`Expected a viewport like 1024x768, got "${candidate}"`);
  return { width: Number(match[1]), height: Number(match[2]) };
}

export function parseCheckOptions(
  commandLineArguments: string[],
  defaultScreenshotDirectory: string,
): CheckOptions {
  const screenshots = takeFlag(commandLineArguments, SCREENSHOTS_FLAG);
  const viewport = takeFlag(screenshots.rest, VIEWPORT_FLAG);
  const paths = viewport.rest.map(requireAppPath);
  return {
    baseUrl: BASE_URL,
    paths: paths.length > 0 ? paths : DEFAULT_PATHS,
    screenshotDirectory: screenshots.value ?? defaultScreenshotDirectory,
    viewport: viewport.value === undefined ? DEFAULT_VIEWPORT : parseViewport(viewport.value),
  };
}

function describeVisit(
  pagePath: string,
  observation: PageObservation,
  screenshotPath: string,
): string[] {
  const problems = findPageProblems(observation);
  const verdict = problems.length === 0 ? "ok  " : "FAIL";
  const status = observation.status === null ? "no response" : `HTTP ${observation.status}`;
  return [
    `${verdict} ${pagePath} (${status}, title "${observation.title}") screenshot: ${screenshotPath}`,
    ...problems.map((problem) => `${PROBLEM_INDENT}${problem}`),
  ];
}

async function visitPaths(
  options: CheckOptions,
  session: BrowserSession,
  report: (line: string) => void,
): Promise<boolean> {
  let isHealthy = true;
  for (const pagePath of options.paths) {
    const screenshotPath = path.join(options.screenshotDirectory, nameScreenshotFile(pagePath));
    const observation = await session.visit(`${options.baseUrl}${pagePath}`, screenshotPath);
    const reportLines = describeVisit(pagePath, observation, screenshotPath);
    reportLines.forEach(report);
    isHealthy = isHealthy && reportLines.length === 1;
  }
  return isHealthy;
}

async function signInAndVisitPaths(
  options: CheckOptions,
  token: string,
  dependencies: CheckDependencies,
): Promise<boolean> {
  const session = await dependencies.openBrowser();
  try {
    await session.signIn(`${options.baseUrl}/?token=${token}`);
    return await visitPaths(options, session, dependencies.report);
  } finally {
    await session.close();
  }
}

export async function runBrowserCheck(
  options: CheckOptions,
  dependencies: CheckDependencies,
): Promise<boolean> {
  const server = await dependencies.startServer();
  try {
    const token = dependencies.readAccessToken();
    if (!token) {
      dependencies.report("FAIL no access token found; the server has not issued one");
      return false;
    }
    return await signInAndVisitPaths(options, token, dependencies);
  } finally {
    await server.stop();
  }
}
