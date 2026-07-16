import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, CreditCard, ArrowLeftRight,
  Wallet, ShieldCheck, LogOut, Landmark,
  User, Settings, X, Menu, Users, BarChart2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/dashboard',      label: 'Dashboard',      icon: LayoutDashboard },
  { to: '/analytics',      label: 'Analytics',      icon: BarChart2 },
  { to: '/accounts',       label: 'Accounts',       icon: Wallet },
  { to: '/transactions',   label: 'Transactions',   icon: ArrowLeftRight },
  { to: '/beneficiaries',  label: 'Beneficiaries',  icon: Users },
  { to: '/loans',          label: 'Loans',          icon: Landmark },
  { to: '/fds',            label: 'Fixed Deposits', icon: CreditCard },
  { to: '/cards',          label: 'Cards',          icon: CreditCard },
  { to: '/profile',        label: 'Profile',        icon: User },
  { to: '/settings',       label: 'Settings',       icon: Settings },
];

export const Sidebar = () => {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close sidebar on route change (mobile)
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <>
      {/* Hamburger button (mobile only) */}
      <button
        className="hamburger"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation menu"
      >
        <Menu size={20} />
      </button>

      {/* Dark overlay when sidebar is open on mobile */}
      <div
        className={`sidebar-overlay ${mobileOpen ? 'open' : ''}`}
        onClick={() => setMobileOpen(false)}
      />

      {/* Sidebar */}
      <nav className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 36, height: 36,
                background: 'linear-gradient(135deg, #3b82f6, #818cf8)',
                borderRadius: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Landmark size={18} color="white" />
              </div>
              <div>
                <h1>QuantaBank</h1>
                <p>Internet Banking</p>
              </div>
            </div>
            {/* Mobile close button */}
            <button
              onClick={() => setMobileOpen(false)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', display: 'flex', padding: 4,
              }}
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}

          {isAdmin && (
            <>
              <div style={{
                padding: '8px 24px 4px',
                fontSize: '10px', color: 'var(--text-muted)',
                letterSpacing: '1px', fontWeight: 600,
                textTransform: 'uppercase', marginTop: 8,
              }}>
                Admin
              </div>
              <NavLink
                to="/admin"
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              >
                <ShieldCheck size={18} />
                Admin Panel
              </NavLink>
            </>
          )}
        </div>

        {/* User info + logout */}
        <div style={{ padding: '16px 12px 0', borderTop: '1px solid var(--border)' }}>
          <div style={{
            padding: '12px 12px', borderRadius: 12,
            background: 'var(--bg-card)', marginBottom: 8,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'linear-gradient(135deg, #3b82f6, #818cf8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, color: 'white', marginBottom: 8,
            }}>
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              {user?.firstName} {user?.lastName}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {user?.email}
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="nav-item"
            style={{ width: '100%', border: 'none', cursor: 'pointer', color: 'var(--danger)' }}
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </nav>
    </>
  );
};
