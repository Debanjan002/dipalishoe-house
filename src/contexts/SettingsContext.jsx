import React, { createContext, useState, useContext, useEffect } from 'react';

const SettingsContext = createContext();

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

export const SettingsProvider = ({ children }) => {
  const [shopSettings, setShopSettings] = useState({
    name: 'Sharma Shoe Palace',
    address: 'Shop No. 15, Gandhi Market, Connaught Place, New Delhi - 110001',
    phone: '+91 98765 43210',
    email: 'info@sharmashoes.com',
    logo: '',
    taxRate: 18.0,
    gstNumber: '07AABCS1234F1Z5'
  });

  const [printerSettings, setPrinterSettings] = useState({
    paperSize: '40mm',
    printerModel: 'Epson TM-T20',
    printLogo: true,
    printTax: true,
    receiptFormat: {
      headerText: 'Thank you for shopping with us!',
      footerText: 'Visit again soon!',
      footerImage: '',
      footerImageSize: { width: 30, height: 15 },
      footerImagePosition: 'center',
      fontFamily: 'monospace',
      fontSize: '8px',
      headerFontSize: '10px',
      footerFontSize: '7px',
      showGST: true,
      showBarcode: true,
      customMessage: 'Exchange policy: 7 days with bill'
    }
  });

  useEffect(() => {
    loadSettings();
    initializeUsers();
  }, []);

  const loadSettings = () => {
    const storedShopSettings = localStorage.getItem('pos_shop_settings');
    const storedPrinterSettings = localStorage.getItem('pos_printer_settings');

    if (storedShopSettings) {
      setShopSettings(JSON.parse(storedShopSettings));
    }

    if (storedPrinterSettings) {
      setPrinterSettings(JSON.parse(storedPrinterSettings));
    }
  };

  const initializeUsers = () => {
    const users = localStorage.getItem('pos_users');
    if (!users) {
      // Create default admin user
      const defaultUsers = [
        {
          id: '1',
          name: 'Admin User',
          email: 'admin@store.com',
          password: 'admin123',
          role: 'admin'
        },
        {
          id: '2',
          name: 'Cashier',
          email: 'cashier@store.com',
          password: 'cashier123',
          role: 'cashier'
        }
      ];
      localStorage.setItem('pos_users', JSON.stringify(defaultUsers));
    }
  };

  const updateShopSettings = (newSettings) => {
    setShopSettings(newSettings);
    localStorage.setItem('pos_shop_settings', JSON.stringify(newSettings));
  };

  const updatePrinterSettings = (newSettings) => {
    setPrinterSettings(newSettings);
    localStorage.setItem('pos_printer_settings', JSON.stringify(newSettings));
  };

  const value = {
    shopSettings,
    printerSettings,
    updateShopSettings,
    updatePrinterSettings
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};