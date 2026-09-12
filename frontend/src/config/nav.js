export const NAV = {
  admin: {
    base: '/admin',
    label: 'Admin',
    items: [
      { to: '/admin/dashboard', label: 'Dashboard' },
      { to: '/admin/syllabus', label: 'Content' },
      { to: '/admin/question-bank', label: 'Question Bank' },
      { to: '/admin/question-generator', label: 'Question Generator' },
      { to: '/admin/assessments', label: 'Assessments' },
      { to: '/admin/projects', label: 'Project Tasks' },
      { to: '/admin/students', label: 'Students' },
      { to: '/admin/evaluators', label: 'Evaluators' },
      { to: '/admin/evaluation-criteria', label: 'Evaluation Criteria' },
    ],
  },
  student: {
    base: '/student',
    label: 'Student',
    items: [
      { to: '/student/dashboard', label: 'Dashboard' },
      { to: '/student/assessments', label: 'Assessments' },
      { to: '/student/project-submission', label: 'Project Submission' },
      { to: '/student/results', label: 'Results' },
    ],
  },
  evaluator: {
    base: '/evaluator',
    label: 'Evaluator',
    items: [
      { to: '/evaluator/dashboard', label: 'Dashboard' },
      { to: '/evaluator/pending', label: 'Pending Evaluations' },
      { to: '/evaluator/completed', label: 'Completed Evaluations' },
    ],
  },
}
