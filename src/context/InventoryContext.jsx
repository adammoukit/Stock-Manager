/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect } from "react";
import { useSettings } from "./SettingsContext";
import { productApi } from "../services/apiClient";

const InventoryContext = createContext();

export const useInventory = () => useContext(InventoryContext);

const DEFAULT_CATEGORIES = [
    { id: 'cat-1', name: 'Construction & Gros Œuvre', description: 'Ciments, sables, briques, fer à béton et matériaux de construction', color: '#001d35', icon: 'HardHat' },
    { id: 'cat-2', name: 'Plomberie & Sanitaire', description: 'Tuyaux PVC/PER, raccords, robinetterie, vannes et sanitaires', color: '#2563eb', icon: 'Droplet' },
    { id: 'cat-3', name: 'Électricité', description: 'Câblages, disjoncteurs, prises, interrupteurs et gaines', color: '#d97706', icon: 'Zap' },
    { id: 'cat-4', name: 'Peinture & Droguerie', description: 'Peintures, lasures, solvants, colles, mastics et étanchéité', color: '#9333ea', icon: 'PaintBucket' },
    { id: 'cat-5', name: 'Outillage', description: 'Outillage à main, électroportatif, accessoires et instruments de mesure', color: '#dc2626', icon: 'Wrench' },
    { id: 'cat-6', name: 'Menuiserie & Bois', description: 'Planches, tasseaux, serrures, poignées et ferrures', color: '#b45309', icon: 'PenTool' },
    { id: 'cat-7', name: 'Quincaillerie Générale', description: 'Vis, clous, boulons, chevilles, écrous et fixations', color: '#475569', icon: 'Package' },
    { id: 'cat-8', name: 'Étanchéité & Couverture', description: 'Tôles, rouleaux bitumineux, résines et gouttières', color: '#0284c7', icon: 'Layers' },
    { id: 'cat-9', name: 'Carrelage & Revêtement', description: 'Carreaux, ciment-colle, croisillons et joints', color: '#0d9488', icon: 'Grid' },
    { id: 'cat-10', name: 'Jardin & Extérieur', description: 'Tuyaux d\'arrosage, pelles, râteaux, brouettes et grillages', color: '#16a34a', icon: 'Flower2' }
];

