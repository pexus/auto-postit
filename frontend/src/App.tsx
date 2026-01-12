import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';

// Layouts
import { AuthLayout } from '@/layouts/AuthLayout';
import { DashboardLayout } from '@/layouts/DashboardLayout';

// Auth Pages
import { LoginPage } from '@/pages/auth/LoginPage';
import { SetupPage } from '@/pages/auth/SetupPage';
import { MfaPage } from '@/pages/auth/MfaPage';

// Dashboard Pages
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { PostsPage } from '@/pages/posts/PostsPage';
import { CreatePostPage } from '@/pages/posts/CreatePostPage';
import { PlatformsPage } from '@/pages/platforms/PlatformsPage';
import { QuotaPage } from '@/pages/quota/QuotaPage';
import { SettingsPage } from '@/pages/settings/SettingsPage';

function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Auth routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/mfa" element={<MfaPage />} />
        </Route>

        {/* Protected dashboard routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/posts" element={<PostsPage />} />
            <Route path="/posts/new" element={<CreatePostPage />} />
            <Route path="/platforms" element={<PlatformsPage />} />
            <Route path="/quota" element={<QuotaPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>

        {/* Redirect root to dashboard */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        
        {/* 404 */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      <Toaster />
    </AuthProvider>
  );
}

export default App;
