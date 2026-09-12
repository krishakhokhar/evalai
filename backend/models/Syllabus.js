import mongoose from 'mongoose'

const unitSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    topics: { type: [String], default: [] },
  },
  { _id: false },
)

const syllabusSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    subject: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    fileName: { type: String, default: '' },
    fileType: { type: String, default: '' },
    filePath: { type: String, default: '' }, // server-internal, never exposed
    rawText: { type: String, default: '' }, // extracted text, admin-only
    units: { type: [unitSchema], default: [] },
    source: { type: String, enum: ['manual', 'upload'], default: 'manual' },
    status: {
      type: String,
      enum: ['draft', 'parsed', 'saved'],
      default: 'saved',
    },
    // Students only ever see syllabi with published === true.
    published: { type: Boolean, default: false, index: true },
    publishedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
)

// Convenience: flat topic list across all units
syllabusSchema.virtual('topics').get(function topics() {
  return this.units.flatMap((u) => u.topics)
})
syllabusSchema.set('toJSON', { virtuals: true })
syllabusSchema.set('toObject', { virtuals: true })

export default mongoose.model('Syllabus', syllabusSchema)
