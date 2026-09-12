import mongoose from 'mongoose'

// Admin-authored project / task that students build and submit a ZIP for.
const projectSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    requirements: { type: [String], default: [] },
    instructions: { type: String, default: '' },
    techStack: { type: String, default: '' },
    deadline: { type: Date, default: null },
    maxMarks: { type: Number, default: 100 },
    syllabusId: { type: mongoose.Schema.Types.ObjectId, ref: 'Syllabus', default: null },
    // Which rubric criteria this project is graded on (names match Criteria items).
    evaluationCriteria: { type: [String], default: [] },
    referenceFileName: { type: String, default: '' },
    referenceFilePath: { type: String, default: '' }, // server-internal, never exposed
    status: {
      type: String,
      enum: ['draft', 'published', 'closed'],
      default: 'draft',
      index: true,
    },
    publishedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
)

export default mongoose.model('Project', projectSchema)
