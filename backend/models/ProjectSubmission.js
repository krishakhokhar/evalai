import mongoose from 'mongoose'

const projectSubmissionSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Optional link to an admin-authored Project task the student is submitting for.
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', index: true, default: null },
    projectTitle: { type: String, default: '' },
    projectName: { type: String, required: true, trim: true },
    technology: { type: String, default: '' },
    description: { type: String, default: '' },
    originalFileName: { type: String, required: true },
    filePath: { type: String, required: true }, // server-internal path, never exposed
    fileSize: { type: Number, default: 0 },
    submissionStatus: {
      type: String,
      enum: ['submitted', 'under_review', 'evaluated'],
      default: 'submitted',
      index: true,
    },
    projectAnalysis: { type: mongoose.Schema.Types.Mixed, default: null },
    submittedAt: { type: Date, default: Date.now },
    // denormalised from Evaluation once the evaluator submits (for quick reads)
    evaluatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    score: { type: Number, default: null },
    maxMarks: { type: Number, default: 100 },
    feedback: { type: String, default: '' },
  },
  { timestamps: true },
)

export default mongoose.model('ProjectSubmission', projectSubmissionSchema)
