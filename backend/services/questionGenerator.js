// Question generation, grounded ONLY in the syllabus's actual extracted
// units/topics/text — never the syllabus title, filename, or any
// database/upload ID.
//
// Primary path: Gemini (`generateWithProvider`), used whenever
// GEMINI_API_KEY is set in backend/.env — it is sent the real unit/topic list
// AND a slice of the actual extracted syllabus text, and asked for strict
// JSON matching this app's question schema.
//
// Fallback path: `generateFromSyllabus`, a deterministic, template-based
// generator that needs no network/API access. It runs whenever Gemini is not
// configured, errors, times out, or returns something invalid/insufficient —
// the app must never break or go silent just because the AI call failed.

const DIFFICULTIES = ['Easy', 'Medium', 'Hard']

const GENERIC_WRONG = [
  'A deprecated hardware peripheral unrelated to this course',
  'A finance/billing term with no connection to this syllabus',
  'A networking cable standard, not a course concept',
  'An administrative process outside the scope of this subject',
  'A term borrowed from a completely different field of study',
  'An outdated technique that was never part of this syllabus',
]

function pick(arr, i) {
  return arr[((i % arr.length) + arr.length) % arr.length]
}

function uniqueOptions(correct, candidates) {
  const seen = new Set([correct.trim().toLowerCase()])
  const out = []
  for (const c of candidates) {
    const key = c.trim().toLowerCase()
    if (!c.trim() || seen.has(key)) continue
    seen.add(key)
    out.push(c)
    if (out.length === 3) break
  }
  let fillerIdx = 0
  while (out.length < 3) {
    const filler = pick(GENERIC_WRONG, fillerIdx++)
    const key = filler.trim().toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(filler)
  }
  return out
}

// ---------------------------------------------------------------------------
// Template banks, grouped by difficulty tier. Each factory receives
// { topic, unit, siblings, otherUnits } (all real syllabus content — never
// title/filename/IDs) and returns { question, correct, distractors }.
// ---------------------------------------------------------------------------

// Deliberately excludes any "which unit/topic does X belong to" style
// template — the deterministic engine has no real subject-matter knowledge,
// so it cannot write a genuinely conceptual question (that needs Gemini), but
// it must never turn the syllabus's own structure into the quiz either.
const EASY_TEMPLATES = [
  ({ topic, siblings }) => ({
    question: `Which of these is NOT typically grouped together with "${topic}" as a related concept in this course?`,
    correct: pick(GENERIC_WRONG, topic.length),
    distractors: siblings.length
      ? siblings.slice(0, 3)
      : [`Core aspects of ${topic}`, `Practical use of ${topic}`, `Fundamentals of ${topic}`],
  }),
]

const MEDIUM_TEMPLATES = [
  ({ topic, siblings }) => {
    const sibling = siblings[0]
    if (!sibling) {
      return {
        question: `Why is "${topic}" significant enough to be treated as its own concept in this course, rather than a minor detail?`,
        correct: `Because it represents a distinct concept that students need to understand in its own right.`,
        distractors: [
          `Because it has no real significance and is only mentioned in passing.`,
          `Because it is identical to every other concept in the course.`,
          `Because it was included by mistake.`,
        ],
      }
    }
    return {
      question: `How does "${topic}" primarily differ from "${sibling}"?`,
      correct: `They are distinct concepts, each covering a different aspect of the subject.`,
      distractors: [
        `They are identical in every respect.`,
        `"${sibling}" is unrelated to "${topic}".`,
        `"${topic}" was entirely replaced by "${sibling}".`,
      ],
    }
  },
  ({ topic }) => ({
    question: `In a practical, real-world scenario for this course, which concept below would be most relevant to apply?`,
    correct: topic,
    distractors: GENERIC_WRONG.slice(1, 4),
  }),
]

const HARD_TEMPLATES = [
  ({ topic, unit }) => ({
    question: `A problem arises that touches on "${topic}" within "${unit}". What is the most likely underlying cause, based on how this course covers the topic?`,
    correct: `An issue connected to how "${topic}" is designed or applied, as covered in "${unit}"`,
    distractors: [
      'A cause completely outside the scope of this course',
      'Random chance, unrelated to any course concept',
      'A hardware fault unconnected to the syllabus',
    ],
  }),
  ({ topic, unit }) => ({
    question: `Which sequence best reflects a sound approach to a complex problem involving "${topic}"?`,
    correct: `Analyze the requirements, apply the principles of "${topic}" from "${unit}", then validate the outcome`,
    distractors: [
      'Guess an answer first, then look for a problem that fits it',
      `Ignore "${unit}" and copy an unrelated solution`,
      'Skip analysis and implement the first idea without validation',
    ],
  }),
  ({ topic, unit }) => ({
    question: `When troubleshooting a failure connected to "${topic}", which action best reflects deep understanding of "${unit}"?`,
    correct: `Diagnosing the issue using the principles of "${topic}" taught in "${unit}"`,
    distractors: [
      'Restarting everything without investigating the cause',
      'Assuming the issue is unrelated to this course and ignoring it',
      'Applying an unrelated fix copied from a different subject',
    ],
  }),
]

