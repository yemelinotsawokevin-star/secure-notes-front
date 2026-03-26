import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';
import './App.css';

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('user')) || null;
  } catch {
    return null;
  }
}

function AdminRoute({ children }) {
  const user = getStoredUser();
  const token = localStorage.getItem('token');

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function AppContent() {
  const user = getStoredUser();
  const token = localStorage.getItem('token');
  const location = useLocation();

  const isLoginPage = location.pathname === '/login';

  return (
    <div className="app-container">
      <h1 className="app-title">📝 SecureNotes</h1>

      {!isLoginPage && token && user?.role === 'admin' && (
        <div className="app-nav">
          <Link to="/admin" className="app-link">
            Panneau d'administration
          </Link>
        </div>
      )}

      <Routes>
        <Route
          path="/"
          element={<Navigate to={token ? '/dashboard' : '/login'} replace />}
        />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          }
        />
        <Route
          path="*"
          element={<Navigate to={token ? '/dashboard' : '/login'} replace />}
        />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;