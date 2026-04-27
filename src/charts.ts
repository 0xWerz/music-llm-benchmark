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
  const width = 980;
  const height = 280;
  const margin = { top: 42, right: 30, bottom: 84, left: 58 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const barGap = 18;
  const barW = Math.max(44, (plotW - barGap * (results.length - 1)) / Math.max(1, results.length));

  const bars = results.map((result, i) => {
    const x = margin.left + i * (barW + barGap);
    const h = (result.score / 70) * plotH;
    const y = margin.top + plotH - h;
    const color = result.score >= 60 ? "#2f8f6b" : result.score >= 42 ? "#d89428" : "#b84a42";
    return `
      <rect x="${x}" y="${y}" width="${barW}" height="${h}" rx="10" fill="${color}"/>
      <text x="${x + barW / 2}" y="${y - 10}" text-anchor="middle" class="score">${result.score}/70</text>
      <text x="${x + barW / 2}" y="${height - 50}" text-anchor="middle" class="label">${escapeXml(result.model)}</text>
      <text x="${x + barW / 2}" y="${height - 31}" text-anchor="middle" class="sub">${escapeXml(result.taskId)}</text>
    `;
  }).join("\n");

  return svg(width, height, `
    <text x="32" y="30" class="title">Music Benchmark Score Overview</text>
    ${axis(margin.left, margin.top, plotW, plotH, 70)}
    ${bars}
  `);
}

function renderBreakdown(result: BenchResult): string {
  const width = 980;
  const height = 390;
  const margin = { top: 68, right: 48, bottom: 32, left: 150 };
  const rowH = 36;
  const barW = width - margin.left - margin.right;

  const rows = CATEGORIES.map((category, i) => {
    const value = result.breakdown[category];
    const y = margin.top + i * rowH;
    const w = (value / 10) * barW;
    const color = value >= 9 ? "#2f8f6b" : value >= 6 ? "#d89428" : "#b84a42";
    return `
      <text x="${margin.left - 16}" y="${y + 22}" text-anchor="end" class="label">${pretty(category)}</text>
      <rect x="${margin.left}" y="${y}" width="${barW}" height="24" rx="12" fill="#e8dfcf"/>
      <rect x="${margin.left}" y="${y}" width="${w}" height="24" rx="12" fill="${color}"/>
      <text x="${margin.left + barW + 14}" y="${y + 18}" class="score">${value}/10</text>
    `;
  }).join("\n");

  return svg(width, height, `
    <text x="32" y="30" class="title">${escapeXml(result.model)} / ${escapeXml(result.taskId)}</text>
    <text x="32" y="52" class="subtitle">Total: ${result.score}/70</text>
    ${rows}
  `);
}

function axis(x: number, y: number, w: number, h: number, max: number): string {
  const ticks = [0, 14, 28, 42, 56, 70];
  return `
    <line x1="${x}" y1="${y + h}" x2="${x + w}" y2="${y + h}" stroke="#837764" stroke-width="1"/>
    ${ticks.map((tick) => {
      const ty = y + h - (tick / max) * h;
      return `
        <line x1="${x - 5}" y1="${ty}" x2="${x + w}" y2="${ty}" stroke="#d8cdbc" stroke-width="1"/>
        <text x="${x - 12}" y="${ty + 4}" text-anchor="end" class="tick">${tick}</text>
      `;
    }).join("\n")}
  `;
}

function svg(width: number, height: number, body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">
  <style>
    svg { background: #f7f0e5; }
    .title { font: 700 22px Georgia, serif; fill: #2e2823; }
    .subtitle { font: 500 14px Georgia, serif; fill: #6d6254; }
    .label { font: 600 13px Georgia, serif; fill: #3e362d; }
    .sub { font: 500 12px Georgia, serif; fill: #6d6254; }
    .score { font: 700 13px Georgia, serif; fill: #2e2823; }
    .tick { font: 500 11px Georgia, serif; fill: #7b6f60; }
  </style>
  ${body}
</svg>
`;
}

function pretty(key: string): string {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
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