export const InventoryProvider = ({ children }) => {
    const { currentStoreId } = useSettings();
    const storeKey = currentStoreId ? String(currentStoreId) : 'store_default';

    // Initialisation vide, les produits seront chargés depuis le backend
    const [products, setProducts] = useState([]);

    const [categories, setCategories] = useState(() => {
        const saved = localStorage.getItem('quincaillerie_categories');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error(e);
            }
        }
        return DEFAULT_CATEGORIES;
    });

    // ── Mouvements de stock cloisonnés strictement par boutique ──
    const loadMovements = (key) => {
        const saved = localStorage.getItem(`movements_${key}`);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) return parsed.filter(m => m.storeId && String(m.storeId) === key);
            } catch (e) {
                console.error("Erreur lecture movements", e);
            }
        }
        return [];
    };

    const [movements, setMovements] = useState(() => loadMovements(storeKey));

    useEffect(() => {
        setMovements(loadMovements(storeKey));
    }, [storeKey]);

    useEffect(() => {
        const isolatedMovements = movements.filter(m => m.storeId && String(m.storeId) === storeKey);
        localStorage.setItem(`movements_${storeKey}`, JSON.stringify(isolatedMovements));
    }, [movements, storeKey]);

    useEffect(() => {
        localStorage.removeItem("movements");
    }, []);

    const [deconditionModels, setDeconditionModels] = useState(() => {
        const saved = localStorage.getItem('quincaillerie_decondition_models');
        if (saved) {
            const parsed = JSON.parse(saved);
            // Patch existing models if missing targetUnit (Migration)
            return parsed.map(m => {
                if (m.targetUnit) return m;
                const name = m.name.toLowerCase();
                if (name.includes('kg') || name.includes('g') || name.includes('sachet')) return { ...m, targetUnit: 'Kg' };
                if (name.includes('l') || name.includes('litre')) return { ...m, targetUnit: 'Litre' };
                if (name.includes('m') || name.includes('mètre')) return { ...m, targetUnit: 'Mètre' };
                return { ...m, targetUnit: 'Pièce' };
            });
        }
        return [
            { id: 'm1', name: 'Sachet (500g)', targetUnit: 'Kg', isStandard: true },
            { id: 'm2', name: 'Kilo (1Kg)', targetUnit: 'Kg', isStandard: true },
            { id: 'm3', name: 'Demie Dose (250g)', targetUnit: 'Kg', isStandard: true },
            { id: 'm4', name: 'Litre (1L)', targetUnit: 'Litre', isStandard: true },
            { id: 'm5', name: 'Demi-Litre (0.5L)', targetUnit: 'Litre', isStandard: true },
            { id: 'm6', name: 'Mètre (1m)', targetUnit: 'Mètre', isStandard: true },
            { id: 'm7', name: 'Pièce / Unité', targetUnit: 'Pièce', isStandard: true },
        ];
    });

    useEffect(() => {
        // Migration flag: mark v3 multi-store as done
        localStorage.setItem('quincaillerie_stock_migration_v3', '1');
    }, []);

    const [isLoadingFromBackend, setIsLoadingFromBackend] = useState(true);
    const [isCreateProductModalOpen, setIsCreateProductModalOpen] = useState(false);

    const openCreateProductModal = () => setIsCreateProductModalOpen(true);
    const closeCreateProductModal = () => setIsCreateProductModalOpen(false);

    const mapAndSetProducts = (backendProducts) => {
        if (!backendProducts) return;

        const mappedProducts = backendProducts.map(dto => ({
            id: dto.id,                          // UUID string
            name: dto.name,
            barcode: dto.barcode || '',
            category: dto.category,
            supplier: dto.supplier,
            unitArchetype: dto.unitArchetype,
            unit: dto.baseUnit,                  // baseUnit → unit
            baseUnit: dto.baseUnit,
            conversionFactor: dto.conversionFactor ? Number(dto.conversionFactor) : 1,
            purchasePrice: dto.purchasePrice ? Number(dto.purchasePrice) : 0,
            bulkPurchasePrice: dto.bulkPurchasePrice ? Number(dto.bulkPurchasePrice) : null,
            price: dto.price ? Number(dto.price) : 0,
            hasPiece: dto.hasPiece || false,
            piecePrice: dto.piecePrice ? Number(dto.piecePrice) : null,
            hasLot: dto.hasLot || false,
            retailStepQuantity: dto.retailStepQuantity || 1,
            lotPrice: dto.lotPrice ? Number(dto.lotPrice) : null,
            bulkUnit: dto.bulkUnit || '',
            bulkPrice: dto.bulkPrice ? Number(dto.bulkPrice) : null,
            hasSubUnit: dto.hasSubUnit || false,
            packagings: (dto.packagings || []).map(pkg => ({
                ...pkg,
                modelId: pkg.modelId || pkg.id // Ensure modelId is present for frontend logic
            })),
            stock: dto.stockQuantity ? Number(dto.stockQuantity) : 0,
            minStock: dto.minStockQuantity ? Number(dto.minStockQuantity) : 0,
            // Stocks détaillés par boutique
            stockLevels: dto.stocksByStore
                ? Object.fromEntries(Object.entries(dto.stocksByStore).map(([k, v]) => [k, Number(v)]))
                : {},
            minStockLevels: dto.minStockByStore
                ? Object.fromEntries(Object.entries(dto.minStockByStore).map(([k, v]) => [k, Number(v)]))
                : {},
            lots: [],
            createdAt: dto.createdAt || null,
            updatedAt: dto.updatedAt || null
        }));

        setProducts(mappedProducts);
    };

    const refreshProducts = async () => {
        const token = localStorage.getItem('kabllix_token');
        if (!token) return;

        setIsLoadingFromBackend(true);
        try {
            const backendProducts = await productApi.getAll();
            if (backendProducts) {
                mapAndSetProducts(backendProducts);
                console.log("✅ Catalogue synchronisé avec le backend.");
            }
        } catch (error) {
            console.error("❌ Erreur lors de la synchronisation :", error);
        } finally {
            setIsLoadingFromBackend(false);
        }
    };

    // FETCH REAL PRODUCTS FROM BACKEND — au chargement initial
    useEffect(() => {
        refreshProducts();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Synchronisation locale désactivée pour les produits (Le backend est la source de vérité)
    // useEffect(() => {
    //     localStorage.setItem("products", JSON.stringify(products));
    // }, [products]);

    useEffect(() => {
        localStorage.setItem("movements", JSON.stringify(movements));
    }, [movements]);

    useEffect(() => {
        localStorage.setItem('quincaillerie_categories', JSON.stringify(categories));
    }, [categories]);

    const addCategory = (categoryData) => {
        const newCat = {
            id: 'cat-' + Date.now(),
            name: categoryData.name.trim(),
            description: categoryData.description ? categoryData.description.trim() : '',
            color: categoryData.color || '#001d35',
            icon: categoryData.icon || 'Package'
        };
        setCategories(prev => [...prev, newCat]);
        return newCat;
    };

    const updateCategory = (id, updatedData) => {
        const target = categories.find(c => c.id === id);
        if (!target) return;

        const oldName = target.name;
        const newName = updatedData.name.trim();

        setCategories(prev => prev.map(c => c.id === id ? { ...c, ...updatedData, name: newName } : c));

        // Si le nom a changé, répercuter sur les produits qui avaient l'ancien nom
        if (oldName !== newName) {
            setProducts(prev => prev.map(p => p.category === oldName ? { ...p, category: newName } : p));
        }
    };

    const deleteCategory = (id, fallbackName = 'Général') => {
        const target = categories.find(c => c.id === id);
        if (!target) return;

        setCategories(prev => prev.filter(c => c.id !== id));

        // Réassigner les produits de cette catégorie
        if (target.name) {
            setProducts(prev => prev.map(p => p.category === target.name ? { ...p, category: fallbackName } : p));
        }
    };

    const addDeconditionModel = (model) => {
        setDeconditionModels(prev => [...prev, { ...model, id: 'm' + Date.now() }]);
    };

    const deleteDeconditionModel = (id) => {
        setDeconditionModels(prev => prev.filter(m => m.id !== id));
    };

    const updateDeconditionModel = (id, newModel) => {
        setDeconditionModels(prev => prev.map(m => m.id === id ? { ...m, ...newModel } : m));
    };

    const addProduct = async (product) => {
        setIsLoadingFromBackend(true);
        try {
            const productDTO = {
                storeId: currentStoreId, // UUID de la boutique actuelle
                name: product.name,
                barcode: product.barcode || null,
                category: product.category,
                supplier: product.supplier,
                unitArchetype: product.unitArchetype,
                baseUnit: product.unit || 'Unité',
                stockReceived: product.stock || 0,
                minStock: product.minStock || 0,
                conversionFactor: product.conversionFactor || 1,
                bulkPurchasePrice: product.bulkPurchasePrice || null,
                purchasePrice: product.purchasePrice != null ? Number(product.purchasePrice) : (product.bulkPurchasePrice && product.stock ? Number(product.bulkPurchasePrice) / Number(product.stock) : 0),
                bulkUnit: product.bulkUnit || '',
                bulkPrice: product.bulkPrice || null,
                price: product.price || 0,
                hasPiece: product.hasPiece || false,
                piecePrice: product.hasPiece && product.piecePrice ? Number(product.piecePrice) : null,
                hasLot: product.hasLot || false,
                retailStepQuantity: product.hasLot ? (product.retailStepQuantity || 10) : 1,
                lotPrice: product.lotPrice || null,
                hasSubUnit: product.hasSubUnit || false,
                packagings: product.packagings || []
            };

            // Tentative d'appel à l'API réelle
            await productApi.create(productDTO);
            
            // On recharge tout depuis le backend pour avoir le produit avec son ID réel
            const backendProducts = await productApi.getAll();
            if (backendProducts) {
                mapAndSetProducts(backendProducts);
            }
            console.log("✅ Produit créé et catalogue rafraîchi avec succès.");
        } catch (error) {
            console.error("❌ Erreur lors de la création :", error);
            throw error;
        } finally {
            setIsLoadingFromBackend(false);
        }
    };

    const updateProduct = async (id, updatedProduct) => {
        setIsLoadingFromBackend(true);
        try {
            const currentProduct = products.find(p => p.id === id);
            const mergedProduct = { ...currentProduct, ...updatedProduct };

            const productDTO = {
                storeId: currentStoreId,
                name: mergedProduct.name,
                barcode: mergedProduct.barcode || null,
                category: mergedProduct.category,
                supplier: mergedProduct.supplier,
                unitArchetype: mergedProduct.unitArchetype,
                baseUnit: mergedProduct.unit || 'Unité',
                stockReceived: mergedProduct.stock || 0,
                minStock: mergedProduct.minStock || 0,
                conversionFactor: mergedProduct.conversionFactor || 1,
                bulkPurchasePrice: mergedProduct.bulkPurchasePrice || null,
                purchasePrice: mergedProduct.purchasePrice != null ? Number(mergedProduct.purchasePrice) : 0,
                bulkUnit: mergedProduct.bulkUnit || '',
                bulkPrice: mergedProduct.bulkPrice || null,
                price: mergedProduct.price || 0,
                hasPiece: mergedProduct.hasPiece || false,
                piecePrice: mergedProduct.hasPiece && mergedProduct.piecePrice ? Number(mergedProduct.piecePrice) : null,
                hasLot: mergedProduct.hasLot || false,
                retailStepQuantity: mergedProduct.hasLot ? (mergedProduct.retailStepQuantity || 10) : 1,
                lotPrice: mergedProduct.lotPrice || null,
                hasSubUnit: mergedProduct.hasSubUnit || false,
                packagings: mergedProduct.packagings || []
            };

            await productApi.update(id, productDTO);
            const backendProducts = await productApi.getAll();
            if (backendProducts) {
                mapAndSetProducts(backendProducts);
            }
            console.log("✅ Mise à jour backend réussie.");
        } catch (error) {
            console.error("❌ Erreur lors de la mise à jour :", error);
            throw error;
        } finally {
            setIsLoadingFromBackend(false);
        }
    };

    const deleteProduct = async (id) => {
        try {
            await productApi.delete(id);
            console.log("Produit supprimé avec succès sur le backend réel.");
        } catch (error) {
            console.error("Erreur lors de la suppression sur le backend, on continue en local :", error);
        }
        setProducts(products.filter((p) => p.id !== id));
    };

    const getLowStockProducts = () => {
        return products.filter((p) => (p.stockLevels?.[storeKey] || p.stockLevels?.[currentStoreId] || 0) <= (p.minStockLevels?.[storeKey] || p.minStockLevels?.[currentStoreId] || p.minStock || 0));
    };

    const addSupply = (productId, supplyData) => {
        const { quantity, purchasePrice, batchNumber, expiryDate, supplier } = supplyData;
        const rawQty = parseFloat(quantity);

        setProducts(prevProducts => prevProducts.map(p => {
            if (p.id !== productId) return p;

            const cf = parseFloat(p.conversionFactor) || 1;
            const isContainer = (p.unitArchetype === 'BOX' || p.unitArchetype === 'BULK') && cf > 1;
            const internalQty = (supplyData.inContainers && isContainer) ? rawQty * cf : rawQty;

            const newLot = {
                id: `lot-${productId}-${Date.now()}`,
                storeId: currentStoreId || storeKey,
                batchNumber: batchNumber || `BATCH-${new Date().toISOString().slice(0, 10)}`,
                quantity: internalQty,
                purchasePrice: parseFloat(purchasePrice),
                expiryDate: expiryDate || null,
                dateAdded: new Date().toISOString()
            };

            const currentStock = p.stockLevels?.[storeKey] || p.stockLevels?.[currentStoreId] || 0;

            return {
                ...p,
                stockLevels: { ...p.stockLevels, [storeKey]: currentStock + internalQty },
                purchasePrice: parseFloat(purchasePrice),
                supplier: supplier || p.supplier,
                lots: [...(p.lots || []), newLot]
            };
        }));

        setMovements(prev => [{
            id: Date.now(),
            productId,
            storeId: currentStoreId || storeKey,
            type: 'IN',
            quantity: parseFloat(quantity),
            reason: 'Approvisionnement',
            date: new Date().toISOString(),
            user: 'Admin',
            details: `Lot: ${batchNumber || 'N/A'}`
        }, ...prev]);
    };

    // Record sale with FIFO logic - deductions are always in INTERNAL UNITS
    const recordSale = (items) => {
        const currentProducts = [...products];
        const newMovements = [];

        const updatedProducts = currentProducts.map(p => {
            const soldItem = items.find(item => item.id === p.id);
            if (!soldItem) return p;

            // Stock is stored in CONTAINER units for BOX/BULK (e.g. 7 Boîtes, 20 Sacs)
            // Stock is stored in BASE units for UNIT products (e.g. 5 Pièces)
            // stockDeduction is in the SAME unit as product.stock
            const deduction = soldItem.stockDeduction !== undefined
                ? soldItem.stockDeduction
                : (soldItem.quantity || 0);

            const currentStock = p.stockLevels?.[storeKey] || p.stockLevels?.[currentStoreId] || 0;
            let remainingToDeduct = deduction;

            // Only process lots for the current store
            let storeLots = [...(p.lots || [])].filter(l => l.storeId && String(l.storeId) === storeKey).sort((a, b) => new Date(a.dateAdded) - new Date(b.dateAdded));
            const otherLots = [...(p.lots || [])].filter(l => !l.storeId || String(l.storeId) !== storeKey);

            storeLots = storeLots.map(lot => {
                if (remainingToDeduct <= 0) return lot;
                if (lot.quantity >= remainingToDeduct) {
                    const deducted = remainingToDeduct;
                    remainingToDeduct = 0;
                    return { ...lot, quantity: lot.quantity - deducted };
                } else {
                    remainingToDeduct -= lot.quantity;
                    return { ...lot, quantity: 0 };
                }
            }).filter(lot => lot.quantity > 0);

            newMovements.push({
                id: Date.now() + Math.random(),
                productId: p.id,
                storeId: currentStoreId || storeKey,
                type: 'OUT',
                quantity: deduction,
                unit: p.unit,
                reason: 'Vente',
                date: new Date().toISOString(),
                user: 'Admin'
            });

            return {
                ...p,
                stockLevels: { ...p.stockLevels, [storeKey]: Math.max(0, currentStock - deduction) },
                lots: [...storeLots, ...otherLots]
            };
        });

        setProducts(updatedProducts);
        setMovements(prev => [...newMovements, ...prev]);
    };

    // Record customer return and restock items if intact
    const recordReturn = (items, returnReference = '') => {
        const currentProducts = [...products];
        const newMovements = [];

        const updatedProducts = currentProducts.map(p => {
            const returnedItem = items.find(item => item.id === p.id || item.productId === p.id);
            if (!returnedItem) return p;

            const qty = returnedItem.stockDeduction !== undefined
                ? Number(returnedItem.stockDeduction)
                : (parseFloat(returnedItem.quantityReturned) || parseFloat(returnedItem.quantity) || 0);

            const isIntact = returnedItem.condition === 'intact' || returnedItem.reintegrate !== false;
            const currentStock = p.stockLevels?.[storeKey] || p.stockLevels?.[currentStoreId] || 0;

            if (isIntact) {
                newMovements.push({
                    id: Date.now() + Math.random(),
                    productId: p.id,
                    storeId: currentStoreId || storeKey,
                    type: 'IN',
                    quantity: qty,
                    unit: p.unit,
                    reason: 'Retour client (Bon état)',
                    details: returnReference ? `Réf: ${returnReference}` : 'Réintégration stock',
                    date: new Date().toISOString(),
                    user: 'Caisse'
                });

                return {
                    ...p,
                    stockLevels: {
                        ...p.stockLevels,
                        [storeKey]: currentStock + qty
                    }
                };
            } else {
                newMovements.push({
                    id: Date.now() + Math.random(),
                    productId: p.id,
                    storeId: currentStoreId || storeKey,
                    type: 'ADJUSTMENT',
                    quantity: qty,
                    unit: p.unit,
                    reason: 'Retour client (Avarié / Non réintégré)',
                    details: returnReference ? `Réf: ${returnReference} (Rebut)` : 'Article défectueux',
                    date: new Date().toISOString(),
                    user: 'Caisse'
                });

                return p;
            }
        });

        setProducts(updatedProducts);
        if (newMovements.length > 0) {
            setMovements(prev => [...newMovements, ...prev]);
        }
    };

    const recordAdjustment = (productId, quantityDelta, reason, details = '', targetStoreId = null, userName = 'Admin') => {
        const storeTarget = targetStoreId ? String(targetStoreId) : storeKey;
        const delta = parseFloat(quantityDelta) || 0;
        let affectedProduct = null;

        setProducts(prevProducts => prevProducts.map(p => {
            if (p.id !== productId) return p;
            affectedProduct = p;
            const currentStock = p.stockLevels?.[storeTarget] !== undefined 
                ? Number(p.stockLevels[storeTarget]) 
                : (p.stockLevels?.[storeKey] !== undefined ? Number(p.stockLevels[storeKey]) : Number(p.stock || 0));
            const newStock = Math.max(0, currentStock + delta);
            return {
                ...p,
                stock: storeTarget === storeKey ? newStock : (p.stock || 0),
                stockLevels: {
                    ...(p.stockLevels || {}),
                    [storeTarget]: newStock
                }
            };
        }));

        const newMovement = {
            id: Date.now() + Math.random(),
            productId,
            productName: affectedProduct ? affectedProduct.name : 'Produit',
            unit: affectedProduct ? (affectedProduct.unit || 'Unités') : 'Unités',
            storeId: storeTarget,
            type: 'ADJUST',
            quantity: delta,
            reason: reason || "Correction d'inventaire",
            details: details || '',
            date: new Date().toISOString(),
            user: userName || 'Admin'
        };

        setMovements(prev => [newMovement, ...prev]);
        return newMovement;
    };

    const recordTransfer = (productId, quantity, sourceStoreId, targetStoreId, reason = 'Transfert inter-boutiques', details = '', userName = 'Admin') => {
        const qty = Math.abs(parseFloat(quantity)) || 0;
        const srcStore = String(sourceStoreId);
        const tgtStore = String(targetStoreId);
        let affectedProduct = null;

        setProducts(prevProducts => prevProducts.map(p => {
            if (p.id !== productId) return p;
            affectedProduct = p;
            const currentSrc = p.stockLevels?.[srcStore] !== undefined ? Number(p.stockLevels[srcStore]) : Number(p.stock || 0);
            const currentTgt = p.stockLevels?.[tgtStore] !== undefined ? Number(p.stockLevels[tgtStore]) : 0;
            const newSrc = Math.max(0, currentSrc - qty);
            const newTgt = currentTgt + qty;

            return {
                ...p,
                stock: srcStore === storeKey ? newSrc : (tgtStore === storeKey ? newTgt : (p.stock || 0)),
                stockLevels: {
                    ...(p.stockLevels || {}),
                    [srcStore]: newSrc,
                    [tgtStore]: newTgt
                }
            };
        }));

        const transferMovement = {
            id: Date.now() + Math.random(),
            productId,
            productName: affectedProduct ? affectedProduct.name : 'Produit',
            unit: affectedProduct ? (affectedProduct.unit || 'Unités') : 'Unités',
            storeId: srcStore,
            targetStoreId: tgtStore,
            type: 'TRANSFER',
            quantity: qty,
            reason: reason,
            details: details || `Transfert vers magasin #${tgtStore}`,
            date: new Date().toISOString(),
            user: userName || 'Admin'
        };

        setMovements(prev => [transferMovement, ...prev]);
        return transferMovement;
    };

    const getProductMovements = (productId) => {
        return movements.filter(m => m.productId === productId && m.storeId && String(m.storeId) === storeKey);
    };

    return (
        <InventoryContext.Provider
            value={{
                products,
                isLoadingFromBackend,
                refreshProducts,
                addProduct,
                updateProduct,
                deleteProduct,
                getLowStockProducts,
                addSupply,
                recordSale,
                recordReturn,
                movements,
                recordAdjustment,
                recordTransfer,
                getProductMovements,
                deconditionModels,
                addDeconditionModel,
                updateDeconditionModel,
                deleteDeconditionModel,
                categories,
                addCategory,
                updateCategory,
                deleteCategory,
                isCreateProductModalOpen,
                openCreateProductModal,
                closeCreateProductModal
            }}
        >
            {children}
        </InventoryContext.Provider>
    );
};
