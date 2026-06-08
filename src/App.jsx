import Header from "./components/Header"
import Hero from "./components/Hero"
import Dashboard from "./pages/Dashboard"
import { Routes, Route, Navigate } from "react-router-dom"
import Incidents from "./pages/Incidents"
import Analytics from "./pages/Analytics"
import Docs from "./pages/Docs"
import EmergencyProtocol from "./pages/EmergencyProtocol"

const ProtectedRoute = ({ children }) => {
  const auth = localStorage.getItem('auth');
  if (!auth) {
    return <Navigate to="/" replace />;
  }
  return children;
};

const PublicRoute = ({ children }) => {
  const auth = localStorage.getItem('auth');
  if (auth) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

export default function App() {
  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Header />
      <Routes>
        <Route path="/" element={<PublicRoute><Hero /></PublicRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/incidents" element={<ProtectedRoute><Incidents /></ProtectedRoute>} />
        <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
        <Route path="/docs" element={<ProtectedRoute><Docs /></ProtectedRoute>} />
        <Route path="/emergency" element={<ProtectedRoute><EmergencyProtocol /></ProtectedRoute>} />
      </Routes>
    </div>
  )
}