import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  Store, ShoppingCart, Package, Settings, BarChart3, Users,
  LogOut, Menu, X, ArrowUp, ChevronRight,
} from 'lucide-react';

const Layout = ({ children, currentView, setCurrentView }) => {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const mainRef = useRef(null);
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return undefined;
    const onScroll = () => setShowBackToTop(el.scrollTop > 200);
    el.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
  }, [currentView]);

  const scrollToTop = () => {
    mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const menuItems = [
    { id: 'pos', label: 'Point of Sale', icon: ShoppingCart, roles: ['admin', 'cashier'] },
    { id: 'inventory', label: 'Inventory', icon: Package, roles: ['admin'] },
    { id: 'reports', label: 'Reports', icon: BarChart3, roles: ['admin'] },
    { id: 'users', label: 'Users', icon: Users, roles: ['admin'] },
    { id: 'settings', label: 'Settings', icon: Settings, roles: ['admin'] },
  ];

  const filteredMenuItems = menuItems.filter((item) => item.roles.includes(user?.role));
  const pageTitle = menuItems.find((item) => item.id === currentView)?.label || currentView;
  const initials = user?.name?.trim()?.charAt(0)?.toUpperCase() || 'U';

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-100">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-800 bg-slate-900 shadow-2xl transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 lg:shadow-none ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500 shadow-lg shadow-blue-950/50">
              <Store className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-bold tracking-wide text-white">DIPALI SHOE HOUSE</h1>
              <p className="mt-1 truncate text-xs capitalize text-slate-400">{user?.name || 'Store workspace'}</p>
            </div>
          </div>
          <button type="button" onClick={() => setSidebarOpen(false)} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white lg:hidden" aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 pb-2 pt-6">
          <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Workspace</p>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Main navigation">
          <div className="space-y-1.5">
            {filteredMenuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => {
                    setCurrentView(item.id);
                    setSidebarOpen(false);
                  }}
                  aria-current={isActive ? 'page' : undefined}
                  className={`group flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left text-sm font-medium transition-all duration-200 ${isActive ? 'border-blue-500/30 bg-blue-500/15 text-blue-300 shadow-sm shadow-blue-950/20' : 'border-transparent text-slate-400 hover:border-slate-700 hover:bg-slate-800/80 hover:text-slate-100'}`}
                >
                  <span className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${isActive ? 'bg-blue-500/20 text-blue-300' : 'bg-slate-800 text-slate-400 group-hover:text-slate-200'}`}>
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="flex-1">{item.label}</span>
                  {isActive && <ChevronRight className="h-4 w-4 text-blue-300" />}
                </button>
              );
            })}
          </div>
        </nav>

        <div className="mt-auto border-t border-slate-800 p-4">
          <div className="mb-4 flex min-w-0 items-center gap-3 rounded-xl bg-slate-800/70 p-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-700 bg-slate-700 text-sm font-semibold text-slate-100">{initials}</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-100">{user?.name || 'User'}</p>
              <p className="truncate text-xs text-slate-400">{user?.email || ''}</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-blue-300">{user?.role || 'Member'}</p>
            </div>
          </div>
          <button type="button" onClick={logout} className="flex w-full items-center gap-3 rounded-xl border border-transparent px-3.5 py-2.5 text-sm font-medium text-rose-300 transition hover:border-rose-500/20 hover:bg-rose-500/10 hover:text-rose-200">
            <LogOut className="h-4 w-4" />Sign Out
          </button>
          <p className="mt-4 text-center text-[11px] tracking-wide text-slate-600">BY Debanjan Pan</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="z-30 flex min-h-[76px] items-center justify-between border-b border-slate-800 bg-slate-900/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => setSidebarOpen(true)} className="rounded-xl border border-slate-700 bg-slate-800 p-2.5 text-slate-300 transition hover:bg-slate-700 hover:text-white lg:hidden" aria-label="Open navigation menu">
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <p className="hidden text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 sm:block">Dipali Shoe House</p>
              <h2 className="truncate text-lg font-semibold capitalize text-white sm:mt-0.5 sm:text-xl">{currentView === 'pos' ? 'Point of Sale' : pageTitle}</h2>
            </div>
          </div>
          <div className="ml-3 flex shrink-0 items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-xs text-slate-500">Welcome back,</p>
              <p className="max-w-44 truncate text-sm font-medium text-slate-200">{user?.name || 'User'}</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-blue-400/20 bg-blue-500/15 text-sm font-semibold text-blue-300 sm:hidden" aria-hidden="true">{initials}</div>
          </div>
        </header>

        <main ref={mainRef} className="min-h-0 flex-1 overflow-auto bg-slate-950 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-[1600px]">{children}</div>
        </main>

        {showBackToTop && (
          <button type="button" onClick={scrollToTop} className="fixed bottom-5 right-5 z-30 flex h-11 w-11 items-center justify-center rounded-xl border border-blue-400/20 bg-blue-600 text-white shadow-xl shadow-blue-950/40 transition hover:-translate-y-0.5 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-slate-950 sm:bottom-7 sm:right-7" aria-label="Back to top" title="Back to top">
            <ArrowUp className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
};

export default Layout;
