import mongoose from 'mongoose'

const rubricScoreSchema = new mongoose.Schema(
  {
    key: String,
    score: Number,
    max: Number,
    evidence: [{ ok: Boolean, text: String }],
    reason: String,
    recommendation: String,
  },
  { _id: false },
)

const evaluationSchema = new mongoose.Schema(
  {
    projectSubmissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProjectSubmission',
      required: true,
      unique: true,
      index: true,
    },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    evaluatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rubricScores: { type: [rubricScoreSchema], default: [] },
    totalScore: { type: Number, default: 0 },
    strengths: { type: [String], default: [] },
    weaknesses: { type: [String], default: [] },
    recommendations: { type: [String], default: [] },
    skillProfile: {
      type: [{ label: String, value: Number }],
      default: [],
    },
    evaluatorComments: { type: String, default: '' },
    finalFeedback: { type: String, default: '' },
    maxMarks: { type: Number, default: 100 },
    aiSuggested: { type: mongoose.Schema.Types.Mixed, default: null },
    status: {
      type: String,
      enum: ['completed'],
      default: 'completed',
    },
  },
  { timestamps: true },
)

export default mongoose.model('Evaluation', evaluationSchema)
