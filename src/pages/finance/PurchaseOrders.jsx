import React, { useState, useEffect, useMemo, useRef } from 'react';
import { usePurchase } from '../../context/PurchaseContext';
import { useSettings } from '../../context/SettingsContext';
import {
    Package, Plus, Search, X, Printer, Eye, Trash2, CheckCircle2,
    Clock, Truck, XCircle, ChevronDown, Filter, Calendar,
    Building2, ArrowDownToLine, PackageCheck, AlertCircle,
    FileText, Edit3, RotateCcw, ClipboardList, Layers, Store as StoreIcon
} from 'lucide-react';
import { formatPrice, formatRowPrice } from '../../utils/currency';
import T from '../../utils/toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import ReplenishmentOrderDetailModal from '../../components/ReplenishmentOrderDetailModal';

// ─── Status config ──────────────────────────────────────────────────────────
const STATUS_CONFIG = {
    'Draft':     { label: 'Brouillon',        color: 'bg-gray-100 text-gray-600 border-gray-200',     dot: 'bg-gray-400' },
    'Ordered':   { label: 'Commandé',          color: 'bg-blue-50 text-blue-700 border-blue-200',      dot: 'bg-blue-500' },
    'Partial':   { label: 'Partiellement reçu', color: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
    'Completed': { label: 'Reçu complet',      color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
};

// ─── Format date helper ──────────────────────────────────────────────────────
const formatDateHelper = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
        return format(new Date(dateStr), 'dd/MM/yyyy', { locale: fr });
    } catch {
        return dateStr;
    }
};