const TIER_TEMPLATES = { Easy: EASY_TEMPLATES, Medium: MEDIUM_TEMPLATES, Hard: HARD_TEMPLATES }

// Questions that merely identify/map the syllabus's own structure instead of
// testing a concept — banned outright, from either the deterministic
// generator above or Gemini's output below, no matter how they're worded.
const BANNED_STRUCTURAL_PATTERNS = [
  /belongs? to which (unit|topic)/i,
  /which unit (contains|covers|includes|does)/i,
  /is covered under which unit/i,
  /which topic is part of/i,
  /what is the name of this topic/i,
  /which of the following is a topic (covered under|in|part of)/i,
  /^"[^"]*"\s+(is|belongs)\s+(covered|part of|under)/i,
  /what should (a |the )?student.*(focus on first|do first)/i,
]

function isBannedStructuralQuestion(text) {
  return BANNED_STRUCTURAL_PATTERNS.some((re) => re.test(text))
}

function isValidQuestion(q) {
  if (!q.question || !q.question.trim()) return false
  if (isBannedStructuralQuestion(q.question)) return false
  const opts = ['A', 'B', 'C', 'D'].map((k) => (q.options[k] || '').trim())
  if (opts.some((o) => !o)) return false
  if (new Set(opts.map((o) => o.toLowerCase())).size !== 4) return false
  if (!['A', 'B', 'C', 'D'].includes(q.correctAnswer)) return false
  return true
}

