/**
 * Peta route aplikasi (Issue 036/038): guard peran dipasang di sini, bukan di dalam halaman.
 * Setiap halaman dimuat `React.lazy` (Issue 034 langkah 5) supaya JS awal tetap kecil;
 * `LoginPage` tetap eager karena menjadi rute pertama bagi pengguna yang belum masuk.
 */
import { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppLayout, LoadingBlock } from './components/AppLayout';
import { ProtectedRoute, PublicOnlyRoute } from './lib/auth';
import { LoginPage } from './pages/LoginPage';

const AdminPage = lazy(() => import('./pages/AdminPage').then((m) => ({ default: m.AdminPage })));
const CategoriesPage = lazy(() => import('./pages/CategoriesPage').then((m) => ({ default: m.CategoriesPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage').then((m) => ({ default: m.PrivacyPage })));
const RecommendationsPage = lazy(() => import('./pages/RecommendationsPage').then((m) => ({ default: m.RecommendationsPage })));
const RegisterPage = lazy(() => import('./pages/RegisterPage').then((m) => ({ default: m.RegisterPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const TaskFormPage = lazy(() => import('./pages/TaskFormPage').then((m) => ({ default: m.TaskFormPage })));
const TaskListPage = lazy(() => import('./pages/TaskListPage').then((m) => ({ default: m.TaskListPage })));

export function App() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicOnlyRoute>
              <LoginPage />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicOnlyRoute>
              <RegisterPage />
            </PublicOnlyRoute>
          }
        />
        <Route path="/privasi" element={<PrivacyPage />} />

        <Route
          element={
            <ProtectedRoute roles={['MAHASISWA']}>
              <AppLayout titleKey="nav.home" />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<DashboardPage />} />
        </Route>

        <Route
          element={
            <ProtectedRoute roles={['MAHASISWA']}>
              <AppLayout titleKey="nav.kuliah" />
            </ProtectedRoute>
          }
        >
          <Route path="/tugas-kuliah" element={<TaskListPage scope="kuliah" />} />
        </Route>

        <Route
          element={
            <ProtectedRoute roles={['MAHASISWA']}>
              <AppLayout titleKey="nav.pribadi" />
            </ProtectedRoute>
          }
        >
          <Route path="/tugas-pribadi" element={<TaskListPage scope="pribadi" />} />
        </Route>

        <Route
          element={
            <ProtectedRoute roles={['MAHASISWA']}>
              <AppLayout titleKey="nav.ai" />
            </ProtectedRoute>
          }
        >
          <Route path="/ai" element={<RecommendationsPage />} />
        </Route>

        <Route
          element={
            <ProtectedRoute roles={['MAHASISWA']}>
              <AppLayout titleKey="nav.categories" />
            </ProtectedRoute>
          }
        >
          <Route path="/kategori" element={<CategoriesPage />} />
        </Route>

        <Route
          element={
            <ProtectedRoute roles={['MAHASISWA']}>
              <AppLayout titleKey="tasks.form.add" />
            </ProtectedRoute>
          }
        >
          <Route path="/tugas/baru" element={<TaskFormPage mode="create" />} />
        </Route>

        <Route
          element={
            <ProtectedRoute roles={['MAHASISWA']}>
              <AppLayout titleKey="tasks.form.edit" />
            </ProtectedRoute>
          }
        >
          <Route path="/tugas/:id/edit" element={<TaskFormPage mode="edit" />} />
        </Route>

        <Route
          element={
            <ProtectedRoute roles={['MAHASISWA', 'SUPERADMIN']}>
              <AppLayout titleKey="nav.settings" />
            </ProtectedRoute>
          }
        >
          <Route path="/pengaturan" element={<SettingsPage />} />
        </Route>

        <Route
          element={
            <ProtectedRoute roles={['SUPERADMIN']}>
              <AppLayout titleKey="nav.admin" />
            </ProtectedRoute>
          }
        >
          <Route path="/admin" element={<AdminPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
