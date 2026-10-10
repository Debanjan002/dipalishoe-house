import React, { useState, useMemo, useEffect, useRef } from 'react';

import { useInventory } from '../contexts/InventoryContext';

import BarcodeScanner from './BarcodeScanner';

import QrLabelPrint from './QrLabelPrint';

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

  Camera,

  Tag,

  IndianRupee,

  Package2,

  Zap,

  Upload,

  QrCode

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

        <label className="block text-sm font-medium text-slate-200 mb-2">

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

        className="w-full px-3 py-3 border border-slate-700 bg-slate-800 text-slate-100 placeholder:text-slate-500 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-t border-slate-800ransparent"

        {...inputProps}

      />

      {open && filtered.length > 0 && (

        <div className="absolute z-50 mt-1 w-full bg-slate-900 border border-slate-800 rounded-lg shadow-lg max-h-56 overflow-auto">

          {filtered.map((opt) => (

            <button

              key={String(opt)}

              type="button"

              onClick={() => { onChange(String(opt)); setOpen(false); }}

              className="w-full text-left px-3 py-2 hover:bg-blue-950/40"

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

  const [showScanner, setShowScanner] = useState(false);

  const [qrPrintProduct, setQrPrintProduct] = useState(null);
  const [lastAddedProduct, setLastAddedProduct] = useState(null);
  const [showAddedProductPopup, setShowAddedProductPopup] = useState(false);

  const [scannerAutoPhoto, setScannerAutoPhoto] = useState(false);

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

      const addedProduct = addProduct(productData);

      setLastAddedProduct(addedProduct || null);
      setShowAddedProductPopup(Boolean(addedProduct));

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

    setShowAddedProductPopup(false);

    setLastAddedProduct(null);

    resetForm();

    setEditingProduct(null);

    setBarcodeAuto(true);

    setShowAddModal(true);

  };

  const closeModal = () => {

    setShowAddedProductPopup(false);

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

    const required = ['name', 'price', 'stock'];

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

    <div className="space-y-6 text-slate-100">

      {/* Inventory Statistics */}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

        <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-sm p-6 text-white">

          <div className="flex items-center justify-between">

            <div>

              <p className="text-slate-400">Total Products</p>

              <p className="text-2xl font-bold">{totalProducts}</p>

            </div>

            <Package className="w-8 h-8 text-blue-300" />

          </div>

        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-sm p-6 text-white">

          <div className="flex items-center justify-between">

            <div>

              <p className="text-slate-400">Total Value</p>

              <p className="text-2xl font-bold">₹{totalValue.toLocaleString('en-IN')}</p>

            </div>

            <IndianRupee className="w-8 h-8 text-emerald-300" />

          </div>

        </div>

        <div className="bg-slate-900 border border-amber-900/70 rounded-xl shadow-sm p-6 text-white">

          <div className="flex items-center justify-between">

            <div>

              <p className="text-amber-300">Low Stock</p>

              <p className="text-2xl font-bold">{lowStockCount}</p>

            </div>

            <AlertTriangle className="w-8 h-8 text-amber-300" />

          </div>

        </div>

        <div className="bg-slate-900 border border-rose-900/70 rounded-xl shadow-sm p-6 text-white">

          <div className="flex items-center justify-between">

            <div>

              <p className="text-rose-300">Out of Stock</p>

              <p className="text-2xl font-bold">{outOfStockCount}</p>

            </div>

            <AlertTriangle className="w-8 h-8 text-rose-300" />

          </div>

        </div>

      </div>

      {/* Low Stock Alert (closable + threshold control) */}

      {/* Header with Controls */}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-lg shadow-black/20 p-6">

        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">

          <div>

            <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">

              <Package2 className="w-6 h-6 text-blue-300" />

              Inventory Management

            </h1>

            <p className="text-slate-300 mt-1">Manage your shoe inventory with fast add + global suggestions</p>

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

              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-500 transition-colors flex items-center gap-2"

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

              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 w-5 h-5" />

              <input

                type="text"

                placeholder="Search by name, barcode, or brand..."

                value={searchTerm}

                onChange={(e) => setSearchTerm(e.target.value)}

                className="w-full pl-10 pr-4 py-3 border border-slate-700 bg-slate-800 text-slate-100 placeholder:text-slate-500 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-t border-slate-800ransparent"

              />

            </div>

            <select

              value={selectedCategory}

              onChange={(e) => setSelectedCategory(e.target.value)}

              className="px-4 py-3 border border-slate-700 bg-slate-800 text-slate-100 placeholder:text-slate-500 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-t border-slate-800ransparent"

            >

              <option value="">All Categories</option>

              {categories.map(category => (

                <option key={category} value={category}>{category}</option>

              ))}

            </select>

            <button

              onClick={() => setShowFilters(!showFilters)}

              className={`px-4 py-3 border rounded-lg transition-colors flex items-center gap-2 ${

                showFilters ? 'bg-blue-950/40 border-b border-slate-800lue-800 text-blue-300' : 'border-slate-700 hover:bg-slate-800/70'

              }`}

            >

              <Filter className="w-4 h-4" />

              Filters

            </button>

          </div>

          {/* Advanced Filters */}

          {showFilters && (

            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-4">

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

                <div className="md:col-span-1">

                  <label className="block text-sm font-medium text-slate-200 mb-2">Price Range</label>

                  <div className="flex gap-2">

                    <input

                      type="number"

                      placeholder="Min"

                      value={priceRange.min}

                      onChange={(e) => setPriceRange({ ...priceRange, min: e.target.value })}

                      className="w-full px-3 py-2 border border-slate-700 bg-slate-800 text-slate-100 placeholder:text-slate-500 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-t border-slate-800ransparent"

                    />

                    <input

                      type="number"

                      placeholder="Max"

                      value={priceRange.max}

                      onChange={(e) => setPriceRange({ ...priceRange, max: e.target.value })}

                      className="w-full px-3 py-2 border border-slate-700 bg-slate-800 text-slate-100 placeholder:text-slate-500 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-t border-slate-800ransparent"

                    />

                  </div>

                </div>

                <div>

                  <label className="block text-sm font-medium text-slate-200 mb-2">Stock Status</label>

                  <select

                    value={stockFilter}

                    onChange={(e) => setStockFilter(e.target.value)}

                    className="w-full px-3 py-2 border border-slate-700 bg-slate-800 text-slate-100 placeholder:text-slate-500 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-t border-slate-800ransparent"

                  >

                    <option value="all">All Products</option>

                    <option value="available">In Stock</option>

                    <option value="low">Low Stock</option>

                    <option value="out">Out of Stock</option>

                  </select>

                </div>

                <div>

                  <label className="block text-sm font-medium text-slate-200 mb-2">Low-stock threshold</label>

                  <input

                    type="number"

                    min="1"

                    value={lowStockThreshold}

                    onChange={(e) => setLowStockThreshold(Math.max(1, parseInt(e.target.value || '1', 10)))}

                    className="w-full px-3 py-2 border border-slate-700 bg-slate-800 text-slate-100 placeholder:text-slate-500 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-t border-slate-800ransparent"

                  />

                </div>

                <div>

                  <label className="block text-sm font-medium text-slate-200 mb-2">Sort By</label>

                  <div className="flex gap-2">

                    <select

                      value={sortBy}

                      onChange={(e) => setSortBy(e.target.value)}

                      className="flex-1 px-3 py-2 border border-slate-700 bg-slate-800 text-slate-100 placeholder:text-slate-500 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-t border-slate-800ransparent"

                    >

                      <option value="name">Name</option>

                      <option value="price">Price</option>

                      <option value="stock">Stock</option>

                      <option value="category">Category</option>

                      <option value="brand">Brand</option>

                    </select>

                    <button

                      onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}

                      className="px-3 py-2 border border-slate-700 bg-slate-800 text-slate-200 rounded-lg hover:bg-slate-700/70 transition-colors"

                    >

                      {sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}

                    </button>

                  </div>

                </div>

              </div>

              <div className="flex flex-wrap gap-3 items-center justify-between">

                <p className="text-sm text-slate-300">

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

                      className="px-3 py-2 border border-slate-700 bg-slate-800 text-slate-200 rounded-lg hover:bg-slate-700/70"

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

                    className="text-sm text-blue-300 hover:text-blue-300 flex items-center gap-1"

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

          <div key={product.id} className="bg-slate-900 border border-slate-800 rounded-2xl shadow-lg shadow-black/20 hover:shadow-md transition-shadow p-4 sm:p-5 min-w-0 overflow-hidden">

            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4 min-w-0">

              <div className="flex-1 min-w-0">

                <div className="flex flex-wrap items-start gap-2 mb-2 min-w-0">

                  {/* Select checkbox for bulk delete */}

                  <input

                    type="checkbox"

                    checked={selectedIds.has(product.id)}

                    onChange={() => toggleSelect(product.id)}

                    className="mt-[2px]"

                    title="Select"

                  />

                  <h3 className="font-semibold text-slate-100 text-sm leading-tight min-w-0 flex-1 break-words">{product.name}</h3>

                  {isLow && (

                    <span className="bg-red-100 text-rose-300 text-xs px-2 py-1 rounded-full">

                      Low

                    </span>

                  )}

                </div>

                <div className="space-y-1">

                  <p className="text-xs text-slate-300 flex items-center gap-1">

                    <Tag className="w-3 h-3" />

                    {product.brand} - {product.category}

                  </p>

                  {product.size && (

                    <p className="text-xs text-slate-400">Size: {product.size}</p>

                  )}

                  <p className="text-xs text-slate-400 font-mono">#{product.barcode}</p>

                </div>

              </div>

              <div className="flex w-full sm:w-auto flex-wrap items-center justify-end gap-1 shrink-0">

                <button

                  onClick={() => setQrPrintProduct(product)}

                  className="p-1.5 sm:p-2 shrink-0 text-cyan-300 hover:bg-cyan-950/40 border border-slate-800 rounded-xl transition-colors"

                  title="Print QR labels for available stock"

                  aria-label={`Print QR labels for ${product.name}`}

                >

                  <QrCode className="w-4 h-4" />

                </button>

                <button

                  onClick={() => duplicateProduct(product)}

                  className="p-1.5 sm:p-2 shrink-0 text-slate-300 hover:bg-slate-950/60 border border-slate-800 rounded-xl transition-colors"

                  title="Duplicate Product"

                >

                  <Plus className="w-4 h-4" />

                </button>

                <button

                  onClick={() => handleEdit(product)}

                  className="p-1.5 sm:p-2 shrink-0 text-blue-300 hover:bg-blue-950/40 rounded-lg transition-colors"

                  title="Edit Product"

                >

                  <Edit className="w-4 h-4" />

                </button>

                <button

                  onClick={() => handleDelete(product.id)}

                  className="p-1.5 sm:p-2 shrink-0 text-rose-300 hover:bg-rose-950/30 rounded-lg transition-colors"

                  title="Delete Product"

                >

                  <Trash2 className="w-4 h-4" />

                </button>

              </div>

            </div>

            <div className="space-y-3">

              <div className="flex justify-between items-center">

                <span className="text-sm text-slate-300">Selling Price:</span>

                <span className="font-bold text-lg text-emerald-300">₹{product.price.toLocaleString('en-IN')}</span>

              </div>

              {product.purchasePrice && (

                <div className="flex justify-between items-center">

                  <span className="text-xs text-slate-400">Purchase Price:</span>

                  <span className="text-xs text-slate-200">₹{product.purchasePrice.toLocaleString('en-IN')}</span>

                </div>

              )}

              {product.margin && (

                <div className="flex justify-between items-center">

                  <span className="text-xs text-slate-400">Margin:</span>

                  <span className="text-xs font-medium text-blue-300">{product.margin}%</span>

                </div>

              )}

              <div className="flex justify-between items-center">

                <span className="text-sm text-slate-300">Stock:</span>

                <span className={`font-semibold ${

                  product.stock === 0 ? 'text-rose-300' :

                  isLow ? 'text-amber-300' : 'text-emerald-300'

                }`}>

                  {product.stock} units

                </span>

              </div>

              {product.supplier && (

                <div className="flex justify-between items-center">

                  <span className="text-xs text-slate-400">Supplier:</span>

                  <span className="text-xs text-slate-200">{product.supplier}</span>

                </div>

              )}

            </div>

            {product.description && (

              <div className="mt-4 pt-4 border-t border-slate-800">

                <p className="text-xs text-slate-300 line-clamp-2">

                  {product.description}

                </p>

              </div>

            )}

          </div>

        )})}

      </div>

      {filteredProducts.length === 0 && (

        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-lg shadow-black/20 p-12 text-center">

          <Package className="w-16 h-16 text-slate-500 mx-auto mb-4" />

          <h3 className="text-xl font-medium text-slate-100 mb-2">No shoes found</h3>

          <p className="text-slate-300 mb-4">

            {searchTerm || selectedCategory || priceRange.min || priceRange.max || stockFilter !== 'all'

              ? 'Try adjusting your search or filter criteria'

              : 'Get started by adding your first shoe to the inventory'

            }

          </p>

          <button

            onClick={openAddModal}

            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-500 transition-colors flex items-center gap-2 mx-auto"

          >

            <Plus className="w-5 h-5" />

            Add First Product

          </button>

        </div>

      )}

      {/* Add/Edit Modal */}

      {showAddModal && (

        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">

          <div className="bg-black border border-slate-800 rounded-2xl shadow-2xl shadow-black/40 max-w-2xl w-full max-h-[90vh] overflow-y-auto">

            <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-gradient-to-r from-blue-50 to-indigo-50">

              <div>

                <h2 className="text-xl font-semibold text-black">

                  {editingProduct ? 'Edit Shoe Product' : 'Add New Shoe Product'}

                </h2>

              </div>

              <button

                onClick={closeModal}

                className="p-2 hover:bg-slate-800 rounded-lg transition-colors"

              >

                <X className="w-5 h-5" />

              </button>

            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">

              {/* Basic Information */}

              <div className="space-y-4">

                <h3 className="font-medium text-slate-100 flex items-center gap-2">

                  <Package className="w-4 h-4 text-blue-300" />

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

                      <label className="block text-sm font-medium text-slate-200 mb-2">

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

                        className="w-full px-3 py-3 border border-slate-700 bg-slate-800 text-slate-100 placeholder:text-slate-500 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-t border-slate-800ransparent font-mono"

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

                        className="px-3 py-2 border border-slate-700 bg-slate-800 text-slate-200 rounded-lg hover:bg-slate-700/70"

                      >

                        <RefreshCw className="w-4 h-4" />

                      </button>

                    </div>

                    <p className="text-xs text-slate-400 mt-1">

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

                    <label className="block text-sm font-medium text-slate-200 mb-2">

                      Category *

                    </label>

                    <select

                      value={formData.category}

                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}

                      className="w-full px-3 py-3 border border-slate-700 bg-slate-800 text-slate-100 placeholder:text-slate-500 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-t border-slate-800ransparent"

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

                  <label className="block text-sm font-medium text-slate-200 mb-2">

                    Description

                  </label>

                  <textarea

                    value={formData.description}

                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}

                    rows="3"

                    className="w-full px-3 py-3 border border-slate-700 bg-slate-800 text-slate-100 placeholder:text-slate-500 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-t border-slate-800ransparent"

                    placeholder="Premium quality leather shoes with comfortable sole and modern design"

                  />

                </div>

              </div>

              {/* Pricing Information */}

              <div className="space-y-4 border-t border-slate-800 pt-6">

                <h3 className="font-medium text-slate-100 flex items-center gap-2">

                  <IndianRupee className="w-4 h-4 text-emerald-300" />

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

                    <label className="block text-sm font-medium text-slate-200 mb-2">

                      Margin (%)

                    </label>

                    <input

                      type="number"

                      step="0.01"

                      value={formData.margin}

                      onChange={(e) => setFormData({ ...formData, margin: e.target.value })}

                      className="w-full px-3 py-3 border border-slate-700 bg-slate-800 text-slate-100 placeholder:text-slate-500 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-t border-slate-800ransparent bg-slate-800/70"

                      placeholder="Auto-calculated"

                      readOnly

                    />

                  </div>

                </div>

              </div>

              {/* Stock Information */}

              <div className="space-y-4 border-t border-slate-800 pt-6">

                <h3 className="font-medium text-slate-100 flex items-center gap-2">

                  <Package className="w-4 h-4 text-purple-600" />

                  Stock Information

                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  <div>

                    <label className="block text-sm font-medium text-slate-200 mb-2">

                      Current Stock *

                    </label>

                    <input

                      type="number"

                      min="0"

                      value={formData.stock}

                      onChange={(e) => setFormData({ ...formData, stock: e.target.value })}

                      className="w-full px-3 py-3 border border-slate-700 bg-slate-800 text-slate-100 placeholder:text-slate-500 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-t border-slate-800ransparent"

                      placeholder="50"

                      required

                    />

                  </div>

                  <div>

                    <label className="block text-sm font-medium text-slate-200 mb-2">

                      Minimum Stock Alert

                    </label>

                    <input

                      type="number"

                      min="0"

                      value={formData.minStock}

                      onChange={(e) => setFormData({ ...formData, minStock: e.target.value })}

                      className="w-full px-3 py-3 border border-slate-700 bg-slate-800 text-slate-100 placeholder:text-slate-500 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-t border-slate-800ransparent"

                      placeholder={String(lowStockThreshold)}

                    />

                  </div>

                </div>

              </div>

              {/* Action Buttons */}

              <div className="flex flex-wrap gap-3 pt-6 border-t border-slate-800">

                <button

                  type="button"

                  onClick={closeModal}

                  className="flex-1 px-6 py-3 border border-slate-700 text-slate-200 rounded-lg hover:bg-slate-800/70 transition-colors font-medium"

                >

                  Close

                </button>

                <button

                  type="submit"

                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors font-medium flex items-center justify-center gap-2"

                >

                  <Zap className="w-4 h-4" />

                  {editingProduct ? 'Update Product' : 'Add & Continue'}

                </button>

              </div>

              {!editingProduct && (

                <div className="bg-blue-950/40 border border-b border-slate-800lue-900/70 rounded-lg p-4">

                  <p className="text-sm text-blue-300 flex items-center gap-2">

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

        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">

          <div className="bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl shadow-black/40 max-w-xl w-full">

            <div className="flex items-center justify-between p-5 border-b border-slate-800">

              <h3 className="text-lg font-semibold flex items-center gap-2">

                <Upload className="w-5 h-5 text-indigo-600" /> Import Inventory CSV

              </h3>

              <button className="p-2 rounded hover:bg-slate-800" onClick={() => { setShowImportModal(false); setImportStatus(null); }}>

                <X className="w-5 h-5" />

              </button>

            </div>

            <div className="p-5 space-y-4">

              <p className="text-sm text-slate-300">

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

                  className="block w-full text-sm text-slate-200 file:mr-4 file:py-2 file:px-3 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-indigo-950/40 file:text-indigo-300 hover:file:bg-indigo-900/50"

                />

                <button

                  onClick={downloadTemplate}

                  className="px-3 py-2 border rounded hover:bg-slate-800/70 text-sm"

                >

                  Download Template

                </button>

              </div>

              {importStatus && (

                <div className="rounded-lg border p-3 bg-slate-800/70">

                  <p className="text-sm">

                    <b>Imported:</b> {importStatus.added} added, {importStatus.skipped} skipped.

                  </p>

                  {importStatus.errors?.length > 0 && (

                    <details className="mt-2">

                      <summary className="cursor-pointer text-sm text-rose-300">Errors ({importStatus.errors.length})</summary>

                      <ul className="list-disc ml-6 text-sm text-rose-300">

                        {importStatus.errors.map((e, i) => <li key={i}>{e}</li>)}

                      </ul>

                    </details>

                  )}

                </div>

              )}

            </div>

            <div className="p-5 border-t border-slate-800 flex justify-end">

              <button

                onClick={() => { setShowImportModal(false); setImportStatus(null); }}

                className="px-4 py-2 border rounded hover:bg-slate-800/70"

              >

                Done

              </button>

            </div>

          </div>

        </div>

      )}

      {/* Barcode Scanner Modal */}

      <BarcodeScanner

        open={showScanner}

        onClose={() => { setShowScanner(false); setScannerAutoPhoto(false); }}

        onDetected={(code) => {

          setBarcodeAuto(false);

          setFormData(prev => ({ ...prev, barcode: String(code || '').trim() }));

          setShowScanner(false);

        }}

        onExtractedDetails={(details) => {

          setFormData(prev => ({

            ...prev,

            name: prev.name || details.name || prev.name,

            brand: prev.brand || details.brand || prev.brand,

            size: prev.size || details.size || prev.size,

            price: prev.price || details.price || prev.price,

          }));

        }}

        autoPickPhoto={scannerAutoPhoto}

      />

      {showAddedProductPopup && lastAddedProduct && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-added-title"
            className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
          >
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-950/70 text-emerald-300">
              <Package2 className="h-7 w-7" />
            </div>
            <h3 id="product-added-title" className="text-center text-xl font-bold text-white">
              Product added successfully
            </h3>
            <p className="mt-2 text-center text-sm text-slate-300">
              {lastAddedProduct.name}
            </p>
            <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/70 p-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-slate-400">Stock added</span>
                <span className="font-semibold text-white">{lastAddedProduct.stock} unit(s)</span>
              </div>
              <div className="mt-2 flex justify-between gap-3">
                <span className="text-slate-400">Barcode / SKU</span>
                <span className="max-w-[60%] break-all text-right font-mono text-slate-200">
                  {lastAddedProduct.barcode || '—'}
                </span>
              </div>
            </div>
            <p className="mt-4 text-center text-sm text-slate-400">
              Print a separate QR label for each available physical unit using your thermal label preview.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setShowAddedProductPopup(false)}
                className="flex-1 rounded-lg border border-slate-700 px-4 py-3 font-medium text-slate-200 hover:bg-slate-800"
              >
                Continue Adding
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddedProductPopup(false);
                  setQrPrintProduct(lastAddedProduct);
                }}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-3 font-semibold text-white hover:bg-cyan-500"
              >
                <QrCode className="h-4 w-4" />
                Preview & Print QR
              </button>
            </div>
          </div>
        </div>
      )}

      <QrLabelPrint

        product={qrPrintProduct}

        onClose={() => setQrPrintProduct(null)}

      />

    </div>

  );

};

export default Inventory;
