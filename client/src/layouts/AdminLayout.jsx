import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Menu, X, Users, Mail, FileImage, LogOut } from 'lucide-react';

const AdminLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/invitation/admin');
  };

  const navItems = [
    { name: 'Send Invitation', path: '/invitation/admin/send', icon: Mail },
    { name: 'Recipients', path: '/invitation/admin/recipients', icon: Users },
    { name: 'Templates', path: '/invitation/admin/templates', icon: FileImage, role: ['SUPER_ADMIN', 'ADMIN'] },
  ];

  const filteredNavItems = navItems.filter(item => !item.role || item.role.includes(user?.role));

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 shadow-sm z-10">
        <div className="h-16 flex items-center px-6 border-b border-slate-200">
          <span className="text-xl font-bold tracking-tight text-primary">Brand<span className="text-slate-800">Invites</span></span>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-1">
          {filteredNavItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                `group flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
                  isActive 
                    ? 'bg-primary/10 text-primary' 
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon size={18} className={isActive ? 'text-primary' : 'text-slate-400 group-hover:text-slate-600'} />
                  <span>{item.name}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-200">
          <button
            onClick={handleLogout}
            className="flex items-center space-x-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-red-600 transition-colors"
          >
            <LogOut size={18} className="text-slate-400" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 lg:px-8 shadow-sm z-10">
          <button
            className="md:hidden p-2 -ml-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-md"
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu size={24} />
          </button>
          
          <div className="flex-1" />
          

        </header>
        
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-50 p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setIsSidebarOpen(false)} />
          <aside className="relative w-64 max-w-sm flex flex-col bg-white h-full transform transition-transform shadow-xl">
            <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200">
              <span className="text-xl font-bold tracking-tight text-primary">Brand<span className="text-slate-800">Invites</span></span>
              <button onClick={() => setIsSidebarOpen(false)} className="p-2 -mr-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors">
                <X size={20} />
              </button>
            </div>
            <nav className="flex-1 px-4 py-6 space-y-1">
              {filteredNavItems.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.path}
                  onClick={() => setIsSidebarOpen(false)}
                  className={({ isActive }) =>
                    `group flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
                      isActive 
                        ? 'bg-primary/10 text-primary' 
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon size={18} className={isActive ? 'text-primary' : 'text-slate-400 group-hover:text-slate-600'} />
                      <span>{item.name}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
            <div className="p-4 border-t border-slate-200">
              <button
                onClick={handleLogout}
                className="flex items-center space-x-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-red-600 transition-colors"
              >
                <LogOut size={18} className="text-slate-400" />
                <span>Sign out</span>
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};

export default AdminLayout;
