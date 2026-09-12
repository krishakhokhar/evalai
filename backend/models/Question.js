import mongoose from 'mongoose'

const questionSchema = new mongoose.Schema(
  {
    question: { type: String, required: true, trim: true },
    options: {
      A: { type: String, required: true },
      B: { type: String, required: true },
      C: { type: String, required: true },
      D: { type: String, required: true },
    },
    correctAnswer: { type: String, enum: ['A', 'B', 'C', 'D'], required: true },
    subject: { type: String, default: '' },
    unit: { type: String, default: '' },
    topic: { type: String, default: '' },
    difficulty: {
      type: String,
      enum: ['Easy', 'Medium', 'Hard'],
      default: 'Medium',
    },
    marks: { type: Number, default: 1, min: 0 },
    explanation: { type: String, default: '' },
    sourceSyllabusId: { type: mongoose.Schema.Types.ObjectId, ref: 'Syllabus' },
    status: {
      type: String,
      enum: ['draft', 'approved', 'published'],
      default: 'draft',
      index: true,
    },
    origin: { type: String, enum: ['manual', 'generated', 'import'], default: 'manual' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
)

export default mongoose.model('Question', questionSchema)
