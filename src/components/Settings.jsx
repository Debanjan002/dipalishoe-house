import React, { useState } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { 
  Store, 
  Printer, 
  Save, 
  Upload,
  Settings as SettingsIcon,
  MapPin,
  Phone,
  Mail,
  Download
} from 'lucide-react';

const Settings = () => {
  const { shopSettings, printerSettings, updateShopSettings, updatePrinterSettings } = useSettings();
  const [activeTab, setActiveTab] = useState('shop');
  const [tempShopSettings, setTempShopSettings] = useState(shopSettings);
  const [tempPrinterSettings, setTempPrinterSettings] = useState(printerSettings);

  const handleShopSave = () => {
    updateShopSettings(tempShopSettings);
    alert('Shop settings saved successfully!');
  };

  const handlePrinterSave = () => {
    updatePrinterSettings(tempPrinterSettings);
    alert('Printer settings saved successfully!');
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setTempShopSettings({
          ...tempShopSettings,
          logo: e.target.result
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const tabs = [
    { id: 'shop', label: 'Shop Details', icon: Store },
    { id: 'printer', label: 'Printer Settings', icon: Printer },
    { id: 'data', label: 'Data Management', icon: SettingsIcon }
  ];

  const exportData = () => {
    const data = {
      products: JSON.parse(localStorage.getItem('pos_products') || '[]'),
      sales: JSON.parse(localStorage.getItem('pos_sales') || '[]'),
      users: JSON.parse(localStorage.getItem('pos_users') || '[]'),
      settings: {
        shop: shopSettings,
        printer: printerSettings
      }
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shoe-shop-data-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        
        if (data.products) localStorage.setItem('pos_products', JSON.stringify(data.products));
        if (data.sales) localStorage.setItem('pos_sales', JSON.stringify(data.sales));
        if (data.users) localStorage.setItem('pos_users', JSON.stringify(data.users));
        if (data.settings?.shop) updateShopSettings(data.settings.shop);
        if (data.settings?.printer) updatePrinterSettings(data.settings.printer);
        
        alert('Data imported successfully! Please refresh the page.');
      } catch (error) {
        alert('Error importing data. Please check the file format.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-blue-600" />
          Settings
        </h1>
        <p className="text-gray-600 mt-1">Configure your store settings and preferences</p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="border-b">
          <nav className="flex">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'shop' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Shop Name *
                  </label>
                  <div className="relative">
                    <Store className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      value={tempShopSettings.name}
                      onChange={(e) => setTempShopSettings({...tempShopSettings, name: e.target.value})}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Sharma Shoe Palace"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="tel"
                      value={tempShopSettings.phone}
                      onChange={(e) => setTempShopSettings({...tempShopSettings, phone: e.target.value})}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="+91 98765 43210"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="email"
                      value={tempShopSettings.email}
                      onChange={(e) => setTempShopSettings({...tempShopSettings, email: e.target.value})}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="info@sharmashoes.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    GST/Tax Rate (%) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={tempShopSettings.taxRate}
                    onChange={(e) => setTempShopSettings({...tempShopSettings, taxRate: parseFloat(e.target.value)})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="18"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Enter total GST rate (e.g., 18 for 18% GST = 9% CGST + 9% SGST). This will apply to all sales.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    GST Number
                  </label>
                  <input
                    type="text"
                    value={tempShopSettings.gstNumber}
                    onChange={(e) => setTempShopSettings({...tempShopSettings, gstNumber: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="07AABCS1234F1Z5"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Shop Address
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 text-gray-400 w-4 h-4" />
                  <textarea
                    value={tempShopSettings.address}
                    onChange={(e) => setTempShopSettings({...tempShopSettings, address: e.target.value})}
                    rows="3"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Shop No. 15, Gandhi Market, Connaught Place, New Delhi - 110001"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Shop Logo
                </label>
                <div className="flex items-center gap-4">
                  {tempShopSettings.logo && (
                    <img
                      src={tempShopSettings.logo}
                      alt="Shop Logo"
                      className="w-16 h-16 object-contain border border-gray-300 rounded-lg"
                    />
                  )}
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                      id="logo-upload"
                    />
                    <label
                      htmlFor="logo-upload"
                      className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <Upload className="w-4 h-4" />
                      {tempShopSettings.logo ? 'Change Logo' : 'Upload Logo'}
                    </label>
                    <p className="text-xs text-gray-500 mt-1">
                      Recommended: Square format, PNG or JPG
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleShopSave}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 font-medium"
                >
                  <Save className="w-4 h-4" />
                  Save Settings
                </button>
              </div>
            </div>
          )}

          {activeTab === 'printer' && (
            <div className="space-y-6">
              {/* Basic Printer Settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Paper Size
                  </label>
                  <select
                    value={tempPrinterSettings.paperSize}
                    onChange={(e) => setTempPrinterSettings({...tempPrinterSettings, paperSize: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="40mm">40mm (Thermal)</option>
                    <option value="58mm">58mm</option>
                    <option value="80mm">80mm</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Printer Model
                  </label>
                  <select
                    value={tempPrinterSettings.printerModel}
                    onChange={(e) => setTempPrinterSettings({...tempPrinterSettings, printerModel: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="Epson TM-T20">Epson TM-T20</option>
                    <option value="Epson TM-T88V">Epson TM-T88V</option>
                    <option value="Star TSP143">Star TSP143</option>
                    <option value="Bixolon SRP-350">Bixolon SRP-350</option>
                    <option value="Generic">Generic Thermal Printer</option>
                  </select>
                </div>
              </div>

              <div className="space-y-6">
                <h3 className="text-lg font-medium text-gray-900">Receipt Options</h3>
                
                <div className="space-y-3">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={tempPrinterSettings.printLogo}
                      onChange={(e) => setTempPrinterSettings({...tempPrinterSettings, printLogo: e.target.checked})}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Print shop logo on receipts</span>
                  </label>

                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={tempPrinterSettings.printTax}
                      onChange={(e) => setTempPrinterSettings({...tempPrinterSettings, printTax: e.target.checked})}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Show GST breakdown (CGST/SGST)</span>
                  </label>

                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={tempPrinterSettings.receiptFormat?.showBarcode}
                      onChange={(e) => setTempPrinterSettings({
                        ...tempPrinterSettings, 
                        receiptFormat: {...tempPrinterSettings.receiptFormat, showBarcode: e.target.checked}
                      })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Show barcode on receipts</span>
                  </label>
                </div>
              </div>

              {/* Receipt Format Customization */}
              <div className="space-y-6 border-t pt-6">
                <h3 className="text-lg font-medium text-gray-900">Receipt Format Customization</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Font Family
                    </label>
                    <select
                      value={tempPrinterSettings.receiptFormat?.fontFamily || 'monospace'}
                      onChange={(e) => setTempPrinterSettings({
                        ...tempPrinterSettings,
                        receiptFormat: {...tempPrinterSettings.receiptFormat, fontFamily: e.target.value}
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="monospace">Monospace</option>
                      <option value="Arial, sans-serif">Arial</option>
                      <option value="Times New Roman, serif">Times New Roman</option>
                      <option value="Courier New, monospace">Courier New</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Font Size
                    </label>
                    <select
                      value={tempPrinterSettings.receiptFormat?.fontSize || '12px'}
                      onChange={(e) => setTempPrinterSettings({
                        ...tempPrinterSettings,
                        receiptFormat: {...tempPrinterSettings.receiptFormat, fontSize: e.target.value}
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="6px">6px (Very Small)</option>
                      <option value="7px">7px (Small)</option>
                      <option value="8px">8px (Compact)</option>
                      <option value="10px">10px</option>
                      <option value="12px">12px</option>
                      <option value="14px">14px</option>
                      <option value="16px">16px</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Header Font Size
                    </label>
                    <select
                      value={tempPrinterSettings.receiptFormat?.headerFontSize || '14px'}
                      onChange={(e) => setTempPrinterSettings({
                        ...tempPrinterSettings,
                        receiptFormat: {...tempPrinterSettings.receiptFormat, headerFontSize: e.target.value}
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="8px">8px</option>
                      <option value="10px">10px</option>
                      <option value="12px">12px</option>
                      <option value="14px">14px</option>
                      <option value="16px">16px</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Footer Font Size
                    </label>
                    <select
                      value={tempPrinterSettings.receiptFormat?.footerFontSize || '10px'}
                      onChange={(e) => setTempPrinterSettings({
                        ...tempPrinterSettings,
                        receiptFormat: {...tempPrinterSettings.receiptFormat, footerFontSize: e.target.value}
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="6px">6px</option>
                      <option value="7px">7px</option>
                      <option value="8px">8px</option>
                      <option value="10px">10px</option>
                      <option value="12px">12px</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Header Text
                  </label>
                  <input
                    type="text"
                    value={tempPrinterSettings.receiptFormat?.headerText || ''}
                    onChange={(e) => setTempPrinterSettings({
                      ...tempPrinterSettings,
                      receiptFormat: {...tempPrinterSettings.receiptFormat, headerText: e.target.value}
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Thank you for shopping with us!"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Footer Text
                  </label>
                  <input
                    type="text"
                    value={tempPrinterSettings.receiptFormat?.footerText || ''}
                    onChange={(e) => setTempPrinterSettings({
                      ...tempPrinterSettings,
                      receiptFormat: {...tempPrinterSettings.receiptFormat, footerText: e.target.value}
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Visit again soon!"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Custom Message
                  </label>
                  <textarea
                    value={tempPrinterSettings.receiptFormat?.customMessage || ''}
                    onChange={(e) => setTempPrinterSettings({
                      ...tempPrinterSettings,
                      receiptFormat: {...tempPrinterSettings.receiptFormat, customMessage: e.target.value}
                    })}
                    rows="2"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Exchange policy: 7 days with bill"
                  />
                </div>

                {/* Footer Image Settings */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900">Footer Image Settings</h4>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Footer Image
                    </label>
                    <div className="flex items-center gap-4">
                      {tempPrinterSettings.receiptFormat?.footerImage && (
                        <img
                          src={tempPrinterSettings.receiptFormat.footerImage}
                          alt="Footer"
                          className="w-16 h-16 object-contain border border-gray-300 rounded-lg"
                        />
                      )}
                      <div className="flex-1">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (e) => {
                                setTempPrinterSettings({
                                  ...tempPrinterSettings,
                                  receiptFormat: {
                                    ...tempPrinterSettings.receiptFormat,
                                    footerImage: e.target.result
                                  }
                                });
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                          className="hidden"
                          id="footer-image-upload"
                        />
                        <label
                          htmlFor="footer-image-upload"
                          className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                        >
                          <Upload className="w-4 h-4" />
                          Upload Footer Image
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Image Width (px)
                      </label>
                      <input
                        type="number"
                        value={tempPrinterSettings.receiptFormat?.footerImageSize?.width || 30}
                        onChange={(e) => setTempPrinterSettings({
                          ...tempPrinterSettings,
                          receiptFormat: {
                            ...tempPrinterSettings.receiptFormat,
                            footerImageSize: {
                              ...tempPrinterSettings.receiptFormat?.footerImageSize,
                              width: parseInt(e.target.value)
                            }
                          }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        min="10"
                        max="100"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Image Height (px)
                      </label>
                      <input
                        type="number"
                        value={tempPrinterSettings.receiptFormat?.footerImageSize?.height || 15}
                        onChange={(e) => setTempPrinterSettings({
                          ...tempPrinterSettings,
                          receiptFormat: {
                            ...tempPrinterSettings.receiptFormat,
                            footerImageSize: {
                              ...tempPrinterSettings.receiptFormat?.footerImageSize,
                              height: parseInt(e.target.value)
                            }
                          }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        min="10"
                        max="50"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Image Position
                      </label>
                      <select
                        value={tempPrinterSettings.receiptFormat?.footerImagePosition || 'center'}
                        onChange={(e) => setTempPrinterSettings({
                          ...tempPrinterSettings,
                          receiptFormat: {
                            ...tempPrinterSettings.receiptFormat,
                            footerImagePosition: e.target.value
                          }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h4 className="font-medium text-amber-900 mb-2">40mm Thermal Printer Settings</h4>
                <p className="text-sm text-amber-700 mb-3">
                  Optimized for small thermal printers. Font sizes are automatically adjusted for better readability on narrow paper.
                </p>
                <div className="text-xs text-amber-600">
                  <p>• Recommended font size: 6-8px</p>
                  <p>• Image size: 30x15px maximum</p>
                  <p>• Keep text concise for better formatting</p>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">Printer Connection</h4>
                <p className="text-sm text-blue-700 mb-3">
                  Make sure your thermal printer is connected via USB or network and has the correct drivers installed.
                </p>
                <button className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                  Test Print
                </button>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handlePrinterSave}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 font-medium"
                >
                  <Save className="w-4 h-4" />
                  Save Printer Settings
                </button>
              </div>
            </div>
          )}

          {activeTab === 'data' && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg border p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Data Management</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-900">Export Data</h4>
                    <p className="text-sm text-gray-600">
                      Export all your shop data including products, sales, users, and settings.
                    </p>
                    <button
                      onClick={exportData}
                      className="w-full bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Export All Data
                    </button>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-900">Import Data</h4>
                    <p className="text-sm text-gray-600">
                      Import data from a previously exported file. This will overwrite existing data.
                    </p>
                    <div>
                      <input
                        type="file"
                        accept=".json"
                        onChange={importData}
                        className="hidden"
                        id="import-data"
                      />
                      <label
                        htmlFor="import-data"
                        className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Upload className="w-4 h-4" />
                        Import Data
                      </label>
                    </div>
                  </div>
                </div>

                <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <h4 className="font-medium text-yellow-800 mb-2">⚠️ Important Notes</h4>
                  <ul className="text-sm text-yellow-700 space-y-1">
                    <li>• Always backup your data before importing new data</li>
                    <li>• Import will overwrite all existing data</li>
                    <li>• Make sure the import file is from the same POS system</li>
                    <li>• Refresh the page after importing data</li>
                    <li>• Returns data is also included in export/import</li>
                  </ul>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => alert('Data management settings saved!')}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 font-medium"
                >
                  <Save className="w-4 h-4" />
                  Save Settings
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;