import React, { useState, useMemo } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { useInventory } from '../../context/InventoryContext';
import { useAuth } from '../../context/AuthContext';
import T from '../../utils/toast';
import {
    Search,
    Filter,
    Plus,
    Calendar,
    Store as StoreIcon,
    FileText,
    History,
    Package,
    X,
    ArrowUpCircle,
    ArrowDownCircle,
    RotateCcw,
    CheckCircle2,
    AlertTriangle,
    ShieldCheck,
    ShieldAlert,
    ArrowLeftRight,
    Clock,
    User as UserIcon,
    Download,
    Upload,
    Wrench,
    Eye,
    Printer,
    ChevronRight,
    Layers,
    Info,
    Check
} from 'lucide-react';

const Movements = () => {
    const { stores, currentStoreId } = useSettings();
    const { products, movements: contextMovements = [], recordAdjustment, recordTransfer } = useInventory();
    const { user } = useAuth();

    // ── Filtres et États ──
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'IN' | 'OUT' | 'ADJUST' | 'TRANSFER'
    const [filterStore, setFilterStore] = useState('ALL');
    const [period, setPeriod] = useState('7days'); // 'today' | '7days' | 'month' | 'all'
    const [selectedMovement, setSelectedMovement] = useState(null);

    // ── Modales ──
    const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

    // ── Formulaire Ajustement ──
    const [adjProductId, setAdjProductId] = useState('');
    const [adjStoreId, setAdjStoreId] = useState(currentStoreId || '1');
    const [adjType, setAdjType] = useState('DECREASE'); // 'INCREASE' | 'DECREASE'
    const [adjQty, setAdjQty] = useState('');
    const [adjReason, setAdjReason] = useState('CORRECTION');
    const [adjNotes, setAdjNotes] = useState('');

    // ── Formulaire Transfert ──
    const [trfProductId, setTrfProductId] = useState('');
    const [trfSourceStore, setTrfSourceStore] = useState(currentStoreId || '1');
    const [trfTargetStore, setTrfTargetStore] = useState('');
    const [trfQty, setTrfQty] = useState('');
    const [trfReason, setTrfReason] = useState('Réassort commercial');
    const [trfNotes, setTrfNotes] = useState('');

    // ── Données initiales réalistes (Quincaillerie BTP / Matériaux) ──
    const seedMovements = useMemo(() => [
        {
            id: 'm-seed-1',
            date: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
            productId: 'p-ciment-1',
            productName: 'Ciment CPJ 45 (Sac 50Kg)',
            type: 'IN',
            quantity: 120,
            unit: 'Sacs',
            storeId: '1',
            storeName: 'Boutique Principale',
            reason: 'Réception Fournisseur BL #4892 - Ciments d\'Afrique',
            details: 'Lot de fabrication C45-2026-05, stockage hangar couvert',
            user: 'Jean Dupont'
        },
        {
            id: 'm-seed-2',
            date: new Date(Date.now() - 1000 * 60 * 95).toISOString(),
            productId: 'p-fer-12',
            productName: 'Fer à Béton Torsadé FE500 Ø12 (Barre 12m)',
            type: 'OUT',
            quantity: 35,
            unit: 'Barres',
            storeId: '1',
            storeName: 'Boutique Principale',
            reason: 'Vente Comptoir - Facture #VNT-8812',
            details: 'Enlèvement immédiat camion client Chantier Bè',
            user: 'Alice Koffi'
        },
        {
            id: 'm-seed-3',
            date: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
            productId: 'p-peinture-5l',
            productName: 'Peinture Glycéro Blanche Mate 5L',
            type: 'ADJUST',
            quantity: -3,
            unit: 'Pots',
            storeId: '2',
            storeName: 'Annexe Kara',
            reason: 'Casse / Dommage manutention',
            details: 'Palette heurtée lors du déchargement - 3 pots percés',
            user: 'Marc Lawson'
        },
        {
            id: 'm-seed-4',
            date: new Date(Date.now() - 1000 * 60 * 320).toISOString(),
            productId: 'p-pvc-32',
            productName: 'Tuyau PVC Pression Ø32 PN16 (Barre 4m)',
            type: 'TRANSFER',
            quantity: 25,
            unit: 'Barres',
            storeId: '1',
            storeName: 'Boutique Principale',
            targetStoreId: '2',
            targetStoreName: 'Annexe Kara',
            reason: 'Transfert Inter-Dépôts vers Annexe Kara',
            details: 'Ordre de transfert interne #TRF-2026-09',
            user: 'Admin'
        },
        {
            id: 'm-seed-5',
            date: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
            productId: 'p-marteau-300',
            productName: 'Marteau de Menuisier 300g Manche Frêne',
            type: 'IN',
            quantity: 15,
            unit: 'Pièces',
            storeId: '1',
            storeName: 'Boutique Principale',
            reason: 'Retour Client Avoir #AV-2026-04',
            details: 'Surplus chantier retourné en parfait état d\'origine',
            user: 'Alice Koffi'
        },
        {
            id: 'm-seed-6',
            date: new Date(Date.now() - 1000 * 60 * 60 * 22).toISOString(),
            productId: 'p-cable-ro2v',
            productName: 'Câble Cuivre R2V 3G2.5mm² (Touret 100m)',
            type: 'ADJUST',
            quantity: 2,
            unit: 'Tourets',
            storeId: '1',
            storeName: 'Boutique Principale',
            reason: 'Correction d\'inventaire tournant',
            details: 'Comptage physique supérieur au stock théorique',
            user: 'Jean Dupont'
        }
    ], []);

    // ── Fusion avec les mouvements du contexte ou localStorage ──
    const allMovements = useMemo(() => {
        const enrichedContext = (contextMovements || []).map(m => {
            const prod = products.find(p => p.id === m.productId);
            const srcStore = stores.find(s => String(s.id) === String(m.storeId));
            const tgtStore = m.targetStoreId ? stores.find(s => String(s.id) === String(m.targetStoreId)) : null;

            return {
                ...m,
                productName: m.productName || (prod ? prod.name : 'Article Quincaillerie'),
                unit: m.unit || (prod ? prod.unit : 'Unités'),
                storeName: srcStore ? srcStore.name : `Dépôt #${m.storeId || '1'}`,
                targetStoreName: tgtStore ? tgtStore.name : (m.targetStoreId ? `Dépôt #${m.targetStoreId}` : null),
                user: m.user || 'Admin'
            };
        });

        // Combiner contexte et données de démonstration sans doublons
        const contextIds = new Set(enrichedContext.map(m => m.id));
        const nonDuplicateSeed = seedMovements.filter(s => !contextIds.has(s.id));
        return [...enrichedContext, ...nonDuplicateSeed].sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [contextMovements, products, stores, seedMovements]);

    // ── Filtrage de Période ──
    const isWithinPeriod = (dateStr, periodKey) => {
        if (periodKey === 'all') return true;
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now - date;
        const diffHours = diffMs / (1000 * 60 * 60);

        if (periodKey === 'today') return diffHours <= 24;
        if (periodKey === '7days') return diffHours <= (24 * 7);
        if (periodKey === 'month') return diffHours <= (24 * 31);
        return true;
    };

    // ── Mouvements Filtrés ──
    const filteredMovements = useMemo(() => {
        return allMovements.filter(m => {
            // Filtre par onglet de type
            if (activeTab !== 'ALL') {
                const normType = (m.type || '').toUpperCase();
                if (activeTab === 'ADJUST' && normType !== 'ADJUST' && normType !== 'ADJUSTMENT') return false;
                if (activeTab !== 'ADJUST' && normType !== activeTab) return false;
            }

            // Filtre par magasin
            if (filterStore !== 'ALL') {
                const matchesStore = String(m.storeId) === String(filterStore) || (m.targetStoreId && String(m.targetStoreId) === String(filterStore));
                if (!matchesStore) return false;
            }

            // Filtre par période
            if (!isWithinPeriod(m.date, period)) return false;

            // Filtre recherche textuelle
            if (searchTerm.trim()) {
                const query = searchTerm.toLowerCase();
                const matchProd = (m.productName || '').toLowerCase().includes(query);
                const matchReason = (m.reason || '').toLowerCase().includes(query);
                const matchUser = (m.user || '').toLowerCase().includes(query);
                const matchStore = (m.storeName || '').toLowerCase().includes(query);
                const matchDetails = (m.details || '').toLowerCase().includes(query);
                if (!matchProd && !matchReason && !matchUser && !matchStore && !matchDetails) return false;
            }

            return true;
        });
    }, [allMovements, activeTab, filterStore, period, searchTerm]);

    // ── Calcul des Indicateurs / KPI ──
    const metrics = useMemo(() => {
        let totalInQty = 0;
        let totalOutQty = 0;
        let totalAdjustQty = 0;
        let adjustCount = 0;
        let transferCount = 0;
        let totalTransferQty = 0;

        allMovements.forEach(m => {
            const qty = Math.abs(Number(m.quantity) || 0);
            const type = (m.type || '').toUpperCase();

            if (type === 'IN') {
                totalInQty += qty;
            } else if (type === 'OUT') {
                totalOutQty += qty;
            } else if (type === 'ADJUST' || type === 'ADJUSTMENT') {
                adjustCount += 1;
                totalAdjustQty += Number(m.quantity) || 0;
            } else if (type === 'TRANSFER') {
                transferCount += 1;
                totalTransferQty += qty;
            }
        });

        return {
            totalInQty,
            totalOutQty,
            adjustCount,
            totalAdjustQty,
            transferCount,
            totalTransferQty,
            totalCount: allMovements.length
        };
    }, [allMovements]);

    // ── Badges de Type de Mouvement ──
    const getTypeBadge = (type) => {
        const norm = (type || '').toUpperCase();
        switch (norm) {
            case 'IN':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-emerald-50 text-emerald-800 border border-emerald-200/80 font-bold text-[10px] uppercase tracking-wider">
                        <img src="/icons8/fluency_48_download.png" alt="" className="w-3 h-3 rotate-90" />
                        <span>Entrée</span>
                    </span>
                );
            case 'OUT':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-blue-50 text-blue-800 border border-blue-200/80 font-bold text-[10px] uppercase tracking-wider">
                        <img src="/icons8/fluency_48_upload.png" alt="" className="w-3 h-3 rotate-90" />
                        <span>Sortie</span>
                    </span>
                );
            case 'ADJUST':
            case 'ADJUSTMENT':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-amber-50 text-amber-800 border border-amber-200/80 font-bold text-[10px] uppercase tracking-wider">
                        <img src="/icons8/fluency_48_maintenance.png" alt="" className="w-3 h-3" />
                        <span>Ajustement</span>
                    </span>
                );
            case 'TRANSFER':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-purple-50 text-purple-800 border border-purple-200/80 font-bold text-[10px] uppercase tracking-wider">
                        <img src="/icons8/fluency_48_synchronize.png" alt="" className="w-3 h-3" />
                        <span>Transfert</span>
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-gray-100 text-gray-700 border border-gray-200 font-bold text-[10px] uppercase tracking-wider">
                        {type}
                    </span>
                );
        }
    };

    // ── Formatage Date Heure ──
    const formatDate = (dateStr) => {
        try {
            const date = new Date(dateStr);
            return new Intl.DateTimeFormat('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }).format(date);
        } catch {
            return dateStr;
        }
    };

    // ── Gestion de la Soumission de l'Ajustement ──
    const handleCreateAdjustment = (e) => {
        e.preventDefault();
        if (!adjProductId) {
            T.error('Veuillez sélectionner un article.');
            return;
        }
        const numericQty = parseFloat(adjQty);
        if (isNaN(numericQty) || numericQty <= 0) {
            T.error('Veuillez saisir une quantité valide supérieure à zéro.');
            return;
        }

        const delta = adjType === 'DECREASE' ? -numericQty : numericQty;
        const reasonLabels = {
            CORRECTION: "Correction d'inventaire physique",
            DAMAGE: "Casse / Avarie de manutention",
            LOSS: "Perte inexpliquée / Vol",
            EXPIRATION: "Péremption / Altération",
            GIFT: "Don / Échantillon client",
            OTHER: "Autre régularisation"
        };

        const finalReason = reasonLabels[adjReason] || "Ajustement de stock";

        try {
            if (recordAdjustment) {
                recordAdjustment(
                    adjProductId,
                    delta,
                    finalReason,
                    adjNotes,
                    adjStoreId,
                    user ? `${user.firstName || ''} ${user.lastName || user.username || ''}`.trim() : 'Admin'
                );
            }
            T.success(`Ajustement de ${delta > 0 ? '+' : ''}${delta} unité(s) enregistré avec succès !`);
            setIsAdjustmentModalOpen(false);
            setAdjProductId('');
            setAdjQty('');
            setAdjNotes('');
        } catch (err) {
            console.error(err);
            T.error("Erreur lors de l'enregistrement de l'ajustement.");
        }
    };

    // ── Gestion de la Soumission du Transfert ──
    const handleCreateTransfer = (e) => {
        e.preventDefault();
        if (!trfProductId) {
            T.error('Veuillez sélectionner un article.');
            return;
        }
        if (!trfTargetStore) {
            T.error('Veuillez sélectionner un magasin de destination.');
            return;
        }
        if (String(trfSourceStore) === String(trfTargetStore)) {
            T.error('La boutique source et la boutique destination doivent être différentes.');
            return;
        }
        const numericQty = parseFloat(trfQty);
        if (isNaN(numericQty) || numericQty <= 0) {
            T.error('Veuillez saisir une quantité valide à transférer.');
            return;
        }

        try {
            if (recordTransfer) {
                recordTransfer(
                    trfProductId,
                    numericQty,
                    trfSourceStore,
                    trfTargetStore,
                    trfReason,
                    trfNotes,
                    user ? `${user.firstName || ''} ${user.lastName || user.username || ''}`.trim() : 'Admin'
                );
            }
            T.success(`Transfert de ${numericQty} unité(s) validé avec succès !`);
            setIsTransferModalOpen(false);
            setTrfProductId('');
            setTrfQty('');
            setTrfNotes('');
        } catch (err) {
            console.error(err);
            T.error("Erreur lors de l'exécution du transfert.");
        }
    };

    // ── Produit sélectionné pour prévisualisation en direct ──
    const selectedAdjProduct = products.find(p => p.id === adjProductId);
    const currentAdjStock = selectedAdjProduct
        ? (selectedAdjProduct.stockLevels?.[adjStoreId] !== undefined
            ? Number(selectedAdjProduct.stockLevels[adjStoreId])
            : (selectedAdjProduct.stockLevels?.[currentStoreId] !== undefined
                ? Number(selectedAdjProduct.stockLevels[currentStoreId])
                : Number(selectedAdjProduct.stock || 0)))
        : 0;

    const projectedAdjStock = selectedAdjProduct
        ? (adjType === 'INCREASE'
            ? currentAdjStock + (parseFloat(adjQty) || 0)
            : Math.max(0, currentAdjStock - (parseFloat(adjQty) || 0)))
        : 0;

    const selectedTrfProduct = products.find(p => p.id === trfProductId);
    const currentTrfSrcStock = selectedTrfProduct
        ? (selectedTrfProduct.stockLevels?.[trfSourceStore] !== undefined
            ? Number(selectedTrfProduct.stockLevels[trfSourceStore])
            : Number(selectedTrfProduct.stock || 0))
        : 0;

    return (
        <div className="space-y-2.5">
            {/* ── 1. EN-TÊTE OFFICIEL KABLLIX ERP (HARMONISÉ AVEC LE DASHBOARD) ── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-3.5 rounded-sm border-2 border-gray-300 shadow-sm">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="p-1.5 bg-[#001d35] text-white rounded-sm">
                            <History className="w-4 h-4 text-[#f77500]" />
                        </span>
                        <h2 className="text-xl sm:text-2xl font-bold text-[#001d35] tracking-tight">
                            Mouvements & Ajustements
                        </h2>
                        <span className="px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-800 border border-blue-200">
                            Grand Livre des Stocks
                        </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 font-medium">
                        Tracez chaque entrée, sortie, avarie et transfert avec justification d'audit et équilibrage multi-dépôts
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => T.success("Export du Grand Livre des Mouvements prêt (PDF/Excel)")}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-sm border-2 border-gray-300 hover:bg-gray-50 text-gray-700 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-sm active:scale-95"
                    >
                        <FileText className="w-4 h-4 text-[#001d35]" />
                        <span>Exporter Journal</span>
                    </button>
                    <button
                        onClick={() => setIsTransferModalOpen(true)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-sm bg-[#001d35] hover:bg-[#001222] text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md active:scale-95"
                    >
                        <ArrowLeftRight className="w-4 h-4 text-[#f77500]" />
                        <span>Transférer Stock</span>
                    </button>
                    <button
                        onClick={() => setIsAdjustmentModalOpen(true)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-sm bg-[#f77500] hover:bg-[#e66a00] text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md active:scale-95"
                    >
                        <Plus className="w-4 h-4 text-white" />
                        <span>Nouvel Ajustement</span>
                    </button>
                </div>
            </div>

            {/* ── 2. 4 STATCARDS EXACTES DU DASHBOARD ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. Entrées Réceptionnées */}
                <div className="bg-white p-3 rounded-sm border-2 border-gray-300 shadow-sm relative group hover:shadow-md transition-shadow overflow-hidden min-h-[120px] flex flex-col justify-center">
                    <div className="flex justify-between items-start relative z-10">
                        <div className="flex-1">
                            <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-blue-600/70">Entrées Réceptionnées</p>
                            <div className="flex items-baseline mt-2 font-semibold opacity-85" style={{ color: '#001d35', opacity: 0.85 }}>
                                <h3 className="text-xl sm:text-2xl font-semibold">
                                    +{metrics.totalInQty}
                                </h3>
                            </div>
                            <p className="text-xs text-gray-400 mt-2 font-medium">Approvisionnements & Retours sains</p>
                        </div>
                    </div>
                    <img src="/icons8/fluency_240_truck.png" alt="" className="absolute bottom-2 right-2 w-16 h-16 opacity-30 group-hover:opacity-50 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-700 pointer-events-none" />
                </div>

                {/* 2. Sorties Commerciales */}
                <div className="bg-white p-3 rounded-sm border-2 border-gray-300 shadow-sm relative group hover:shadow-md transition-shadow overflow-hidden min-h-[120px] flex flex-col justify-center">
                    <div className="flex justify-between items-start relative z-10">
                        <div className="flex-1">
                            <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-blue-600/70">Sorties Commerciales</p>
                            <div className="flex items-baseline mt-2 font-semibold opacity-85" style={{ color: '#001d35', opacity: 0.85 }}>
                                <h3 className="text-xl sm:text-2xl font-semibold">
                                    -{metrics.totalOutQty}
                                </h3>
                            </div>
                            <p className="text-xs text-gray-400 mt-2 font-medium">Ventes comptoir & Chantiers</p>
                        </div>
                    </div>
                    <img src="/icons8/fluency_240_shopping-cart.png" alt="" className="absolute bottom-2 right-2 w-16 h-16 opacity-30 group-hover:opacity-50 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-700 pointer-events-none" />
                </div>

                {/* 3. Ajustements & Écarts */}
                <div className="bg-white p-3 rounded-sm border-2 border-gray-300 shadow-sm relative group hover:shadow-md transition-shadow overflow-hidden min-h-[120px] flex flex-col justify-center">
                    <div className="flex justify-between items-start relative z-10">
                        <div className="flex-1">
                            <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-blue-600/70">Ajustements & Écarts</p>
                            <div className="flex items-baseline mt-2 font-semibold opacity-85" style={{ color: '#001d35', opacity: 0.85 }}>
                                <h3 className="text-xl sm:text-2xl font-semibold">
                                    {metrics.totalAdjustQty > 0 ? `+${metrics.totalAdjustQty}` : metrics.totalAdjustQty}
                                </h3>
                            </div>
                            <p className="text-xs text-gray-400 mt-2 font-medium">{metrics.adjustCount} régularisations enregistrées</p>
                        </div>
                    </div>
                    <img src="/icons8/fluency_240_high-priority.png" alt="" className="absolute bottom-2 right-2 w-16 h-16 opacity-30 group-hover:opacity-50 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-700 pointer-events-none" />
                </div>

                {/* 4. Transferts Inter-Dépôts */}
                <div className="bg-white p-3 rounded-sm border-2 border-gray-300 shadow-sm relative group hover:shadow-md transition-shadow overflow-hidden min-h-[120px] flex flex-col justify-center">
                    <div className="flex justify-between items-start relative z-10">
                        <div className="flex-1">
                            <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-blue-600/70">Transferts Dépôts</p>
                            <div className="flex items-baseline mt-2 font-semibold opacity-85" style={{ color: '#001d35', opacity: 0.85 }}>
                                <h3 className="text-xl sm:text-2xl font-semibold">
                                    {metrics.transferCount} navettes
                                </h3>
                            </div>
                            <p className="text-xs text-gray-400 mt-2 font-medium">{metrics.totalTransferQty} unités rééquilibrées</p>
                        </div>
                    </div>
                    <img src="/icons8/fluency_96_synchronize.png" alt="" className="absolute bottom-2 right-2 w-16 h-16 opacity-30 group-hover:opacity-50 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-700 pointer-events-none" />
                </div>
            </div>

            {/* ── 3. BARRE D'ONGLETS DE PÉRIODE & FLUX (STYLE DASHBOARD) ── */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2.5 rounded-sm border-2 border-gray-300 shadow-sm">
                <div className="flex flex-wrap items-center gap-1 bg-gray-100/80 p-1 rounded-sm border-2 border-gray-300">
                    {[
                        { key: 'ALL', label: 'Tous les Flux', count: allMovements.length },
                        { key: 'IN', label: 'Entrées', count: allMovements.filter(m => m.type === 'IN').length },
                        { key: 'OUT', label: 'Sorties', count: allMovements.filter(m => m.type === 'OUT').length },
                        { key: 'ADJUST', label: 'Ajustements', count: allMovements.filter(m => m.type === 'ADJUST' || m.type === 'ADJUSTMENT').length },
                        { key: 'TRANSFER', label: 'Transferts', count: allMovements.filter(m => m.type === 'TRANSFER').length }
                    ].map(tab => (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => setActiveTab(tab.key)}
                            className={`px-3 py-1.5 text-xs font-bold rounded-sm transition-all cursor-pointer flex items-center gap-1.5 ${
                                activeTab === tab.key
                                    ? 'bg-[#001d35] text-white shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                            }`}
                        >
                            <span>{tab.label}</span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm ${
                                activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
                            }`}>
                                {tab.count}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Filtre temporel Segmented & indicateur Période style Dashboard */}
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 bg-gray-100/80 p-1 rounded-sm border-2 border-gray-300">
                        {[
                            { key: 'today', label: "Aujourd'hui" },
                            { key: '7days', label: '7 jours' },
                            { key: 'month', label: 'Ce mois' },
                            { key: 'all', label: 'Tout' }
                        ].map(opt => (
                            <button
                                key={opt.key}
                                onClick={() => setPeriod(opt.key)}
                                className={`px-3 py-1.5 text-xs font-bold rounded-sm transition-all cursor-pointer ${
                                    period === opt.key
                                        ? 'bg-[#001d35] text-white shadow-sm'
                                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    <div className="hidden sm:flex items-center gap-2 text-xs text-gray-600 font-semibold pr-2">
                        <Calendar className="w-3.5 h-3.5 text-[#001d35]" />
                        <span>Période : <strong className="text-[#001d35]">{period === 'today' ? "Aujourd'hui" : period === '7days' ? '7 derniers jours' : period === 'month' ? 'Ce mois' : 'Historique complet'}</strong></span>
                    </div>
                </div>
            </div>

            {/* ── 4. BARRE DE RECHERCHE ET SÉLECTEUR DE BOUTIQUE ── */}
            <div className="bg-white p-3 rounded-sm border-2 border-gray-300 shadow-sm flex flex-col md:flex-row gap-2.5 items-stretch md:items-center">
                <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Rechercher par article, motif, référence de pièce, utilisateur..."
                        className="w-full pl-10 pr-8 py-2 bg-white border-2 border-gray-300 rounded-sm text-xs font-semibold text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#001d35]"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 border-2 border-gray-300 rounded-sm">
                        <StoreIcon className="w-3.5 h-3.5 text-[#001d35]" />
                        <select
                            className="bg-transparent text-xs font-bold outline-none cursor-pointer text-gray-700 min-w-[140px]"
                            value={filterStore}
                            onChange={(e) => setFilterStore(e.target.value)}
                        >
                            <option value="ALL">Tous les dépôts</option>
                            {stores.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>

                    {(searchTerm || filterStore !== 'ALL' || activeTab !== 'ALL' || period !== '7days') && (
                        <button
                            onClick={() => {
                                setSearchTerm('');
                                setFilterStore('ALL');
                                setActiveTab('ALL');
                                setPeriod('7days');
                            }}
                            className="px-3 py-2 text-xs font-bold text-gray-500 hover:text-rose-600 bg-gray-50 hover:bg-rose-50 border-2 border-gray-300 rounded-sm transition-all cursor-pointer whitespace-nowrap"
                        >
                            Réinitialiser
                        </button>
                    )}
                </div>
            </div>

            {/* ── 5. GRAND LIVRE DES MOUVEMENTS (TABLEAU HARMONISÉ DASHBOARD) ── */}
            <div className="bg-white rounded-sm border-2 border-gray-300 shadow-sm overflow-hidden flex flex-col">
                <div className="px-4 py-3 border-b-2 border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white">
                    <div>
                        <h3 className="text-sm font-semibold tracking-wide uppercase text-[11px] text-blue-600/70">
                            Grand Livre des Mouvements & Flux de Stock
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5 font-medium">
                            Historique chronologique avec piste d'audit et motifs de régularisation
                        </p>
                    </div>
                    <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-sm border border-gray-200">
                        {filteredMovements.length} mouvement(s)
                    </span>
                </div>

                <div className="overflow-x-auto max-h-[580px] overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-[#001d35] text-white font-bold uppercase tracking-wider text-[10px] sticky top-0 z-10 shadow-xs">
                            <tr>
                                <th className="py-2.5 px-3.5 whitespace-nowrap">Horodatage</th>
                                <th className="py-2.5 px-3.5">Article & Référence</th>
                                <th className="py-2.5 px-3.5 text-center">Type de Flux</th>
                                <th className="py-2.5 px-3.5 text-right">Variation</th>
                                <th className="py-2.5 px-3.5">Dépôt / Magasin</th>
                                <th className="py-2.5 px-3.5">Motif & Piste d'Audit</th>
                                <th className="py-2.5 px-3.5 text-right">Opérateur</th>
                                <th className="py-2.5 px-3.5 text-center w-12">Détails</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {filteredMovements.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="py-12 text-center text-gray-400 font-medium bg-gray-50/50">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <Package className="w-8 h-8 text-gray-300" />
                                            <p className="text-sm font-semibold text-gray-600">Aucun mouvement ne correspond aux filtres appliqués</p>
                                            <p className="text-xs text-gray-400">Modifiez la période, la recherche ou le type de flux sélectionné</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredMovements.map((m) => {
                                    const isPositive = Number(m.quantity) > 0;
                                    const isTransfer = (m.type || '').toUpperCase() === 'TRANSFER';

                                    return (
                                        <tr
                                            key={m.id}
                                            onClick={() => setSelectedMovement(m)}
                                            className="hover:bg-blue-50/40 transition-colors odd:bg-gray-50/30 even:bg-white cursor-pointer group"
                                        >
                                            {/* Horodatage */}
                                            <td className="py-3 px-3.5 whitespace-nowrap">
                                                <div className="font-bold text-gray-900 text-xs">
                                                    {formatDate(m.date).split(' ')[0]}
                                                </div>
                                                <div className="text-[10px] text-gray-500 font-medium">
                                                    {formatDate(m.date).split(' ')[1] || ''}
                                                </div>
                                            </td>

                                            {/* Article */}
                                            <td className="py-3 px-3.5">
                                                <div className="font-bold text-gray-900 uppercase text-xs tracking-tight group-hover:text-blue-900">
                                                    {m.productName}
                                                </div>
                                                <span className="text-[10px] text-gray-500 font-medium">
                                                    Unité de base : {m.unit || 'Pièce'}
                                                </span>
                                            </td>

                                            {/* Type de Flux */}
                                            <td className="py-3 px-3.5 text-center whitespace-nowrap">
                                                {getTypeBadge(m.type)}
                                            </td>

                                            {/* Variation & Quantité */}
                                            <td className="py-3 px-3.5 text-right whitespace-nowrap">
                                                <div className="flex items-baseline justify-end gap-1">
                                                    <span className={`font-bold text-xs sm:text-[13px] tracking-tight ${isPositive ? 'text-emerald-700' : 'text-rose-700'}`}>
                                                        {!isTransfer && isPositive ? '+' : ''}{m.quantity}
                                                    </span>
                                                    <span className="text-[10px] text-gray-400 uppercase font-bold">{m.unit}</span>
                                                </div>
                                            </td>

                                            {/* Dépôt / Magasin */}
                                            <td className="py-3 px-3.5 whitespace-nowrap">
                                                {isTransfer && m.targetStoreName ? (
                                                    <div className="flex items-center gap-1.5 text-xs">
                                                        <span className="text-gray-700 font-medium">{m.storeName}</span>
                                                        <ArrowLeftRight className="w-3.5 h-3.5 text-purple-600" />
                                                        <span className="text-purple-800 font-bold">{m.targetStoreName}</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                                                        <StoreIcon className="w-3.5 h-3.5 text-blue-600/40" />
                                                        <span>{m.storeName}</span>
                                                    </div>
                                                )}
                                            </td>

                                            {/* Motif & Piste d'Audit */}
                                            <td className="py-3 px-3.5 max-w-[260px]">
                                                <div className="text-xs text-gray-800 font-medium truncate" title={m.reason}>
                                                    {m.reason}
                                                </div>
                                                {m.details && (
                                                    <div className="text-[10px] text-gray-400 truncate font-normal" title={m.details}>
                                                        {m.details}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Opérateur */}
                                            <td className="py-3 px-3.5 text-right whitespace-nowrap">
                                                <div className="flex items-center justify-end gap-2">
                                                    <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
                                                        {m.user}
                                                    </span>
                                                    <div className="w-6 h-6 rounded-sm bg-gray-100 border border-gray-200 flex items-center justify-center text-[10px] font-semibold text-[#001d35]">
                                                        {(m.user || 'A').substring(0, 1).toUpperCase()}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Bouton d'action */}
                                            <td className="py-3 px-3.5 text-center">
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedMovement(m);
                                                    }}
                                                    className="p-1 rounded-sm hover:bg-gray-200 text-gray-500 hover:text-[#001d35] transition-colors cursor-pointer"
                                                    title="Voir la fiche d'audit complète"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* ── BARRE DE RÉSUMÉ / FOOTER DU TABLEAU ── */}
                <div className="px-4 py-3 bg-gray-50 border-t-2 border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-semibold text-gray-600">
                    <div>
                        Affichage de <span className="font-bold text-[#001d35]">{filteredMovements.length}</span> sur <span className="font-bold text-[#001d35]">{allMovements.length}</span> mouvements enregistrés
                    </div>
                    <div className="flex items-center gap-4 text-[11px]">
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                            <span>Entrées: {allMovements.filter(m => m.type === 'IN').length}</span>
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                            <span>Sorties: {allMovements.filter(m => m.type === 'OUT').length}</span>
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-amber-600"></span>
                            <span>Ajustements: {allMovements.filter(m => m.type === 'ADJUST' || m.type === 'ADJUSTMENT').length}</span>
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                            <span>Transferts: {allMovements.filter(m => m.type === 'TRANSFER').length}</span>
                        </span>
                    </div>
                </div>
            </div>

            {/* ── MODALE 1 : NOUVEL AJUSTEMENT DE STOCK ── */}
            {isAdjustmentModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-lg rounded-sm shadow-2xl border-t-4 border-[#001d35] overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Header Modale */}
                        <div className="p-5 border-b-2 border-gray-300 flex justify-between items-center bg-slate-50/50 flex-shrink-0">
                            <div>
                                <h3 className="text-lg font-bold text-[#001d35] uppercase tracking-tight flex items-center gap-2">
                                    <Wrench className="w-5 h-5 text-[#001d35]" />
                                    Nouvel Ajustement de Stock
                                </h3>
                                <p className="text-gray-500 text-xs mt-1 font-medium">Correction manuelle d'inventaire, perte ou casse</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsAdjustmentModalOpen(false)}
                                className="p-1.5 hover:bg-slate-100 rounded-sm text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Corps Modale */}
                        <form onSubmit={handleCreateAdjustment} className="p-5 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
                            {/* Choix Boutique & Article */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[11px] font-bold text-blue-600/70 uppercase tracking-widest mb-1.5">
                                        Boutique concernée
                                    </label>
                                    <select
                                        value={adjStoreId}
                                        onChange={(e) => setAdjStoreId(e.target.value)}
                                        className="w-full px-3 py-2 bg-white border-2 border-gray-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-[#001d35] text-xs font-semibold text-gray-800"
                                    >
                                        {stores.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-blue-600/70 uppercase tracking-widest mb-1.5">
                                        Sens de l'ajustement
                                    </label>
                                    <div className="grid grid-cols-2 gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => setAdjType('DECREASE')}
                                            className={`py-2 text-xs font-bold uppercase tracking-wider rounded-sm border-2 transition-all cursor-pointer ${
                                                adjType === 'DECREASE'
                                                    ? 'bg-rose-50 border-rose-300 text-rose-800 shadow-sm'
                                                    : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                                            }`}
                                        >
                                            Déduction (-)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setAdjType('INCREASE')}
                                            className={`py-2 text-xs font-bold uppercase tracking-wider rounded-sm border-2 transition-all cursor-pointer ${
                                                adjType === 'INCREASE'
                                                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-sm'
                                                    : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                                            }`}
                                        >
                                            Ajout (+)
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Sélection Produit */}
                            <div>
                                <label className="block text-[11px] font-bold text-blue-600/70 uppercase tracking-widest mb-1.5">
                                    Sélectionner le Produit
                                </label>
                                <select
                                    value={adjProductId}
                                    onChange={(e) => setAdjProductId(e.target.value)}
                                    className="w-full px-3 py-2 bg-white border-2 border-gray-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-[#001d35] text-xs font-semibold text-gray-800"
                                    required
                                >
                                    <option value="">-- Choisir un produit --</option>
                                    {products.map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.name.toUpperCase()} (Réf: {p.barcode || p.id})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Carte Prévisionnelle d'Impact de Stock */}
                            {selectedAdjProduct && (
                                <div className="p-3 bg-gray-50 rounded-sm border-2 border-gray-200 grid grid-cols-3 gap-2 text-center">
                                    <div className="p-2 bg-white rounded-sm border border-gray-200">
                                        <span className="block text-[10px] font-bold text-gray-400 uppercase">Stock Actuel</span>
                                        <span className="text-sm font-semibold text-gray-800">{currentAdjStock} {selectedAdjProduct.unit}</span>
                                    </div>
                                    <div className={`p-2 rounded-sm border ${
                                        adjType === 'INCREASE' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
                                    }`}>
                                        <span className="block text-[10px] font-bold uppercase">Variation</span>
                                        <span className="text-sm font-semibold">
                                            {adjType === 'INCREASE' ? '+' : '-'}{adjQty || '0'} {selectedAdjProduct.unit}
                                        </span>
                                    </div>
                                    <div className="p-2 bg-white rounded-sm border border-gray-200">
                                        <span className="block text-[10px] font-bold text-gray-400 uppercase">Nouveau Solde</span>
                                        <span className="text-sm font-semibold text-[#001d35]">{projectedAdjStock} {selectedAdjProduct.unit}</span>
                                    </div>
                                </div>
                            )}

                            {/* Quantité & Motif */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[11px] font-bold text-blue-600/70 uppercase tracking-widest mb-1.5">
                                        Quantité (+/-)
                                    </label>
                                    <input
                                        type="number"
                                        step="any"
                                        min="0.01"
                                        placeholder="Ex: 5"
                                        value={adjQty}
                                        onChange={(e) => setAdjQty(e.target.value)}
                                        className="w-full px-3 py-2 bg-white border-2 border-gray-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-[#001d35] text-xs font-semibold text-gray-800"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-blue-600/70 uppercase tracking-widest mb-1.5">
                                        Motif
                                    </label>
                                    <select
                                        value={adjReason}
                                        onChange={(e) => setAdjReason(e.target.value)}
                                        className="w-full px-3 py-2 bg-white border-2 border-gray-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-[#001d35] text-xs font-semibold text-gray-800"
                                    >
                                        <option value="CORRECTION">Correction d'inventaire</option>
                                        <option value="DAMAGE">Casse / Dommage</option>
                                        <option value="LOSS">Perte / Vol</option>
                                        <option value="EXPIRATION">Péremption</option>
                                        <option value="GIFT">Don / Échantillon</option>
                                        <option value="OTHER">Autre régularisation</option>
                                    </select>
                                </div>
                            </div>

                            {/* Observations */}
                            <div>
                                <label className="block text-[11px] font-bold text-blue-600/70 uppercase tracking-widest mb-1.5">
                                    Détails ou Observations supplémentaires
                                </label>
                                <textarea
                                    rows="2"
                                    placeholder="Expliquez la raison de cet ajustement..."
                                    value={adjNotes}
                                    onChange={(e) => setAdjNotes(e.target.value)}
                                    className="w-full px-3 py-2 bg-white border-2 border-gray-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-[#001d35] text-xs text-gray-800 resize-none font-medium"
                                ></textarea>
                            </div>

                            {/* Footer Modale */}
                            <div className="p-4 bg-slate-50 border-t-2 border-gray-300 flex justify-end gap-2 flex-shrink-0 -mx-5 -mb-5 mt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsAdjustmentModalOpen(false)}
                                    className="px-4 py-2 border-2 border-gray-300 rounded-sm text-xs font-bold uppercase tracking-wider text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 bg-[#001d35] hover:bg-[#002d52] text-white font-bold uppercase tracking-wider text-xs rounded-sm cursor-pointer transition-colors shadow-sm"
                                >
                                    Valider l'ajustement
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── MODALE 2 : TRANSFERT INTER-MAGASINS ── */}
            {isTransferModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-lg rounded-sm shadow-2xl border-t-4 border-[#001d35] overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Header Modale */}
                        <div className="p-5 border-b-2 border-gray-300 flex justify-between items-center bg-slate-50/50 flex-shrink-0">
                            <div>
                                <h3 className="text-lg font-bold text-[#001d35] uppercase tracking-tight flex items-center gap-2">
                                    <ArrowLeftRight className="w-5 h-5 text-[#001d35]" />
                                    Transférer du Stock
                                </h3>
                                <p className="text-gray-500 text-xs mt-1 font-medium">Déplacement de marchandise entre boutiques</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsTransferModalOpen(false)}
                                className="p-1.5 hover:bg-slate-100 rounded-sm text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Corps Modale */}
                        <form onSubmit={handleCreateTransfer} className="p-5 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
                            {/* Sélection Article */}
                            <div>
                                <label className="block text-[11px] font-bold text-blue-600/70 uppercase tracking-widest mb-1.5">
                                    Produit à Transférer
                                </label>
                                <select
                                    value={trfProductId}
                                    onChange={(e) => setTrfProductId(e.target.value)}
                                    className="w-full px-3 py-2 bg-white border-2 border-gray-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-[#001d35] text-xs font-semibold text-gray-800"
                                    required
                                >
                                    <option value="">-- Choisir un produit --</option>
                                    {products.map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.name.toUpperCase()} (Réf: {p.barcode || p.id})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Dépôt Source vs Dépôt Destination */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[11px] font-bold text-blue-600/70 uppercase tracking-widest mb-1.5">
                                        Depuis (Source)
                                    </label>
                                    <select
                                        value={trfSourceStore}
                                        onChange={(e) => setTrfSourceStore(e.target.value)}
                                        className="w-full px-3 py-2 bg-red-50 border-2 border-red-200 rounded-sm focus:outline-none focus:ring-1 focus:ring-red-600 font-bold text-xs text-red-700"
                                    >
                                        {stores.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                    {selectedTrfProduct && (
                                        <p className="text-[10px] text-gray-500 mt-1 font-medium">
                                            Disponible: <span className="font-bold text-gray-800">{currentTrfSrcStock} {selectedTrfProduct.unit}</span>
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-blue-600/70 uppercase tracking-widest mb-1.5">
                                        Vers (Destination)
                                    </label>
                                    <select
                                        value={trfTargetStore}
                                        onChange={(e) => setTrfTargetStore(e.target.value)}
                                        className="w-full px-3 py-2 bg-emerald-50 border-2 border-emerald-200 rounded-sm focus:outline-none focus:ring-1 focus:ring-emerald-600 font-bold text-xs text-emerald-700"
                                        required
                                    >
                                        <option value="">-- Choisir destination --</option>
                                        {stores.filter(s => String(s.id) !== String(trfSourceStore)).map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Quantité & Motif */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[11px] font-bold text-blue-600/70 uppercase tracking-widest mb-1.5">
                                        Quantité à déplacer
                                    </label>
                                    <input
                                        type="number"
                                        step="any"
                                        min="0.01"
                                        placeholder="Ex: 50"
                                        value={trfQty}
                                        onChange={(e) => setTrfQty(e.target.value)}
                                        className="w-full px-3 py-2 bg-white border-2 border-gray-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-[#001d35] font-semibold text-xs text-gray-800"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-blue-600/70 uppercase tracking-widest mb-1.5">
                                        Motif
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Ex: Réassort chantier"
                                        value={trfReason}
                                        onChange={(e) => setTrfReason(e.target.value)}
                                        className="w-full px-3 py-2 bg-white border-2 border-gray-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-[#001d35] text-xs font-semibold text-gray-800"
                                    />
                                </div>
                            </div>

                            {/* Notes d'expédition */}
                            <div>
                                <label className="block text-[11px] font-bold text-blue-600/70 uppercase tracking-widest mb-1.5">
                                    Détails ou Observations
                                </label>
                                <textarea
                                    rows="2"
                                    placeholder="Ex: Camionnette TG-4421, chauffeur Koffi..."
                                    value={trfNotes}
                                    onChange={(e) => setTrfNotes(e.target.value)}
                                    className="w-full px-3 py-2 bg-white border-2 border-gray-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-[#001d35] text-xs text-gray-800 resize-none font-medium"
                                ></textarea>
                            </div>

                            {/* Footer Modale */}
                            <div className="p-4 bg-slate-50 border-t-2 border-gray-300 flex justify-end gap-2 flex-shrink-0 -mx-5 -mb-5 mt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsTransferModalOpen(false)}
                                    className="px-4 py-2 border-2 border-gray-300 rounded-sm text-xs font-bold uppercase tracking-wider text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 bg-[#001d35] hover:bg-[#002d52] text-white font-bold uppercase tracking-wider text-xs rounded-sm cursor-pointer transition-colors shadow-sm"
                                >
                                    Confirmer le Transfert
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── MODALE 3 : FICHE D'INSPECTION & DÉTAILS D'UN MOUVEMENT ── */}
            {selectedMovement && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-lg rounded-sm shadow-2xl border-t-4 border-[#001d35] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="p-5 border-b-2 border-gray-300 flex justify-between items-center bg-slate-50/50 flex-shrink-0">
                            <div>
                                <h3 className="text-lg font-bold text-[#001d35] uppercase tracking-tight flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-[#001d35]" />
                                    Piste d'Audit & Détails du Mouvement
                                </h3>
                                <p className="text-gray-500 text-xs mt-1 font-medium">Identifiant unique: #{selectedMovement.id}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedMovement(null)}
                                className="p-1.5 hover:bg-slate-100 rounded-sm text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Contenu */}
                        <div className="p-5 space-y-3.5 text-xs font-sans">
                            <div className="grid grid-cols-2 gap-2 bg-gray-50 p-3 rounded-sm border-2 border-gray-200">
                                <div>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Horodatage précis</span>
                                    <span className="font-semibold text-gray-800 text-[12px]">{formatDate(selectedMovement.date)}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Type d'opération</span>
                                    <div className="mt-0.5">{getTypeBadge(selectedMovement.type)}</div>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <span className="text-[10px] font-bold text-gray-400 uppercase block">Article</span>
                                <p className="font-bold text-sm text-[#001d35] uppercase">{selectedMovement.productName}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div className="bg-gray-50 p-2.5 rounded-sm border-2 border-gray-200">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Quantité / Delta</span>
                                    <span className="text-sm font-bold text-gray-900">
                                        {selectedMovement.quantity > 0 ? `+${selectedMovement.quantity}` : selectedMovement.quantity} {selectedMovement.unit}
                                    </span>
                                </div>
                                <div className="bg-gray-50 p-2.5 rounded-sm border-2 border-gray-200">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Dépôt / Magasin</span>
                                    <span className="text-xs font-semibold text-[#001d35]">
                                        {selectedMovement.storeName}
                                        {selectedMovement.targetStoreName ? ` → ${selectedMovement.targetStoreName}` : ''}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <span className="text-[10px] font-bold text-gray-400 uppercase block">Motif principal</span>
                                <p className="font-medium text-gray-800 bg-gray-50 p-2.5 rounded-sm border-2 border-gray-200">
                                    {selectedMovement.reason}
                                </p>
                            </div>

                            {selectedMovement.details && (
                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Observations & Pièce justificative</span>
                                    <p className="text-gray-700 bg-gray-50 p-2.5 rounded-sm border-2 border-gray-200">
                                        {selectedMovement.details}
                                    </p>
                                </div>
                            )}

                            <div className="flex items-center justify-between pt-2 border-t border-gray-200 text-gray-500">
                                <span>Opérateur signataire :</span>
                                <span className="font-bold text-gray-800 uppercase">{selectedMovement.user}</span>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 bg-slate-50 border-t-2 border-gray-300 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setSelectedMovement(null)}
                                className="px-5 py-2 bg-[#001d35] text-white font-bold uppercase tracking-wider text-xs rounded-sm hover:bg-[#002d52] transition-colors cursor-pointer"
                            >
                                Fermer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Movements;
