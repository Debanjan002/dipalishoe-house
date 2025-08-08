import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { InventoryProvider } from './contexts/InventoryContext';
import { SettingsProvider } from './contexts/SettingsContext';
import Login from './components/Login';
import Layout from './components/Layout';
import POS from './components/POS';
import Inventory from './components/Inventory';
import Reports from './components/Reports';
import Users from './components/Users';
import Settings from './components/Settings';

const AppContent = () => {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState('pos');

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const renderCurrentView = () => {
    switch (currentView) {
      case 'pos':
        return <POS />;
      case 'inventory':
        return user.role === 'admin' ? <Inventory /> : <POS />;
      case 'reports':
        return user.role === 'admin' ? <Reports /> : <POS />;
      case 'users':
        return user.role === 'admin' ? <Users /> : <POS />;
      case 'settings':
        return user.role === 'admin' ? <Settings /> : <POS />;
      default:
        return <POS />;
    }
  };

  return (
    <Layout currentView={currentView} setCurrentView={setCurrentView}>
      {renderCurrentView()}
    </Layout>
  );
};

function App() {
  return (
    <AuthProvider>
      <InventoryProvider>
        <SettingsProvider>
          <AppContent />
        </SettingsProvider>
      </InventoryProvider>
    </AuthProvider>
  );
}

export default App;