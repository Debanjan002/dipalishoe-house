import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useInventory } from '../contexts/InventoryContext';
import {
  Plus,
  Edit,
  Trash2,
  Search,
  Package,
  AlertTriangle,
  X,
  Filter,
  SortAsc,
  SortDesc,
  Download,
  RefreshCw,
  Tag,
  IndianRupee,
  Package2,
  Zap,
  Upload
} from 'lucide-react';

/** ---------- Small, reusable suggest input (independent suggestions) ---------- */
const SuggestInput = ({
  label,
  value,
  onChange,
  placeholder,
  options = [],
  required = false,
  type = 'text',
  inputProps = {},
}) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const filtered = useMemo(() => {
    const v = String(value || '').toLowerCase().trim();
    const base = options.filter(Boolean);
    const unique = Array.from(new Set(base));
    if (!v) return unique.slice(0, 8);
    return unique.filter(opt => String(opt).toLowerCase().includes(v)).slice(0, 8);
  }, [options, value]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  return (
    <div className="relative" ref={wrapRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}{required ? ' *' : ''}
        </label>
      )}
      <input
        type={type}
        value={value}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        placeholder={placeholder}
        required={required}
        className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        {...inputProps}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-auto">
          {filtered.map((opt) => (
            <button
              key={String(opt)}
              type="button"
              onClick={() => { onChange(String(opt)); setOpen(false); }}
              className="w-full text-left px-3 py-2 hover:bg-blue-50"
            >
              {String(opt)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
/** --------------------------------------------------------------------------- */

const Inventory = () => {
  const {
    products,
    categories,
    addProduct,
    updateProduct,
    deleteProduct,
    getLowStockProducts
  } = useInventory();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [showFilters, setShowFilters] = useState(false);
  const [priceRange, setPriceRange] = useState({ min: '', max: '' });
  const [stockFilter, setStockFilter] = useState('all'); // all, low, out, available

  // ===== New: CSV Import modal & state =====
  const [showImportModal, setShowImportModal] = useState(false);
  const [importStatus, setImportStatus] = useState(null); // {added, skipped, errors:[]}

  // ===== New: Selection for bulk delete =====
  const [selectedIds, setSelectedIds] = useState(new Set());

  // ===== Low stock panel controls (closable + threshold) =====
  const [showLowPanel, setShowLowPanel] = useState(() => {
    const v = localStorage.getItem('low_stock_panel_hidden');
    return v === 'true' ? false : true;
  });
  const [lowStockThreshold, setLowStockThreshold] = useState(() => {
    const v = Number(localStorage.getItem('low_stock_threshold'));
    return Number.isFinite(v) && v > 0 ? v : 1; // default 1 as requested
  });

  // ------- Add/Edit Form -------
  const [formData, setFormData] = useState({
    name: '',
    barcode: '',
    price: '',
    stock: '',
    category: '',
    description: '',
    size: '',
    brand: '',
    minStock: '1',   // default 1 as requested
    supplier: '',
    purchasePrice: '',
    margin: ''
  });

  const [barcodeAuto, setBarcodeAuto] = useState(true);

  // Independent suggestions
  const uniqueByFrequency = (arr) => {
    const map = new Map();
    arr.forEach(v => {
      if (!v && v !== 0) return;
      const key = String(v);
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries())
      .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
      .map(([k]) => k);
  };

  const nameOptions = useMemo(
    () => uniqueByFrequency(products.map(p => p.name).filter(Boolean)),
    [products]
  );
  const brandOptions = useMemo(
    () => uniqueByFrequency(products.map(p => p.brand).filter(Boolean)),
    [products]
  );
  const sizeOptions = useMemo(
    () => uniqueByFrequency(products.map(p => p.size).filter(Boolean)),
    [products]
  );
  const supplierOptions = useMemo(
    () => uniqueByFrequency(products.map(p => p.supplier).filter(Boolean)),
    [products]
  );
  const priceOptions = useMemo(
    () => uniqueByFrequency(products.map(p => p.price).filter(v => v !== undefined && v !== null)),
    [products]
  );
  const purchasePriceOptions = useMemo(
    () => uniqueByFrequency(products.map(p => p.purchasePrice).filter(v => v !== undefined && v !== null)),
    [products]
  );

  // ===== Helper: barcode deduping for any operation (add/import) =====
  const norm = (s) => (s || '').trim().toLowerCase();
  const ucAlnum = (s) => (s || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const makeBaseBarcode = (name, brand) => {
    const namePart = ucAlnum(name);
    const brandPart = ucAlnum(brand || 'GEN');
    if (!namePart) return '';
    return `${namePart}_${brandPart}`;
  };
  const existingBarcodesSet = useMemo(
    () => new Set(products.map(p => norm(p.barcode)).filter(Boolean)),
    [products]
  );
  const dedupeBarcode = (desired, setRef) => {
    if (!desired) return '';
    const exists = setRef || existingBarcodesSet;
    if (!exists.has(norm(desired))) {
      exists.add(norm(desired));
      return desired;
    }
    let i = 1;
    let candidate = '';
    while (true) {
      const suffix = `_${String(i).padStart(2, '0')}`;
      candidate = `${desired}${suffix}`;
      if (!exists.has(norm(candidate))) {
        exists.add(norm(candidate));
        return candidate;
      }
      i += 1;
    }
  };

  // Auto-barcode on name/brand change (add mode)
  useEffect(() => {
    if (!showAddModal) return;
    if (!barcodeAuto) return;
    const base = makeBaseBarcode(formData.name, formData.brand);
    const next = base ? dedupeBarcode(base) : '';
    setFormData(prev => ({ ...prev, barcode: next }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.name, formData.brand, barcodeAuto, showAddModal]);

  /** ================= FILTERING / SORTING ================= */
  const filteredProducts = useMemo(() => {
    const filtered = products.filter(product => {
      const matchesSearch =
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(product.barcode || '').includes(searchTerm) ||
        (product.brand && product.brand.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesCategory = !selectedCategory || product.category === selectedCategory;

      const matchesPrice =
        (!priceRange.min || product.price >= parseFloat(priceRange.min)) &&
        (!priceRange.max || product.price <= parseFloat(priceRange.max));

      let matchesStock = true;
      switch (stockFilter) {
        case 'low':
          matchesStock = product.stock <= (Number.isFinite(product.minStock) ? product.minStock : lowStockThreshold);
          break;
        case 'out':
          matchesStock = product.stock === 0;
          break;
        case 'available':
          matchesStock = product.stock > 0;
          break;
        default:
          matchesStock = true;
      }

      return matchesSearch && matchesCategory && matchesPrice && matchesStock;
    });

    filtered.sort((a, b) => {
      let aValue, bValue;

      switch (sortBy) {
        case 'name': aValue = a.name.toLowerCase(); bValue = b.name.toLowerCase(); break;
        case 'price': aValue = a.price; bValue = b.price; break;
        case 'stock': aValue = a.stock; bValue = b.stock; break;
        case 'category': aValue = a.category; bValue = b.category; break;
        case 'brand': aValue = a.brand || ''; bValue = b.brand || ''; break;
        default: return 0;
      }

      if (typeof aValue === 'string') {
        return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      } else {
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      }
    });

    return filtered;
  }, [products, searchTerm, selectedCategory, priceRange, stockFilter, sortBy, sortOrder, lowStockThreshold]);

  /** ================= Stats & Low Stock ================= */
  const totalProducts = products.length;
  const totalValue = products.reduce((sum, product) => sum + (product.price * product.stock), 0);
  const outOfStockCount = products.filter(p => p.stock === 0).length;

  const lowStockProductsLocal = useMemo(
    () => products.filter(p => p.stock <= (Number.isFinite(p.minStock) ? p.minStock : lowStockThreshold)),
    [products, lowStockThreshold]
  );
  const lowStockCount = lowStockProductsLocal.length;

  /** ================= Form helpers ================= */
  const resetForm = () => {
    setFormData({
      name: '',
      barcode: '',
      price: '',
      stock: '',
      category: '',
      description: '',
      size: '',
      brand: '',
      minStock: '1',
      supplier: '',
      purchasePrice: '',
      margin: ''
    });
    setBarcodeAuto(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    let calculatedMargin = '';
    if (formData.purchasePrice && formData.price) {
      const margin = ((parseFloat(formData.price) - parseFloat(formData.purchasePrice)) / parseFloat(formData.purchasePrice)) * 100;
      calculatedMargin = margin.toFixed(2);
    }

    const productData = {
      ...formData,
      price: parseFloat(formData.price),
      stock: parseInt(formData.stock),
      minStock: parseInt(formData.minStock) || lowStockThreshold,
      purchasePrice: formData.purchasePrice ? parseFloat(formData.purchasePrice) : null,
      margin: calculatedMargin || formData.margin
    };

    if (editingProduct) {
      updateProduct(editingProduct.id, productData);
      setEditingProduct(null);
      setShowAddModal(false);
    } else {
      // Ensure unique barcode on manual/auto entry
      const desired = formData.barcode || makeBaseBarcode(formData.name, formData.brand);
      productData.barcode = desired ? dedupeBarcode(desired) : desired;
      addProduct(productData);
      resetForm(); // keep add modal open for quick add
    }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      barcode: product.barcode,
      price: product.price.toString(),
      stock: product.stock.toString(),
      category: product.category,
      description: product.description || '',
      size: product.size || '',
      brand: product.brand || '',
      minStock: (Number.isFinite(product.minStock) ? product.minStock : lowStockThreshold).toString(),
      supplier: product.supplier || '',
      purchasePrice: product.purchasePrice ? product.purchasePrice.toString() : '',
      margin: product.margin || ''
    });
    setBarcodeAuto(false);
    setShowAddModal(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('Delete this product?')) {
      deleteProduct(id);
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const openAddModal = () => {
    resetForm();
    setEditingProduct(null);
    setBarcodeAuto(true);
    setShowAddModal(true);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingProduct(null);
    resetForm();
  };

  const duplicateProduct = (product) => {
    setFormData({
      name: product.name,
      barcode: '',
      price: product.price.toString(),
      stock: '0',
      category: product.category,
      description: product.description || '',
      size: product.size || '',
      brand: product.brand || '',
      minStock: (Number.isFinite(product.minStock) ? product.minStock : lowStockThreshold).toString(),
      supplier: product.supplier || '',
      purchasePrice: product.purchasePrice ? product.purchasePrice.toString() : '',
      margin: product.margin || ''
    });
    setBarcodeAuto(true);
    setEditingProduct(null);
    setShowAddModal(true);
  };

  const exportInventory = () => {
    const csvData = [
      ['Name', 'Barcode', 'Brand', 'Category', 'Size', 'Price', 'Stock', 'Min Stock', 'Supplier', 'Purchase Price', 'Margin %', 'Description'],
      ...products.map(product => [
        product.name,
        product.barcode,
        product.brand || '',
        product.category,
        product.size || '',
        product.price,
        product.stock,
        Number.isFinite(product.minStock) ? product.minStock : '',
        product.supplier || '',
        product.purchasePrice || '',
        product.margin || '',
        (product.description || '').replace(/\n/g, ' ')
      ])
    ];
    const csvContent = csvData.map(row => row.map(cell => {
      const s = String(cell ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const calculateMargin = () => {
    if (formData.purchasePrice && formData.price) {
      const margin = ((parseFloat(formData.price) - parseFloat(formData.purchasePrice)) / parseFloat(formData.price)) * 100;
      setFormData({ ...formData, margin: margin.toFixed(2) });
    }
  };

  // ===== Bulk select helpers =====
  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());
  const deleteSelected = () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Delete ${selectedIds.size} selected product(s)?`)) return;
    Array.from(selectedIds).forEach(id => deleteProduct(id));
    clearSelection();
  };

  // ===== Low stock controls persist =====
  useEffect(() => {
    localStorage.setItem('low_stock_threshold', String(lowStockThreshold));
  }, [lowStockThreshold]);
  useEffect(() => {
    localStorage.setItem('low_stock_panel_hidden', showLowPanel ? 'false' : 'true');
  }, [showLowPanel]);

  // ===== CSV Import handling =====
  const parseCSV = (text) => {
    // Simple CSV parser with quotes support
    const rows = [];
    let i = 0, cur = '', row = [], inside = false;
    while (i < text.length) {
      const c = text[i];
      if (c === '"') {
        if (inside && text[i + 1] === '"') { cur += '"'; i += 2; continue; }
        inside = !inside; i++; continue;
      }
      if (c === ',' && !inside) { row.push(cur); cur = ''; i++; continue; }
      if ((c === '\n' || c === '\r') && !inside) {
        if (cur !== '' || row.length) { row.push(cur); rows.push(row); row = []; cur = ''; }
        // handle CRLF
        if (c === '\r' && text[i + 1] === '\n') i += 2; else i++;
        continue;
      }
      cur += c; i++;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(r => r.length && r.some(x => String(x).trim() !== ''));
  };

  const headerMap = (h) => String(h || '').trim().toLowerCase();
  const importFromCSV = async (file) => {
    setImportStatus(null);
    if (!file) return;
    const txt = await file.text();
    const rows = parseCSV(txt);
    if (rows.length < 2) {
      setImportStatus({ added: 0, skipped: 0, errors: ['CSV seems empty.'] });
      return;
    }
    const headers = rows[0].map(headerMap);
    const idx = {
      name: headers.indexOf('name'),
      barcode: headers.indexOf('barcode'),
      brand: headers.indexOf('brand'),
      category: headers.indexOf('category'),
      size: headers.indexOf('size'),
      price: headers.indexOf('price'),
      stock: headers.indexOf('stock'),
      minStock: (() => {
        const alts = ['min stock', 'min_stock', 'minstock'];
        for (const a of alts) { const k = headers.indexOf(a); if (k !== -1) return k; }
        return -1;
      })(),
      supplier: headers.indexOf('supplier'),
      purchasePrice: (() => {
        const alts = ['purchase price', 'purchase_price', 'purchaseprice'];
        for (const a of alts) { const k = headers.indexOf(a); if (k !== -1) return k; }
        return -1;
      })(),
      margin: (() => {
        const alts = ['margin %', 'margin', 'margin_percent', 'margin%'];
        for (const a of alts) { const k = headers.indexOf(a); if (k !== -1) return k; }
        return -1;
      })(),
      description: headers.indexOf('description'),
    };

    const required = ['name', 'category', 'price', 'stock'];
    const missingReq = required.filter(k => idx[k] === -1);
    if (missingReq.length) {
      setImportStatus({
        added: 0,
        skipped: 0,
        errors: [`Missing required column(s): ${missingReq.join(', ')}`]
      });
      return;
    }

    // local set for deduping barcodes during this import session
    const localBarcodes = new Set(Array.from(existingBarcodesSet));

    let added = 0, skipped = 0;
    const errors = [];

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const get = (i) => i >= 0 && i < row.length ? String(row[i]).trim() : '';
      const name = get(idx.name);
      const category = get(idx.category);
      const price = parseFloat(get(idx.price));
      const stock = parseInt(get(idx.stock));
      if (!name || !category || !Number.isFinite(price) || !Number.isFinite(stock)) {
        skipped++;
        continue;
      }
      const brand = get(idx.brand);
      const size = get(idx.size);
      const rawBarcode = get(idx.barcode) || makeBaseBarcode(name, brand);
      const barcode = rawBarcode ? dedupeBarcode(rawBarcode, localBarcodes) : '';
      const minStock = (() => {
        const v = parseInt(get(idx.minStock));
        return Number.isFinite(v) ? v : lowStockThreshold;
      })();
      const supplier = get(idx.supplier);
      const purchasePrice = parseFloat(get(idx.purchasePrice));
      const margin = get(idx.margin);
      const description = get(idx.description);

      try {
        await addProduct({
          name,
          barcode,
          brand,
          category,
          size,
          price,
          stock,
          minStock,
          supplier,
          purchasePrice: Number.isFinite(purchasePrice) ? purchasePrice : null,
          margin: margin || '',
          description: description || ''
        });
        added++;
      } catch (e) {
        errors.push(`Row ${r + 1}: ${e?.message || 'Failed to add'}`);
        skipped++;
      }
    }

    setImportStatus({ added, skipped, errors });
  };

  const downloadTemplate = () => {
    const header = ['Name','Barcode','Brand','Category','Size','Price','Stock','Min Stock','Supplier','Purchase Price','Margin %','Description'].join(',');
    const blob = new Blob([header + '\n'], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'inventory_import_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Inventory Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl shadow-sm p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100">Total Products</p>
              <p className="text-2xl font-bold">{totalProducts}</p>
            </div>
            <Package className="w-8 h-8 text-blue-200" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl shadow-sm p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100">Total Value</p>
              <p className="text-2xl font-bold">₹{totalValue.toLocaleString('en-IN')}</p>
            </div>
            <IndianRupee className="w-8 h-8 text-green-200" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl shadow-sm p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-yellow-100">Low Stock</p>
              <p className="text-2xl font-bold">{lowStockCount}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-yellow-200" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-red-500 to-red-600 rounded-xl shadow-sm p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100">Out of Stock</p>
              <p className="text-2xl font-bold">{outOfStockCount}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-200" />
          </div>
        </div>
      </div>

      {/* Low Stock Alert (closable + threshold control) */}
      {showLowPanel && lowStockProductsLocal.length > 0 && (
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl p-6">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-yellow-600" />
              <h3 className="font-semibold text-yellow-800">Low Stock Alert</h3>
            </div>

          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
            <p className="text-yellow-700">
              {lowStockProductsLocal.length} product(s) are running low on stock.
            </p>
            <div className="flex items-center gap-2">
              <label className="text-sm text-yellow-800">Low-stock threshold:</label>
              <input
                type="number"
                min="0"
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(Math.max(1, parseInt(e.target.value || '1', 10)))}
                className="w-20 px-2 py-1 border border-yellow-300 rounded"
              />
              <button
                onClick={() => setLowStockThreshold(1)}
                className="px-3 py-1 text-sm border border-yellow-300 rounded hover:bg-yellow-100"
                title="Set to 1"
              >
                Set 1
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {lowStockProductsLocal.map(product => (
              <div key={product.id} className="bg-white rounded-lg p-3 border border-yellow-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{product.name}</p>
                    <p className="text-xs text-gray-600">{product.brand} - {product.category}</p>
                  </div>
                  <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full font-medium">
                    {product.stock} left
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Header with Controls */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Package2 className="w-6 h-6 text-blue-600" />
              Inventory Management
            </h1>
            <p className="text-gray-600 mt-1">Manage your shoe inventory with fast add + global suggestions</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowImportModal(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Import CSV
            </button>
            <button
              onClick={exportInventory}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
            <button
              onClick={openAddModal}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Product
            </button>
          </div>
        </div>

        {/* Search and Filter Controls */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by name, barcode, or brand..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-3 border rounded-lg transition-colors flex items-center gap-2 ${
                showFilters ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
            </button>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Price Range</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="Min"
                      value={priceRange.min}
                      onChange={(e) => setPriceRange({ ...priceRange, min: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <input
                      type="number"
                      placeholder="Max"
                      value={priceRange.max}
                      onChange={(e) => setPriceRange({ ...priceRange, max: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Stock Status</label>
                  <select
                    value={stockFilter}
                    onChange={(e) => setStockFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">All Products</option>
                    <option value="available">In Stock</option>
                    <option value="low">Low Stock</option>
                    <option value="out">Out of Stock</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Low-stock threshold</label>
                  <input
                    type="number"
                    min="1"
                    value={lowStockThreshold}
                    onChange={(e) => setLowStockThreshold(Math.max(1, parseInt(e.target.value || '1', 10)))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
                  <div className="flex gap-2">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="name">Name</option>
                      <option value="price">Price</option>
                      <option value="stock">Stock</option>
                      <option value="category">Category</option>
                      <option value="brand">Brand</option>
                    </select>
                    <button
                      onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                      className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      {sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 items-center justify-between">
                <p className="text-sm text-gray-600">
                  Showing {filteredProducts.length} of {totalProducts} products
                </p>

                {/* Bulk actions appear when any selected */}
                {selectedIds.size > 0 ? (
                  <div className="flex gap-2">
                    <button
                      onClick={deleteSelected}
                      className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete Selected ({selectedIds.size})
                    </button>
                    <button
                      onClick={clearSelection}
                      className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Clear Selection
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setSelectedCategory('');
                      setPriceRange({ min: '', max: '' });
                      setStockFilter('all');
                    }}
                    className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Clear Filters
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredProducts.map((product) => {
          const isLow = product.stock <= (Number.isFinite(product.minStock) ? product.minStock : lowStockThreshold);
        return (
          <div key={product.id} className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  {/* Select checkbox for bulk delete */}
                  <input
                    type="checkbox"
                    checked={selectedIds.has(product.id)}
                    onChange={() => toggleSelect(product.id)}
                    className="mt-[2px]"
                    title="Select"
                  />
                  <h3 className="font-semibold text-gray-900 text-sm leading-tight">{product.name}</h3>
                  {isLow && (
                    <span className="bg-red-100 text-red-600 text-xs px-2 py-1 rounded-full">
                      Low
                    </span>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-600 flex items-center gap-1">
                    <Tag className="w-3 h-3" />
                    {product.brand} - {product.category}
                  </p>
                  {product.size && (
                    <p className="text-xs text-gray-500">Size: {product.size}</p>
                  )}
                  <p className="text-xs text-gray-500 font-mono">#{product.barcode}</p>
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => duplicateProduct(product)}
                  className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                  title="Duplicate Product"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleEdit(product)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Edit Product"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(product.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete Product"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Selling Price:</span>
                <span className="font-bold text-lg text-green-600">₹{product.price.toLocaleString('en-IN')}</span>
              </div>

              {product.purchasePrice && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Purchase Price:</span>
                  <span className="text-xs text-gray-700">₹{product.purchasePrice.toLocaleString('en-IN')}</span>
                </div>
              )}

              {product.margin && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Margin:</span>
                  <span className="text-xs font-medium text-blue-600">{product.margin}%</span>
                </div>
              )}

              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Stock:</span>
                <span className={`font-semibold ${
                  product.stock === 0 ? 'text-red-600' :
                  isLow ? 'text-yellow-600' : 'text-green-600'
                }`}>
                  {product.stock} units
                </span>
              </div>

              {product.supplier && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Supplier:</span>
                  <span className="text-xs text-gray-700">{product.supplier}</span>
                </div>
              )}
            </div>

            {product.description && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs text-gray-600 line-clamp-2">
                  {product.description}
                </p>
              </div>
            )}
          </div>
        )})}
      </div>

      {filteredProducts.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-gray-900 mb-2">No shoes found</h3>
          <p className="text-gray-600 mb-4">
            {searchTerm || selectedCategory || priceRange.min || priceRange.max || stockFilter !== 'all'
              ? 'Try adjusting your search or filter criteria'
              : 'Get started by adding your first shoe to the inventory'
            }
          </p>
          <button
            onClick={openAddModal}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto"
          >
            <Plus className="w-5 h-5" />
            Add First Product
          </button>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {editingProduct ? 'Edit Shoe Product' : 'Add New Shoe Product'}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Suggestions are global (from all products). Barcode auto-fills as <b>NAME_BRAND</b>.
                </p>
              </div>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900 flex items-center gap-2">
                  <Package className="w-4 h-4 text-blue-600" />
                  Basic Information
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SuggestInput
                    label="Shoe Name"
                    value={formData.name}
                    onChange={(v) => setFormData({ ...formData, name: v })}
                    placeholder="e.g., Bata Men's Formal Black Leather Shoes"
                    options={nameOptions}
                    required
                  />

                  <div>
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Barcode/SKU *
                      </label>
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={barcodeAuto}
                          onChange={(e) => setBarcodeAuto(e.target.checked)}
                        />
                        Auto
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={formData.barcode}
                        onChange={(e) => {
                          setBarcodeAuto(false);
                          setFormData({ ...formData, barcode: e.target.value });
                        }}
                        className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                        placeholder="AUTO: NAME_BRAND"
                        required
                      />
                      <button
                        type="button"
                        title="Regenerate"
                        onClick={() => {
                          const base = makeBaseBarcode(formData.name, formData.brand);
                          const next = base ? dedupeBarcode(base) : '';
                          setBarcodeAuto(true);
                          setFormData(prev => ({ ...prev, barcode: next }));
                        }}
                        className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Generated as <code className="font-mono">NAME_BRAND</code>. Duplicates get <code className="font-mono">_01</code>, <code className="font-mono">_02</code> …
                    </p>
                  </div>

                  <SuggestInput
                    label="Brand"
                    value={formData.brand}
                    onChange={(v) => setFormData({ ...formData, brand: v })}
                    placeholder="Bata, Nike, Adidas, Woodland"
                    options={brandOptions}
                  />

                  <SuggestInput
                    label="Size"
                    value={formData.size}
                    onChange={(v) => setFormData({ ...formData, size: v })}
                    placeholder="6, 7, 8, 9, 10, 11"
                    options={sizeOptions}
                  />

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category *
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">Select Category</option>
                      {categories.map(category => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </div>

                  <SuggestInput
                    label="Supplier"
                    value={formData.supplier}
                    onChange={(v) => setFormData({ ...formData, supplier: v })}
                    placeholder="Supplier name"
                    options={supplierOptions}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows="3"
                    className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Premium quality leather shoes with comfortable sole and modern design"
                  />
                </div>
              </div>

              {/* Pricing Information */}
              <div className="space-y-4 border-t pt-6">
                <h3 className="font-medium text-gray-900 flex items-center gap-2">
                  <IndianRupee className="w-4 h-4 text-green-600" />
                  Pricing Information
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <SuggestInput
                    label="Purchase Price (₹)"
                    value={formData.purchasePrice}
                    onChange={(v) => setFormData({ ...formData, purchasePrice: v })}
                    placeholder="1500"
                    options={purchasePriceOptions}
                    type="number"
                    inputProps={{ step: '1', min: '0', onBlur: calculateMargin }}
                  />

                  <SuggestInput
                    label="Selling Price (₹)"
                    value={formData.price}
                    onChange={(v) => setFormData({ ...formData, price: v })}
                    placeholder="2499"
                    options={priceOptions}
                    required
                    type="number"
                    inputProps={{ step: '0.01', min: '0', onBlur: calculateMargin }}
                  />

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Margin (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.margin}
                      onChange={(e) => setFormData({ ...formData, margin: e.target.value })}
                      className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
                      placeholder="Auto-calculated"
                      readOnly
                    />
                  </div>
                </div>
              </div>

              {/* Stock Information */}
              <div className="space-y-4 border-t pt-6">
                <h3 className="font-medium text-gray-900 flex items-center gap-2">
                  <Package className="w-4 h-4 text-purple-600" />
                  Stock Information
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Current Stock *
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.stock}
                      onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                      className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="50"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Minimum Stock Alert
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.minStock}
                      onChange={(e) => setFormData({ ...formData, minStock: e.target.value })}
                      className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder={String(lowStockThreshold)}
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-6 border-t">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <Zap className="w-4 h-4" />
                  {editingProduct ? 'Update Product' : 'Add & Continue'}
                </button>
              </div>

              {!editingProduct && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-700 flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    <strong>Quick Add Mode:</strong> The form stays open after adding each product. Barcode auto-generates from Name + Brand.
                  </p>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Import CSV Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-xl w-full">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Upload className="w-5 h-5 text-indigo-600" /> Import Inventory CSV
              </h3>
              <button className="p-2 rounded hover:bg-gray-100" onClick={() => { setShowImportModal(false); setImportStatus(null); }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-600">
                The CSV will be <b>appended</b> to your existing products. Required columns:
                <code className="mx-1">Name</code>,
                <code className="mx-1">Category</code>,
                <code className="mx-1">Price</code>,
                <code className="mx-1">Stock</code>.
                Optional columns include <code className="mx-1">Barcode</code>, <code className="mx-1">Brand</code>, <code className="mx-1">Size</code>, <code className="mx-1">Min Stock</code>, <code className="mx-1">Supplier</code>, <code className="mx-1">Purchase Price</code>, <code className="mx-1">Margin %</code>, <code className="mx-1">Description</code>.
              </p>

              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => importFromCSV(e.target.files?.[0])}
                  className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-3 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
                <button
                  onClick={downloadTemplate}
                  className="px-3 py-2 border rounded hover:bg-gray-50 text-sm"
                >
                  Download Template
                </button>
              </div>

              {importStatus && (
                <div className="rounded-lg border p-3 bg-gray-50">
                  <p className="text-sm">
                    <b>Imported:</b> {importStatus.added} added, {importStatus.skipped} skipped.
                  </p>
                  {importStatus.errors?.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm text-red-700">Errors ({importStatus.errors.length})</summary>
                      <ul className="list-disc ml-6 text-sm text-red-700">
                        {importStatus.errors.map((e, i) => <li key={i}>{e}</li>)}
                      </ul>
                    </details>
                  )}
                </div>
              )}
            </div>

            <div className="p-5 border-t flex justify-end">
              <button
                onClick={() => { setShowImportModal(false); setImportStatus(null); }}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
