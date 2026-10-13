import fs from 'node:fs'
import path from 'node:path'
import { collectRoutes, webRoot, SITE_URL } from './seo-routes.mjs'

const publicDir = path.join(webRoot, 'public')
const routes = collectRoutes()

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes
  .map(
    (r) => `  <url>
    <loc>${SITE_URL}${r.path}</loc>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority}</priority>
  </url>`,
  )
  .join('\n')}
</urlset>
`

const robots = `User-agent: *
Allow: /
Disallow: /api/

Sitemap: ${SITE_URL}/sitemap.xml
`

fs.mkdirSync(publicDir, { recursive: true })
fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), sitemap)
fs.writeFileSync(path.join(publicDir, 'robots.txt'), robots)
console.log(
  `[gen-seo] sitemap.xml (${routes.length} urls) + robots.txt -> public/ (SITE_URL=${SITE_URL})`,
)
