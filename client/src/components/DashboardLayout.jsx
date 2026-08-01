import React, { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { 
  MessageSquare, 
  Users, 
  Users2 as GroupIcon,
  Radio, 
  Ticket, 
  Workflow, 
  Settings, 
  LogOut,
  Menu,
  X
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth.jsx';

const DashboardLayout = () => {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const navItems = [
    { path: '/chats', icon: MessageSquare, label: 'Conversations' },
    { path: '/contacts', icon: Users, label: 'Contacts' },
    { path: '/groups', icon: GroupIcon, label: 'Groups' },
    { path: '/channels', icon: Radio, label: 'Channels' },
    { path: '/tickets', icon: Ticket, label: 'Tickets' },
    { path: '/workflows', icon: Workflow, label: 'Workflows' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ];

  const pageTitle = navItems.find(item => location.pathname.startsWith(item.path))?.label || 'Dashboard';

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-64 bg-[#111b21] text-gray-300 transform transition-transform duration-300 ease-in-out lg:static lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        flex flex-col
      `}>
        {/* User Profile Area */}
        <div className="p-4 border-b border-gray-800 bg-[#1f2c34] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white font-bold text-lg">
              {user?.firstName?.charAt(0) || 'U'}
            </div>
            <div className="overflow-hidden">
              <p className="text-white font-medium truncate">{user?.firstName} {user?.lastName}</p>
              <p className="text-xs text-green-500 truncate">{user?.tenantName || 'Tenant Owner'}</p>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-2">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors
                ${isActive 
                  ? 'bg-green-600/10 text-green-500 font-medium' 
                  : 'hover:bg-gray-800 hover:text-white'
                }
              `}
              onClick={() => setSidebarOpen(false)}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-gray-800">
          <button 
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2.5 w-full text-left rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="bg-white border-b border-gray-200 p-4 flex items-center gap-4 lg:hidden">
          <button 
            onClick={() => setSidebarOpen(true)}
            className="p-1 text-gray-600 hover:bg-gray-100 rounded-md"
          >
            <Menu size={24} />
          </button>
          <h1 className="text-lg font-semibold text-gray-800">{pageTitle}</h1>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-hidden relative">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
