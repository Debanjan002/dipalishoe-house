import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

const InventoryContext = createContext(null);
const STORAGE_KEY = 'pos_products';
const DEFAULT_CATEGORIES = [
  "Gent's Slipper", "Gent's Belt", "Gent's Hawai", "Gent's Shoe",
  "Ledie's Slipper", "Ledie's Belt", "ledie's Hawai", "Ledis's Shoe",
  'Kids Hawai', 'kids BOYS belt', 'kids GIRLS belt', 'kids BOYS Shoe',
  'kids GIRLS Shoe', 'kids BOYS SLIPPERS', 'kids GIRLS SLIPPERS',
  'DR. Hawai', 'local', 'Accessories',
];

const safeNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
};

const makeUnitId = () => {
  const random = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
  return `SH-${random}`;
};

const createUnit = (productId, status = 'available', qrValue = null) => {
  const unitId = makeUnitId();
  return {
    unitId,
    productId: String(productId),
    // Keep a registered existing QR payload verbatim; generated units keep the legacy format.
    qrValue: qrValue == null ? `DSH1:${unitId}` : String(qrValue),
    status,
    createdAt: new Date().toISOString(),
  };
};

const reconcileUnits = (product, priorUnits) => {
  const targetStock = safeNumber(product.stock);
  const units = Array.isArray(priorUnits)
    ? priorUnits.map((unit) => {
        const unitId = String(unit.unitId || makeUnitId());
        return {
          ...unit,
          unitId,
          productId: String(product.id),
          // Do not rewrite existing QR payloads (including legacy or third-party QR formats).
          qrValue: unit.qrValue == null || String(unit.qrValue) === '' ? `DSH1:${unitId}` : String(unit.qrValue),
          status: unit.status || 'available',
        };
      })
    : [];

  let available = units.filter((unit) => unit.status === 'available');
  while (available.length < targetStock) {
    const unit = createUnit(product.id);
    units.push(unit);
    available.push(unit);
  }
  if (available.length > targetStock) {
    let toDeactivate = available.length - targetStock;
    for (let i = units.length - 1; i >= 0 && toDeactivate > 0; i -= 1) {
      if (units[i].status === 'available') {
        units[i] = { ...units[i], status: 'removed', removedAt: new Date().toISOString() };
        toDeactivate -= 1;
      }
    }
  }
  return units;
};

const readProducts = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((product) => {
          const normalized = { ...product, id: String(product.id), stock: safeNumber(product.stock) };
          return { ...normalized, qrUnits: reconcileUnits(normalized, product.qrUnits) };
        });
      }
    }
  } catch (error) {
    console.error('Could not load saved inventory:', error);
  }

  const sampleProducts = [
    { id: '1', name: "Bata Men's Formal Black Leather Shoes", barcode: 'BATA001', price: 2499, stock: 15, category: "Men's Formal", description: 'Premium black leather formal shoes', size: '8', brand: 'Bata' },
    { id: '2', name: 'Nike Air Max Running Shoes', barcode: 'NIKE001', price: 4999, stock: 8, category: 'Sports', description: 'Comfortable running shoes with air cushioning', size: '9', brand: 'Nike' },
    { id: '3', name: 'Woodland Casual Brown Shoes', barcode: 'WOOD001', price: 3299, stock: 12, category: "Men's Casual", description: 'Genuine leather casual shoes', size: '7', brand: 'Woodland' },
  ];
  return sampleProducts.map((product) => ({ ...product, qrUnits: reconcileUnits(product, []) }));
};

export const useInventory = () => {
  const context = useContext(InventoryContext);
  if (!context) throw new Error('useInventory must be used within an InventoryProvider');
  return context;
};

