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
  const [categories, setCategories] = useState(['Gent\'s Slipper', 'Gent\'s Belt', 'Gent\'s Hawai', 'Gent\'s Shoe', 'Ledie\'s Slipper', 'Ledie\'s Belt', 'ledie\'s Hawai', 'Ledis\'s Shoe', 'Kids Hawai', 'kids belt','kids Shoe','DR. Hawai', 'local', 'Accessories']);

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
        {
          id: '1',
          name: 'Bata Men\'s Formal Black Leather Shoes',
          barcode: 'BATA001',
          price: 2499,
          stock: 15,
          category: 'Men\'s Formal',
          description: 'Premium black leather formal shoes',
          size: '8',
          brand: 'Bata'
        },
        {
          id: '2',
          name: 'Nike Air Max Running Shoes',
          barcode: 'NIKE001',
          price: 4999,
          stock: 8,
          category: 'Sports',
          description: 'Comfortable running shoes with air cushioning',
          size: '9',
          brand: 'Nike'
        },
        {
          id: '3',
          name: 'Woodland Casual Brown Shoes',
          barcode: 'WOOD001',
          price: 3299,
          stock: 12,
          category: 'Men\'s Casual',
          description: 'Genuine leather casual shoes',
          size: '7',
          brand: 'Woodland'
        }
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