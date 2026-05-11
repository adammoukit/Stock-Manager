import React, { createContext, useContext, useState, useEffect } from "react";
import { useSettings } from "./SettingsContext";
import { productApi } from "../services/apiClient";

const InventoryContext = createContext();

export const useInventory = () => useContext(InventoryContext);

export const InventoryProvider = ({ children }) => {
    const { currentStoreId } = useSettings();

    // Initialisation vide, les produits seront chargés depuis le backend
    const [products, setProducts] = useState([]);

    const [movements, setMovements] = useState(() => {
        const saved = localStorage.getItem("movements");
        const isV3 = localStorage.getItem("quincaillerie_stock_migration_v3");
        return (saved && isV3) ? JSON.parse(saved) : [];
    });

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

    const mapAndSetProducts = (backendProducts) => {
        if (!backendProducts) return;

        const mappedProducts = backendProducts.map(dto => ({
            id: dto.id,                          // UUID string
            name: dto.name,
            category: dto.category,
            supplier: dto.supplier,
            unitArchetype: dto.unitArchetype,
            unit: dto.baseUnit,                  // baseUnit → unit
            baseUnit: dto.baseUnit,
            conversionFactor: dto.conversionFactor ? Number(dto.conversionFactor) : 1,
            purchasePrice: dto.purchasePrice ? Number(dto.purchasePrice) : 0,
            bulkPurchasePrice: dto.bulkPurchasePrice ? Number(dto.bulkPurchasePrice) : null,
            price: dto.price ? Number(dto.price) : 0,
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
            lots: []
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
    }, []);

    // Synchronisation locale désactivée pour les produits (Le backend est la source de vérité)
    // useEffect(() => {
    //     localStorage.setItem("products", JSON.stringify(products));
    // }, [products]);

    useEffect(() => {
        localStorage.setItem("movements", JSON.stringify(movements));
    }, [movements]);

    useEffect(() => {
        localStorage.setItem('quincaillerie_decondition_models', JSON.stringify(deconditionModels));
    }, [deconditionModels]);

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
                category: product.category,
                supplier: product.supplier,
                unitArchetype: product.unitArchetype,
                baseUnit: product.unit || 'Unité',
                stockReceived: product.stock || 0,
                minStock: product.minStock || 0,
                conversionFactor: product.conversionFactor || 1,
                bulkPurchasePrice: product.bulkPurchasePrice || null,
                bulkUnit: product.bulkUnit || '',
                bulkPrice: product.bulkPrice || null,
                price: product.price || 0,
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
                category: mergedProduct.category,
                supplier: mergedProduct.supplier,
                unitArchetype: mergedProduct.unitArchetype,
                baseUnit: mergedProduct.unit || 'Unité',
                stockReceived: mergedProduct.stock || 0,
                minStock: mergedProduct.minStock || 0,
                conversionFactor: mergedProduct.conversionFactor || 1,
                bulkPurchasePrice: mergedProduct.bulkPurchasePrice || null,
                bulkUnit: mergedProduct.bulkUnit || '',
                bulkPrice: mergedProduct.bulkPrice || null,
                price: mergedProduct.price || 0,
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
        return products.filter((p) => (p.stockLevels?.[currentStoreId] || 0) <= (p.minStockLevels?.[currentStoreId] || p.minStock || 0));
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
                storeId: currentStoreId,
                batchNumber: batchNumber || `BATCH-${new Date().toISOString().slice(0, 10)}`,
                quantity: internalQty,
                purchasePrice: parseFloat(purchasePrice),
                expiryDate: expiryDate || null,
                dateAdded: new Date().toISOString()
            };

            const currentStock = p.stockLevels?.[currentStoreId] || 0;

            return {
                ...p,
                stockLevels: { ...p.stockLevels, [currentStoreId]: currentStock + internalQty },
                purchasePrice: parseFloat(purchasePrice),
                supplier: supplier || p.supplier,
                lots: [...(p.lots || []), newLot]
            };
        }));

        setMovements(prev => [{
            id: Date.now(),
            productId,
            storeId: currentStoreId,
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

            const currentStock = p.stockLevels?.[currentStoreId] || 0;
            let remainingToDeduct = deduction;

            // Only process lots for the current store
            let storeLots = [...(p.lots || [])].filter(l => l.storeId === currentStoreId).sort((a, b) => new Date(a.dateAdded) - new Date(b.dateAdded));
            const otherLots = [...(p.lots || [])].filter(l => l.storeId !== currentStoreId);

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
                storeId: currentStoreId,
                type: 'OUT',
                quantity: deduction,
                unit: p.unit,
                reason: 'Vente',
                date: new Date().toISOString(),
                user: 'Admin'
            });

            return {
                ...p,
                stockLevels: { ...p.stockLevels, [currentStoreId]: Math.max(0, currentStock - deduction) },
                lots: [...storeLots, ...otherLots]
            };
        });

        setProducts(updatedProducts);
        setMovements(prev => [...newMovements, ...prev]);
    };


    const getProductMovements = (productId) => {
        return movements.filter(m => m.productId === productId && m.storeId === currentStoreId);
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
                getProductMovements,
                deconditionModels,
                addDeconditionModel,
                updateDeconditionModel,
                deleteDeconditionModel
            }}
        >
            {children}
        </InventoryContext.Provider>
    );
};