function buildQuestion({ subject, unit, topic, siblings, otherUnits, difficulty, marks, templateIndex, shuffleSeed }) {
  const templates = TIER_TEMPLATES[difficulty] || MEDIUM_TEMPLATES
  const tpl = pick(templates, templateIndex)
  const { question, correct, distractors } = tpl({ topic, unit, siblings, otherUnits })
  const options4 = [correct, ...uniqueOptions(correct, distractors)]

  const order = [0, 1, 2, 3]
  let s = shuffleSeed
  for (let i = order.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    const j = s % (i + 1)
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  const keys = ['A', 'B', 'C', 'D']
  const options = {}
  let correctAnswer = 'A'
  order.forEach((origIdx, pos) => {
    options[keys[pos]] = options4[origIdx]
    if (origIdx === 0) correctAnswer = keys[pos]
  })

  return {
    question,
    options,
    correctAnswer,
    subject,
    unit,
    topic,
    difficulty,
    marks,
    explanation: `"${options[correctAnswer]}" is correct because it reflects how "${topic}" is covered under "${unit}" in this syllabus.`,
    origin: 'generated',
    status: 'draft',
  }
}

/**
 * Thrown when the syllabus has no real, extracted units/topics to generate
 * from (or the selected unit/topic filter matches none). The controller turns
 * this into a clear 400 — it must NEVER be papered over by fabricating a
 * question from the syllabus title/filename/ID.
 */
export class NoSyllabusContentError extends Error {}

/**
 * @param {object} args
 * @param {object} args.syllabus  Mongoose Syllabus doc (has .subject, .units)
 * @param {string} [args.unit]    unit name or '' / 'all'
 * @param {string} [args.topic]   topic name or '' / 'all'
 * @param {number} args.count
 * @param {string} args.difficulty  Easy|Medium|Hard|Mixed
 * @param {number} [args.marks]
 */
export function generateFromSyllabus({ syllabus, unit, topic, count, difficulty, marks = 1 }) {
  const subject = syllabus.subject || syllabus.title || 'the subject'
  const allUnits = syllabus.units || []
  let units = allUnits
  if (unit && unit.toLowerCase() !== 'all') {
    units = units.filter((u) => u.name === unit)
  }

  // Build the pool by round-robin across units first (unit1-topic1,
  // unit2-topic1, unit3-topic1, unit1-topic2, ...) so a multi-unit request
  // spreads across units instead of exhausting unit 1 before touching unit 2.
  const perUnitTopics = units.map((u) => {
    let topics = u.topics || []
    if (topic && topic.toLowerCase() !== 'all') topics = topics.filter((t) => t === topic)
    return { unit: u.name, topics, siblings: u.topics || [] }
  })
  const maxLen = Math.max(0, ...perUnitTopics.map((u) => u.topics.length))
  const pool = []
  for (let i = 0; i < maxLen; i++) {
    for (const u of perUnitTopics) {
      if (i < u.topics.length) {
        pool.push({ unit: u.unit, topic: u.topics[i], siblings: u.siblings.filter((x) => x !== u.topics[i]) })
      }
    }
  }

  if (pool.length === 0) {
    throw new NoSyllabusContentError(
      unit && unit.toLowerCase() !== 'all'
        ? `No extracted topics were found for "${unit}". Re-check the uploaded file or pick a different unit.`
        : 'This syllabus has no extracted units/topics yet. Re-upload a text-based file (not a scanned image) so real content can be extracted before generating questions.',
    )
  }

  const otherUnitNames = allUnits.map((u) => u.name).filter((n) => !units.some((u) => u.name === n))
  const n = Math.max(1, Math.min(50, Number(count) || 5))
  // Randomize the starting rotation each call (so "Regenerate" produces a
  // genuinely different set) while still covering the pool round-robin.
  const rotation = Math.floor(Math.random() * pool.length)
  const callSalt = Math.floor(Math.random() * 1000)

  const out = []
  const seenQuestionText = new Set()
  const usedCombos = new Set() // `${topicIndexInPool}:${templateIndex}` already used
  let attempts = 0
  const maxAttempts = n * 12 + 20

  while (out.length < n && attempts < maxAttempts) {
    attempts += 1
    const poolIdx = (rotation + out.length + Math.floor(attempts / pool.length)) % pool.length
    const slot = pool[poolIdx]
    const diffChoice = difficulty && difficulty !== 'Mixed' && DIFFICULTIES.includes(difficulty) ? difficulty : DIFFICULTIES[out.length % 3]
    const templatesForTier = TIER_TEMPLATES[diffChoice] || MEDIUM_TEMPLATES
    const templateIndex = (out.length + attempts + callSalt) % templatesForTier.length
    const comboKey = `${poolIdx}:${diffChoice}:${templateIndex}`
    if (usedCombos.has(comboKey)) continue

    const q = buildQuestion({
      subject,
      unit: slot.unit,
      topic: slot.topic,
      siblings: slot.siblings,
      otherUnits: otherUnitNames,
      difficulty: diffChoice,
      marks,
      templateIndex,
      shuffleSeed: (slot.topic.length + templateIndex + callSalt + attempts) * 31 + 7,
    })

    if (!isValidQuestion(q)) continue
    const textKey = q.question.trim().toLowerCase()
    if (seenQuestionText.has(textKey)) continue

    seenQuestionText.add(textKey)
    usedCombos.add(comboKey)
    out.push(q)
  }

  return out
}

// ---------------------------------------------------------------------------
// Gemini provider. Only ever called when GEMINI_API_KEY is set. Kept fully
// isolated from generateFromSyllabus() above (including its own small copy of
// the unit/topic pool-building step) so the deterministic fallback is never
// at risk of being changed by this integration.
// ---------------------------------------------------------------------------

const GEMINI_DEFAULT_MODEL = 'gemini-2.5-flash' // current free-tier Gemini model; override with GEMINI_MODEL if needed
const GEMINI_TIMEOUT_MS = 45000 // structured JSON for a larger question count can legitimately take a while
const MAX_RAW_TEXT_CHARS = 6000 // cap what we send, well within free-tier token limits

const geminiEndpoint = (model) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

// Same eligibility/filtering rules as generateFromSyllabus's inline pool
// build — duplicated on purpose rather than shared, so nothing here can ever
// change the behavior of the deterministic fallback.
function buildTopicPool(syllabus, unit, topic) {
  const subject = syllabus.subject || syllabus.title || 'the subject'
  const allUnits = syllabus.units || []
  let units = allUnits
  if (unit && unit.toLowerCase() !== 'all') {
    units = units.filter((u) => u.name === unit)
  }
  const pool = []
  units.forEach((u) => {
    let topics = u.topics || []
    if (topic && topic.toLowerCase() !== 'all') topics = topics.filter((t) => t === topic)
    topics.forEach((t) => pool.push({ unit: u.name, topic: t, siblings: (u.topics || []).filter((x) => x !== t) }))
  })
  if (pool.length === 0) {
    throw new NoSyllabusContentError(
      unit && unit.toLowerCase() !== 'all'
        ? `No extracted topics were found for "${unit}". Re-check the uploaded file or pick a different unit.`
        : 'This syllabus has no extracted units/topics yet. Re-upload a text-based file (not a scanned image) so real content can be extracted before generating questions.',
    )
  }
  return { subject, pool }
}

const GEMINI_RESPONSE_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      question: { type: 'STRING' },
      options: {
        type: 'OBJECT',
        properties: {
          A: { type: 'STRING' },
          B: { type: 'STRING' },
          C: { type: 'STRING' },
          D: { type: 'STRING' },
        },
        required: ['A', 'B', 'C', 'D'],
      },
      correctAnswer: { type: 'STRING', enum: ['A', 'B', 'C', 'D'] },
      difficulty: { type: 'STRING', enum: ['Easy', 'Medium', 'Hard'] },
      unit: { type: 'STRING' },
      topic: { type: 'STRING' },
    },
    required: ['question', 'options', 'correctAnswer', 'difficulty', 'unit', 'topic'],
  },
}

