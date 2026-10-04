import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { useInventory } from '../../context/InventoryContext';
import { useAuth } from '../../context/AuthContext';
import { formatPrice } from '../../utils/currency';
import T from '../../utils/toast';
import {
    ClipboardCheck,
    Plus,
    Search,
    Filter,
    Play,
    CheckCircle2,
    AlertTriangle,
    ShieldAlert,
    ShieldCheck,
    ArrowRight,
    Printer,
    FileText,
    Download,
    Eye,
    EyeOff,
    RotateCcw,
    Clock,
    Calendar,
    Store as StoreIcon,
    User,
    Layers,
    BarChart3,
    ChevronRight,
    X,
    Sparkles,
    Check,
    Hash,
    Tag,
    Save,
    CheckSquare,
    Package,
    ArrowLeft,
    TrendingDown,
    Boxes
} from 'lucide-react';

// ── Utilitaires de formatage de date ──
const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
        return new Intl.DateTimeFormat('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }).format(new Date(dateStr));
    } catch {
        return dateStr;
    }
};

const formatDateTime = (dateStr) => {
    if (!dateStr) return 'Aucun';
    try {
        const d = new Date(dateStr);
        const datePart = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const timePart = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        return `${datePart} à ${timePart}`;
    } catch {
        return dateStr;
    }
};

