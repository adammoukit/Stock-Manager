import React, { createContext, useContext, useState, useEffect } from 'react';
import { useInventory } from './InventoryContext';
import { useSettings } from './SettingsContext';

const PurchaseContext = createContext();

export const usePurchase = () => useContext(PurchaseContext);

export const PurchaseProvider = ({ children }) => {
    const { addSupply } = useInventory();
    const { currentStoreId } = useSettings();

    const [allOrders, setAllOrders] = useState(() => {
        const saved = localStorage.getItem("purchase_orders");
        if (!saved) return [];
        const parsed = JSON.parse(saved);
        // Migration: ensure all existing orders have a storeId (default to '1')
        return parsed.map(o => o.storeId ? o : { ...o, storeId: '1' });
    });

    const [allSuppliers, setAllSuppliers] = useState(() => {
        const saved = localStorage.getItem("purchase_suppliers");
        if (saved) {
            const parsed = JSON.parse(saved);
            // Migration: ensure all existing suppliers have a storeId
            return parsed.map(s => s.storeId ? s : { ...s, storeId: '1' });
        }
        
        // Initial data conversion
        const defaultNames = ["Cimenterie du Maroc", "Brico Depot", "Castorama", "Leroy Merlin", "Point P"];
        return defaultNames.map(name => ({
            id: Date.now().toString() + Math.random().toString(36).substring(2),
            name: name,
            contact: '',
            phone: '',
            email: '',
            address: '',
            balance: 0,
            storeId: '1'
        }));
    });

    useEffect(() => {
        localStorage.setItem("purchase_orders", JSON.stringify(allOrders));
    }, [allOrders]);

    useEffect(() => {
        localStorage.setItem("purchase_suppliers", JSON.stringify(allSuppliers));
    }, [allSuppliers]);

    // Derived state based on current store
    const orders = allOrders.filter(o => o.storeId === currentStoreId);
    const suppliers = allSuppliers.filter(s => s.storeId === currentStoreId);

    const createOrder = (supplier, items) => {
        const newOrder = {
            id: Date.now(),
            storeId: currentStoreId,
            orderNumber: `PO-${new Date().getFullYear()}-${String(orders.length + 1).padStart(4, '0')}`,
            supplier,
            date: new Date().toISOString(),
            status: 'Ordered', // Draft, Ordered, Partial, Completed
            items: items.map(item => ({
                productId: item.id,
                name: item.name,
                quantityOrdered: parseInt(item.quantity),
                quantityReceived: 0,
                purchasePrice: parseFloat(item.purchasePrice),
                status: 'Pending' // Pending, Partial, Completed
            })),
            totalAmount: items.reduce((sum, item) => sum + (item.purchasePrice * item.quantity), 0)
        };

        setAllOrders([newOrder, ...allOrders]);
        return newOrder;
    };

    const receiveOrder = (orderId, receivedItems, receivedBy, isPaidCash = false) => {
        // Find the target order first
        const targetOrder = orders.find(o => o.id === orderId);
        if (!targetOrder) return;

        let finalTotalReceivedValue = 0;

        // 1. Update orders state
        setAllOrders(prevOrders => prevOrders.map(order => {
            if (order.id !== orderId) return order;

            let allCompleted = true;
            let hasActivity = false;
            let totalReceivedValue = 0;

            const updatedItems = order.items.map(item => {
                const receivedNow = receivedItems[item.productId] ? parseInt(receivedItems[item.productId]) : 0;
                const safePurchasePrice = Number(item.purchasePrice) || 0;

                if (receivedNow > 0) {
                    hasActivity = true;
                    // Add to inventory
                    addSupply(item.productId, {
                        quantity: receivedNow,
                        purchasePrice: safePurchasePrice,
                        supplier: order.supplier,
                        batchNumber: `BATCH-${order.orderNumber}-${Date.now().toString().slice(-4)}`
                    });
                    
                    // Increment the value of goods received
                    totalReceivedValue += (receivedNow * safePurchasePrice);
                }

                const newQuantityReceived = item.quantityReceived + receivedNow;
                let itemStatus = item.status;

                if (newQuantityReceived >= item.quantityOrdered) {
                    itemStatus = 'Completed';
                } else if (newQuantityReceived > 0) {
                    itemStatus = 'Partial';
                    allCompleted = false;
                } else {
                    allCompleted = false;
                }

                return {
                    ...item,
                    quantityReceived: newQuantityReceived,
                    status: itemStatus
                };
            });

            // Capture the calculated total value for the external supplier update
            finalTotalReceivedValue = totalReceivedValue;

            let orderStatus = order.status;
            if (allCompleted) {
                orderStatus = 'Completed';
            } else if (hasActivity || order.items.some(i => i.quantityReceived > 0)) {
                orderStatus = 'Partial';
            }

            return {
                ...order,
                items: updatedItems,
                status: orderStatus,
                lastUpdated: new Date().toISOString(),
                receivedBy
            };
        }));

        // 2. Update supplier balance AUTOMATICALLY if not paid in cash
        if (!isPaidCash) {
            // We use setTimeout to ensure it runs after the current render cycle 
            // and avoids any React double-invocation strict mode bugs during state dispatch
            setTimeout(() => {
                if (finalTotalReceivedValue > 0) {
                    setAllSuppliers(prev => prev.map(s => {
                        if (s.name === targetOrder.supplier) {
                            return { ...s, balance: (Number(s.balance) || 0) + finalTotalReceivedValue };
                        }
                        return s;
                    }));
                }
            }, 0);
        }
    };

    const addSupplier = (supplierData) => {
        const newSupplier = {
            ...supplierData,
            id: Date.now().toString() + Math.random().toString(36).substring(2),
            balance: supplierData.balance || 0,
            storeId: currentStoreId
        };
        setAllSuppliers([...allSuppliers, newSupplier]);
    };

    const updateSupplier = (id, updatedData) => {
        setAllSuppliers(prev => prev.map(s => s.id === id ? { ...s, ...updatedData } : s));
    };

    const deleteSupplier = (id) => {
        setAllSuppliers(prev => prev.filter(s => s.id !== id));
    };

    const paySupplier = (id, amount) => {
        setAllSuppliers(prev => prev.map(s => {
            if (s.id === id) {
                return { ...s, balance: Math.max(0, (Number(s.balance) || 0) - amount) };
            }
            return s;
        }));
    };

    const forceCompleteOrder = (orderId) => {
        setAllOrders(prevOrders => prevOrders.map(order => {
            if (order.id !== orderId) return order;
            return {
                ...order,
                status: 'Completed',
                items: order.items.map(item => ({
                    ...item,
                    status: 'Completed' // Mark all items as completed (even if partial)
                })),
                lastUpdated: new Date().toISOString(),
                notes: 'Clôturé manuellement par le Directeur'
            };
        }));
    };

    return (
        <PurchaseContext.Provider value={{
            orders,
            suppliers,
            createOrder,
            receiveOrder,
            addSupplier,
            updateSupplier,
            deleteSupplier,
            paySupplier,
            forceCompleteOrder
        }}>
            {children}
        </PurchaseContext.Provider>
    );
};
