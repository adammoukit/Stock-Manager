import React, { createContext, useContext, useState, useEffect } from 'react';
import { useInventory } from './InventoryContext';
import { useSettings } from './SettingsContext';
import { calculateSmartReplenishment } from '../utils/smartReplenishment';

const PurchaseContext = createContext();

export const usePurchase = () => useContext(PurchaseContext);

export const PurchaseProvider = ({ children }) => {
    const { addSupply } = useInventory();
    const { currentStoreId } = useSettings();
    const storeKey = currentStoreId ? String(currentStoreId) : 'store_default';

    // ── Commandes et Fournisseurs cloisonnés par boutique ──
    const loadOrders = (key) => {
        const saved = localStorage.getItem(`purchase_orders_${key}`);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) return parsed.filter(o => o.storeId && String(o.storeId) === key);
            } catch (e) {
                console.error("Erreur lecture purchase_orders", e);
            }
        }
        return [];
    };

    const loadSuppliers = (key) => {
        const saved = localStorage.getItem(`purchase_suppliers_${key}`);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) return parsed.filter(s => s.storeId && String(s.storeId) === key);
            } catch (e) {
                console.error("Erreur lecture purchase_suppliers", e);
            }
        }
        return [];
    };

    const loadQueue = (key) => {
        const saved = localStorage.getItem(`replenishment_queue_${key}`);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) return parsed;
            } catch (e) {
                console.error("Erreur lecture replenishment_queue", e);
            }
        }
        return [];
    };

    const [allOrders, setAllOrders] = useState(() => loadOrders(storeKey));
    const [allSuppliers, setAllSuppliers] = useState(() => loadSuppliers(storeKey));
    const [replenishmentQueue, setReplenishmentQueue] = useState(() => loadQueue(storeKey));

    // Rechargement immédiat lors du changement de boutique
    useEffect(() => {
        setAllOrders(loadOrders(storeKey));
        setAllSuppliers(loadSuppliers(storeKey));
        setReplenishmentQueue(loadQueue(storeKey));
    }, [storeKey]);

    // Persistance isolée
    useEffect(() => {
        const isolatedOrders = allOrders.filter(o => o.storeId && String(o.storeId) === storeKey);
        localStorage.setItem(`purchase_orders_${storeKey}`, JSON.stringify(isolatedOrders));
    }, [allOrders, storeKey]);

    useEffect(() => {
        const isolatedSuppliers = allSuppliers.filter(s => s.storeId && String(s.storeId) === storeKey);
        localStorage.setItem(`purchase_suppliers_${storeKey}`, JSON.stringify(isolatedSuppliers));
    }, [allSuppliers, storeKey]);

    useEffect(() => {
        localStorage.setItem(`replenishment_queue_${storeKey}`, JSON.stringify(replenishmentQueue));
    }, [replenishmentQueue, storeKey]);

    // Nettoyage clés legacy
    useEffect(() => {
        localStorage.removeItem("purchase_orders");
        localStorage.removeItem("purchase_suppliers");
    }, []);

    // État dérivé strictement pour la boutique courante
    const orders = allOrders.filter(o => o.storeId != null && String(o.storeId) === storeKey);
    const suppliers = allSuppliers.filter(s => s.storeId != null && String(s.storeId) === storeKey);

    const createOrder = (supplier, items) => {
        const newOrder = {
            id: Date.now(),
            storeId: currentStoreId || storeKey,
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

        setAllOrders(prev => [newOrder, ...prev]);
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
            storeId: currentStoreId || storeKey
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

    const deleteOrder = (orderId) => {
        setAllOrders(prevOrders => prevOrders.filter(order => order.id !== orderId));
    };

    // ── File de Réapprovisionnement Super-Intelligent (Queue) ──
    const addToReplenishmentQueue = (product, customContainers = null, note = '', customPrice = null, customSupplier = null) => {
        const calculated = calculateSmartReplenishment(product, customContainers, customPrice);
        if (!calculated) return null;

        if (customSupplier) {
            calculated.supplier = customSupplier;
        }

        setReplenishmentQueue(prev => {
            const existingIndex = prev.findIndex(item => String(item.productId) === String(product.id));
            if (existingIndex >= 0) {
                const updated = [...prev];
                const existing = updated[existingIndex];
                const newContainers = customContainers !== null 
                    ? customContainers 
                    : (existing.recommendedContainers + 1);
                
                const effectivePrice = customPrice !== null && customPrice !== undefined && !isNaN(customPrice)
                    ? parseFloat(customPrice)
                    : (existing.purchasePricePerContainer ?? calculated.purchasePricePerContainer);
                
                updated[existingIndex] = {
                    ...existing,
                    ...calculated,
                    recommendedContainers: newContainers,
                    totalSubUnits: newContainers * calculated.factor,
                    purchasePricePerContainer: effectivePrice,
                    estimatedTotalCost: newContainers * effectivePrice,
                    supplier: customSupplier || existing.supplier || calculated.supplier,
                    note: note || existing.note || '',
                    updatedAt: new Date().toISOString()
                };
                return updated;
            } else {
                return [
                    {
                        ...calculated,
                        note,
                        addedAt: new Date().toISOString()
                    },
                    ...prev
                ];
            }
        });

        return calculated;
    };

    const removeFromReplenishmentQueue = (productId) => {
        setReplenishmentQueue(prev => prev.filter(item => String(item.productId) !== String(productId)));
    };

    const updateReplenishmentQueueItem = (productId, updates) => {
        setReplenishmentQueue(prev => prev.map(item => {
            if (String(item.productId) === String(productId)) {
                const updatedContainers = updates.recommendedContainers !== undefined 
                    ? Math.max(1, parseInt(updates.recommendedContainers, 10)) 
                    : item.recommendedContainers;
                const updatedPrice = updates.purchasePricePerContainer !== undefined 
                    ? parseFloat(updates.purchasePricePerContainer) 
                    : item.purchasePricePerContainer;
                const factor = item.factor || 1;

                return {
                    ...item,
                    ...updates,
                    recommendedContainers: updatedContainers,
                    totalSubUnits: updatedContainers * factor,
                    purchasePricePerContainer: updatedPrice,
                    estimatedTotalCost: updatedContainers * updatedPrice
                };
            }
            return item;
        }));
    };

    const clearReplenishmentQueue = () => {
        setReplenishmentQueue([]);
    };

    const generateOrdersFromQueue = (selectedProductIds = null, directItems = null, forcedSupplier = null) => {
        let itemsToOrder = [];
        if (directItems && Array.isArray(directItems) && directItems.length > 0) {
            itemsToOrder = directItems;
        } else if (selectedProductIds && Array.isArray(selectedProductIds)) {
            const idStrings = selectedProductIds.map(String);
            itemsToOrder = replenishmentQueue.filter(i => idStrings.includes(String(i.productId)));
        } else {
            itemsToOrder = replenishmentQueue;
        }

        if (itemsToOrder.length === 0) return [];

        // Détection du fournisseur principal si un article n'a pas de fournisseur renseigné
        let primarySupplier = forcedSupplier ? forcedSupplier.trim() : null;
        if (!primarySupplier) {
            const validSuppliers = itemsToOrder
                .map(i => (i.supplier || '').trim())
                .filter(s => s && s !== 'Fournisseur à désigner' && s !== 'Fournisseur Général');
            if (validSuppliers.length > 0) {
                const counts = {};
                validSuppliers.forEach(s => counts[s] = (counts[s] || 0) + 1);
                primarySupplier = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
            }
        }

        const groupedBySupplier = {};
        itemsToOrder.forEach(item => {
            const itemSup = (item.supplier || '').trim();
            const supplierName = (
                forcedSupplier || 
                (itemSup && itemSup !== 'Fournisseur à désigner' ? itemSup : primarySupplier) || 
                'Fournisseur Général'
            ).trim();

            if (!groupedBySupplier[supplierName]) {
                groupedBySupplier[supplierName] = [];
            }
            const cLabel = item.containerLabel || 'Unité';
            const sLabel = item.subUnitLabel || '';
            const qty = item.recommendedContainers || item.quantity || 1;
            const subUnits = item.totalSubUnits || qty;
            const pName = (item.name || '').includes(cLabel)
                ? item.name
                : `${item.name} (${qty} ${cLabel}${sLabel ? ` · ${subUnits} ${sLabel}` : ''})`;

            groupedBySupplier[supplierName].push({
                productId: item.productId || item.id,
                name: pName,
                quantityOrdered: parseInt(qty, 10) || 1,
                quantityReceived: 0,
                purchasePrice: parseFloat(item.purchasePricePerContainer ?? item.purchasePrice) || 0,
                status: 'Pending',
                stock: item.currentStock ?? item.stock ?? 0,
                minStock: item.minStock ?? 0,
                archetype: item.archetype,
                containerLabel: cLabel,
                subUnitLabel: sLabel,
                totalSubUnits: subUnits
            });
        });

        const createdOrders = [];
        const now = Date.now();
        const currentYear = new Date().getFullYear();

        setAllOrders(prev => {
            const currentStoreOrders = prev.filter(o => o.storeId != null && String(o.storeId) === storeKey);
            let nextIndex = currentStoreOrders.length + 1;
            const newOrders = [];

            Object.entries(groupedBySupplier).forEach(([supplier, items], index) => {
                const totalAmount = items.reduce((sum, item) => sum + (item.purchasePrice * item.quantityOrdered), 0);
                const newOrder = {
                    id: now + index,
                    storeId: currentStoreId || storeKey,
                    orderNumber: `PO-${currentYear}-${String(nextIndex).padStart(4, '0')}`,
                    supplier,
                    date: new Date().toISOString(),
                    status: 'Ordered', // Draft, Ordered, Partial, Completed
                    items: items,
                    totalAmount
                };
                newOrders.push(newOrder);
                createdOrders.push(newOrder);
                nextIndex++;
            });

            return [...newOrders, ...prev];
        });

        const orderedIds = itemsToOrder.map(i => String(i.productId || i.id));
        setReplenishmentQueue(prev => prev.filter(i => !orderedIds.includes(String(i.productId))));

        return createdOrders;
    };

    return (
        <PurchaseContext.Provider value={{
            orders,
            suppliers,
            createOrder,
            receiveOrder,
            deleteOrder,
            addSupplier,
            updateSupplier,
            deleteSupplier,
            paySupplier,
            forceCompleteOrder,
            replenishmentQueue,
            addToReplenishmentQueue,
            removeFromReplenishmentQueue,
            updateReplenishmentQueueItem,
            clearReplenishmentQueue,
            generateOrdersFromQueue
        }}>
            {children}
        </PurchaseContext.Provider>
    );
};
