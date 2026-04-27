import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { relativeChartPath, resultKey, writeCharts } from "./charts";
import type { BenchResult } from "./types";

const runDirArg = Bun.argv[2];
if (!runDirArg) {
  console.error("Usage: bun run charts benchmark-runs/<timestamp>");
  process.exit(1);
}

const outDir = resolve(process.cwd(), runDirArg);
const results = JSON.parse(await readFile(join(outDir, "results.json"), "utf8")) as BenchResult[];
const charts = await writeCharts(outDir, results);

const lines = ["# Music LLM Benchmark Results", "", "![Score overview](charts/score-overview.svg)", ""];
for (const result of results) {
  const breakdown = charts.breakdowns.get(resultKey(result));
  lines.push(`## ${result.model} / ${result.taskId}`, "", `Score: ${result.score}/70`, "");
  if (breakdown) lines.push(`![Score breakdown](${relativeChartPath(outDir, breakdown)})`, "");
  if (result.errors.length) {
    lines.push("Errors / warnings:");
    for (const error of result.errors) lines.push(`- ${error}`);
    lines.push("");
  }
}

await writeFile(join(outDir, "summary.md"), `${lines.join("\n")}\n`);
console.log(`Wrote charts to ${join(outDir, "charts")}`);
