import mongoose from 'mongoose'

// A single document holding the active rubric. Kept as one row for simple edit.
const criteriaSchema = new mongoose.Schema(
  {
    singleton: { type: String, default: 'rubric', unique: true },
    items: {
      type: [{ name: String, max: Number }],
      default: [],
    },
  },
  { timestamps: true },
)

export const DEFAULT_CRITERIA = [
  { name: 'Project Structure', max: 15 },
  { name: 'Code Quality', max: 20 },
  { name: 'Functionality', max: 20 },
  { name: 'UI/UX', max: 10 },
  { name: 'Database', max: 15 },
  { name: 'Documentation', max: 10 },
  { name: 'Innovation', max: 10 },
]

const Criteria = mongoose.model('Criteria', criteriaSchema)

export async function getActiveCriteria() {
  let doc = await Criteria.findOne({ singleton: 'rubric' })
  if (!doc) {
    doc = await Criteria.create({ singleton: 'rubric', items: DEFAULT_CRITERIA })
  }
  return doc
}

export default Criteria
