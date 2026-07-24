import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Chats from './pages/Chats';
import Contacts from './pages/Contacts';
import Channels from './pages/Channels';
import ChannelDetail from './pages/ChannelDetail';
import Tickets from './pages/Tickets';
import Workflows from './pages/Workflows';
import Settings from './pages/Settings';
import DashboardLayout from './components/DashboardLayout';
import { useAuth } from './hooks/useAuth.jsx';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen bg-[#111b21] text-white">Loading...</div>;
  if (!user) return <Navigate to="/" replace />;
  return children;
};

const App = () => {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/chats" replace /> : <Login />} />
      
      <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
        <Route path="/chats" element={<Chats />} />
        <Route path="/contacts" element={<Contacts />} />
        <Route path="/channels" element={<Channels />} />
        <Route path="/channels/:id" element={<ChannelDetail />} />
        <Route path="/tickets" element={<Tickets />} />
        <Route path="/workflows" element={<Workflows />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  );
};

export default App;
