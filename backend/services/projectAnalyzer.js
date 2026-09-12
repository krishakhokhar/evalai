// Project ZIP analyzer (backend). Reads the actual uploaded archive in memory and
// derives structural metadata. Secret VALUES are never read into the result.
// Ported from the original frontend analyzer, with extraction safety guards.

import JSZip from 'jszip'

const TEXT_RE =
  /\.(js|jsx|ts|tsx|mjs|cjs|json|md|txt|css|scss|sass|less|html|vue|svelte|yml|yaml|xml|env|gitignore|toml|ini|cfg|conf|sql|py|java|rb|go|php|sh)$/i

const SECRET_RES = [
  /api[_-]?key\s*[:=]\s*['"][^'"]{6,}/i,
  /secret\s*[:=]\s*['"][^'"]{6,}/i,
  /password\s*[:=]\s*['"][^'"]{4,}/i,
  /(access|auth|bearer)[_-]?token\s*[:=]\s*['"][^'"]{8,}/i,
  /mongo_?uri\s*[:=]\s*['"][^'"]{8,}/i,
  /jwt_?secret\s*[:=]\s*['"][^'"]{4,}/i,
  /AKIA[0-9A-Z]{16}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /mongodb(?:\+srv)?:\/\/[^\s'"]*:[^\s'"]*@/i,
  /AIza[0-9A-Za-z_-]{20,}/,
]

// Extraction safety limits (zip-bomb / oversize protection)
const MAX_ENTRIES = 6000
const MAX_TOTAL_UNCOMPRESSED = 120 * 1024 * 1024 // 120 MB
const MAX_TEXT_BYTES = 200_000

function safePath(name) {
  // strip drive letters, leading slashes and any traversal segments
  return name
    .replace(/\\/g, '/')
    .replace(/^[a-zA-Z]:/, '')
    .replace(/^\/+/, '')
    .split('/')
    .filter((seg) => seg && seg !== '.' && seg !== '..')
    .join('/')
}

export function buildTree(paths, secretFiles = [], rootName = 'project.zip') {
  const root = { name: rootName, type: 'folder', children: [] }
  paths.forEach((p) => {
    const parts = p.split('/').filter(Boolean)
    let cur = root
    parts.forEach((part, i) => {
      const isFile = i === parts.length - 1
      let child = cur.children.find((c) => c.name === part)
      if (!child) {
        child = isFile
          ? {
              name: part,
              type: 'file',
              sensitive: secretFiles.some((s) => s === p || p.endsWith(s)),
            }
          : { name: part, type: 'folder', children: [] }
        cur.children.push(child)
      }
      cur = child
    })
  })
  const sortNode = (n) => {
    if (!n.children) return
    n.children.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    n.children.forEach(sortNode)
  }
  sortNode(root)
  return root
}

export function analyzeFiles(files, meta = {}) {
  const clean = files
    .map((f) => ({ ...f, path: safePath(f.path) }))
    .filter((f) => f.path && !f.path.startsWith('__MACOSX/'))

  const top = new Set(clean.map((f) => f.path.split('/')[0]))
  let rootName = meta.fileName || 'project.zip'
  let entries = clean
  if (top.size === 1 && clean.every((f) => f.path.includes('/'))) {
    const wrapper = [...top][0]
    rootName = `${wrapper}/`
    entries = clean.map((f) => ({ ...f, path: f.path.slice(wrapper.length + 1) }))
  }

  const paths = entries.map((f) => f.path)
  const lc = paths.map((p) => p.toLowerCase())
  const has = (re) => lc.some((p) => re.test(p))

  const folders = new Set()
  paths.forEach((p) => {
    const parts = p.split('/')
    parts.pop()
    let acc = ''
    parts.forEach((part) => {
      acc = acc ? `${acc}/${part}` : part
      folders.add(acc)
    })
  })

  const fileTypes = {}
  paths.forEach((p) => {
    const m = p.match(/\.[a-z0-9]+$/i)
    const ext = m ? m[0].toLowerCase() : '(none)'
    fileTypes[ext] = (fileTypes[ext] || 0) + 1
  })

  const pkgEntry = entries.find(
    (f) => /(^|\/)package\.json$/i.test(f.path) && f.content,
  )
  let packageJson = null
  if (pkgEntry) {
    try {
      const j = JSON.parse(pkgEntry.content)
      packageJson = {
        name: j.name || meta.projectName || 'project',
        dependencies: Object.keys({
          ...(j.dependencies || {}),
          ...(j.devDependencies || {}),
        }),
        scripts: Object.keys(j.scripts || {}),
      }
    } catch {
      packageJson = { name: meta.projectName || 'project', dependencies: [], scripts: [] }
    }
  }
  const deps = (packageJson?.dependencies || []).map((d) => d.toLowerCase())
  const dep = (n) => deps.some((d) => d === n || d.includes(n))

  const detected = {
    reactFrontend: dep('react') || has(/\.(jsx|tsx)$/) || has(/(^|\/)app\.(jsx|tsx)$/),
    nodeBackend:
      dep('express') ||
      dep('koa') ||
      dep('fastify') ||
      has(/(^|\/)server\.(js|ts)$/) ||
      (has(/(^|\/)app\.(js|ts)$/) && has(/routes?\//)),
    packageJson: !!pkgEntry,
    apiRoutes: has(/routes?\//) || has(/controllers?\//) || has(/(^|\/)api\//),
    database:
      has(/models?\//) ||
      has(/schema/) ||
      has(/(^|\/)db\.(js|ts)$/) ||
      has(/prisma/) ||
      has(/firebase/) ||
      has(/migrations?\//) ||
      dep('mongoose') ||
      dep('mongodb') ||
      dep('sequelize') ||
      dep('typeorm') ||
      dep('prisma') ||
      dep('pg') ||
      dep('mysql') ||
      dep('firebase'),
    readme: has(/(^|\/)readme(\.md)?$/),
  }

  const technologies = []
  if (detected.reactFrontend) technologies.push('React')
  if (dep('next')) technologies.push('Next.js')
  if (dep('vite') || has(/vite\.config\./)) technologies.push('Vite')
  if (dep('vue')) technologies.push('Vue')
  if (dep('@angular/core')) technologies.push('Angular')
  if (detected.nodeBackend) technologies.push('Node.js')
  if (dep('express')) technologies.push('Express')
  if (dep('mongoose') || dep('mongodb')) technologies.push('MongoDB')
  if (dep('firebase') || has(/firebase/)) technologies.push('Firebase')
  if (dep('sequelize') || dep('pg')) technologies.push('PostgreSQL')
  if (dep('mysql')) technologies.push('MySQL')
  if (dep('prisma')) technologies.push('Prisma')
  if (dep('jsonwebtoken') || has(/jwt/)) technologies.push('JWT')
  if (dep('tailwindcss')) technologies.push('Tailwind CSS')
  if (dep('typescript') || has(/\.tsx?$/)) technologies.push('TypeScript')
  if (has(/\brequirements\.txt$/) || has(/\.py$/)) technologies.push('Python')
  if (has(/manage\.py$/) || dep('django')) technologies.push('Django')
  if (has(/\bpom\.xml$/) || has(/\.java$/)) technologies.push('Java')
  if (technologies.length === 0) technologies.push('Unknown')

  const components = paths
    .filter((p) => /components?\/.+\.(jsx|tsx|js|ts|vue|svelte)$/i.test(p))
    .map((p) => p.split('/').pop())
  const pages = paths
    .filter((p) => /(pages|views|screens)\/.+\.(jsx|tsx|js|ts|vue|svelte)$/i.test(p))
    .map((p) => p.split('/').pop())
  const routes = paths.filter((p) => /routes?\/.+\.(js|ts)$/i.test(p)).map((p) => p.split('/').pop())
  const controllers = paths
    .filter((p) => /controllers?\/.+\.(js|ts)$/i.test(p))
    .map((p) => p.split('/').pop())
  const models = paths
    .filter((p) => /models?\/.+\.(js|ts)$/i.test(p))
    .map((p) => p.split('/').pop())

  const configFiles = paths.filter((p) =>
    /(^|\/)(package\.json|vite\.config\.[jt]s|webpack\.config\.js|tsconfig\.json|\.env(\.example)?|\.gitignore|dockerfile|\.eslintrc[.\w]*|next\.config\.[jt]s|tailwind\.config\.[jt]s)$/i.test(
      p,
    ),
  )

  const readmeEntry = entries.find(
    (f) => /(^|\/)readme(\.md)?$/i.test(f.path) && f.content != null,
  )
  const readmeText = readmeEntry?.content || ''
  const readme = {
    present: detected.readme,
    length: readmeText.length,
    hasSetup:
      /(npm install|yarn|pnpm|getting started|installation|setup|npm run|environment variable|\.env)/i.test(
        readmeText,
      ),
  }

  const largeFiles = entries
    .filter((f) => f.content != null)
    .filter((f) => f.content.length > 6000 || f.content.split('\n').length > 300)
    .map((f) => f.path)

  const secrets = []
  entries.forEach((f) => {
    if (f.content == null) return
    if (SECRET_RES.some((re) => re.test(f.content))) secrets.push({ file: f.path })
  })

  const mainFolders = [...folders].filter((f) => f.split('/').length <= 2).sort()

  // Real ".env" family files (not .env.example / .sample / .template) — rejected.
  const ENV_ALLOW = new Set(['.env.example', '.env.sample', '.env.template'])
  const envFiles = paths.filter((p) => {
    const base = (p.split('/').pop() || '').toLowerCase()
    return (base === '.env' || base.startsWith('.env.')) && !ENV_ALLOW.has(base)
  })

  const analysis = {
    projectName: meta.projectName || packageJson?.name || rootName.replace(/\/$/, ''),
    technologies,
    fileCount: paths.length,
    folderCount: folders.size,
    fileTypes,
    detected,
    mainFolders,
    components,
    pages,
    routes,
    controllers,
    models,
    configFiles,
    envFiles,
    readme,
    packageJson,
    largeFiles,
    secrets,
  }
  analysis.tree = buildTree(
    paths,
    secrets.map((s) => s.file),
    rootName,
  )
  return analysis
}

export async function analyzeZipBuffer(buffer, meta = {}) {
  let zip
  try {
    zip = await JSZip.loadAsync(buffer)
  } catch {
    throw new Error('The uploaded file is not a readable ZIP archive.')
  }

  const list = []
  zip.forEach((_, entry) => list.push(entry))
  if (list.length > MAX_ENTRIES) {
    throw new Error('Archive has too many entries to analyze safely.')
  }

  let totalUncompressed = 0
  const files = []
  for (const entry of list) {
    if (entry.dir) continue
    const size = entry._data?.uncompressedSize || 0
    totalUncompressed += size
    if (totalUncompressed > MAX_TOTAL_UNCOMPRESSED) {
      throw new Error('Archive expands to an unsafe size (possible zip bomb).')
    }
    let content = null
    if (TEXT_RE.test(entry.name) || /(^|\/)\.env/i.test(entry.name)) {
      try {
        content = await entry.async('string')
        if (content.length > MAX_TEXT_BYTES) content = content.slice(0, MAX_TEXT_BYTES)
      } catch {
        content = null
      }
    }
    files.push({ path: entry.name, content })
  }
  return analyzeFiles(files, meta)
}
