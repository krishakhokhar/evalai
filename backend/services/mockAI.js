// Mock AI evaluation (backend). Deterministic, rule-based, derived from the REAL
// extracted project analysis — never random. Replace `evaluateProject` with a real
// model call later; keep the return shape.

import { DEFAULT_CRITERIA } from '../models/Criteria.js'

const ok = (text) => ({ ok: true, text })
const warn = (text) => ({ ok: false, text })
const clamp = (n, min, max) => Math.max(min, Math.min(max, n))
const hasFolder = (a, re) => (a.mainFolders || []).some((f) => re.test(f))
const hasExt = (a, re) => Object.keys(a.fileTypes || {}).some((e) => re.test(e))

const RULES = {
  'Project Structure': (a) => {
    const ev = []
    let s = 5
    if (hasFolder(a, /(^|\/)src$/)) { s += 3; ev.push(ok('Organized src directory')) }
    else { s -= 2; ev.push(warn('No dedicated src directory detected')) }
    if (a.components.length) { s += 2; ev.push(ok('Components directory present')) }
    if (a.pages.length) { s += 2; ev.push(ok('Components and pages separated')) }
    if (a.detected.reactFrontend && a.detected.nodeBackend) { s += 2; ev.push(ok('Clear frontend / backend separation')) }
    if (a.folderCount < 3) { s -= 3; ev.push(warn('Very few folders — structure looks flat')) }
    return {
      score: s,
      evidence: ev,
      reason:
        'Structure score reflects how predictably the project is organized into named folders (src, components, pages, backend).',
      recommendation:
        'Group related files into clearly named folders and keep a predictable top-level layout.',
    }
  },
  'Code Quality': (a) => {
    const ev = []
    let s = 7
    if (a.components.length >= 2) { s += 4; ev.push(ok('Reusable components detected')) }
    else ev.push(warn('Few or no reusable components'))
    if (a.pages.length >= 1) { s += 3; ev.push(ok('Separate page structure detected')) }
    if (a.largeFiles.length) { s += 1; ev.push(warn(`${a.largeFiles.length} large source file(s) detected`)) }
    else { s += 3; ev.push(ok('No oversized source files')) }
    if (a.configFiles.some((f) => /eslint/i.test(f))) { s += 1; ev.push(ok('Linting configuration present')) }
    return {
      score: s,
      evidence: ev,
      reason:
        'Good component organization raises this score; large files and missing lint config lower it.',
      recommendation: 'Break large components into smaller reusable components.',
    }
  },
  Functionality: (a) => {
    const ev = []
    let s = 9
    if (a.detected.apiRoutes) { s += 4; ev.push(ok('API routes / controllers implemented')) }
    if (a.detected.reactFrontend) { s += 3; ev.push(ok('Frontend application entry present')) }
    if (a.packageJson?.scripts?.length) { s += 2; ev.push(ok(`Run scripts defined (${a.packageJson.scripts.slice(0, 3).join(', ')})`)) }
    if (!a.detected.apiRoutes && !a.detected.database) { s -= 2; ev.push(warn('No backend or data layer detected')) }
    return {
      score: s,
      evidence: ev,
      reason:
        'Score is based on evidence that the app can actually run features end to end (routes, entry point, scripts).',
      recommendation: 'Add automated tests or a demo script that proves the core user flows work.',
    }
  },
  Database: (a) => {
    const ev = []
    let s = 4
    if (a.detected.database) { s += 5; ev.push(ok('Database models / configuration detected')) }
    else ev.push(warn('No database layer detected'))
    const stores = a.technologies.filter((t) => /mongo|postgres|mysql|firebase|sqlite|prisma/i.test(t))
    if (stores.length) { s += 3; ev.push(ok(`Data store: ${stores.join(', ')}`)) }
    if (hasFolder(a, /model/i) || (a.models && a.models.length)) { s += 2; ev.push(ok('Dedicated models directory')) }
    else if (a.detected.database) ev.push(warn('No dedicated models directory'))
    return {
      score: s,
      evidence: ev,
      reason: 'Presence of models, schema files and a known data store drives the database score.',
      recommendation: 'Document the schema and add validation / indexes for the main collections.',
    }
  },
  'UI/UX': (a) => {
    const ev = []
    let s = 4
    if (a.components.length) { s += 2; ev.push(ok('Component-based UI')) }
    if (hasExt(a, /\.(css|scss|sass|less)$/)) { s += 2; ev.push(ok('Dedicated styling files')) }
    else ev.push(warn('No dedicated styling files detected'))
    if (a.pages.length >= 2) { s += 1; ev.push(ok('Multiple screens / routes')) }
    return {
      score: s,
      evidence: ev,
      reason: 'A component-based UI with real styling and multiple screens scores higher here.',
      recommendation: 'Ensure consistent spacing, responsive layout and clear empty / error states.',
    }
  },
  Documentation: (a) => {
    const ev = []
    let s = 2
    if (a.readme.present) { s += 3; ev.push(ok('README found')) }
    else ev.push(warn('No README found'))
    if (a.readme.length > 400) { s += 2; ev.push(ok('README has meaningful content')) }
    else if (a.readme.present) ev.push(warn('README has limited content'))
    if (a.readme.hasSetup) { s += 2; ev.push(ok('Setup / installation instructions present')) }
    else if (a.readme.present) ev.push(warn('README has limited setup instructions'))
    return {
      score: s,
      evidence: ev,
      reason: 'Score comes from whether a README exists and how complete its setup instructions are.',
      recommendation: 'Expand the README with setup steps, environment variables and screenshots.',
    }
  },
  'Best Practices': (a) => {
    const ev = []
    let s = 4
    if (a.configFiles.some((f) => /\.gitignore$/i.test(f))) { s += 2; ev.push(ok('.gitignore present')) }
    else ev.push(warn('No .gitignore found'))
    if (a.secrets.length === 0) { s += 2; ev.push(ok('No hard-coded secrets detected')) }
    else ev.push(warn(`Sensitive value detected in ${a.secrets.length} file(s)`))
    if (a.configFiles.some((f) => /\.env\.example$/i.test(f))) { s += 1; ev.push(ok('.env.example provided')) }
    if (hasFolder(a, /(^|\/)(test|tests|__tests__)$/i) || hasExt(a, /\.(test|spec)\./)) { s += 1; ev.push(ok('Tests present')) }
    else ev.push(warn('No tests detected'))
    return {
      score: s,
      evidence: ev,
      reason: 'Ignoring secrets, providing .env.example and adding tests improve this score.',
      recommendation: 'Keep secrets in environment variables, add a .gitignore and introduce basic tests.',
    }
  },
  Innovation: (a) => {
    const ev = []
    let s = 4
    const techCount = (a.technologies || []).filter((t) => t !== 'Unknown').length
    if (techCount >= 4) { s += 3; ev.push(ok(`Integrates ${techCount} technologies`)) }
    else if (techCount >= 2) { s += 2; ev.push(ok(`Uses ${techCount} technologies`)) }
    else ev.push(warn('Limited technology variety'))
    if (a.detected.apiRoutes && a.detected.database && a.detected.reactFrontend) {
      s += 2
      ev.push(ok('Full-stack architecture (frontend + API + data layer)'))
    }
    if (a.detected.database && /firebase|prisma|graphql|redis|socket/i.test((a.technologies || []).join(' '))) {
      s += 1
      ev.push(ok('Uses a non-trivial data / realtime layer'))
    }
    return {
      score: s,
      evidence: ev,
      reason: 'Breadth of the stack and how the pieces fit together indicate the level of ambition.',
      recommendation: 'Highlight the novel part of the project in the README and demo.',
    }
  },
}

