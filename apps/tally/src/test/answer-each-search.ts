import { CommandError, type Runner } from "@/lib/exec";

type SearchError = { message: string; path: string[] };

function argValue(args: string[], name: string): string | undefined {
  return args.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1);
}

function singleSearchArgs(args: string[], index: number): string[] {
  const after = argValue(args, `after${index}`);
  return [
    "api",
    "graphql",
    "-f",
    `query=${argValue(args, "query") ?? ""}`,
    "-f",
    `search=${argValue(args, `search${index}`) ?? ""}`,
    ...(after === undefined ? [] : ["-f", `after=${after}`]),
  ];
}

export function answerEachSearch(answerOne: Runner): Runner {
  return async (command, args) => {
    const searchCount = args.filter((arg) => /^search\d+=/.test(arg)).length;
    if (searchCount === 0) return answerOne(command, args);
    const pages: Record<string, unknown> = {};
    const errors: SearchError[] = [];
    for (let index = 0; index < searchCount; index += 1) {
      const alias = `search${index}`;
      try {
        pages[alias] = JSON.parse(
          await answerOne(command, singleSearchArgs(args, index)),
        ).data.search;
      } catch (failure) {
        pages[alias] = null;
        errors.push({
          message: failure instanceof Error ? failure.message : String(failure),
          path: [alias],
        });
      }
    }
    if (errors.length === 0) return JSON.stringify({ data: pages });
    throw new CommandError(
      command,
      args,
      `gh: ${errors[0].message}`,
      JSON.stringify({ data: pages, errors }),
    );
  };
}
