// GitHub Pages has no SPA fallback: a hard load of a client-side route (e.g.
// /planoflife/settings) 404s unless a 404.html exists. Copy index.html to
// 404.html so GitHub serves the app shell for unknown paths and the router
// takes over. (start_url / in-app navigation are unaffected.)
import { copyFileSync } from 'node:fs'

copyFileSync('dist/index.html', 'dist/404.html')
console.log('postbuild: wrote dist/404.html (SPA deep-link fallback)')
