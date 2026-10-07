import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { usePurchase } from '../../context/PurchaseContext';
import {
    Plus, Search, Filter, Truck, CheckCircle, Clock,
    AlertTriangle, Package, FileText, Eye, ShieldAlert,
    Box, Layers, Sparkles, RefreshCw, ShoppingCart, Trash2,
    Check, ChevronRight, ArrowRight, Printer, DollarSign,
    TrendingUp, Calendar, ArrowUpDown, ChevronDown, CheckCircle2,
    RotateCcw, BookmarkCheck, Edit3, ArrowLeft, X
} from 'lucide-react';
import { formatPrice } from '../../utils/currency';
import { formatContainerStock } from '../../config/unitModels';
import { calculateSmartReplenishment, getProductArchetype } from '../../utils/smartReplenishment';
import { formatOrderNumber } from '../../utils/transactionFormat';
import FinancialInput from '../../components/FinancialInput';
import T from '../../utils/toast';

const Replenishment = () => {
    const { products, updateProduct } = useInventory();
    const {
        orders,
        suppliers,
        createOrder,
        receiveOrder,
        deleteOrder,
        forceCompleteOrder,
        replenishmentQueue,
        addToReplenishmentQueue,
        removeFromReplenishmentQueue,
        updateReplenishmentQueueItem,
        clearReplenishmentQueue,
        generateOrdersFromQueue
    } = usePurchase();

    // ── Overrides locaux pour réactivité instantanée des prix et quantités ──
    // Format: { [productId]: { customPrice?: number, customContainers?: number, customSupplier?: string } }
    const [customOverrides, setCustomOverrides] = useState({});
    const [syncingCatalogId, setSyncingCatalogId] = useState(null);
    const [syncAllCatalogOnOrder, setSyncAllCatalogOnOrder] = useState(false);

    // ── Onglets principaux harmonisés ──
    const [activeMainTab, setActiveMainTab] = useState('generator'); // 'generator' | 'orders'

    // ── Loader de 1.5 seconde sur les filtres ──
    const [filterLoading, setFilterLoading] = useState(false);
    const filterTimerRef = useRef(null);

    const handleFilterChange = (setter, value) => {
        setFilterLoading(true);
        setter(value);
        if (filterTimerRef.current) clearTimeout(filterTimerRef.current);
        filterTimerRef.current = setTimeout(() => {
            setFilterLoading(false);
        }, 1500); // Au moins 1,5 seconde
    };

    // ── Loader de validation d'au moins 1,5 seconde pour chaque action métier ──
    const [actionLoading, setActionLoading] = useState(null);

    // ── Loader d'entrée de page (scroll top + 1,5s) ──
    const [isPageLoading, setIsPageLoading] = useState(true);
    const pageLoadTimerRef = useRef(null);

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
        pageLoadTimerRef.current = setTimeout(() => {
            setIsPageLoading(false);
        }, 1500);
        return () => {
            if (filterTimerRef.current) clearTimeout(filterTimerRef.current);
            if (pageLoadTimerRef.current) clearTimeout(pageLoadTimerRef.current);
        };
    }, []);

    // ── Filtres Générateur Intelligent ──
    const [archetypeFilter, setArchetypeFilter] = useState('all'); // 'all' | 'BOX' | 'BULK' | 'UNIT'
    const [supplierFilter, setSupplierFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Sélection multiple pour validation des commandes
    const [selectedProductIds, setSelectedProductIds] = useState([]);

    // ── Registre des Réapprovisionnements (Affiché en bas de l'écran) ──
    const [orderStatusTab, setOrderStatusTab] = useState('active'); // 'active' | 'drafts' | 'completed' | 'all'
    const [orderDateFilter, setOrderDateFilter] = useState('all'); // 'all' | 'today' | '7days' | 'thisMonth' | 'custom'
    const [orderStartDate, setOrderStartDate] = useState('');
    const [orderEndDate, setOrderEndDate] = useState('');
    const [orderSearchQuery, setOrderSearchQuery] = useState('');

    // ── Fiche Détaillée Plein Écran (recouvre tout l'écran au clic sur 'Voir') ──
    const [fullScreenOrder, setFullScreenOrder] = useState(null);

    // ── Boîtes de Dialogue Custom (Confirmation de suppression & clôture) ──
    const [orderToDelete, setOrderToDelete] = useState(null);
    const [orderToForceComplete, setOrderToForceComplete] = useState(null);
    const [orderConfirmData, setOrderConfirmData] = useState(null);

    // ── Filtres Grand Livre des Commandes ──
    const [filterStatus, setFilterStatus] = useState('All');

    // ── Modals existants (Commandes manuelles & Réceptions) ──
    const [showNewOrderModal, setShowNewOrderModal] = useState(false);
    const [showReceiveModal, setShowReceiveModal] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);

    // New Order Modal State
    const [newOrderData, setNewOrderData] = useState({ supplier: '', items: [] });
    const [manualProductSearch, setManualProductSearch] = useState('');
    const [onlyLowStockManual, setOnlyLowStockManual] = useState(false);

    // Receive Order State
    const [receiveData, setReceiveData] = useState({});
    const [receivedBy, setReceivedBy] = useState('');
    const [isPaidCash, setIsPaidCash] = useState(false);

    // ════════════════════════════════════════════════════════════════════════════
    // 1. MOTEUR DE RÉAPPROVISIONNEMENT INTELLIGENT (CALCUL & SÉLECTION)
    // ════════════════════════════════════════════════════════════════════════════

    // Le tableau ne contient QUE les articles expressément ajoutés au réapprovisionnement
    // PAS d'ajout automatique des produits en manque !
    const smartReplenishmentItems = useMemo(() => {
        const itemMap = new Map();

        // Articles ajoutés depuis le Catalogue de Produits (replenishmentQueue) ou manuellement
        (replenishmentQueue || []).forEach(q => {
            const product = (products || []).find(p => String(p.id) === String(q.productId));
            const override = customOverrides[String(q.productId)] || {};
            const targetContainers = override.customContainers !== undefined 
                ? override.customContainers 
                : (q.recommendedContainers ?? null);
            const targetPrice = override.customPrice !== undefined 
                ? override.customPrice 
                : (q.purchasePricePerContainer ?? null);

            const baseItem = product ? calculateSmartReplenishment(product, targetContainers, targetPrice) : q;
            const finalSupplier = override.customSupplier || q.supplier || baseItem.supplier;
            const finalContainers = override.customContainers !== undefined ? override.customContainers : (baseItem.recommendedContainers || 1);
            const finalPrice = override.customPrice !== undefined ? override.customPrice : (baseItem.purchasePricePerContainer || 0);
            const originalCatPrice = baseItem.originalPurchasePrice ?? (parseFloat(product?.purchasePrice) || 0);

            itemMap.set(String(q.productId), {
                ...baseItem,
                ...q,
                recommendedContainers: finalContainers,
                totalSubUnits: finalContainers * (baseItem.factor || 1),
                purchasePricePerContainer: finalPrice,
                originalPurchasePrice: originalCatPrice,
                isPriceModified: Math.abs(finalPrice - originalCatPrice) > 0.001,
                estimatedTotalCost: finalContainers * finalPrice,
                supplier: finalSupplier,
                source: 'manual',
                selected: true
            });
        });

        return Array.from(itemMap.values());
    }, [products, replenishmentQueue, customOverrides]);

    // Initialisation / maintien des IDs sélectionnés par défaut
    useEffect(() => {
        const allIds = smartReplenishmentItems.map(i => i.productId);
        setSelectedProductIds(allIds);
    }, [smartReplenishmentItems]);

    // Filtrage des articles du générateur
    const filteredSmartItems = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        return smartReplenishmentItems.filter(item => {
            // Filtre archétype conditionnement
            if (archetypeFilter !== 'all' && item.archetype !== archetypeFilter) {
                return false;
            }
            // Filtre fournisseur
            if (supplierFilter !== 'all' && item.supplier !== supplierFilter) {
                return false;
            }
            // Recherche textuelle
            if (q) {
                const matchName = item.name?.toLowerCase().includes(q);
                const matchCat = item.category?.toLowerCase().includes(q);
                const matchBar = item.barcode?.toLowerCase().includes(q);
                const matchSup = item.supplier?.toLowerCase().includes(q);
                if (!matchName && !matchCat && !matchBar && !matchSup) return false;
            }
            return true;
        });
    }, [smartReplenishmentItems, archetypeFilter, supplierFilter, searchQuery]);

    // ── Métriques KPI du Générateur & Vue Stock Global ──
    const smartKPIs = useMemo(() => {
        let outOfStockCount = 0;
        let criticalAlertCount = 0;

        // Calcul des alertes globales sur le catalogue de la boutique
        (products || []).forEach(p => {
            const stock = parseFloat(p.stock) || 0;
            const min = parseFloat(p.minStock) || 0;
            if (stock <= 0) outOfStockCount++;
            else if (stock <= min) criticalAlertCount++;
        });

        let totalEstimatedCost = 0;
        let boxCount = 0;
        let bulkCount = 0;
        let unitCount = 0;
        let modifiedPriceCount = 0;

        smartReplenishmentItems.forEach(i => {
            totalEstimatedCost += (i.estimatedTotalCost || 0);

            if (i.isPriceModified) {
                modifiedPriceCount++;
            }

            if (i.archetype === 'BOX') boxCount++;
            else if (i.archetype === 'BULK') bulkCount++;
            else unitCount++;
        });

        return {
            outOfStockCount,
            criticalAlertCount,
            totalItemsCount: smartReplenishmentItems.length,
            totalEstimatedCost,
            boxCount,
            bulkCount,
            unitCount,
            modifiedPriceCount
        };
    }, [products, smartReplenishmentItems]);

    // ── Option Manuelle : Importer les alertes de stock dans le réapprovisionnement (à la demande) ──
    const handleImportAlertProducts = async () => {
        const alertProducts = (products || []).filter(p => {
            const stock = parseFloat(p.stock) || 0;
            const min = parseFloat(p.minStock) || 0;
            return stock <= min || stock <= 0;
        });

        if (alertProducts.length === 0) {
            T.info("Aucun article en rupture ou sous seuil de stock.");
            return;
        }

        setActionLoading("Importation des articles sous seuil d'alerte...");
        await new Promise(r => setTimeout(r, 1500));

        alertProducts.forEach(p => {
            addToReplenishmentQueue(p, null, '', null, p.supplier || '');
        });

        setActionLoading(null);
        T.success(`${alertProducts.length} article(s) sous seuil d'alerte importé(s) dans le réapprovisionnement.`);
    };

    // ── Gestion de la sélection par case à cocher ──
    const handleToggleSelectAll = () => {
        const filteredIds = filteredSmartItems.map(i => i.productId);
        const allSelected = filteredIds.every(id => selectedProductIds.includes(id));
        if (allSelected) {
            setSelectedProductIds(prev => prev.filter(id => !filteredIds.includes(id)));
        } else {
            setSelectedProductIds(prev => Array.from(new Set([...prev, ...filteredIds])));
        }
    };

    const handleToggleSelectItem = (productId) => {
        setSelectedProductIds(prev =>
            prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
        );
    };

    // ── Modification en direct du nombre de contenants d'un article ──
    const handleUpdateQuantity = (productId, deltaOrVal) => {
        const item = smartReplenishmentItems.find(i => String(i.productId) === String(productId));
        if (!item) return;

        let newQty = item.recommendedContainers;
        if (typeof deltaOrVal === 'number') {
            newQty = Math.max(1, item.recommendedContainers + deltaOrVal);
        } else {
            const parsed = parseInt(deltaOrVal, 10);
            newQty = isNaN(parsed) || parsed < 1 ? 1 : parsed;
        }

        setCustomOverrides(prev => ({
            ...prev,
            [String(productId)]: {
                ...prev[String(productId)],
                customContainers: newQty
            }
        }));

        updateReplenishmentQueueItem(productId, {
            recommendedContainers: newQty
        });
    };

    // ── Modification en direct du prix d'achat fournisseur ──
    const handleUpdatePrice = (productId, newPriceRaw) => {
        const parsed = parseFloat(newPriceRaw);
        const validPrice = isNaN(parsed) || parsed < 0 ? 0 : parsed;

        setCustomOverrides(prev => ({
            ...prev,
            [String(productId)]: {
                ...prev[String(productId)],
                customPrice: validPrice
            }
        }));

        updateReplenishmentQueueItem(productId, {
            purchasePricePerContainer: validPrice
        });
    };

    // ── Rétablir le prix d'achat catalogue initial ──
    const handleResetPrice = (productId, originalPrice) => {
        setCustomOverrides(prev => {
            const copy = { ...prev };
            if (copy[String(productId)]) {
                const nextItem = { ...copy[String(productId)] };
                delete nextItem.customPrice;
                copy[String(productId)] = nextItem;
            }
            return copy;
        });

        updateReplenishmentQueueItem(productId, {
            purchasePricePerContainer: originalPrice
        });
        T.info("Tarif d'achat réinitialisé au prix catalogue initial.");
    };

    // ── Appliquer et synchroniser directement ce prix dans le Catalogue de Produits ──
    const handleApplyPriceToCatalog = async (productId, newPrice) => {
        try {
            setSyncingCatalogId(productId);
            setActionLoading("Mise à jour du tarif fournisseur dans le catalogue...");
            await new Promise(r => setTimeout(r, 1500));
            await updateProduct(productId, { purchasePrice: newPrice });
            setActionLoading(null);
            T.success("Nouveau tarif fournisseur enregistré dans le catalogue de produits avec succès !");
        } catch (err) {
            setActionLoading(null);
            console.error("Erreur mise à jour catalogue", err);
            T.error("Impossible de mettre à jour le catalogue.");
        } finally {
            setSyncingCatalogId(null);
        }
    };

    // ── Vider le panier avec Loader d'au moins 1,5 seconde ──
    const handleClearQueueWithLoader = async () => {
        setActionLoading("Vidage du panier de réapprovisionnement...");
        await new Promise(r => setTimeout(r, 1500));
        clearReplenishmentQueue();
        setActionLoading(null);
        T.info("Le panier de réapprovisionnement a été vidé.");
    };

    // ── Modification du fournisseur habituel ──
    const handleUpdateSupplier = (productId, newSupplier) => {
        setCustomOverrides(prev => ({
            ...prev,
            [String(productId)]: {
                ...prev[String(productId)],
                customSupplier: newSupplier
            }
        }));

        updateReplenishmentQueueItem(productId, {
            supplier: newSupplier
        });
    };

    // ── Ouverture de la modale de confirmation du Bon de Commande Fournisseur ──
    const handleOpenOrderConfirm = () => {
        const itemsToOrder = filteredSmartItems.length > 0 ? filteredSmartItems : smartReplenishmentItems;
        if (itemsToOrder.length === 0) {
            T.warning("Aucun article dans le tableau à commander.");
            return;
        }

        // Détection du fournisseur cible :
        // 1. Filtre fournisseur actif
        // 2. Ou fournisseur le plus fréquent parmi les articles du tableau
        // 3. Ou premier fournisseur disponible
        let defaultSup = supplierFilter !== 'all' ? supplierFilter : '';
        if (!defaultSup) {
            const counts = {};
            itemsToOrder.forEach(i => {
                const s = (i.supplier || '').trim();
                if (s && s !== 'Fournisseur à désigner' && s !== 'Fournisseur Général') {
                    counts[s] = (counts[s] || 0) + 1;
                }
            });
            const sorted = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
            if (sorted.length > 0) defaultSup = sorted[0];
            else if (suppliers.length > 0) defaultSup = suppliers[0].name || suppliers[0];
            else defaultSup = 'Fournisseur Général';
        }

        setOrderConfirmData({
            items: itemsToOrder,
            supplier: defaultSup,
            customSupplierInput: ''
        });
    };

    // ── Validation et création définitive du Bon de Commande avec 100% des articles ──
    const handleConfirmGenerateOrders = async () => {
        if (!orderConfirmData) return;
        const { items, supplier, customSupplierInput } = orderConfirmData;
        const finalSupplier = (customSupplierInput.trim() || supplier || 'Fournisseur Général').trim();

        setOrderConfirmData(null);

        // Afficher d'abord le loader pendant au moins 1,5 seconde
        setActionLoading(`Création du bon de commande pour les ${items.length} article(s)...`);
        await new Promise(r => setTimeout(r, 1500));

        try {
            // Si l'utilisateur a coché la synchronisation de tous les prix négociés vers le catalogue
            if (syncAllCatalogOnOrder) {
                const modifiedItems = items.filter(i => i.isPriceModified);
                if (modifiedItems.length > 0) {
                    for (const modItem of modifiedItems) {
                        try {
                            await updateProduct(modItem.productId, { purchasePrice: modItem.purchasePricePerContainer });
                        } catch (e) {
                            console.error("Erreur sync catalogue pour", modItem.name, e);
                        }
                    }
                    T.info(`${modifiedItems.length} tarif(s) fournisseur mis à jour dans le Catalogue de Produits.`);
                }
            }

            // Génération groupée sous ce fournisseur unique pour la TOTALITÉ des articles
            const createdOrders = generateOrdersFromQueue(null, items, finalSupplier);

            // Réinitialiser les surcharges locales et la sélection
            setCustomOverrides({});
            setSelectedProductIds([]);

            setActionLoading(null);
            if (createdOrders.length > 0) {
                const orderNum = createdOrders[0].orderNumber;
                T.success(`🎉 Bon de commande ${orderNum} créé avec succès avec la totalité des ${items.length} produit(s) !`);
                setOrderStatusTab('active');
                setOrderDateFilter('all');
                setActiveMainTab('orders');
            } else {
                T.info("Toutes les commandes ont été créées.");
            }
        } catch (err) {
            setActionLoading(null);
            console.error("Erreur génération commandes", err);
            T.error("Une erreur est survenue lors de la génération de la commande.");
        }
    };

    // Synchronisation en direct de la commande affichée plein écran
    useEffect(() => {
        if (fullScreenOrder) {
            const fresh = orders.find(o => o.id === fullScreenOrder.id);
            if (fresh) setFullScreenOrder(fresh);
        }
    }, [orders]);

    // Fermeture avec la touche Échap
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                if (showReceiveModal) {
                    setShowReceiveModal(false);
                    return;
                }
                if (fullScreenOrder) {
                    setFullScreenOrder(null);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [fullScreenOrder, showReceiveModal]);

    // ── Comptages des réapprovisionnements par état ──
    const orderCounts = useMemo(() => {
        let active = 0;
        let completed = 0;
        let drafts = 0;

        orders.forEach(o => {
            if (o.status === 'Ordered' || o.status === 'Partial') active++;
            else if (o.status === 'Completed') completed++;
            else if (o.status === 'Draft') drafts++;
        });

        const queueDraftsCount = replenishmentQueue?.length || 0;
        const pending = orders.filter(o => o.status !== 'Completed').length;

        return {
            all: orders.length,
            active,
            completed,
            drafts: drafts + (queueDraftsCount > 0 ? 1 : 0),
            pending,
            queueDraftsCount
        };
    }, [orders, replenishmentQueue]);

    // ── Filtrage du registre des réapprovisionnements (Statut & Dates) ──
    const filteredReplenishmentOrders = useMemo(() => {
        return orders.filter(order => {
            // 1. Statut
            if (orderStatusTab === 'active') {
                if (order.status !== 'Ordered' && order.status !== 'Partial') return false;
            } else if (orderStatusTab === 'completed') {
                if (order.status !== 'Completed') return false;
            } else if (orderStatusTab === 'drafts') {
                if (order.status !== 'Draft') return false;
            }

            // 2. Filtres par Date
            if (orderDateFilter !== 'all') {
                const orderDate = new Date(order.date);
                const now = new Date();

                if (orderDateFilter === 'today') {
                    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
                    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
                    if (orderDate < todayStart || orderDate > todayEnd) return false;
                } else if (orderDateFilter === '7days') {
                    const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7, 0, 0, 0, 0);
                    if (orderDate < sevenDaysAgo) return false;
                } else if (orderDateFilter === 'thisMonth') {
                    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
                    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
                    if (orderDate < monthStart || orderDate > monthEnd) return false;
                } else if (orderDateFilter === 'custom') {
                    if (orderStartDate) {
                        const [y, m, d] = orderStartDate.split('-').map(Number);
                        const start = new Date(y, m - 1, d, 0, 0, 0, 0);
                        if (orderDate < start) return false;
                    }
                    if (orderEndDate) {
                        const [y, m, d] = orderEndDate.split('-').map(Number);
                        const end = new Date(y, m - 1, d, 23, 59, 59, 999);
                        if (orderDate > end) return false;
                    }
                }
            }

            // 3. Recherche textuelle
            if (orderSearchQuery.trim()) {
                const q = orderSearchQuery.toLowerCase().trim();
                const numRaw = (order.orderNumber || '').toLowerCase();
                const numFormatted = formatOrderNumber(order.orderNumber, order.id, order.date).toLowerCase();
                const matchNum = numRaw.includes(q) || numFormatted.includes(q);
                const matchSup = order.supplier?.toLowerCase().includes(q);
                const matchItems = (order.items || []).some(item => item.name?.toLowerCase().includes(q));
                if (!matchNum && !matchSup && !matchItems) return false;
            }

            return true;
        }).sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [orders, orderStatusTab, orderDateFilter, orderStartDate, orderEndDate, orderSearchQuery]);

    const filteredOrders = useMemo(() => {
        return orders.filter(order =>
            filterStatus === 'All' || order.status === filterStatus
        ).sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [orders, filterStatus]);

    // Modal Nouvelle Commande Manuelle
    const availableManualProducts = useMemo(() => {
        return (products || []).filter(p =>
            (onlyLowStockManual ? p.stock <= p.minStock : true) &&
            p.name?.toLowerCase().includes(manualProductSearch.toLowerCase())
        );
    }, [products, onlyLowStockManual, manualProductSearch]);

    const handleAddManualToOrder = (product) => {
        if (newOrderData.items.find(i => i.id === product.id)) return;
        const suggestedQty = Math.max(5, (product.minStock * 2) - product.stock);

        setNewOrderData({
            ...newOrderData,
            items: [...newOrderData.items, {
                id: product.id,
                name: product.name,
                quantity: suggestedQty,
                purchasePrice: product.purchasePrice || 0,
                stock: product.stock,
                minStock: product.minStock
            }]
        });
        T.cartAdd(product.name);
    };

    const handleRemoveManualFromOrder = (productId) => {
        setNewOrderData({
            ...newOrderData,
            items: newOrderData.items.filter(i => i.id !== productId)
        });
    };

    const handleCreateManualOrder = async () => {
        if (!newOrderData.supplier) {
            T.warning("Veuillez sélectionner un fournisseur.");
            return;
        }
        if (newOrderData.items.length === 0) {
            T.warning("Veuillez ajouter des produits à la commande.");
            return;
        }

        setActionLoading("Création du bon de commande fournisseur...");
        await new Promise(r => setTimeout(r, 1500));

        createOrder(newOrderData.supplier, newOrderData.items);
        setShowNewOrderModal(false);
        setNewOrderData({ supplier: '', items: [] });
        setActionLoading(null);
        T.success("Bon de commande créé avec succès !");
    };

    const openReceiveModal = (order) => {
        setSelectedOrder(order);
        setReceiveData({});
        setReceivedBy('');
        setIsPaidCash(false);
        setShowReceiveModal(true);
    };

    const openDetailsModal = (order) => {
        setSelectedOrder(order);
        setShowDetailsModal(true);
    };

    const handleReceiveOrder = async () => {
        if (!selectedOrder) return;
        if (!receivedBy.trim()) {
            T.warning("Veuillez entrer le nom du réceptionneur.");
            return;
        }

        setActionLoading("Validation et enregistrement de la réception des marchandises...");
        await new Promise(r => setTimeout(r, 1500));

        receiveOrder(selectedOrder.id, receiveData, receivedBy, isPaidCash);
        setShowReceiveModal(false);
        setSelectedOrder(null);
        setActionLoading(null);
        T.success("Réception enregistrée avec succès !");
    };

    // ── Clôture forcée par le Manager (Déclenche modale custom) ──
    const handleForceComplete = (order = null) => {
        const target = order || selectedOrder || fullScreenOrder;
        if (!target) return;
        setOrderToForceComplete(target);
    };

    const handleConfirmForceComplete = async () => {
        if (!orderToForceComplete) return;
        const target = orderToForceComplete;
        setOrderToForceComplete(null);

        setActionLoading("Clôture définitive de la commande...");
        await new Promise(r => setTimeout(r, 1500));

        forceCompleteOrder(target.id);
        if (showDetailsModal) setShowDetailsModal(false);
        if (selectedOrder && selectedOrder.id === target.id) setSelectedOrder(null);
        setActionLoading(null);
        T.success("Commande clôturée définitivement.");
    };

    // ── Suppression d'un bon de réapprovisionnement (Déclenche la boîte custom) ──
    const handleDeleteOrder = (order) => {
        if (!order) return;
        setOrderToDelete(order);
    };

    // Exécution de la suppression après confirmation dans la boîte custom
    const handleConfirmDeleteOrder = async () => {
        if (!orderToDelete) return;
        const order = orderToDelete;
        setOrderToDelete(null);

        setActionLoading(`Suppression du bon ${order.orderNumber}...`);
        await new Promise(r => setTimeout(r, 1500));

        deleteOrder(order.id);

        if (fullScreenOrder && fullScreenOrder.id === order.id) {
            setFullScreenOrder(null);
        }
        if (selectedOrder && selectedOrder.id === order.id) {
            setSelectedOrder(null);
            setShowDetailsModal(false);
            setShowReceiveModal(false);
        }

        setActionLoading(null);
        T.success(`Le bon de réapprovisionnement ${order.orderNumber} a été supprimé.`);
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'Completed': return 'bg-emerald-50 text-emerald-800 border border-emerald-300';
            case 'Partial': return 'bg-amber-50 text-amber-800 border border-amber-300';
            case 'Ordered': return 'bg-blue-50 text-blue-800 border border-blue-300';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    return (
        <div className="space-y-3 font-sans pb-10">

            {/* ── EN-TÊTE PRINCIPAL OFFICIEL KABLLIX ERP ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-[4px] border-2 border-gray-300 shadow-sm">
                <div>
                    <h1 className="text-base sm:text-lg font-bold text-[#001d35] tracking-tight">
                        Réapprovisionnement Intelligent
                    </h1>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setShowNewOrderModal(true)}
                        className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold uppercase tracking-wider rounded-[4px] bg-[#001d35] hover:bg-[#00284a] text-white transition-all cursor-pointer shadow-sm active:scale-95"
                    >
                        <Plus className="w-3.5 h-3.5 text-[#f77500]" />
                        <span>Commande Manuelle</span>
                    </button>
                </div>
            </div>

            {/* ── CONTENEUR PRINCIPAL UNIFIÉ (ONGLETS + CONTENUS DANS LE MÊME ARRIÈRE-PLAN) ── */}
            <div className="bg-white rounded-[4px] border-2 border-gray-300 shadow-sm overflow-hidden">
                {/* ── BARRE D'ONGLETS PRINCIPAUX INTÉGRÉE EN HAUT ── */}
                <div className="p-2 sm:p-2.5 bg-white border-b-2 border-gray-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
                    <div className="flex items-center gap-1 bg-gray-100/80 p-1 rounded-[4px] border-2 border-gray-300 flex-wrap" aria-label="Onglets de réapprovisionnement">
                        {/* Onglet 1 : Liste de réapprovisionnement */}
                        <button
                            type="button"
                            onClick={() => handleFilterChange(setActiveMainTab, 'generator')}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-[4px] transition-all cursor-pointer flex items-center gap-2 ${
                                activeMainTab === 'generator'
                                    ? 'bg-[#001d35] text-white shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                            }`}
                        >
                            <ShoppingCart className={`w-3.5 h-3.5 ${
                                activeMainTab === 'generator' ? 'text-[#f77500]' : 'text-gray-500'
                            }`} />
                            <span>Liste de réapprovisionnement</span>

                            {smartKPIs.totalItemsCount > 0 && (
                                <span className="min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold bg-red-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                                    {smartKPIs.totalItemsCount}
                                </span>
                            )}
                        </button>

                        {/* Barre verticale de séparation */}
                        <div className="h-5 w-px bg-gray-300 mx-1 shrink-0" aria-hidden="true"></div>

                        {/* Onglet 2 : Suivi & Registre des Réapprovisionnements */}
                        <button
                            type="button"
                            onClick={() => handleFilterChange(setActiveMainTab, 'orders')}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-[4px] transition-all cursor-pointer flex items-center gap-2 ${
                                activeMainTab === 'orders'
                                    ? 'bg-[#001d35] text-white shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                            }`}
                        >
                            <FileText className={`w-3.5 h-3.5 ${
                                activeMainTab === 'orders' ? 'text-[#f77500]' : 'text-gray-500'
                            }`} />
                            <span>Suivi & Registre des Réapprovisionnements</span>

                            {orderCounts.pending > 0 && (
                                <span className="min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold bg-red-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs" title={`${orderCounts.pending} réapprovisionnement(s) en attente / à traiter`}>
                                    {orderCounts.pending}
                                </span>
                            )}
                        </button>
                    </div>

                    {/* Badge file d'attente manuelle */}
                    {replenishmentQueue?.length > 0 && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-[#001d35] rounded-[4px] border border-blue-200 text-xs font-medium">
                            <Truck className="w-3.5 h-3.5 text-[#f77500]" />
                            <span><strong>{replenishmentQueue.length}</strong> article(s) ajouté(s) depuis le catalogue</span>
                        </div>
                    )}
                </div>

                {/* ── CORPS DU CONTENEUR : CONTENU DE L'ONGLET ACTIF (MÊME ARRIÈRE-PLAN BLANC) ── */}
                <div className="p-3 space-y-3 bg-white">
                    {/* ========================================================================= */}
                    {/* ONGLET 1 : GÉNÉRATEUR DE RÉAPPROVISIONNEMENT INTELLIGENT                  */}
                    {/* ========================================================================= */}
                    {activeMainTab === 'generator' && (
                        <>
                            {/* ── BARRE COMPACTE : Recherche + Métriques KPI inline ── */}
                            <div className="bg-slate-50/70 p-2.5 rounded-[4px] border-2 border-gray-300 shadow-2xs">
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">

                                    {/* Champ de recherche (taille réduite) */}
                                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                                        <div className="relative w-52">
                                            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                            <input
                                                type="text"
                                                placeholder="Filtrer par article, réf..."
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-[4px] focus:outline-none focus:ring-1 focus:ring-[#001d35] bg-white font-normal"
                                            />
                                        </div>

                                        <select
                                            value={supplierFilter}
                                            onChange={(e) => handleFilterChange(setSupplierFilter, e.target.value)}
                                            className="px-2.5 py-1.5 text-xs border border-gray-300 rounded-[4px] bg-white font-normal text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#001d35]"
                                        >
                                            <option value="all">Tous les fournisseurs</option>
                                            {suppliers.map(s => (
                                                <option key={s.id || s.name || s} value={s.name || s}>{s.name || s}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Séparateur vertical */}
                                    <div className="hidden sm:block h-8 w-px bg-gray-200 shrink-0" />

                                    {/* ── Métriques KPI inline compactes ── */}
                                    <div className="flex flex-wrap items-center gap-3 flex-1">
                                        {/* Ruptures Immédiates */}
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Ruptures Immédiates :</span>
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-[3px] border ${
                                                smartKPIs.outOfStockCount > 0
                                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                            }`}>
                                                {smartKPIs.outOfStockCount}
                                            </span>
                                        </div>

                                        <div className="h-4 w-px bg-gray-200 shrink-0 hidden sm:block" />

                                        {/* Sous Seuil d'Alerte */}
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Sous Seuil d'Alerte :</span>
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-[3px] border ${
                                                smartKPIs.criticalAlertCount > 0
                                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                            }`}>
                                                {smartKPIs.criticalAlertCount}
                                            </span>
                                        </div>

                                        <div className="h-4 w-px bg-gray-200 shrink-0 hidden sm:block" />

                                        {/* Budget Estimé Total */}
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Budget Estimé Total :</span>
                                            <span className="text-xs font-bold px-2 py-0.5 rounded-[3px] border bg-[#001d35]/5 text-[#001d35] border-[#001d35]/20">
                                                {formatPrice(smartKPIs.totalEstimatedCost)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Bouton Importer les produits sous le seuil d'alerte */}
                                    {smartKPIs.outOfStockCount + smartKPIs.criticalAlertCount > 0 && (
                                        <button
                                            type="button"
                                            onClick={handleImportAlertProducts}
                                            className="px-3 py-1.5 text-xs font-semibold rounded-[4px] border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 transition-all cursor-pointer flex items-center gap-1.5 shadow-xs shrink-0"
                                            title="Ajouter à la demande les articles en alerte au réapprovisionnement"
                                        >
                                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                            <span>Importer les produits sous le seuil d'alerte ({smartKPIs.outOfStockCount + smartKPIs.criticalAlertCount})</span>
                                        </button>
                                    )}
                                </div>
                            </div>

                    {/* Tableau Super-Intelligent du Réapprovisionnement */}
                    <div className="bg-white border-2 border-gray-300 rounded-[4px] shadow-sm overflow-hidden min-h-[350px] flex flex-col justify-center">
                        {filterLoading ? (
                            <div className="p-16 flex flex-col items-center justify-center bg-white animate-in fade-in duration-150">
                                <div className="relative h-10 w-10">
                                    <div className="absolute inset-0 animate-spin rounded-full border-4 border-gray-200 border-t-[#001d35]"></div>
                                    <div className="absolute inset-1.5 animate-spin-reverse rounded-full border-2 border-transparent border-b-[#f77500]"></div>
                                </div>
                                <p className="text-xs font-semibold text-[#001d35] mt-3 uppercase tracking-wider">
                                    Calcul du réapprovisionnement intelligent...
                                </p>
                                <p className="text-[11px] text-gray-500 mt-0.5 font-medium">
                                    Prise en compte des conditionnements (Unique, Boîtes/Cartons, Vrac)
                                </p>
                            </div>
                        ) : filteredSmartItems.length === 0 ? (
                            <div className="p-12 text-center text-gray-500">
                                <ShoppingCart className="w-12 h-12 mx-auto text-gray-400 mb-2 opacity-60" />
                                <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                    Aucun article dans votre liste de réapprovisionnement
                                </h3>
                                <p className="text-[11px] text-gray-500 mt-1 max-w-md mx-auto font-normal">
                                    Ajoutez les articles de votre choix directement depuis le <strong>Catalogue de Produits</strong> en cliquant sur <em>« Ajouter au réapprovisionnement »</em>.
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-[#001d35] text-white font-semibold uppercase tracking-wider text-[10px] divide-x divide-white/20 sticky top-0">
                                            <th className="py-2.5 px-2.5 w-9 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={filteredSmartItems.length > 0 && filteredSmartItems.every(i => selectedProductIds.includes(i.productId))}
                                                    onChange={handleToggleSelectAll}
                                                    className="w-4 h-4 rounded-xs text-[#001d35] focus:ring-0 cursor-pointer"
                                                />
                                            </th>
                                            <th className="py-2.5 px-2.5 w-40">Article</th>
                                            <th className="py-2.5 px-2 w-28 text-center">Conditionnement</th>
                                            <th className="py-2.5 px-3 w-60 text-center">Stock Actuel & Qté Commandée</th>
                                            <th className="py-2.5 px-2.5 w-36 text-center">Stock Après Réappro</th>
                                            <th className="py-2.5 px-2.5 w-32">Fournisseur Attribué</th>
                                            <th className="py-2.5 px-3 text-center w-72 min-w-[270px]">Prix d'Achat & Total</th>
                                            <th className="py-2.5 px-2 w-20 text-center">Urgence</th>
                                            <th className="py-2.5 px-2 text-center w-12">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {filteredSmartItems.map((item) => {
                                            const isSelected = selectedProductIds.includes(item.productId);
                                            const isBox = item.archetype === 'BOX';
                                            const isBulk = item.archetype === 'BULK';

                                            return (
                                                <tr
                                                    key={item.productId}
                                                    className={`transition-colors border-b border-gray-200 ${
                                                        isSelected ? 'bg-white hover:bg-blue-50/60' : 'bg-slate-50/80 hover:bg-slate-100'
                                                    }`}
                                                >
                                                    {/* Checkbox */}
                                                    <td className="py-2.5 px-2.5 text-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => handleToggleSelectItem(item.productId)}
                                                            className="w-4 h-4 rounded-xs text-[#001d35] focus:ring-0 cursor-pointer"
                                                        />
                                                    </td>

                                                    {/* Article (Taille réduite, sans Référence) */}
                                                    <td className="py-2.5 px-2.5 w-40">
                                                        <div className="font-semibold text-gray-900 text-xs truncate max-w-[155px]" title={item.name}>
                                                            {item.name}
                                                        </div>
                                                        <div className="text-[10px] text-gray-400 font-normal flex items-center gap-1 mt-0.5">
                                                            <span className="truncate max-w-[95px]">{item.category}</span>
                                                            {item.source === 'manual' && (
                                                                <span className="bg-blue-50 text-blue-700 font-semibold px-1 py-0.2 rounded-[3px] uppercase text-[8.5px] border border-blue-200">
                                                                    Catalogue
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* Conditionnement Configuré (Taille optimisée) */}
                                                    <td className="py-2.5 px-2 w-28 text-center">
                                                        <div className="flex flex-col items-center gap-0.5">
                                                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[3px] text-[10px] font-semibold uppercase tracking-wider ${
                                                                isBox 
                                                                    ? 'bg-amber-50 text-amber-800 border border-amber-200' 
                                                                    : isBulk 
                                                                        ? 'bg-sky-50 text-sky-800 border border-sky-200' 
                                                                        : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                                            }`}>
                                                                {isBox ? <Box className="w-3 h-3 text-amber-700" /> :
                                                                 isBulk ? <Layers className="w-3 h-3 text-sky-700" /> :
                                                                 <Package className="w-3 h-3 text-emerald-700" />}
                                                                <span>{isBox ? 'Carton' : isBulk ? 'Vrac' : 'Unité'}</span>
                                                            </span>
                                                            <span className="text-[9.5px] text-gray-400 font-normal truncate max-w-[110px]" title={item.packagingDescription}>
                                                                {item.packagingDescription}
                                                            </span>
                                                        </div>
                                                    </td>

                                                    {/* COLONNE COMBINÉE : Stock Actuel & Recommandation Intelligente (Qté Commandée) */}
                                                    <td className="py-2.5 px-3 w-60">
                                                        <div className="flex flex-col gap-1.5">
                                                            {/* Stock Actuel vs Seuil */}
                                                            <div className="flex items-center justify-between text-xs bg-slate-50 px-2 py-1 rounded-[3px] border border-gray-200">
                                                                <span className="text-[11px] text-gray-500 font-medium">Actuel :</span>
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="font-semibold text-xs" style={{ color: item.currentStock <= 0 ? '#e11d48' : '#b45309' }}>
                                                                        {item.formattedStock}
                                                                    </span>
                                                                    <span className="text-[10px] text-gray-400 font-normal">
                                                                        (Min: {item.minStock})
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            {/* Recommandation Intelligente & Stepper Quantité Commandée */}
                                                            <div className="flex items-center gap-2">
                                                                <div className="inline-flex items-center border border-gray-300 rounded-[4px] overflow-hidden bg-white shadow-2xs">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleUpdateQuantity(item.productId, -1)}
                                                                        className="w-6 h-6 flex items-center justify-center bg-gray-50 hover:bg-gray-100 text-gray-600 font-medium text-xs cursor-pointer select-none border-r border-gray-200 transition-colors"
                                                                        title="Diminuer la quantité commandée"
                                                                    >
                                                                        −
                                                                    </button>
                                                                    <input
                                                                        type="number"
                                                                        min="1"
                                                                        value={item.recommendedContainers}
                                                                        onChange={(e) => handleUpdateQuantity(item.productId, e.target.value)}
                                                                        className="w-11 text-center font-semibold text-xs py-0.5 text-[#001d35] focus:outline-none"
                                                                        title="Quantité commandée"
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleUpdateQuantity(item.productId, 1)}
                                                                        className="w-6 h-6 flex items-center justify-center bg-gray-50 hover:bg-gray-100 text-gray-600 font-medium text-xs cursor-pointer select-none border-l border-gray-200 transition-colors"
                                                                        title="Augmenter la quantité commandée"
                                                                    >
                                                                        +
                                                                    </button>
                                                                </div>

                                                                <div className="flex flex-col leading-tight">
                                                                    <span className="font-semibold text-[#001d35] text-xs">
                                                                        {item.recommendedContainers} {item.containerLabel}{item.recommendedContainers > 1 && !item.containerLabel.endsWith('s') ? 's' : ''}
                                                                    </span>
                                                                    {(isBox || isBulk) && item.subUnitLabel && (
                                                                        <span className="text-[10px] font-semibold text-[#f77500]">
                                                                            = {item.totalSubUnits.toLocaleString('fr-FR')} {item.subUnitLabel}{item.totalSubUnits > 1 && !item.subUnitLabel.endsWith('s') ? 's' : ''}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* NOUVELLE COLONNE : Somme Totale du Stock Après Réapprovisionnement */}
                                                    <td className="py-2.5 px-2.5 text-center w-36 bg-emerald-50/20">
                                                        {(() => {
                                                            const finalContainers = item.currentStock + item.recommendedContainers;
                                                            return (
                                                                <div className="flex flex-col items-center">
                                                                    <span className="font-semibold text-xs text-emerald-800">
                                                                        {finalContainers} {item.containerLabel}{finalContainers > 1 && !item.containerLabel.endsWith('s') ? 's' : ''}
                                                                    </span>
                                                                    {(isBox || isBulk) && item.subUnitLabel && (
                                                                        <span className="text-[9.5px] font-semibold text-[#f77500]">
                                                                            = {(finalContainers * (item.factor || 1)).toLocaleString('fr-FR')} {item.subUnitLabel}{finalContainers * (item.factor || 1) > 1 && !item.subUnitLabel.endsWith('s') ? 's' : ''}
                                                                        </span>
                                                                    )}
                                                                    <span className="text-[9px] text-gray-500 font-medium mt-0.5">
                                                                        (+{item.recommendedContainers} {item.containerLabel})
                                                                    </span>
                                                                </div>
                                                            );
                                                        })()}
                                                    </td>

                                                    {/* Fournisseur (Taille optimisée) */}
                                                    <td className="py-2.5 px-2.5 w-32">
                                                        <select
                                                            value={item.supplier || ''}
                                                            onChange={(e) => handleUpdateSupplier(item.productId, e.target.value)}
                                                            className="w-full text-xs font-normal py-1 px-1.5 border border-gray-300 rounded-[4px] bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#001d35]"
                                                        >
                                                            <option value="">Sélectionner</option>
                                                            {suppliers.map(s => (
                                                                <option key={s.id || s.name || s} value={s.name || s}>{s.name || s}</option>
                                                            ))}
                                                            {item.supplier && !suppliers.some(s => (s.name || s) === item.supplier) && (
                                                                <option value={item.supplier}>{item.supplier}</option>
                                                            )}
                                                        </select>
                                                    </td>

                                                    {/* Prix Achat & Total (Occupe tout l'espace total de la cellule avec FinancialInput) */}
                                                    <td className="p-1.5 w-72 min-w-[270px] align-stretch">
                                                        <div className="w-full h-full min-h-[96px] flex flex-col justify-between bg-slate-50/80 hover:bg-slate-100/70 p-2 rounded-[4px] border border-gray-200 shadow-2xs transition-colors">
                                                            {/* Ligne 1 : Montant Total Estimé (Pleine largeur, aligné aux extrémités) */}
                                                            <div className="flex items-center justify-between w-full pb-1 border-b border-gray-200">
                                                                <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                                                                    Total Estimé
                                                                </span>
                                                                <span className="font-bold text-sm text-[#001d35] tracking-tight">
                                                                    {formatPrice(item.estimatedTotalCost)}
                                                                </span>
                                                            </div>

                                                            {/* Ligne 2 : Saisie optimisée FinancialInput occupant 100% de la largeur */}
                                                            <div className="w-full my-1">
                                                                <div className="w-full flex items-center rounded-[4px] border border-gray-300 bg-white focus-within:border-[#001d35] focus-within:ring-1 focus-within:ring-[#001d35] shadow-2xs transition-all overflow-hidden">
                                                                    <span className="px-2 py-1 text-[11px] font-semibold text-gray-500 bg-gray-50 border-r border-gray-200 select-none shrink-0 uppercase tracking-tight">
                                                                        P.U
                                                                    </span>
                                                                    <FinancialInput
                                                                        value={item.purchasePricePerContainer}
                                                                        onValueChange={(val) => handleUpdatePrice(item.productId, val)}
                                                                        className={`w-full py-1 px-2.5 text-right text-xs font-bold focus:outline-none bg-transparent ${
                                                                            item.isPriceModified
                                                                                ? 'text-amber-900 bg-amber-50/50'
                                                                                : 'text-gray-900'
                                                                        }`}
                                                                        placeholder="0"
                                                                    />
                                                                    <span className="px-2 py-1 text-[10.5px] font-medium text-gray-500 bg-gray-50 border-l border-gray-200 select-none shrink-0 whitespace-nowrap">
                                                                        FCFA / {item.containerLabel}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            {/* Ligne 3 : Décomposition coût sous-unité pour les cartons / vrac */}
                                                            {(isBox || isBulk) && item.subUnitLabel && item.factor > 1 && (
                                                                <div className="flex items-center justify-between w-full text-[10px] text-[#f77500] font-semibold pt-1 border-t border-gray-200/70">
                                                                    <span className="text-gray-500 font-normal">Coût revient :</span>
                                                                    <span>{formatPrice(item.purchasePricePerContainer / item.factor)} / {item.subUnitLabel}</span>
                                                                </div>
                                                            )}

                                                            {/* Ligne 4 : Barre d'action Prix Modifié / Catalogue (pleine largeur) */}
                                                            {item.isPriceModified && (
                                                                <div className="flex items-center justify-between w-full pt-1.5 mt-0.5 border-t border-amber-200">
                                                                    <span
                                                                        className="inline-flex items-center text-[9.5px] font-semibold text-amber-800 bg-amber-100/80 border border-amber-300 px-1.5 py-0.5 rounded-[3px] truncate max-w-[130px]"
                                                                        title={`Tarif catalogue standard : ${formatPrice(item.originalPurchasePrice)}`}
                                                                    >
                                                                        Cat: {formatPrice(item.originalPurchasePrice)}
                                                                    </span>
                                                                    <div className="flex items-center gap-1 shrink-0">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleApplyPriceToCatalog(item.productId, item.purchasePricePerContainer)}
                                                                            disabled={syncingCatalogId === item.productId}
                                                                            className="px-1.5 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-[3px] text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                                                                            title="Enregistrer ce prix négocié dans le Catalogue"
                                                                        >
                                                                            {syncingCatalogId === item.productId ? (
                                                                                <RefreshCw className="w-3 h-3 animate-spin" />
                                                                            ) : (
                                                                                <BookmarkCheck className="w-3 h-3" />
                                                                            )}
                                                                            <span>Catalogue</span>
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleResetPrice(item.productId, item.originalPurchasePrice)}
                                                                            className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-[3px] transition-colors cursor-pointer"
                                                                            title="Rétablir le tarif d'achat initial du catalogue"
                                                                        >
                                                                            <RotateCcw className="w-3 h-3" />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* Urgence (Taille optimisée) */}
                                                    <td className="py-2.5 px-2 text-center w-20">
                                                        {item.urgency === 'CRITICAL' ? (
                                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[3px] text-[10px] font-semibold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
                                                                Rupture
                                                            </span>
                                                        ) : item.urgency === 'HIGH' ? (
                                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[3px] text-[10px] font-semibold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200">
                                                                Critique
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[3px] text-[10px] font-semibold uppercase tracking-wider bg-blue-50 text-blue-800 border border-blue-200">
                                                                Planifié
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* Actions (Taille optimisée) */}
                                                    <td className="py-2.5 px-2 text-center w-12">
                                                        <button
                                                            type="button"
                                                            onClick={() => removeFromReplenishmentQueue(item.productId)}
                                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-[4px] transition-colors cursor-pointer"
                                                            title="Retirer du plan de réapprovisionnement"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* ── BARRE INFÉRIEURE D'EXÉCUTION DU RÉAPPROVISIONNEMENT ── */}
                        {filteredSmartItems.length > 0 && (
                            <div className="p-3 bg-white border-t-2 border-gray-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="text-xs text-gray-600 font-normal">
                                            <strong className="text-gray-900 font-semibold">{filteredSmartItems.length}</strong> article(s) à commander (totalité du tableau)
                                        </div>
                                        <div className="h-4 w-px bg-gray-200" />
                                        <div className="text-xs text-gray-600 font-normal">
                                            Total estimé : <strong className="text-[#001d35] text-sm font-semibold">{formatPrice(filteredSmartItems.reduce((acc, i) => acc + (i.estimatedTotalCost || 0), 0))}</strong>
                                        </div>
                                    </div>

                                    {smartKPIs.modifiedPriceCount > 0 && (
                                        <div className="flex items-center gap-2 px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-[4px] text-xs">
                                            <span className="font-semibold">{smartKPIs.modifiedPriceCount}</span>
                                            <span>prix fournisseur négocié(s)</span>
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-wrap items-center gap-3">
                                    {/* Case à cocher pour actualiser le catalogue */}
                                    <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-gray-700 font-medium hover:text-gray-900">
                                        <input
                                            type="checkbox"
                                            checked={syncAllCatalogOnOrder}
                                            onChange={(e) => setSyncAllCatalogOnOrder(e.target.checked)}
                                            className="w-4 h-4 rounded-xs text-[#001d35] focus:ring-0 cursor-pointer"
                                        />
                                        <span>Mettre à jour le catalogue avec ces nouveaux prix</span>
                                    </label>

                                    <button
                                        type="button"
                                        onClick={handleClearQueueWithLoader}
                                        className="px-3 py-1.5 text-xs font-semibold text-gray-600 hover:text-red-700 hover:bg-red-50 border border-gray-300 rounded-[4px] transition-all cursor-pointer"
                                    >
                                        Vider le Panier
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleOpenOrderConfirm}
                                        className="px-4 py-2 bg-[#001d35] hover:bg-[#00284a] text-white text-xs font-semibold uppercase tracking-wider rounded-[4px] shadow-sm flex items-center gap-2 transition-all cursor-pointer active:scale-95"
                                        title="Générer le bon de commande pour l'ensemble des produits du tableau"
                                    >
                                        <Truck className="w-3.5 h-3.5 text-[#f77500]" />
                                        <span>Générer le Bon de Commande Fournisseur ({filteredSmartItems.length})</span>
                                        <ArrowRight className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                        </>
                    )}

                    {/* ========================================================================= */}
                    {/* ONGLET 2 : SUIVI & REGISTRE DES RÉAPPROVISIONNEMENTS                     */}
                    {/* ========================================================================= */}
                    {activeMainTab === 'orders' && (
                        <div className="bg-white rounded-[4px] border-2 border-gray-300 shadow-sm overflow-hidden">
                        {/* En-tête de section */}
                        <div className="p-3 bg-slate-50 border-b-2 border-gray-300 flex flex-col md:flex-row md:items-center justify-between gap-3">
                            <div>
                                <div className="flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-[#001d35]" />
                                    <h3 className="text-xs font-semibold text-[#001d35] uppercase tracking-wider">
                                        Suivi & Registre des Réapprovisionnements
                                    </h3>
                                    <span className="px-2 py-0.5 rounded-[3px] text-[10px] font-semibold bg-gray-200 text-gray-700">
                                        {filteredReplenishmentOrders.length} enregistrement(s)
                                    </span>
                                </div>
                                <p className="text-[11px] text-gray-500 font-normal mt-0.5">
                                    Consultez vos réapprovisionnements actifs, brouillons et passés par date. Cliquez sur "Voir" pour ouvrir la fiche détaillée complète.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setShowNewOrderModal(true)}
                                className="px-3 py-1.5 bg-[#001d35] hover:bg-[#00284a] text-white text-xs font-semibold rounded-[4px] shadow-sm flex items-center gap-1.5 transition-all self-start md:self-auto cursor-pointer"
                            >
                                <Plus className="w-3.5 h-3.5 text-[#f77500]" />
                                <span>Nouveau Bon Manuel</span>
                            </button>
                        </div>

                        {/* Barre de Filtres combinés : Statuts (Actifs, Brouillons, Passés, Tous) + Dates */}
                        <div className="p-3 bg-white border-b border-gray-200 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                            {/* Onglets Statuts : Actifs | Brouillons | Passés | Tous */}
                            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-[4px] border-2 border-gray-300 overflow-x-auto shrink-0">
                                <button
                                    type="button"
                                    onClick={() => handleFilterChange(setOrderStatusTab, 'active')}
                                    className={`px-3 py-1 rounded-[4px] text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                                        orderStatusTab === 'active'
                                            ? 'bg-[#001d35] text-white shadow-xs'
                                            : 'text-gray-700 hover:text-gray-900 hover:bg-gray-200'
                                    }`}
                                >
                                    <Clock className="w-3 h-3 text-amber-500" />
                                    <span>Actifs (En cours)</span>
                                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                                        orderStatusTab === 'active' ? 'bg-amber-500 text-slate-900' : 'bg-gray-200 text-gray-700'
                                    }`}>
                                        {orderCounts.active}
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => handleFilterChange(setOrderStatusTab, 'drafts')}
                                    className={`px-3 py-1 rounded-[4px] text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                                        orderStatusTab === 'drafts'
                                            ? 'bg-[#001d35] text-white shadow-xs'
                                            : 'text-gray-700 hover:text-gray-900 hover:bg-gray-200'
                                    }`}
                                >
                                    <ShoppingCart className="w-3 h-3 text-blue-400" />
                                    <span>Brouillons</span>
                                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                                        orderStatusTab === 'drafts' ? 'bg-blue-400 text-slate-900' : 'bg-gray-200 text-gray-700'
                                    }`}>
                                        {orderCounts.drafts}
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => handleFilterChange(setOrderStatusTab, 'completed')}
                                    className={`px-3 py-1 rounded-[4px] text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                                        orderStatusTab === 'completed'
                                            ? 'bg-[#001d35] text-white shadow-xs'
                                            : 'text-gray-700 hover:text-gray-900 hover:bg-gray-200'
                                    }`}
                                >
                                    <CheckCircle className="w-3 h-3 text-emerald-400" />
                                    <span>Passés (Reçus)</span>
                                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                                        orderStatusTab === 'completed' ? 'bg-emerald-400 text-slate-900' : 'bg-gray-200 text-gray-700'
                                    }`}>
                                        {orderCounts.completed}
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => handleFilterChange(setOrderStatusTab, 'all')}
                                    className={`px-3 py-1 rounded-[4px] text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                                        orderStatusTab === 'all'
                                            ? 'bg-[#001d35] text-white shadow-xs'
                                            : 'text-gray-700 hover:text-gray-900 hover:bg-gray-200'
                                    }`}
                                >
                                    <Layers className="w-3 h-3 text-gray-400" />
                                    <span>Tous</span>
                                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                                        orderStatusTab === 'all' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
                                    }`}>
                                        {orderCounts.all}
                                    </span>
                                </button>
                            </div>

                            {/* Filtres par Date */}
                            <div className="flex flex-wrap items-center gap-2">
                                <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-[4px] border border-gray-300">
                                    <Calendar className="w-3.5 h-3.5 text-gray-500 ml-1" />
                                    {[
                                        { id: 'all', label: 'Toutes dates' },
                                        { id: 'today', label: "Aujourd'hui" },
                                        { id: '7days', label: '7 jours' },
                                        { id: 'thisMonth', label: 'Ce mois' },
                                        { id: 'custom', label: 'Période...' }
                                    ].map(df => (
                                        <button
                                            key={df.id}
                                            type="button"
                                            onClick={() => handleFilterChange(setOrderDateFilter, df.id)}
                                            className={`px-2 py-0.5 rounded-[3px] text-[11px] font-semibold transition-all cursor-pointer ${
                                                orderDateFilter === df.id
                                                    ? 'bg-[#001d35] text-white'
                                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                                            }`}
                                        >
                                            {df.label}
                                        </button>
                                    ))}
                                </div>

                                {/* Sélecteurs Date Début / Fin si filtre Custom */}
                                {orderDateFilter === 'custom' && (
                                    <div className="flex items-center gap-1 text-xs">
                                        <input
                                            type="date"
                                            value={orderStartDate}
                                            onChange={(e) => handleFilterChange(setOrderStartDate, e.target.value)}
                                            className="px-2 py-1 text-xs border border-gray-300 rounded-[4px] font-medium text-gray-700 bg-white"
                                            placeholder="Du"
                                        />
                                        <span className="text-gray-400 text-xs">à</span>
                                        <input
                                            type="date"
                                            value={orderEndDate}
                                            onChange={(e) => handleFilterChange(setOrderEndDate, e.target.value)}
                                            className="px-2 py-1 text-xs border border-gray-300 rounded-[4px] font-medium text-gray-700 bg-white"
                                            placeholder="Au"
                                        />
                                    </div>
                                )}

                                {/* Barre de recherche sur le registre */}
                                <div className="relative min-w-[190px]">
                                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        value={orderSearchQuery}
                                        onChange={(e) => setOrderSearchQuery(e.target.value)}
                                        placeholder="N° bon, fournisseur, produit..."
                                        className="w-full pl-8 pr-2 py-1 text-xs border border-gray-300 rounded-[4px] bg-white focus:outline-none focus:border-[#001d35] font-normal"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Section Brouillons Spécifique : Panier en attente si sélectionné */}
                        {orderStatusTab === 'drafts' && replenishmentQueue?.length > 0 && (
                            <div className="p-3 bg-amber-50/70 border-b border-amber-200 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <ShoppingCart className="w-4 h-4 text-amber-600 shrink-0" />
                                    <div>
                                        <p className="text-xs font-semibold text-amber-900">
                                            Panier Brouillon actif : {replenishmentQueue.length} article(s) en attente de commande
                                        </p>
                                        <p className="text-[11px] text-amber-700 font-normal">
                                            Ces articles sont modifiables dans le tableau de réapprovisionnement ci-dessus.
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }}
                                    className="px-2.5 py-1 text-[11px] font-semibold text-[#001d35] bg-white border border-[#001d35]/30 hover:bg-slate-50 rounded-[4px] transition-all cursor-pointer shrink-0"
                                >
                                    Modifier le Panier ↑
                                </button>
                            </div>
                        )}

                        {/* Tableau des réapprovisionnements avec Loader d'au moins 1,5s */}
                        {filterLoading ? (
                            <div className="p-16 flex flex-col items-center justify-center bg-white animate-in fade-in duration-150">
                                <div className="relative h-10 w-10">
                                    <div className="absolute inset-0 animate-spin rounded-full border-4 border-gray-200 border-t-[#001d35]"></div>
                                    <div className="absolute inset-1.5 animate-spin-reverse rounded-full border-2 border-transparent border-b-[#f77500]"></div>
                                </div>
                                <p className="text-xs font-semibold text-[#001d35] mt-3 uppercase tracking-wider">
                                    Filtrage des réapprovisionnements...
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-[#001d35] text-white font-semibold uppercase tracking-wider text-[10px] divide-x divide-white/20">
                                            <th className="px-3 py-2.5 w-32">N° Réappro</th>
                                            <th className="px-3 py-2.5 w-44">Date & Heure</th>
                                            <th className="px-3 py-2.5">Fournisseur</th>
                                            <th className="px-3 py-2.5">Articles & Contenants</th>
                                            <th className="px-3 py-2.5 text-right w-28">Montant Total</th>
                                            <th className="px-3 py-2.5 text-center w-36">Statut Livraison</th>
                                            <th className="px-3 py-2.5 text-center w-52">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {filteredReplenishmentOrders.length === 0 ? (
                                            <tr>
                                                <td colSpan="7" className="p-8 text-center text-gray-500 bg-white">
                                                    <FileText className="w-8 h-8 mx-auto text-gray-400 mb-2 opacity-60" />
                                                    <p className="text-xs font-semibold text-gray-700 uppercase">
                                                        Aucun réapprovisionnement trouvé pour ces filtres
                                                    </p>
                                                    <p className="text-[11px] text-gray-500 font-normal mt-0.5">
                                                        Modifiez les filtres d'état ou de dates ci-dessus pour afficher vos commandes fournisseurs.
                                                    </p>
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredReplenishmentOrders.map(order => {
                                                const totalOrderedQty = (order.items || []).reduce((acc, i) => acc + (i.quantityOrdered || 0), 0);
                                                const totalReceivedQty = (order.items || []).reduce((acc, i) => acc + (i.quantityReceived || 0), 0);
                                                const percent = totalOrderedQty > 0 ? Math.round((totalReceivedQty / totalOrderedQty) * 100) : 0;

                                                return (
                                                    <tr key={order.id} className="hover:bg-blue-50/40 transition-colors">
                                                        <td className="px-3 py-2.5 font-semibold text-[#001d35]">
                                                            {formatOrderNumber(order.orderNumber, order.id, order.date)}
                                                        </td>
                                                        <td className="px-3 py-2.5 text-gray-700 font-normal whitespace-nowrap">
                                                            <div className="font-semibold text-gray-900 flex items-center gap-1.5">
                                                                <span>{new Date(order.date).toLocaleDateString('fr-FR')}</span>
                                                                <span className="text-[#001d35] font-semibold text-[11px] bg-slate-100 px-1.5 py-0.5 rounded-[3px] border border-gray-200 flex items-center gap-1">
                                                                    <Clock className="w-3 h-3 text-[#f77500]" />
                                                                    {new Date(order.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2.5 font-semibold text-gray-900">
                                                            {order.supplier}
                                                        </td>
                                                        <td className="px-3 py-2.5 text-gray-700 font-normal">
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <span className="font-semibold text-[#001d35]">{order.items?.length || 0} réf.</span>
                                                                <span className="text-gray-400">({totalOrderedQty} colis/unités)</span>
                                                                <span className="text-gray-500 truncate max-w-[220px]" title={order.items?.map(i => i.name).join(', ')}>
                                                                    — {order.items?.[0]?.name}{order.items?.length > 1 ? ` +${order.items.length - 1} autre(s)` : ''}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2.5 text-right font-semibold text-[#001d35]">
                                                            {formatPrice(order.totalAmount)}
                                                        </td>
                                                        <td className="px-3 py-2.5 text-center">
                                                            <div className="flex flex-col items-center gap-1">
                                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] text-[10px] font-semibold uppercase tracking-wider border ${getStatusColor(order.status)}`}>
                                                                    {order.status === 'Completed' ? 'Entièrement Reçu' :
                                                                     order.status === 'Partial' ? `Partiel (${percent}%)` :
                                                                     order.status === 'Ordered' ? 'Commandé' : 'Brouillon'}
                                                                </span>
                                                                {order.status === 'Partial' && (
                                                                    <div className="w-20 bg-gray-200 h-1.5 rounded-full overflow-hidden">
                                                                        <div className="bg-amber-500 h-full rounded-full" style={{ width: `${percent}%` }}></div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2.5 text-center">
                                                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                                                {/* BOUTON VOIR (Déclenche la Fiche Détaillée Plein Écran) */}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setFullScreenOrder(order)}
                                                                    className="px-2.5 py-1 bg-[#001d35] hover:bg-[#00284a] text-white text-[11px] font-semibold rounded-[4px] shadow-xs flex items-center gap-1 transition-all cursor-pointer"
                                                                    title="Afficher la fiche détaillée complète"
                                                                >
                                                                    <Eye className="w-3 h-3 text-[#f77500]" />
                                                                    <span>Voir</span>
                                                                </button>

                                                                {order.status !== 'Completed' && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => openReceiveModal(order)}
                                                                        className="px-2 py-1 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 text-[11px] font-semibold rounded-[4px] shadow-xs flex items-center gap-1 transition-all cursor-pointer"
                                                                        title="Réceptionner les marchandises de ce bon"
                                                                    >
                                                                        <CheckCircle className="w-3 h-3 text-emerald-600" />
                                                                        <span>Réception</span>
                                                                    </button>
                                                                )}

                                                                {/* BOUTON SUPPRIMER LE RÉAPPROVISIONNEMENT */}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleDeleteOrder(order)}
                                                                    className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 border border-rose-300 text-[11px] font-semibold rounded-[4px] shadow-xs flex items-center gap-1 transition-all cursor-pointer"
                                                                    title="Supprimer ce bon de réapprovisionnement"
                                                                >
                                                                    <Trash2 className="w-3 h-3 text-rose-600" />
                                                                    <span>Supprimer</span>
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>

            {/* ═════════════════════════════════════════════════════════════════════ */}
            {/* MODALE 1 : NOUVELLE COMMANDE MANUELLE                                 */}
            {/* ═════════════════════════════════════════════════════════════════════ */}
            {showNewOrderModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[110] p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[4px] shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border-2 border-[#001d35]">
                        <div className="p-3.5 border-b border-gray-200 flex justify-between items-center bg-[#001d35] text-white">
                            <h3 className="text-sm font-semibold uppercase tracking-wide">Créer une Commande Fournisseur Manuelle</h3>
                            <button onClick={() => setShowNewOrderModal(false)} className="text-gray-300 hover:text-white cursor-pointer text-lg font-bold">
                                &times;
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">Fournisseur</label>
                                <select
                                    value={newOrderData.supplier}
                                    onChange={(e) => setNewOrderData({ ...newOrderData, supplier: e.target.value })}
                                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-[4px] focus:outline-none focus:ring-1 focus:ring-[#001d35] bg-white font-normal"
                                >
                                    <option value="">Sélectionner un fournisseur</option>
                                    {suppliers.map(s => (<option key={s.id || s.name || s} value={s.name || s}>{s.name || s}</option>))}
                                </select>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-80">
                                {/* Sélection produit */}
                                <div className="border border-gray-200 rounded-[4px] flex flex-col">
                                    <div className="p-2 border-b border-gray-200 bg-gray-50">
                                        <div className="relative mb-2">
                                            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                            <input
                                                type="text"
                                                placeholder="Rechercher produit..."
                                                value={manualProductSearch}
                                                onChange={(e) => setManualProductSearch(e.target.value)}
                                                className="w-full pl-8 pr-2.5 py-1 text-xs border border-gray-300 rounded-[4px] font-normal"
                                            />
                                        </div>
                                        <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer font-normal">
                                            <input
                                                type="checkbox"
                                                checked={onlyLowStockManual}
                                                onChange={(e) => setOnlyLowStockManual(e.target.checked)}
                                                className="rounded-xs text-[#001d35] focus:ring-0"
                                            />
                                            Uniquement stock faible
                                        </label>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                        {availableManualProducts.map(p => (
                                            <div
                                                key={p.id}
                                                onClick={() => handleAddManualToOrder(p)}
                                                className="p-2 hover:bg-blue-50/50 rounded-[4px] cursor-pointer flex justify-between items-center border border-transparent hover:border-gray-200 transition-all"
                                            >
                                                <div>
                                                    <p className="font-semibold text-xs text-gray-900">{p.name}</p>
                                                    <p className="text-[10px] text-gray-500 font-normal">Stock: {p.stock} | Min: {p.minStock}</p>
                                                </div>
                                                {p.stock <= p.minStock && <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Panier commande */}
                                <div className="border border-gray-200 rounded-[4px] flex flex-col">
                                    <div className="p-2 border-b border-gray-200 bg-gray-50 font-semibold text-xs text-gray-700">
                                        Produits à commander ({newOrderData.items.length})
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                                        {newOrderData.items.length === 0 ? (
                                            <div className="h-full flex items-center justify-center text-gray-400 text-xs font-normal">
                                                Sélectionnez des produits à gauche
                                            </div>
                                        ) : (
                                            newOrderData.items.map(item => (
                                                <div key={item.id} className="p-2.5 bg-gray-50 rounded-[4px] border border-gray-200">
                                                    <div className="flex justify-between items-start mb-1.5">
                                                        <span className="font-semibold text-xs text-[#001d35]">{item.name}</span>
                                                        <button
                                                            onClick={() => handleRemoveManualFromOrder(item.id)}
                                                            className="text-red-400 hover:text-red-600 cursor-pointer font-bold"
                                                        >
                                                            &times;
                                                        </button>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div>
                                                            <label className="text-[10px] text-gray-500 block mb-0.5 font-semibold uppercase">Quantité</label>
                                                            <input
                                                                type="number"
                                                                value={item.quantity}
                                                                onChange={(e) => {
                                                                    const items = newOrderData.items.map(i =>
                                                                        i.id === item.id ? { ...i, quantity: parseInt(e.target.value) || 0 } : i
                                                                    );
                                                                    setNewOrderData({ ...newOrderData, items });
                                                                }}
                                                                className="w-full px-2 py-1 text-xs border border-gray-300 rounded-[4px] font-normal"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] text-gray-500 block mb-0.5 font-semibold uppercase">Prix Achat (FCFA)</label>
                                                            <FinancialInput
                                                                value={item.purchasePrice}
                                                                onChange={(e) => {
                                                                    const items = newOrderData.items.map(i =>
                                                                        i.id === item.id ? { ...i, purchasePrice: parseFloat(e.target.value) || 0 } : i
                                                                    );
                                                                    setNewOrderData({ ...newOrderData, items });
                                                                }}
                                                                className="w-full px-2 py-1 text-xs border border-gray-300 rounded-[4px] font-normal"
                                                                placeholder="0"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-3 border-t border-gray-200 flex justify-end gap-2 bg-gray-50">
                            <button
                                onClick={() => setShowNewOrderModal(false)}
                                className="px-3 py-1.5 text-xs text-gray-700 font-semibold hover:bg-gray-200 rounded-[4px] transition-colors cursor-pointer"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleCreateManualOrder}
                                disabled={!newOrderData.supplier || newOrderData.items.length === 0}
                                className="px-4 py-1.5 bg-[#001d35] text-white hover:bg-[#00284a] font-semibold text-xs uppercase tracking-wider rounded-[4px] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm cursor-pointer"
                            >
                                Créer la Commande
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═════════════════════════════════════════════════════════════════════ */}
            {/* MODALE 2 : RÉCEPTION DE COMMANDE                                      */}
            {/* ═════════════════════════════════════════════════════════════════════ */}
            {showReceiveModal && selectedOrder && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[120] p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[4px] shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col border-2 border-[#001d35]">
                        <div className="p-3.5 border-b border-gray-200 bg-[#001d35] text-white flex justify-between items-center">
                            <div>
                                <h3 className="text-sm font-semibold uppercase tracking-wide">Réception Bon de Commande {formatOrderNumber(selectedOrder.orderNumber, selectedOrder.id, selectedOrder.date)}</h3>
                                <p className="text-[11px] text-gray-300 mt-0.5 font-normal">{selectedOrder.supplier} — {new Date(selectedOrder.date).toLocaleDateString('fr-FR')}</p>
                            </div>
                            <button onClick={() => setShowReceiveModal(false)} className="text-gray-300 hover:text-white cursor-pointer text-lg font-bold">
                                &times;
                            </button>
                        </div>

                        <div className="p-4 bg-gray-50 border-b border-gray-200 space-y-3">
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                                    Réceptionné par <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={receivedBy}
                                    onChange={(e) => setReceivedBy(e.target.value)}
                                    placeholder="Nom du magasinier / réceptionneur"
                                    className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-[4px] focus:outline-none focus:ring-1 focus:ring-[#001d35] bg-white font-normal"
                                />
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer bg-white p-2.5 border border-gray-300 rounded-[4px]">
                                <input
                                    type="checkbox"
                                    checked={isPaidCash}
                                    onChange={(e) => setIsPaidCash(e.target.checked)}
                                    className="w-4 h-4 text-[#001d35] rounded-xs focus:ring-0"
                                />
                                <div>
                                    <span className="text-xs font-semibold text-gray-900 block">Règlement au comptant (Cash / Virement)</span>
                                    <span className="text-[10px] text-gray-500 block font-normal">Cochez si la marchandise a été réglée immédiatement. La dette du fournisseur n'augmentera pas.</span>
                                </div>
                            </label>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-[#001d35] text-white font-semibold uppercase tracking-wider text-[10px] divide-x divide-white/20">
                                        <th className="px-3 py-2">Produit</th>
                                        <th className="px-3 py-2 text-center">Commandé</th>
                                        <th className="px-3 py-2 text-center">Déjà Reçu</th>
                                        <th className="px-3 py-2 text-center">Reçu Maintenant</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {selectedOrder.items.map(item => (
                                        <tr key={item.productId} className="hover:bg-gray-50 border-b border-gray-100">
                                            <td className="px-3 py-2.5 font-semibold text-[#001d35]">{item.name}</td>
                                            <td className="px-3 py-2.5 text-center font-normal">{item.quantityOrdered}</td>
                                            <td className="px-3 py-2.5 text-center text-gray-500 font-normal">{item.quantityReceived}</td>
                                            <td className="px-3 py-2.5 text-center">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max={item.quantityOrdered - item.quantityReceived}
                                                    placeholder="0"
                                                    className="w-24 px-2 py-1 text-center font-semibold text-xs border border-gray-300 rounded-[4px] focus:outline-none focus:ring-1 focus:ring-[#001d35]"
                                                    onChange={(e) => setReceiveData({
                                                        ...receiveData,
                                                        [item.productId]: e.target.value
                                                    })}
                                                    disabled={item.quantityReceived >= item.quantityOrdered}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="p-3 border-t border-gray-200 flex justify-end gap-2 bg-gray-50">
                            <button
                                onClick={() => setShowReceiveModal(false)}
                                className="px-3 py-1.5 text-xs text-gray-700 font-semibold hover:bg-gray-200 rounded-[4px] transition-colors cursor-pointer"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleReceiveOrder}
                                className="px-4 py-1.5 bg-[#001d35] text-white font-semibold text-xs uppercase tracking-wider rounded-[4px] hover:bg-[#00284a] transition-all shadow-sm cursor-pointer"
                            >
                                Valider la Réception
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═════════════════════════════════════════════════════════════════════ */}
            {/* MODALE 3 : DÉTAILS DE LA COMMANDE                                     */}
            {/* ═════════════════════════════════════════════════════════════════════ */}
            {showDetailsModal && selectedOrder && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[110] p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[4px] shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col border-2 border-[#001d35]">
                        <div className="p-3.5 border-b border-gray-200 bg-[#001d35] text-white flex justify-between items-center">
                            <div>
                                <h3 className="text-sm font-semibold uppercase tracking-wide">Détails Bon de Commande {formatOrderNumber(selectedOrder.orderNumber, selectedOrder.id, selectedOrder.date)}</h3>
                                <p className="text-[11px] text-gray-300 mt-0.5 font-normal">
                                    {selectedOrder.supplier} — {new Date(selectedOrder.date).toLocaleDateString('fr-FR')} à {new Date(selectedOrder.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                            <button onClick={() => setShowDetailsModal(false)} className="text-gray-300 hover:text-white cursor-pointer text-lg font-bold">
                                &times;
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {/* Statut Bannière */}
                            <div className={`p-3 rounded-[4px] border ${
                                selectedOrder.status === 'Completed' ? 'bg-emerald-50 border-emerald-300 text-emerald-900' :
                                selectedOrder.status === 'Partial' ? 'bg-amber-50 border-amber-300 text-amber-900' :
                                'bg-blue-50 border-blue-300 text-blue-900'
                            }`}>
                                <div className="flex items-center justify-between">
                                    <span className="font-semibold text-xs uppercase tracking-wide">
                                        Statut : {selectedOrder.status === 'Ordered' ? 'Commandé auprès du fournisseur' :
                                                 selectedOrder.status === 'Partial' ? 'Livraison Partielle' : 'Entièrement Livré'}
                                    </span>
                                    <span className="text-xs font-semibold">
                                        Total : {formatPrice(selectedOrder.totalAmount)}
                                    </span>
                                </div>
                            </div>

                            {/* Tableau des articles */}
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-[#001d35] text-white font-semibold uppercase tracking-wider text-[10px] divide-x divide-white/20">
                                        <th className="px-3 py-2">Produit</th>
                                        <th className="px-3 py-2 text-right">Prix Achat</th>
                                        <th className="px-3 py-2 text-center">Commandé</th>
                                        <th className="px-3 py-2 text-center">Reçu</th>
                                        <th className="px-3 py-2 text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {selectedOrder.items.map(item => (
                                        <tr key={item.productId} className="hover:bg-gray-50 border-b border-gray-100">
                                            <td className="px-3 py-2.5 font-semibold text-gray-900">{item.name}</td>
                                            <td className="px-3 py-2.5 text-right font-normal text-gray-600">{formatPrice(item.purchasePrice)}</td>
                                            <td className="px-3 py-2.5 text-center font-normal">{item.quantityOrdered}</td>
                                            <td className={`px-3 py-2.5 text-center font-semibold ${item.quantityReceived < item.quantityOrdered ? 'text-amber-700' : 'text-emerald-700'}`}>
                                                {item.quantityReceived}
                                            </td>
                                            <td className="px-3 py-2.5 text-right font-semibold text-[#001d35]">
                                                {formatPrice(item.purchasePrice * item.quantityOrdered)}
                                            </td>
                                        </tr>
                                    ))}
                                    <tr className="bg-gray-50 font-semibold border-t-2 border-gray-300">
                                        <td colSpan="4" className="px-3 py-2 text-right uppercase text-[10px] text-gray-600">Total Bon de Commande</td>
                                        <td className="px-3 py-2 text-right text-sm text-[#001d35] font-semibold">{formatPrice(selectedOrder.totalAmount)}</td>
                                    </tr>
                                </tbody>
                            </table>

                            {/* Zone Manager Clôture Forcée */}
                            {selectedOrder.status === 'Partial' && (
                                <div className="p-3 border border-red-200 bg-red-50 rounded-[4px] flex items-start gap-3">
                                    <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                                    <div className="flex-1">
                                        <h4 className="font-semibold text-red-900 text-xs uppercase tracking-wide">Clôture Exceptionnelle Manager</h4>
                                        <p className="text-xs text-red-700 mt-0.5 font-normal">
                                            Cette commande est partiellement livrée. Si le reliquat ne sera jamais livré par le fournisseur, vous pouvez clore définitivement la commande.
                                        </p>
                                        <button
                                            onClick={handleForceComplete}
                                            className="mt-2 px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-[4px] hover:bg-red-700 transition-colors shadow-xs cursor-pointer"
                                        >
                                            Forcer la Clôture Définitive
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-3 border-t border-gray-200 flex justify-between items-center bg-gray-50">
                            <button
                                type="button"
                                onClick={() => handleDeleteOrder(selectedOrder)}
                                className="px-3 py-1.5 text-xs text-rose-700 bg-rose-50 border border-rose-300 hover:bg-rose-100 rounded-[4px] transition-colors cursor-pointer flex items-center gap-1 font-semibold"
                            >
                                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                <span>Supprimer ce bon</span>
                            </button>

                            <button
                                onClick={() => setShowDetailsModal(false)}
                                className="px-4 py-1.5 text-xs text-gray-700 font-semibold hover:bg-gray-200 rounded-[4px] transition-colors cursor-pointer"
                            >
                                Fermer
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═════════════════════════════════════════════════════════════════════ */}
            {/* ÉCRAN PLEIN ÉCRAN : FICHE DÉTAILLÉE DU RÉAPPROVISIONNEMENT            */}
            {/* Couvre l'intégralité de l'écran avec fermeture facile                 */}
            {/* ═════════════════════════════════════════════════════════════════════ */}
            {fullScreenOrder && (
                <div className="fixed inset-0 z-50 bg-slate-100 flex flex-col overflow-hidden animate-in fade-in duration-150">
                    {/* BARRE SUPÉRIEURE FIXE (Charte Kabllix #001d35 & #f77500) */}
                    <div className="bg-[#001d35] text-white px-4 py-3 border-b-2 border-[#f77500] shadow-md flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-3">
                            {/* Bouton Retour / Fermeture */}
                            <button
                                type="button"
                                onClick={() => setFullScreenOrder(null)}
                                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-[4px] text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border border-white/20"
                            >
                                <ArrowLeft className="w-3.5 h-3.5 text-[#f77500]" />
                                <span>Retour au Réapprovisionnement</span>
                            </button>

                            <div className="h-5 w-px bg-white/20 hidden sm:block"></div>

                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[11px] uppercase tracking-wider text-gray-300 font-medium">Fiche Réapprovisionnement :</span>
                                    <h2 className="text-sm font-semibold text-white tracking-wide">
                                        {fullScreenOrder.orderNumber}
                                    </h2>
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] text-[10px] font-semibold uppercase tracking-wider border ${
                                        fullScreenOrder.status === 'Completed' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400' :
                                        fullScreenOrder.status === 'Partial' ? 'bg-amber-500/20 text-amber-300 border-amber-400' :
                                        'bg-blue-500/20 text-blue-300 border-blue-400'
                                    }`}>
                                        {fullScreenOrder.status === 'Completed' ? 'Entièrement Reçu' :
                                         fullScreenOrder.status === 'Partial' ? 'Livraison Partielle' : 'Commandé (En cours)'}
                                    </span>
                                </div>
                                <p className="text-[11px] text-gray-300 font-normal">
                                    Fournisseur : <strong className="text-white font-semibold">{fullScreenOrder.supplier}</strong> — Émis le {new Date(fullScreenOrder.date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} à {new Date(fullScreenOrder.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        </div>

                        {/* Actions En-tête */}
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => window.print()}
                                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-[4px] border border-white/20 flex items-center gap-1.5 transition-all cursor-pointer"
                                title="Imprimer le bon de commande"
                            >
                                <Printer className="w-3.5 h-3.5 text-[#f77500]" />
                                <span className="hidden md:inline">Imprimer le Bon</span>
                            </button>

                            {fullScreenOrder.status !== 'Completed' && (
                                <button
                                    type="button"
                                    onClick={() => openReceiveModal(fullScreenOrder)}
                                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-[4px] shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
                                >
                                    <CheckCircle className="w-3.5 h-3.5 text-white" />
                                    <span>Réceptionner Marchandises</span>
                                </button>
                            )}

                            {/* Bouton Supprimer ce bon */}
                            <button
                                type="button"
                                onClick={() => handleDeleteOrder(fullScreenOrder)}
                                className="px-3 py-1.5 bg-rose-600/90 hover:bg-rose-600 text-white text-xs font-semibold rounded-[4px] border border-rose-400 flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                                title="Supprimer ce réapprovisionnement"
                            >
                                <Trash2 className="w-3.5 h-3.5 text-white" />
                                <span className="hidden sm:inline">Supprimer ce bon</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setFullScreenOrder(null)}
                                className="p-1.5 text-gray-300 hover:text-white hover:bg-white/10 rounded-[4px] transition-colors cursor-pointer"
                                title="Fermer la fiche (Échap)"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* CORPS DE LA FICHE DÉTAILLÉE (Scrollable) */}
                    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 max-w-7xl w-full mx-auto">
                        {/* 4 StatCards Synthèse du Bon */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            {/* 1. Montant Total */}
                            <div className="bg-white p-3.5 rounded-[4px] border-2 border-gray-300 shadow-sm">
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Montant Total du Bon</p>
                                <h3 className="text-xl sm:text-2xl font-semibold text-[#001d35] mt-1">
                                    {formatPrice(fullScreenOrder.totalAmount)}
                                </h3>
                                <p className="text-[11px] text-gray-500 font-medium mt-1">Facturation prévisionnelle</p>
                            </div>

                            {/* 2. Références Distinctes */}
                            <div className="bg-white p-3.5 rounded-[4px] border-2 border-gray-300 shadow-sm">
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Articles Réapprovisionnés</p>
                                <h3 className="text-xl sm:text-2xl font-semibold text-blue-900 mt-1">
                                    {fullScreenOrder.items?.length || 0} référence(s)
                                </h3>
                                <p className="text-[11px] text-gray-500 font-medium mt-1">Lignes de commande uniques</p>
                            </div>

                            {/* 3. Contenants Commandés vs Reçus */}
                            <div className="bg-white p-3.5 rounded-[4px] border-2 border-gray-300 shadow-sm">
                                {(() => {
                                    const totalOrdered = (fullScreenOrder.items || []).reduce((acc, i) => acc + (i.quantityOrdered || 0), 0);
                                    const totalRec = (fullScreenOrder.items || []).reduce((acc, i) => acc + (i.quantityReceived || 0), 0);
                                    return (
                                        <>
                                            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Volumes Commandés vs Reçus</p>
                                            <div className="flex items-baseline gap-2 mt-1">
                                                <h3 className="text-xl sm:text-2xl font-semibold text-emerald-800">{totalRec}</h3>
                                                <span className="text-sm font-semibold text-gray-500">/ {totalOrdered} unités/colis</span>
                                            </div>
                                            <p className="text-[11px] text-gray-500 font-medium mt-1">
                                                Reste à livrer : <strong className="text-amber-800">{Math.max(0, totalOrdered - totalRec)}</strong>
                                            </p>
                                        </>
                                    );
                                })()}
                            </div>

                            {/* 4. Taux de Réalisation */}
                            <div className="bg-white p-3.5 rounded-[4px] border-2 border-gray-300 shadow-sm">
                                {(() => {
                                    const totalOrdered = (fullScreenOrder.items || []).reduce((acc, i) => acc + (i.quantityOrdered || 0), 0);
                                    const totalRec = (fullScreenOrder.items || []).reduce((acc, i) => acc + (i.quantityReceived || 0), 0);
                                    const percent = totalOrdered > 0 ? Math.round((totalRec / totalOrdered) * 100) : 0;
                                    return (
                                        <>
                                            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Taux de Livraison</p>
                                            <div className="flex items-center justify-between mt-1">
                                                <h3 className="text-xl sm:text-2xl font-semibold text-[#001d35]">{percent}%</h3>
                                                <span className="text-[11px] font-semibold text-gray-600">{totalRec} sur {totalOrdered}</span>
                                            </div>
                                            <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden mt-2">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-500 ${
                                                        percent === 100 ? 'bg-emerald-500' : percent > 0 ? 'bg-amber-500' : 'bg-blue-500'
                                                    }`}
                                                    style={{ width: `${percent}%` }}
                                                ></div>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        </div>

                        {/* TABLEAU DES PRODUITS RÉAPPROVISIONNÉS */}
                        <div className="bg-white rounded-[4px] border-2 border-gray-300 shadow-sm overflow-hidden">
                            <div className="p-3 bg-slate-50 border-b-2 border-gray-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <Package className="w-4 h-4 text-[#001d35]" />
                                    <h4 className="text-xs font-semibold text-[#001d35] uppercase tracking-wider">
                                        Fiche Détaillée des Produits Réapprovisionnés
                                    </h4>
                                </div>
                                <div className="text-xs text-gray-600 font-medium">
                                    Partenaire : <strong className="text-gray-900 font-semibold">{fullScreenOrder.supplier}</strong>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-[#001d35] text-white font-semibold uppercase tracking-wider text-[10px] divide-x divide-white/20">
                                            <th className="px-3 py-2.5 w-10 text-center">#</th>
                                            <th className="px-3 py-2.5">Désignation du Produit</th>
                                            <th className="px-3 py-2.5 w-32">Conditionnement</th>
                                            <th className="px-3 py-2.5 text-right w-28">Prix Achat Appliqué</th>
                                            <th className="px-3 py-2.5 text-center w-24">Commandé</th>
                                            <th className="px-3 py-2.5 text-center w-24">Reçu</th>
                                            <th className="px-3 py-2.5 text-center w-24">Reste à Livrer</th>
                                            <th className="px-3 py-2.5 text-right w-28">Total Ligne</th>
                                            <th className="px-3 py-2.5 text-center w-28">Statut Ligne</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {fullScreenOrder.items?.map((item, idx) => {
                                            const originalProd = (products || []).find(p => String(p.id) === String(item.productId));
                                            const archetype = originalProd ? getProductArchetype(originalProd) : null;
                                            const remaining = Math.max(0, (item.quantityOrdered || 0) - (item.quantityReceived || 0));
                                            const isFullyDelivered = (item.quantityReceived || 0) >= (item.quantityOrdered || 0);

                                            return (
                                                <tr key={item.productId || idx} className="hover:bg-blue-50/30 transition-colors">
                                                    <td className="px-3 py-2.5 text-center text-gray-500 font-normal">
                                                        {idx + 1}
                                                    </td>
                                                    <td className="px-3 py-2.5">
                                                        <div className="font-semibold text-gray-900">{item.name}</div>
                                                        {originalProd?.barcode && (
                                                            <div className="text-[10px] text-gray-500 font-mono">
                                                                Réf: {originalProd.barcode}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2.5 text-gray-700">
                                                        {archetype ? (
                                                            <span className="inline-flex items-center text-[11px] font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-[3px] border border-gray-300">
                                                                {archetype === 'BOX' ? 'Boîte / Colis' : archetype === 'BULK' ? 'Vrac' : 'Unitaire'}
                                                            </span>
                                                        ) : (
                                                            <span className="text-gray-500 text-[11px]">Standard</span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2.5 text-right font-normal text-gray-700">
                                                        {formatPrice(item.purchasePrice)}
                                                    </td>
                                                    <td className="px-3 py-2.5 text-center font-semibold text-gray-900">
                                                        {item.quantityOrdered}
                                                    </td>
                                                    <td className={`px-3 py-2.5 text-center font-semibold ${
                                                        isFullyDelivered ? 'text-emerald-700' : (item.quantityReceived > 0 ? 'text-amber-700' : 'text-gray-500')
                                                    }`}>
                                                        {item.quantityReceived || 0}
                                                    </td>
                                                    <td className="px-3 py-2.5 text-center font-semibold">
                                                        {remaining > 0 ? (
                                                            <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded-[3px] border border-amber-200">
                                                                {remaining}
                                                            </span>
                                                        ) : (
                                                            <span className="text-emerald-700 font-normal">0 (Soldé)</span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2.5 text-right font-semibold text-[#001d35]">
                                                        {formatPrice((item.purchasePrice || 0) * (item.quantityOrdered || 0))}
                                                    </td>
                                                    <td className="px-3 py-2.5 text-center">
                                                        {isFullyDelivered ? (
                                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[3px] text-[10px] font-semibold uppercase bg-emerald-50 text-emerald-800 border border-emerald-300">
                                                                <Check className="w-3 h-3 text-emerald-600" />
                                                                Livré
                                                            </span>
                                                        ) : (item.quantityReceived > 0) ? (
                                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[3px] text-[10px] font-semibold uppercase bg-amber-50 text-amber-800 border border-amber-300">
                                                                <Clock className="w-3 h-3 text-amber-600" />
                                                                Partiel
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[3px] text-[10px] font-semibold uppercase bg-blue-50 text-blue-800 border border-blue-300">
                                                                En attente
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-slate-50 font-semibold border-t-2 border-gray-300 text-gray-900">
                                            <td colSpan="4" className="px-3 py-3 text-right uppercase text-[11px] text-gray-600">
                                                Total Bon de Réapprovisionnement
                                            </td>
                                            <td className="px-3 py-3 text-center text-xs font-semibold text-gray-900">
                                                {(fullScreenOrder.items || []).reduce((acc, i) => acc + (i.quantityOrdered || 0), 0)}
                                            </td>
                                            <td className="px-3 py-3 text-center text-xs font-semibold text-emerald-800">
                                                {(fullScreenOrder.items || []).reduce((acc, i) => acc + (i.quantityReceived || 0), 0)}
                                            </td>
                                            <td className="px-3 py-3 text-center text-xs font-semibold text-amber-800">
                                                {Math.max(0, (fullScreenOrder.items || []).reduce((acc, i) => acc + (i.quantityOrdered || 0), 0) - (fullScreenOrder.items || []).reduce((acc, i) => acc + (i.quantityReceived || 0), 0))}
                                            </td>
                                            <td className="px-3 py-3 text-right text-sm font-semibold text-[#001d35]">
                                                {formatPrice(fullScreenOrder.totalAmount)}
                                            </td>
                                            <td></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>

                        {/* Zone Manager Clôture Forcée si commande partielle */}
                        {fullScreenOrder.status === 'Partial' && (
                            <div className="p-3.5 border-2 border-red-200 bg-red-50/70 rounded-[4px] flex items-start gap-3">
                                <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                                <div className="flex-1">
                                    <h4 className="font-semibold text-red-900 text-xs uppercase tracking-wide">
                                        Clôture Définitive Exceptionnelle (Manager)
                                    </h4>
                                    <p className="text-xs text-red-700 mt-0.5 font-normal">
                                        Cette commande est partiellement livrée. Si le reliquat restant ne sera jamais livré par le fournisseur, vous pouvez clore définitivement la commande pour régulariser le registre.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => handleForceComplete(fullScreenOrder)}
                                        className="mt-2 px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-[4px] hover:bg-red-700 transition-colors shadow-xs cursor-pointer"
                                    >
                                        Forcer la Clôture Définitive
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Bouton de Fermeture en bas de page */}
                        <div className="flex justify-end pt-2 pb-6">
                            <button
                                type="button"
                                onClick={() => setFullScreenOrder(null)}
                                className="px-4 py-2 bg-[#001d35] hover:bg-[#00284a] text-white text-xs font-semibold uppercase tracking-wider rounded-[4px] shadow-sm flex items-center gap-2 transition-all cursor-pointer"
                            >
                                <ArrowLeft className="w-3.5 h-3.5 text-[#f77500]" />
                                <span>Fermer et Revenir au Réapprovisionnement</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═════════════════════════════════════════════════════════════════════ */}
            {/* MODALE CUSTOM : CONFIRMATION DE SUPPRESSION DE RÉAPPROVISIONNEMENT    */}
            {/* ═════════════════════════════════════════════════════════════════════ */}
            {orderToDelete && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[110] p-4 animate-in fade-in duration-150">
                    <div className="bg-white rounded-[4px] shadow-2xl border-2 border-[#001d35] max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-150">
                        {/* Barre Supérieure Stylisée */}
                        <div className="bg-[#001d35] text-white px-4 py-3 flex items-center justify-between border-b-2 border-[#f77500]">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-rose-500/20 border border-rose-400 flex items-center justify-center shrink-0">
                                    <Trash2 className="w-4 h-4 text-rose-400" />
                                </div>
                                <div>
                                    <h3 className="text-xs font-semibold uppercase tracking-wider text-white">
                                        Confirmation de Suppression
                                    </h3>
                                    <p className="text-[10px] text-gray-300">Action irréversible</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setOrderToDelete(null)}
                                className="text-gray-300 hover:text-white p-1 rounded transition-colors cursor-pointer"
                                title="Fermer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Corps */}
                        <div className="p-4 space-y-3">
                            <p className="text-xs text-gray-700 font-normal leading-relaxed">
                                Êtes-vous certain de vouloir supprimer définitivement ce bon de réapprovisionnement ?
                            </p>

                            {/* Fiche synthétique du bon ciblé */}
                            <div className="bg-slate-50 border border-gray-200 rounded-[4px] p-3 space-y-1.5 text-xs">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-500 font-medium">N° Bon :</span>
                                    <span className="font-semibold text-[#001d35]">{orderToDelete.orderNumber}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-500 font-medium">Fournisseur :</span>
                                    <span className="font-semibold text-gray-900">{orderToDelete.supplier}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-500 font-medium">Date d'émission :</span>
                                    <span className="text-gray-700 font-medium">
                                        {new Date(orderToDelete.date).toLocaleDateString('fr-FR')} à {new Date(orderToDelete.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-500 font-medium">Contenu :</span>
                                    <span className="text-gray-700 font-medium">{orderToDelete.items?.length || 0} référence(s)</span>
                                </div>
                                <div className="flex justify-between items-center pt-1 border-t border-gray-200">
                                    <span className="text-gray-500 font-medium">Montant Total :</span>
                                    <span className="font-semibold text-[#001d35] text-sm">{formatPrice(orderToDelete.totalAmount)}</span>
                                </div>
                            </div>

                            {/* Message d'avertissement */}
                            <div className="flex items-start gap-2 p-2.5 bg-rose-50 border border-rose-200 rounded-[4px] text-[11px] text-rose-800">
                                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                                <span>
                                    Ce bon sera <strong>définitivement supprimé</strong> de votre registre des réapprovisionnements et du grand livre des commandes.
                                </span>
                            </div>
                        </div>

                        {/* Pied de Modale */}
                        <div className="p-3 bg-gray-50 border-t border-gray-200 flex justify-end items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setOrderToDelete(null)}
                                className="px-3.5 py-1.5 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 rounded-[4px] transition-colors cursor-pointer"
                            >
                                Annuler
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmDeleteOrder}
                                className="px-4 py-1.5 text-xs font-semibold text-white bg-rose-700 hover:bg-rose-800 rounded-[4px] shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Supprimer Définitivement</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═════════════════════════════════════════════════════════════════════ */}
            {/* MODALE CUSTOM : CONFIRMATION DE CLÔTURE FORCÉE (MANAGER)              */}
            {/* ═════════════════════════════════════════════════════════════════════ */}
            {orderToForceComplete && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[110] p-4 animate-in fade-in duration-150">
                    <div className="bg-white rounded-[4px] shadow-2xl border-2 border-[#001d35] max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-150">
                        <div className="bg-[#001d35] text-white px-4 py-3 flex items-center justify-between border-b-2 border-[#f77500]">
                            <div className="flex items-center gap-2">
                                <ShieldAlert className="w-4 h-4 text-amber-400" />
                                <h3 className="text-xs font-semibold uppercase tracking-wider text-white">
                                    Clôture Définitive Exceptionnelle
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setOrderToForceComplete(null)}
                                className="text-gray-300 hover:text-white p-1 rounded transition-colors cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-4 space-y-3">
                            <p className="text-xs text-gray-700 font-normal leading-relaxed">
                                Cette commande ({orderToForceComplete.orderNumber}) est partiellement livrée. Souhaitez-vous clore définitivement ce bon et annuler le reliquat restant ?
                            </p>

                            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-[4px] text-[11px] text-amber-800">
                                Cette action régularisera le statut de la commande en "Terminé".
                            </div>
                        </div>

                        <div className="p-3 bg-gray-50 border-t border-gray-200 flex justify-end items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setOrderToForceComplete(null)}
                                className="px-3.5 py-1.5 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 rounded-[4px] transition-colors cursor-pointer"
                            >
                                Annuler
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmForceComplete}
                                className="px-4 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-[4px] shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                                <CheckCircle className="w-3.5 h-3.5" />
                                <span>Confirmer la Clôture</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═════════════════════════════════════════════════════════════════════ */}
            {/* MODALE DE CONFIRMATION : GÉNÉRATION DU BON DE COMMANDE FOURNISSEUR   */}
            {/* Garantit que 100% des articles du tableau sont réunis dans ce Bon     */}
            {/* ═════════════════════════════════════════════════════════════════════ */}
            {orderConfirmData && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[115] p-4 animate-in fade-in duration-150">
                    <div className="bg-white rounded-[4px] shadow-2xl border-2 border-[#001d35] max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Barre supérieure */}
                        <div className="p-3.5 bg-[#001d35] text-white flex items-center justify-between border-b-2 border-[#f77500]">
                            <div className="flex items-center gap-2">
                                <Truck className="w-4 h-4 text-[#f77500]" />
                                <h3 className="text-xs font-semibold uppercase tracking-wider text-white">
                                    Génération du Bon de Commande Fournisseur
                                </h3>
                                <span className="px-2 py-0.5 rounded-[3px] text-[10px] font-bold bg-[#f77500] text-slate-900">
                                    {orderConfirmData.items.length} article(s)
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setOrderConfirmData(null)}
                                className="text-gray-300 hover:text-white p-1 rounded transition-colors cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-4 space-y-3.5 flex-1 overflow-y-auto">
                            {/* Choix du fournisseur */}
                            <div className="bg-slate-50 p-3 rounded-[4px] border border-gray-200">
                                <label className="block text-xs font-bold uppercase tracking-wider text-[#001d35] mb-1.5">
                                    Fournisseur Destinataire du Bon de Commande
                                </label>
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <select
                                        value={orderConfirmData.supplier}
                                        onChange={(e) => setOrderConfirmData({ ...orderConfirmData, supplier: e.target.value })}
                                        className="flex-1 px-3 py-1.5 text-xs font-semibold border border-gray-300 rounded-[4px] bg-white text-[#001d35] focus:outline-none focus:ring-1 focus:ring-[#001d35]"
                                    >
                                        {suppliers.map(s => (
                                            <option key={s.id || s.name || s} value={s.name || s}>{s.name || s}</option>
                                        ))}
                                        {orderConfirmData.supplier && !suppliers.some(s => (s.name || s) === orderConfirmData.supplier) && orderConfirmData.supplier !== 'NOUVEAU' && (
                                            <option value={orderConfirmData.supplier}>{orderConfirmData.supplier}</option>
                                        )}
                                        <option value="NOUVEAU">+ Autre fournisseur (Saisie libre)...</option>
                                    </select>

                                    {orderConfirmData.supplier === 'NOUVEAU' && (
                                        <input
                                            type="text"
                                            placeholder="Nom du fournisseur..."
                                            value={orderConfirmData.customSupplierInput}
                                            onChange={(e) => setOrderConfirmData({ ...orderConfirmData, customSupplierInput: e.target.value })}
                                            className="flex-1 px-3 py-1.5 text-xs border border-gray-300 rounded-[4px] focus:outline-none focus:ring-1 focus:ring-[#001d35]"
                                            autoFocus
                                        />
                                    )}
                                </div>
                                <p className="text-[11px] text-gray-500 font-normal mt-1.5">
                                    L'ensemble des <strong>{orderConfirmData.items.length} articles</strong> du tableau sera regroupé dans ce bon de commande.
                                </p>
                            </div>

                            {/* Tableau récapitulatif des articles inclus */}
                            <div className="border border-gray-200 rounded-[4px] overflow-hidden">
                                <div className="px-3 py-2 bg-gray-100 border-b border-gray-200 text-[11px] font-bold uppercase tracking-wider text-gray-700 flex justify-between items-center">
                                    <span>Articles Inclus dans la commande ({orderConfirmData.items.length})</span>
                                    <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-[3px] border border-emerald-200">
                                        100% des produits du tableau
                                    </span>
                                </div>
                                <div className="max-h-56 overflow-y-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-slate-50 text-[10px] font-semibold uppercase text-gray-600 border-b border-gray-200 sticky top-0">
                                            <tr>
                                                <th className="py-1.5 px-3">#</th>
                                                <th className="py-1.5 px-3">Article</th>
                                                <th className="py-1.5 px-3 text-center">Qté Commandée</th>
                                                <th className="py-1.5 px-3 text-right">P.U Achat</th>
                                                <th className="py-1.5 px-3 text-right">Total Ligne</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {orderConfirmData.items.map((it, idx) => (
                                                <tr key={it.productId || idx} className="hover:bg-slate-50">
                                                    <td className="py-2 px-3 text-gray-400 font-mono text-[11px]">{idx + 1}</td>
                                                    <td className="py-2 px-3 font-semibold text-gray-900">
                                                        {it.name}
                                                    </td>
                                                    <td className="py-2 px-3 text-center font-bold text-[#001d35]">
                                                        {it.recommendedContainers} {it.containerLabel}
                                                    </td>
                                                    <td className="py-2 px-3 text-right text-gray-700 font-medium">
                                                        {formatPrice(it.purchasePricePerContainer)}
                                                    </td>
                                                    <td className="py-2 px-3 text-right font-bold text-[#001d35]">
                                                        {formatPrice(it.estimatedTotalCost)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="p-2.5 bg-slate-50 border-t border-gray-200 flex justify-between items-center text-xs">
                                    <span className="font-bold uppercase text-gray-600">Montant Total du Bon :</span>
                                    <span className="text-sm font-bold text-[#001d35]">
                                        {formatPrice(orderConfirmData.items.reduce((acc, i) => acc + (i.estimatedTotalCost || 0), 0))}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Pied de modale */}
                        <div className="p-3 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
                            <button
                                type="button"
                                onClick={() => setOrderConfirmData(null)}
                                className="px-3.5 py-1.5 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 rounded-[4px] transition-colors cursor-pointer"
                            >
                                Annuler
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmGenerateOrders}
                                className="px-4 py-1.5 text-xs font-semibold text-white bg-[#001d35] hover:bg-[#00284a] rounded-[4px] shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                                <CheckCircle className="w-3.5 h-3.5 text-[#f77500]" />
                                <span>Confirmer et Créer le Bon ({orderConfirmData.items.length} articles)</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═════════════════════════════════════════════════════════════════════ */}
            {/* OVERLAY LOADER DE VALIDATION (Au moins 1,5s avant affichage du Toast)  */}
            {/* ═════════════════════════════════════════════════════════════════════ */}
            {actionLoading && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[200] p-4 animate-in fade-in duration-150">
                    <div className="bg-white rounded-[4px] p-6 shadow-2xl border-2 border-[#001d35] flex flex-col items-center max-w-sm text-center">
                        <div className="relative h-12 w-12 mb-3">
                            <div className="absolute inset-0 animate-spin rounded-full border-4 border-gray-200 border-t-[#001d35]"></div>
                            <div className="absolute inset-2 animate-spin-reverse rounded-full border-2 border-transparent border-b-[#f77500]"></div>
                        </div>
                        <h4 className="text-sm font-semibold text-[#001d35] uppercase tracking-wider">
                            Traitement en cours...
                        </h4>
                        <p className="text-xs text-gray-600 mt-1 font-medium">
                            {actionLoading}
                        </p>
                    </div>
                </div>
            )}

            {/* OVERLAY LOADER D'ENTRÉE DE PAGE (1,5s au montage) */}
            {isPageLoading && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[300] p-4 animate-in fade-in duration-150">
                    <div className="bg-white rounded-[4px] p-6 shadow-2xl border-2 border-[#001d35] flex flex-col items-center max-w-sm text-center">
                        <div className="relative h-12 w-12 mb-3">
                            <div className="absolute inset-0 animate-spin rounded-full border-4 border-gray-200 border-t-[#001d35]"></div>
                            <div className="absolute inset-2 animate-spin-reverse rounded-full border-2 border-transparent border-b-[#f77500]"></div>
                        </div>
                        <h4 className="text-sm font-semibold text-[#001d35] uppercase tracking-wider">
                            Chargement en cours...
                        </h4>
                        <p className="text-xs text-gray-600 mt-1 font-medium">
                            Réapprovisionnement Intelligent
                        </p>
                    </div>
                </div>
            )}
        </div>

    );
};

export default Replenishment;
