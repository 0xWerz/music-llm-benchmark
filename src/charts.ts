import { mkdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import type { BenchResult, ScoreBreakdown } from "./types";

export type ChartPaths = {
  overview: string;
  breakdowns: Map<string, string>;
};

const CATEGORIES: Array<keyof ScoreBreakdown> = [
  "validJson",
  "schema",
  "promptFit",
  "theory",
  "arrangement",
  "rhythm",
  "editability"
];

export async function writeCharts(outDir: string, results: BenchResult[]): Promise<ChartPaths> {
  const chartDir = join(outDir, "charts");
  await mkdir(chartDir, { recursive: true });

  const overview = join(chartDir, "score-overview.svg");
  await writeFile(overview, renderOverview(results));

  const breakdowns = new Map<string, string>();
  for (const result of results) {
    const name = `${safeName(result.model)}--${safeName(result.taskId)}--breakdown.svg`;
    const path = join(chartDir, name);
    await writeFile(path, renderBreakdown(result));
    breakdowns.set(resultKey(result), path);
  }

  return { overview, breakdowns };
}

export function resultKey(result: Pick<BenchResult, "model" | "taskId">): string {
  return `${result.model}::${result.taskId}`;
}

export function relativeChartPath(outDir: string, path: string): string {
  return `charts/${basename(path)}`;
}

function renderOverview(results: BenchResult[]): string {
  const width = 620;
  const height = 760;
  const margin = { top: 92, right: 54, bottom: 46, left: 54 };
  const plotW = width - margin.left - margin.right;
  const modelScores = summarizeModels(results);
  const rowH = 180;

  const bars = modelScores.map((result, i) => {
    const y = margin.top + i * rowH;
    const h = 64;
    const w = (result.percent / 100) * plotW;
    const color = result.percent >= 86 ? "#2f8f6b" : result.percent >= 60 ? "#d89428" : "#b84a42";
    return `
      <text x="${margin.left}" y="${y}" class="model">${escapeXml(result.model)}</text>
      <text x="${width - margin.right}" y="${y}" text-anchor="end" class="big">${result.percent}%</text>
      <rect x="${margin.left}" y="${y + 34}" width="${plotW}" height="${h}" rx="20" fill="#e8dfcf"/>
      <rect x="${margin.left}" y="${y + 34}" width="${w}" height="${h}" rx="20" fill="${color}"/>
      <text x="${margin.left}" y="${y + 126}" class="sub">${result.average}/70 average across tasks</text>
    `;
  }).join("\n");

  return svg(width, height, `
    <text x="${margin.left}" y="42" class="title">Music Benchmark</text>
    <text x="${margin.left}" y="68" class="subtitle">Overall result by model</text>
    ${bars}
  `);
}

function summarizeModels(results: BenchResult[]): Array<{ model: string; average: number; percent: number }> {
  const byModel = new Map<string, BenchResult[]>();
  for (const result of results) {
    byModel.set(result.model, [...(byModel.get(result.model) ?? []), result]);
  }
  return [...byModel.entries()].map(([model, modelResults]) => {
    const average = modelResults.reduce((sum, result) => sum + result.score, 0) / modelResults.length;
    return {
      model,
      average: Math.round(average * 10) / 10,
      percent: Math.round((average / 70) * 100)
    };
  }).sort((a, b) => b.percent - a.percent);
}

function renderBreakdown(result: BenchResult): string {
  const width = 620;
  const height = 610;
  const margin = { top: 92, right: 54, bottom: 40, left: 54 };
  const rowH = 62;
  const barW = width - margin.left - margin.right;

  const rows = CATEGORIES.map((category, i) => {
    const value = result.breakdown[category];
    const y = margin.top + i * rowH;
    const w = (value / 10) * barW;
    const color = value >= 9 ? "#2f8f6b" : value >= 6 ? "#d89428" : "#b84a42";
    return `
      <text x="${margin.left}" y="${y}" class="label">${pretty(category)}</text>
      <text x="${width - margin.right}" y="${y}" text-anchor="end" class="score">${round(value)}/10</text>
      <rect x="${margin.left}" y="${y + 12}" width="${barW}" height="24" rx="12" fill="#e8dfcf"/>
      <rect x="${margin.left}" y="${y + 12}" width="${w}" height="24" rx="12" fill="${color}"/>
    `;
  }).join("\n");

  return svg(width, height, `
    <text x="${margin.left}" y="38" class="title">${escapeXml(result.model)}</text>
    <text x="${margin.left}" y="64" class="subtitle">${escapeXml(result.taskId)} · ${round(result.score)}/70</text>
    ${rows}
  `);
}

function svg(width: number, height: number, body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">
  <style>
    svg { background: #f7f0e5; }
    .title { font: 700 30px Georgia, serif; fill: #2e2823; }
    .subtitle { font: 500 15px Georgia, serif; fill: #6d6254; }
    .model { font: 700 22px Georgia, serif; fill: #2e2823; }
    .big { font: 700 38px Georgia, serif; fill: #2e2823; }
    .label { font: 600 15px Georgia, serif; fill: #3e362d; }
    .sub { font: 500 13px Georgia, serif; fill: #6d6254; }
    .score { font: 700 14px Georgia, serif; fill: #2e2823; }
  </style>
  ${body}
</svg>
`;
}

function pretty(key: string): string {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function safeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
