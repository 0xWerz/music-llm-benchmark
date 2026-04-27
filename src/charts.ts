import { mkdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import type { ChartConfiguration } from "chart.js";
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

const palette = {
  ink: "#1f252b",
  muted: "#69717a",
  grid: "#e4e8ee",
  green: "#10b981",
  amber: "#f59e0b",
  red: "#ef4444",
  blue: "#3b82f6",
  purple: "#8b5cf6"
};

export async function writeCharts(outDir: string, results: BenchResult[]): Promise<ChartPaths> {
  const chartDir = join(outDir, "charts");
  await mkdir(chartDir, { recursive: true });

  const overview = join(chartDir, "score-overview.png");
  await writeFile(overview, await renderOverview(results));

  const breakdowns = new Map<string, string>();
  for (const result of results) {
    const name = `${safeName(result.model)}--${safeName(result.taskId)}--breakdown.png`;
    const path = join(chartDir, name);
    await writeFile(path, await renderBreakdown(result));
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

async function renderOverview(results: BenchResult[]): Promise<Buffer> {
  const canvas = chartCanvas(760, 1100);
  const modelScores = summarizeModels(results);

  const config: ChartConfiguration<"bar"> = {
    type: "bar",
    data: {
      labels: modelScores.map((result) => result.model),
      datasets: [{
        label: "Overall score",
        data: modelScores.map((result) => result.percent),
        backgroundColor: modelScores.map((result, index) => colorFor(result.percent, index)),
        borderRadius: 18,
        borderSkipped: false,
        barThickness: 70
      }]
    },
    options: {
      indexAxis: "y",
      responsive: false,
      layout: { padding: { top: 46, right: 42, bottom: 38, left: 34 } },
      plugins: {
        title: {
          display: true,
          text: "Overall Music Benchmark",
          align: "start",
          color: palette.ink,
          font: { size: 34, weight: "bold", family: "Helvetica Neue" },
          padding: { bottom: 28 }
        },
        legend: { display: false },
        tooltip: { enabled: false }
      },
      scales: {
        x: {
          min: 0,
          max: 100,
          grid: { color: palette.grid },
          border: { display: false },
          ticks: {
            color: palette.muted,
            callback: (value) => `${value}%`,
            font: { size: 14, family: "Helvetica Neue" }
          }
        },
        y: {
          grid: { display: false },
          border: { display: false },
          ticks: {
            color: palette.ink,
            font: { size: 20, weight: "bold", family: "Helvetica Neue" }
          }
        }
      }
    },
    plugins: [backgroundPlugin(), valueLabelPlugin("%")]
  };

  return canvas.renderToBuffer(config, "image/png");
}

async function renderBreakdown(result: BenchResult): Promise<Buffer> {
  const canvas = chartCanvas(760, 980);
  const values = CATEGORIES.map((category) => round(result.breakdown[category]));

  const config: ChartConfiguration<"bar"> = {
    type: "bar",
    data: {
      labels: CATEGORIES.map(pretty),
      datasets: [{
        label: result.taskId,
        data: values,
        backgroundColor: values.map((value, index) => colorFor(value * 10, index)),
        borderRadius: 14,
        borderSkipped: false,
        barThickness: 42
      }]
    },
    options: {
      indexAxis: "y",
      responsive: false,
      layout: { padding: { top: 42, right: 44, bottom: 34, left: 30 } },
      plugins: {
        title: {
          display: true,
          text: `${result.model} · ${result.taskId}`,
          align: "start",
          color: palette.ink,
          font: { size: 24, weight: "bold", family: "Helvetica Neue" },
          padding: { bottom: 22 }
        },
        subtitle: {
          display: true,
          text: `${round(result.score)}/70`,
          align: "start",
          color: palette.muted,
          font: { size: 18, family: "Helvetica Neue" },
          padding: { bottom: 24 }
        },
        legend: { display: false },
        tooltip: { enabled: false }
      },
      scales: {
        x: {
          min: 0,
          max: 10,
          grid: { color: palette.grid },
          border: { display: false },
          ticks: {
            color: palette.muted,
            stepSize: 2,
            font: { size: 13, family: "Helvetica Neue" }
          }
        },
        y: {
          grid: { display: false },
          border: { display: false },
          ticks: {
            color: palette.ink,
            font: { size: 16, weight: "bold", family: "Helvetica Neue" }
          }
        }
      }
    },
    plugins: [backgroundPlugin(), valueLabelPlugin("/10")]
  };

  return canvas.renderToBuffer(config, "image/png");
}

function chartCanvas(width: number, height: number): ChartJSNodeCanvas {
  return new ChartJSNodeCanvas({
    width,
    height,
    backgroundColour: "#ffffff"
  });
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
      average: round(average),
      percent: Math.round((average / 70) * 100)
    };
  }).sort((a, b) => b.percent - a.percent);
}

function backgroundPlugin() {
  return {
    id: "background",
    beforeDraw: (chart: any) => {
      const { ctx, width, height } = chart;
      ctx.save();
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
  };
}

function valueLabelPlugin(suffix: "%" | "/10") {
  return {
    id: `value-label-${suffix}`,
    afterDatasetsDraw: (chart: any) => {
      const { ctx } = chart;
      const meta = chart.getDatasetMeta(0);
      const values = chart.data.datasets[0].data as number[];
      ctx.save();
      ctx.fillStyle = palette.ink;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.font = "700 18px Helvetica Neue";
      meta.data.forEach((bar: any, index: number) => {
        const value = values[index]!;
        const label = suffix === "%" ? `${value}%` : `${round(value)}${suffix}`;
        ctx.fillText(label, bar.x + 12, bar.y);
      });
      ctx.restore();
    }
  };
}

function colorFor(value: number, index: number): string {
  if (value < 55) return palette.red;
  if (value < 80) return palette.amber;
  return [palette.green, palette.blue, palette.purple][index % 3]!;
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
