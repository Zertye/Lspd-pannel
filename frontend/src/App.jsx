import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { 
  Dashboard, 
  Centrale, 
  Plaintes, 
  Roster, 
  Admin, 
  Login, 
  Landing, 
  PublicComplaint 
} from './pages';

// Composant de protection des routes
function ProtectedRoute({ children }) {
  const { user, loading, authChecked } = useAuth();
  
  if (!authChecked || loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }
  
  if (!user) return <Navigate to="/login" />;
  return children;
}

// App principal
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Routes publiques */}
          <Route path="/" element={<Landing />} />
          <Route path="/plainte" element={<PublicComplaint />} />
          <Route path="/login" element={<Login />} />
          
          {/* Routes protégées */}
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/centrale" element={<ProtectedRoute><Centrale /></ProtectedRoute>} />
          <Route path="/plaintes" element={<ProtectedRoute><Plaintes /></ProtectedRoute>} />
          <Route path="/roster" element={<ProtectedRoute><Roster /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
          
          {/* Redirection par défaut */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
