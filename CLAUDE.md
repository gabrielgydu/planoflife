# Plano de Vida — project instructions

## Default: ship every change

Unless Gabriel says otherwise ("don't commit", "don't push", "hold off"), finishing a
change means shipping it. After verification passes, do all of this without asking:

1. `npm run build` (runs `tsc -b` + vite build + postbuild) — must be clean.
2. Commit on `master`. Message style: `Área: what changed`, matching the log
   (`Leitura do Novo Testamento: …`, `Rosário: …`, `Sync: …`, `Docs: …`).
   No `Claude-Session:` trailer.
3. `git push origin master`.
4. Publish = the push. `.github/workflows/deploy.yml` builds and deploys to GitHub
   Pages on every push to `master`. Watch it (`gh run watch`) and report the actual
   result — a push whose deploy failed is not shipped.

If a change touches the sync schema or a Dexie version, deploy and open/refresh the
app on both devices before the next publish — old clients strip unknown sync tables.
