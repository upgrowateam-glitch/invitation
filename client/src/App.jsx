import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

// Layouts
import AdminLayout from './layouts/AdminLayout';

// Admin Pages
import Login from './pages/admin/Login';
import RecipientsList from './pages/admin/RecipientsList';
import TemplateEditor from './pages/admin/TemplateEditor';
import TemplateGallery from './pages/admin/TemplateGallery';
import SendInvitation from './pages/admin/SendInvitation';

// Public Pages
import InvitationPage from './pages/public/InvitationPage';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/invitation/admin" />;
  return children;
};

const AppRoutes = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/invitation/:token" element={<InvitationPage />} />
      <Route path="/invitation/admin" element={<Login />} />

      {/* Admin Routes */}
        {/* Default redirect for logged-in users at root admin */}
        <Route path="/invitation/admin/dashboard" element={<Navigate to="/invitation/admin/send" replace />} />
        <Route path="/invitation/admin/invitations" element={<Navigate to="/invitation/admin/send" replace />} />
        
        <Route path="/invitation/admin/send" element={
          <ProtectedRoute>
            <AdminLayout>
              <SendInvitation />
            </AdminLayout>
          </ProtectedRoute>
        } />
      
      <Route path="/invitation/admin/recipients" element={
        <ProtectedRoute>
          <AdminLayout>
            <RecipientsList />
          </AdminLayout>
        </ProtectedRoute>
      } />
      


      <Route path="/invitation/admin/templates" element={
        <ProtectedRoute>
          <AdminLayout>
            <TemplateGallery />
          </AdminLayout>
        </ProtectedRoute>
      } />

      <Route path="/invitation/admin/templates/select" element={
        <ProtectedRoute>
          <AdminLayout>
            <TemplateGallery />
          </AdminLayout>
        </ProtectedRoute>
      } />

      <Route path="/invitation/admin/templates/:id/edit" element={
        <ProtectedRoute>
          <AdminLayout>
            <TemplateEditor />
          </AdminLayout>
        </ProtectedRoute>
      } />

      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/invitation/admin" />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;