// ─── Print PDF helper ────────────────────────────────────────────────────────
const printPurchaseOrder = (order, company) => {
    const win = window.open('', '_blank', 'width=900,height=700');
    const itemsHtml = order.items.map((item, i) => `
        <tr style="background:${i % 2 === 0 ? '#f9fafb' : '#fff'};">
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${item.name}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${item.quantityOrdered}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${item.quantityReceived || 0}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatRowPrice(item.purchasePrice)} F CFA</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">${formatRowPrice((item.purchasePrice || 0) * item.quantityOrdered)} F CFA</td>
        </tr>
    `).join('');

    const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG['Ordered'];
    win.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/>
    <title>BC ${order.orderNumber}</title>
    <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:'Segoe UI',Arial,sans-serif; color:#1f2937; background:#fff; padding:40px; font-size:13px; }
        .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:32px; padding-bottom:24px; border-bottom:3px solid #001d35; }
        .company-name { font-size:22px; font-weight:800; color:#001d35; }
        .company-info { color:#6b7280; font-size:12px; line-height:1.6; margin-top:4px; }
        .bc-meta { text-align:right; }
        .bc-num { font-size:24px; font-weight:900; color:#001d35; letter-spacing:1px; }
        table { width:100%; border-collapse:collapse; margin-top:8px; }
        thead tr { background:#001d35; color:#fff; }
        thead th { padding:10px 12px; text-align:left; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; }
        thead th:nth-child(2), thead th:nth-child(3) { text-align:center; }
        thead th:nth-child(4), thead th:nth-child(5) { text-align:right; }
        .total-final { text-align:right; font-size:16px; font-weight:800; color:#001d35; margin-top:16px; padding-top:12px; border-top:2px solid #001d35; }
        .footer { margin-top:40px; padding-top:16px; border-top:1px solid #e5e7eb; font-size:11px; color:#9ca3af; text-align:center; }
        @media print { body { padding:20px; } }
    </style></head><body>
    <div class="header">
        <div>
            <div class="company-name">${company.name || 'Mon Entreprise'}</div>
            <div class="company-info">
                ${company.address ? company.address + '<br/>' : ''}
                ${company.phone ? 'Tél : ' + company.phone + '<br/>' : ''}
                ${company.nif ? 'NIF : ' + company.nif : ''}
            </div>
        </div>
        <div class="bc-meta">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#9ca3af;letter-spacing:1px;margin-bottom:4px;">Bon de Commande</div>
            <div class="bc-num">${order.orderNumber}</div>
            <div style="color:#6b7280;font-size:12px;margin-top:6px;">Date : ${format(new Date(order.date), 'dd MMMM yyyy', { locale: fr })}</div>
            <div style="color:#6b7280;font-size:12px;">Statut : ${cfg.label}</div>
        </div>
    </div>

    <div style="margin-bottom:24px;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;margin-bottom:8px;">Fournisseur</div>
        <div style="background:#f9fafb;border:1px solid #e5e7eb;padding:12px 16px;border-radius:4px;">
            <div style="font-size:15px;font-weight:700;color:#001d35;">${order.supplier || '—'}</div>
        </div>
    </div>

    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;margin-bottom:8px;">Articles commandés</div>
    <table>
        <thead><tr>
            <th>Désignation</th>
            <th style="text-align:center;">Qté commandée</th>
            <th style="text-align:center;">Qté reçue</th>
            <th style="text-align:right;">P.U. Achat</th>
            <th style="text-align:right;">Total</th>
        </tr></thead>
        <tbody>${itemsHtml}</tbody>
    </table>

    <div class="total-final">
        Total : <span style="color:#f77500;">${formatRowPrice(order.totalAmount)} F CFA</span>
    </div>

    <div class="footer">Document généré par ${company.name || 'Mon Entreprise'} — ${format(new Date(), 'dd/MM/yyyy', { locale: fr })}</div>
    </body></html>`);
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); }, 400);
};

// ─── Main PurchaseOrders Page ────────────────────────────────────────────────
const PurchaseOrders = () => {
    const { orders, deleteOrder, forceCompleteOrder, suppliers, replenishmentQueue, generateOrdersFromQueue } = usePurchase();
    const { company } = useSettings();

    // ── Loader de page initial ──
    const [isLoading, setIsLoading] = useState(true);

    // ── Loader sur les filtres (1.5 seconde) ──
    const [filterLoading, setFilterLoading] = useState(false);
    const filterTimerRef = useRef(null);

    const handleFilterChange = (setterOrFn, value) => {
        setFilterLoading(true);
        if (typeof setterOrFn === 'function' && value === undefined) {
            setterOrFn();
        } else if (typeof setterOrFn === 'function') {
            setterOrFn(value);
        }
        if (filterTimerRef.current) clearTimeout(filterTimerRef.current);
        filterTimerRef.current = setTimeout(() => {
            setFilterLoading(false);
        }, 1500); // 1,5 seconde
    };

    // ── Filtres d'état ──
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState('all'); // 'all' | 'ordered' | 'partial' | 'completed'
    const [operationFilter, setOperationFilter] = useState('none');
    const [supplierFilter, setSupplierFilter] = useState('all');
    const [selectedKpi, setSelectedKpi] = useState(null); // 'all' | 'pending' | 'completed' | 'queue' | null

    // ── Filtre de période temporelle ──
    const [period, setPeriod] = useState('today'); // 'today' par défaut (Aujourd'hui)
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');

    const [selectedOrder, setSelectedOrder] = useState(null);

    useEffect(() => {
        const t = setTimeout(() => setIsLoading(false), 1500);
        return () => {
            clearTimeout(t);
            if (filterTimerRef.current) clearTimeout(filterTimerRef.current);
        };
    }, []);

    // ── Helper de vérification de période ──
    const isWithinPeriod = (dateStr, periodKey, startCustom, endCustom) => {
        if (!dateStr) return false;
        if (periodKey === 'all') return true;

        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return true;
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

    // ── Libellé de la période sélectionnée ──
    const periodLabel = useMemo(() => {
        switch (period) {
            case 'today': return "Aujourd'hui";
            case '7days': return "7 derniers jours";
            case 'month': return "Ce mois";
            case 'custom':
                if (customStartDate && customEndDate) return `Du ${formatDateHelper(customStartDate)} au ${formatDateHelper(customEndDate)}`;
                if (customStartDate) return `À partir du ${formatDateHelper(customStartDate)}`;
                if (customEndDate) return `Jusqu'au ${formatDateHelper(customEndDate)}`;
                return "Personnalisée";
            case 'all':
            default:
                return "Historique complet";
        }
    }, [period, customStartDate, customEndDate]);

    // ── Liste unique des fournisseurs ──
    const uniqueSuppliers = useMemo(() => {
        const list = new Set();
        orders.forEach(o => {
            if (o.supplier && o.supplier.trim()) list.add(o.supplier.trim());
        });
        return Array.from(list).sort((a, b) => a.localeCompare(b));
    }, [orders]);

    // ── Commandes dans la période (pour KPI & compteurs) ──
    const ordersInPeriod = useMemo(() => {
        return orders.filter(o => isWithinPeriod(o.date, period, customStartDate, customEndDate));
    }, [orders, period, customStartDate, customEndDate]);

    // ── Métriques KPI globales ──
    const metrics = useMemo(() => {
        const totalOrders = ordersInPeriod.length;
        const pendingOrders = ordersInPeriod.filter(o => o.status === 'Ordered');
        const partialOrders = ordersInPeriod.filter(o => o.status === 'Partial');
        const completedOrders = ordersInPeriod.filter(o => o.status === 'Completed');

        const pendingCount = pendingOrders.length + partialOrders.length;
        const pendingValue = [...pendingOrders, ...partialOrders].reduce((sum, o) => sum + (o.totalAmount || 0), 0);
        const completedValue = completedOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
        const totalValue = ordersInPeriod.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

        return {
            totalOrders,
            pendingCount,
            partialCount: partialOrders.length,
            completedCount: completedOrders.length,
            pendingValue,
            completedValue,
            totalValue,
            queueCount: replenishmentQueue.length
        };
    }, [ordersInPeriod, replenishmentQueue]);

    // ── Clic interactif sur KPI Card ──
    const handleKpiClick = (kpiKey) => {
        handleFilterChange(() => {
            if (selectedKpi === kpiKey) {
                setSelectedKpi(null);
            } else {
                setSelectedKpi(kpiKey);
                if (kpiKey === 'all') {
                    setActiveTab('all');
                } else if (kpiKey === 'pending') {
                    setActiveTab('ordered');
                } else if (kpiKey === 'completed') {
                    setActiveTab('completed');
                }
            }
        });
    };

    // ── Commandes filtrées affichées ──
    const filteredOrders = useMemo(() => {
        return orders.filter(o => {
            // Filtre par onglet principal
            if (activeTab === 'ordered' && o.status !== 'Ordered' && o.status !== 'Partial') return false;
            if (activeTab === 'partial' && o.status !== 'Partial') return false;
            if (activeTab === 'completed' && o.status !== 'Completed') return false;

            // Filtre KPI interactif
            if (selectedKpi === 'all') {
                // Montre tout
            } else if (selectedKpi === 'pending' && o.status !== 'Ordered' && o.status !== 'Partial') {
                return false;
            } else if (selectedKpi === 'completed' && o.status !== 'Completed') {
                return false;
            }

            // Filtre opération dédié
            if (operationFilter !== 'none' && operationFilter !== 'all') {
                if (operationFilter === 'ordered' && o.status !== 'Ordered') return false;
                if (operationFilter === 'partial' && o.status !== 'Partial') return false;
                if (operationFilter === 'completed' && o.status !== 'Completed') return false;
                if (operationFilter === 'high_value' && (o.totalAmount || 0) < 1000000) return false;
                if (operationFilter === 'has_reliquat') {
                    const hasRemaining = (o.items || []).some(i => (i.quantityReceived || 0) < (i.quantityOrdered || 0));
                    if (!hasRemaining) return false;
                }
            }

            // Filtre fournisseur
            if (supplierFilter !== 'all' && (o.supplier || '').trim().toLowerCase() !== supplierFilter.trim().toLowerCase()) {
                return false;
            }

            // Filtre par période temporelle
            if (!isWithinPeriod(o.date, period, customStartDate, customEndDate)) return false;

            // Recherche textuelle
            if (search.trim()) {
                const q = search.toLowerCase();
                const matchNum = (o.orderNumber || '').toLowerCase().includes(q);
                const matchSupp = (o.supplier || '').toLowerCase().includes(q);
                const matchItems = (o.items || []).some(item => (item.name || '').toLowerCase().includes(q));
                if (!matchNum && !matchSupp && !matchItems) return false;
            }

            return true;
        });
    }, [orders, activeTab, selectedKpi, operationFilter, supplierFilter, period, customStartDate, customEndDate, search]);

    const handleGenerateFromQueue = () => {
        if (replenishmentQueue.length === 0) {
            T.warning('La file de réapprovisionnement est vide.');
            return;
        }
        const created = generateOrdersFromQueue();
        T.success(`${created.length} bon(s) de commande généré(s) depuis la file de réapprovisionnement !`);
    };

    if (isLoading) {
        return (
            <div className="min-h-[calc(100vh-140px)] flex items-center justify-center w-full animate-in fade-in duration-150">
                <div className="flex items-center justify-center bg-white p-8 rounded-sm shadow-xl border-2 border-gray-200">
                    <div className="relative h-12 w-12">
                        <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-t-transparent border-[#001d35]" />
                        <div className="absolute inset-1.5 animate-spin-reverse rounded-full border-2 border-b-transparent border-[#f77500] opacity-80" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* ── HEADER PRINCIPAL DE LA PAGE ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 sm:p-4 rounded-[4px] border-2 border-gray-300 shadow-sm print:hidden">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-[4px] bg-[#001d35] flex items-center justify-center text-white shadow-sm shrink-0">
                        <Package className="w-5 h-5 text-[#f77500]" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-base sm:text-lg font-bold text-[#001d35] tracking-tight uppercase">
                                Bons de Commande Fournisseurs & Approvisionnements
                            </h1>
                            <span className="hidden sm:inline-flex px-2 py-0.5 text-[10px] font-bold uppercase rounded-[3px] bg-blue-100 text-blue-900 border border-blue-200">
                                ERP Pro
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 font-medium">
                            Suivi des commandes d'achat, réceptions partielles et réapprovisionnements
                        </p>
                    </div>
                </div>

                {replenishmentQueue.length > 0 && (
                    <button
                        onClick={handleGenerateFromQueue}
                        className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold uppercase tracking-wider rounded-[4px] bg-[#f77500] hover:bg-[#e06900] text-white transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
                    >
                        <ArrowDownToLine className="w-3.5 h-3.5" />
                        <span>Générer depuis la File ({replenishmentQueue.length})</span>
                    </button>
                )}
            </div>

            {/* ── 4 STATCARDS KPI INTERACTIFS AVEC PÉRIODE APPRÊTÉE (STYLE CLIENTS & RETOURS) ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 print:hidden">
                {/* 1. Total Commandes */}
                <div
                    role="button"
                    tabIndex={0}
                    onClick={() => handleKpiClick('all')}
                    title="Cliquer pour afficher toutes les commandes de la période"
                    className={`p-3 rounded-sm border-2 shadow-xs relative group transition-all overflow-hidden flex flex-col justify-center min-h-[120px] cursor-pointer select-none ${
                        selectedKpi === 'all'
                            ? 'bg-blue-50/50 border-[#001d35] ring-2 ring-[#001d35]/30 shadow-md scale-[1.01]'
                            : 'bg-white border-gray-300 hover:border-[#001d35] hover:shadow-md hover:scale-[1.005]'
                    }`}
                >
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
                                    <div className="flex items-center justify-between gap-1 mb-0.5">
                                        <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-[#001d35]">Total Commandes</p>
                                        {selectedKpi === 'all' ? (
                                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-[3px] bg-[#001d35] text-white uppercase tracking-wider shadow-2xs animate-in fade-in">
                                                ✓ Filtré
                                            </span>
                                        ) : (
                                            <span className="text-[9px] font-bold px-1 py-0.2 rounded-[2px] text-gray-400 bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-wider">
                                                Filtrer ↵
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-baseline gap-2 mt-1.5 font-semibold flex-wrap" style={{ color: '#001d35' }}>
                                        <h3 className="text-xl sm:text-2xl font-semibold">
                                            {metrics.totalOrders} commande(s)
                                        </h3>
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-[3px] bg-blue-50 text-blue-800 border border-blue-200 uppercase tracking-wider">
                                            {periodLabel}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1.5 font-medium">
                                        Volume engagé : {formatPrice(metrics.totalValue)} ({periodLabel})
                                    </p>
                                </div>
                            </div>
                            <img
                                src="/icons8/fluency_240_tags.png"
                                alt=""
                                className="absolute bottom-2 right-2 w-16 h-16 opacity-25 group-hover:opacity-40 group-hover:scale-105 transition-all pointer-events-none"
                            />
                        </>
                    )}
                </div>

                {/* 2. En Cours d'Acheminement */}
                <div
                    role="button"
                    tabIndex={0}
                    onClick={() => handleKpiClick('pending')}
                    title="Cliquer pour afficher les commandes en cours d'expédition ou partiellement reçues"
                    className={`p-3 rounded-sm border-2 shadow-xs relative group transition-all overflow-hidden flex flex-col justify-center min-h-[120px] cursor-pointer select-none ${
                        selectedKpi === 'pending'
                            ? 'bg-amber-50/50 border-[#f77500] ring-2 ring-[#f77500]/30 shadow-md scale-[1.01]'
                            : 'bg-white border-gray-300 hover:border-[#f77500] hover:shadow-md hover:scale-[1.005]'
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
                                        <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-amber-800">En Cours / Livraison</p>
                                        {selectedKpi === 'pending' ? (
                                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-[3px] bg-[#f77500] text-white uppercase tracking-wider shadow-2xs animate-in fade-in">
                                                ✓ Filtré
                                            </span>
                                        ) : (
                                            <span className="text-[9px] font-bold px-1 py-0.2 rounded-[2px] text-gray-400 bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-wider">
                                                Filtrer ↵
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-baseline gap-2 mt-1.5 font-semibold flex-wrap" style={{ color: '#b45309' }}>
                                        <h3 className="text-xl sm:text-2xl font-semibold">
                                            {metrics.pendingCount} en attente
                                        </h3>
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-[3px] bg-amber-50 text-amber-800 border border-amber-200 uppercase tracking-wider">
                                            {periodLabel}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1.5 font-medium">
                                        Valeur en transit : {formatPrice(metrics.pendingValue)} ({periodLabel})
                                    </p>
                                </div>
                            </div>
                            <img
                                src="/icons8/fluency_240_shopping-cart.png"
                                alt=""
                                className="absolute bottom-2 right-2 w-16 h-16 opacity-25 group-hover:opacity-40 group-hover:scale-105 transition-all pointer-events-none"
                            />
                        </>
                    )}
                </div>

                {/* 3. Réceptionnées Complètes */}
                <div
                    role="button"
                    tabIndex={0}
                    onClick={() => handleKpiClick('completed')}
                    title="Cliquer pour afficher les commandes intégralement reçues"
                    className={`p-3 rounded-sm border-2 shadow-xs relative group transition-all overflow-hidden flex flex-col justify-center min-h-[120px] cursor-pointer select-none ${
                        selectedKpi === 'completed'
                            ? 'bg-emerald-50/50 border-emerald-600 ring-2 ring-emerald-500/30 shadow-md scale-[1.01]'
                            : 'bg-white border-gray-300 hover:border-emerald-500 hover:shadow-md hover:scale-[1.005]'
                    }`}
                >
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
                                    <div className="flex items-center justify-between gap-1 mb-0.5">
                                        <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-emerald-700">Réceptionnées Complètes</p>
                                        {selectedKpi === 'completed' ? (
                                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-[3px] bg-emerald-600 text-white uppercase tracking-wider shadow-2xs animate-in fade-in">
                                                ✓ Filtré
                                            </span>
                                        ) : (
                                            <span className="text-[9px] font-bold px-1 py-0.2 rounded-[2px] text-gray-400 bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-wider">
                                                Filtrer ↵
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-baseline gap-2 mt-1.5 font-semibold flex-wrap" style={{ color: '#059669' }}>
                                        <h3 className="text-xl sm:text-2xl font-semibold text-emerald-600">
                                            {metrics.completedCount} commande(s)
                                        </h3>
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-[3px] bg-emerald-50 text-emerald-800 border border-emerald-200 uppercase tracking-wider">
                                            {periodLabel}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1.5 font-medium">
                                        Marchandises intégrées en stock ({periodLabel})
                                    </p>
                                </div>
                            </div>
                            <img
                                src="/icons8/fluency_240_banknotes.png"
                                alt=""
                                className="absolute bottom-2 right-2 w-16 h-16 opacity-30 group-hover:opacity-50 group-hover:scale-105 transition-all duration-500 pointer-events-none"
                            />
                        </>
                    )}
                </div>

                {/* 4. File de Réapprovisionnement */}
                <div
                    role="button"
                    tabIndex={0}
                    onClick={() => handleKpiClick('queue')}
                    title="Articles en attente dans la file de réapprovisionnement"
                    className={`p-3 rounded-sm border-2 shadow-xs relative group transition-all overflow-hidden flex flex-col justify-center min-h-[120px] cursor-pointer select-none ${
                        selectedKpi === 'queue'
                            ? 'bg-orange-50/50 border-[#f77500] ring-2 ring-[#f77500]/30 shadow-md scale-[1.01]'
                            : 'bg-white border-gray-300 hover:border-[#f77500] hover:shadow-md hover:scale-[1.005]'
                    }`}
                >
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
                                    <div className="flex items-center justify-between gap-1 mb-0.5">
                                        <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-[#f77500]">File Réapprovisionnement</p>
                                        {selectedKpi === 'queue' ? (
                                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-[3px] bg-[#f77500] text-white uppercase tracking-wider shadow-2xs animate-in fade-in">
                                                ✓ Actif
                                            </span>
                                        ) : (
                                            <span className="text-[9px] font-bold px-1 py-0.2 rounded-[2px] text-gray-400 bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-wider">
                                                Consulter ↵
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-baseline gap-2 mt-1.5 font-semibold flex-wrap" style={{ color: '#c2410c' }}>
                                        <h3 className="text-xl sm:text-2xl font-semibold text-[#f77500]">
                                            {replenishmentQueue.length} article(s)
                                        </h3>
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-[3px] bg-orange-50 text-[#f77500] border border-orange-200 uppercase tracking-wider">
                                            À commander
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1.5 font-medium">
                                        {replenishmentQueue.length > 0 ? "Prêts pour génération groupée" : "Aucun article en attente"}
                                    </p>
                                </div>
                            </div>
                            <img
                                src="/icons8/fluency_240_high-priority.png"
                                alt=""
                                className="absolute bottom-2 right-2 w-16 h-16 opacity-30 group-hover:opacity-50 group-hover:scale-105 transition-all duration-500 pointer-events-none"
                            />
                        </>
                    )}
                </div>
            </div>

            {/* ── BARRE D'ONGLETS PRINCIPAUX & RECHERCHE (STYLE OFFICIEL KABLLIX ERP — IDENTIQUE À CLIENTS & RETOURS) ── */}
            <div className="bg-white p-2 sm:p-2.5 rounded-[4px] border-2 border-gray-300 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 print:hidden">
                {/* Onglets de statut */}
                <div className="flex items-center gap-1 bg-gray-100/80 p-1 rounded-[4px] border-2 border-gray-300 flex-wrap" aria-label="Onglets de commandes">
                    {/* Onglet 1 : Toutes les Commandes */}
                    <button
                        type="button"
                        onClick={() => handleFilterChange(() => {
                            setActiveTab('all');
                            setSelectedKpi(null);
                            setOperationFilter('none');
                        })}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-[4px] transition-all cursor-pointer flex items-center gap-2 ${
                            activeTab === 'all'
                                ? 'bg-[#001d35] text-white shadow-xs'
                                : 'text-gray-700 hover:text-[#001d35] hover:bg-gray-200/60'
                        }`}
                    >
                        <Package className={`w-3.5 h-3.5 ${
                            activeTab === 'all' ? 'text-[#f77500]' : 'text-gray-500'
                        }`} />
                        <span>Toutes les Commandes</span>

                        {ordersInPeriod.length > 0 && (
                            <span className="min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold bg-[#001d35] text-white border border-white/30 flex items-center justify-center flex-shrink-0 shadow-xs">
                                {ordersInPeriod.length}
                            </span>
                        )}
                    </button>

                    {/* Barre verticale de séparation */}
                    <div className="h-5 w-px bg-gray-300 mx-1 shrink-0" aria-hidden="true"></div>

                    {/* Onglet 2 : En Cours (Commandé) */}
                    <button
                        type="button"
                        onClick={() => handleFilterChange(() => {
                            setActiveTab('ordered');
                            setSelectedKpi(null);
                            setOperationFilter('none');
                        })}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-[4px] transition-all cursor-pointer flex items-center gap-2 ${
                            activeTab === 'ordered'
                                ? 'bg-[#001d35] text-white shadow-xs'
                                : 'text-gray-700 hover:text-[#001d35] hover:bg-gray-200/60'
                        }`}
                    >
                        <Truck className={`w-3.5 h-3.5 ${
                            activeTab === 'ordered' ? 'text-[#f77500]' : 'text-gray-500'
                        }`} />
                        <span>En Cours / Livraison</span>

                        {metrics.pendingCount > 0 && (
                            <span className="min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold bg-blue-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                                {metrics.pendingCount}
                            </span>
                        )}
                    </button>

                    {/* Barre verticale de séparation */}
                    <div className="h-5 w-px bg-gray-300 mx-1 shrink-0" aria-hidden="true"></div>

                    {/* Onglet 3 : Partiellement Reçues */}
                    <button
                        type="button"
                        onClick={() => handleFilterChange(() => {
                            setActiveTab('partial');
                            setSelectedKpi(null);
                            setOperationFilter('none');
                        })}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-[4px] transition-all cursor-pointer flex items-center gap-2 ${
                            activeTab === 'partial'
                                ? 'bg-[#001d35] text-white shadow-xs'
                                : 'text-gray-700 hover:text-[#001d35] hover:bg-gray-200/60'
                        }`}
                    >
                        <Clock className={`w-3.5 h-3.5 ${
                            activeTab === 'partial' ? 'text-[#f77500]' : 'text-gray-500'
                        }`} />
                        <span>Partiellement Reçues</span>

                        {metrics.partialCount > 0 && (
                            <span className="min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold bg-amber-500 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                                {metrics.partialCount}
                            </span>
                        )}
                    </button>

                    {/* Barre verticale de séparation */}
                    <div className="h-5 w-px bg-gray-300 mx-1 shrink-0" aria-hidden="true"></div>

                    {/* Onglet 4 : Réceptionnées Complètes */}
                    <button
                        type="button"
                        onClick={() => handleFilterChange(() => {
                            setActiveTab('completed');
                            setSelectedKpi(null);
                            setOperationFilter('none');
                        })}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-[4px] transition-all cursor-pointer flex items-center gap-2 ${
                            activeTab === 'completed'
                                ? 'bg-[#001d35] text-white shadow-xs'
                                : 'text-gray-700 hover:text-[#001d35] hover:bg-gray-200/60'
                        }`}
                    >
                        <CheckCircle2 className={`w-3.5 h-3.5 ${
                            activeTab === 'completed' ? 'text-[#f77500]' : 'text-gray-500'
                        }`} />
                        <span>Réceptionnées Complètes</span>

                        {metrics.completedCount > 0 && (
                            <span className="min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                                {metrics.completedCount}
                            </span>
                        )}
                    </button>
                </div>

                {/* Recherche compacte à droite */}
                <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Rechercher N° BC, fournisseur..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-8 pr-7 py-1.5 text-xs bg-gray-50 border-2 border-gray-300 focus:border-[#001d35] rounded-[4px] font-medium text-gray-800 focus:outline-none"
                    />
                    {search && (
                        <button
                            type="button"
                            onClick={() => handleFilterChange(setSearch, '')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                            title="Effacer la recherche"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* ── BARRE D'OUTILS EN BAS DÉDIÉE (SÉLECTEUR COMPACT + FOURNISSEUR + PÉRIODE — IDENTIQUE À HISTORIQUE DES OPÉRATIONS) ── */}
            <div className="bg-white p-2.5 rounded-[4px] border-2 border-gray-300 shadow-sm flex flex-col gap-2.5 animate-in fade-in duration-150 print:hidden">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    {/* Sélecteur de type d'opération */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <label htmlFor="po-operation-type-select" className="text-xs font-semibold text-[#001d35] uppercase tracking-wider flex items-center gap-1.5 shrink-0">
                            <Filter className="w-3.5 h-3.5 text-[#f77500]" />
                            <span>Opération :</span>
                        </label>
                        <select
                            id="po-operation-type-select"
                            value={operationFilter}
                            onChange={(e) => {
                                const val = e.target.value;
                                handleFilterChange(() => {
                                    setOperationFilter(val);
                                    if (val === 'all') {
                                        setActiveTab('all');
                                        setPeriod('all');
                                        setCustomStartDate('');
                                        setCustomEndDate('');
                                    } else if (val === 'ordered') {
                                        setActiveTab('ordered');
                                    } else if (val === 'partial') {
                                        setActiveTab('partial');
                                    } else if (val === 'completed') {
                                        setActiveTab('completed');
                                    }
                                });
                            }}
                            className="px-3 py-1.5 text-xs font-semibold border-2 border-gray-300 rounded-[4px] focus:outline-none focus:ring-1 focus:ring-[#001d35] bg-white text-[#001d35] cursor-pointer shadow-2xs"
                        >
                            <option value="none">Aucun (Par défaut)</option>
                            <option value="all">📋 Tous les bons de commande</option>
                            <optgroup label="Statut d'Acheminement">
                                <option value="ordered">🚚 Commandé (En attente d'expédition)</option>
                                <option value="partial">⏳ Partiellement Réceptionné (Reste à livrer)</option>
                                <option value="completed">✅ Réceptionné Complet (Clôturé)</option>
                            </optgroup>
                            <optgroup label="Montant & Reliquats">
                                <option value="high_value">💎 Commandes Prioritaires (&gt; 1 000 000 F CFA)</option>
                                <option value="has_reliquat">📦 Commandes avec reliquat d'articles non reçus</option>
                            </optgroup>
                        </select>
                    </div>

                    {/* Sélecteur de Fournisseur */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <label htmlFor="po-supplier-select" className="text-xs font-semibold text-[#001d35] uppercase tracking-wider flex items-center gap-1.5 shrink-0">
                            <Building2 className="w-3.5 h-3.5 text-[#f77500]" />
                            <span>Fournisseur :</span>
                        </label>
                        <select
                            id="po-supplier-select"
                            value={supplierFilter}
                            onChange={(e) => handleFilterChange(setSupplierFilter, e.target.value)}
                            className="px-3 py-1.5 text-xs font-semibold border-2 border-gray-300 rounded-[4px] focus:outline-none focus:ring-1 focus:ring-[#001d35] bg-white text-[#001d35] cursor-pointer shadow-2xs max-w-[210px]"
                        >
                            <option value="all">Tous les fournisseurs</option>
                            {uniqueSuppliers.map(s => (
                                <option key={s} value={s}>{s}</option>
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
                                    onClick={() => handleFilterChange(setPeriod, opt.key)}
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
                                    onChange={e => handleFilterChange(setCustomStartDate, e.target.value)}
                                    className="px-2 py-1 text-xs border border-gray-300 rounded-[4px] font-medium text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-[#001d35]"
                                />
                                <span className="text-gray-400 text-xs font-medium">à</span>
                                <input
                                    type="date"
                                    value={customEndDate}
                                    onChange={e => handleFilterChange(setCustomEndDate, e.target.value)}
                                    className="px-2 py-1 text-xs border border-gray-300 rounded-[4px] font-medium text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-[#001d35]"
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Ligne informative : Filtre actif(s) pour Bons de Commande */}
                {(operationFilter !== 'none' || supplierFilter !== 'all' || period !== 'all' || search || selectedKpi) && (
                    <div className="pt-2 border-t border-gray-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-[1px] bg-[#f77500] animate-pulse"></span>
                                <span>Filtre actif(s) :</span>
                            </span>

                            {selectedKpi && (
                                <span className="inline-flex items-center gap-1 bg-[#001d35] text-white border border-[#001d35] px-2 py-0.5 rounded-[4px] text-[10px] font-semibold uppercase tracking-wider shadow-2xs">
                                    <span>
                                        {selectedKpi === 'all' && '📊 KPI : Toutes les Commandes'}
                                        {selectedKpi === 'pending' && '📊 KPI : Commandes en Cours / Livraison'}
                                        {selectedKpi === 'completed' && '📊 KPI : Commandes Réceptionnées Complètes'}
                                        {selectedKpi === 'queue' && '📊 KPI : File de Réapprovisionnement'}
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
                                        {operationFilter === 'ordered' && '🚚 Commandé'}
                                        {operationFilter === 'partial' && '⏳ Partiellement reçu'}
                                        {operationFilter === 'completed' && '✅ Réceptionné complet'}
                                        {operationFilter === 'high_value' && '💎 Commandes > 1M F CFA'}
                                        {operationFilter === 'has_reliquat' && '📦 Avec reliquat à recevoir'}
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

                            {supplierFilter !== 'all' && (
                                <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-900 border border-blue-300 px-2 py-0.5 rounded-[4px] text-[10px] font-semibold uppercase tracking-wider">
                                    <span>🏢 Fournisseur : {supplierFilter}</span>
                                    <button
                                        type="button"
                                        onClick={() => handleFilterChange(setSupplierFilter, 'all')}
                                        className="hover:text-rose-600 cursor-pointer ml-0.5"
                                        title="Retirer le filtre fournisseur"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </span>
                            )}

                            {period !== 'all' && (
                                <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-900 border border-blue-300 px-2 py-0.5 rounded-[4px] text-[10px] font-semibold uppercase tracking-wider">
                                    <span>
                                        📅 {period === 'today' ? "Aujourd'hui" :
                                            period === '7days' ? "7 derniers jours" :
                                            period === 'month' ? "Ce mois" :
                                            period === 'custom' ? `Du ${formatDateHelper(customStartDate)} au ${formatDateHelper(customEndDate)}` : periodLabel}
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

                            {search && (
                                <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-800 border border-gray-300 px-2 py-0.5 rounded-[4px] text-[10px] font-semibold uppercase tracking-wider">
                                    <span>🔍 Recherche : "{search}"</span>
                                    <button
                                        type="button"
                                        onClick={() => handleFilterChange(setSearch, '')}
                                        className="hover:text-rose-600 cursor-pointer ml-0.5"
                                        title="Effacer la recherche"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-3">
                            {filteredOrders.length > 0 && (
                                <span className="text-[10px] font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-[3px] border border-gray-200">
                                    {filteredOrders.length} commande(s) trouvée(s)
                                </span>
                            )}
                            <button
                                type="button"
                                onClick={() => handleFilterChange(() => {
                                    setSelectedKpi(null);
                                    setOperationFilter('none');
                                    setSupplierFilter('all');
                                    setPeriod('all');
                                    setCustomStartDate('');
                                    setCustomEndDate('');
                                    setSearch('');
                                })}
                                className="text-[10px] font-semibold uppercase tracking-wider text-rose-600 hover:text-rose-800 hover:underline cursor-pointer"
                            >
                                Effacer tous les filtres
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── TABLEAU REGISTRE DES BONS DE COMMANDE (STYLE RÉAPPROVISIONNEMENT & INVENTAIRE) ── */}
            <div className="bg-white border-2 border-gray-300 rounded-[4px] shadow-sm overflow-hidden min-h-[350px] flex flex-col justify-center">
                {filterLoading ? (
                    <div className="p-16 flex flex-col items-center justify-center bg-white animate-in fade-in duration-150">
                        <div className="relative h-10 w-10">
                            <div className="absolute inset-0 animate-spin rounded-full border-4 border-gray-200 border-t-[#001d35]"></div>
                            <div className="absolute inset-1.5 animate-spin-reverse rounded-full border-2 border-transparent border-b-[#f77500]"></div>
                        </div>
                        <p className="text-xs font-semibold text-[#001d35] mt-3 uppercase tracking-wider">
                            Filtrage des bons de commande...
                        </p>
                        <p className="text-[11px] text-gray-500 mt-0.5 font-medium">
                            Consolidation des approvisionnements et statuts fournisseurs
                        </p>
                    </div>
                ) : filteredOrders.length === 0 ? (
                    <div className="p-12 text-center text-gray-500 bg-white">
                        <Package className="w-12 h-12 mx-auto text-gray-400 mb-2 opacity-60" />
                        <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            {search || period !== 'today' || supplierFilter !== 'all'
                                ? "Aucun bon de commande ne correspond aux filtres appliqués"
                                : "Aucun bon de commande répertorié aujourd'hui"}
                        </h3>
                        <p className="text-[11px] text-gray-500 mt-1 max-w-md mx-auto font-normal">
                            {search || period !== 'today' || supplierFilter !== 'all'
                                ? "Modifiez vos filtres de dates, fournisseur ou critères de recherche pour élargir la sélection (7 jours, Ce mois, Tout)."
                                : "Ajoutez des articles à la file de réapprovisionnement, puis convertissez-les en bons de commande."}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-[#001d35] text-white font-semibold uppercase tracking-wider text-[10px] divide-x divide-white/20 sticky top-0">
                                    <th className="py-2.5 px-3 w-32 whitespace-nowrap">N° Commande</th>
                                    <th className="py-2.5 px-3">Fournisseur</th>
                                    <th className="py-2.5 px-3 text-center w-28 whitespace-nowrap">Date</th>
                                    <th className="py-2.5 px-3 text-center w-24 whitespace-nowrap">Articles</th>
                                    <th className="py-2.5 px-3 text-right w-36 whitespace-nowrap">Montant Total</th>
                                    <th className="py-2.5 px-3 text-center w-36 whitespace-nowrap">Progression</th>
                                    <th className="py-2.5 px-3 text-center w-36 whitespace-nowrap">Statut</th>
                                    <th className="py-2.5 px-3 text-center w-28 whitespace-nowrap">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredOrders.map((order, idx) => {
                                    const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG['Ordered'];
                                    const completedItems = order.items.filter(i => (i.quantityReceived || 0) >= (i.quantityOrdered || 0)).length;
                                    const pct = order.items.length > 0 ? Math.round((completedItems / order.items.length) * 100) : 0;

                                    return (
                                        <tr
                                            key={order.id}
                                            onClick={() => setSelectedOrder(order)}
                                            className={`hover:bg-blue-50/40 transition-colors border-b border-gray-200 cursor-pointer group ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}
                                        >
                                            {/* N° Commande */}
                                            <td className="py-2.5 px-3 font-mono font-bold text-[#001d35] whitespace-nowrap text-xs">
                                                {order.orderNumber}
                                            </td>

                                            {/* Fournisseur */}
                                            <td className="py-2.5 px-3">
                                                <div className="font-semibold text-gray-900 text-xs tracking-tight group-hover:text-blue-900 flex items-center gap-1.5">
                                                    <Building2 className="w-3.5 h-3.5 text-gray-400 group-hover:text-[#001d35]" />
                                                    <span>{order.supplier || 'Fournisseur Inconnu'}</span>
                                                </div>
                                            </td>

                                            {/* Date */}
                                            <td className="py-2.5 px-3 text-center text-gray-600 whitespace-nowrap font-medium text-xs">
                                                {formatDateHelper(order.date)}
                                            </td>

                                            {/* Nb Articles */}
                                            <td className="py-2.5 px-3 text-center whitespace-nowrap font-medium text-gray-600">
                                                <span className="px-2 py-0.5 rounded-[3px] bg-gray-100 text-gray-700 text-[11px] font-semibold border border-gray-200">
                                                    {order.items?.length || 0} art.
                                                </span>
                                            </td>

                                            {/* Montant Total */}
                                            <td className="py-2.5 px-3 text-right font-bold text-[#001d35] tabular-nums whitespace-nowrap text-xs">
                                                {formatPrice(order.totalAmount)}
                                            </td>

                                            {/* Progression Réception */}
                                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                                <div className="w-28 mx-auto space-y-1">
                                                    <div className="flex justify-between text-[10px] font-semibold text-gray-600">
                                                        <span>{completedItems}/{order.items?.length || 0}</span>
                                                        <span>{pct}%</span>
                                                    </div>
                                                    <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-500 ${
                                                                pct === 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-amber-500' : 'bg-gray-300'
                                                            }`}
                                                            style={{ width: `${pct}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Statut */}
                                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${cfg.color}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                                    {cfg.label}
                                                </span>
                                            </td>

                                            {/* Actions */}
                                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                                <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedOrder(order)}
                                                        className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider rounded-[4px] bg-[#001d35] hover:bg-[#00284a] text-white transition-all cursor-pointer shadow-xs active:scale-95 flex items-center gap-1"
                                                        title="Consulter le bon de commande"
                                                    >
                                                        <Eye className="w-3 h-3" />
                                                        <span>Détails</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => printPurchaseOrder(order, company)}
                                                        className="p-1 text-[#001d35] hover:bg-gray-100 rounded-[4px] border border-gray-200 transition-colors cursor-pointer"
                                                        title="Imprimer le bon de commande"
                                                    >
                                                        <Printer className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Footer Historique */}
                {filteredOrders.length > 0 && !filterLoading && (
                    <div className="p-3 bg-white border-t-2 border-gray-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                        <div className="text-xs text-gray-600 font-normal">
                            <strong className="text-gray-900 font-semibold">{filteredOrders.length}</strong> commande(s) affichée(s)
                        </div>
                        <div className="text-[11px] text-gray-500 font-medium">
                            Cliquez sur une ligne pour ouvrir les détails et valider les réceptions
                        </div>
                    </div>
                )}
            </div>

            {/* ── MODALE DÉTAILS DU BON DE COMMANDE ── */}
            {selectedOrder && (
                <ReplenishmentOrderDetailModal
                    order={selectedOrder}
                    returnLabel="Retour aux Bons de Commande"
                    onClose={() => setSelectedOrder(null)}
                />
            )}
        </div>
    );
};

export default PurchaseOrders;
