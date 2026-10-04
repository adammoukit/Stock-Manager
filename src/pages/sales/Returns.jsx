import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useSales } from '../../context/SalesContext';
import { useInventory } from '../../context/InventoryContext';
import { useSession } from '../../context/SessionContext';
import { useAuth } from '../../context/AuthContext';
import { formatPrice } from '../../utils/currency';
import ReturnReceipt from '../../components/ReturnReceipt';
import FinancialInput from '../../components/FinancialInput';
import T from '../../utils/toast';
import { 
    format, 
    startOfDay, 
    endOfDay, 
    startOfWeek, 
    endOfWeek, 
    startOfMonth, 
    endOfMonth, 
    startOfQuarter, 
    endOfQuarter, 
    startOfYear, 
    endOfYear, 
    isWithinInterval, 
    parseISO 
} from 'date-fns';
import { fr } from 'date-fns/locale';
import {
    RotateCcw, Ticket, Banknote, ShieldAlert, ShieldCheck, CheckCircle2,
    AlertTriangle, Search, Plus, Filter, Printer, Eye, Copy, ArrowRight,
    Package, ArrowLeftRight, Clock, User, Calendar, Check, X, Building2,
    Layers, AlertCircle
} from 'lucide-react';

const Returns = () => {
    const { returns, creditNotes, createReturn, transactions } = useSales();
    const { products } = useInventory();
    const { activeSession } = useSession();
    const { user } = useAuth();

    const [nowTimestamp] = useState(() => Date.now());

    // ── Filtre de Période (Par défaut : Aujourd'hui) ──
    const [period, setPeriod] = useState('day'); // 'day' | 'week' | 'month' | 'quarter' | 'year' | 'all' | 'custom'
    const [customStartDate, setCustomStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    const [customEndDate, setCustomEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

    const [activeTab, setActiveTab] = useState('returns'); // 'returns' | 'creditNotes' | 'activeVouchers'

    // ── Suivi des retours déjà vus (partagé avec Sidebar via localStorage) ──
    const [lastSeenReturnsCount, setLastSeenReturnsCount] = useState(() => {
        try { return parseInt(localStorage.getItem('kblx_sidebar_seen_returns') || '0', 10); }
        catch { return 0; }
    });

    // Quand on clique sur l'onglet "Registre des Retours", on marque tout comme vu
    const markReturnsAsSeen = () => {
        const count = returns.length;
        setLastSeenReturnsCount(count);
        try { localStorage.setItem('kblx_sidebar_seen_returns', String(count)); } catch {}
    };
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [methodFilter, setMethodFilter] = useState('all');

    // ── Loader de 1 seconde lors du clic sur les filtres ──
    const [filterLoading, setFilterLoading] = useState(false);
    const filterTimerRef = useRef(null);

    const handleFilterChange = (setter, value) => {
        setFilterLoading(true);
        setter(value);
        if (filterTimerRef.current) clearTimeout(filterTimerRef.current);
        filterTimerRef.current = setTimeout(() => {
            setFilterLoading(false);
        }, 1000);
    };

    useEffect(() => {
        return () => {
            if (filterTimerRef.current) clearTimeout(filterTimerRef.current);
        };
    }, []);

    // Receipt modal states
    const [viewingReturn, setViewingReturn] = useState(null);
    const [viewingCreditNote, setViewingCreditNote] = useState(null);

    // New Return Assistant Modal state
    const [showNewReturnModal, setShowNewReturnModal] = useState(false);
    const [modalStep, setModalStep] = useState(1); // 1 = Find Sale / Mode, 2 = Select Items & Condition, 3 = Resolution & Confirm

    // New Return Form State
    const [returnMode, setReturnMode] = useState('with_sale'); // 'with_sale' | 'free'
    const [selectedSale, setSelectedSale] = useState(null);
    const [saleSearchQuery, setSaleSearchQuery] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [selectedClientId, setSelectedClientId] = useState('');
    const [siteName, setSiteName] = useState('');
    const [returnedItems, setReturnedItems] = useState([]); // [{ id, productId, name, unit, unitPrice, maxQty, quantityReturned, condition: 'intact'|'damaged' }]
    const [refundMethod, setRefundMethod] = useState('avoir'); // 'avoir' | 'cash' | 'debt_deduction'
    const [reason, setReason] = useState('Surplus de chantier');
    const [customReason, setCustomReason] = useState('');
    const [notes, setNotes] = useState('');

    // Free product search for 'free' return mode
    const [productSearchQuery, setProductSearchQuery] = useState('');

    // Pre-filtered sales for modal selection
    const filteredSales = useMemo(() => {
        const query = saleSearchQuery.toLowerCase().trim();
        if (!query) return transactions.slice(0, 8);
        return transactions.filter(t => {
            const idMatch = String(t.id).includes(query);
            const numMatch = t.transactionNumber && t.transactionNumber.toLowerCase().includes(query);
            const clientMatch = t.customerName && t.customerName.toLowerCase().includes(query);
            return idMatch || numMatch || clientMatch;
        }).slice(0, 10);
    }, [transactions, saleSearchQuery]);

    // ── Résolution des intervalles temporels ────────────────────────
    const { currentRange, periodLabel } = useMemo(() => {
        const now = new Date();
        let currStart, currEnd, label;

        switch (period) {
            case 'day':
                currStart = startOfDay(now);
                currEnd = endOfDay(now);
                label = `Aujourd'hui (${format(now, 'dd/MM/yyyy')})`;
                break;

            case 'week':
                currStart = startOfWeek(now, { weekStartsOn: 1 });
                currEnd = endOfWeek(now, { weekStartsOn: 1 });
                label = `Cette Semaine (du ${format(currStart, 'dd/MM')} au ${format(currEnd, 'dd/MM')})`;
                break;

            case 'month':
                currStart = startOfMonth(now);
                currEnd = endOfMonth(now);
                label = `Ce Mois (${format(now, 'MMMM yyyy', { locale: fr })})`;
                break;

            case 'quarter':
                currStart = startOfQuarter(now);
                currEnd = endOfQuarter(now);
                label = `Ce Trimestre (T${Math.floor(now.getMonth() / 3) + 1} ${now.getFullYear()})`;
                break;

            case 'year':
                currStart = startOfYear(now);
                currEnd = endOfYear(now);
                label = `Cette Année (${now.getFullYear()})`;
                break;

            case 'custom':
                try {
                    currStart = startOfDay(parseISO(customStartDate));
                    currEnd = endOfDay(parseISO(customEndDate));
                    label = `Du ${format(currStart, 'dd/MM/yyyy')} au ${format(currEnd, 'dd/MM/yyyy')}`;
                } catch (e) {
                    currStart = startOfMonth(now);
                    currEnd = endOfMonth(now);
                    label = "Période Personnalisée";
                }
                break;

            case 'all':
            default:
                currStart = null;
                currEnd = null;
                label = "Tout l'historique";
                break;
        }

        return {
            currentRange: { start: currStart, end: currEnd },
            periodLabel: label
        };
    }, [period, customStartDate, customEndDate]);

    // ── Retours filtrés par Période ──────────────────────────────────
    const periodReturns = useMemo(() => {
        if (period === 'all' || !currentRange.start) return returns;
        return returns.filter(r => {
            const rawDate = r.date || r.createdAt;
            if (!rawDate) return false;
            const d = new Date(rawDate);
            if (isNaN(d.getTime())) return true;
            return isWithinInterval(d, { start: currentRange.start, end: currentRange.end });
        });
    }, [returns, period, currentRange]);

    // ── Bons d'avoir filtrés par Période (Date d'émission) ────────────
    const periodCreditNotes = useMemo(() => {
        if (period === 'all' || !currentRange.start) return creditNotes;
        return creditNotes.filter(c => {
            const rawDate = c.createdAt || c.date || c.issuedAt;
            if (!rawDate) return false;
            const d = new Date(rawDate);
            if (isNaN(d.getTime())) return true;
            return isWithinInterval(d, { start: currentRange.start, end: currentRange.end });
        });
    }, [creditNotes, period, currentRange]);

    // ── Tous les Bons d'Avoir Actifs (indépendant de la période) ────────
    const allActiveCreditNotes = useMemo(() => {
        return (creditNotes || []).filter(c => c.status === 'active' || c.status === 'partial');
    }, [creditNotes]);

    const filteredAllActiveCreditNotes = useMemo(() => {
        return allActiveCreditNotes.filter(c => {
            const matchSearch = !searchTerm ||
                (c.code && c.code.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (c.customerName && c.customerName.toLowerCase().includes(searchTerm.toLowerCase()));
            return matchSearch;
        });
    }, [allActiveCreditNotes, searchTerm]);

    // Nombre de retours non encore vus (nouveaux depuis dernier clic sur l'onglet)
    const newReturnsCount = Math.max(0, (returns || []).length - lastSeenReturnsCount);
    // Avoirs actifs dans la période
    const activeInPeriodCount = periodCreditNotes.filter(c => c.status === 'active' || c.status === 'partial').length;

    // KPI Metrics — basés sur TOUTES les données (indépendants de la période)
    const metrics = useMemo(() => {
        // Retours globaux (tout l'historique)
        const totalReturnsCount = (returns || []).length;
        const totalReturnsAmount = (returns || []).reduce((sum, r) => sum + (r.totalAmount || 0), 0);

        // Avoirs actifs/partiels globaux (solde disponible réel)
        const activeAvoirs = allActiveCreditNotes;
        const activeAvoirsTotal = activeAvoirs.reduce((sum, c) => sum + (c.remainingAmount || 0), 0);

        // Reliquats spécifiques (change_reliquat)
        const activeReliquats = activeAvoirs.filter(c => c.type === 'change_reliquat');
        const reliquatCount = activeReliquats.length;
        const reliquatTotal = activeReliquats.reduce((sum, c) => sum + (c.remainingAmount || 0), 0);

        // Articles réintégrés / avariés sur toute l'histoire
        let totalReintegratedItems = 0;
        let totalDamagedItems = 0;

        (returns || []).forEach(r => {
            (r.items || []).forEach(item => {
                const qty = item.quantityReturned || item.quantity || 0;
                if (item.condition === 'intact' || item.reintegrated) {
                    totalReintegratedItems += qty;
                } else {
                    totalDamagedItems += qty;
                }
            });
        });

        const totalItemsCount = totalReintegratedItems + totalDamagedItems;
        const damagedRate = totalItemsCount > 0 ? ((totalDamagedItems / totalItemsCount) * 100).toFixed(1) : 0;

        // Métriques de la période choisie (affichées en sous-titre)
        const periodReturnsCount = periodReturns.length;
        const periodReturnsAmount = periodReturns.reduce((sum, r) => sum + (r.totalAmount || 0), 0);

        return {
            totalReturnsCount,
            totalReturnsAmount,
            activeAvoirsCount: activeAvoirs.length,
            activeAvoirsTotal,
            reliquatCount,
            reliquatTotal,
            totalReintegratedItems,
            totalDamagedItems,
            damagedRate,
            // Sous-totaux de la période pour les sous-titres
            periodReturnsCount,
            periodReturnsAmount
        };
    }, [returns, allActiveCreditNotes, periodReturns]);

    // Filtered returns table
    const filteredReturns = useMemo(() => {
        return periodReturns.filter(r => {
            const matchSearch = !searchTerm ||
                (r.returnNumber && r.returnNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (r.customerName && r.customerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (r.voucherCode && r.voucherCode.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (r.transactionNumber && r.transactionNumber.toLowerCase().includes(searchTerm.toLowerCase()));

            const matchMethod = methodFilter === 'all' || r.refundMethod === methodFilter;

            return matchSearch && matchMethod;
        });
    }, [periodReturns, searchTerm, methodFilter]);

    // Filtered credit notes table
    const filteredCreditNotes = useMemo(() => {
        return periodCreditNotes.filter(c => {
            const matchSearch = !searchTerm ||
                (c.code && c.code.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (c.customerName && c.customerName.toLowerCase().includes(searchTerm.toLowerCase()));

            const matchStatus = statusFilter === 'all' || c.status === statusFilter;

            return matchSearch && matchStatus;
        });
    }, [periodCreditNotes, searchTerm, statusFilter]);

    // Open Return modal from sale
    const handleSelectSale = (sale) => {
        setSelectedSale(sale);
        setCustomerName(sale.customerName || 'Client Comptoir');
        setSelectedClientId(sale.clientId || '');
        setSiteName(sale.siteName || '');

        // Pre-populate items
        const initialItems = (sale.items || []).map(item => ({
            productId: item.id || item.productId,
            name: item.name,
            unit: item.unit || 'U.',
            unitPrice: item.price || item.unitPrice || 0,
            maxQty: item.inputQuantity || item.quantity || 1,
            quantityReturned: 1,
            condition: 'intact',
            selected: true
        }));

        setReturnedItems(initialItems);
        setModalStep(2);
    };

    // Calculate total refund of selected return items
    const calculatedTotalRefund = useMemo(() => {
        return returnedItems
            .filter(i => i.selected)
            .reduce((sum, i) => sum + (parseFloat(i.quantityReturned || 0) * parseFloat(i.unitPrice || 0)), 0);
    }, [returnedItems]);

    // Add product in free mode
    const handleAddFreeProduct = (product) => {
        const existing = returnedItems.find(i => i.productId === product.id);
        if (existing) {
            setReturnedItems(returnedItems.map(i =>
                i.productId === product.id
                    ? { ...i, quantityReturned: i.quantityReturned + 1 }
                    : i
            ));
        } else {
            setReturnedItems([
                ...returnedItems,
                {
                    productId: product.id,
                    name: product.name,
                    unit: product.unit || 'U.',
                    unitPrice: product.price || 0,
                    maxQty: 999,
                    quantityReturned: 1,
                    condition: 'intact',
                    selected: true
                }
            ]);
        }
        setProductSearchQuery('');
    };

    // Submit new return
    const handleSubmitReturn = () => {
        const activeItems = returnedItems.filter(i => i.selected && i.quantityReturned > 0);

        if (activeItems.length === 0) {
            T.warning('Veuillez sélectionner au moins un article à retourner.');
            return;
        }

        const effectiveReason = reason === 'Autre' ? (customReason || 'Autre motif') : reason;

        const cashierName = activeSession?.cashierName ||
            (user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : (user?.name || user?.username || 'Caissier'));

        try {
            const result = createReturn({
                saleId: selectedSale ? selectedSale.id : null,
                transactionNumber: selectedSale ? (selectedSale.transactionNumber || selectedSale.id) : null,
                customerName: customerName.trim() || 'Client Comptoir',
                clientId: selectedClientId || null,
                siteName: siteName || null,
                items: activeItems,
                refundMethod,
                reason: effectiveReason,
                cashierName,
                notes
            });

            T.success(
                refundMethod === 'avoir'
                    ? `Bon d'avoir émis : ${result.creditNote.code} (${formatPrice(result.returnRecord.totalAmount)})`
                    : refundMethod === 'cash'
                    ? `Remboursement espèces de ${formatPrice(result.returnRecord.totalAmount)} effectué et tracé en caisse !`
                    : `Déduction créance effectuée (${formatPrice(result.returnRecord.totalAmount)})`
            );

            // Close modal & open printable receipt
            setShowNewReturnModal(false);
            setViewingReturn(result.returnRecord);
            setViewingCreditNote(result.creditNote || null);

            // Reset form
            setSelectedSale(null);
            setReturnedItems([]);
            setModalStep(1);
        } catch (error) {
            console.error('Erreur lors du retour :', error);
            T.error('Erreur lors du traitement du retour.');
        }
    };

    const handleCopyCode = (code) => {
        navigator.clipboard.writeText(code);
        T.success(`Code ${code} copié !`);
    };

    return (
        <div className="space-y-2.5 font-sans">
            {/* ── EN-TÊTE ÉCRAN OFFICIEL KABLLIX ERP (COMPACT & ÉPURÉ) ── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-white px-3 py-2 rounded-[4px] border-2 border-gray-300 shadow-xs">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="p-1.5 bg-[#001d35] text-white rounded-[4px]">
                            <RotateCcw className="w-3.5 h-3.5 text-[#f77500]" />
                        </span>
                        <h1 className="text-sm sm:text-base font-bold text-[#001d35] tracking-tight">
                            Retours d'Articles & Bons d'Avoir
                        </h1>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => {
                            setModalStep(1);
                            setSelectedSale(null);
                            setReturnedItems([]);
                            setShowNewReturnModal(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-[4px] bg-[#001d35] hover:bg-[#00284a] text-white transition-all cursor-pointer shadow-xs active:scale-95"
                    >
                        <Plus className="w-3.5 h-3.5 text-[#f77500]" />
                        <span>Nouveau Retour Client</span>
                    </button>
                </div>
            </div>

            {/* ─── BARRE DES ONGLETS DE PÉRIODE COMPACTE ─── */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-1.5 sm:px-2.5 sm:py-1.5 rounded-[4px] border-2 border-gray-300 shadow-xs print:hidden">
                <div className="flex flex-wrap items-center gap-1 bg-gray-100/80 p-0.5 rounded-[4px] border border-gray-300">
                    {[
                        { key: 'day', label: "Aujourd'hui" },
                        { key: 'week', label: 'Hebdomadaire' },
                        { key: 'month', label: 'Ce mois' },
                        { key: 'quarter', label: 'Trimestrielle' },
                        { key: 'year', label: 'Annuelle' },
                        { key: 'all', label: "Tout l'historique" },
                        { key: 'custom', label: 'Personnalisée' }
                    ].map(opt => (
                        <button
                            key={opt.key}
                            type="button"
                            onClick={() => handleFilterChange(setPeriod, opt.key)}
                            className={`px-2.5 py-1 text-xs font-semibold rounded-[4px] transition-all cursor-pointer ${
                                period === opt.key
                                    ? 'bg-[#001d35] text-white shadow-xs'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                            }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>

                {/* Filtre Date Personnalisée si sélectionné */}
                {period === 'custom' && (
                    <div className="flex items-center gap-1.5 bg-gray-50 px-2 py-0.5 rounded-[4px] border border-gray-300">
                        <input
                            type="date"
                            value={customStartDate}
                            onChange={(e) => handleFilterChange(setCustomStartDate, e.target.value)}
                            className="bg-white border border-gray-300 text-gray-800 text-xs rounded-[4px] px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-[#001d35]"
                        />
                        <span className="text-gray-400 text-xs font-semibold">au</span>
                        <input
                            type="date"
                            value={customEndDate}
                            onChange={(e) => handleFilterChange(setCustomEndDate, e.target.value)}
                            className="bg-white border border-gray-300 text-gray-800 text-xs rounded-[4px] px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-[#001d35]"
                        />
                    </div>
                )}

                <div className="flex items-center gap-1.5 text-xs text-gray-600 font-medium pr-1">
                    <Calendar className="w-3.5 h-3.5 text-[#001d35]" />
                    <span>Période : <strong className="text-[#001d35] font-semibold">{periodLabel}</strong></span>
                </div>
            </div>

            {/* ── 4 CARTES KPI (MÊME ASPECT EXACT QUE LA GESTION DES SESSIONS) ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. Retours Effectués */}
                <div className="bg-white p-3 rounded-sm border-2 border-gray-300 shadow-sm relative group hover:shadow-md transition-shadow overflow-hidden flex flex-col justify-center min-h-[120px]">
                    {filterLoading ? (
                        <div className="flex flex-col items-center justify-center py-4">
                            <div className="relative h-8 w-8">
                                <div className="absolute inset-0 animate-spin rounded-full border-2 border-t-transparent border-[#001d35]"></div>
                                <div className="absolute inset-1 animate-spin-reverse rounded-full border-2 border-b-transparent border-[#f77500] opacity-60"></div>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="flex justify-between items-start relative z-10">
                                <div className="flex-1">
                                    <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-blue-600/70">Retours Effectués</p>
                                    <div className="flex items-baseline mt-2 font-semibold opacity-85" style={{ color: '#001d35', opacity: 0.85 }}>
                                        <h3 className="text-xl sm:text-2xl font-semibold">{formatPrice(metrics.totalReturnsAmount)}</h3>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1.5 font-medium">
                                        {metrics.totalReturnsCount} retour(s) au total
                                        {period !== 'all' && metrics.periodReturnsCount !== metrics.totalReturnsCount && (
                                            <span className="ml-1 text-blue-500 font-semibold">· {metrics.periodReturnsCount} cette période</span>
                                        )}
                                    </p>
                                </div>
                            </div>
                            <img src="/icons8/fluency_240_cash-in-hand.png" alt="" className="absolute bottom-2 right-2 w-16 h-16 opacity-25 group-hover:opacity-40 group-hover:scale-105 transition-all pointer-events-none" />
                        </>
                    )}
                </div>

                {/* 2. Avoirs Actifs en Cours */}
                <div className="bg-white p-3 rounded-sm border-2 border-gray-300 shadow-sm relative group hover:shadow-md transition-shadow overflow-hidden flex flex-col justify-center min-h-[120px]">
                    {filterLoading ? (
                        <div className="flex flex-col items-center justify-center py-4">
                            <div className="relative h-8 w-8">
                                <div className="absolute inset-0 animate-spin rounded-full border-2 border-t-transparent border-[#001d35]"></div>
                                <div className="absolute inset-1 animate-spin-reverse rounded-full border-2 border-b-transparent border-[#f77500] opacity-60"></div>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="flex justify-between items-start relative z-10">
                                <div className="flex-1">
                                    <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-amber-600/80">Avoirs Actifs</p>
                                    <div className="flex items-baseline mt-2 font-semibold opacity-85" style={{ color: '#b45309', opacity: 0.85 }}>
                                        <h3 className="text-xl sm:text-2xl font-semibold">{formatPrice(metrics.activeAvoirsTotal)}</h3>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1.5 font-medium">
                                        {metrics.activeAvoirsCount} bon(s) prêts au rachat POS
                                    </p>
                                    {metrics.reliquatCount > 0 && (
                                        <div className="mt-1.5 flex items-center gap-1.5">
                                            <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 border border-amber-400 font-black px-2 py-0.5 rounded-[3px] text-[10px] uppercase tracking-wider animate-pulse">
                                                🎟️ {metrics.reliquatCount} Reliquat{metrics.reliquatCount > 1 ? 's' : ''} : {formatPrice(metrics.reliquatTotal)}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <img src="/icons8/fluency_240_banknotes.png" alt="" className="absolute bottom-2 right-2 w-16 h-16 opacity-25 group-hover:opacity-40 group-hover:scale-105 transition-all pointer-events-none" />
                        </>
                    )}
                </div>

                {/* 3. Articles Réintégrés */}
                <div className="bg-white p-3 rounded-sm border-2 border-gray-300 shadow-sm relative group hover:shadow-md transition-shadow overflow-hidden flex flex-col justify-center min-h-[120px]">
                    {filterLoading ? (
                        <div className="flex flex-col items-center justify-center py-4">
                            <div className="relative h-8 w-8">
                                <div className="absolute inset-0 animate-spin rounded-full border-2 border-t-transparent border-[#001d35]"></div>
                                <div className="absolute inset-1 animate-spin-reverse rounded-full border-2 border-b-transparent border-[#f77500] opacity-60"></div>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="flex justify-between items-start relative z-10">
                                <div className="flex-1">
                                    <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-emerald-600/80">Articles Réintégrés</p>
                                    <div className="flex items-baseline mt-2 font-semibold opacity-85" style={{ color: '#059669', opacity: 0.85 }}>
                                        <h3 className="text-xl sm:text-2xl font-semibold">{metrics.totalReintegratedItems} unités</h3>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1.5 font-medium">Total remises en stock physique</p>
                                </div>
                            </div>
                            <img src="/icons8/fluency_240_box.png" alt="" className="absolute bottom-2 right-2 w-16 h-16 opacity-25 group-hover:opacity-40 group-hover:scale-105 transition-all pointer-events-none" />
                        </>
                    )}
                </div>

                {/* 4. Avaries / Rebuts */}
                <div className="bg-white p-3 rounded-sm border-2 border-gray-300 shadow-sm relative group hover:shadow-md transition-shadow overflow-hidden flex flex-col justify-center min-h-[120px]">
                    {filterLoading ? (
                        <div className="flex flex-col items-center justify-center py-4">
                            <div className="relative h-8 w-8">
                                <div className="absolute inset-0 animate-spin rounded-full border-2 border-t-transparent border-[#001d35]"></div>
                                <div className="absolute inset-1 animate-spin-reverse rounded-full border-2 border-b-transparent border-[#f77500] opacity-60"></div>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="flex justify-between items-start relative z-10">
                                <div className="flex-1">
                                    <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-rose-600/80">Avaries & Rebuts</p>
                                    <div className="flex items-baseline mt-2 font-semibold opacity-85" style={{ color: '#e11d48', opacity: 0.85 }}>
                                        <h3 className="text-xl sm:text-2xl font-semibold">{metrics.totalDamagedItems} unités</h3>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1.5 font-medium">{metrics.damagedRate}% de taux de rebut</p>
                                </div>
                            </div>
                            <img src="/icons8/fluency_240_high-priority.png" alt="" className="absolute bottom-2 right-2 w-16 h-16 opacity-25 group-hover:opacity-40 group-hover:scale-105 transition-all pointer-events-none" />
                        </>
                    )}
                </div>
            </div>

            {/* ── BARRE UNIFIÉE ONGLETS & FILTRES (TAILLE NÉCESSAIRE COMPACTE) ── */}
            <div className="bg-white p-1.5 sm:p-2 rounded-[4px] border-2 border-gray-300 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-2">
                {/* Onglets avec badges */}
                <div className="flex items-center gap-1 bg-gray-100/80 p-0.5 rounded-[4px] border border-gray-300 flex-wrap">
                    <button
                        type="button"
                        onClick={() => {
                            handleFilterChange(setActiveTab, 'returns');
                            markReturnsAsSeen();
                        }}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-[4px] transition-all cursor-pointer flex items-center gap-2 ${
                            activeTab === 'returns'
                                ? 'bg-[#001d35] text-white shadow-xs'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                        }`}
                    >
                        <RotateCcw className={`w-3.5 h-3.5 ${activeTab === 'returns' ? 'text-[#f77500]' : 'text-gray-500'}`} />
                        <span>Registre des Retours</span>
                        {/* Badge : uniquement les nouveaux retours non encore vus */}
                        {newReturnsCount > 0 && (
                            <span className="min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold bg-red-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs animate-pulse">
                                {newReturnsCount}
                            </span>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={() => handleFilterChange(setActiveTab, 'creditNotes')}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-[4px] transition-all cursor-pointer flex items-center gap-2 ${
                            activeTab === 'creditNotes'
                                ? 'bg-[#001d35] text-white shadow-xs'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                        }`}
                    >
                        <Ticket className={`w-3.5 h-3.5 ${activeTab === 'creditNotes' ? 'text-[#f77500]' : 'text-gray-500'}`} />
                        <span>Portefeuille Bons d'Avoir</span>
                        {/* Badge : uniquement les avoirs actifs/partiels dans la période */}
                        {activeInPeriodCount > 0 && (
                            <span className="min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold bg-amber-500 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                                {activeInPeriodCount}
                            </span>
                        )}
                    </button>

                    {/* Nouvel onglet : Tous les Avoirs Actifs (indépendant de la date) */}
                    <button
                        type="button"
                        onClick={() => handleFilterChange(setActiveTab, 'activeVouchers')}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-[4px] transition-all cursor-pointer flex items-center gap-1.5 ${
                            activeTab === 'activeVouchers'
                                ? 'bg-[#001d35] text-white shadow-xs'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                        }`}
                    >
                        <span className="flex items-center -space-x-1.5 flex-shrink-0">
                            <Ticket className={`w-3.5 h-3.5 ${activeTab === 'activeVouchers' ? 'text-[#f77500]' : 'text-gray-500'}`} />
                            <Ticket className={`w-3.5 h-3.5 ${activeTab === 'activeVouchers' ? 'text-[#f77500]' : 'text-gray-500'}`} />
                        </span>
                        <span>Tous les Avoirs Actifs</span>
                        {allActiveCreditNotes.length > 0 && (
                            <span className="min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                                {allActiveCreditNotes.length}
                            </span>
                        )}
                    </button>
                </div>

                {/* Filtres et Recherche ajustés à la taille nécessaire */}
                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    <div className="relative w-full sm:w-56">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-gray-400" />
                        <input
                            type="text"
                            placeholder={activeTab === 'returns' ? "Rechercher N° retour, client..." : "Rechercher code d'avoir, client..."}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-8 pr-2.5 py-1 text-xs bg-gray-50 border border-gray-300 focus:border-[#001d35] rounded-[4px] font-medium text-gray-800 focus:outline-none"
                        />
                    </div>

                    <div>
                        {activeTab === 'returns' ? (
                            <select
                                value={methodFilter}
                                onChange={(e) => handleFilterChange(setMethodFilter, e.target.value)}
                                className="text-xs bg-gray-50 border border-gray-300 focus:border-[#001d35] rounded-[4px] px-2.5 py-1 font-semibold text-gray-700 focus:outline-none cursor-pointer"
                            >
                                <option value="all">Tous règlements</option>
                                <option value="avoir">Bon d'Avoir (Crédit)</option>
                                <option value="cash">Remboursement Espèces</option>
                                <option value="debt_deduction">Déduction Dette</option>
                            </select>
                        ) : activeTab === 'creditNotes' ? (
                            <select
                                value={statusFilter}
                                onChange={(e) => handleFilterChange(setStatusFilter, e.target.value)}
                                className="text-xs bg-gray-50 border border-gray-300 focus:border-[#001d35] rounded-[4px] px-2.5 py-1 font-semibold text-gray-700 focus:outline-none cursor-pointer"
                            >
                                <option value="all">Tous statuts</option>
                                <option value="active">Actif (Rachat)</option>
                                <option value="partial">Partiel</option>
                                <option value="used">Consommé</option>
                                <option value="cancelled">Expiré / Annulé</option>
                            </select>
                        ) : null}
                    </div>
                </div>
            </div>

            {/* ── TABLEAU GRAND LIVRE DES RETOURS & AVOIRS ── */}
            <div className="bg-white border-2 border-gray-300 rounded-[4px] shadow-xs overflow-hidden">
                <div className="px-3 py-1.5 border-b-2 border-gray-300 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 bg-white">
                    <span className="text-xs font-bold text-[#001d35] uppercase tracking-wider">
                        {activeTab === 'returns' ? "Grand Livre des Retours de Marchandises"
                            : activeTab === 'activeVouchers' ? "Tous les Bons d'Avoir Actifs — Sans restriction de date"
                            : "Portefeuille Officiel des Bons d'Avoir"}
                    </span>
                    <span className="text-[10px] font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-[4px] border border-gray-300">
                        {activeTab === 'returns' ? `${filteredReturns.length} retour(s)`
                            : activeTab === 'activeVouchers' ? `${filteredAllActiveCreditNotes.length} avoir(s) actif(s)`
                            : `${filteredCreditNotes.length} bon(s)`}
                    </span>
                </div>

                <div className="overflow-x-auto">
                    {filterLoading ? (
                        <div className="p-10 min-h-[160px] flex flex-col items-center justify-center bg-white animate-in fade-in duration-150">
                            <div className="relative h-8 w-8">
                                <div className="absolute inset-0 animate-spin rounded-full border-2 border-gray-200 border-t-[#001d35]"></div>
                                <div className="absolute inset-1 animate-spin-reverse rounded-full border-2 border-transparent border-b-[#f77500]"></div>
                            </div>
                            <p className="text-xs font-bold text-[#001d35] mt-2 uppercase tracking-wider">
                                Synchronisation...
                            </p>
                        </div>
                    ) : activeTab === 'returns' ? (
                        filteredReturns.length === 0 ? (
                            <div className="p-8 min-h-[160px] flex flex-col items-center justify-center text-center text-gray-400">
                                <RotateCcw className="w-8 h-8 mx-auto text-gray-300 mb-1.5 opacity-50" />
                                <p className="text-xs font-bold text-gray-600 uppercase">
                                    {period !== 'all' ? `Aucun retour enregistré (${periodLabel})` : "Aucun retour enregistré"}
                                </p>
                                <p className="text-[11px] text-gray-400 mt-0.5">
                                    {period !== 'all' ? "Essayez de sélectionner « Tout l'historique » ou ajustez la période." : "Cliquez sur « Nouveau Retour Client » pour enregistrer un retour."}
                                </p>
                            </div>
                        ) : (
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-[#001d35] text-white font-bold uppercase tracking-wider text-[10px] divide-x divide-white/10 sticky top-0">
                                        <th className="py-1.5 px-2.5">Date & Heure</th>
                                        <th className="py-1.5 px-2.5">N° de Retour</th>
                                        <th className="py-1.5 px-2.5">Client & Chantier</th>
                                        <th className="py-1.5 px-2.5">Vente Liée</th>
                                        <th className="py-1.5 px-2.5">Articles Retournés</th>
                                        <th className="py-1.5 px-2.5 text-right">Montant Remboursé</th>
                                        <th className="py-1.5 px-2.5 text-center">Règlement</th>
                                        <th className="py-1.5 px-2.5 text-center">Stock</th>
                                        <th className="py-1.5 px-2.5 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {filteredReturns.map((r, rIdx) => {
                                        const isAvoir = r.refundMethod === 'avoir';
                                        const isCash = r.refundMethod === 'cash';
                                        const intactCount = (r.items || []).filter(i => i.condition === 'intact' || i.reintegrated).length;
                                        const damagedCount = (r.items || []).filter(i => i.condition === 'damaged' && !i.reintegrated).length;
                                        // Les retours "anciens" déjà vus ont une opacité réduite
                                        // Les retours "nouveaux" (non vus) = index 0..newReturnsCount-1 dans la liste globale
                                        const globalIdx = returns.findIndex(x => x.id === r.id);
                                        const isNew = globalIdx >= 0 && globalIdx < newReturnsCount;
                                        // Si aucun nouveau : tous visibles normalement. Si nouveaux : les anciens s'estompent.
                                        const dimmed = newReturnsCount > 0 && !isNew;

                                        return (
                                            <tr key={r.id} className={`hover:bg-blue-50/40 odd:bg-gray-50/50 transition-all ${dimmed ? 'opacity-45' : ''}`}>
                                                <td className="py-1.5 px-2.5 whitespace-nowrap">
                                                    <div className="font-semibold text-gray-900">
                                                        {format(new Date(r.date), 'dd/MM/yyyy')}
                                                    </div>
                                                    <div className="text-[10px] text-gray-500 font-medium">
                                                        {format(new Date(r.date), 'HH:mm')}
                                                    </div>
                                                </td>
                                                <td className="py-1.5 px-2.5 font-semibold text-[#001d35] whitespace-nowrap tracking-wide">
                                                    {r.returnNumber}
                                                </td>
                                                <td className="py-1.5 px-2.5">
                                                    <p className="font-semibold text-gray-900">{r.customerName || 'Client Comptoir'}</p>
                                                    {r.siteName && (
                                                        <p className="text-[10px] text-gray-500 font-medium">Chantier : {r.siteName}</p>
                                                    )}
                                                </td>
                                                <td className="py-1.5 px-2.5 text-gray-600 whitespace-nowrap font-medium">
                                                    {r.transactionNumber ? (
                                                        <span className="bg-gray-100 border border-gray-300 px-1.5 py-0.5 rounded-[4px] font-semibold text-gray-800 text-[11px]">
                                                             {r.transactionNumber}
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-400 italic text-[11px]">Comptoir libre</span>
                                                    )}
                                                </td>
                                                <td className="py-1.5 px-2.5 max-w-xs">
                                                    <div className="flex flex-wrap gap-1">
                                                        {(r.items || []).map((it, idx) => (
                                                            <span key={idx} className="bg-gray-100 border border-gray-300 text-gray-700 px-1.5 py-0.5 rounded-[4px] text-[10px] font-medium flex items-center gap-1">
                                                                {it.name} <strong className="text-gray-900 font-semibold">x{it.quantityReturned || it.quantity}</strong>
                                                            </span>
                                                        ))}
                                                    </div>
                                                    {r.reason && (
                                                        <p className="text-[10px] text-gray-500 italic mt-0.5">Motif : {r.reason}</p>
                                                    )}
                                                </td>
                                                <td className="py-1.5 px-2.5 text-right font-semibold text-[#001d35] whitespace-nowrap text-xs tracking-tight">
                                                    {formatPrice(r.totalAmount)}
                                                </td>
                                                <td className="py-1.5 px-2.5 text-center whitespace-nowrap">
                                                    {isAvoir ? (
                                                        <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-800 border border-blue-200 px-1.5 py-0.5 rounded-[4px] text-[10px] font-semibold uppercase tracking-wider">
                                                            <Ticket className="w-3 h-3 text-blue-600" />
                                                            Bon d'Avoir
                                                        </span>
                                                    ) : isCash ? (
                                                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded-[4px] text-[10px] font-semibold uppercase tracking-wider">
                                                            <Banknote className="w-3 h-3 text-emerald-600" />
                                                            Espèces
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-800 border border-purple-200 px-1.5 py-0.5 rounded-[4px] text-[10px] font-semibold uppercase tracking-wider">
                                                            Dette Déduite
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-1.5 px-2.5 text-center whitespace-nowrap">
                                                    <div className="flex items-center justify-center gap-1">
                                                        {intactCount > 0 && (
                                                            <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold px-1.5 py-0.5 rounded-[4px] text-[10px] uppercase tracking-wider">
                                                                +{intactCount} remis
                                                            </span>
                                                        )}
                                                        {damagedCount > 0 && (
                                                            <span className="bg-rose-100 text-rose-800 border border-rose-200 font-semibold px-1.5 py-0.5 rounded-[4px] text-[10px] uppercase tracking-wider">
                                                                {damagedCount} rebut
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-1.5 px-2.5 text-center whitespace-nowrap">
                                                    <button
                                                        onClick={() => {
                                                            setViewingReturn(r);
                                                            const note = creditNotes.find(c => c.returnNumber === r.returnNumber);
                                                            setViewingCreditNote(note || null);
                                                        }}
                                                        title="Voir et imprimer le bon"
                                                        className="inline-flex items-center gap-1 bg-[#001d35] hover:bg-[#00284a] text-white px-2 py-0.5 rounded-[4px] text-[11px] font-semibold uppercase tracking-wider transition-all shadow-xs cursor-pointer active:scale-95"
                                                    >
                                                        <Printer className="w-3 h-3 text-[#f77500]" />
                                                        <span>Imprimer</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )
                    ) : activeTab === 'activeVouchers' ? (
                        // ── Onglet Tous les Avoirs Actifs (indépendant de la période) ──
                        filteredAllActiveCreditNotes.length === 0 ? (
                            <div className="p-8 min-h-[160px] flex flex-col items-center justify-center text-center text-gray-400">
                                <div className="flex items-center justify-center -space-x-2 mb-1.5 opacity-50">
                                    <Ticket className="w-8 h-8 text-gray-300" />
                                    <Ticket className="w-8 h-8 text-gray-300" />
                                </div>
                                <p className="text-xs font-bold text-gray-600 uppercase">Aucun avoir actif en ce moment</p>
                                <p className="text-[11px] text-gray-400 mt-0.5">Les bons d'avoir actifs et partiels apparaîtront ici, quelle que soit leur date d'émission.</p>
                            </div>
                        ) : (
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-emerald-700 text-white font-bold uppercase tracking-wider text-[10px] divide-x divide-white/10 sticky top-0">
                                        <th className="py-1.5 px-2.5">Code Bon d'Avoir</th>
                                        <th className="py-1.5 px-2.5">Client Bénéficiaire</th>
                                        <th className="py-1.5 px-2.5">Date Émission</th>
                                        <th className="py-1.5 px-2.5">Validité (60J)</th>
                                        <th className="py-1.5 px-2.5 text-right">Montant Initial</th>
                                        <th className="py-1.5 px-2.5 text-right">Solde Restant</th>
                                        <th className="py-1.5 px-2.5 text-center">Statut</th>
                                        <th className="py-1.5 px-2.5 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {filteredAllActiveCreditNotes.map(c => {
                                        const isExpired = new Date(c.expiresAt).getTime() < nowTimestamp;
                                        return (
                                            <tr key={c.id} className="hover:bg-emerald-50/40 odd:bg-gray-50/50 transition-colors">
                                                <td className="py-1.5 px-2.5 font-semibold text-gray-900 whitespace-nowrap">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[#001d35] font-semibold tracking-wider">{c.code}</span>
                                                        <button onClick={() => handleCopyCode(c.code)} title="Copier le code" className="text-gray-400 hover:text-gray-700 cursor-pointer">
                                                            <Copy className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                    {c.type === 'change_reliquat' ? (
                                                        <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 border border-amber-300 font-bold px-1.5 py-0.2 rounded-xs text-[9px] uppercase tracking-wider mt-0.5">
                                                            🎟️ Reliquat Monnaie
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-800 border border-blue-200 font-bold px-1.5 py-0.2 rounded-xs text-[9px] uppercase tracking-wider mt-0.5">
                                                            📦 Retour Article
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-1.5 px-2.5">
                                                    <p className="font-semibold text-gray-900">{c.customerName || 'Client Comptoir'}</p>
                                                    {c.siteName && <p className="text-[10px] text-gray-500 font-medium">Chantier : {c.siteName}</p>}
                                                    {c.notes && (
                                                        <p className="text-[10px] text-gray-400 italic max-w-[240px] truncate mt-0.5" title={c.notes}>
                                                            {c.notes}
                                                        </p>
                                                    )}
                                                </td>
                                                <td className="py-1.5 px-2.5 text-gray-500 whitespace-nowrap font-medium">{format(new Date(c.createdAt), 'dd/MM/yyyy')}</td>
                                                <td className="py-1.5 px-2.5 whitespace-nowrap">
                                                    <span className={`text-[11px] font-semibold ${isExpired ? 'text-rose-600' : 'text-emerald-700'}`}>
                                                        {format(new Date(c.expiresAt), 'dd/MM/yyyy')}{isExpired && ' (Expiré)'}
                                                    </span>
                                                </td>
                                                <td className="py-1.5 px-2.5 text-right font-medium text-gray-600 whitespace-nowrap">{formatPrice(c.initialAmount)}</td>
                                                <td className="py-1.5 px-2.5 text-right font-semibold text-emerald-700 whitespace-nowrap text-xs tracking-tight">{formatPrice(c.remainingAmount)}</td>
                                                <td className="py-1.5 px-2.5 text-center whitespace-nowrap">
                                                    {c.status === 'active' ? (
                                                        <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold px-2 py-0.5 rounded-[4px] text-[10px] uppercase tracking-wider">
                                                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Actif
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 border border-amber-200 font-semibold px-2 py-0.5 rounded-[4px] text-[10px] uppercase tracking-wider">Partiel</span>
                                                    )}
                                                </td>
                                                <td className="py-1.5 px-2.5 text-center whitespace-nowrap">
                                                    <button
                                                        onClick={() => {
                                                            const isReliquat = c.type === 'change_reliquat';
                                                            const parentReturn = returns.find(r => r.returnNumber === c.returnNumber);
                                                            setViewingReturn(parentReturn || {
                                                                returnNumber: isReliquat ? c.code : (c.returnNumber || c.code),
                                                                customerName: c.customerName,
                                                                date: c.createdAt,
                                                                refundMethod: isReliquat ? 'change_reliquat' : 'avoir',
                                                                type: c.type,
                                                                totalAmount: c.initialAmount,
                                                                voucherCode: c.code,
                                                                reason: c.notes || (isReliquat ? 'Reliquat de monnaie non rendue en caisse' : "Bon d'avoir"),
                                                                cashierName: c.cashierName,
                                                                items: []
                                                            });
                                                            setViewingCreditNote(c);
                                                        }}
                                                        className="inline-flex items-center gap-1 bg-[#001d35] hover:bg-[#00284a] text-white px-2 py-0.5 rounded-[4px] text-[11px] font-semibold uppercase tracking-wider transition-all shadow-xs cursor-pointer active:scale-95"
                                                        title="Imprimer le bon d'avoir"
                                                    >
                                                        <Printer className="w-3 h-3 text-[#f77500]" />
                                                        <span>Imprimer</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )
                    ) : (
                        filteredCreditNotes.length === 0 ? (
                            <div className="p-8 min-h-[160px] flex flex-col items-center justify-center text-center text-gray-400">
                                <Ticket className="w-8 h-8 mx-auto text-gray-300 mb-1.5 opacity-50" />
                                <p className="text-xs font-bold text-gray-600 uppercase">
                                    {period !== 'all' ? `Aucun bon d'avoir (${periodLabel})` : "Aucun bon d'avoir actif"}
                                </p>
                                <p className="text-[11px] text-gray-400 mt-0.5">
                                    {period !== 'all' ? "Essayez de sélectionner « Tout l'historique » ou ajustez la période." : "Les avoirs émis lors des retours apparaîtront ici."}
                                </p>
                            </div>
                        ) : (
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-[#001d35] text-white font-bold uppercase tracking-wider text-[10px] divide-x divide-white/10 sticky top-0">
                                        <th className="py-1.5 px-2.5">Code Bon d'Avoir</th>
                                        <th className="py-1.5 px-2.5">Client Bénéficiaire</th>
                                        <th className="py-1.5 px-2.5">Date Émission</th>
                                        <th className="py-1.5 px-2.5">Validité (60J)</th>
                                        <th className="py-1.5 px-2.5 text-right">Montant Initial</th>
                                        <th className="py-1.5 px-2.5 text-right">Solde Restant</th>
                                        <th className="py-1.5 px-2.5 text-center">Statut</th>
                                        <th className="py-1.5 px-2.5 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {filteredCreditNotes.map(c => {
                                        const isExpired = new Date(c.expiresAt).getTime() < nowTimestamp;
                                        const isUsed = c.status === 'used' || c.remainingAmount <= 0;

                                        return (
                                            <tr key={c.id} className="hover:bg-blue-50/40 odd:bg-gray-50/50 transition-colors">
                                                <td className="py-1.5 px-2.5 font-semibold text-gray-900 whitespace-nowrap">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[#001d35] font-semibold tracking-wider">{c.code}</span>
                                                        <button
                                                            onClick={() => handleCopyCode(c.code)}
                                                            title="Copier le code"
                                                            className="text-gray-400 hover:text-gray-700 cursor-pointer"
                                                        >
                                                            <Copy className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                    {c.type === 'change_reliquat' ? (
                                                        <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 border border-amber-300 font-bold px-1.5 py-0.2 rounded-xs text-[9px] uppercase tracking-wider mt-0.5">
                                                            🎟️ Reliquat Monnaie
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-800 border border-blue-200 font-bold px-1.5 py-0.2 rounded-xs text-[9px] uppercase tracking-wider mt-0.5">
                                                            📦 Retour Article
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-1.5 px-2.5">
                                                    <p className="font-semibold text-gray-900">{c.customerName || 'Client Comptoir'}</p>
                                                    {c.siteName && (
                                                        <p className="text-[10px] text-gray-500 font-medium">Chantier : {c.siteName}</p>
                                                    )}
                                                    {c.notes && (
                                                        <p className="text-[10px] text-gray-400 italic max-w-[240px] truncate mt-0.5" title={c.notes}>
                                                            {c.notes}
                                                        </p>
                                                    )}
                                                </td>
                                                <td className="py-1.5 px-2.5 text-gray-500 whitespace-nowrap font-medium">
                                                    {format(new Date(c.createdAt), 'dd/MM/yyyy')}
                                                </td>
                                                <td className="py-1.5 px-2.5 whitespace-nowrap">
                                                    <span className={`text-[11px] font-semibold ${isExpired ? 'text-rose-600' : 'text-gray-600'}`}>
                                                        {format(new Date(c.expiresAt), 'dd/MM/yyyy')}
                                                        {isExpired && ' (Expiré)'}
                                                    </span>
                                                </td>
                                                <td className="py-1.5 px-2.5 text-right font-medium text-gray-600 whitespace-nowrap">
                                                    {formatPrice(c.initialAmount)}
                                                </td>
                                                <td className="py-1.5 px-2.5 text-right font-semibold text-[#001d35] whitespace-nowrap text-xs tracking-tight">
                                                    {formatPrice(c.remainingAmount)}
                                                </td>
                                                <td className="py-1.5 px-2.5 text-center whitespace-nowrap">
                                                    {c.status === 'active' && !isExpired ? (
                                                        <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold px-2 py-0.5 rounded-[4px] text-[10px] uppercase tracking-wider">
                                                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                                            Actif
                                                        </span>
                                                    ) : c.status === 'partial' && !isExpired ? (
                                                        <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 border border-amber-200 font-semibold px-2 py-0.5 rounded-[4px] text-[10px] uppercase tracking-wider">
                                                            Partiel
                                                        </span>
                                                    ) : isUsed ? (
                                                        <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 border border-gray-200 font-semibold px-2 py-0.5 rounded-[4px] text-[10px] uppercase tracking-wider">
                                                            Utilisé
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 border border-rose-200 font-semibold px-2 py-0.5 rounded-[4px] text-[10px] uppercase tracking-wider">
                                                            Expiré
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-1.5 px-2.5 text-center whitespace-nowrap">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <button
                                                            onClick={() => {
                                                                const isReliquat = c.type === 'change_reliquat';
                                                                const parentReturn = returns.find(r => r.returnNumber === c.returnNumber);
                                                                if (parentReturn) {
                                                                    setViewingReturn(parentReturn);
                                                                    setViewingCreditNote(c);
                                                                } else {
                                                                    setViewingReturn({
                                                                        returnNumber: isReliquat ? c.code : (c.returnNumber || c.code),
                                                                        customerName: c.customerName,
                                                                        date: c.createdAt,
                                                                        refundMethod: isReliquat ? 'change_reliquat' : 'avoir',
                                                                        type: c.type,
                                                                        totalAmount: c.initialAmount,
                                                                        voucherCode: c.code,
                                                                        reason: c.notes || (isReliquat ? 'Reliquat de monnaie non rendue en caisse' : "Bon d'avoir"),
                                                                        cashierName: c.cashierName,
                                                                        items: []
                                                                    });
                                                                    setViewingCreditNote(c);
                                                                }
                                                            }}
                                                            className="inline-flex items-center gap-1 bg-[#001d35] hover:bg-[#00284a] text-white px-2 py-0.5 rounded-[4px] text-[11px] font-semibold uppercase tracking-wider transition-all shadow-xs cursor-pointer active:scale-95"
                                                            title="Imprimer le bon d'avoir"
                                                        >
                                                            <Printer className="w-3 h-3 text-[#f77500]" />
                                                            <span>Imprimer</span>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )
                    )}
                </div>
            </div>

            {/* ── MODAL ASSISTANT NOUVEAU RETOUR CLIENT COMPACT ── */}
            {showNewReturnModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-xl rounded-[4px] shadow-2xl border-t-4 border-[#001d35] border-x-2 border-b-2 border-gray-300 overflow-hidden flex flex-col max-h-[88vh] animate-in zoom-in-95 duration-150">
                        {/* Modal Header */}
                        <div className="px-3.5 py-2.5 sm:px-4 sm:py-3 border-b-2 border-[#001d35] flex justify-between items-start bg-[#001d35] text-white flex-shrink-0">
                            <div>
                                <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wide flex items-center gap-1.5">
                                    <RotateCcw className="w-3.5 h-3.5 text-[#f77500]" />
                                    Assistant Retour & Bon d'Avoir
                                </h3>
                                <p className="text-blue-100/70 text-[11px] mt-0.5 font-medium">
                                    Étape {modalStep} sur 3 — {
                                        modalStep === 1 ? "Identification Ticket ou Comptoir" :
                                        modalStep === 2 ? "Sélection & État des Marchandises" :
                                        "Règle Financière & Clôture"
                                    }
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowNewReturnModal(false)}
                                className="text-blue-200 hover:text-white p-1 rounded-[4px] transition-colors cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Stepper bar */}
                        <div className="grid grid-cols-3 border-b-2 border-gray-300 bg-gray-50 text-[10px] font-bold uppercase tracking-wider text-center flex-shrink-0">
                            <div className={`py-1.5 border-r-2 border-gray-300 transition-colors ${modalStep === 1 ? 'bg-white text-[#001d35] border-b-2 border-[#001d35]' : modalStep > 1 ? 'text-emerald-700 bg-emerald-50/50' : 'text-gray-400'}`}>
                                1. Origine & Client
                            </div>
                            <div className={`py-1.5 border-r-2 border-gray-300 transition-colors ${modalStep === 2 ? 'bg-white text-[#001d35] border-b-2 border-[#001d35]' : modalStep > 2 ? 'text-emerald-700 bg-emerald-50/50' : 'text-gray-400'}`}>
                                2. Articles & Stock
                            </div>
                            <div className={`py-1.5 transition-colors ${modalStep === 3 ? 'bg-white text-[#001d35] border-b-2 border-[#001d35]' : 'text-gray-400'}`}>
                                3. Règlement & Clôture
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="p-3.5 sm:p-4 overflow-y-auto flex-1 space-y-3">
                            {modalStep === 1 && (
                                /* ── ÉTAPE 1 : CHOIX DU TICKET OU RETOUR LIBRE ── */
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-2.5">
                                        <button
                                            type="button"
                                            onClick={() => setReturnMode('with_sale')}
                                            className={`p-2.5 rounded-[4px] border-2 text-left cursor-pointer transition-all ${
                                                returnMode === 'with_sale'
                                                    ? 'border-[#001d35] bg-blue-50/50 shadow-xs'
                                                    : 'border-gray-300 hover:border-gray-400 bg-white'
                                            }`}
                                        >
                                            <p className="font-bold text-xs text-gray-900 uppercase tracking-wide">Ticket de caisse</p>
                                            <p className="text-[10px] text-gray-500 mt-0.5 font-medium">Retrouver la vente originale</p>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setReturnMode('free');
                                                setSelectedSale(null);
                                                setReturnedItems([]);
                                            }}
                                            className={`p-2.5 rounded-[4px] border-2 text-left cursor-pointer transition-all ${
                                                returnMode === 'free'
                                                    ? 'border-[#001d35] bg-blue-50/50 shadow-xs'
                                                    : 'border-gray-300 hover:border-gray-400 bg-white'
                                            }`}
                                        >
                                            <p className="font-bold text-xs text-gray-900 uppercase tracking-wide">Retour comptoir libre</p>
                                            <p className="text-[10px] text-gray-500 mt-0.5 font-medium">Sans ticket de caisse</p>
                                        </button>
                                    </div>

                                    {returnMode === 'with_sale' ? (
                                        <div className="space-y-3">
                                            <div className="relative">
                                                <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                                                <input
                                                    type="text"
                                                    placeholder="Rechercher par N° ticket (ex: REC-...), nom client..."
                                                    value={saleSearchQuery}
                                                    onChange={(e) => setSaleSearchQuery(e.target.value)}
                                                    className="w-full pl-9 pr-3 py-2 text-xs bg-gray-50 border-2 border-gray-300 focus:border-[#001d35] rounded-[4px] font-medium focus:outline-none"
                                                />
                                            </div>

                                            <div className="border-2 border-gray-300 rounded-[4px] divide-y divide-gray-200 max-h-64 overflow-y-auto">
                                                {filteredSales.length === 0 ? (
                                                    <p className="p-4 text-center text-xs text-gray-400 font-medium">Aucune vente trouvée</p>
                                                ) : (
                                                    filteredSales.map(s => (
                                                        <div
                                                            key={s.id}
                                                            onClick={() => handleSelectSale(s)}
                                                            className="p-3 hover:bg-blue-50/50 cursor-pointer flex justify-between items-center transition-colors"
                                                        >
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-semibold text-xs text-gray-900">
                                                                        {s.transactionNumber || `VENTE #${s.id}`}
                                                                    </span>
                                                                    <span className="text-[10px] text-gray-500 font-medium">
                                                                        {format(new Date(s.date || s.transactionDate), 'dd/MM/yyyy HH:mm')}
                                                                    </span>
                                                                </div>
                                                                <p className="text-xs font-semibold text-gray-700 mt-0.5">
                                                                    {s.customerName || 'Client Comptoir'}
                                                                    {s.siteName && ` — Chantier: ${s.siteName}`}
                                                                </p>
                                                                <p className="text-[10px] text-gray-500 font-medium">
                                                                    {(s.items || []).length} article(s) • Total: <strong className="text-[#001d35] font-semibold">{formatPrice(s.total || s.totalAmount)}</strong>
                                                                </p>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                className="text-xs font-semibold text-[#001d35] flex items-center gap-1 uppercase tracking-wider"
                                                            >
                                                                <span>Sélectionner</span>
                                                                <ArrowRight className="w-3.5 h-3.5 text-[#f77500]" />
                                                            </button>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">Nom du Client</label>
                                                <input
                                                    type="text"
                                                    placeholder="Ex: M. Koffi Mensah (Chantier Baguida)"
                                                    value={customerName}
                                                    onChange={(e) => setCustomerName(e.target.value)}
                                                    className="w-full px-3 py-2 text-xs bg-gray-50 border-2 border-gray-300 focus:border-[#001d35] rounded-[4px] font-medium focus:outline-none"
                                                />
                                            </div>

                                            {/* Article picker */}
                                            <div>
                                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">Ajouter des articles du catalogue</label>
                                                <div className="relative">
                                                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                                                    <input
                                                        type="text"
                                                        placeholder="Rechercher un article (Ciment, PVC, Fer...)"
                                                        value={productSearchQuery}
                                                        onChange={(e) => setProductSearchQuery(e.target.value)}
                                                        className="w-full pl-9 pr-3 py-2 text-xs bg-gray-50 border-2 border-gray-300 focus:border-[#001d35] rounded-[4px] font-medium focus:outline-none"
                                                    />
                                                </div>

                                                {productSearchQuery && (
                                                    <div className="mt-1 border-2 border-gray-300 rounded-[4px] divide-y divide-gray-100 max-h-40 overflow-y-auto bg-white shadow-lg">
                                                        {products
                                                            .filter(p => p.name.toLowerCase().includes(productSearchQuery.toLowerCase()))
                                                            .slice(0, 5)
                                                            .map(p => (
                                                                <div
                                                                    key={p.id}
                                                                    onClick={() => handleAddFreeProduct(p)}
                                                                    className="p-2.5 hover:bg-gray-50 cursor-pointer flex justify-between items-center text-xs"
                                                                >
                                                                    <span className="font-semibold text-gray-800">{p.name} ({p.unit})</span>
                                                                    <span className="font-semibold text-[#001d35] tracking-tight">{formatPrice(p.price)}</span>
                                                                </div>
                                                            ))}
                                                    </div>
                                                )}
                                            </div>

                                            {returnedItems.length > 0 && (
                                                <div className="mt-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => setModalStep(2)}
                                                        className="w-full bg-[#001d35] hover:bg-[#00284a] text-white font-bold uppercase tracking-wider py-2 rounded-[4px] text-xs cursor-pointer shadow-sm transition-colors active:scale-95"
                                                    >
                                                        Configurer les quantités et l'état ({returnedItems.length} article(s))
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {modalStep === 2 && (
                                /* ── ÉTAPE 2 : SÉLECTION DES ARTICLES & ÉTAT ── */
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center border-b-2 border-gray-300 pb-2">
                                        <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">Articles à retourner</p>
                                        <span className="text-xs text-gray-500 font-medium">Cochez et ajustez les quantités</span>
                                    </div>

                                    <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                                        {returnedItems.map((item, idx) => (
                                            <div
                                                key={idx}
                                                className={`p-3 rounded-[4px] border-2 transition-all ${
                                                    item.selected ? 'border-gray-300 bg-white shadow-xs' : 'border-gray-200 bg-gray-50 opacity-60'
                                                }`}
                                            >
                                                <div className="flex items-start gap-2.5">
                                                    <input
                                                        type="checkbox"
                                                        checked={item.selected}
                                                        onChange={(e) => {
                                                            const checked = e.target.checked;
                                                            setReturnedItems(returnedItems.map((it, i) => i === idx ? { ...it, selected: checked } : it));
                                                        }}
                                                        className="mt-1 rounded-[4px] border-2 border-gray-400 text-[#001d35] focus:ring-[#001d35] cursor-pointer"
                                                    />

                                                    <div className="flex-1">
                                                        <div className="flex justify-between items-start">
                                                            <div>
                                                                <p className="font-semibold text-xs text-gray-900">{item.name}</p>
                                                                <p className="text-[11px] text-gray-500 font-medium">
                                                                    Prix unitaire : {formatPrice(item.unitPrice)} / {item.unit}
                                                                </p>
                                                            </div>
                                                            <span className="font-semibold text-xs text-[#001d35] tracking-tight">
                                                                {formatPrice((item.quantityReturned || 1) * item.unitPrice)}
                                                            </span>
                                                        </div>

                                                        {item.selected && (
                                                            <div className="mt-2.5 pt-2.5 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3">
                                                                {/* Quantity */}
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[11px] font-bold text-gray-700 uppercase">Qté retour :</span>
                                                                    <input
                                                                        type="number"
                                                                        min="1"
                                                                        max={item.maxQty}
                                                                        value={item.quantityReturned}
                                                                        onChange={(e) => {
                                                                            const val = Math.max(1, Math.min(item.maxQty, parseInt(e.target.value) || 1));
                                                                            setReturnedItems(returnedItems.map((it, i) => i === idx ? { ...it, quantityReturned: val } : it));
                                                                        }}
                                                                        className="w-16 px-2 py-1 text-xs border-2 border-gray-300 rounded-[4px] font-semibold text-center focus:border-[#001d35] focus:outline-none"
                                                                    />
                                                                    <span className="text-[11px] text-gray-500 font-medium">/ max {item.maxQty} {item.unit}</span>
                                                                </div>

                                                                {/* Condition toggle */}
                                                                <div className="flex items-center gap-1.5 text-xs">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setReturnedItems(returnedItems.map((it, i) => i === idx ? { ...it, condition: 'intact' } : it));
                                                                        }}
                                                                        className={`px-2.5 py-1 rounded-[4px] font-semibold uppercase tracking-wider text-[10px] cursor-pointer transition-colors border ${
                                                                            item.condition === 'intact'
                                                                                ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                                                                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                                                                        }`}
                                                                    >
                                                                        ✅ Intact (Remis en stock)
                                                                    </button>

                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setReturnedItems(returnedItems.map((it, i) => i === idx ? { ...it, condition: 'damaged' } : it));
                                                                        }}
                                                                        className={`px-2.5 py-1 rounded-[4px] font-semibold uppercase tracking-wider text-[10px] cursor-pointer transition-colors border ${
                                                                            item.condition === 'damaged'
                                                                                ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                                                                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                                                                        }`}
                                                                    >
                                                                        ⚠️ Avarié (Perte / Rebut)
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Subtotal */}
                                    <div className="p-3.5 bg-blue-50/50 border-2 border-blue-200 rounded-[4px] flex justify-between items-center text-xs">
                                        <span className="font-semibold text-gray-700 uppercase tracking-wide">Total Dédommagement :</span>
                                        <span className="font-semibold text-sm text-[#001d35] tracking-tight">{formatPrice(calculatedTotalRefund)}</span>
                                    </div>
                                </div>
                            )}

                            {modalStep === 3 && (
                                /* ── ÉTAPE 3 : RÈGLE FINANCIÈRE & CONFIRMATION ── */
                                <div className="space-y-4">
                                    {/* Choice of refund method */}
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
                                            Mode de Compensation Financière
                                        </label>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                            {/* Option 1 : Avoir */}
                                            <div
                                                onClick={() => setRefundMethod('avoir')}
                                                className={`p-3.5 rounded-[4px] border-2 cursor-pointer transition-all ${
                                                    refundMethod === 'avoir'
                                                        ? 'border-[#001d35] bg-blue-50/70 shadow-xs'
                                                        : 'border-gray-300 hover:border-gray-400 bg-white'
                                                }`}
                                            >
                                                <div className="flex items-center gap-1.5 text-blue-900 font-bold text-xs uppercase tracking-wider">
                                                    <Ticket className="w-4 h-4 text-blue-600" />
                                                    <span>Bon d'Avoir</span>
                                                </div>
                                                <p className="text-[10px] text-gray-600 mt-1 font-medium">
                                                    Bon d'achat déductible au POS. <strong>0 FCFA sort de la caisse.</strong>
                                                </p>
                                            </div>

                                            {/* Option 2 : Espèces */}
                                            <div
                                                onClick={() => setRefundMethod('cash')}
                                                className={`p-3.5 rounded-[4px] border-2 cursor-pointer transition-all ${
                                                    refundMethod === 'cash'
                                                        ? 'border-emerald-600 bg-emerald-50/70 shadow-xs'
                                                        : 'border-gray-300 hover:border-gray-400 bg-white'
                                                }`}
                                            >
                                                <div className="flex items-center gap-1.5 text-emerald-900 font-bold text-xs uppercase tracking-wider">
                                                    <Banknote className="w-4 h-4 text-emerald-600" />
                                                    <span>Espèces (Tiroir)</span>
                                                </div>
                                                <p className="text-[10px] text-gray-600 mt-1 font-medium">
                                                    Sortie de caisse automatique dans la session active pour préserver l'anti-coulage.
                                                </p>
                                            </div>

                                            {/* Option 3 : Dette */}
                                            <div
                                                onClick={() => setRefundMethod('debt_deduction')}
                                                className={`p-3.5 rounded-[4px] border-2 cursor-pointer transition-all ${
                                                    refundMethod === 'debt_deduction'
                                                        ? 'border-purple-600 bg-purple-50/70 shadow-xs'
                                                        : 'border-gray-300 hover:border-gray-400 bg-white'
                                                }`}
                                            >
                                                <div className="flex items-center gap-1.5 text-purple-900 font-bold text-xs uppercase tracking-wider">
                                                    <ShieldCheck className="w-4 h-4 text-purple-600" />
                                                    <span>Déduction Dette</span>
                                                </div>
                                                <p className="text-[10px] text-gray-600 mt-1 font-medium">
                                                    Diminue directement l'encours du client dans le carnet de crédit chantier.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Reason */}
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">Motif du retour</label>
                                        <select
                                            value={reason}
                                            onChange={(e) => setReason(e.target.value)}
                                            className="w-full px-3 py-2 text-xs bg-gray-50 border-2 border-gray-300 focus:border-[#001d35] rounded-[4px] font-semibold text-gray-800 focus:outline-none cursor-pointer"
                                        >
                                            <option value="Surplus de chantier">Surplus de chantier (matériaux non utilisés)</option>
                                            <option value="Erreur de dimension / référence">Erreur de dimension / calibre / référence</option>
                                            <option value="Produit défectueux ou fissuré">Produit défectueux, cassé ou fissuré</option>
                                            <option value="Changement d'avis client">Changement d'avis client</option>
                                            <option value="Autre">Autre motif</option>
                                        </select>

                                        {reason === 'Autre' && (
                                            <input
                                                type="text"
                                                placeholder="Précisez le motif..."
                                                value={customReason}
                                                onChange={(e) => setCustomReason(e.target.value)}
                                                className="mt-2 w-full px-3 py-1.5 text-xs bg-gray-50 border-2 border-gray-300 focus:border-[#001d35] rounded-[4px] font-medium"
                                            />
                                        )}
                                    </div>

                                    {/* Notes additionnelles */}
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">Notes / Observations (facultatif)</label>
                                        <textarea
                                            rows={2}
                                            placeholder="Observations éventuelles (ex: contrôle état matériel, quai de retour...)"
                                            value={notes}
                                            onChange={(e) => setNotes(e.target.value)}
                                            className="w-full px-3 py-1.5 text-xs bg-gray-50 border-2 border-gray-300 focus:border-[#001d35] rounded-[4px] font-medium focus:outline-none"
                                        />
                                    </div>

                                    {/* Recap Card */}
                                    <div className="p-3.5 bg-blue-50/50 border-2 border-blue-200 rounded-[4px] space-y-1.5 text-xs">
                                        <div className="flex justify-between">
                                            <span className="text-gray-600 font-medium">Bénéficiaire :</span>
                                            <span className="font-semibold text-gray-900">{customerName || 'Client Inconnu'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-600 font-medium">Articles concernés :</span>
                                            <span className="font-semibold text-gray-800">
                                                {returnedItems.filter(i => i.selected).length} référence(s)
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-sm font-semibold pt-1.5 border-t border-blue-200">
                                            <span className="text-gray-900 uppercase">Total Remboursé :</span>
                                            <span className="font-semibold text-[#001d35] text-base tracking-tight">{formatPrice(calculatedTotalRefund)}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer Compact */}
                        <div className="px-4 py-2.5 bg-white border-t-2 border-gray-300 flex justify-between items-center flex-shrink-0">
                            <button
                                type="button"
                                onClick={() => {
                                    if (modalStep > 1) setModalStep(modalStep - 1);
                                    else setShowNewReturnModal(false);
                                }}
                                className="px-3 py-1.5 border-2 border-gray-300 text-gray-700 font-semibold uppercase tracking-wider text-xs hover:bg-gray-50 rounded-[4px] cursor-pointer transition-colors active:scale-95"
                            >
                                {modalStep === 1 ? 'Annuler' : 'Précédent'}
                            </button>

                            <div className="flex items-center gap-2">
                                {modalStep < 3 ? (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (modalStep === 1 && returnMode === 'with_sale' && !selectedSale) {
                                                T.warning('Veuillez sélectionner une vente.');
                                                return;
                                            }
                                            if (modalStep === 1 && returnMode === 'free' && returnedItems.length === 0) {
                                                T.warning('Veuillez ajouter au moins un article.');
                                                return;
                                            }
                                            if (modalStep === 2 && calculatedTotalRefund <= 0) {
                                                T.warning('Veuillez sélectionner au moins un article avec une quantité valide.');
                                                return;
                                            }
                                            setModalStep(modalStep + 1);
                                        }}
                                        className="px-3.5 py-1.5 bg-[#001d35] hover:bg-[#00284a] text-white font-semibold uppercase tracking-wider text-xs rounded-[4px] cursor-pointer transition-colors shadow-xs flex items-center gap-1.5 active:scale-95"
                                    >
                                        <span>Suivant</span>
                                        <ArrowRight className="w-3.5 h-3.5 text-[#f77500]" />
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={handleSubmitReturn}
                                        className="px-3.5 py-1.5 bg-[#001d35] hover:bg-[#00284a] text-white font-semibold uppercase tracking-wider text-xs rounded-[4px] cursor-pointer transition-colors shadow-xs flex items-center gap-1.5 active:scale-95"
                                    >
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                        <span>Valider ({formatPrice(calculatedTotalRefund)})</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── MODAL REÇU / BON D'AVOIR IMPRIMABLE ── */}
            {viewingReturn && (
                <ReturnReceipt
                    returnRecord={viewingReturn}
                    creditNote={viewingCreditNote}
                    onClose={() => {
                        setViewingReturn(null);
                        setViewingCreditNote(null);
                    }}
                />
            )}
        </div>
    );
};

export default Returns;