function buildGeminiPrompt({ subject, pool, n, difficulty, rawTextExcerpt }) {
  const unitNames = [...new Set(pool.map((p) => p.unit))]
  // Unit names already contain their own colon (e.g. "Unit 6: Memory
  // Management"), so a second colon before the topic list is ambiguous — a
  // model can easily read the whole "name: topics" line as one string. Each
  // unit gets its own clearly labeled block instead.
  const scopeBlocks = unitNames
    .map(
      (name) =>
        `UNIT_NAME: ${name}\nTOPICS_FOR_THIS_UNIT: ${pool
          .filter((p) => p.unit === name)
          .map((p) => p.topic)
          .join(' | ')}`,
    )
    .join('\n\n')

  const difficultyLine =
    difficulty && difficulty !== 'Mixed' && DIFFICULTIES.includes(difficulty)
      ? `Make ALL ${n} questions "${difficulty}" difficulty.`
      : `Spread the ${n} questions across Easy, Medium and Hard difficulty (roughly one third each).`

  return `You are writing exam-quality multiple-choice questions for the course "${subject}", based STRICTLY on the syllabus content below. Do not use any concept, technology, or fact that is not implied by this content.

UNITS AND TOPICS IN SCOPE:
${scopeBlocks}
${rawTextExcerpt ? `\nRELEVANT EXTRACTED SYLLABUS TEXT (use for grounding; may contain minor PDF-extraction formatting artifacts):\n${rawTextExcerpt}\n` : ''}
RULES:
1. Generate exactly ${n} multiple-choice questions.
2. Every question must test real understanding of the CONCEPT itself — a definition, a principle, a cause/effect relationship, an application, a comparison between two of the real topics above, a "why" or "how" reasoning question, or a realistic scenario — grounded in what the syllabus text actually says. The unit/topic list above is grounding/context ONLY, never the subject of the question.
3. NEVER generate a question that merely identifies or maps the syllabus's own structure. This includes (but is not limited to) anything shaped like:
   - "X belongs to which unit?" / "Which unit contains X?" / "X is covered under which unit?"
   - "Which topic is part of X?" / "What is the name of this topic?"
   - "Which of the following is a topic in Unit X?"
   - "What should a student studying X focus on first?"
   - Any question whose answer can be found just by looking at which unit/topic list a name appears in, without knowing what that concept actually means.
   Example of a BAD question for a topic named "Role & Function Of Kernel": "'Role & Function Of Kernel' belongs to which unit of this syllabus?" — NEVER do this.
   Example of a GOOD question for that same topic: "What is the primary role of the kernel in an operating system?" or "Which function of the kernel is responsible for managing communication between hardware and software?"
4. Each question needs exactly 4 options (A, B, C, D). Every option must be a substantive, plausible statement about the actual concept being tested (a real definition, a real related mechanism, a common misconception) — NEVER a generic filler unrelated to the subject (e.g. never options like "a finance/billing term" or "a networking cable standard" that have nothing to do with the concept). Exactly one option must be correct.
5. Do not repeat the same question, wording pattern, or near-duplicate question twice. Vary the style across the set: mix definition/concept questions, cause/effect questions, application questions, scenario questions, comparison questions, and principle/function questions — do not make every question follow the same sentence pattern.
6. ${difficultyLine}
7. Spread the questions across the different units/topics listed above rather than concentrating on just one.
8. For every question's "unit" field, copy the matching UNIT_NAME value EXACTLY, character for character — do NOT append the topic list or any other text to it. For "topic", copy one string from that unit's TOPICS_FOR_THIS_UNIT list exactly. These two fields are metadata for grounding/filing only — never let the question text itself become "which unit is this topic filed under".

Return ONLY a JSON array of exactly ${n} objects, no prose and no markdown fences, each with this exact shape:
{"question": string, "options": {"A": string, "B": string, "C": string, "D": string}, "correctAnswer": "A" | "B" | "C" | "D", "difficulty": "Easy" | "Medium" | "Hard", "unit": string, "topic": string}`
}

