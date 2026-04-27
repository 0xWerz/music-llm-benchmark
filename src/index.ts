import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { callChatCompletion } from "./client";
import { scoreMusicIR, extractJson, isMusicIR } from "./scorer";
import { tasks } from "./tasks";
import { relativeChartPath, resultKey, writeCharts, type ChartPaths } from "./charts";
import type { BenchResult, MusicIR } from "./types";

const DEFAULT_BASE_URL = "https://opencode.ai/zen/go/v1/chat/completions";
const DEFAULT_MODELS = ["kimi-k2.6"];

async function main() {
  const apiKey = Bun.env.BENCH_API_KEY;
  if (!apiKey) {
    throw new Error("Missing BENCH_API_KEY. Put it in .env.local or export it before running.");
  }

  const baseUrl = Bun.env.BENCH_BASE_URL ?? DEFAULT_BASE_URL;
  const models = (Bun.env.BENCH_MODELS?.split(",") ?? DEFAULT_MODELS)
    .map((m) => m.trim())
    .filter(Boolean);

  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = join(process.cwd(), "benchmark-runs", runId);
  await mkdir(outDir, { recursive: true });

  const results: BenchResult[] = [];
  for (const model of models) {
    for (const task of tasks) {
      console.log(`Running ${model} / ${task.id}`);
      const rawPath = join(outDir, `${safeName(model)}--${task.id}.raw.txt`);
      const outputPath = join(outDir, `${safeName(model)}--${task.id}.music-ir.json`);

      try {
        const raw = await callChatCompletion({
          baseUrl,
          apiKey,
          model,
          temperature: 0.2,
          maxTokens: 8000,
          messages: [
            {
              role: "system",
              content: "You are a careful music production and composition agent. Follow constraints exactly and return machine-parseable JSON only."
            },
            { role: "user", content: task.prompt }
          ]
        });
        await writeFile(rawPath, raw);

        let parsed: unknown;
        let music: MusicIR | null = null;
        let parseOk = false;
        const parseErrors: string[] = [];
        try {
          parsed = extractJson(raw);
          parseOk = true;
          if (isMusicIR(parsed)) music = parsed;
          else parseErrors.push("Parsed JSON did not match MusicIR shape.");
        } catch (error) {
          parseErrors.push(error instanceof Error ? error.message : String(error));
        }

        if (music) await writeFile(outputPath, `${JSON.stringify(music, null, 2)}\n`);
        else await writeFile(outputPath, "{}\n");

        const scored = scoreMusicIR(music, task, parseOk);
        scored.errors.unshift(...parseErrors);
        results.push({
          model,
          taskId: task.id,
          score: scored.score,
          breakdown: scored.breakdown,
          errors: scored.errors,
          outputPath,
          rawPath
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await writeFile(rawPath, message);
        results.push({
          model,
          taskId: task.id,
          score: 0,
          breakdown: {
            validJson: 0,
            schema: 0,
            promptFit: 0,
            theory: 0,
            arrangement: 0,
            rhythm: 0,
            editability: 0
          },
          errors: [message],
          outputPath,
          rawPath
        });
      }
    }
  }

  await writeFile(join(outDir, "results.json"), `${JSON.stringify(results, null, 2)}\n`);
  const charts = await writeCharts(outDir, results);
  await writeFile(join(outDir, "summary.md"), renderSummary(results, outDir, charts));
  console.log(renderConsoleSummary(results, outDir));
}

function renderConsoleSummary(results: BenchResult[], outDir: string): string {
  const lines = ["", "Results:"];
  for (const result of results) {
    lines.push(`- ${result.model} / ${result.taskId}: ${result.score}/70`);
  }
  lines.push(`Saved: ${outDir}`);
  return lines.join("\n");
}

function renderSummary(results: BenchResult[], outDir: string, charts: ChartPaths): string {
  const lines = ["# Music LLM Benchmark Results", ""];
  lines.push("![Score overview](charts/score-overview.svg)");
  lines.push("");
  for (const result of results) {
    const breakdown = charts.breakdowns.get(resultKey(result));
    lines.push(`## ${result.model} / ${result.taskId}`);
    lines.push("");
    lines.push(`Score: ${result.score}/70`);
    lines.push("");
    if (breakdown) {
      lines.push(`![Score breakdown](${relativeChartPath(outDir, breakdown)})`);
      lines.push("");
    }
    if (result.errors.length) {
      lines.push("");
      lines.push("Errors / warnings:");
      for (const error of result.errors) lines.push(`- ${error}`);
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

function safeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
