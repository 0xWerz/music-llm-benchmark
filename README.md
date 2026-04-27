# Music LLM Benchmark

This checks whether a model can make a usable music plan, not whether it can write a perfect hit song.

It scores valid output, prompt following, music theory, rhythm, arrangement changes, and revision quality.

## Run

```bash
cp .env.example .env.local
bun run bench:kimi
```

Results are saved in `benchmark-runs/<timestamp>/`.

## Latest Result

![Overall result](docs/latest/score-overview.png)

Breakdowns:

![Kimi dream pop breakdown](docs/latest/kimi-k2.6--dream-pop-arrangement--breakdown.png)

![Kimi revision repair breakdown](docs/latest/kimi-k2.6--revision-repair--breakdown.png)

![Qwen dream pop breakdown](docs/latest/qwen3.5-plus--dream-pop-arrangement--breakdown.png)

![Qwen revision repair breakdown](docs/latest/qwen3.5-plus--revision-repair--breakdown.png)