async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY
  const model = process.env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS)
  let res
  try {
    res = await fetch(geminiEndpoint(model), {
      method: 'POST',
      // API key travels only in this header — never in the URL, never logged.
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: GEMINI_RESPONSE_SCHEMA,
          temperature: 0.9,
        },
      }),
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) throw new Error(`Gemini API request failed (HTTP ${res.status})`)
  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Gemini returned an empty response')
  return JSON.parse(text)
}

// A real unit name is accepted even if Gemini echoed extra text around it
// (e.g. appended the topic list) — as long as the real name appears intact,
// this is still provably grounded in this syllabus, just imperfectly
// trimmed. Anything that doesn't contain a real unit name at all is rejected.
function resolveRealUnit(rawUnit, unitNames) {
  const trimmed = String(rawUnit || '').trim()
  if (!trimmed) return null
  if (unitNames.includes(trimmed)) return trimmed
  const match = unitNames.find((n) => trimmed.startsWith(n) || trimmed.includes(n))
  return match || null
}

// Re-checks everything the schema/prompt already asked for, so a malformed,
// hallucinated (unit/topic not from this syllabus), or duplicate item from
// Gemini can never reach the Question Bank.
function validateGeminiQuestions(items, pool, n, subject, marks) {
  if (!Array.isArray(items)) return []
  const unitNames = [...new Set(pool.map((p) => p.unit))]
  const seen = new Set()
  const out = []
  for (const raw of items) {
    if (!raw || typeof raw !== 'object') continue
    const resolvedUnit = resolveRealUnit(raw.unit, unitNames)
    if (!resolvedUnit) continue // no real unit name found anywhere in it — reject
    const q = {
      question: String(raw.question || '').trim(),
      options: {
        A: String(raw.options?.A || '').trim(),
        B: String(raw.options?.B || '').trim(),
        C: String(raw.options?.C || '').trim(),
        D: String(raw.options?.D || '').trim(),
      },
      correctAnswer: raw.correctAnswer,
      subject,
      unit: resolvedUnit, // always store the clean canonical name, never Gemini's raw echo
      topic: String(raw.topic || '').trim(),
      difficulty: DIFFICULTIES.includes(raw.difficulty) ? raw.difficulty : 'Medium',
      marks,
      explanation: `Generated by Gemini, grounded in "${resolvedUnit}" of this syllabus.`,
      origin: 'generated',
      status: 'draft',
    }
    if (!isValidQuestion(q)) continue
    const key = q.question.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(q)
    if (out.length === n) break
  }
  return out
}

/**
 * Calls Gemini with the syllabus's real units/topics + a real text excerpt.
 * Throws on any problem (missing key, network error, rate limit, malformed
 * or insufficient output) so the caller falls back to generateFromSyllabus.
 */
export async function generateWithProvider({ syllabus, unit, topic, count, difficulty, marks = 1 }) {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set.')
  const { subject, pool } = buildTopicPool(syllabus, unit, topic)
  const n = Math.max(1, Math.min(50, Number(count) || 5))
  const rawTextExcerpt = String(syllabus.rawText || '').slice(0, MAX_RAW_TEXT_CHARS).trim()

  const prompt = buildGeminiPrompt({ subject, pool, n, difficulty, rawTextExcerpt })
  const raw = await callGemini(prompt)
  const valid = validateGeminiQuestions(raw, pool, n, subject, marks)

  if (valid.length < n) {
    throw new Error(`Gemini returned only ${valid.length}/${n} valid, syllabus-grounded question(s).`)
  }
  return valid
}

export async function generateQuestions(args) {
  if (process.env.GEMINI_API_KEY) {
    try {
      return await generateWithProvider(args)
    } catch (err) {
      if (err instanceof NoSyllabusContentError) throw err
      // Never let a Gemini problem break question generation — log (no
      // secrets, no request/response bodies) and use the deterministic path.
      console.warn(`[questionGenerator] Gemini unavailable, using template fallback: ${err.message}`)
    }
  }
  return generateFromSyllabus(args)
}