const InventoryCheck = () => {
    const { stores, currentStoreId } = useSettings();
    const { products, categories, recordAdjustment } = useInventory();
    const { user } = useAuth();

    const storeKey = currentStoreId ? String(currentStoreId) : '1';

    // ── Clé de stockage cloisonnée par boutique ──
    const storageKey = `kabllix_inventory_sessions_${storeKey}`;

    // ── Sessions initiales de démonstration réalistes ──
    const defaultSessions = useMemo(() => [
        {
            id: 'sess-003',
            code: 'INV-2026-003',
            name: 'Inventaire Tournant - Électricité & Quincaillerie',
            type: 'CYCLIC',
            storeId: storeKey,
            storeName: stores.find(s => String(s.id) === storeKey)?.name || 'Boutique Principale',
            status: 'IN_PROGRESS',
            dateCreated: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
            dateClosed: null,
            supervisor: 'Jean Dupont',
            closedBy: null,
            scopeCategories: ['cat-2'],
            blindCount: false,
            totalItems: 6,
            countedItems: 4,
            discrepancyCount: 1,
            netFinancialImpact: -5000,
            items: []
        },
        {
            id: 'sess-001',
            code: 'INV-2026-001',
            name: 'Inventaire Tournant - Construction & Gros Œuvre',
            type: 'CYCLIC', // CYCLIC, ANNUAL, SPOT
            storeId: storeKey,
            storeName: stores.find(s => String(s.id) === storeKey)?.name || 'Boutique Principale',
            status: 'COMPLETED', // DRAFT, IN_PROGRESS, COMPLETED
            dateCreated: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
            dateClosed: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3 + 1000 * 60 * 90).toISOString(),
            supervisor: 'Jean Dupont',
            closedBy: 'Marc Lawson',
            scopeCategories: ['cat-1'],
            blindCount: false,
            totalItems: 8,
            countedItems: 8,
            discrepancyCount: 2,
            netFinancialImpact: -38500, // Perte nette en FCFA
            items: []
        },
        {
            id: 'sess-002',
            code: 'INV-2026-002',
            name: 'Contrôle Inopiné - Outillage Électroportatif',
            type: 'SPOT',
            storeId: storeKey,
            storeName: stores.find(s => String(s.id) === storeKey)?.name || 'Boutique Principale',
            status: 'COMPLETED',
            dateCreated: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
            dateClosed: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7 + 1000 * 60 * 45).toISOString(),
            supervisor: 'Alice Koffi',
            closedBy: 'Alice Koffi',
            scopeCategories: ['cat-5'],
            blindCount: true,
            totalItems: 5,
            countedItems: 5,
            discrepancyCount: 1,
            netFinancialImpact: -15000,
            items: []
        }
    ], [storeKey, stores]);

    // ── État des Sessions ──
    const [sessions, setSessions] = useState(() => {
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
        } catch (e) {
            console.error('Erreur lecture sessions inventaire:', e);
        }
        return defaultSessions;
    });

    // Sauvegarde automatique des sessions
    useEffect(() => {
        try {
            localStorage.setItem(storageKey, JSON.stringify(sessions));
        } catch (e) {
            console.error('Erreur sauvegarde sessions inventaire:', e);
        }
    }, [sessions, storageKey]);

    // ── Session Active en cours de comptage (null = vue liste) ──
    const [activeSession, setActiveSession] = useState(null);

    // ── Loader de 1.5 seconde sur les filtres (Identique à Réapprovisionnement Intelligent) ──
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


    // ── Filtres de la vue Liste ──
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('IN_PROGRESS'); // IN_PROGRESS | ALL | COMPLETED

    // ── Badges vus / consultés cloisonnés par boutique ──
    const seenCompletedKey = `kabllix_inventory_seen_completed_${storeKey}`;
    const seenInProgressKey = `kabllix_inventory_seen_in_progress_${storeKey}`;
    const seenAllKey = `kabllix_inventory_seen_all_${storeKey}`;

    const [seenCompletedIds, setSeenCompletedIds] = useState(() => {
        try {
            const saved = localStorage.getItem(seenCompletedKey);
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });

    const [seenInProgressIds, setSeenInProgressIds] = useState(() => {
        try {
            const saved = localStorage.getItem(seenInProgressKey);
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });

    const [seenAllIds, setSeenAllIds] = useState(() => {
        try {
            const saved = localStorage.getItem(seenAllKey);
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });

    const markTabAsSeen = (tabKey) => {
        if (tabKey === 'COMPLETED') {
            const completedIds = sessions.filter(s => s.status === 'COMPLETED').map(s => s.id);
            setSeenCompletedIds(prev => {
                const next = Array.from(new Set([...prev, ...completedIds]));
                try { localStorage.setItem(seenCompletedKey, JSON.stringify(next)); } catch {}
                return next;
            });
        } else if (tabKey === 'IN_PROGRESS') {
            const inProgressIds = sessions.filter(s => s.status === 'IN_PROGRESS').map(s => s.id);
            setSeenInProgressIds(prev => {
                const next = Array.from(new Set([...prev, ...inProgressIds]));
                try { localStorage.setItem(seenInProgressKey, JSON.stringify(next)); } catch {}
                return next;
            });
        } else if (tabKey === 'ALL') {
            const allIds = sessions.map(s => s.id);
            setSeenAllIds(prev => {
                const next = Array.from(new Set([...prev, ...allIds]));
                try { localStorage.setItem(seenAllKey, JSON.stringify(next)); } catch {}
                return next;
            });
        }
    };

    const handleTabClick = (tabKey) => {
        markTabAsSeen(tabKey);
        handleFilterChange(setStatusFilter, tabKey);
    };

    // Au montage, marquer l'onglet initialement affiché comme vu
    useEffect(() => {
        markTabAsSeen(statusFilter);
    }, [storeKey]);

    const [period, setPeriod] = useState('today'); // 'today' par défaut (Aujourd'hui)
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [storeFilter, setStoreFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState('all');

    // ── Filtrage de Période (Harmonisé avec Mouvements & Dashboard) ──
    const isWithinPeriod = (dateStr, periodKey, startCustom, endCustom) => {
        if (!dateStr) return false;
        if (periodKey === 'all') return true;

        const d = new Date(dateStr);
        const now = new Date();

        if (periodKey === 'today') {
            return d.getFullYear() === now.getFullYear() &&
                d.getMonth() === now.getMonth() &&
                d.getDate() === now.getDate();
        }

        if (periodKey === '7days') {
            const diffMs = now.getTime() - d.getTime();
            return diffMs <= (7 * 24 * 60 * 60 * 1000) && diffMs >= -(60 * 60 * 1000);
        }

        if (periodKey === 'month') {
            return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
        }

        if (periodKey === 'custom') {
            if (!startCustom && !endCustom) return true;
            if (startCustom) {
                const s = new Date(startCustom + 'T00:00:00');
                if (d < s) return false;
            }
            if (endCustom) {
                const e = new Date(endCustom + 'T23:59:59.999');
                if (d > e) return false;
            }
            return true;
        }

        return true;
    };

    const periodLabel = useMemo(() => {
        switch (period) {
            case 'today': return "Aujourd'hui";
            case '7days': return "7 derniers jours";
            case 'month': return "Ce mois";
            case 'custom':
                if (customStartDate && customEndDate) return `Du ${formatDate(customStartDate)} au ${formatDate(customEndDate)}`;
                if (customStartDate) return `À partir du ${formatDate(customStartDate)}`;
                if (customEndDate) return `Jusqu'au ${formatDate(customEndDate)}`;
                return "Personnalisée";
            case 'all':
            default:
                return "Historique complet";
        }
    }, [period, customStartDate, customEndDate]);

    // ── Utilisateur connecté courant ──
    const currentUserName = useMemo(() => {
        if (!user) return 'Admin';
        const full = `${user.firstName || ''} ${user.lastName || user.username || ''}`.trim();
        return full || user.username || 'Admin';
    }, [user]);

    // ── Modale Nouvelle Session ──
    const [isNewModalOpen, setIsNewModalOpen] = useState(false);
    const [newSessionData, setNewSessionData] = useState({
        name: '',
        type: 'CYCLIC',
        storeId: storeKey,
        supervisor: '',
        scopeType: 'ALL',
        selectedCategories: ['cat-1'],
        blindCount: false,
        notes: ''
    });

    // Synchroniser le superviseur par défaut dès que le compte utilisateur est chargé
    useEffect(() => {
        if (currentUserName) {
            setNewSessionData(prev => ({
                ...prev,
                supervisor: prev.supervisor || currentUserName
            }));
        }
    }, [currentUserName]);

    // ── Mode de comptage de la session active ──
    const [activeSearch, setActiveSearch] = useState('');
    const [filterDiscrepanciesOnly, setFilterDiscrepanciesOnly] = useState(false);
    const [isBlindModeActive, setIsBlindModeActive] = useState(false);
    const [scanBarcode, setScanBarcode] = useState('');
    const scanInputRef = useRef(null);

    // ── Modale Récapitulatif / Clôture ──
    const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);

    // ── Calcul des métriques globales (StatCards du Dashboard) ──
    const metrics = useMemo(() => {
        const totalCatalogItems = products.length;
        const totalCatalogValue = products.reduce((sum, p) => {
            const stock = p.stockLevels?.[storeKey] !== undefined ? Number(p.stockLevels[storeKey]) : Number(p.stock || 0);
            const price = Number(p.purchasePrice || p.price || 0);
            return sum + (stock * price);
        }, 0);

        // Sessions filtrées par période pour le calcul de l'audit
        const sessionsInPeriod = sessions.filter(s => {
            const sDate = s.dateClosed || s.dateCreated;
            return isWithinPeriod(sDate, period, customStartDate, customEndDate);
        });

        const completedSessions = sessionsInPeriod.filter(s => s.status === 'COMPLETED');
        const sortedCompleted = [...completedSessions].sort((a, b) => new Date(b.dateClosed || b.dateCreated) - new Date(a.dateClosed || a.dateCreated));
        const lastCompletedSession = sortedCompleted[0] || null;
        const lastSessionDate = lastCompletedSession ? (lastCompletedSession.dateClosed || lastCompletedSession.dateCreated) : null;
        let totalItemsInCompleted = 0;
        let totalDiscrepanciesInCompleted = 0;
        let totalNetFinancialImpact = 0;

        completedSessions.forEach(s => {
            totalItemsInCompleted += (s.totalItems || 0);
            totalDiscrepanciesInCompleted += (s.discrepancyCount || 0);
            totalNetFinancialImpact += (s.netFinancialImpact || 0);
        });

        const conformityRate = totalItemsInCompleted > 0
            ? Math.round(((totalItemsInCompleted - totalDiscrepanciesInCompleted) / totalItemsInCompleted) * 100)
            : 100;

        return {
            totalCatalogItems,
            totalCatalogValue,
            lastSessionDate,
            conformityRate,
            totalNetFinancialImpact,
            completedSessionsCount: completedSessions.length
        };
    }, [products, sessions, storeKey, period, customStartDate, customEndDate]);

    // ── Compteurs de sessions par statut dans la période ──
    const activeSessionsCount = useMemo(() => {
        return sessions.filter(s => s.status === 'IN_PROGRESS' && isWithinPeriod(s.dateClosed || s.dateCreated, period, customStartDate, customEndDate)).length;
    }, [sessions, period, customStartDate, customEndDate]);

    const allSessionsInPeriodCount = useMemo(() => {
        return sessions.filter(s => isWithinPeriod(s.dateClosed || s.dateCreated, period, customStartDate, customEndDate)).length;
    }, [sessions, period, customStartDate, customEndDate]);

    const completedSessionsCount = useMemo(() => {
        return sessions.filter(s => s.status === 'COMPLETED' && isWithinPeriod(s.dateClosed || s.dateCreated, period, customStartDate, customEndDate)).length;
    }, [sessions, period, customStartDate, customEndDate]);

    // ── Badges de notification dynamiques (disparaissent dès consultation de l'onglet) ──
    const unseenActiveCount = useMemo(() => {
        if (statusFilter === 'IN_PROGRESS') return 0;
        return sessions.filter(s =>
            s.status === 'IN_PROGRESS' &&
            !seenInProgressIds.includes(s.id) &&
            isWithinPeriod(s.dateClosed || s.dateCreated, period, customStartDate, customEndDate)
        ).length;
    }, [sessions, seenInProgressIds, statusFilter, period, customStartDate, customEndDate]);

    const unseenAllCount = useMemo(() => {
        if (statusFilter === 'ALL') return 0;
        return sessions.filter(s =>
            !seenAllIds.includes(s.id) &&
            isWithinPeriod(s.dateClosed || s.dateCreated, period, customStartDate, customEndDate)
        ).length;
    }, [sessions, seenAllIds, statusFilter, period, customStartDate, customEndDate]);

    const unseenCompletedCount = useMemo(() => {
        if (statusFilter === 'COMPLETED') return 0;
        return sessions.filter(s =>
            s.status === 'COMPLETED' &&
            !seenCompletedIds.includes(s.id) &&
            isWithinPeriod(s.dateClosed || s.dateCreated, period, customStartDate, customEndDate)
        ).length;
    }, [sessions, seenCompletedIds, statusFilter, period, customStartDate, customEndDate]);

    // ── Sessions Filtrées ──
    const filteredSessions = useMemo(() => {
        return sessions.filter(s => {
            if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;

            // Filtre dépôt / boutique
            if (storeFilter !== 'all' && String(s.storeId) !== String(storeFilter)) return false;

            // Filtre type d'inventaire
            if (typeFilter !== 'all' && s.type !== typeFilter) return false;

            // Filtre par période temporelle
            const sDate = s.dateClosed || s.dateCreated;
            if (!isWithinPeriod(sDate, period, customStartDate, customEndDate)) return false;

            if (searchTerm.trim()) {
                const q = searchTerm.toLowerCase();
                const matchName = (s.name || '').toLowerCase().includes(q);
                const matchCode = (s.code || '').toLowerCase().includes(q);
                const matchSuper = (s.supervisor || '').toLowerCase().includes(q);
                const matchClosed = (s.closedBy || '').toLowerCase().includes(q);
                const matchStore = (s.storeName || '').toLowerCase().includes(q);
                if (!matchName && !matchCode && !matchSuper && !matchClosed && !matchStore) return false;
            }
            return true;
        });
    }, [sessions, statusFilter, storeFilter, typeFilter, period, customStartDate, customEndDate, searchTerm]);

    // ── Initialiser ou générer les articles d'une session ──
    const buildSessionItems = (scopeType, selectedCategoryIds, targetStore) => {
        let candidateProducts = products;
        if (scopeType === 'CATEGORY' && selectedCategoryIds.length > 0) {
            candidateProducts = products.filter(p => selectedCategoryIds.includes(p.category));
        }

        return candidateProducts.map(p => {
            const theoretical = p.stockLevels?.[targetStore] !== undefined
                ? Number(p.stockLevels[targetStore])
                : (p.stockLevels?.[currentStoreId] !== undefined
                    ? Number(p.stockLevels[currentStoreId])
                    : Number(p.stock || 0));

            return {
                productId: p.id,
                name: p.name,
                barcode: p.barcode || p.id,
                category: p.category,
                unit: p.unit || 'Unités',
                purchasePrice: Number(p.purchasePrice || p.price || 0),
                theoreticalStock: theoretical,
                countedStock: '', // Saisie utilisateur
                discrepancyQty: 0,
                discrepancyValue: 0,
                reason: 'CORRECTION', // CORRECTION, DAMAGE, LOSS, THEFT, OTHER
                notes: '',
                isCounted: false
            };
        });
    };

    // ── Créer une nouvelle session ──
    const handleCreateSession = (e) => {
        e.preventDefault();
        const code = `INV-${new Date().getFullYear()}-${String(sessions.length + 1).padStart(3, '0')}`;
        const targetStore = newSessionData.storeId;
        const storeObj = stores.find(s => String(s.id) === String(targetStore));

        const sessionItems = buildSessionItems(
            newSessionData.scopeType,
            newSessionData.selectedCategories,
            targetStore
        );

        if (sessionItems.length === 0) {
            T.error("Aucun article ne correspond au périmètre sélectionné.");
            return;
        }

        const newSession = {
            id: `sess-${Date.now()}`,
            code,
            name: newSessionData.name || `Session ${code}`,
            type: newSessionData.type,
            storeId: targetStore,
            storeName: storeObj ? storeObj.name : `Dépôt #${targetStore}`,
            status: 'IN_PROGRESS',
            dateCreated: new Date().toISOString(),
            dateClosed: null,
            supervisor: newSessionData.supervisor?.trim() || currentUserName,
            closedBy: null,
            scopeCategories: newSessionData.scopeType === 'CATEGORY' ? newSessionData.selectedCategories : [],
            blindCount: newSessionData.blindCount,
            totalItems: sessionItems.length,
            countedItems: 0,
            discrepancyCount: 0,
            netFinancialImpact: 0,
            items: sessionItems
        };

        setIsNewModalOpen(false);
        setActionLoading("Initialisation de l'inventaire et préparation de la feuille de pointage...");

        setTimeout(() => {
            setSessions(prev => [newSession, ...prev]);
            // Réinitialiser la notification sur cet id pour afficher le badge d'attention
            setSeenInProgressIds(prev => {
                const next = prev.filter(id => id !== newSession.id);
                try { localStorage.setItem(seenInProgressKey, JSON.stringify(next)); } catch {}
                return next;
            });
            setSeenAllIds(prev => {
                const next = prev.filter(id => id !== newSession.id);
                try { localStorage.setItem(seenAllKey, JSON.stringify(next)); } catch {}
                return next;
            });
            setActiveSession(newSession);
            setIsBlindModeActive(newSessionData.blindCount);
            setActionLoading(null);
            T.success(`Session ${code} créée avec ${sessionItems.length} article(s) à inventorier !`);
        }, 1500);
    };

    // ── Reprendre une session ──
    const handleOpenSession = (session) => {
        if (session.status === 'COMPLETED') {
            setSeenCompletedIds(prev => {
                const next = Array.from(new Set([...prev, session.id]));
                try { localStorage.setItem(seenCompletedKey, JSON.stringify(next)); } catch {}
                return next;
            });
        } else if (session.status === 'IN_PROGRESS') {
            setSeenInProgressIds(prev => {
                const next = Array.from(new Set([...prev, session.id]));
                try { localStorage.setItem(seenInProgressKey, JSON.stringify(next)); } catch {}
                return next;
            });
        }
        if (!session.items || session.items.length === 0) {
            const items = buildSessionItems(
                session.scopeCategories?.length > 0 ? 'CATEGORY' : 'ALL',
                session.scopeCategories || [],
                session.storeId
            );
            const enriched = { ...session, items };
            setActiveSession(enriched);
        } else {
            setActiveSession(session);
        }
        setIsBlindModeActive(session.blindCount || false);
    };

    // ── Mise à jour de la saisie d'un article ──
    const handleCountChange = (productId, value) => {
        if (!activeSession) return;

        setActiveSession(prev => {
            const updatedItems = prev.items.map(item => {
                if (item.productId !== productId) return item;

                if (value === '') {
                    return {
                        ...item,
                        countedStock: '',
                        discrepancyQty: 0,
                        discrepancyValue: 0,
                        isCounted: false
                    };
                }

                const countedNum = parseFloat(value);
                const isNumeric = !isNaN(countedNum);
                const validCount = isNumeric ? Math.max(0, countedNum) : 0;
                const delta = validCount - item.theoreticalStock;
                const discValue = delta * item.purchasePrice;

                return {
                    ...item,
                    countedStock: value,
                    discrepancyQty: delta,
                    discrepancyValue: discValue,
                    isCounted: true
                };
            });

            // Re-calcul des métriques de la session active
            const countedCount = updatedItems.filter(i => i.isCounted).length;
            const discrepancies = updatedItems.filter(i => i.isCounted && i.discrepancyQty !== 0);
            const netImpact = discrepancies.reduce((sum, i) => sum + i.discrepancyValue, 0);

            return {
                ...prev,
                items: updatedItems,
                countedItems: countedCount,
                discrepancyCount: discrepancies.length,
                netFinancialImpact: netImpact
            };
        });
    };

    // ── Motif d'écart d'un article ──
    const handleReasonChange = (productId, reason) => {
        if (!activeSession) return;
        setActiveSession(prev => ({
            ...prev,
            items: prev.items.map(i => i.productId === productId ? { ...i, reason } : i)
        }));
    };

    // ── Scanner de code-barres / recherche rapide ──
    const handleScanSubmit = (e) => {
        e.preventDefault();
        if (!scanBarcode.trim() || !activeSession) return;

        const query = scanBarcode.toLowerCase().trim();
        const foundItem = activeSession.items.find(i =>
            (i.barcode && i.barcode.toLowerCase() === query) ||
            i.name.toLowerCase().includes(query)
        );

        if (foundItem) {
            const currentCount = parseFloat(foundItem.countedStock) || 0;
            const newCount = currentCount + 1;
            handleCountChange(foundItem.productId, String(newCount));
            T.success(`+1 compté pour ${foundItem.name} (Total: ${newCount})`);
            setScanBarcode('');
        } else {
            T.error("Aucun article correspondant dans le périmètre de cet inventaire.");
        }
    };

    // ── Sauvegarde Brouillon ──
    const handleSaveDraft = () => {
        if (!activeSession) return;
        setSessions(prev => prev.map(s => s.id === activeSession.id ? activeSession : s));
        T.success("Brouillon de comptage sauvegardé !");
    };

    // ── Clôture et Régularisation du Stock ──
    const handleConfirmCloseSession = () => {
        if (!activeSession) return;

        const uncountedCount = activeSession.items.length - activeSession.countedItems;
        if (uncountedCount > 0) {
            const ok = window.confirm(`Attention : ${uncountedCount} article(s) n'ont pas été comptés. Voulez-vous tout de même clôturer l'inventaire ?`);
            if (!ok) return;
        }

        setIsClosingModalOpen(false);
        setActionLoading("Régularisation des stocks réels, écriture dans le Grand Livre et archivage...");

        setTimeout(() => {
            try {
                // Appliquer les régularisations dans InventoryContext
                let adjustedCount = 0;
                activeSession.items.forEach(item => {
                    if (item.isCounted && item.discrepancyQty !== 0) {
                        const reasonLabels = {
                            CORRECTION: `Inventaire ${activeSession.code} (Écart régularisé)`,
                            DAMAGE: `Inventaire ${activeSession.code} (Casse / Avarie)`,
                            LOSS: `Inventaire ${activeSession.code} (Perte inexpliquée)`,
                            THEFT: `Inventaire ${activeSession.code} (Vol présumé)`,
                            OTHER: `Inventaire ${activeSession.code} (Autre régularisation)`
                        };

                        if (recordAdjustment) {
                            recordAdjustment(
                                item.productId,
                                item.discrepancyQty,
                                reasonLabels[item.reason] || `Inventaire ${activeSession.code}`,
                                item.notes || `Stock avant: ${item.theoreticalStock}, compté: ${item.countedStock}`,
                                activeSession.storeId,
                                activeSession.supervisor
                            );
                            adjustedCount += 1;
                        }
                    }
                });

                // Mettre à jour la session en statut COMPLETED avec date & heure de clôture et responsable de clôture
                const closedSession = {
                    ...activeSession,
                    status: 'COMPLETED',
                    dateClosed: new Date().toISOString(),
                    closedBy: currentUserName
                };

                setSessions(prev => prev.map(s => s.id === activeSession.id ? closedSession : s));

                // Notification : marquer cette session clôturée comme non vue pour afficher le badge dans "Clôturées & Régularisées"
                setSeenCompletedIds(prev => {
                    const next = prev.filter(id => id !== activeSession.id);
                    try { localStorage.setItem(seenCompletedKey, JSON.stringify(next)); } catch {}
                    return next;
                });
                setSeenAllIds(prev => {
                    const next = prev.filter(id => id !== activeSession.id);
                    try { localStorage.setItem(seenAllKey, JSON.stringify(next)); } catch {}
                    return next;
                });

                // Revenir sur Sessions Actives pour que l'utilisateur remarque le badge sur l'onglet Clôturées & Régularisées
                setStatusFilter('IN_PROGRESS');

                setActionLoading(null);
                setActiveSession(null); // Revient à l'écran de gestion des inventaires

                T.success(`Inventaire régularisé et clôturé avec succès ! ${adjustedCount} article(s) régularisé(s) dans le Grand Livre.`);
            } catch (error) {
                console.error('Erreur clôture inventaire:', error);
                setActionLoading(null);
                T.error("Erreur lors de la régularisation de l'inventaire.");
            }
        }, 1500);
    };

    // ── Imprimer Feuille de Comptage ──
    const handlePrintSheet = () => {
        window.print();
    };

    // ── Badge de statut harmonisé ──
    const getStatusBadge = (status) => {
        switch (status) {
            case 'COMPLETED':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] bg-emerald-50 text-emerald-800 border border-emerald-300 font-semibold text-[10px] uppercase tracking-wider">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Clôturé & Régularisé</span>
                    </span>
                );
            case 'IN_PROGRESS':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] bg-blue-50 text-blue-800 border border-blue-300 font-semibold text-[10px] uppercase tracking-wider">
                        <Clock className="w-3 h-3 text-blue-600 animate-pulse" />
                        <span>Comptage En Cours</span>
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] bg-gray-100 text-gray-700 border border-gray-300 font-semibold text-[10px] uppercase tracking-wider">
                        <span>Brouillon</span>
                    </span>
                );
        }
    };

    // ── Badge de type d'inventaire harmonisé ──
    const getTypeBadge = (type) => {
        switch (type) {
            case 'CYCLIC':
                return (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[3px] bg-amber-50 text-amber-800 border border-amber-300 font-semibold text-[10px] uppercase tracking-wider">
                        <Boxes className="w-3 h-3 text-amber-700" />
                        <span>Tournant (Rayon)</span>
                    </span>
                );
            case 'ANNUAL':
                return (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[3px] bg-purple-50 text-purple-800 border border-purple-300 font-semibold text-[10px] uppercase tracking-wider">
                        <ClipboardCheck className="w-3 h-3 text-purple-700" />
                        <span>Annuel (Exhaustif)</span>
                    </span>
                );
            case 'SPOT':
                return (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[3px] bg-rose-50 text-rose-800 border border-rose-300 font-semibold text-[10px] uppercase tracking-wider">
                        <AlertTriangle className="w-3 h-3 text-rose-700" />
                        <span>Inopiné (Surprise)</span>
                    </span>
                );
            default:
                return null;
        }
    };


    return (
        <div className="space-y-3 font-sans pb-10">
            {activeSession ? (
                <div className="space-y-3">
                    {/* BARRE SUPÉRIEURE FIXE (Charte Kabllix #001d35 & #f77500) */}
                    <div className="bg-[#001d35] text-white px-4 py-3 border-b-2 border-[#f77500] shadow-md flex flex-col xl:flex-row xl:items-center justify-between gap-3 shrink-0 rounded-[4px]">
                        <div className="flex items-center gap-3">
                            {/* Bouton Retour / Fermeture */}
                            <button
                                type="button"
                                onClick={() => setActiveSession(null)}
                                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-[4px] text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border border-white/20"
                            >
                                <ArrowLeft className="w-3.5 h-3.5 text-[#f77500]" />
                                <span>Retour aux Inventaires</span>
                            </button>

                            <div className="h-5 w-px bg-white/20 hidden sm:block"></div>

                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[11px] uppercase tracking-wider text-gray-300 font-medium">Session d'Inventaire :</span>
                                    <h2 className="text-sm font-semibold text-white tracking-wide">
                                        {activeSession.code} — {activeSession.name}
                                    </h2>
                                    {getTypeBadge(activeSession.type)}
                                    {getStatusBadge(activeSession.status)}
                                </div>
                                <p className="text-[11px] text-gray-300 font-normal mt-0.5">
                                    Dépôt : <strong className="text-white font-semibold">{activeSession.storeName}</strong> &bull; Opérateur : <strong className="text-white font-semibold">{activeSession.supervisor}</strong>
                                    {activeSession.closedBy && (
                                        <span> &bull; Clôturé par : <strong className="text-emerald-300 font-semibold">{activeSession.closedBy}</strong></span>
                                    )}
                                </p>
                            </div>
                        </div>

                        {/* Actions En-tête */}
                        <div className="flex items-center gap-2 flex-wrap justify-between xl:justify-end">
                            <button
                                type="button"
                                onClick={handlePrintSheet}
                                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-[4px] border border-white/20 flex items-center gap-1.5 transition-all cursor-pointer"
                                title="Imprimer la feuille de pointage"
                            >
                                <Printer className="w-3.5 h-3.5 text-[#f77500]" />
                                <span className="hidden sm:inline">Imprimer</span>
                            </button>

                            {activeSession.status !== 'COMPLETED' && (
                                <>
                                    <button
                                        type="button"
                                        onClick={handleSaveDraft}
                                        className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-[4px] border border-white/20 flex items-center gap-1.5 transition-all cursor-pointer"
                                        title="Sauvegarder l'état actuel du comptage"
                                    >
                                        <Save className="w-3.5 h-3.5 text-[#f77500]" />
                                        <span className="hidden sm:inline">Sauvegarder</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsClosingModalOpen(true)}
                                        className="px-3.5 py-1.5 bg-[#f77500] hover:bg-[#e66a00] text-white text-xs font-semibold uppercase tracking-wider rounded-[4px] shadow-sm flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                                    >
                                        <CheckSquare className="w-3.5 h-3.5 text-white" />
                                        <span>Régulariser & Clôturer</span>
                                    </button>
                                </>
                            )}

                            <button
                                type="button"
                                onClick={() => setActiveSession(null)}
                                className="p-1.5 text-gray-300 hover:text-white hover:bg-white/10 rounded-[4px] transition-colors cursor-pointer ml-1"
                                title="Fermer la session"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* 4 StatCards Synthèse de la Session Active (Identiques à Réapprovisionnement) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {/* 1. Articles Comptés */}
                        <div className="bg-white p-3.5 rounded-[4px] border-2 border-gray-300 shadow-sm relative group hover:shadow-md transition-shadow overflow-hidden min-h-[110px] flex flex-col justify-center">
                            <div className="flex justify-between items-start relative z-10">
                                <div className="flex-1">
                                    <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-[#001d35]">Articles Comptés</p>
                                    <div className="flex items-baseline mt-2 font-semibold" style={{ color: '#001d35' }}>
                                        <h3 className="text-xl sm:text-2xl font-semibold text-[#001d35]">
                                            {activeSession.countedItems} <span className="text-sm font-semibold text-gray-500">/ {activeSession.totalItems}</span>
                                        </h3>
                                    </div>
                                    <p className="text-xs text-gray-600 mt-2 font-medium">
                                        Reste à pointer : <strong className="text-amber-800">{Math.max(0, activeSession.totalItems - activeSession.countedItems)}</strong>
                                    </p>
                                </div>
                            </div>
                            <img
                                src="/icons8/fluency_96_clipboard.png"
                                alt=""
                                className="absolute bottom-2 right-2 w-14 h-14 opacity-80 group-hover:opacity-100 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-700 pointer-events-none"
                            />
                        </div>

                        {/* 2. Écarts Constatés */}
                        <div className="bg-white p-3.5 rounded-[4px] border-2 border-gray-300 shadow-sm relative group hover:shadow-md transition-shadow overflow-hidden min-h-[110px] flex flex-col justify-center">
                            <div className="flex justify-between items-start relative z-10">
                                <div className="flex-1">
                                    <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-amber-700">Écarts Constatés</p>
                                    <div className="flex items-baseline mt-2 font-semibold" style={{ color: '#b45309' }}>
                                        <h3 className="text-xl sm:text-2xl font-semibold text-amber-600">
                                            {activeSession.discrepancyCount}
                                        </h3>
                                    </div>
                                    <p className="text-xs text-gray-600 mt-2 font-medium">Lignes présentant une différence physique</p>
                                </div>
                            </div>
                            <img
                                src="/icons8/fluency_240_high-priority.png"
                                alt=""
                                className="absolute bottom-2 right-2 w-14 h-14 opacity-80 group-hover:opacity-100 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-700 pointer-events-none"
                            />
                        </div>

                        {/* 3. Impact Financier Net */}
                        <div className="bg-white p-3.5 rounded-[4px] border-2 border-gray-300 shadow-sm relative group hover:shadow-md transition-shadow overflow-hidden min-h-[110px] flex flex-col justify-center">
                            <div className="flex justify-between items-start relative z-10">
                                <div className="flex-1">
                                    <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-rose-700">Impact Financier Net</p>
                                    <div className="flex items-baseline mt-2 font-semibold" style={{ color: activeSession.netFinancialImpact < 0 ? '#e11d48' : '#059669' }}>
                                        <h3 className="text-xl sm:text-2xl font-semibold">
                                            {formatPrice(activeSession.netFinancialImpact)}
                                        </h3>
                                    </div>
                                    <p className="text-xs text-gray-600 mt-2 font-medium">Valorisation au prix d'achat HT</p>
                                </div>
                            </div>
                            <img
                                src="/icons8/fluency_240_coins.png"
                                alt=""
                                className="absolute bottom-2 right-2 w-14 h-14 opacity-80 group-hover:opacity-100 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-700 pointer-events-none"
                            />
                        </div>

                        {/* 4. Taux d'Avancement */}
                        <div className="bg-white p-3.5 rounded-[4px] border-2 border-gray-300 shadow-sm relative group hover:shadow-md transition-shadow overflow-hidden min-h-[110px] flex flex-col justify-center">
                            {(() => {
                                const percent = activeSession.totalItems > 0 ? Math.round((activeSession.countedItems / activeSession.totalItems) * 100) : 0;
                                return (
                                    <div className="flex-1 flex flex-col justify-between">
                                        <div>
                                            <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-[#001d35]">Avancement du Pointage</p>
                                            <div className="flex items-center justify-between mt-1">
                                                <h3 className="text-xl sm:text-2xl font-semibold text-[#001d35]">{percent}%</h3>
                                                <span className="text-[11px] font-semibold text-gray-600">{activeSession.countedItems} sur {activeSession.totalItems}</span>
                                            </div>
                                        </div>
                                        <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden mt-2">
                                            <div
                                                className={`h-full rounded-full transition-all duration-500 ${
                                                    percent === 100 ? 'bg-emerald-500' : percent > 0 ? 'bg-amber-500' : 'bg-blue-500'
                                                }`}
                                                style={{ width: `${percent}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>

                    {/* Barre de Saisie Rapide (Scanner Code-Barre) et Outils */}
                    <div className="bg-white p-2.5 rounded-[4px] border-2 border-gray-300 shadow-sm">
                        <div className="flex flex-col md:flex-row gap-2.5 items-stretch md:items-center justify-between">
                            {/* Scanner / Recherche Code-barre */}
                            <form onSubmit={handleScanSubmit} className="flex-1 flex gap-2 max-w-xl">
                                <div className="relative flex-1">
                                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                    <input
                                        ref={scanInputRef}
                                        type="text"
                                        placeholder="Scanner un code-barres ou saisir le nom pour incrémenter le stock..."
                                        className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-[4px] focus:outline-none focus:ring-1 focus:ring-[#001d35] bg-white font-normal"
                                        value={scanBarcode}
                                        onChange={(e) => setScanBarcode(e.target.value)}
                                    />
                                </div>
                                <button
                                    type="submit"
                                    className="px-3.5 py-1.5 bg-[#001d35] hover:bg-[#00284a] text-white font-semibold uppercase tracking-wider text-xs rounded-[4px] cursor-pointer shadow-sm active:scale-95"
                                >
                                    Pointer
                                </button>
                            </form>

                            {/* Options et Filtres d'affichage */}
                            <div className="flex items-center gap-2 flex-wrap">
                                {/* Recherche dans la feuille */}
                                <div className="relative min-w-[180px]">
                                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="text"
                                        placeholder="Filtrer la feuille..."
                                        value={activeSearch}
                                        onChange={(e) => setActiveSearch(e.target.value)}
                                        className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-[4px] focus:outline-none focus:ring-1 focus:ring-[#001d35] bg-white font-normal"
                                    />
                                    {activeSearch && (
                                        <button
                                            type="button"
                                            onClick={() => setActiveSearch('')}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>

                                {/* Toggle Comptage à l'aveugle */}
                                <button
                                    type="button"
                                    onClick={() => setIsBlindModeActive(!isBlindModeActive)}
                                    className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-[4px] border transition-all cursor-pointer flex items-center gap-1.5 ${
                                        isBlindModeActive
                                            ? 'bg-purple-50 border-purple-300 text-purple-900 shadow-xs'
                                            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                                    }`}
                                    title="Masque le stock théorique aux magasiniers pour éviter les biais de comptage"
                                >
                                    {isBlindModeActive ? <EyeOff className="w-3.5 h-3.5 text-purple-700" /> : <Eye className="w-3.5 h-3.5 text-gray-500" />}
                                    <span>{isBlindModeActive ? "Mode Aveugle Actif" : "Comptage Standard"}</span>
                                </button>

                                {/* Filtre Écarts Uniquement */}
                                <button
                                    type="button"
                                    onClick={() => setFilterDiscrepanciesOnly(!filterDiscrepanciesOnly)}
                                    className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-[4px] border transition-all cursor-pointer flex items-center gap-1.5 ${
                                        filterDiscrepanciesOnly
                                            ? 'bg-rose-50 border-rose-300 text-rose-900 shadow-xs'
                                            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                                    }`}
                                >
                                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                                    <span>Écarts Seuls</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Tableau de Comptage de la Session Active (Identique au Réapprovisionnement) */}
                    <div className="bg-white border-2 border-gray-300 rounded-[4px] shadow-sm overflow-hidden flex flex-col">
                        <div className="p-3 bg-slate-50 border-b-2 border-gray-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <ClipboardCheck className="w-4 h-4 text-[#001d35]" />
                                <h4 className="text-xs font-semibold text-[#001d35] uppercase tracking-wider">
                                    Feuille de Pointage & Contrôle des Rayons
                                </h4>
                            </div>
                            <div className="text-xs text-gray-600 font-medium">
                                Périmètre : <strong className="text-gray-900 font-semibold">{activeSession.items.length} article(s)</strong> répertorié(s)
                            </div>
                        </div>

                        <div className="overflow-x-auto max-h-[calc(100vh-320px)] min-h-[460px] overflow-y-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-[#001d35] text-white font-semibold uppercase tracking-wider text-[10px] divide-x divide-white/20 sticky top-0 z-10 shadow-xs">
                                        <th className="py-2.5 px-3 text-center w-12">État</th>
                                        <th className="py-2.5 px-3 whitespace-nowrap w-36">Réf / Code-Barres</th>
                                        <th className="py-2.5 px-3">Désignation de l'Article</th>
                                        <th className="py-2.5 px-3 text-center w-24">Unité</th>
                                        <th className="py-2.5 px-3 text-center whitespace-nowrap w-32">Stock Théorique</th>
                                        <th className="py-2.5 px-3 text-center w-44 bg-blue-900/40">Stock Physique Compté</th>
                                        <th className="py-2.5 px-3 text-right whitespace-nowrap w-32">Écart Quantité</th>
                                        <th className="py-2.5 px-3 text-right whitespace-nowrap w-32">Impact Financier</th>
                                        <th className="py-2.5 px-3 w-48">Motif de l'Écart</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {activeSession.items
                                        .filter(item => {
                                            if (filterDiscrepanciesOnly && (!item.isCounted || item.discrepancyQty === 0)) return false;
                                            if (activeSearch.trim()) {
                                                const q = activeSearch.toLowerCase();
                                                return item.name.toLowerCase().includes(q) || (item.barcode && item.barcode.toLowerCase().includes(q));
                                            }
                                            return true;
                                        })
                                        .map((item) => {
                                            const hasDiscrepancy = item.isCounted && item.discrepancyQty !== 0;
                                            const isPositive = item.discrepancyQty > 0;
                                            const isReadOnly = activeSession.status === 'COMPLETED';

                                            return (
                                                <tr
                                                    key={item.productId}
                                                    className={`transition-colors border-b border-gray-200 ${
                                                        item.isCounted ? 'bg-white hover:bg-blue-50/60' : 'bg-slate-50/80 hover:bg-slate-100'
                                                    }`}
                                                >
                                                    {/* État de pointage */}
                                                    <td className="py-2.5 px-3 text-center">
                                                        {item.isCounted ? (
                                                            <span className="inline-flex p-1 rounded-full bg-emerald-100 text-emerald-700" title="Article pointé">
                                                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                                                            </span>
                                                        ) : (
                                                            <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-gray-300" title="En attente de pointage"></span>
                                                        )}
                                                    </td>

                                                    {/* Réf / Code-barres */}
                                                    <td className="py-2.5 px-3 font-semibold text-gray-500 text-xs whitespace-nowrap">
                                                        <span className="px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded-[3px] border border-gray-200 text-[11px] font-mono">
                                                            {item.barcode || item.productId}
                                                        </span>
                                                    </td>

                                                    {/* Article */}
                                                    <td className="py-2.5 px-3">
                                                        <div className="font-semibold text-gray-900 text-xs truncate max-w-[240px]" title={item.name}>
                                                            {item.name}
                                                        </div>
                                                        <div className="text-[10px] text-gray-400 font-normal flex items-center gap-1 mt-0.5">
                                                            <span>{item.category}</span>
                                                            <span className="text-gray-300">&bull;</span>
                                                            <span>P.U: {formatPrice(item.purchasePrice)}</span>
                                                        </div>
                                                    </td>

                                                    {/* Unité */}
                                                    <td className="py-2.5 px-3 text-center">
                                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-[3px] bg-slate-100 text-gray-700 border border-gray-200 text-[10px] font-semibold uppercase tracking-wider">
                                                            {item.unit}
                                                        </span>
                                                    </td>

                                                    {/* Stock Théorique (avec masque si mode aveugle) */}
                                                    <td className="py-2.5 px-3 text-center font-semibold text-[#001d35] text-xs">
                                                        {isBlindModeActive ? (
                                                            <span className="text-gray-400 tracking-widest text-[11px]">••••</span>
                                                        ) : (
                                                            <span className="px-2 py-0.5 bg-slate-100 text-[#001d35] rounded-[3px] border border-gray-200 font-bold">
                                                                {item.theoreticalStock}
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* Stock Physique Compté (Stepper direct comme Réapprovisionnement) */}
                                                    <td className="py-2 px-3 text-center bg-blue-50/20">
                                                        {isReadOnly ? (
                                                            <span className="font-bold text-sm text-[#001d35]">{item.countedStock || 0}</span>
                                                        ) : (
                                                            <div className="inline-flex items-center border border-gray-300 rounded-[4px] overflow-hidden bg-white shadow-2xs">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const current = parseFloat(item.countedStock) || 0;
                                                                        handleCountChange(item.productId, String(Math.max(0, current - 1)));
                                                                    }}
                                                                    className="w-6 h-6 flex items-center justify-center bg-gray-50 hover:bg-gray-100 text-gray-600 font-medium text-xs cursor-pointer select-none border-r border-gray-200 transition-colors"
                                                                    title="Diminuer le stock compté"
                                                                >
                                                                    −
                                                                </button>
                                                                <input
                                                                    type="number"
                                                                    step="any"
                                                                    min="0"
                                                                    placeholder="0"
                                                                    value={item.countedStock}
                                                                    onChange={(e) => handleCountChange(item.productId, e.target.value)}
                                                                    className="w-16 text-center font-semibold text-xs py-0.5 text-[#001d35] focus:outline-none"
                                                                    title="Quantité physique comptée"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const current = parseFloat(item.countedStock) || 0;
                                                                        handleCountChange(item.productId, String(current + 1));
                                                                    }}
                                                                    className="w-6 h-6 flex items-center justify-center bg-gray-50 hover:bg-gray-100 text-gray-600 font-medium text-xs cursor-pointer select-none border-l border-gray-200 transition-colors"
                                                                    title="Augmenter le stock compté"
                                                                >
                                                                    +
                                                                </button>
                                                            </div>
                                                        )}
                                                    </td>

                                                    {/* Écart Quantité */}
                                                    <td className="py-2.5 px-3 text-right font-semibold whitespace-nowrap text-xs">
                                                        {item.isCounted ? (
                                                            <span className={isPositive ? 'text-emerald-700' : (item.discrepancyQty < 0 ? 'text-rose-700' : 'text-gray-500')}>
                                                                {isPositive ? `+${item.discrepancyQty}` : item.discrepancyQty} {item.unit}
                                                            </span>
                                                        ) : (
                                                            <span className="text-gray-300">—</span>
                                                        )}
                                                    </td>

                                                    {/* Impact Financier */}
                                                    <td className="py-2.5 px-3 text-right font-semibold whitespace-nowrap text-xs">
                                                        {item.isCounted ? (
                                                            <span className={item.discrepancyValue < 0 ? 'text-rose-700' : (item.discrepancyValue > 0 ? 'text-emerald-700' : 'text-gray-400')}>
                                                                {formatPrice(item.discrepancyValue)}
                                                            </span>
                                                        ) : (
                                                            <span className="text-gray-300">—</span>
                                                        )}
                                                    </td>

                                                    {/* Motif d'Écart */}
                                                    <td className="py-2 px-3">
                                                        {hasDiscrepancy ? (
                                                            <select
                                                                disabled={isReadOnly}
                                                                value={item.reason}
                                                                onChange={(e) => handleReasonChange(item.productId, e.target.value)}
                                                                className="w-full text-xs font-normal py-1 px-1.5 border border-gray-300 rounded-[4px] bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#001d35]"
                                                            >
                                                                <option value="CORRECTION">Correction d'inventaire</option>
                                                                <option value="DAMAGE">Casse / Avarie</option>
                                                                <option value="LOSS">Perte inexpliquée</option>
                                                                <option value="THEFT">Vol présumé</option>
                                                                <option value="OTHER">Autre régularisation</option>
                                                            </select>
                                                        ) : (
                                                            <span className="text-gray-400 text-[11px] font-medium">Conforme</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                </tbody>
                            </table>
                        </div>

                        {/* Footer du tableau de session */}
                        <div className="p-3 bg-white border-t-2 border-gray-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                            <div className="flex items-center gap-3">
                                <div className="text-xs text-gray-600 font-normal">
                                    Avancement : <strong className="text-gray-900 font-semibold">{activeSession.countedItems}</strong> / {activeSession.totalItems} articles (
                                    {activeSession.totalItems > 0 ? Math.round((activeSession.countedItems / activeSession.totalItems) * 100) : 0}%)
                                </div>
                                <div className="h-4 w-px bg-gray-200" />
                                <div className="text-xs text-gray-600 font-normal">
                                    Écarts : <strong className="text-amber-800 font-semibold">{activeSession.discrepancyCount}</strong> article(s)
                                </div>
                                <div className="h-4 w-px bg-gray-200" />
                                <div className="text-xs text-gray-600 font-normal">
                                    Impact Net : <strong className={`text-sm font-semibold ${activeSession.netFinancialImpact < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                                        {formatPrice(activeSession.netFinancialImpact)}
                                    </strong>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleSaveDraft}
                                    className="px-3.5 py-1.5 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 rounded-[4px] transition-colors cursor-pointer"
                                >
                                    Sauvegarder Brouillon
                                </button>
                                {activeSession.status !== 'COMPLETED' && (
                                    <button
                                        type="button"
                                        onClick={() => setIsClosingModalOpen(true)}
                                        className="px-4 py-1.5 text-xs font-semibold text-white bg-[#f77500] hover:bg-[#e66a00] rounded-[4px] shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
                                    >
                                        <CheckSquare className="w-3.5 h-3.5" />
                                        <span>Régulariser & Clôturer</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-3">
                    {/* ── EN-TÊTE PRINCIPAL OFFICIEL KABLLIX ERP ── */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-[4px] border-2 border-gray-300 shadow-sm">
                        <div>
                            <h1 className="text-base sm:text-lg font-bold text-[#001d35] tracking-tight">
                                Inventaire Physique & Contrôle des Stocks
                            </h1>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    window.print();
                                    T.success("Génération de la fiche de comptage vierge...");
                                }}
                                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold uppercase tracking-wider rounded-[4px] border border-gray-300 hover:bg-gray-50 text-gray-700 transition-all cursor-pointer shadow-xs active:scale-95"
                            >
                                <Printer className="w-3.5 h-3.5 text-[#001d35]" />
                                <span>Fiche Vierge (PDF)</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setIsNewModalOpen(true)}
                                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold uppercase tracking-wider rounded-[4px] bg-[#001d35] hover:bg-[#00284a] text-white transition-all cursor-pointer shadow-sm active:scale-95"
                            >
                                <Plus className="w-3.5 h-3.5 text-[#f77500]" />
                                <span>Nouvel Inventaire</span>
                            </button>
                        </div>
                    </div>

                    {/* ── BARRE D'ONGLETS PRINCIPAUX (IDENTIQUE À RÉAPPROVISIONNEMENT) ── */}
                    <div className="bg-white p-2 sm:p-2.5 rounded-[4px] border-2 border-gray-300 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
                        <div className="flex items-center gap-1 bg-gray-100/80 p-1 rounded-[4px] border-2 border-gray-300 flex-wrap" aria-label="Onglets d'inventaire">
                            {/* Onglet 1 : Sessions Actives */}
                            <button
                                type="button"
                                onClick={() => handleTabClick('IN_PROGRESS')}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-[4px] transition-all cursor-pointer flex items-center gap-2 ${
                                    statusFilter === 'IN_PROGRESS'
                                        ? 'bg-[#001d35] text-white shadow-sm'
                                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                                }`}
                            >
                                <Clock className={`w-3.5 h-3.5 ${
                                    statusFilter === 'IN_PROGRESS' ? 'text-[#f77500]' : 'text-gray-500'
                                }`} />
                                <span>Sessions Actives</span>

                                {unseenActiveCount > 0 && (
                                    <span className="min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold bg-red-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs animate-in zoom-in-75 duration-150">
                                        {unseenActiveCount}
                                    </span>
                                )}
                            </button>

                            {/* Barre verticale de séparation */}
                            <div className="h-5 w-px bg-gray-300 mx-1 shrink-0" aria-hidden="true"></div>

                            {/* Onglet 2 : Toutes les Sessions */}
                            <button
                                type="button"
                                onClick={() => handleTabClick('ALL')}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-[4px] transition-all cursor-pointer flex items-center gap-2 ${
                                    statusFilter === 'ALL'
                                        ? 'bg-[#001d35] text-white shadow-sm'
                                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                                }`}
                            >
                                <ClipboardCheck className={`w-3.5 h-3.5 ${
                                    statusFilter === 'ALL' ? 'text-[#f77500]' : 'text-gray-500'
                                }`} />
                                <span>Toutes les Sessions</span>

                                {unseenAllCount > 0 && (
                                    <span className="min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold bg-red-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs animate-in zoom-in-75 duration-150">
                                        {unseenAllCount}
                                    </span>
                                )}
                            </button>

                            {/* Barre verticale de séparation */}
                            <div className="h-5 w-px bg-gray-300 mx-1 shrink-0" aria-hidden="true"></div>

                            {/* Onglet 3 : Clôturées & Régularisées */}
                            <button
                                type="button"
                                onClick={() => handleTabClick('COMPLETED')}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-[4px] transition-all cursor-pointer flex items-center gap-2 ${
                                    statusFilter === 'COMPLETED'
                                        ? 'bg-[#001d35] text-white shadow-sm'
                                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                                }`}
                            >
                                <CheckCircle2 className={`w-3.5 h-3.5 ${
                                    statusFilter === 'COMPLETED' ? 'text-[#f77500]' : 'text-gray-500'
                                }`} />
                                <span>Clôturées & Régularisées</span>

                                {unseenCompletedCount > 0 && (
                                    <span className="min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold bg-red-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs animate-in zoom-in-75 duration-150">
                                        {unseenCompletedCount}
                                    </span>
                                )}
                            </button>
                        </div>

                        {/* Sélecteur temporel harmonisé */}
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-1 bg-gray-100/80 p-1 rounded-[4px] border-2 border-gray-300">
                                {[
                                    { key: 'today', label: "Aujourd'hui" },
                                    { key: '7days', label: '7 jours' },
                                    { key: 'month', label: 'Ce mois' },
                                    { key: 'all', label: 'Tout' },
                                    { key: 'custom', label: 'Période...' }
                                ].map(opt => (
                                    <button
                                        key={opt.key}
                                        type="button"
                                        onClick={() => handleFilterChange(setPeriod, opt.key)}
                                        className={`px-2 py-0.5 rounded-[3px] text-[11px] font-semibold transition-all cursor-pointer ${
                                            period === opt.key
                                                ? 'bg-[#001d35] text-white'
                                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>

                            {period === 'custom' && (
                                <div className="flex items-center gap-1 text-xs">
                                    <input
                                        type="date"
                                        value={customStartDate}
                                        onChange={e => handleFilterChange(setCustomStartDate, e.target.value)}
                                        className="px-2 py-1 text-xs border border-gray-300 rounded-[4px] font-medium text-gray-700 bg-white"
                                    />
                                    <span className="text-gray-400 text-xs">à</span>
                                    <input
                                        type="date"
                                        value={customEndDate}
                                        onChange={e => handleFilterChange(setCustomEndDate, e.target.value)}
                                        className="px-2 py-1 text-xs border border-gray-300 rounded-[4px] font-medium text-gray-700 bg-white"
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── 3 STATCARDS KPI (TAILLE CONSERVÉE LG:GRID-COLS-4) ── */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {/* 1. Dernier Inventaire */}
                        <div className="bg-white p-3.5 rounded-[4px] border-2 border-gray-300 shadow-sm relative group hover:shadow-md transition-shadow overflow-hidden min-h-[120px] flex flex-col justify-center">
                            {filterLoading ? (
                                <div className="flex flex-col items-center justify-center py-4">
                                    <div className="relative h-8 w-8">
                                        <div className="absolute inset-0 animate-spin rounded-full border-2 border-t-transparent border-[#001d35]"></div>
                                        <div className="absolute inset-1 animate-spin-reverse rounded-full border-2 border-b-transparent border-[#f77500]"></div>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="flex justify-between items-start relative z-10">
                                        <div className="flex-1">
                                            <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-[#001d35]">Dernier Inventaire</p>
                                            <div className="flex items-baseline mt-2 font-semibold" style={{ color: '#001d35' }}>
                                                <h3 className="text-base sm:text-lg font-semibold text-[#001d35] tracking-tight">
                                                    {metrics.lastSessionDate ? formatDateTime(metrics.lastSessionDate) : 'Aucun inventaire'}
                                                </h3>
                                            </div>
                                            <p className="text-xs text-gray-600 mt-2 font-medium">{metrics.completedSessionsCount} sessions clôturées & régularisées</p>
                                        </div>
                                    </div>
                                    <img
                                        src="/icons8/fluency_96_clipboard.png"
                                        alt=""
                                        className="absolute bottom-2 right-2 w-16 h-16 opacity-80 group-hover:opacity-100 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-700 pointer-events-none"
                                    />
                                </>
                            )}
                        </div>

                        {/* 2. Taux de Conformité */}
                        <div className="bg-white p-3.5 rounded-[4px] border-2 border-gray-300 shadow-sm relative group hover:shadow-md transition-shadow overflow-hidden min-h-[120px] flex flex-col justify-center">
                            {filterLoading ? (
                                <div className="flex flex-col items-center justify-center py-4">
                                    <div className="relative h-8 w-8">
                                        <div className="absolute inset-0 animate-spin rounded-full border-2 border-t-transparent border-[#001d35]"></div>
                                        <div className="absolute inset-1 animate-spin-reverse rounded-full border-2 border-b-transparent border-[#f77500]"></div>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="flex justify-between items-start relative z-10">
                                        <div className="flex-1">
                                            <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-emerald-700">Taux de Conformité</p>
                                            <div className="flex items-baseline mt-2 font-semibold" style={{ color: '#059669' }}>
                                                <h3 className="text-xl sm:text-2xl font-semibold text-emerald-600">
                                                    {metrics.conformityRate}%
                                                </h3>
                                            </div>
                                            <p className="text-xs text-gray-600 mt-2 font-medium">Articles conformes sans aucun écart</p>
                                        </div>
                                    </div>
                                    <img
                                        src="/icons8/fluency_96_ok.png"
                                        alt=""
                                        className="absolute bottom-2 right-2 w-16 h-16 opacity-80 group-hover:opacity-100 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-700 pointer-events-none"
                                    />
                                </>
                            )}
                        </div>

                        {/* 3. Pertes Nettes / Démarque */}
                        <div className="bg-white p-3.5 rounded-[4px] border-2 border-gray-300 shadow-sm relative group hover:shadow-md transition-shadow overflow-hidden min-h-[120px] flex flex-col justify-center">
                            {filterLoading ? (
                                <div className="flex flex-col items-center justify-center py-4">
                                    <div className="relative h-8 w-8">
                                        <div className="absolute inset-0 animate-spin rounded-full border-2 border-t-transparent border-[#001d35]"></div>
                                        <div className="absolute inset-1 animate-spin-reverse rounded-full border-2 border-b-transparent border-[#f77500]"></div>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="flex justify-between items-start relative z-10">
                                        <div className="flex-1">
                                            <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-rose-700">Pertes Nettes / Démarque</p>
                                            <div className="flex items-baseline mt-2 font-semibold" style={{ color: '#e11d48' }}>
                                                <h3 className="text-xl sm:text-2xl font-semibold text-rose-600">
                                                    {formatPrice(Math.abs(metrics.totalNetFinancialImpact))}
                                                </h3>
                                            </div>
                                            <p className="text-xs text-gray-600 mt-2 font-medium">Impact cumulé des écarts d'inventaire</p>
                                        </div>
                                    </div>
                                    <img
                                        src="/icons8/fluency_240_high-priority.png"
                                        alt=""
                                        className="absolute bottom-2 right-2 w-16 h-16 opacity-80 group-hover:opacity-100 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-700 pointer-events-none"
                                    />
                                </>
                            )}
                        </div>
                    </div>

                    {/* ── BARRE DE RECHERCHE ET FILTRES HARMONISÉE ── */}
                    <div className="bg-white p-2.5 rounded-[4px] border-2 border-gray-300 shadow-sm">
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                            <div className="flex flex-wrap items-center gap-2 flex-1 justify-start">
                                {/* Recherche texte */}
                                <div className="relative flex-1 min-w-[200px] max-w-md">
                                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="text"
                                        placeholder="Filtrer par réf INV, intitulé, superviseur..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-[4px] focus:outline-none focus:ring-1 focus:ring-[#001d35] bg-white font-normal"
                                    />
                                    {searchTerm && (
                                        <button
                                            type="button"
                                            onClick={() => setSearchTerm('')}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>

                                {/* Filtre Dépôt */}
                                <select
                                    value={storeFilter}
                                    onChange={(e) => handleFilterChange(setStoreFilter, e.target.value)}
                                    className="px-2.5 py-1.5 text-xs border border-gray-300 rounded-[4px] bg-white font-normal text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#001d35]"
                                >
                                    <option value="all">Tous les dépôts / boutiques</option>
                                    {stores.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>

                                {/* Filtre Type */}
                                <select
                                    value={typeFilter}
                                    onChange={(e) => handleFilterChange(setTypeFilter, e.target.value)}
                                    className="px-2.5 py-1.5 text-xs border border-gray-300 rounded-[4px] bg-white font-normal text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#001d35]"
                                >
                                    <option value="all">Tous les types d'inventaire</option>
                                    <option value="CYCLIC">Tournant (Rayon)</option>
                                    <option value="ANNUAL">Annuel (Exhaustif)</option>
                                    <option value="SPOT">Inopiné (Surprise)</option>
                                </select>
                            </div>

                            <div className="flex items-center gap-2 self-end sm:self-auto">
                                {(searchTerm || storeFilter !== 'all' || typeFilter !== 'all' || period !== 'today') && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSearchTerm('');
                                            setStoreFilter('all');
                                            setTypeFilter('all');
                                            setPeriod('today');
                                            setCustomStartDate('');
                                            setCustomEndDate('');
                                        }}
                                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:text-red-700 hover:bg-red-50 rounded-[4px] border border-gray-200 transition-colors cursor-pointer"
                                        title="Réinitialiser tous les filtres"
                                    >
                                        <RotateCcw className="w-3 h-3" />
                                        <span>Réinitialiser filtres</span>
                                    </button>
                                )}
                                {filteredSessions.length > 0 && (
                                    <span className="text-[11px] font-semibold text-gray-600 bg-gray-100 px-3 py-1.5 rounded-[4px] border border-gray-200">
                                        {filteredSessions.length} session(s)
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── TABLEAU REGISTRE HISTORIQUE DES SESSIONS (STYLE RÉAPPROVISIONNEMENT) ── */}
                    <div className="bg-white border-2 border-gray-300 rounded-[4px] shadow-sm overflow-hidden min-h-[350px] flex flex-col justify-center">
                        {filterLoading ? (
                            <div className="p-16 flex flex-col items-center justify-center bg-white animate-in fade-in duration-150">
                                <div className="relative h-10 w-10">
                                    <div className="absolute inset-0 animate-spin rounded-full border-4 border-gray-200 border-t-[#001d35]"></div>
                                    <div className="absolute inset-1.5 animate-spin-reverse rounded-full border-2 border-transparent border-b-[#f77500]"></div>
                                </div>
                                <p className="text-xs font-semibold text-[#001d35] mt-3 uppercase tracking-wider">
                                    Filtrage des sessions d'inventaire...
                                </p>
                                <p className="text-[11px] text-gray-500 mt-0.5 font-medium">
                                    Consolidation des stocks physiques et contrôle des écarts
                                </p>
                            </div>
                        ) : filteredSessions.length === 0 ? (
                            <div className="p-12 text-center text-gray-500 bg-white">
                                <ClipboardCheck className="w-12 h-12 mx-auto text-gray-400 mb-2 opacity-60" />
                                <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                    {searchTerm || period !== 'today'
                                        ? "Aucune session d'inventaire ne correspond aux filtres appliqués"
                                        : (statusFilter === 'IN_PROGRESS'
                                            ? "Aucune session d'inventaire active aujourd'hui"
                                            : "Aucune session d'inventaire répertoriée aujourd'hui")}
                                </h3>
                                <p className="text-[11px] text-gray-500 mt-1 max-w-md mx-auto font-normal">
                                    {searchTerm || period !== 'today'
                                        ? "Modifiez vos filtres de dates ou critères de recherche pour afficher vos inventaires."
                                        : "Cliquez sur « Nouvel Inventaire » pour lancer un inventaire physique ou élargissez la période (7 jours, Ce mois, Tout)."}
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-[#001d35] text-white font-semibold uppercase tracking-wider text-[10px] divide-x divide-white/20 sticky top-0">
                                            <th className="py-2.5 px-3 w-32 whitespace-nowrap">Réf Session</th>
                                            <th className="py-2.5 px-3">Intitulé de la Session</th>
                                            <th className="py-2.5 px-3 text-center w-28 whitespace-nowrap">Type</th>
                                            <th className="py-2.5 px-3 w-40">Dépôt / Boutique</th>
                                            <th className="py-2.5 px-3 w-48 whitespace-nowrap">
                                                <div className="flex items-center gap-1">
                                                    <User className="w-3 h-3 text-[#f77500]" />
                                                    <span>Opérateur / Agent</span>
                                                </div>
                                            </th>
                                            <th className="py-2.5 px-3 w-32 whitespace-nowrap">Date Création</th>
                                            <th className="py-2.5 px-3 text-center w-36 whitespace-nowrap">Progression</th>
                                            <th className="py-2.5 px-3 text-right w-36 whitespace-nowrap">Écarts Constatés</th>
                                            <th className="py-2.5 px-3 text-center w-36 whitespace-nowrap">Statut</th>
                                            <th className="py-2.5 px-3 text-center w-28 whitespace-nowrap">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {filteredSessions.map((s) => {
                                            const progressPct = s.totalItems > 0 ? Math.round((s.countedItems / s.totalItems) * 100) : 0;
                                            return (
                                                <tr
                                                    key={s.id}
                                                    onClick={() => handleOpenSession(s)}
                                                    className="hover:bg-blue-50/40 transition-colors border-b border-gray-200 cursor-pointer group"
                                                >
                                                    {/* Réf */}
                                                    <td className="py-2.5 px-3 font-semibold text-[#001d35] whitespace-nowrap text-xs">
                                                        {s.code}
                                                    </td>

                                                    {/* Intitulé */}
                                                    <td className="py-2.5 px-3">
                                                        <div className="font-semibold text-gray-900 text-xs tracking-tight group-hover:text-blue-900">
                                                            {s.name}
                                                        </div>
                                                        <div className="text-[10px] text-gray-400 font-normal mt-0.5">
                                                            {s.totalItems} article(s) dans le périmètre
                                                        </div>
                                                    </td>

                                                    {/* Type */}
                                                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                                        {getTypeBadge(s.type)}
                                                    </td>

                                                    {/* Dépôt */}
                                                    <td className="py-2.5 px-3 font-medium text-gray-700 whitespace-nowrap text-xs">
                                                        <div className="flex items-center gap-1.5">
                                                            <StoreIcon className="w-3.5 h-3.5 text-[#001d35]" />
                                                            <span>{s.storeName}</span>
                                                        </div>
                                                    </td>

                                                    {/* Opérateur / Agent */}
                                                    <td className="py-2.5 px-3 whitespace-nowrap text-xs">
                                                        <div className="flex items-center gap-2">
                                                            <span className="w-6 h-6 rounded-full bg-blue-100 text-[#001d35] font-bold text-[10px] flex items-center justify-center shrink-0 border border-blue-200">
                                                                {(s.supervisor || 'A').charAt(0).toUpperCase()}
                                                            </span>
                                                            <div>
                                                                <div className="font-semibold text-gray-900 leading-tight">
                                                                    {s.supervisor || 'Non renseigné'}
                                                                </div>
                                                                {s.closedBy && s.closedBy !== s.supervisor && (
                                                                    <div className="text-[10px] text-gray-400 font-normal leading-tight">
                                                                        Clôturé par : {s.closedBy}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Date */}
                                                    <td className="py-2.5 px-3 text-gray-600 whitespace-nowrap font-medium text-xs">
                                                        {formatDate(s.dateCreated)}
                                                    </td>

                                                    {/* Progression */}
                                                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                                        <div className="w-28 mx-auto space-y-1">
                                                            <div className="flex justify-between text-[10px] font-semibold text-gray-600">
                                                                <span>{s.countedItems}/{s.totalItems}</span>
                                                                <span>{progressPct}%</span>
                                                            </div>
                                                            <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                                                <div
                                                                    className={`h-full rounded-full ${progressPct === 100 ? 'bg-emerald-600' : 'bg-blue-600'}`}
                                                                    style={{ width: `${progressPct}%` }}
                                                                ></div>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Écarts */}
                                                    <td className="py-2.5 px-3 text-right whitespace-nowrap text-xs">
                                                        {s.discrepancyCount > 0 ? (
                                                            <div>
                                                                <span className="font-semibold text-amber-700">{s.discrepancyCount} écart(s)</span>
                                                                <p className={`text-[10px] font-semibold ${s.netFinancialImpact < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                                                                    {formatPrice(s.netFinancialImpact)}
                                                                </p>
                                                            </div>
                                                        ) : (
                                                            <span className="text-emerald-700 font-semibold text-[11px]">0 écart</span>
                                                        )}
                                                    </td>

                                                    {/* Statut */}
                                                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                                        {getStatusBadge(s.status)}
                                                    </td>

                                                    {/* Actions */}
                                                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleOpenSession(s);
                                                            }}
                                                            className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider rounded-[4px] bg-[#001d35] hover:bg-[#00284a] text-white transition-all cursor-pointer shadow-xs active:scale-95"
                                                        >
                                                            {s.status === 'IN_PROGRESS' ? 'Poursuivre' : 'Consulter'}
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Footer Historique */}
                        {filteredSessions.length > 0 && !filterLoading && (
                            <div className="p-3 bg-white border-t-2 border-gray-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                                <div className="text-xs text-gray-600 font-normal">
                                    <strong className="text-gray-900 font-semibold">{filteredSessions.length}</strong> session(s) d'inventaire affichée(s)
                                </div>
                                <div className="text-[11px] text-gray-500 font-medium">
                                    Cliquez sur une ligne pour ouvrir la feuille de pointage
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── MODALE 1 : CONFIGURATION D'UNE NOUVELLE SESSION D'INVENTAIRE ── */}
            {isNewModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[110] p-4 animate-in fade-in duration-150">
                    <div className="bg-white rounded-[4px] shadow-2xl border-2 border-[#001d35] max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
                        {/* Barre Supérieure Stylisée */}
                        <div className="bg-[#001d35] text-white px-4 py-3 flex items-center justify-between border-b-2 border-[#f77500]">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-blue-500/20 border border-blue-400 flex items-center justify-center shrink-0">
                                    <ClipboardCheck className="w-4 h-4 text-[#f77500]" />
                                </div>
                                <div>
                                    <h3 className="text-xs font-semibold uppercase tracking-wider text-white">
                                        Nouvelle Session d'Inventaire
                                    </h3>
                                    <p className="text-[10px] text-gray-300">Paramétrez le périmètre et le mode de comptage terrain</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsNewModalOpen(false)}
                                className="text-gray-300 hover:text-white p-1 rounded-[4px] transition-colors cursor-pointer"
                                title="Fermer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Corps Formulaire */}
                        <form onSubmit={handleCreateSession} className="p-4 space-y-3.5 overflow-y-auto flex-1 custom-scrollbar">
                            {/* Intitulé & Boutique */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[11px] font-semibold text-[#001d35] uppercase tracking-wider mb-1">
                                        Intitulé de la Session
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Ex: Inventaire Tournant Plomberie"
                                        value={newSessionData.name}
                                        onChange={(e) => setNewSessionData({ ...newSessionData, name: e.target.value })}
                                        className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-[4px] text-xs font-normal text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#001d35]"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-semibold text-[#001d35] uppercase tracking-wider mb-1">
                                        Boutique concernée
                                    </label>
                                    <select
                                        value={newSessionData.storeId}
                                        onChange={(e) => setNewSessionData({ ...newSessionData, storeId: e.target.value })}
                                        className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-[4px] text-xs font-normal text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#001d35]"
                                    >
                                        {stores.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Responsable / Opérateur d'inventaire */}
                            <div>
                                <label className="block text-[11px] font-semibold text-[#001d35] uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                    <User className="w-3.5 h-3.5 text-[#001d35]" />
                                    <span>Opérateur / Responsable du comptage</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="Nom complet de l'agent effectuant le comptage..."
                                    value={newSessionData.supervisor}
                                    onChange={(e) => setNewSessionData({ ...newSessionData, supervisor: e.target.value })}
                                    className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-[4px] text-xs font-normal text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#001d35]"
                                    required
                                />
                                <p className="text-[10px] text-gray-400 mt-1">
                                    Identifie l'agent en charge du comptage physique sur le terrain (pré-rempli avec votre compte).
                                </p>
                            </div>

                            {/* Type d'inventaire */}
                            <div>
                                <label className="block text-[11px] font-semibold text-[#001d35] uppercase tracking-wider mb-1">
                                    Type d'Inventaire
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { type: 'CYCLIC', label: 'Tournant', desc: 'Par catégorie / rayon' },
                                        { type: 'ANNUAL', label: 'Annuel', desc: '100% du magasin' },
                                        { type: 'SPOT', label: 'Inopiné', desc: 'Contrôle surprise' }
                                    ].map(opt => (
                                        <button
                                            key={opt.type}
                                            type="button"
                                            onClick={() => setNewSessionData({ ...newSessionData, type: opt.type })}
                                            className={`p-2.5 rounded-[4px] border-2 text-left transition-all cursor-pointer ${
                                                newSessionData.type === opt.type
                                                    ? 'bg-blue-50 border-[#001d35] shadow-xs'
                                                    : 'bg-white border-gray-300 hover:bg-gray-50'
                                            }`}
                                        >
                                            <span className="block text-xs font-semibold text-[#001d35]">{opt.label}</span>
                                            <span className="block text-[10px] text-gray-500 mt-0.5 font-normal">{opt.desc}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Périmètre (Toutes catégories ou spécifique) */}
                            <div>
                                <label className="block text-[11px] font-semibold text-[#001d35] uppercase tracking-wider mb-1">
                                    Périmètre de l'Inventaire
                                </label>
                                <div className="space-y-2">
                                    <div className="flex gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-800">
                                            <input
                                                type="radio"
                                                name="scopeType"
                                                checked={newSessionData.scopeType === 'ALL'}
                                                onChange={() => setNewSessionData({ ...newSessionData, scopeType: 'ALL' })}
                                                className="accent-[#001d35]"
                                            />
                                            <span>Tout le catalogue ({products.length} articles)</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-800">
                                            <input
                                                type="radio"
                                                name="scopeType"
                                                checked={newSessionData.scopeType === 'CATEGORY'}
                                                onChange={() => setNewSessionData({ ...newSessionData, scopeType: 'CATEGORY' })}
                                                className="accent-[#001d35]"
                                            />
                                            <span>Filtrer par catégorie</span>
                                        </label>
                                    </div>

                                    {newSessionData.scopeType === 'CATEGORY' && (
                                        <div className="p-3 bg-gray-50 rounded-[4px] border border-gray-300 grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                                            {categories.map(cat => {
                                                const isChecked = newSessionData.selectedCategories.includes(cat.id);
                                                return (
                                                    <label key={cat.id} className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setNewSessionData({
                                                                        ...newSessionData,
                                                                        selectedCategories: [...newSessionData.selectedCategories, cat.id]
                                                                    });
                                                                } else {
                                                                    setNewSessionData({
                                                                        ...newSessionData,
                                                                        selectedCategories: newSessionData.selectedCategories.filter(id => id !== cat.id)
                                                                    });
                                                                }
                                                            }}
                                                            className="accent-[#001d35]"
                                                        />
                                                        <span className="truncate">{cat.name}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Option Comptage à l'aveugle */}
                            <div className="p-3 bg-purple-50/50 rounded-[4px] border border-purple-200 flex items-start gap-2.5">
                                <input
                                    type="checkbox"
                                    id="blindCount"
                                    checked={newSessionData.blindCount}
                                    onChange={(e) => setNewSessionData({ ...newSessionData, blindCount: e.target.checked })}
                                    className="mt-0.5 accent-purple-700"
                                />
                                <label htmlFor="blindCount" className="cursor-pointer">
                                    <span className="block text-xs font-semibold text-purple-900">Activer le comptage à l'aveugle</span>
                                    <span className="block text-[11px] text-purple-700 mt-0.5 font-normal">
                                        Masque le stock théorique aux magasiniers pour forcer un comptage physique réel sans complaisance.
                                    </span>
                                </label>
                            </div>

                            {/* Footer */}
                            <div className="p-3 bg-gray-50 border-t border-gray-200 flex justify-end items-center gap-2 -mx-4 -mb-3.5 mt-3">
                                <button
                                    type="button"
                                    onClick={() => setIsNewModalOpen(false)}
                                    className="px-3.5 py-1.5 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 rounded-[4px] transition-colors cursor-pointer"
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-1.5 text-xs font-semibold text-white bg-[#f77500] hover:bg-[#e66a00] rounded-[4px] shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>Lancer la Session</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── MODALE 2 : CONFIRMATION & CLÔTURE DE SESSION AVEC RÉGULARISATION ── */}
            {isClosingModalOpen && activeSession && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[110] p-4 animate-in fade-in duration-150">
                    <div className="bg-white rounded-[4px] shadow-2xl border-2 border-[#001d35] max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col">
                        {/* Header */}
                        <div className="bg-[#001d35] text-white px-4 py-3 flex items-center justify-between border-b-2 border-[#f77500]">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center shrink-0">
                                    <CheckSquare className="w-4 h-4 text-emerald-400" />
                                </div>
                                <div>
                                    <h3 className="text-xs font-semibold uppercase tracking-wider text-white">
                                        Clôture & Régularisation Officielle
                                    </h3>
                                    <p className="text-[10px] text-gray-300">Session #{activeSession.code}</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsClosingModalOpen(false)}
                                className="text-gray-300 hover:text-white p-1 rounded-[4px] transition-colors cursor-pointer"
                                title="Fermer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Contenu */}
                        <div className="p-4 space-y-3 text-xs">
                            <p className="text-gray-700 font-normal">
                                Vous êtes sur le point de valider définitivement cet inventaire. Cette opération va enregistrer les régularisations dans le Grand Livre :
                            </p>

                            <div className="space-y-2 bg-slate-50 p-3 rounded-[4px] border border-gray-200">
                                <div className="flex items-center justify-between pb-1.5 border-b border-gray-200">
                                    <span className="text-gray-600 font-normal">Opérateur de comptage :</span>
                                    <span className="font-semibold text-[#001d35] flex items-center gap-1">
                                        <User className="w-3.5 h-3.5 text-[#001d35]" />
                                        {activeSession.supervisor || 'Non renseigné'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between pb-1.5 border-b border-gray-200">
                                    <span className="text-gray-600 font-normal">Clôturé & validé par :</span>
                                    <span className="font-semibold text-emerald-800 flex items-center gap-1">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                        {currentUserName}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-gray-600 font-normal">Articles audités :</span>
                                    <span className="font-semibold text-gray-800">{activeSession.countedItems} / {activeSession.totalItems}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-gray-600 font-normal">Articles avec écart :</span>
                                    <span className="font-semibold text-amber-700">{activeSession.discrepancyCount}</span>
                                </div>
                                <div className="flex items-center justify-between pt-1 border-t border-gray-200">
                                    <span className="font-semibold text-gray-700">Impact Financier Net :</span>
                                    <span className={`font-semibold text-sm ${activeSession.netFinancialImpact < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                                        {formatPrice(activeSession.netFinancialImpact)}
                                    </span>
                                </div>
                            </div>

                            <div className="p-3 bg-amber-50 rounded-[4px] border border-amber-200 text-amber-900 text-xs space-y-1">
                                <p className="font-semibold flex items-center gap-1">
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                    Mise à jour automatique du Grand Livre :
                                </p>
                                <p className="font-normal text-[11px] leading-relaxed">
                                    Le stock physique réel de chaque article sera réaligné dans l'ERP, et des lignes d'ajustement officiel seront générées dans l'écran <strong>Mouvements & Ajustements</strong>.
                                </p>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-3 bg-gray-50 border-t border-gray-200 flex justify-end items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setIsClosingModalOpen(false)}
                                className="px-3.5 py-1.5 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 rounded-[4px] transition-colors cursor-pointer"
                            >
                                Annuler
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmCloseSession}
                                className="px-4 py-1.5 text-xs font-semibold text-white bg-[#001d35] hover:bg-[#00284a] rounded-[4px] shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Régulariser & Fermer</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═════════════════════════════════════════════════════════════════════ */}
            {/* OVERLAY LOADER DE VALIDATION (Au moins 1,5s avant affichage du Toast)  */}
            {/* Identique à Réapprovisionnement Intelligent                           */}
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
                            Inventaire Physique & Contrôle des Stocks
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InventoryCheck;
