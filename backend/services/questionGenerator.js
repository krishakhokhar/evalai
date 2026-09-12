// Deterministic question generation, grounded ONLY in the syllabus's actual
// extracted units/topics — never the syllabus title, filename, or any
// database/upload ID. This is a rule-based generator (no external AI call);
// a real provider can be dropped in later via `generateWithProvider` below,
// gated by AI_PROVIDER + AI_API_KEY in backend/.env, without touching the
// controller or the rest of this pipeline.

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

const EASY_TEMPLATES = [
  ({ topic, unit }) => ({
    question: `Which of the following is a topic covered under "${unit}"?`,
    correct: topic,
    distractors: GENERIC_WRONG.slice(0, 3),
  }),
  ({ topic, unit, otherUnits }) => ({
    question: `"${topic}" belongs to which unit of this syllabus?`,
    correct: unit,
    distractors: otherUnits.length ? otherUnits.slice(0, 3) : GENERIC_WRONG.slice(0, 3),
  }),
  ({ topic, unit }) => ({
    question: `Which statement about "${topic}" is correct?`,
    correct: `"${topic}" is part of the "${unit}" content and can be assessed in this course.`,
    distractors: [
      `"${topic}" is not part of this course.`,
      `"${topic}" belongs to a completely unrelated field of study.`,
      `"${topic}" was removed from the syllabus and is no longer taught.`,
    ],
  }),
  ({ topic, unit, siblings }) => ({
    question: `Which of these is NOT directly related to "${unit}"?`,
    correct: pick(GENERIC_WRONG, topic.length),
    distractors: siblings.length ? siblings.slice(0, 3) : [topic, `Core ideas of ${topic}`, `Fundamentals of ${unit}`],
  }),
]

const MEDIUM_TEMPLATES = [
  ({ topic, unit }) => ({
    question: `A student is studying "${topic}" as part of "${unit}". What should they focus on first?`,
    correct: `Understanding the fundamentals and expected outcomes of "${topic}"`,
    distractors: [
      'Skipping the fundamentals and improvising without guidance',
      `Ignoring "${unit}" entirely and studying an unrelated subject`,
      'Memorising unrelated material instead of this topic',
    ],
  }),
  ({ topic, unit, siblings }) => {
    const sibling = siblings[0]
    if (!sibling) {
      return {
        question: `How does "${topic}" fit within the broader scope of "${unit}"?`,
        correct: `It is one of the concepts making up "${unit}" in this syllabus.`,
        distractors: [
          `It has no connection to "${unit}" at all.`,
          `It replaced everything else taught in "${unit}".`,
          'It belongs to a different course entirely.',
        ],
      }
    }
    return {
      question: `How does "${topic}" primarily differ from "${sibling}" within "${unit}"?`,
      correct: `They are distinct concepts within "${unit}", each covering a different aspect of the subject.`,
      distractors: [
        `They are identical in every respect.`,
        `"${sibling}" is unrelated to "${unit}".`,
        `"${topic}" was entirely replaced by "${sibling}".`,
      ],
    }
  },
  ({ topic, unit }) => ({
    question: `In a real-world scenario related to "${unit}", which concept below would be most relevant to apply?`,
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

function isValidQuestion(q) {
  if (!q.question || !q.question.trim()) return false
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

// Seam for a real provider. Not used unless configured. When wired up, `args`
// already carries the real structured syllabus (units/topics) exactly as
// generateFromSyllabus receives it — never a filename/title/ID.
export async function generateWithProvider() {
  throw new Error('No AI provider configured. Using deterministic generator.')
}

export async function generateQuestions(args) {
  if (process.env.AI_PROVIDER && process.env.AI_API_KEY) {
    try {
      return await generateWithProvider(args)
    } catch (err) {
      if (err instanceof NoSyllabusContentError) throw err
      /* fall through to deterministic */
    }
  }
  return generateFromSyllabus(args)
}
