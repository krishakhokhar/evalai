import { Navigate, Route, Routes } from 'react-router-dom'
import RequireRole from './components/RequireRole'
import DashboardLayout from './components/layout/DashboardLayout'
import Login from './pages/Login'
import Register from './pages/Register'

import AdminDashboard from './pages/admin/Dashboard'
import AdminSyllabus from './pages/admin/Syllabus'
import AdminQuestionBank from './pages/admin/QuestionBank'
import AdminQuestionGenerator from './pages/admin/QuestionGenerator'
import AdminAssessments from './pages/admin/Assessments'
import AdminProjects from './pages/admin/Projects'
import AdminEvaluationCriteria from './pages/admin/EvaluationCriteria'
import AdminStudents from './pages/admin/Students'
import AdminEvaluators from './pages/admin/Evaluators'
import AdminEvaluations from './pages/admin/Evaluations'

import StudentDashboard from './pages/student/Dashboard'
import StudentAssessments from './pages/student/Assessments'
import StudentAssessmentTake from './pages/student/AssessmentTake'
import StudentProjectSubmission from './pages/student/ProjectSubmission'
import StudentResults from './pages/student/Results'

import EvaluatorDashboard from './pages/evaluator/Dashboard'
import EvaluatorPending from './pages/evaluator/PendingEvaluations'
import EvaluatorCompleted from './pages/evaluator/CompletedEvaluations'
import EvaluatorEvaluateProject from './pages/evaluator/EvaluateProject'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />

      <Route path="/login" element={<Login role="student" />} />
      <Route path="/register/student" element={<Register role="student" />} />
      <Route path="/register/evaluator" element={<Register role="evaluator" />} />

      <Route path="/admin">
        <Route index element={<Login role="admin" />} />
        <Route element={<RequireRole role="admin" />}>
          <Route element={<DashboardLayout role="admin" />}>
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="syllabus" element={<AdminSyllabus />} />
            <Route path="question-bank" element={<AdminQuestionBank />} />
            <Route path="questions" element={<Navigate to="/admin/question-bank" replace />} />
            <Route path="question-generator" element={<AdminQuestionGenerator />} />
            <Route path="assessments" element={<AdminAssessments />} />
            <Route path="projects" element={<AdminProjects />} />
            <Route path="students" element={<AdminStudents />} />
            <Route path="evaluators" element={<AdminEvaluators />} />
            <Route path="evaluation-criteria" element={<AdminEvaluationCriteria />} />
            <Route path="evaluations" element={<AdminEvaluations />} />
          </Route>
        </Route>
      </Route>

      <Route path="/student">
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route element={<RequireRole role="student" />}>
          <Route element={<DashboardLayout role="student" />}>
            <Route path="dashboard" element={<StudentDashboard />} />
            <Route path="assessments" element={<StudentAssessments />} />
            <Route path="assessment/:id" element={<StudentAssessmentTake />} />
            <Route path="project-submission" element={<StudentProjectSubmission />} />
            <Route path="results" element={<StudentResults />} />
          </Route>
        </Route>
      </Route>

      <Route path="/evaluator">
        <Route index element={<Login role="evaluator" />} />
        <Route element={<RequireRole role="evaluator" />}>
          <Route element={<DashboardLayout role="evaluator" />}>
            <Route path="dashboard" element={<EvaluatorDashboard />} />
            <Route path="pending" element={<EvaluatorPending />} />
            <Route path="completed" element={<EvaluatorCompleted />} />
            <Route path="evaluate/:submissionId" element={<EvaluatorEvaluateProject />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
