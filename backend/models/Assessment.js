import mongoose from 'mongoose'

const assessmentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    syllabusId: { type: mongoose.Schema.Types.ObjectId, ref: 'Syllabus' },
    subject: { type: String, default: '' },
    units: { type: [String], default: [] },
    questionIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }],
    numQuestions: { type: Number, default: 0 },
    durationMinutes: { type: Number, default: 20 },
    marksPerQuestion: { type: Number, default: 1 },
    totalMarks: { type: Number, default: 0 },
    passingMarks: { type: Number, default: 0 },
    difficulty: {
      type: String,
      enum: ['Easy', 'Medium', 'Hard', 'Mixed'],
      default: 'Mixed',
    },
    startAt: { type: Date, default: null },
    endAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ['draft', 'published', 'closed'],
      default: 'draft',
      index: true,
    },
    shuffleQuestions: { type: Boolean, default: true },
    shuffleOptions: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
)

export default mongoose.model('Assessment', assessmentSchema)
