import React, { createContext, useState, useContext, useEffect } from 'react';

const InventoryContext = createContext();

export const useInventory = () => {
  const context = useContext(InventoryContext);
  if (!context) {
    throw new Error('useInventory must be used within an InventoryProvider');
  }
  return context;
};

export const InventoryProvider = ({ children }) => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState(['Men\'s Formal', 'Men\'s Casual', 'Women\'s Formal', 'Women\'s Casual', 'Sports', 'Kids', 'Sandals', 'Boots', 'Accessories']);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = () => {
    const storedProducts = localStorage.getItem('pos_products');
    if (storedProducts) {
      setProducts(JSON.parse(storedProducts));
    } else {
      // Initialize with sample data
      const sampleProducts = [
       
      ];
      setProducts(sampleProducts);
      localStorage.setItem('pos_products', JSON.stringify(sampleProducts));
    }
  };

  const addProduct = (product) => {
    const newProduct = {
      ...product,
      id: Date.now().toString()
    };
    const updatedProducts = [...products, newProduct];
    setProducts(updatedProducts);
    localStorage.setItem('pos_products', JSON.stringify(updatedProducts));
  };

  const updateProduct = (id, updatedProduct) => {
    const updatedProducts = products.map(p => 
      p.id === id ? { ...updatedProduct, id } : p
    );
    setProducts(updatedProducts);
    localStorage.setItem('pos_products', JSON.stringify(updatedProducts));
  };

  const deleteProduct = (id) => {
    const updatedProducts = products.filter(p => p.id !== id);
    setProducts(updatedProducts);
    localStorage.setItem('pos_products', JSON.stringify(updatedProducts));
  };

  const updateStock = (id, newStock) => {
    const updatedProducts = products.map(p => 
      p.id === id ? { ...p, stock: newStock } : p
    );
    setProducts(updatedProducts);
    localStorage.setItem('pos_products', JSON.stringify(updatedProducts));
  };

  const getLowStockProducts = () => {
    return products.filter(p => p.stock <= 5);
  };

  const value = {
    products,
    categories,
    addProduct,
    updateProduct,
    deleteProduct,
    updateStock,
    getLowStockProducts
  };

  return (
    <InventoryContext.Provider value={value}>
      {children}
    </InventoryContext.Provider>
  );
};