export const InventoryProvider = ({ children }) => {
  const [products, setProducts] = useState(() => readProducts());
  const productsRef = useRef(products);
  const [categories] = useState(DEFAULT_CATEGORIES);

  // Keep a synchronous snapshot so Add Using QR can create a product and register its
  // scanned QR payloads in the same submit event, before React re-renders.
  const commitProducts = (updater) => {
    const next = typeof updater === 'function' ? updater(productsRef.current) : updater;
    productsRef.current = next;
    setProducts(next);
    return next;
  };

  useEffect(() => {
    productsRef.current = products;
  }, [products]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
    } catch (error) {
      console.error('Could not save inventory:', error);
    }
  }, [products]);

  const addProduct = (product) => {
    const id = String(product.id || `PRD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
    const stock = safeNumber(product.stock);
    const newProduct = {
      ...product,
      id,
      stock,
      // Preserve the original Add Product workflow: new stock gets generated DSH1 unit labels.
      qrUnits: reconcileUnits(
        { ...product, id, stock },
        Array.isArray(product.qrUnits)
          ? product.qrUnits.map((unit) => ({
              ...unit,
              unitId: unit.unitId || makeUnitId(),
              productId: id,
              qrValue: unit.qrValue == null || String(unit.qrValue) === ''
                ? `DSH1:${unit.unitId || makeUnitId()}`
                : String(unit.qrValue),
              status: unit.status || 'available',
            }))
          : [],
      ),
    };
    commitProducts((current) => [...current, newProduct]);
    return newProduct;
  };

  const updateProduct = (id, updatedProduct) => {
    commitProducts((current) => current.map((product) => {
      if (String(product.id) !== String(id)) return product;
      const merged = { ...product, ...updatedProduct, id: String(id), stock: safeNumber(updatedProduct.stock ?? product.stock) };
      return { ...merged, qrUnits: reconcileUnits(merged, product.qrUnits) };
    }));
  };

  const deleteProduct = (id) => {
    commitProducts((current) => current.filter((product) => String(product.id) !== String(id)));
  };

  /** Register scanned/pre-existing QR payloads without changing their payload values. */
  const registerExistingQrUnits = (productId, qrValues) => {
    const product = productsRef.current.find((entry) => String(entry.id) === String(productId));
    if (!product) return { success: false, added: 0, duplicates: [], error: 'Please select a valid product.' };

    const values = (Array.isArray(qrValues) ? qrValues : [qrValues])
      .map((value) => String(value ?? '').trim())
      .filter(Boolean);
    if (!values.length) return { success: false, added: 0, duplicates: [], error: 'Scan or enter at least one QR code.' };

    const allUnits = productsRef.current.flatMap((entry) => entry.qrUnits || []);
    const existingValues = new Set(allUnits.map((unit) => String(unit.qrValue ?? '')));
    const seenInBatch = new Set();
    const accepted = [];
    const duplicates = [];
    values.forEach((value) => {
      if (existingValues.has(value) || seenInBatch.has(value)) duplicates.push(value);
      else { accepted.push(value); seenInBatch.add(value); }
    });
    if (!accepted.length) {
      return { success: false, added: 0, duplicates, error: 'These QR values are already registered. No stock was changed.' };
    }

    const now = new Date().toISOString();
    const newUnits = accepted.map((value) => ({ ...createUnit(product.id, 'available', value), registeredAt: now, qrSource: 'existing' }));
    commitProducts((current) => current.map((entry) => {
      if (String(entry.id) !== String(productId)) return entry;
      const currentUnits = Array.isArray(entry.qrUnits) ? entry.qrUnits : [];
      return {
        ...entry,
        stock: safeNumber(entry.stock) + newUnits.length,
        qrUnits: [...currentUnits, ...newUnits],
      };
    }));
    return { success: true, added: newUnits.length, duplicates, units: newUnits };
  };

  // soldUnitIds/returnedUnitIds allow POS checkout and returns to preserve each physical unit's identity.
  const updateStock = (id, requestedStock, options = {}) => {
    const nextStock = safeNumber(requestedStock);
    commitProducts((current) => current.map((product) => {
      if (String(product.id) !== String(id)) return product;
      const previousStock = safeNumber(product.stock);
      let units = [...(product.qrUnits || [])];
      const now = new Date().toISOString();

      if (nextStock < previousStock) {
        let remaining = previousStock - nextStock;
        const preferred = new Set((options.soldUnitIds || []).map(String));
        if (preferred.size) {
          units = units.map((unit) => {
            if (remaining > 0 && preferred.has(String(unit.unitId)) && unit.status === 'available') {
              remaining -= 1;
              return { ...unit, status: 'sold', soldAt: now };
            }
            return unit;
          });
        }
        if (remaining > 0) {
          units = units.map((unit) => {
            if (remaining > 0 && unit.status === 'available') {
              remaining -= 1;
              return { ...unit, status: 'sold', soldAt: now };
            }
            return unit;
          });
        }
      } else if (nextStock > previousStock) {
        let remaining = nextStock - previousStock;
        const preferred = new Set((options.returnedUnitIds || []).map(String));
        if (preferred.size) {
          units = units.map((unit) => {
            if (remaining > 0 && preferred.has(String(unit.unitId)) && unit.status === 'sold') {
              remaining -= 1;
              const { soldAt, ...rest } = unit;
              return { ...rest, status: 'available', returnedAt: now };
            }
            return unit;
          });
        }
        if (remaining > 0) {
          const sold = units.filter((unit) => unit.status === 'sold');
          for (const soldUnit of sold) {
            if (remaining <= 0) break;
            units = units.map((unit) => {
              if (unit.unitId !== soldUnit.unitId) return unit;
              const { soldAt, ...rest } = unit;
              return { ...rest, status: 'available', returnedAt: now };
            });
            remaining -= 1;
          }
        }
        while (remaining > 0) {
          units.push(createUnit(product.id));
          remaining -= 1;
        }
      }

      units = reconcileUnits({ ...product, stock: nextStock }, units);
      return { ...product, stock: nextStock, qrUnits: units };
    }));
  };

  const getLowStockProducts = () => products.filter((product) => product.stock <= 2);
  const value = useMemo(() => ({
    products, categories, addProduct, updateProduct, deleteProduct, updateStock,
    registerExistingQrUnits, getLowStockProducts,
  }), [products, categories]);

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>;
};
