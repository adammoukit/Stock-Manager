import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useSales } from '../../context/SalesContext';
import { useInventory } from '../../context/InventoryContext';
import { useSession } from '../../context/SessionContext';
import { useAuth } from '../../context/AuthContext';
import { formatPrice } from '../../utils/currency';
import ReturnReceipt from '../../components/ReturnReceipt';
import CashRefundReceipt from '../../components/CashRefundReceipt';
import FinancialInput from '../../components/FinancialInput';
import { exportToExcel } from '../../utils/excelExport';
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
    Layers, AlertCircle, ClipboardList, CheckSquare, Download, ChevronLeft, ChevronRight
} from 'lucide-react';

const Returns = () => {
    const { returns, creditNotes, createReturn, refundCreditNoteInCash, transactions, expenses } = useSales();
    const { products } = useInventory();
    const { activeSession } = useSession();
    const { user } = useAuth();

    const [nowTimestamp] = useState(() => Date.now());

    // ── Filtre de Période (Par défaut : Aujourd'hui) ──
    const [period, setPeriod] = useState('today'); // 'today' | '7days' | 'month' | 'all' | 'custom' | 'day' | 'week' ...
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
    const [operationFilter, setOperationFilter] = useState('none'); // 'none' (Aucun) | 'all' (Toutes) | options spécifiques
    const [clientFilter, setClientFilter] = useState('all');
    const [selectedKpi, setSelectedKpi] = useState(null); // null | 'returns' | 'active_avoirs' | 'reintegrated' | 'damaged'

    // ── Pagination (10 éléments par page par défaut) & Sélection groupée ──
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [selectedRowIds, setSelectedRowIds] = useState([]);

    // ── Loader de 1 seconde lors du clic sur les filtres ──
    const [filterLoading, setFilterLoading] = useState(false);
    const filterTimerRef = useRef(null);

    const handleFilterChange = (setter, value) => {
        setFilterLoading(true);
        setCurrentPage(1);
        setSelectedRowIds([]);
        if (typeof setter === 'function') {
            if (value !== undefined) {
                setter(value);
            } else {
                setter();
            }
        }
        if (filterTimerRef.current) clearTimeout(filterTimerRef.current);
        filterTimerRef.current = setTimeout(() => {
            setFilterLoading(false);
        }, 1000);
    };

    // ── Gestion interactive des clics sur les cartes KPI ──
    const handleKpiClick = (kpiKey) => {
        handleFilterChange(() => {
            if (selectedKpi === kpiKey) {
                // Dé-sélection si on reclique sur la même carte
                setSelectedKpi(null);
            } else {
                setSelectedKpi(kpiKey);
                if (kpiKey === 'active_avoirs') {
                    // Clic sur le KPI Avoirs Actifs : filtre avec Toutes les Dates
                    setPeriod('all');
                    setCustomStartDate('');
                    setCustomEndDate('');
                    setActiveTab('activeVouchers');
                    setOperationFilter('none');
                } else {
                    setPeriod('today');
                    setCustomStartDate('');
                    setCustomEndDate('');
                    if (kpiKey === 'returns') {
                        setActiveTab('returns');
                        setOperationFilter('none');
                    } else if (kpiKey === 'reintegrated' || kpiKey === 'damaged') {
                        setActiveTab('returns');
                    }
                }
            }
        });
    };

    useEffect(() => {
        return () => {
            if (filterTimerRef.current) clearTimeout(filterTimerRef.current);
        };
    }, []);

    // Receipt modal states
    const [viewingReturn, setViewingReturn] = useState(null);
    const [viewingCreditNote, setViewingCreditNote] = useState(null);

    // ── Cash Refund Modal States & Handlers ──
    const [cashRefundTarget, setCashRefundTarget] = useState(null); // creditNote object
    const [cashRefundAmount, setCashRefundAmount] = useState('');
    const [cashRefundRecipient, setCashRefundRecipient] = useState('');
    const [cashRefundMotif, setCashRefundMotif] = useState('');
    const [cashRefundLoading, setCashRefundLoading] = useState(false);
    const [printedCashRefund, setPrintedCashRefund] = useState(null); // for CashRefundReceipt modal

    const handleOpenCashRefund = (note) => {
        if (!note) return;
        const remaining = parseFloat(note.remainingAmount) || 0;
        if (remaining <= 0) {
            T.error("Ce bon ne possède aucun solde disponible à rembourser.");
            return;
        }
        setCashRefundTarget(note);
        setCashRefundAmount(remaining);
        setCashRefundRecipient(note.customerName || 'Client');
        setCashRefundMotif("Demande de remboursement en espèces par le client");
    };

    const handleConfirmCashRefund = () => {
        if (!cashRefundTarget) return;
        const numAmount = parseFloat(cashRefundAmount);
        const remaining = parseFloat(cashRefundTarget.remainingAmount) || 0;

        if (!numAmount || numAmount <= 0) {
            T.error("Veuillez saisir un montant supérieur à 0.");
            return;
        }
        if (numAmount > remaining) {
            T.error(`Le montant ne peut pas dépasser le solde restant disponible (${formatPrice(remaining)}).`);
            return;
        }

        setCashRefundLoading(true);
        setTimeout(() => {
            const cashierDisplayName = (user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user?.username) || 'Caissier';
            const recipientFinal = cashRefundRecipient.trim() || cashRefundTarget.customerName || 'Client';

            const res = refundCreditNoteInCash({
                id: cashRefundTarget.id,
                code: cashRefundTarget.code,
                amountToRefund: numAmount,
                cashierName: cashierDisplayName,
                recipientName: recipientFinal,
                motif: cashRefundMotif.trim()
            });

            setCashRefundLoading(false);

            if (res.success) {
                T.success(`Remboursement de ${formatPrice(res.refundedAmount)} effectué en espèces ! Sortie de caisse enregistrée.`);
                setPrintedCashRefund({
                    receiptCode: res.receiptCode,
                    refundedAmount: res.refundedAmount,
                    remainingBalance: res.remainingBalance,
                    creditNote: res.creditNote,
                    expense: res.expense,
                    cashierName: cashierDisplayName,
                    recipientName: recipientFinal,
                    motif: cashRefundMotif.trim(),
                    date: new Date()
                });
                setCashRefundTarget(null);
            } else {
                T.error(res.message || "Erreur lors du remboursement.");
            }
        }, 1500);
    };

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
            case 'today':
            case 'day':
                currStart = startOfDay(now);
                currEnd = endOfDay(now);
                label = `Aujourd'hui (${format(now, 'dd/MM/yyyy')})`;
                break;

            case '7days':
                currStart = startOfDay(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
                currEnd = endOfDay(now);
                label = `7 derniers jours`;
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

    // ── Liste unique des clients issus des retours et avoirs pour le sélecteur ──
    const uniqueClients = useMemo(() => {
        const set = new Set();
        (returns || []).forEach(r => {
            if (r.customerName && r.customerName.trim()) set.add(r.customerName.trim());
        });
        (creditNotes || []).forEach(c => {
            if (c.customerName && c.customerName.trim()) set.add(c.customerName.trim());
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [returns, creditNotes]);

    const filteredAllActiveCreditNotes = useMemo(() => {
        return allActiveCreditNotes.filter(c => {
            // Filtrage temporel si une période spécifique est sélectionnée (ex: Aujourd'hui, 7 jours, Ce mois...)
            if (period !== 'all' && currentRange.start) {
                const rawDate = c.createdAt || c.date || c.issuedAt;
                if (rawDate) {
                    const d = new Date(rawDate);
                    if (!isNaN(d.getTime()) && !isWithinInterval(d, { start: currentRange.start, end: currentRange.end })) {
                        return false;
                    }
                }
            }

            const matchSearch = !searchTerm ||
                (c.code && c.code.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (c.customerName && c.customerName.toLowerCase().includes(searchTerm.toLowerCase()));

            let matchOp = true;
            if (operationFilter === 'reliquat') matchOp = c.type === 'change_reliquat';
            else if (operationFilter === 'standard') matchOp = c.type !== 'change_reliquat';

            const matchClient = clientFilter === 'all' || (c.customerName && c.customerName.toLowerCase() === clientFilter.toLowerCase());

            return matchSearch && matchOp && matchClient;
        });
    }, [allActiveCreditNotes, period, currentRange, searchTerm, operationFilter, clientFilter]);

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

        // Métriques de la période choisie (affichées dans les cartes KPI et sous-titres)
        const periodReturnsCount = periodReturns.length;
        const periodReturnsAmount = periodReturns.reduce((sum, r) => sum + (r.totalAmount || 0), 0);

        let periodReintegratedItems = 0;
        let periodDamagedItems = 0;

        periodReturns.forEach(r => {
            (r.items || []).forEach(item => {
                const qty = item.quantityReturned || item.quantity || 0;
                if (item.condition === 'intact' || item.reintegrated) {
                    periodReintegratedItems += qty;
                } else {
                    periodDamagedItems += qty;
                }
            });
        });

        const periodTotalItemsCount = periodReintegratedItems + periodDamagedItems;
        const periodDamagedRate = periodTotalItemsCount > 0 ? ((periodDamagedItems / periodTotalItemsCount) * 100).toFixed(1) : 0;
        const periodAvoirsCount = periodCreditNotes.length;

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
            // Sous-totaux et compteurs de la période sélectionnée
            periodReturnsCount,
            periodReturnsAmount,
            periodReintegratedItems,
            periodDamagedItems,
            periodDamagedRate,
            periodAvoirsCount
        };
    }, [returns, allActiveCreditNotes, periodReturns, periodCreditNotes]);

    // ── Libellé court de la période affiché directement à côté de la valeur des KPI ──
    const periodShortLabel = useMemo(() => {
        switch (period) {
            case 'today':
            case 'day':
                return "Aujourd'hui";
            case '7days':
                return "7 jours";
            case 'week':
                return "Semaine";
            case 'month':
                return "Ce mois";
            case 'quarter':
                return "Trimestre";
            case 'year':
                return "Année";
            case 'custom':
                return customStartDate && customEndDate
                    ? `${format(parseISO(customStartDate), 'dd/MM')} au ${format(parseISO(customEndDate), 'dd/MM')}`
                    : "Période";
            case 'all':
            default:
                return "Tout l'historique";
        }
    }, [period, customStartDate, customEndDate]);

    // ── Grand Livre Unifié de Toutes les Opérations (Retours + Bons d'Avoir + Reliquats) ──
    const allUnifiedOperations = useMemo(() => {
        const ops = [];

        // 1. Tous les Retours de marchandises
        (returns || []).forEach(r => {
            const rawDate = r.date || r.createdAt || new Date().toISOString();
            const isCash = r.refundMethod === 'cash';
            const isAvoir = r.refundMethod === 'avoir';
            const isDebt = r.refundMethod === 'debt_deduction';

            ops.push({
                id: `op_ret_${r.id || r.returnNumber}`,
                date: rawDate,
                kind: 'return',
                category: isCash ? 'cash' : (isAvoir ? 'avoir' : (isDebt ? 'debt_deduction' : 'returns_other')),
                refCode: r.returnNumber || 'RET-000',
                typeLabel: 'Retour Marchandise',
                badgeText: isCash ? '💵 Remboursement Espèces' : (isAvoir ? "🎟️ Bon d'Avoir Émis" : (isDebt ? '📉 Déduction Dette' : '📦 Retour')),
                badgeColor: isCash ? 'bg-amber-100 text-amber-950 border-amber-300' : (isAvoir ? 'bg-blue-100 text-blue-950 border-blue-300' : 'bg-purple-100 text-purple-950 border-purple-300'),
                customerName: r.customerName || 'Client Comptoir',
                clientId: r.clientId || null,
                siteName: r.siteName || null,
                amount: r.totalAmount || 0,
                remainingAmount: 0,
                status: 'completed',
                statusLabel: 'Effectué',
                statusColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
                details: `${(r.items || []).length} article(s) retourné(s)`,
                rawReturn: r,
                transactionNumber: r.transactionNumber
            });
        });

        // 2. Tous les Bons d'Avoir et Reliquats
        const recordedRefundCodes = new Set();

        (creditNotes || []).forEach(c => {
            const rawDate = c.createdAt || c.date || new Date().toISOString();
            const isReliquat = c.type === 'change_reliquat';
            const isExpired = c.expiresAt && new Date(c.expiresAt).getTime() < nowTimestamp;
            const isUsed = c.status === 'used' || (c.remainingAmount !== undefined && c.remainingAmount <= 0);
            const isPartial = c.status === 'partial' && (c.remainingAmount || 0) > 0;
            const isActive = (c.status === 'active' || !c.status) && !isExpired && (c.remainingAmount || 0) > 0;

            ops.push({
                id: `op_cn_${c.id || c.code}`,
                date: rawDate,
                kind: 'credit_note',
                category: isReliquat ? 'reliquat' : (isActive ? 'active' : (isPartial ? 'partial' : (isUsed ? 'used' : 'cancelled'))),
                refCode: c.code || 'AVR-000',
                typeLabel: isReliquat ? 'Reliquat de Caisse' : "Bon d'Avoir Client",
                badgeText: isReliquat ? '🎟️ Reliquat Monnaie' : "🏷️ Avoir Marchandise",
                badgeColor: isReliquat ? 'bg-amber-100 text-amber-900 border-amber-300 font-bold' : 'bg-blue-50 text-blue-900 border-blue-200',
                customerName: c.customerName || 'Client Comptoir',
                clientId: c.clientId || null,
                siteName: c.siteName || null,
                amount: c.initialAmount || 0,
                remainingAmount: c.remainingAmount !== undefined ? c.remainingAmount : c.initialAmount,
                status: c.status,
                statusLabel: isActive ? 'Actif' : (isPartial ? 'Partiel' : (isUsed ? 'Consommé' : (isExpired ? 'Expiré' : c.status || 'Actif'))),
                statusColor: isActive ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : (isPartial ? 'bg-amber-100 text-amber-800 border-amber-300' : (isUsed ? 'bg-gray-100 text-gray-700 border-gray-300' : 'bg-rose-100 text-rose-800 border-rose-300')),
                details: isReliquat ? `Reliquat caisse (Solde: ${formatPrice(c.remainingAmount || 0)})` : `Solde disponible: ${formatPrice(c.remainingAmount || 0)}`,
                rawCreditNote: c,
                expiresAt: c.expiresAt
            });

            // 2.b Remboursements en espèces effectués sur ce bon d'avoir
            (c.usageHistory || []).forEach((u, uIdx) => {
                if (u.type === 'cash_refund') {
                    const refCode = u.receiptCode || `RMB-${c.code}-${uIdx}`;
                    recordedRefundCodes.add(refCode);
                    ops.push({
                        id: `op_rf_${refCode}`,
                        date: u.date || rawDate,
                        kind: 'cash_refund',
                        category: 'cash_refund',
                        refCode: refCode,
                        typeLabel: 'Remboursement Espèces',
                        badgeText: '💵 Décaissement Espèces',
                        badgeColor: 'bg-emerald-100 text-emerald-950 border-emerald-300 font-bold',
                        customerName: u.recipientName || c.customerName || 'Client Comptoir',
                        clientId: c.clientId || null,
                        siteName: c.siteName || null,
                        amount: u.amountDeducted || 0,
                        remainingAmount: u.remainingBalance !== undefined ? u.remainingBalance : (c.remainingAmount || 0),
                        status: 'refunded',
                        statusLabel: 'Espèces Remboursées',
                        statusColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
                        details: `Remboursement sur bon ${c.code}${u.motif ? ` • Motif: ${u.motif}` : ''}`,
                        transactionNumber: c.code,
                        rawCreditNote: c,
                        rawRefund: {
                            receiptCode: refCode,
                            refundedAmount: u.amountDeducted,
                            remainingBalance: u.remainingBalance !== undefined ? u.remainingBalance : (c.remainingAmount || 0),
                            creditNote: c,
                            cashierName: u.cashierName || 'Caissier',
                            recipientName: u.recipientName || c.customerName || 'Client',
                            motif: u.motif || '',
                            date: u.date ? new Date(u.date) : new Date()
                        }
                    });
                }
            });
        });

        // 3. Remboursements d'Avoirs enregistrés dans le journal des dépenses (pour résilience totale)
        (expenses || []).forEach(exp => {
            if (exp.category === 'Remboursement Avoir Espèces') {
                const refCode = exp.receiptCode || `EXP-${exp.id}`;
                if (!recordedRefundCodes.has(refCode)) {
                    recordedRefundCodes.add(refCode);
                    const matchingCreditNote = (creditNotes || []).find(c => c.code === exp.creditNoteCode || String(c.id) === String(exp.creditNoteId));
                    ops.push({
                        id: `op_rf_${refCode}`,
                        date: exp.date || new Date().toISOString(),
                        kind: 'cash_refund',
                        category: 'cash_refund',
                        refCode: refCode,
                        typeLabel: 'Remboursement Espèces',
                        badgeText: '💵 Décaissement Espèces',
                        badgeColor: 'bg-emerald-100 text-emerald-950 border-emerald-300 font-bold',
                        customerName: exp.customerName || matchingCreditNote?.customerName || 'Client Comptoir',
                        clientId: exp.clientId || matchingCreditNote?.clientId || null,
                        siteName: matchingCreditNote?.siteName || null,
                        amount: exp.amount || 0,
                        remainingAmount: matchingCreditNote?.remainingAmount !== undefined ? matchingCreditNote.remainingAmount : 0,
                        status: 'refunded',
                        statusLabel: 'Espèces Remboursées',
                        statusColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
                        details: exp.motif || (exp.creditNoteCode ? `Remboursement sur bon ${exp.creditNoteCode}` : "Remboursement d'avoir en espèces"),
                        transactionNumber: exp.creditNoteCode || '',
                        rawCreditNote: matchingCreditNote,
                        rawRefund: {
                            receiptCode: refCode,
                            refundedAmount: exp.amount,
                            remainingBalance: matchingCreditNote?.remainingAmount !== undefined ? matchingCreditNote.remainingAmount : 0,
                            creditNote: matchingCreditNote || { code: exp.creditNoteCode, initialAmount: exp.amount, remainingAmount: 0 },
                            cashierName: exp.cashier || 'Caissier',
                            recipientName: exp.customerName || matchingCreditNote?.customerName || 'Client',
                            motif: exp.motif || '',
                            date: exp.date ? new Date(exp.date) : new Date()
                        }
                    });
                }
            }
        });

        // Tri chronologique décroissant (plus récent au début)
        return ops.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [returns, creditNotes, expenses, nowTimestamp]);

    // Filtrage temporel des opérations unifiées
    const periodUnifiedOperations = useMemo(() => {
        if (period === 'all' || !currentRange.start) return allUnifiedOperations;
        return allUnifiedOperations.filter(op => {
            if (!op.date) return false;
            const d = new Date(op.date);
            if (isNaN(d.getTime())) return true;
            return isWithinInterval(d, { start: currentRange.start, end: currentRange.end });
        });
    }, [allUnifiedOperations, period, currentRange]);

    // Filtrage dynamique complet (recherche + type opération + client + KPI sélectionné)
    const filteredUnifiedOperations = useMemo(() => {
        return periodUnifiedOperations.filter(op => {
            const matchSearch = !searchTerm ||
                (op.refCode && op.refCode.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (op.customerName && op.customerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (op.siteName && op.siteName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (op.typeLabel && op.typeLabel.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (op.transactionNumber && op.transactionNumber.toLowerCase().includes(searchTerm.toLowerCase()));

            const matchClient = clientFilter === 'all' || (op.customerName && op.customerName.toLowerCase() === clientFilter.toLowerCase());

            let matchOp = true;
            if (operationFilter === 'none' || operationFilter === 'all') {
                matchOp = true;
            } else if (operationFilter === 'returns_all') {
                matchOp = op.kind === 'return';
            } else if (operationFilter === 'cash') {
                matchOp = (op.kind === 'return' && op.category === 'cash') || op.kind === 'cash_refund';
            } else if (operationFilter === 'cash_refund') {
                matchOp = op.kind === 'cash_refund';
            } else if (operationFilter === 'avoir' || operationFilter === 'debt_deduction') {
                matchOp = op.kind === 'return' && op.category === operationFilter;
            } else if (operationFilter === 'credit_all') {
                matchOp = op.kind === 'credit_note' || op.kind === 'cash_refund';
            } else if (operationFilter === 'reliquat') {
                matchOp = op.category === 'reliquat';
            } else if (operationFilter === 'active') {
                matchOp = op.kind === 'credit_note' && (op.status === 'active' || op.statusLabel === 'Actif');
            } else if (operationFilter === 'partial') {
                matchOp = op.kind === 'credit_note' && (op.status === 'partial' || op.statusLabel === 'Partiel');
            } else if (operationFilter === 'used') {
                matchOp = (op.kind === 'credit_note' && (op.status === 'used' || op.remainingAmount <= 0)) || op.kind === 'cash_refund';
            } else if (operationFilter === 'cancelled') {
                matchOp = op.kind === 'credit_note' && (op.status === 'cancelled' || op.statusLabel === 'Expiré');
            }

            // Filtre interactif issu du clic sur l'un des 4 KPI
            let matchKpi = true;
            if (selectedKpi === 'returns') {
                matchKpi = op.kind === 'return';
            } else if (selectedKpi === 'active_avoirs') {
                matchKpi = op.kind === 'credit_note' && (op.status === 'active' || op.status === 'partial' || op.remainingAmount > 0);
            } else if (selectedKpi === 'reintegrated') {
                matchKpi = op.kind === 'return' && (op.rawReturn?.items || []).some(i => i.condition === 'intact' || i.reintegrated);
            } else if (selectedKpi === 'damaged') {
                matchKpi = op.kind === 'return' && (op.rawReturn?.items || []).some(i => i.condition === 'damaged' && !i.reintegrated);
            }

            return matchSearch && matchClient && matchOp && matchKpi;
        });
    }, [periodUnifiedOperations, searchTerm, clientFilter, operationFilter, selectedKpi]);

    // Filtered returns table
    const filteredReturns = useMemo(() => {
        return periodReturns.filter(r => {
            const matchSearch = !searchTerm ||
                (r.returnNumber && r.returnNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (r.customerName && r.customerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (r.voucherCode && r.voucherCode.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (r.transactionNumber && r.transactionNumber.toLowerCase().includes(searchTerm.toLowerCase()));

            let matchMethod = true;
            if (operationFilter === 'none' || operationFilter === 'all' || operationFilter === 'returns_all') {
                matchMethod = true;
            } else if (operationFilter === 'cash' || operationFilter === 'avoir' || operationFilter === 'debt_deduction') {
                matchMethod = r.refundMethod === operationFilter;
            } else {
                matchMethod = false;
            }

            const matchClient = clientFilter === 'all' || (r.customerName && r.customerName.toLowerCase() === clientFilter.toLowerCase());

            // Filtre interactif issu du clic sur KPI (Articles réintégrés ou Avaries/rebuts)
            let matchKpi = true;
            if (selectedKpi === 'reintegrated') {
                matchKpi = (r.items || []).some(i => i.condition === 'intact' || i.reintegrated);
            } else if (selectedKpi === 'damaged') {
                matchKpi = (r.items || []).some(i => i.condition === 'damaged' && !i.reintegrated);
            }

            return matchSearch && matchMethod && matchClient && matchKpi;
        });
    }, [periodReturns, searchTerm, operationFilter, clientFilter, selectedKpi]);

    // Filtered credit notes table
    const filteredCreditNotes = useMemo(() => {
        return periodCreditNotes.filter(c => {
            const matchSearch = !searchTerm ||
                (c.code && c.code.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (c.customerName && c.customerName.toLowerCase().includes(searchTerm.toLowerCase()));

            let matchStatus = true;
            if (operationFilter === 'none' || operationFilter === 'all' || operationFilter === 'credit_all') {
                matchStatus = true;
            } else if (operationFilter === 'reliquat') {
                matchStatus = c.type === 'change_reliquat';
            } else if (operationFilter === 'standard') {
                matchStatus = c.type !== 'change_reliquat';
            } else if (operationFilter === 'active' || operationFilter === 'partial' || operationFilter === 'used' || operationFilter === 'cancelled') {
                matchStatus = c.status === operationFilter;
            } else {
                matchStatus = false;
            }

            const matchClient = clientFilter === 'all' || (c.customerName && c.customerName.toLowerCase() === clientFilter.toLowerCase());

            // Filtre interactif KPI pour les avoirs actifs
            let matchKpi = true;
            if (selectedKpi === 'active_avoirs') {
                matchKpi = (c.status === 'active' || c.status === 'partial') && (c.remainingAmount > 0);
            }

            return matchSearch && matchStatus && matchClient && matchKpi;
        });
    }, [periodCreditNotes, searchTerm, operationFilter, clientFilter, selectedKpi]);

    // ── Pagination & Sélection groupée pour les 4 tableaux ──
    const activeDataList = useMemo(() => {
        switch (activeTab) {
            case 'all': return filteredUnifiedOperations;
            case 'returns': return filteredReturns;
            case 'activeVouchers': return filteredAllActiveCreditNotes;
            case 'creditNotes': return filteredCreditNotes;
            default: return filteredUnifiedOperations;
        }
    }, [activeTab, filteredUnifiedOperations, filteredReturns, filteredAllActiveCreditNotes, filteredCreditNotes]);

    const totalPages = Math.max(1, Math.ceil(activeDataList.length / itemsPerPage));

    const paginatedUnifiedOperations = useMemo(() => {
        if (activeTab !== 'all') return [];
        const start = (currentPage - 1) * itemsPerPage;
        return filteredUnifiedOperations.slice(start, start + itemsPerPage);
    }, [filteredUnifiedOperations, currentPage, itemsPerPage, activeTab]);

    const paginatedReturns = useMemo(() => {
        if (activeTab !== 'returns') return [];
        const start = (currentPage - 1) * itemsPerPage;
        return filteredReturns.slice(start, start + itemsPerPage);
    }, [filteredReturns, currentPage, itemsPerPage, activeTab]);

    const paginatedAllActiveCreditNotes = useMemo(() => {
        if (activeTab !== 'activeVouchers') return [];
        const start = (currentPage - 1) * itemsPerPage;
        return filteredAllActiveCreditNotes.slice(start, start + itemsPerPage);
    }, [filteredAllActiveCreditNotes, currentPage, itemsPerPage, activeTab]);

    const paginatedCreditNotes = useMemo(() => {
        if (activeTab !== 'creditNotes') return [];
        const start = (currentPage - 1) * itemsPerPage;
        return filteredCreditNotes.slice(start, start + itemsPerPage);
    }, [filteredCreditNotes, currentPage, itemsPerPage, activeTab]);

    const paginatedCurrentList = useMemo(() => {
        switch (activeTab) {
            case 'all': return paginatedUnifiedOperations;
            case 'returns': return paginatedReturns;
            case 'activeVouchers': return paginatedAllActiveCreditNotes;
            case 'creditNotes': return paginatedCreditNotes;
            default: return [];
        }
    }, [activeTab, paginatedUnifiedOperations, paginatedReturns, paginatedAllActiveCreditNotes, paginatedCreditNotes]);

    const allCurrentPageSelected = paginatedCurrentList.length > 0 && paginatedCurrentList.every(item => selectedRowIds.includes(item.id));

    const handleSelectAll = () => {
        const pageIds = paginatedCurrentList.map(item => item.id);
        if (allCurrentPageSelected) {
            setSelectedRowIds(prev => prev.filter(id => !pageIds.includes(id)));
        } else {
            setSelectedRowIds(prev => Array.from(new Set([...prev, ...pageIds])));
        }
    };

    const handleSelectRow = (id) => {
        setSelectedRowIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const handleBulkExportExcel = () => {
        if (selectedRowIds.length === 0) return;

        if (activeTab === 'all') {
            const filename = `operations_retours_avoirs_${format(new Date(), 'yyyyMMdd_HHmm')}`;
            const rows = filteredUnifiedOperations
                .filter(op => selectedRowIds.includes(op.id))
                .map(op => {
                    const d = new Date(op.date);
                    return {
                        'Date': !isNaN(d.getTime()) ? format(d, 'dd/MM/yyyy') : '',
                        'Heure': !isNaN(d.getTime()) ? format(d, 'HH:mm') : '',
                        'Nature Opération': op.typeLabel || '',
                        'Référence / Code': op.refCode || '',
                        'Client': op.customerName || '',
                        'Chantier': op.siteName || '',
                        'Montant Opération': op.amount || 0,
                        'Solde Restant': op.remainingAmount || 0,
                        'Statut': op.statusLabel || ''
                    };
                });
            exportToExcel(rows, filename, 'Opérations');
        } else if (activeTab === 'returns') {
            const filename = `retours_marchandises_${format(new Date(), 'yyyyMMdd_HHmm')}`;
            const rows = filteredReturns
                .filter(r => selectedRowIds.includes(r.id))
                .map(r => {
                    const d = new Date(r.date);
                    const itemsStr = (r.items || []).map(i => `${i.name} (x${i.quantityReturned || i.quantity || 1})`).join(', ');
                    return {
                        'Date': !isNaN(d.getTime()) ? format(d, 'dd/MM/yyyy') : '',
                        'Heure': !isNaN(d.getTime()) ? format(d, 'HH:mm') : '',
                        'N° Retour': r.returnNumber || '',
                        'Client': r.customerName || '',
                        'Chantier': r.siteName || '',
                        'Vente Liée': r.transactionNumber || 'Comptoir libre',
                        'Montant Remboursé': r.totalAmount || 0,
                        'Mode Règlement': r.refundMethod === 'avoir' ? "Bon d'Avoir" : (r.refundMethod === 'cash' ? "Espèces" : "Dette Déduite"),
                        'Articles Retournés': itemsStr
                    };
                });
            exportToExcel(rows, filename, 'Retours');
        } else {
            const sourceList = activeTab === 'activeVouchers' ? filteredAllActiveCreditNotes : filteredCreditNotes;
            const filename = `bons_avoir_${format(new Date(), 'yyyyMMdd_HHmm')}`;
            const rows = sourceList
                .filter(c => selectedRowIds.includes(c.id))
                .map(c => {
                    const d = new Date(c.createdAt);
                    const exp = c.expiresAt ? new Date(c.expiresAt) : null;
                    return {
                        'Code Bon': c.code || '',
                        'Type': c.type === 'change_reliquat' ? 'Reliquat Monnaie' : 'Avoir Retour',
                        'Client Bénéficiaire': c.customerName || '',
                        'Chantier': c.siteName || '',
                        'Date Émission': !isNaN(d.getTime()) ? format(d, 'dd/MM/yyyy') : '',
                        'Date Expiration': exp && !isNaN(exp.getTime()) ? format(exp, 'dd/MM/yyyy') : '',
                        'Montant Initial': c.initialAmount || 0,
                        'Solde Restant': c.remainingAmount || 0,
                        'Statut': c.status || 'Actif'
                    };
                });
            exportToExcel(rows, filename, "Bons d'Avoir");
        }
        T.success(`${selectedRowIds.length} élément(s) exporté(s) au format Excel (.xlsx)`);
    };

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
            {/* ── EN-TÊTE ÉCRAN OFFICIEL KABLLIX ERP ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-[4px] border-2 border-gray-300 shadow-sm">
                <div>
                    <h1 className="text-base sm:text-lg font-bold text-[#001d35] tracking-tight">
                        Retours d'Articles & Bons d'Avoir
                    </h1>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            setModalStep(1);
                            setSelectedSale(null);
                            setReturnedItems([]);
                            setShowNewReturnModal(true);
                        }}
                        className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold uppercase tracking-wider rounded-[4px] bg-[#001d35] hover:bg-[#00284a] text-white transition-all cursor-pointer shadow-sm active:scale-95"
                    >
                        <Plus className="w-3.5 h-3.5 text-[#f77500]" />
                        <span>Nouveau Retour Client</span>
                    </button>
                </div>
            </div>



            {/* ── 4 CARTES KPI (INTERACTIVES : CLIC POUR FILTRER L'OBJECTIF DANS LA LISTE) ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. Retours Effectués */}
                <div
                    role="button"
                    tabIndex={0}
                    onClick={() => handleKpiClick('returns')}
                    title="Cliquer pour afficher tous les retours effectués dans la liste"
                    className={`p-3 rounded-sm border-2 shadow-sm relative group transition-all overflow-hidden flex flex-col justify-center min-h-[120px] cursor-pointer select-none ${
                        selectedKpi === 'returns'
                            ? 'bg-blue-50/50 border-blue-600 ring-2 ring-blue-500/30 shadow-md scale-[1.01]'
                            : 'bg-white border-gray-300 hover:border-blue-500 hover:shadow-md hover:scale-[1.005]'
                    }`}
                >
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
                                    <div className="flex items-center justify-between gap-1 mb-0.5">
                                        <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-blue-600/80">Retours Effectués</p>
                                        {selectedKpi === 'returns' ? (
                                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-[3px] bg-blue-600 text-white uppercase tracking-wider shadow-2xs animate-in fade-in">
                                                ✓ Filtré
                                            </span>
                                        ) : (
                                            <span className="text-[9px] font-bold px-1 py-0.2 rounded-[2px] text-gray-400 bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-wider">
                                                Filtrer ↵
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-baseline gap-2 mt-1.5 font-semibold flex-wrap" style={{ color: '#001d35', opacity: 0.85 }}>
                                        <h3 className="text-xl sm:text-2xl font-semibold">
                                            {formatPrice(period !== 'all' ? metrics.periodReturnsAmount : metrics.totalReturnsAmount)}
                                        </h3>
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-[3px] bg-blue-50 text-blue-800 border border-blue-200 uppercase tracking-wider">
                                            {periodShortLabel}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1.5 font-medium">
                                        {period !== 'all' ? (
                                            <>
                                                <strong className="text-gray-700">{metrics.periodReturnsCount}</strong> retour(s) sur cette période
                                                {metrics.totalReturnsCount !== metrics.periodReturnsCount && (
                                                    <span className="text-gray-400 font-normal ml-1">({metrics.totalReturnsCount} au total)</span>
                                                )}
                                            </>
                                        ) : (
                                            <><strong className="text-gray-700">{metrics.totalReturnsCount}</strong> retour(s) au total</>
                                        )}
                                    </p>
                                </div>
                            </div>
                            <img src="/icons8/fluency_240_cash-in-hand.png" alt="" className="absolute bottom-2 right-2 w-16 h-16 opacity-25 group-hover:opacity-40 group-hover:scale-105 transition-all pointer-events-none" />
                        </>
                    )}
                </div>

                {/* 2. Avoirs Actifs en Cours */}
                <div
                    role="button"
                    tabIndex={0}
                    onClick={() => handleKpiClick('active_avoirs')}
                    title="Cliquer pour afficher tous les avoirs actifs au rachat dans la liste"
                    className={`p-3 rounded-sm border-2 shadow-sm relative group transition-all overflow-hidden flex flex-col justify-center min-h-[120px] cursor-pointer select-none ${
                        selectedKpi === 'active_avoirs'
                            ? 'bg-amber-50/50 border-amber-600 ring-2 ring-amber-500/30 shadow-md scale-[1.01]'
                            : 'bg-white border-gray-300 hover:border-amber-500 hover:shadow-md hover:scale-[1.005]'
                    }`}
                >
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
                                    <div className="flex items-center justify-between gap-1 mb-0.5">
                                        <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-amber-600/80">Avoirs Actifs</p>
                                        {selectedKpi === 'active_avoirs' ? (
                                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-[3px] bg-amber-600 text-white uppercase tracking-wider shadow-2xs animate-in fade-in">
                                                ✓ Filtré
                                            </span>
                                        ) : (
                                            <span className="text-[9px] font-bold px-1 py-0.2 rounded-[2px] text-gray-400 bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-wider">
                                                Filtrer ↵
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-baseline gap-2 mt-1.5 font-semibold flex-wrap" style={{ color: '#b45309', opacity: 0.85 }}>
                                        <h3 className="text-xl sm:text-2xl font-semibold">{formatPrice(metrics.activeAvoirsTotal)}</h3>
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-[3px] bg-amber-50 text-amber-800 border border-amber-300 uppercase tracking-wider">
                                            En cours
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1.5 font-medium">
                                        <strong className="text-gray-700">{metrics.activeAvoirsCount}</strong> bon(s) disponibles au rachat
                                        {period !== 'all' && metrics.periodAvoirsCount > 0 && (
                                            <span className="text-amber-700 font-semibold ml-1">· {metrics.periodAvoirsCount} émis ({periodShortLabel})</span>
                                        )}
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
                <div
                    role="button"
                    tabIndex={0}
                    onClick={() => handleKpiClick('reintegrated')}
                    title="Cliquer pour afficher les retours avec articles réintégrés en stock"
                    className={`p-3 rounded-sm border-2 shadow-sm relative group transition-all overflow-hidden flex flex-col justify-center min-h-[120px] cursor-pointer select-none ${
                        selectedKpi === 'reintegrated'
                            ? 'bg-emerald-50/50 border-emerald-600 ring-2 ring-emerald-500/30 shadow-md scale-[1.01]'
                            : 'bg-white border-gray-300 hover:border-emerald-500 hover:shadow-md hover:scale-[1.005]'
                    }`}
                >
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
                                    <div className="flex items-center justify-between gap-1 mb-0.5">
                                        <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-emerald-600/80">Articles Réintégrés</p>
                                        {selectedKpi === 'reintegrated' ? (
                                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-[3px] bg-emerald-600 text-white uppercase tracking-wider shadow-2xs animate-in fade-in">
                                                ✓ Filtré
                                            </span>
                                        ) : (
                                            <span className="text-[9px] font-bold px-1 py-0.2 rounded-[2px] text-gray-400 bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-wider">
                                                Filtrer ↵
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-baseline gap-2 mt-1.5 font-semibold flex-wrap" style={{ color: '#059669', opacity: 0.85 }}>
                                        <h3 className="text-xl sm:text-2xl font-semibold">
                                            {period !== 'all' ? metrics.periodReintegratedItems : metrics.totalReintegratedItems} unités
                                        </h3>
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-[3px] bg-emerald-50 text-emerald-800 border border-emerald-200 uppercase tracking-wider">
                                            {periodShortLabel}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1.5 font-medium">
                                        {period !== 'all' ? `Remises en stock (${periodShortLabel})` : "Total remises en stock physique"}
                                    </p>
                                </div>
                            </div>
                            <img src="/icons8/fluency_240_box.png" alt="" className="absolute bottom-2 right-2 w-16 h-16 opacity-25 group-hover:opacity-40 group-hover:scale-105 transition-all pointer-events-none" />
                        </>
                    )}
                </div>

                {/* 4. Avaries / Rebuts */}
                <div
                    role="button"
                    tabIndex={0}
                    onClick={() => handleKpiClick('damaged')}
                    title="Cliquer pour afficher les retours contenant des articles avariés ou rebuts"
                    className={`p-3 rounded-sm border-2 shadow-sm relative group transition-all overflow-hidden flex flex-col justify-center min-h-[120px] cursor-pointer select-none ${
                        selectedKpi === 'damaged'
                            ? 'bg-rose-50/50 border-rose-600 ring-2 ring-rose-500/30 shadow-md scale-[1.01]'
                            : 'bg-white border-gray-300 hover:border-rose-500 hover:shadow-md hover:scale-[1.005]'
                    }`}
                >
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
                                    <div className="flex items-center justify-between gap-1 mb-0.5">
                                        <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-rose-600/80">Avaries & Rebuts</p>
                                        {selectedKpi === 'damaged' ? (
                                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-[3px] bg-rose-600 text-white uppercase tracking-wider shadow-2xs animate-in fade-in">
                                                ✓ Filtré
                                            </span>
                                        ) : (
                                            <span className="text-[9px] font-bold px-1 py-0.2 rounded-[2px] text-gray-400 bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-wider">
                                                Filtrer ↵
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-baseline gap-2 mt-1.5 font-semibold flex-wrap" style={{ color: '#e11d48', opacity: 0.85 }}>
                                        <h3 className="text-xl sm:text-2xl font-semibold">
                                            {period !== 'all' ? metrics.periodDamagedItems : metrics.totalDamagedItems} unités
                                        </h3>
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-[3px] bg-rose-50 text-rose-800 border border-rose-200 uppercase tracking-wider">
                                            {periodShortLabel}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1.5 font-medium">
                                        {period !== 'all' ? `${metrics.periodDamagedRate}% de taux de rebut (${periodShortLabel})` : `${metrics.damagedRate}% de taux de rebut (Global)`}
                                    </p>
                                </div>
                            </div>
                            <img src="/icons8/fluency_240_high-priority.png" alt="" className="absolute bottom-2 right-2 w-16 h-16 opacity-25 group-hover:opacity-40 group-hover:scale-105 transition-all pointer-events-none" />
                        </>
                    )}
                </div>
            </div>

            {/* ── BARRE D'ONGLETS PRINCIPAUX & RECHERCHE (STYLE OFFICIEL KABLLIX ERP) ── */}
            <div className="bg-white p-2 sm:p-2.5 rounded-[4px] border-2 border-gray-300 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
                {/* Onglets de sélection principale : Toutes les Opérations / Registre des Retours / Portefeuille Bons d'Avoir / Tous les Avoirs Actifs */}
                <div className="flex items-center gap-1 bg-gray-100/90 p-1 rounded-[4px] border-2 border-gray-300 flex-wrap">
                    {/* Onglet 0 : Grand Livre - Toutes les Opérations */}
                    <button
                        type="button"
                        onClick={() => {
                            handleFilterChange(() => {
                                setActiveTab('all');
                                setOperationFilter('all');
                                setPeriod('today');
                                setCustomStartDate('');
                                setCustomEndDate('');
                            });
                        }}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-[4px] transition-all cursor-pointer flex items-center gap-2 ${
                            activeTab === 'all'
                                ? 'bg-[#001d35] text-white shadow-xs'
                                : 'text-gray-700 hover:text-[#001d35] hover:bg-gray-200/60'
                        }`}
                    >
                        <ClipboardList className={`w-3.5 h-3.5 ${activeTab === 'all' ? 'text-[#f77500]' : 'text-gray-500'}`} />
                        <span>Toutes les Opérations</span>
                        {periodUnifiedOperations.length > 0 && (
                            <span className={`min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center flex-shrink-0 shadow-xs ${
                                activeTab === 'all' ? 'bg-[#f77500] text-white' : 'bg-gray-200 text-gray-800'
                            }`}>
                                {periodUnifiedOperations.length}
                            </span>
                        )}
                    </button>

                    {/* Onglet 1 : Registre des Retours */}
                    <button
                        type="button"
                        onClick={() => {
                            handleFilterChange(() => {
                                setActiveTab('returns');
                                setOperationFilter('none');
                                setPeriod('today');
                                setCustomStartDate('');
                                setCustomEndDate('');
                            });
                            markReturnsAsSeen();
                        }}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-[4px] transition-all cursor-pointer flex items-center gap-2 ${
                            activeTab === 'returns'
                                ? 'bg-[#001d35] text-white shadow-xs'
                                : 'text-gray-700 hover:text-[#001d35] hover:bg-gray-200/60'
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

                    {/* Onglet 2 : Portefeuille Bons d'Avoir */}
                    <button
                        type="button"
                        onClick={() => handleFilterChange(() => {
                            setActiveTab('creditNotes');
                            setOperationFilter('none');
                            setPeriod('today');
                            setCustomStartDate('');
                            setCustomEndDate('');
                        })}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-[4px] transition-all cursor-pointer flex items-center gap-2 ${
                            activeTab === 'creditNotes'
                                ? 'bg-[#001d35] text-white shadow-xs'
                                : 'text-gray-700 hover:text-[#001d35] hover:bg-gray-200/60'
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

                    {/* Onglet 3 : Tous les Avoirs Actifs */}
                    <button
                        type="button"
                        onClick={() => handleFilterChange(() => {
                            setActiveTab('activeVouchers');
                            setOperationFilter('none');
                            setPeriod('all');
                            setCustomStartDate('');
                            setCustomEndDate('');
                        })}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-[4px] transition-all cursor-pointer flex items-center gap-1.5 ${
                            activeTab === 'activeVouchers'
                                ? 'bg-[#001d35] text-white shadow-xs'
                                : 'text-gray-700 hover:text-[#001d35] hover:bg-gray-200/60'
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

                {/* Recherche à droite */}
                <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder={
                            activeTab === 'all'
                                ? "Rechercher opération, N°, client..."
                                : activeTab === 'returns'
                                ? "Rechercher N° retour, client..."
                                : "Rechercher code d'avoir, client..."
                        }
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setCurrentPage(1);
                            setSelectedRowIds([]);
                        }}
                        className="w-full pl-8 pr-7 py-1.5 text-xs bg-gray-50 border-2 border-gray-300 focus:border-[#001d35] rounded-[4px] font-medium text-gray-800 focus:outline-none"
                    />
                    {searchTerm && (
                        <button
                            type="button"
                            onClick={() => handleFilterChange(setSearchTerm, '')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                            title="Effacer la recherche"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* ── BARRE D'OUTILS EN BAS DÉDIÉE (SÉLECTEUR COMPACT + CLIENT + FILTRES PAR DATE — IDENTIQUE À HISTORIQUE DES OPÉRATIONS) ── */}
            <div className="bg-white p-2.5 rounded-[4px] border-2 border-gray-300 shadow-sm flex flex-col gap-2.5 animate-in fade-in duration-150">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    {/* Sélecteur de type d'opération */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <label htmlFor="operation-type-select" className="text-xs font-semibold text-[#001d35] uppercase tracking-wider flex items-center gap-1.5 shrink-0">
                            <Filter className="w-3.5 h-3.5 text-[#f77500]" />
                            <span>Opération :</span>
                        </label>
                        <select
                            id="operation-type-select"
                            value={operationFilter}
                            onChange={(e) => {
                                const val = e.target.value;
                                handleFilterChange(() => {
                                    setOperationFilter(val);
                                    setPeriod('today');
                                    setCustomStartDate('');
                                    setCustomEndDate('');
                                    if (val === 'all' || val === 'cash_refund') {
                                        setActiveTab('all');
                                    } else if (val === 'returns_all' || val === 'cash' || val === 'avoir' || val === 'debt_deduction') {
                                        if (activeTab !== 'all' && activeTab !== 'returns') {
                                            setActiveTab('returns');
                                        }
                                    } else if (val === 'credit_all' || val === 'active' || val === 'partial' || val === 'reliquat' || val === 'used' || val === 'cancelled') {
                                        if (activeTab !== 'all' && activeTab !== 'creditNotes') {
                                            setActiveTab('creditNotes');
                                        }
                                    }
                                });
                            }}
                            className="px-3 py-1.5 text-xs font-semibold border-2 border-gray-300 rounded-[4px] focus:outline-none focus:ring-1 focus:ring-[#001d35] bg-white text-[#001d35] cursor-pointer shadow-2xs"
                        >
                            <option value="none">Aucun (Par défaut)</option>
                            <option value="all">📋 Toutes les opérations (Retours & Avoirs)</option>
                            <optgroup label="Retours de Marchandises">
                                <option value="returns_all">📦 Tous les Retours de Marchandises</option>
                                <option value="cash">💵 Remboursement Espèces</option>
                                <option value="avoir">🎟️ Bon d'Avoir Émis</option>
                                <option value="debt_deduction">📉 Déduction Dette</option>
                            </optgroup>
                            <optgroup label="Bons d'Avoir & Reliquats">
                                <option value="credit_all">🏷️ Tous les Bons d'Avoir & Reliquats</option>
                                <option value="cash_refund">💵 Décaissements Espèces (Remboursements)</option>
                                <option value="active">🟢 Actif (Rachat disponible)</option>
                                <option value="partial">🟡 Partiel (Solde restant)</option>
                                <option value="reliquat">🎟️ Reliquats de Caisse</option>
                                <option value="used">⚪ Consommé (Épuisé)</option>
                                <option value="cancelled">🔴 Expiré / Annulé</option>
                            </optgroup>
                        </select>
                    </div>

                    {/* Sélecteur de Client (filtrer par nom de client) */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <label htmlFor="operation-client-select" className="text-xs font-semibold text-[#001d35] uppercase tracking-wider flex items-center gap-1.5 shrink-0">
                            <User className="w-3.5 h-3.5 text-[#f77500]" />
                            <span>Client :</span>
                        </label>
                        <select
                            id="operation-client-select"
                            value={clientFilter}
                            onChange={(e) => handleFilterChange(setClientFilter, e.target.value)}
                            className="px-3 py-1.5 text-xs font-semibold border-2 border-gray-300 rounded-[4px] focus:outline-none focus:ring-1 focus:ring-[#001d35] bg-white text-[#001d35] cursor-pointer shadow-2xs max-w-[210px]"
                        >
                            <option value="all">Tous les clients</option>
                            {uniqueClients.map(cName => (
                                <option key={cName} value={cName}>{cName}</option>
                            ))}
                        </select>
                    </div>

                    {/* Filtres par date (Aujourd'hui, 7 jours, Ce mois, Tout, Période...) */}
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#001d35] uppercase tracking-wider hidden lg:flex">
                            <Calendar className="w-3.5 h-3.5 text-[#f77500]" />
                            <span>Période :</span>
                        </div>
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
                                    onClick={() => handleFilterChange(() => {
                                        setPeriod(opt.key);
                                        // Si le filtre actif sur le KPI Avoir Actifs est actif et qu'on clique sur Aujourd'hui (ou autre date), désactiver le KPI
                                        if (selectedKpi === 'active_avoirs') {
                                            setSelectedKpi(null);
                                        }
                                    })}
                                    className={`px-2.5 py-1 rounded-[4px] text-xs font-semibold transition-all cursor-pointer ${
                                        period === opt.key
                                            ? 'bg-[#001d35] text-white shadow-xs'
                                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>

                        {period === 'custom' && (
                            <div className="flex items-center gap-1.5 text-xs">
                                <input
                                    type="date"
                                    value={customStartDate}
                                    onChange={e => handleFilterChange(() => {
                                        setCustomStartDate(e.target.value);
                                        if (selectedKpi === 'active_avoirs') setSelectedKpi(null);
                                    })}
                                    className="px-2 py-1 text-xs border border-gray-300 rounded-[4px] font-medium text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-[#001d35]"
                                />
                                <span className="text-gray-400 text-xs font-medium">à</span>
                                <input
                                    type="date"
                                    value={customEndDate}
                                    onChange={e => handleFilterChange(() => {
                                        setCustomEndDate(e.target.value);
                                        if (selectedKpi === 'active_avoirs') setSelectedKpi(null);
                                    })}
                                    className="px-2 py-1 text-xs border border-gray-300 rounded-[4px] font-medium text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-[#001d35]"
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Actions groupées / Bulk actions lorsque des cases sont cochées */}
                {selectedRowIds.length > 0 && (
                    <div className="flex items-center justify-between gap-2 flex-wrap bg-blue-50/90 px-3 py-1.5 rounded-[4px] border-2 border-blue-400 animate-in fade-in duration-150">
                        <span className="text-xs font-bold text-[#001d35] flex items-center gap-1.5">
                            <CheckSquare className="w-4 h-4 text-[#001d35]" />
                            <span>{selectedRowIds.length} {activeTab === 'returns' ? 'retour(s)' : activeTab === 'all' ? 'opération(s)' : 'bon(s)'} sélectionné(s)</span>
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={handleBulkExportExcel}
                                className="px-2.5 py-1 bg-white hover:bg-gray-100 text-[#001d35] border border-gray-300 rounded-[4px] text-xs font-semibold uppercase tracking-wider flex items-center gap-1 cursor-pointer shadow-2xs transition-all active:scale-95"
                                title="Exporter les éléments cochés au format Excel (.xlsx)"
                            >
                                <Download className="w-3.5 h-3.5 text-[#f77500]" />
                                <span>Exporter Excel ({selectedRowIds.length})</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedRowIds([])}
                                className="p-1 text-gray-500 hover:text-gray-800 cursor-pointer ml-1"
                                title="Désélectionner tout"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                )}

                {/* Ligne informative : Filtre actif(s) pour Retours & Avoirs */}
                {(operationFilter !== 'none' || clientFilter !== 'all' || period !== 'all' || searchTerm || selectedKpi) && (
                    <div className="pt-2 border-t border-gray-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-[1px] bg-[#f77500] animate-pulse"></span>
                                <span>Filtre actif(s) :</span>
                            </span>

                            {selectedKpi && (
                                <span className="inline-flex items-center gap-1 bg-[#001d35] text-white border border-[#001d35] px-2 py-0.5 rounded-[4px] text-[10px] font-semibold uppercase tracking-wider shadow-2xs">
                                    <span>
                                        {selectedKpi === 'returns' && '📊 KPI : Retours Effectués'}
                                        {selectedKpi === 'active_avoirs' && '📊 KPI : Avoirs Actifs au Rachat'}
                                        {selectedKpi === 'reintegrated' && '📊 KPI : Articles Réintégrés en Stock'}
                                        {selectedKpi === 'damaged' && '📊 KPI : Avaries & Rebuts'}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => handleKpiClick(selectedKpi)}
                                        className="hover:text-[#f77500] cursor-pointer ml-0.5 text-white/80"
                                        title="Retirer le filtre KPI"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </span>
                            )}

                            {operationFilter !== 'none' && (
                                <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-[4px] text-[10px] font-semibold uppercase tracking-wider">
                                    <span>
                                        {operationFilter === 'all' && '📋 Toutes les opérations'}
                                        {operationFilter === 'returns_all' && '📦 Tous les Retours'}
                                        {operationFilter === 'avoir' && "🎟️ Bon d'Avoir (Crédit)"}
                                        {operationFilter === 'cash' && '💵 Remboursement Espèces'}
                                        {operationFilter === 'cash_refund' && '💵 Décaissement Espèces'}
                                        {operationFilter === 'debt_deduction' && '📉 Déduction Dette'}
                                        {operationFilter === 'credit_all' && "🏷️ Tous les Bons d'Avoir & Reliquats"}
                                        {operationFilter === 'active' && '🟢 Actif (Rachat)'}
                                        {operationFilter === 'partial' && '🟡 Partiel'}
                                        {operationFilter === 'used' && '⚪ Consommé'}
                                        {operationFilter === 'cancelled' && '🔴 Expiré / Annulé'}
                                        {operationFilter === 'reliquat' && '🎟️ Reliquats de caisse'}
                                        {operationFilter === 'standard' && '🏷️ Avoirs standards'}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => handleFilterChange(setOperationFilter, 'none')}
                                        className="hover:text-rose-600 cursor-pointer ml-0.5"
                                        title="Retirer le filtre d'opération"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </span>
                            )}

                            {clientFilter !== 'all' && (
                                <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-900 border border-blue-300 px-2 py-0.5 rounded-[4px] text-[10px] font-semibold uppercase tracking-wider">
                                    <span>👤 Client : {clientFilter}</span>
                                    <button
                                        type="button"
                                        onClick={() => handleFilterChange(setClientFilter, 'all')}
                                        className="hover:text-rose-600 cursor-pointer ml-0.5"
                                        title="Retirer le filtre client"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </span>
                            )}

                            {period !== 'all' && (
                                <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-900 border border-blue-300 px-2 py-0.5 rounded-[4px] text-[10px] font-semibold uppercase tracking-wider">
                                    <span>
                                        📅 {period === 'today' || period === 'day' ? "Aujourd'hui" :
                                            period === '7days' || period === 'week' ? "7 derniers jours" :
                                            period === 'month' ? "Ce mois" :
                                            period === 'custom' ? `Du ${customStartDate || '...'} au ${customEndDate || '...'}` : periodLabel}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => handleFilterChange(() => {
                                            setPeriod('all');
                                            setCustomStartDate('');
                                            setCustomEndDate('');
                                        })}
                                        className="hover:text-rose-600 cursor-pointer ml-0.5"
                                        title="Retirer le filtre de période"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </span>
                            )}

                            {searchTerm && (
                                <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-800 border border-gray-300 px-2 py-0.5 rounded-[4px] text-[10px] font-semibold uppercase tracking-wider">
                                    <span>🔍 Recherche : "{searchTerm}"</span>
                                    <button
                                        type="button"
                                        onClick={() => handleFilterChange(setSearchTerm, '')}
                                        className="hover:text-rose-600 cursor-pointer ml-0.5"
                                        title="Effacer la recherche"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </span>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={() => handleFilterChange(() => {
                                setSelectedKpi(null);
                                setOperationFilter('none');
                                setClientFilter('all');
                                setPeriod('all');
                                setSearchTerm('');
                            })}
                            className="text-[10px] font-semibold uppercase tracking-wider text-rose-600 hover:text-rose-800 hover:underline cursor-pointer"
                        >
                            Effacer tous les filtres
                        </button>
                    </div>
                )}
            </div>

            {/* ── TABLEAU GRAND LIVRE DES RETOURS & AVOIRS ── */}
            <div className="bg-white border-2 border-gray-300 rounded-[4px] shadow-xs overflow-hidden">
                <div className="px-3 py-1.5 border-b-2 border-gray-300 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 bg-white">
                    <span className="text-xs font-semibold text-[#001d35] uppercase tracking-wider">
                        {selectedKpi === 'reintegrated' ? "Grand Livre des Retours — Articles Réintégrés en Stock"
                            : selectedKpi === 'damaged' ? "Grand Livre des Retours — Avaries & Rebuts"
                            : selectedKpi === 'active_avoirs' ? "Portefeuille des Bons d'Avoir Actifs au Rachat"
                            : selectedKpi === 'returns' ? "Grand Livre des Retours de Marchandises Effectués"
                            : activeTab === 'all' ? "Grand Livre Unifié — Toutes les Opérations (Retours & Avoirs)"
                            : activeTab === 'returns' ? "Grand Livre des Retours de Marchandises"
                            : activeTab === 'activeVouchers' ? (period !== 'all' ? `Bons d'Avoir Actifs (${periodLabel})` : "Tous les Bons d'Avoir Actifs — Sans restriction de date")
                            : "Portefeuille Officiel des Bons d'Avoir"}
                    </span>
                    <span className="text-[10px] font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-[4px] border border-gray-300">
                        {activeTab === 'all' ? `${filteredUnifiedOperations.length} opération(s)`
                            : activeTab === 'returns' ? `${filteredReturns.length} retour(s)`
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
                            <p className="text-xs font-semibold text-[#001d35] mt-2 uppercase tracking-wider">
                                Synchronisation...
                            </p>
                        </div>
                    ) : activeTab === 'all' ? (
                        filteredUnifiedOperations.length === 0 ? (
                            <div className="p-8 min-h-[160px] flex flex-col items-center justify-center text-center text-gray-400">
                                <ClipboardList className="w-8 h-8 mx-auto text-gray-300 mb-1.5 opacity-50" />
                                <p className="text-xs font-semibold text-gray-600 uppercase">
                                    {period !== 'all' ? `Aucune opération enregistrée (${periodLabel})` : "Aucune opération enregistrée"}
                                </p>
                                <p className="text-[11px] text-gray-400 mt-0.5 font-normal">
                                    {period !== 'all' ? "Sélectionnez « Tout l'historique » pour afficher l'ensemble des opérations." : "Les retours clients et émissions d'avoirs apparaîtront ici."}
                                </p>
                            </div>
                        ) : (
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-[#001d35] text-white uppercase text-[10px] tracking-wider font-semibold divide-x divide-white/10 sticky top-0">
                                        <th style={{ width: '42px', minWidth: '42px' }} className="px-1 py-1.5 text-center border-r-2 border-white/20">
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 rounded-sm border-white/20 accent-[#001d35] cursor-pointer"
                                                checked={paginatedUnifiedOperations.length > 0 && paginatedUnifiedOperations.every(op => selectedRowIds.includes(op.id))}
                                                onChange={handleSelectAll}
                                                title="Tout cocher / Tout décocher"
                                            />
                                        </th>
                                        <th className="py-1.5 px-2.5">Date & Heure</th>
                                        <th className="py-1.5 px-2.5">Nature Opération</th>
                                        <th className="py-1.5 px-2.5">Référence / Code</th>
                                        <th className="py-1.5 px-2.5">Client & Chantier</th>
                                        <th className="py-1.5 px-2.5 text-right">Montant Opération</th>
                                        <th className="py-1.5 px-2.5 text-right">Solde Restant</th>
                                        <th className="py-1.5 px-2.5 text-center">Statut</th>
                                        <th className="py-1.5 px-2.5 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {paginatedUnifiedOperations.map((op, opIdx) => {
                                        const isSelected = selectedRowIds.includes(op.id);
                                        return (
                                        <tr key={op.id} className={`transition-colors border-b border-gray-200 select-none ${
                                            isSelected ? 'bg-blue-50' : opIdx % 2 === 0 ? 'bg-white hover:bg-blue-50/40' : 'bg-slate-50/70 hover:bg-blue-50/40'
                                        }`}>
                                            <td className="px-1 py-1.5 text-center w-10">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 rounded-sm border-gray-300 accent-[#001d35] cursor-pointer"
                                                    checked={isSelected}
                                                    onChange={() => handleSelectRow(op.id)}
                                                />
                                            </td>
                                            <td className="py-1.5 px-2.5 whitespace-nowrap">
                                                <div className="font-semibold text-gray-900">
                                                    {format(new Date(op.date), 'dd/MM/yyyy')}
                                                </div>
                                                <div className="text-[10px] text-gray-500 font-medium">
                                                    {format(new Date(op.date), 'HH:mm')}
                                                </div>
                                            </td>
                                            <td className="py-1.5 px-2.5 whitespace-nowrap">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] border font-bold text-[10px] uppercase tracking-wider ${op.badgeColor}`}>
                                                    {op.badgeText}
                                                </span>
                                            </td>
                                            <td className="py-1.5 px-2.5 font-semibold text-[#001d35] whitespace-nowrap tracking-wide">
                                                <div className="flex items-center gap-1.5">
                                                    <span>{op.refCode}</span>
                                                    {(op.kind === 'credit_note' || op.kind === 'cash_refund') && (
                                                        <button onClick={() => handleCopyCode(op.refCode)} title="Copier le code" className="text-gray-400 hover:text-gray-700 cursor-pointer">
                                                            <Copy className="w-3 h-3" />
                                                        </button>
                                                    )}
                                                </div>
                                                {op.kind === 'cash_refund' && op.transactionNumber ? (
                                                    <div className="text-[10px] text-gray-500 font-normal">
                                                        Bon source : {op.transactionNumber}
                                                    </div>
                                                ) : op.transactionNumber && (
                                                    <div className="text-[10px] text-gray-500 font-normal">
                                                        Vente : {op.transactionNumber}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="py-1.5 px-2.5">
                                                <p className="font-semibold text-gray-900">{op.customerName}</p>
                                                {op.siteName && (
                                                    <p className="text-[10px] text-gray-500 font-medium">Chantier : {op.siteName}</p>
                                                )}
                                            </td>
                                            <td className="py-1.5 px-2.5 text-right font-medium text-gray-700 whitespace-nowrap">
                                                {formatPrice(op.amount)}
                                            </td>
                                            <td className="py-1.5 px-2.5 text-right font-semibold whitespace-nowrap text-xs tracking-tight">
                                                {op.kind === 'credit_note' ? (
                                                    <span className={op.remainingAmount > 0 ? "text-emerald-700" : "text-gray-400"}>
                                                        {formatPrice(op.remainingAmount)}
                                                    </span>
                                                ) : op.kind === 'cash_refund' ? (
                                                    <span className="text-emerald-700 font-medium text-[11px]">
                                                        {formatPrice(op.remainingAmount)}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400 font-normal text-[11px]">—</span>
                                                )}
                                            </td>
                                            <td className="py-1.5 px-2.5 text-center whitespace-nowrap">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[10px] font-semibold uppercase tracking-wider border ${op.statusColor}`}>
                                                    {op.statusLabel}
                                                </span>
                                            </td>
                                            <td className="py-1.5 px-2.5 text-center whitespace-nowrap">
                                                {op.kind === 'return' ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => setViewingReturn(op.rawReturn)}
                                                        className="inline-flex items-center gap-1 bg-white hover:bg-gray-100 text-[#001d35] border border-gray-300 px-2 py-1 rounded-[4px] font-semibold text-[11px] shadow-2xs transition-colors cursor-pointer"
                                                        title="Voir le bon de retour"
                                                    >
                                                        <Printer className="w-3 h-3 text-[#f77500]" />
                                                        <span>Reçu</span>
                                                    </button>
                                                ) : op.kind === 'cash_refund' ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => setPrintedCashRefund(op.rawRefund)}
                                                        className="inline-flex items-center gap-1 bg-white hover:bg-gray-100 text-emerald-800 border border-emerald-300 px-2 py-1 rounded-[4px] font-semibold text-[11px] shadow-2xs transition-colors cursor-pointer active:scale-95"
                                                        title="Imprimer la décharge de remboursement espèces"
                                                    >
                                                        <Printer className="w-3 h-3 text-emerald-600" />
                                                        <span>Quittance</span>
                                                    </button>
                                                ) : (
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        {op.rawCreditNote && op.remainingAmount > 0 && op.rawCreditNote.status !== 'cancelled' && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleOpenCashRefund(op.rawCreditNote)}
                                                                className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 rounded-[4px] font-semibold text-[11px] shadow-2xs transition-colors cursor-pointer active:scale-95"
                                                                title="Rembourser cet avoir en espèces"
                                                            >
                                                                <Banknote className="w-3 h-3 text-emerald-100" />
                                                                <span>Espèces</span>
                                                            </button>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const c = op.rawCreditNote;
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
                                                                    items: [],
                                                                    notes: c.notes || (isReliquat ? 'Reliquat monnaie converti en bon' : "Bon d'avoir émis")
                                                                });
                                                                setViewingCreditNote(c);
                                                            }}
                                                            className="inline-flex items-center gap-1 bg-white hover:bg-gray-100 text-[#001d35] border border-gray-300 px-2 py-1 rounded-[4px] font-semibold text-[11px] shadow-2xs transition-colors cursor-pointer"
                                                            title="Imprimer l'avoir"
                                                        >
                                                            <Printer className="w-3 h-3 text-[#f77500]" />
                                                            <span>Imprimer</span>
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                    })}
                                </tbody>
                            </table>
                        )
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
                                    <tr className="bg-[#001d35] text-white uppercase text-[10px] tracking-wider font-semibold divide-x divide-white/10 sticky top-0">
                                        <th style={{ width: '42px', minWidth: '42px' }} className="px-1 py-1.5 text-center border-r-2 border-white/20">
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 rounded-sm border-white/20 accent-[#001d35] cursor-pointer"
                                                checked={paginatedReturns.length > 0 && paginatedReturns.every(r => selectedRowIds.includes(r.id))}
                                                onChange={handleSelectAll}
                                                title="Tout cocher / Tout décocher"
                                            />
                                        </th>
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
                                    {paginatedReturns.map((r, rIdx) => {
                                        const isSelected = selectedRowIds.includes(r.id);
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
                                            <tr key={r.id} className={`transition-all border-b border-gray-200 select-none ${dimmed ? 'opacity-45' : ''} ${
                                                isSelected ? 'bg-blue-50' : rIdx % 2 === 0 ? 'bg-white hover:bg-blue-50/40' : 'bg-slate-50/70 hover:bg-blue-50/40'
                                            }`}>
                                                <td className="px-1 py-1.5 text-center w-10">
                                                    <input
                                                        type="checkbox"
                                                        className="w-4 h-4 rounded-sm border-gray-300 accent-[#001d35] cursor-pointer"
                                                        checked={isSelected}
                                                        onChange={() => handleSelectRow(r.id)}
                                                    />
                                                </td>
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
                        // ── Onglet Tous les Avoirs Actifs ──
                        filteredAllActiveCreditNotes.length === 0 ? (
                            <div className="p-8 min-h-[160px] flex flex-col items-center justify-center text-center text-gray-400">
                                <div className="flex items-center justify-center -space-x-2 mb-1.5 opacity-50">
                                    <Ticket className="w-8 h-8 text-gray-300" />
                                    <Ticket className="w-8 h-8 text-gray-300" />
                                </div>
                                <p className="text-xs font-semibold text-gray-600 uppercase">
                                    {period !== 'all' ? `Aucun avoir actif (${periodLabel})` : "Aucun avoir actif en ce moment"}
                                </p>
                                <p className="text-[11px] text-gray-400 mt-0.5 font-normal">
                                    {period !== 'all' ? "Sélectionnez « Tout » pour voir l'ensemble des avoirs disponibles, ou ajustez la période." : "Les bons d'avoir actifs et partiels apparaîtront ici, quelle que soit leur date d'émission."}
                                </p>
                            </div>
                        ) : (
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-[#001d35] text-white uppercase text-[10px] tracking-wider font-semibold divide-x divide-white/10 sticky top-0">
                                        <th style={{ width: '42px', minWidth: '42px' }} className="px-1 py-1.5 text-center border-r-2 border-white/20">
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 rounded-sm border-white/20 accent-[#001d35] cursor-pointer"
                                                checked={paginatedAllActiveCreditNotes.length > 0 && paginatedAllActiveCreditNotes.every(c => selectedRowIds.includes(c.id))}
                                                onChange={handleSelectAll}
                                                title="Tout cocher / Tout décocher"
                                            />
                                        </th>
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
                                    {paginatedAllActiveCreditNotes.map((c, cIdx) => {
                                        const isSelected = selectedRowIds.includes(c.id);
                                        const isExpired = new Date(c.expiresAt).getTime() < nowTimestamp;
                                        return (
                                            <tr key={c.id} className={`transition-colors border-b border-gray-200 select-none ${
                                                isSelected ? 'bg-blue-50' : cIdx % 2 === 0 ? 'bg-white hover:bg-emerald-50/40' : 'bg-slate-50/70 hover:bg-emerald-50/40'
                                            }`}>
                                                <td className="px-1 py-1.5 text-center w-10">
                                                    <input
                                                        type="checkbox"
                                                        className="w-4 h-4 rounded-sm border-gray-300 accent-[#001d35] cursor-pointer"
                                                        checked={isSelected}
                                                        onChange={() => handleSelectRow(c.id)}
                                                    />
                                                </td>
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
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenCashRefund(c)}
                                                            className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-0.5 rounded-[4px] text-[11px] font-semibold uppercase tracking-wider transition-all shadow-xs cursor-pointer active:scale-95"
                                                            title="Rembourser ce bon en espèces"
                                                        >
                                                            <Banknote className="w-3 h-3 text-emerald-200" />
                                                            <span>Rembourser Espèces</span>
                                                        </button>
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
                                                    </div>
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
                                <p className="text-xs font-semibold text-gray-600 uppercase">
                                    {period !== 'all' ? `Aucun bon d'avoir (${periodLabel})` : "Aucun bon d'avoir actif"}
                                </p>
                                <p className="text-[11px] text-gray-400 mt-0.5 font-normal">
                                    {period !== 'all' ? "Essayez de sélectionner « Tout l'historique » ou ajustez la période." : "Les avoirs émis lors des retours apparaîtront ici."}
                                </p>
                            </div>
                        ) : (
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-[#001d35] text-white uppercase text-[10px] tracking-wider font-semibold divide-x divide-white/10 sticky top-0">
                                        <th style={{ width: '42px', minWidth: '42px' }} className="px-1 py-1.5 text-center border-r-2 border-white/20">
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 rounded-sm border-white/20 accent-[#001d35] cursor-pointer"
                                                checked={paginatedCreditNotes.length > 0 && paginatedCreditNotes.every(c => selectedRowIds.includes(c.id))}
                                                onChange={handleSelectAll}
                                                title="Tout cocher / Tout décocher"
                                            />
                                        </th>
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
                                    {paginatedCreditNotes.map((c, cIdx) => {
                                        const isSelected = selectedRowIds.includes(c.id);
                                        const isExpired = new Date(c.expiresAt).getTime() < nowTimestamp;
                                        const isUsed = c.status === 'used' || c.remainingAmount <= 0;

                                        return (
                                            <tr key={c.id} className={`transition-colors border-b border-gray-200 select-none ${
                                                isSelected ? 'bg-blue-50' : cIdx % 2 === 0 ? 'bg-white hover:bg-blue-50/40' : 'bg-slate-50/70 hover:bg-blue-50/40'
                                            }`}>
                                                <td className="px-1 py-1.5 text-center w-10">
                                                    <input
                                                        type="checkbox"
                                                        className="w-4 h-4 rounded-sm border-gray-300 accent-[#001d35] cursor-pointer"
                                                        checked={isSelected}
                                                        onChange={() => handleSelectRow(c.id)}
                                                    />
                                                </td>
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
                                                        {c.remainingAmount > 0 && c.status !== 'cancelled' && !isExpired && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleOpenCashRefund(c)}
                                                                className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-0.5 rounded-[4px] text-[11px] font-semibold uppercase tracking-wider transition-all shadow-xs cursor-pointer active:scale-95"
                                                                title="Rembourser ce bon en espèces"
                                                            >
                                                                <Banknote className="w-3 h-3 text-emerald-200" />
                                                                <span>Rembourser Espèces</span>
                                                            </button>
                                                        )}
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

                {/* ── Barre de pagination (10 éléments par page par défaut) ── */}
                {activeDataList.length > 0 && (
                    <div className="bg-gray-50 px-3 py-2 border-t-2 border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs select-none">
                        <div className="flex items-center gap-2 text-gray-600">
                            <span>
                                Affichage de <strong className="text-[#001d35] font-semibold">{activeDataList.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}</strong> à <strong className="text-[#001d35] font-semibold">{Math.min(currentPage * itemsPerPage, activeDataList.length)}</strong> sur <strong className="text-[#001d35] font-semibold">{activeDataList.length}</strong> {activeTab === 'returns' ? 'retour(s)' : activeTab === 'all' ? 'opération(s)' : 'bon(s)'}
                            </span>
                            <span className="text-gray-300">|</span>
                            <div className="flex items-center gap-1.5">
                                <span className="text-[11px] text-gray-500 font-medium">Lignes :</span>
                                <select
                                    value={itemsPerPage}
                                    onChange={(e) => {
                                        setItemsPerPage(Number(e.target.value));
                                        setCurrentPage(1);
                                    }}
                                    className="px-2 py-0.5 text-xs font-semibold border border-gray-300 rounded-[4px] bg-white text-[#001d35] focus:outline-none focus:ring-1 focus:ring-[#001d35] cursor-pointer"
                                >
                                    <option value={10}>10</option>
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-2.5 py-1 rounded-[4px] border border-gray-300 bg-white hover:bg-gray-100 text-gray-700 font-semibold disabled:opacity-40 disabled:hover:bg-white cursor-pointer disabled:cursor-not-allowed flex items-center gap-1 transition-all active:scale-95"
                            >
                                <ChevronLeft className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Précédent</span>
                            </button>

                            <div className="flex items-center gap-1 px-1">
                                {Array.from({ length: totalPages }, (_, i) => i + 1)
                                    .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                                    .map((p, pIdx, arr) => {
                                        const prevP = arr[pIdx - 1];
                                        const showEllipsis = prevP && p - prevP > 1;
                                        return (
                                            <React.Fragment key={p}>
                                                {showEllipsis && <span className="px-1 text-gray-400 font-bold">...</span>}
                                                <button
                                                    type="button"
                                                    onClick={() => setCurrentPage(p)}
                                                    className={`w-7 h-7 text-xs font-bold rounded-[4px] transition-all cursor-pointer ${
                                                        currentPage === p
                                                            ? 'bg-[#001d35] text-white shadow-xs'
                                                            : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
                                                    }`}
                                                >
                                                    {p}
                                                </button>
                                            </React.Fragment>
                                        );
                                    })}
                            </div>

                            <button
                                type="button"
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="px-2.5 py-1 rounded-[4px] border border-gray-300 bg-white hover:bg-gray-100 text-gray-700 font-semibold disabled:opacity-40 disabled:hover:bg-white cursor-pointer disabled:cursor-not-allowed flex items-center gap-1 transition-all active:scale-95"
                            >
                                <span className="hidden sm:inline">Suivant</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── MODAL ASSISTANT NOUVEAU RETOUR CLIENT COMPACT ── */}
            {showNewReturnModal && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
                    <div className="bg-white w-full max-w-xl rounded-[4px] shadow-2xl border-2 border-[#001d35] overflow-hidden flex flex-col max-h-[88vh] animate-in zoom-in-95 duration-150">
                        {/* Modal Header */}
                        <div className="bg-[#001d35] text-white px-4 py-3 flex items-center justify-between border-b-2 border-[#f77500] shrink-0">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-blue-500/20 border border-blue-400 flex items-center justify-center shrink-0">
                                    <RotateCcw className="w-4 h-4 text-[#f77500]" />
                                </div>
                                <div>
                                    <h3 className="text-xs font-semibold uppercase tracking-wider text-white">
                                        Assistant Retour & Bon d'Avoir
                                    </h3>
                                    <p className="text-[10px] text-gray-300 font-normal">
                                        Étape {modalStep} sur 3 &bull; {
                                            modalStep === 1 ? "Identification Ticket ou Comptoir" :
                                            modalStep === 2 ? "Sélection & État des Marchandises" :
                                            "Règle Financière & Clôture"
                                        }
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowNewReturnModal(false)}
                                className="text-gray-300 hover:text-white p-1 rounded-[4px] transition-colors cursor-pointer"
                                title="Fermer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Stepper bar */}
                        <div className="grid grid-cols-3 border-b-2 border-gray-300 bg-gray-50 text-[10px] font-semibold uppercase tracking-wider text-center flex-shrink-0">
                            <div className={`py-2 border-r-2 border-gray-300 transition-colors ${modalStep === 1 ? 'bg-white text-[#001d35] border-b-2 border-[#f77500] font-bold' : modalStep > 1 ? 'text-emerald-700 bg-emerald-50/50' : 'text-gray-400'}`}>
                                1. Origine & Client
                            </div>
                            <div className={`py-2 border-r-2 border-gray-300 transition-colors ${modalStep === 2 ? 'bg-white text-[#001d35] border-b-2 border-[#f77500] font-bold' : modalStep > 2 ? 'text-emerald-700 bg-emerald-50/50' : 'text-gray-400'}`}>
                                2. Articles & Stock
                            </div>
                            <div className={`py-2 transition-colors ${modalStep === 3 ? 'bg-white text-[#001d35] border-b-2 border-[#f77500] font-bold' : 'text-gray-400'}`}>
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
                    onRefundCash={(note) => {
                        setViewingReturn(null);
                        setViewingCreditNote(null);
                        handleOpenCashRefund(note);
                    }}
                    onClose={() => {
                        setViewingReturn(null);
                        setViewingCreditNote(null);
                    }}
                />
            )}

            {/* ── MODAL FORMULAIRE DÉCAISSEMENT / REMBOURSEMENT D'AVOIR EN ESPÈCES ── */}
            {cashRefundTarget && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[110] p-4 animate-in fade-in duration-150">
                    <div className="bg-white rounded-[4px] shadow-2xl border-2 border-[#001d35] max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="bg-[#001d35] text-white px-4 py-3 flex items-center justify-between border-b-2 border-[#f77500] shrink-0">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center shrink-0">
                                    <Banknote className="w-4 h-4 text-[#f77500]" />
                                </div>
                                <div>
                                    <h3 className="text-xs font-semibold uppercase tracking-wider text-white flex items-center gap-1.5">
                                        <span>Remboursement d'Avoir en Espèces</span>
                                        <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] px-1.5 py-0.2 rounded font-semibold">
                                            Sortie Caisse
                                        </span>
                                    </h3>
                                    <p className="text-[10px] text-gray-300 font-normal">
                                        Bon N° <span className="font-semibold text-white">{cashRefundTarget.code}</span> &bull; {cashRefundTarget.type === 'change_reliquat' ? 'Reliquat Monnaie' : "Avoir sur Retour"}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => !cashRefundLoading && setCashRefundTarget(null)}
                                disabled={cashRefundLoading}
                                className="text-gray-300 hover:text-white p-1 rounded-[4px] transition-colors cursor-pointer"
                                title="Fermer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Corps Formulaire */}
                        <div className="p-4 space-y-3.5 overflow-y-auto flex-1 custom-scrollbar">
                            {/* Summary Card */}
                            <div className="bg-emerald-50/60 border border-emerald-200 rounded-[4px] p-3 flex justify-between items-center">
                                <div>
                                    <p className="text-[10px] uppercase font-semibold text-[#001d35] tracking-wider">Client Bénéficiaire</p>
                                    <p className="text-xs font-semibold text-[#001d35] mt-0.5">{cashRefundTarget.customerName || 'Client Comptoir'}</p>
                                    {cashRefundTarget.siteName && (
                                        <p className="text-[10px] text-gray-500 font-medium">Chantier : {cashRefundTarget.siteName}</p>
                                    )}
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] uppercase font-semibold text-emerald-800 tracking-wider">Solde Restant Disponible</p>
                                    <p className="text-base font-semibold text-emerald-700 mt-0.5">{formatPrice(cashRefundTarget.remainingAmount)}</p>
                                    <p className="text-[10px] text-gray-500 font-medium">Montant initial : {formatPrice(cashRefundTarget.initialAmount)}</p>
                                </div>
                            </div>

                            {/* Montant à décaisser */}
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="block text-[11px] font-semibold text-[#001d35] uppercase tracking-wider">
                                        Montant à Décaisser en Espèces <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="flex gap-1">
                                        <button
                                            type="button"
                                            onClick={() => setCashRefundAmount(cashRefundTarget.remainingAmount)}
                                            className="text-[10px] bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-[3px] border border-emerald-300 cursor-pointer uppercase tracking-wider"
                                        >
                                            100% ({formatPrice(cashRefundTarget.remainingAmount)})
                                        </button>
                                        {cashRefundTarget.remainingAmount > 100 && (
                                            <button
                                                type="button"
                                                onClick={() => setCashRefundAmount(Math.round(cashRefundTarget.remainingAmount / 2))}
                                                className="text-[10px] bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-2 py-0.5 rounded-[3px] border border-gray-300 cursor-pointer uppercase tracking-wider"
                                            >
                                                50%
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="1"
                                        max={cashRefundTarget.remainingAmount}
                                        value={cashRefundAmount}
                                        onChange={(e) => setCashRefundAmount(e.target.value)}
                                        className="w-full pl-3 pr-16 py-1.5 bg-white border border-gray-300 rounded-[4px] text-sm font-semibold text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#001d35]"
                                        placeholder="0"
                                    />
                                    <span className="absolute right-3 top-2 text-xs font-semibold text-gray-500">FCFA</span>
                                </div>
                                {parseFloat(cashRefundAmount) > 0 && (
                                    <div className="mt-1 flex justify-between text-[10px] text-gray-500 font-medium">
                                        <span>Nouveau solde restant après décaissement :</span>
                                        <span className="font-semibold text-[#001d35]">
                                            {formatPrice(Math.max(0, (cashRefundTarget.remainingAmount || 0) - (parseFloat(cashRefundAmount) || 0)))}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Bénéficiaire */}
                            <div>
                                <label className="block text-[11px] font-semibold text-[#001d35] uppercase tracking-wider mb-1">
                                    Nom de la Personne Réceptionnant les Espèces <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={cashRefundRecipient}
                                    onChange={(e) => setCashRefundRecipient(e.target.value)}
                                    className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-[4px] text-xs font-normal text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#001d35]"
                                    placeholder="Ex: M. Koffi / Porteur du bon"
                                    required
                                />
                            </div>

                            {/* Motif */}
                            <div>
                                <label className="block text-[11px] font-semibold text-[#001d35] uppercase tracking-wider mb-1">
                                    Motif / Justification du Décaissement
                                </label>
                                <input
                                    type="text"
                                    value={cashRefundMotif}
                                    onChange={(e) => setCashRefundMotif(e.target.value)}
                                    className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-[4px] text-xs font-normal text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#001d35]"
                                    placeholder="Ex: Demande expresse du client, remboursement reliquat"
                                />
                            </div>

                            {/* Alerte Audit Caisse */}
                            <div className="bg-amber-50 border border-amber-300 rounded-[3px] p-2.5 flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
                                <div className="text-[10px] text-amber-900 leading-tight font-normal">
                                    <strong className="font-semibold">Impact Caisse & Anti-Coulage :</strong> Cette opération crée automatiquement une <strong className="font-semibold">sortie de caisse de {formatPrice(parseFloat(cashRefundAmount) || 0)}</strong> dans le journal des dépenses de la session active. Le solde du bon d'avoir sera immédiatement débité.
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-3 bg-gray-50 border-t-2 border-gray-300 flex justify-end items-center gap-2 shrink-0">
                            <button
                                type="button"
                                onClick={() => setCashRefundTarget(null)}
                                disabled={cashRefundLoading}
                                className="px-3.5 py-1.5 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 rounded-[4px] transition-colors cursor-pointer"
                            >
                                Annuler
                            </button>

                            <button
                                type="button"
                                onClick={handleConfirmCashRefund}
                                disabled={cashRefundLoading || !parseFloat(cashRefundAmount) || parseFloat(cashRefundAmount) <= 0}
                                className={`px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-white rounded-[4px] shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95 ${
                                    cashRefundLoading || !parseFloat(cashRefundAmount) || parseFloat(cashRefundAmount) <= 0
                                        ? 'bg-gray-400 cursor-not-allowed opacity-70'
                                        : 'bg-[#001d35] hover:bg-[#00284a]'
                                }`}
                            >
                                {cashRefundLoading ? (
                                    <>
                                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        <span>Décaissement en cours...</span>
                                    </>
                                ) : (
                                    <>
                                        <Banknote className="w-3.5 h-3.5 text-[#f77500]" />
                                        <span>Valider le Décaissement ({formatPrice(parseFloat(cashRefundAmount) || 0)})</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── MODAL REÇU DÉCHARGE REMBOURSEMENT ESPÈCES (80mm & A4) ── */}
            {printedCashRefund && (
                <CashRefundReceipt
                    refundData={printedCashRefund}
                    onClose={() => setPrintedCashRefund(null)}
                />
            )}
        </div>
    );
};

export default Returns;
