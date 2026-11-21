# Notes for Claude

## Commits and pull requests

- Do **not** add any Claude/AI attribution to commits or pull requests: no
  `Co-Authored-By: Claude …` trailer, no `Claude-Session:` line, no
  "Generated with Claude Code" footer.
- Author commits as the repository owner:
  `Christian Jesus Alcazar <196662530+kauhla321@users.noreply.github.com>`
  (e.g. `git -c user.name="…" -c user.email="…" commit …`).

## Checks before pushing

```bash
npm ci
npx tsc --noEmit
npx eslint .
npx vitest run
npm run app:build
```

## Project notes

- The usage disclaimer text lives in `src/lib/legal.ts` (first-launch notice and
  Settings → about) and in the "Disclaimer" section of `README.md`. Keep them in sync.
- Don't add real copyrighted video URLs to code, tests, docs or screenshots; use dummy
  URLs or the owner's own / Creative Commons content.