function normalize(a) {
  a = a || {}
  return {
    projectName: a.projectName || 'project',
    technologies: a.technologies || [],
    fileCount: a.fileCount || 0,
    folderCount: a.folderCount || 0,
    fileTypes: a.fileTypes || {},
    detected: a.detected || {},
    mainFolders: a.mainFolders || [],
    components: a.components || [],
    pages: a.pages || [],
    routes: a.routes || [],
    controllers: a.controllers || [],
    models: a.models || [],
    configFiles: a.configFiles || [],
    readme: a.readme || { present: false, length: 0, hasSetup: false },
    packageJson: a.packageJson || null,
    largeFiles: a.largeFiles || [],
    secrets: a.secrets || [],
  }
}

export function evaluateProject(rawAnalysis, criteriaItems) {
  const analysis = normalize(rawAnalysis)
  const list = criteriaItems?.length ? criteriaItems : DEFAULT_CRITERIA
  const criteria = list.map((c) => {
    const rule = RULES[c.name]
    const r = rule
      ? rule(analysis)
      : { score: Math.round(c.max * 0.7), evidence: [], reason: '', recommendation: '' }
    return {
      key: c.name,
      max: c.max,
      score: clamp(Math.round(r.score), 0, c.max),
      evidence: r.evidence,
      reason: r.reason,
      recommendation: r.recommendation,
    }
  })

  const total = criteria.reduce((s, c) => s + c.score, 0)
  const max = criteria.reduce((s, c) => s + c.max, 0)

  const uniq = (arr) => [...new Set(arr)]
  const strengths = criteria
    .filter((c) => c.score / c.max >= 0.75)
    .flatMap((c) => c.evidence.filter((e) => e.ok).map((e) => e.text))
  const weaknesses = criteria.flatMap((c) => c.evidence.filter((e) => !e.ok).map((e) => e.text))
  const recommendations = criteria
    .filter((c) => c.score / c.max < 0.85)
    .map((c) => c.recommendation)
    .filter(Boolean)

  const find = (k) => criteria.find((c) => c.key === k) || { score: 0, max: 1 }
  const pct = (k) => Math.round((find(k).score / find(k).max) * 100)
  const skillProfile = [
    { label: 'Frontend', value: Math.round(pct('Code Quality') * 0.4 + pct('UI/UX') * 0.4 + pct('Project Structure') * 0.2) },
    { label: 'Backend', value: Math.round(pct('Functionality') * 0.6 + pct('Project Structure') * 0.4) },
    { label: 'Database', value: pct('Database') },
    { label: 'Documentation', value: pct('Documentation') },
    { label: 'Innovation', value: pct('Innovation') },
  ]

  return {
    criteria,
    total,
    max,
    strengths: uniq(strengths).slice(0, 6),
    weaknesses: uniq(weaknesses).slice(0, 6),
    recommendations: uniq(recommendations).slice(0, 5),
    skillProfile,
  }
}
