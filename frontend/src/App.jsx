import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';

// Pages
import LoginPage from './pages/LoginPage';
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminAuctions from './pages/admin/AdminAuctions';
import AdminCreateAuction from './pages/admin/AdminCreateAuction';
import AdminPlayers from './pages/admin/AdminPlayers';
import AdminTeams from './pages/admin/AdminTeams';
import AdminLiveAuction from './pages/admin/AdminLiveAuction';
import AdminResults from './pages/admin/AdminResults';
import AdminBidHistory from './pages/admin/AdminBidHistory';
import CaptainLayout from './pages/captain/CaptainLayout';
import CaptainLive from './pages/captain/CaptainLive';
import CaptainTeam from './pages/captain/CaptainTeam';
import ViewerLive from './pages/viewer/ViewerLive';
import MobileLiveView from './pages/viewer/MobileLiveView';
import LandingPage from './pages/LandingPage';

function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="spinner" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role && user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/viewer" element={<ViewerLive />} />
          <Route path="/live/:auctionId" element={<ViewerLive />} />
          <Route path="/mobile" element={<MobileLiveView />} />
          <Route path="/mobile/:auctionId" element={<MobileLiveView />} />

          <Route path="/admin" element={
            <ProtectedRoute role="admin">
              <AdminLayout />
            </ProtectedRoute>
          }>
            <Route index element={<AdminDashboard />} />
            <Route path="auctions" element={<AdminAuctions />} />
            <Route path="auctions/create" element={<AdminCreateAuction />} />
            <Route path="players" element={<AdminPlayers />} />
            <Route path="auctions/:id/players" element={<AdminPlayers />} />
            <Route path="auctions/:id/teams" element={<AdminTeams />} />
            <Route path="auctions/:id/live" element={<AdminLiveAuction />} />
            <Route path="auctions/:id/results" element={<AdminResults />} />
            <Route path="auctions/:id/bids" element={<AdminBidHistory />} />
          </Route>

          <Route path="/captain" element={
            <ProtectedRoute role="captain">
              <CaptainLayout />
            </ProtectedRoute>
          }>
            <Route index element={<CaptainLive />} />
            <Route path="team" element={<CaptainTeam />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </SocketProvider>
    </AuthProvider>
  );
}
