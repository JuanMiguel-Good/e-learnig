import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import LoginForm from './components/auth/LoginForm';
import RegisterForm from './components/auth/RegisterForm';
import Dashboard from './components/Dashboard';
import AdminLayout from './components/admin/AdminLayout';
import ParticipantLayout from './components/participant/ParticipantLayout';
import CompanyManagerLayout from './components/company-manager/CompanyManagerLayout';
import ParticipantsManagement from './components/admin/ParticipantsManagement';
import InstructorsManagement from './components/admin/InstructorsManagement';
import CoursesManagement from './components/admin/CoursesManagement';
import AssignmentsManagement from './components/admin/AssignmentsManagement';
import MyCourses from './components/participant/MyCourses';
import MyCertificates from './components/participant/MyCertificates';
import CompaniesManagement from './components/admin/CompaniesManagement'
import CompanyResponsiblesManagement from './components/admin/CompanyResponsiblesManagement'
import EvaluationsManagement from './components/admin/EvaluationsManagement'
import AttendanceManagement from './components/admin/AttendanceManagement'
import ReportsManagement from './components/admin/ReportsManagement'
import CompanyParticipantsManagement from './components/company-manager/CompanyParticipantsManagement'
import CompanyAttendanceManagement from './components/company-manager/CompanyAttendanceManagement'
import CompanyReportsManagement from './components/company-manager/CompanyReportsManagement'

function AuthWrapper() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  const redirectPath = user.role === 'admin' ? '/admin' :
                       user.role === 'company_manager' ? '/company-manager' :
                       '/participant';

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to={redirectPath} replace />} />

        {/* Admin Routes */}
        {user.role === 'admin' && (
          <Route path="/admin/*" element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="participants" element={<ParticipantsManagement />} />
            <Route path="instructors" element={<InstructorsManagement />} />
            <Route path="courses" element={<CoursesManagement />} />
            <Route path="assignments" element={<AssignmentsManagement />} />
            <Route path="evaluations" element={<EvaluationsManagement />} />
            <Route path="companies" element={<CompaniesManagement />} />
            <Route path="company-responsibles" element={<CompanyResponsiblesManagement />} />
            <Route path="attendance" element={<AttendanceManagement />} />
            <Route path="reports" element={<ReportsManagement />} />
          </Route>
        )}

        {/* Company Manager Routes */}
        {user.role === 'company_manager' && (
          <Route path="/company-manager/*" element={<CompanyManagerLayout />}>
            <Route index element={<MyCourses />} />
            <Route path="certificates" element={<MyCertificates />} />
            <Route path="participants" element={<CompanyParticipantsManagement />} />
            <Route path="attendance" element={<CompanyAttendanceManagement />} />
            <Route path="reports" element={<CompanyReportsManagement />} />
          </Route>
        )}

        {/* Participant Routes */}
        {user.role === 'participant' && (
          <Route path="/participant/*" element={<ParticipantLayout />}>
            <Route index element={<MyCourses />} />
            <Route path="certificates" element={<MyCertificates />} />
          </Route>
        )}

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AuthWrapper />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#1f2937',
              color: '#fff',
            },
          }}
        />
      </AuthProvider>
    </Router>
  );
}

export default App;
