import mongoose from 'mongoose'

// One per (student, assessment). The randomized question + option order is
// generated on `start` and frozen here so a refresh never changes the paper.
// `correctKey` is stored server-side and NEVER serialized to the student.
const attemptQuestionSchema = new mongoose.Schema(
  {
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
    question: String,
    topic: String,
    unit: String,
    difficulty: String,
    marks: Number,
    options: [{ key: String, text: String }], // shuffled A..D presentation
    correctKey: String, // presentation key that maps to the true answer
    explanation: String,
  },
  { _id: false },
)

const assessmentAttemptSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    assessmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assessment', required: true, index: true },
    questions: { type: [attemptQuestionSchema], default: [] },
    answers: { type: Map, of: String, default: {} }, // questionId -> chosen presentation key
    status: { type: String, enum: ['in_progress', 'submitted'], default: 'in_progress' },
    score: { type: Number, default: 0 },
    totalMarks: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
    correctCount: { type: Number, default: 0 },
    incorrectCount: { type: Number, default: 0 },
    topicBreakdown: {
      type: [{ topic: String, correct: Number, total: Number, percent: Number }],
      default: [],
    },
    durationMinutes: { type: Number, default: 20 },
    startedAt: { type: Date, default: Date.now },
    submittedAt: { type: Date, default: null },
  },
  { timestamps: true },
)

assessmentAttemptSchema.index({ studentId: 1, assessmentId: 1 }, { unique: true })

// Student-safe view: hides correctKey / explanation while in progress.
assessmentAttemptSchema.methods.toStudentView = function toStudentView(reveal = false) {
  return {
    id: this._id,
    assessmentId: this.assessmentId,
    status: this.status,
    durationMinutes: this.durationMinutes,
    startedAt: this.startedAt,
    submittedAt: this.submittedAt,
    answers: Object.fromEntries(this.answers || []),
    questions: this.questions.map((q, i) => ({
      number: i + 1,
      questionId: q.questionId,
      question: q.question,
      topic: q.topic,
      difficulty: q.difficulty,
      marks: q.marks,
      options: q.options.map((o) => ({ key: o.key, text: o.text })),
      ...(reveal ? { correctKey: q.correctKey, explanation: q.explanation } : {}),
    })),
  }
}

export default mongoose.model('AssessmentAttempt', assessmentAttemptSchema)
