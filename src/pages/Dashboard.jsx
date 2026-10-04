import React, { useEffect, useState, useMemo } from 'react';
import { useInventory } from '../context/InventoryContext';
import { useSales } from '../context/SalesContext';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { usePurchase } from '../context/PurchaseContext';
import { Eye, ChevronDown, Sliders, X, Check, Minus, AlertCircle, Calendar } from 'lucide-react';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { 
    format, 
    subDays, 
    startOfDay, 
    endOfDay, 
    startOfWeek, 
    endOfWeek, 
    subWeeks, 
    startOfMonth, 
    endOfMonth, 
    subMonths, 
    startOfQuarter, 
    endOfQuarter, 
    subQuarters, 
    startOfYear, 
    endOfYear, 
    subYears, 
    isWithinInterval, 
    parseISO 
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { formatPrice } from '../utils/currency';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
    const [showAlerts, setShowAlerts] = useState(true);
    const [activeTooltip, setActiveTooltip] = useState(null);
    const [period, setPeriod] = useState('day'); // 'day' (Aujourd'hui par défaut), 'week', 'month', 'quarter', 'year', 'custom'
    const [customStartDate, setCustomStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
    const [customEndDate, setCustomEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [chartMetric, setChartMetric] = useState('both'); // 'both', 'revenue', 'margin'
    const [filterLoading, setFilterLoading] = useState(false);
    const { products, getLowStockProducts, isLoadingFromBackend: isLoadingInventory } = useInventory();
    const { transactions, expenses, debts, isLoadingSales } = useSales();
    const { suppliers, isLoading: isLoadingPurchase } = usePurchase();
    const { currentStoreId } = useSettings();
    const isLoading = isLoadingInventory || isLoadingSales || isLoadingPurchase;
    const [showData, setShowData] = useState(false);

    // Direct visibility once loading is finished
    useEffect(() => {
        if (!isLoading) {
            setShowData(true);
        } else {
            setShowData(false);
        }
    }, [isLoading]);

    const navigate = useNavigate();
    const { user } = useAuth();

    // Simulated 1-second filter loading
    const handleFilterChange = (setter, value) => {
        setFilterLoading(true);
        setTimeout(() => {
            setter(value);
            setFilterLoading(false);
        }, 1000);
    };

    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [preferences, setPreferences] = useState(() => {
        const email = user?.email || 'default';
        const saved = localStorage.getItem(`dashboard_kpi_preferences_${email}`);
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error(e);
            }
        }
        return {
            showCatalogue: true,
            showAlertsStock: true,
            showSuppliers: true,
            showDebt: true,
            showReceivables: true,
            showStockValue: true,
            showPotentialRevenue: true,
            showTopProducts: true,
        };
    });

    // Mettre à jour les préférences de l'état local quand le profil de l'utilisateur est chargé
    useEffect(() => {
        if (user?.email) {
            const saved = localStorage.getItem(`dashboard_kpi_preferences_${user.email}`);
            if (saved) {
                try {
                    setPreferences(JSON.parse(saved));
                } catch (e) {
                    console.error("Erreur de chargement des préférences de l'utilisateur:", e);
                }
            }
        }
    }, [user?.email]);

    const togglePreference = (key) => {
        setPreferences(prev => {
            const next = { ...prev, [key]: !prev[key] };
            const email = user?.email || 'default';
            localStorage.setItem(`dashboard_kpi_preferences_${email}`, JSON.stringify(next));
            return next;
        });
    };

    const areAllOptionalKpisHidden = !preferences.showCatalogue &&
                                    !preferences.showAlertsStock &&
                                    !preferences.showSuppliers &&
                                    !preferences.showDebt &&
                                    !preferences.showReceivables &&
                                    !preferences.showStockValue &&
                                    !preferences.showPotentialRevenue;

    // ── Auto-reload after login to ensure real data ──────────────────
    React.useEffect(() => {
        const needsRefresh = sessionStorage.getItem('kabllix_refresh_needed');
        if (needsRefresh === 'true') {
            console.log("Dashboard: Premier accès après login détecté. Rechargement forcé pour les données réelles...");
            sessionStorage.removeItem('kabllix_refresh_needed');
            window.location.reload();
        }
    }, []);

    // ── Résolution des intervalles temporels ────────────────────────
    const { currentRange, previousRange, periodLabel, prevPeriodLabel } = useMemo(() => {
        const now = new Date();
        let currStart, currEnd, prevStart, prevEnd, label, prevLabel;

        switch (period) {
            case 'day':
                currStart = startOfDay(now);
                currEnd = endOfDay(now);
                prevStart = startOfDay(subDays(now, 1));
                prevEnd = endOfDay(subDays(now, 1));
                label = "Aujourd'hui";
                prevLabel = "Hier";
                break;

            case 'week':
                currStart = startOfWeek(now, { weekStartsOn: 1 });
                currEnd = endOfWeek(now, { weekStartsOn: 1 });
                prevStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
                prevEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
                label = "Cette Semaine";
                prevLabel = "Semaine dernière";
                break;

            case 'month':
                currStart = startOfMonth(now);
                currEnd = endOfMonth(now);
                prevStart = startOfMonth(subMonths(now, 1));
                prevEnd = endOfMonth(subMonths(now, 1));
                label = "Ce Mois";
                prevLabel = "Mois dernier";
                break;

            case 'quarter':
                currStart = startOfQuarter(now);
                currEnd = endOfQuarter(now);
                prevStart = startOfQuarter(subQuarters(now, 1));
                prevEnd = endOfQuarter(subQuarters(now, 1));
                label = "Ce Trimestre";
                prevLabel = "Trimestre dernier";
                break;

            case 'year':
                currStart = startOfYear(now);
                currEnd = endOfYear(now);
                prevStart = startOfYear(subYears(now, 1));
                prevEnd = endOfYear(subYears(now, 1));
                label = "Cette Année";
                prevLabel = "Année dernière";
                break;

            case 'custom':
            default:
                currStart = startOfDay(parseISO(customStartDate));
                currEnd = endOfDay(parseISO(customEndDate));
                const diffDays = Math.max(1, Math.round((currEnd - currStart) / (1000 * 60 * 60 * 24)));
                prevStart = startOfDay(subDays(currStart, diffDays));
                prevEnd = endOfDay(subDays(currEnd, diffDays));
                label = `Du ${format(currStart, 'dd/MM/yyyy')} au ${format(currEnd, 'dd/MM/yyyy')}`;
                prevLabel = "Période préc.";
                break;
        }

        return {
            currentRange: { start: currStart, end: currEnd },
            previousRange: { start: prevStart, end: prevEnd },
            periodLabel: label,
            prevPeriodLabel: prevLabel
        };
    }, [period, customStartDate, customEndDate]);

    // Filtrage des transactions pour la période courante et précédente
    const { currentPeriodTx, prevPeriodTx } = useMemo(() => {
        const completedOnly = (transactions || []).filter(t => t.status !== 'canceled');

        const curr = completedOnly.filter(t => {
            const rawDate = t.date || t.createdAt || t.timestamp || t.transactionDate;
            if (!rawDate) return false;
            const date = new Date(rawDate);
            if (isNaN(date.getTime())) return false;
            return isWithinInterval(date, currentRange);
        });

        const prev = completedOnly.filter(t => {
            const rawDate = t.date || t.createdAt || t.timestamp || t.transactionDate;
            if (!rawDate) return false;
            const date = new Date(rawDate);
            if (isNaN(date.getTime())) return false;
            return isWithinInterval(date, previousRange);
        });

        return { currentPeriodTx: curr, prevPeriodTx: prev };
    }, [transactions, currentRange, previousRange]);

    const filteredTx = currentPeriodTx;

    // Calculate metrics (based on filtered period)
    const totalRevenue = filteredTx.reduce((sum, t) => sum + (Number(t.total) || 0), 0);
    const totalOrders = filteredTx.length;
    const lowStockCount = getLowStockProducts().length;
    const totalStockValue = products.reduce((sum, p) => sum + ((p.stockLevels?.[currentStoreId] || 0) * (p.purchasePrice || 0)), 0);
    const potentialStockRevenue = products.reduce((sum, p) => sum + ((p.stockLevels?.[currentStoreId] || 0) * (p.price || 0)), 0);

    // Calcul précis de la marge d'une transaction (protégé contre le déconditionnement)
    const calculateTxMargin = (tx) => {
        if (!tx.items || tx.items.length === 0) return 0;
        return tx.items.reduce((sum, item) => {
            const product = products.find(p => p.id === item.id);
            const salePriceTotal = item.totalPrice != null
                ? Number(item.totalPrice)
                : (item.isBulk ? item.bulkPrice * item.inputQuantity : (item.price || 0) * (item.inputQuantity || item.quantity || 1));

            const cf = product && parseFloat(product.conversionFactor) > 0 ? parseFloat(product.conversionFactor) : 1;
            const isFractional = item.type === 'packaging' || item.type === 'lot';

            let deductedQty = item.stockDeduction;
            if (deductedQty == null) {
                if (isFractional && cf > 1) {
                    deductedQty = (item.inputQuantity || item.quantity || 1) / cf;
                } else {
                    deductedQty = item.inputQuantity || item.quantity || 1;
                }
            }

            const basicUnitPurchasePrice = product && product.purchasePrice != null
                ? Number(product.purchasePrice)
                : (salePriceTotal / Math.max(0.0001, deductedQty)) * 0.8;

            const costTotal = basicUnitPurchasePrice * deductedQty;
            return sum + (salePriceTotal - costTotal);
        }, 0);
    };

    // Calculate estimated margin
    const estimatedMargin = filteredTx.reduce((sum, t) => sum + calculateTxMargin(t), 0);

    // Calculate total expenses (filtered by same period)
    const filteredExpenses = useMemo(() => {
        return (expenses || []).filter(e => {
            const rawDate = e.date || e.createdAt;
            if (!rawDate) return false;
            const d = new Date(rawDate);
            if (isNaN(d.getTime())) return false;
            return isWithinInterval(d, currentRange);
        });
    }, [expenses, currentRange]);

    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    // Calculate Net Profit
    const netProfit = estimatedMargin - totalExpenses;

    // Supplier metrics
    const totalSuppliers = suppliers.length;
    const globalDebt = suppliers.reduce((sum, s) => sum + (s.balance || 0), 0);

    // Customer Debt metrics (Créances)
    const totalReceivables = debts.reduce((sum, d) => sum + ((d.totalAmount || 0) - (d.paidAmount || 0)), 0);

    // Comparaison avec la période précédente pour la croissance
    const prevRevenue = prevPeriodTx.reduce((sum, t) => sum + (Number(t.total) || 0), 0);
    const revenueGrowth = useMemo(() => {
        if (prevRevenue === 0) return totalRevenue > 0 ? '+100%' : '0%';
        const g = ((totalRevenue - prevRevenue) / prevRevenue) * 100;
        return (g >= 0 ? '+' : '') + g.toFixed(1) + '%';
    }, [totalRevenue, prevRevenue]);

    // Données pour le graphique d'évolution (Ventes & Marges)
    const timelineData = useMemo(() => {
        if (period === 'day') {
            const hours = Array.from({ length: 24 }, (_, i) => i);
            return hours.map(hour => {
                const label = `${hour.toString().padStart(2, '0')}h`;
                const txInHour = currentPeriodTx.filter(t => {
                    const d = new Date(t.date || t.createdAt || t.timestamp || t.transactionDate);
                    return d.getHours() === hour;
                });
                const rev = txInHour.reduce((sum, t) => sum + (Number(t.total) || 0), 0);
                const mrg = txInHour.reduce((sum, t) => sum + calculateTxMargin(t), 0);
                return {
                    label,
                    revenue: rev,
                    margin: Math.round(mrg),
                    count: txInHour.length
                };
            });
        }

        if (period === 'week') {
            const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
            const start = currentRange.start;
            return days.map((dayLabel, index) => {
                const dayDate = new Date(start);
                dayDate.setDate(start.getDate() + index);
                const dateKey = format(dayDate, 'yyyy-MM-dd');

                const txInDay = currentPeriodTx.filter(t => {
                    const d = new Date(t.date || t.createdAt || t.timestamp || t.transactionDate);
                    return format(d, 'yyyy-MM-dd') === dateKey;
                });

                const rev = txInDay.reduce((sum, t) => sum + (Number(t.total) || 0), 0);
                const mrg = txInDay.reduce((sum, t) => sum + calculateTxMargin(t), 0);
                return {
                    label: `${dayLabel} ${format(dayDate, 'dd/MM')}`,
                    revenue: rev,
                    margin: Math.round(mrg),
                    count: txInDay.length
                };
            });
        }

        if (period === 'month') {
            const start = currentRange.start;
            const end = currentRange.end;
            const daysInMonth = end.getDate();
            const points = [];

            for (let d = 1; d <= daysInMonth; d++) {
                const dayDate = new Date(start.getFullYear(), start.getMonth(), d);
                const dateKey = format(dayDate, 'yyyy-MM-dd');

                const txInDay = currentPeriodTx.filter(t => {
                    const date = new Date(t.date || t.createdAt || t.timestamp || t.transactionDate);
                    return format(date, 'yyyy-MM-dd') === dateKey;
                });

                const rev = txInDay.reduce((sum, t) => sum + (Number(t.total) || 0), 0);
                const mrg = txInDay.reduce((sum, t) => sum + calculateTxMargin(t), 0);

                points.push({
                    label: `${d} ${format(dayDate, 'MMM', { locale: fr })}`,
                    revenue: rev,
                    margin: Math.round(mrg),
                    count: txInDay.length
                });
            }
            return points;
        }

        if (period === 'quarter' || period === 'year') {
            const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
            const startMonth = currentRange.start.getMonth();
            const endMonth = currentRange.end.getMonth();

            const monthIndices = [];
            for (let m = startMonth; m <= endMonth; m++) {
                monthIndices.push(m);
            }

            return monthIndices.map(mIdx => {
                const txInMonth = currentPeriodTx.filter(t => {
                    const d = new Date(t.date || t.createdAt || t.timestamp || t.transactionDate);
                    return d.getMonth() === mIdx && d.getFullYear() === currentRange.start.getFullYear();
                });

                const rev = txInMonth.reduce((sum, t) => sum + (Number(t.total) || 0), 0);
                const mrg = txInMonth.reduce((sum, t) => sum + calculateTxMargin(t), 0);

                return {
                    label: months[mIdx],
                    revenue: rev,
                    margin: Math.round(mrg),
                    count: txInMonth.length
                };
            });
        }

        // Période Personnalisée
        const diffDays = Math.max(1, Math.round((currentRange.end - currentRange.start) / (1000 * 60 * 60 * 24)));
        const daysMap = {};

        if (diffDays <= 31) {
            for (let i = 0; i <= diffDays; i++) {
                const dayDate = new Date(currentRange.start);
                dayDate.setDate(currentRange.start.getDate() + i);
                if (dayDate <= currentRange.end) {
                    const dateKey = format(dayDate, 'yyyy-MM-dd');
                    const label = format(dayDate, 'dd/MM');
                    daysMap[dateKey] = { label, revenue: 0, margin: 0, count: 0 };
                }
            }
            currentPeriodTx.forEach(t => {
                const d = new Date(t.date || t.createdAt || t.timestamp || t.transactionDate);
                const dateKey = format(d, 'yyyy-MM-dd');
                if (daysMap[dateKey]) {
                    daysMap[dateKey].revenue += Number(t.total) || 0;
                    daysMap[dateKey].margin += calculateTxMargin(t);
                    daysMap[dateKey].count += 1;
                }
            });
            return Object.values(daysMap);
        } else {
            currentPeriodTx.forEach(t => {
                const d = new Date(t.date || t.createdAt || t.timestamp || t.transactionDate);
                const dateKey = format(d, 'yyyy-MM-dd');
                const label = format(d, 'dd/MM');
                if (!daysMap[dateKey]) daysMap[dateKey] = { label, dateKey, revenue: 0, margin: 0, count: 0 };
                daysMap[dateKey].revenue += Number(t.total) || 0;
                daysMap[dateKey].margin += calculateTxMargin(t);
                daysMap[dateKey].count += 1;
            });
            return Object.values(daysMap).sort((a, b) => a.dateKey.localeCompare(b.dateKey));
        }
    }, [period, currentPeriodTx, currentRange, products]);

    const chartTotals = useMemo(() => {
        const rev = timelineData.reduce((sum, d) => sum + (d.revenue || 0), 0);
        const mrg = timelineData.reduce((sum, d) => sum + (d.margin || 0), 0);
        return { revenue: rev, margin: mrg };
    }, [timelineData]);

    // Simplified StatCard to use standard formatting
    const StatCard = ({ tooltipId, title, titleBadge, value, icon, iconUrl, color, trend, trendSubtitle, subtitle, onAction, isCurrency, loading, tooltip, onHide, onClickTitle }) => {
        const btnRef = React.useRef(null);
        const isOpen = activeTooltip?.id === tooltipId;

        const handleToggle = () => {
            if (isOpen) { setActiveTooltip(null); return; }
            const rect = btnRef.current.getBoundingClientRect();
            const TOOLTIP_W = 256; // w-64
            const TOOLTIP_H = 90;  // estimated height
            const MARGIN = 12;
            // Flip horizontally if not enough space on the right
            const flipX = rect.left + TOOLTIP_W + MARGIN > window.innerWidth;
            // Flip vertically if not enough space above
            const flipY = rect.top - TOOLTIP_H - MARGIN < 0;
            setActiveTooltip({ id: tooltipId, pos: { top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom }, flipX, flipY, text: tooltip });
        };

        return (
            <div
                onClick={() => {
                    if (onClickTitle) onClickTitle();
                }}
                className={`bg-white p-3 rounded-[4px] border-2 border-gray-300 shadow-sm relative group hover:shadow-md transition-shadow overflow-hidden min-h-[120px] flex flex-col justify-center ${
                    onClickTitle ? 'cursor-pointer hover:border-[#001d35]/40' : ''
                }`}
            >
                {onHide && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onHide();
                        }}
                        className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-50 hover:bg-red-500 text-red-500 hover:text-white border border-red-200 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center cursor-pointer shadow-xs z-20"
                        title="Masquer cet indicateur"
                    >
                        <Minus className="w-3.5 h-3.5 stroke-[3]" />
                    </button>
                )}
                {loading ? (
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
                                <div className="flex items-center gap-1.5">
                                    {onClickTitle ? (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onClickTitle();
                                            }}
                                            className="text-sm font-semibold tracking-wide uppercase text-[11px] text-blue-600/70 hover:text-[#001d35] hover:underline underline-offset-4 decoration-2 cursor-pointer transition-colors text-left inline-flex items-center gap-1 group/title"
                                            title="Cliquer pour accéder aux détails"
                                        >
                                            <span>{title}</span>
                                        </button>
                                    ) : (
                                        <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-blue-600/70">{title}</p>
                                    )}
                                    {titleBadge && titleBadge}
                                    {tooltip && (
                                        <button
                                            ref={btnRef}
                                            onClick={handleToggle}
                                            className={`w-4 h-4 rounded-full text-[10px] font-black leading-none flex-shrink-0 flex items-center justify-center transition-colors cursor-pointer ${isOpen ? 'bg-[#001d35] text-white' : 'bg-gray-200 hover:bg-[#001d35] text-gray-500 hover:text-white'}`}
                                        >?</button>
                                    )}
                                </div>
                                <div className="flex items-baseline mt-2 font-semibold opacity-85" style={{ color: color || '#001d35', opacity: 0.85 }}>
                                    <h3 className="text-xl sm:text-2xl font-semibold">
                                        {isCurrency ? formatPrice(value) : value}
                                    </h3>
                                </div>
                                {subtitle && (
                                    <p className="text-xs text-gray-400 mt-2 font-medium">{subtitle}</p>
                                )}
                            </div>
                        </div>

                        {/* Background 3D Illustration */}
                        {iconUrl && (
                            <img
                                src={iconUrl}
                                alt=""
                                crossOrigin="anonymous"
                                className="absolute bottom-2 right-2 w-16 h-16 opacity-30 group-hover:opacity-50 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-700 pointer-events-none"
                            />
                        )}

                        {trend && (
                            <div className="mt-4 flex items-center text-sm">
                                <i className={`uil ${trend.startsWith('-') ? 'uil-arrow-down-right text-rose-500' : 'uil-arrow-growth text-green-500'} mr-1 text-lg`}></i>
                                <span className={`font-medium ${trend.startsWith('-') ? 'text-rose-500' : 'text-green-500'}`}>{trend}</span>
                                <span className="text-gray-400 ml-1 text-xs">{trendSubtitle || `vs ${prevPeriodLabel ? prevPeriodLabel.toLowerCase() : 'période préc.'}`}</span>
                            </div>
                        )}
                        {onAction && (
                            <button
                                onClick={onAction}
                                className="absolute top-4 right-4 p-2 bg-gray-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-50 hover:text-blue-600"
                                title="Voir les détails"
                            >
                                <Eye className="w-4 h-4" />
                            </button>
                        )}
                    </>
                )}
            </div>
        );
    };

    // Loading Spinner for larger containers
    const LoadingOverlay = () => (
        <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-20 animate-in fade-in duration-150">
            <div className="flex flex-col items-center gap-4 bg-white px-8 py-6 rounded-sm shadow-xl border border-gray-100">
                <div className="w-12 h-12 border-4 border-[#001d35]/20 border-t-[#001d35] rounded-full animate-spin"></div>
                <div className="text-center">
                    <p className="text-gray-900 font-bold text-sm">Synchronisation en cours...</p>
                    <p className="text-gray-500 text-xs mt-0.5">Actualisation des données financières</p>
                </div>
            </div>
        </div>
    );

    return (
        <div className="space-y-2.5">
            {/* Barre d'outils de personnalisation */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white px-3 py-1.5 border-2 border-gray-300 rounded-sm shadow-sm text-xs font-semibold gap-2">
                <div className="flex items-center gap-2 text-gray-500">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                    <span>Affichage personnalisé actif</span>
                </div>
                <button
                    onClick={() => setShowSettingsModal(true)}
                    className="flex items-center gap-1.5 text-[#001d35] hover:text-[#003561] transition-colors cursor-pointer group"
                >
                    <Sliders className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                    <span className="underline underline-offset-2">Personnaliser les indicateurs du tableau de bord</span>
                </button>
            </div>

            {/* ─── BARRE DES ONGLETS DE PÉRIODE (Identique à Performances des Ventes) ─── */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2.5 rounded-sm border-2 border-gray-300 shadow-sm print:hidden">
                <div className="flex flex-wrap items-center gap-1 bg-gray-100/80 p-1 rounded-sm border-2 border-gray-300">
                    {[
                        { key: 'day', label: "Aujourd'hui" },
                        { key: 'week', label: 'Hebdomadaire' },
                        { key: 'month', label: 'Ce mois' },
                        { key: 'quarter', label: 'Trimestrielle' },
                        { key: 'year', label: 'Annuelle' },
                        { key: 'custom', label: 'Personnalisée' }
                    ].map(opt => (
                        <button
                            key={opt.key}
                            onClick={() => handleFilterChange(setPeriod, opt.key)}
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

                {/* Filtre Date Personnalisée si sélectionné */}
                {period === 'custom' && (
                    <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-sm border border-gray-300">
                        <input
                            type="date"
                            value={customStartDate}
                            onChange={(e) => handleFilterChange(setCustomStartDate, e.target.value)}
                            className="bg-white border border-gray-300 text-gray-800 text-xs rounded-sm px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#001d35]"
                        />
                        <span className="text-gray-400 text-xs font-bold">au</span>
                        <input
                            type="date"
                            value={customEndDate}
                            onChange={(e) => handleFilterChange(setCustomEndDate, e.target.value)}
                            className="bg-white border border-gray-300 text-gray-800 text-xs rounded-sm px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#001d35]"
                        />
                    </div>
                )}

                <div className="flex items-center gap-2 text-xs text-gray-600 font-semibold pr-2">
                    <Calendar className="w-3.5 h-3.5 text-[#001d35]" />
                    <span>Période : <strong className="text-[#001d35]">{periodLabel}</strong></span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard
                    tooltipId="ca"
                    title="Chiffre d'Affaires"
                    value={totalRevenue}
                    isCurrency={true}
                    iconUrl="/icons8/fluency_240_banknotes.png"
                    trend={revenueGrowth}
                    loading={!showData || filterLoading}
                    tooltip="L'argent total encaissé grâce aux ventes réalisées sur la période sélectionnée."
                />
                <StatCard
                    tooltipId="ventes"
                    title="Ventes"
                    value={totalOrders}
                    iconUrl="/icons8/fluency_240_shopping-cart.png"
                    subtitle={`Total commandes (${periodLabel.toLowerCase()})`}
                    loading={!showData || filterLoading}
                    tooltip="Le nombre de transactions (clients servis) sur la période sélectionnée."
                    onClickTitle={() => navigate(`/sales/analytics?scroll=sales-table&period=${period}#tableau-ventes-realisees`)}
                />
                <StatCard
                    tooltipId="marge"
                    title="Marge Brute"
                    value={estimatedMargin}
                    isCurrency={true}
                    iconUrl="/icons8/fluency_240_bullish.png"
                    subtitle="Estimation sur prix d'achat"
                    loading={!showData || filterLoading}
                    tooltip="Bénéfice estimé des ventes = Prix de vente − Prix d'achat, avant déduction des dépenses."
                />
                <StatCard
                    tooltipId="benefice"
                    title="Bénéfice Net Réel"
                    value={netProfit}
                    isCurrency={true}
                    iconUrl="/icons8/fluency_240_coins.png"
                    subtitle={`Après dépenses (${formatPrice(totalExpenses)})`}
                    loading={!showData || filterLoading}
                    tooltip="Marge Brute moins toutes les dépenses/charges enregistrées. Votre vrai bénéfice."
                />
            </div>



            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {/* Évolution des Ventes & Marges (Style Identique à Performances des Ventes) */}
                <div className={`bg-white p-3 rounded-sm border-2 border-gray-300 shadow-sm relative overflow-hidden ${
                    areAllOptionalKpisHidden ? 'lg:col-span-2' : 'col-span-1'
                }`}>
                    {(!showData || filterLoading) && <LoadingOverlay />}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-gray-200 gap-3">
                        <div>
                            <h3 className="text-sm font-semibold tracking-wide uppercase text-[11px] text-blue-600/70">
                                Évolution des Ventes & Marges
                            </h3>
                            <p className="text-xs text-gray-500 mt-0.5">
                                {periodLabel} &bull; Total Ventes : {formatPrice(chartTotals.revenue)} &bull; Marge : {formatPrice(chartTotals.margin)}
                            </p>
                        </div>

                        {/* Sélecteur de courbe */}
                        <div className="flex items-center gap-1 bg-gray-100/80 p-0.5 rounded-sm border-2 border-gray-300 self-start sm:self-auto">
                            <button
                                onClick={() => handleFilterChange(setChartMetric, 'both')}
                                disabled={filterLoading}
                                className={`px-2.5 py-1 text-xs font-bold rounded-sm transition-all cursor-pointer disabled:opacity-60 ${
                                    chartMetric === 'both'
                                        ? 'bg-[#001d35] text-white shadow-sm'
                                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                                }`}
                            >
                                Les Deux
                            </button>
                            <button
                                onClick={() => handleFilterChange(setChartMetric, 'revenue')}
                                disabled={filterLoading}
                                className={`px-2.5 py-1 text-xs font-bold rounded-sm transition-all cursor-pointer disabled:opacity-60 ${
                                    chartMetric === 'revenue'
                                        ? 'bg-[#001d35] text-white shadow-sm'
                                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                                }`}
                            >
                                Ventes
                            </button>
                            <button
                                onClick={() => handleFilterChange(setChartMetric, 'margin')}
                                disabled={filterLoading}
                                className={`px-2.5 py-1 text-xs font-bold rounded-sm transition-all cursor-pointer disabled:opacity-60 ${
                                    chartMetric === 'margin'
                                        ? 'bg-[#001d35] text-white shadow-sm'
                                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                                }`}
                            >
                                Marge
                            </button>
                        </div>
                    </div>

                    <div className="w-full min-w-0 mt-3">
                        {timelineData.length === 0 || (chartTotals.revenue === 0 && chartTotals.margin === 0) ? (
                            <div className="h-64 flex flex-col items-center justify-center text-gray-400">
                                <AlertCircle className="w-8 h-8 mb-2 stroke-[1.5]" />
                                <p className="text-xs font-semibold">Aucune vente enregistrée sur cette période</p>
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height={260}>
                                <AreaChart data={timelineData} margin={{ top: 10, right: 15, left: 0, bottom: 40 }}>
                                    <defs>
                                        <linearGradient id="dashboardColorSales" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#001d35" stopOpacity={0.25} />
                                            <stop offset="95%" stopColor="#001d35" stopOpacity={0.0} />
                                        </linearGradient>
                                        <linearGradient id="dashboardColorMargin" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#f77500" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#f77500" stopOpacity={0.0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                    <XAxis 
                                        dataKey="label" 
                                        stroke="#6b7280" 
                                        fontSize={11} 
                                        tickLine={false} 
                                        axisLine={false} 
                                        interval="preserveStartEnd"
                                        minTickGap={10}
                                        angle={-35}
                                        textAnchor="end"
                                        dy={4}
                                    />
                                    <YAxis 
                                        stroke="#6b7280" 
                                        fontSize={11} 
                                        tickLine={false} 
                                        axisLine={false} 
                                        width={48}
                                        tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} 
                                    />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '4px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                                        formatter={(value, name) => [formatPrice(value), name === 'revenue' ? "Chiffre d'Affaires" : 'Marge Brute']}
                                        labelFormatter={(label) => `Temps : ${label}`}
                                    />
                                    <Legend 
                                        formatter={(val) => val === 'revenue' ? "Chiffre d'Affaires" : 'Marge Brute'}
                                        verticalAlign="top"
                                        align="right"
                                        wrapperStyle={{ fontSize: '11px', fontWeight: 600, paddingBottom: '10px' }}
                                    />
                                    {(chartMetric === 'both' || chartMetric === 'revenue') && (
                                        <Area
                                            type="monotone"
                                            dataKey="revenue"
                                            stroke="#001d35"
                                            strokeWidth={3}
                                            fillOpacity={1}
                                            fill="url(#dashboardColorSales)"
                                        />
                                    )}
                                    {(chartMetric === 'both' || chartMetric === 'margin') && (
                                        <Area
                                            type="monotone"
                                            dataKey="margin"
                                            stroke="#f77500"
                                            strokeWidth={2.5}
                                            fillOpacity={1}
                                            fill="url(#dashboardColorMargin)"
                                        />
                                    )}
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* Nouveau Secteur : Métriques du Catalogue & Fournisseurs */}
                {!areAllOptionalKpisHidden && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 h-fit">
                        {preferences.showCatalogue && (
                            <StatCard
                                tooltipId="catalogue"
                                title="Total Catalogue"
                                value={products.length}
                                subtitle="Articles référencés"
                                iconUrl="/icons8/fluency_240_product.png"
                                loading={!showData}
                                tooltip="Le nombre total de produits/références enregistrés dans votre inventaire."
                                onHide={() => togglePreference('showCatalogue')}
                                onClickTitle={() => navigate('/inventory')}
                            />
                        )}
                        {preferences.showAlertsStock && (
                            <StatCard
                                tooltipId="alertes"
                                title="Alertes Stock"
                                titleBadge={lowStockCount > 0 ? (
                                    <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-xs font-black flex items-center justify-center animate-pulse flex-shrink-0 shadow-sm border border-amber-400" title="Stock faible détecté !">
                                        !
                                    </span>
                                ) : null}
                                value={lowStockCount}
                                subtitle="À réapprovisionner"
                                iconUrl="/icons8/fluency_240_high-priority.png"
                                loading={!showData || filterLoading}
                                tooltip="Nombre de produits dont le stock est en dessous du seuil minimum défini. Action requise."
                                onHide={() => togglePreference('showAlertsStock')}
                                onClickTitle={() => navigate('/inventory?filter=low_stock')}
                            />
                        )}
                        {preferences.showSuppliers && (
                            <StatCard
                                tooltipId="fournisseurs"
                                title="Total Fournisseurs"
                                value={totalSuppliers}
                                subtitle="Partenaires enregistrés"
                                iconUrl="/icons8/fluency_240_group.png"
                                loading={!showData || filterLoading}
                                tooltip="Le nombre de fournisseurs avec qui vous travaillez, enregistrés dans le module Fournisseurs."
                                onHide={() => togglePreference('showSuppliers')}
                                onClickTitle={() => navigate('/suppliers')}
                            />
                        )}
                        {preferences.showDebt && (
                            <StatCard
                                tooltipId="dette"
                                title="Dette Globale"
                                value={globalDebt}
                                isCurrency={true}
                                subtitle="Solde dû aux fournisseurs"
                                iconUrl="/icons8/fluency_240_debt.png"
                                loading={!showData || filterLoading}
                                tooltip="La somme totale que vous devez encore payer à vos fournisseurs pour vos achats de marchandises."
                                onHide={() => togglePreference('showDebt')}
                                onClickTitle={() => navigate('/suppliers')}
                            />
                        )}
                        {preferences.showReceivables && (
                            <StatCard
                                tooltipId="creances"
                                title="Total Créances"
                                value={totalReceivables}
                                isCurrency={true}
                                subtitle="Carnet de crédit (Clients)"
                                iconUrl="/icons8/fluency_240_ledger.png"
                                loading={!showData || filterLoading}
                                tooltip="L'argent que vos clients vous doivent encore (ventes faites à crédit non encore réglées)."
                                onHide={() => togglePreference('showReceivables')}
                                onClickTitle={() => navigate('/debtbook')}
                            />
                        )}
                        {preferences.showStockValue && (
                            <StatCard
                                tooltipId="stock"
                                title="Valeur Totale du Stock"
                                value={totalStockValue}
                                isCurrency={true}
                                subtitle="Capital immobilisé (Prix achat)"
                                iconUrl="/icons8/fluency_240_box.png"
                                loading={!showData || filterLoading}
                                tooltip="L'argent que vous avez investi pour acheter la marchandise qui est actuellement dans vos rayons (calculé sur le prix d'achat)."
                                onHide={() => togglePreference('showStockValue')}
                                onClickTitle={() => navigate('/inventory')}
                            />
                        )}
                        {preferences.showPotentialRevenue && (
                            <div className="sm:col-span-2">
                                <StatCard
                                    tooltipId="potentiel"
                                    title="Revenus Potentiels"
                                    value={potentialStockRevenue}
                                    isCurrency={true}
                                    subtitle={`Marge latente : ${formatPrice(potentialStockRevenue - totalStockValue)}`}
                                    iconUrl="/icons8/fluency_240_cash-in-hand.png"
                                    loading={!showData || filterLoading}
                                    tooltip="Si vous vendiez tout votre stock aujourd'hui aux prix affichés, voici l'argent total que vous encaisseriez. La marge latente = ce montant moins la valeur d'achat du stock."
                                    onHide={() => togglePreference('showPotentialRevenue')}
                                    onClickTitle={() => navigate('/inventory')}
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* Top Produits */}
                {preferences.showTopProducts && (
                    <div className="lg:col-span-2 bg-white p-3 rounded-sm border-2 border-gray-300 shadow-sm mt-0 relative group overflow-hidden">
                        {!showData && <LoadingOverlay />}
                        <button
                            type="button"
                            onClick={() => togglePreference('showTopProducts')}
                            className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-50 hover:bg-red-500 text-red-500 hover:text-white border border-red-200 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center cursor-pointer shadow-xs z-20"
                            title="Masquer ce graphique"
                        >
                            <Minus className="w-3.5 h-3.5 stroke-[3]" />
                        </button>
                        <h3 className="text-sm font-semibold tracking-wide uppercase text-[11px] text-blue-600/70 mb-4">Top Produits (Plus Grand Stock)</h3>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={[...products]
                                    .map(p => ({ ...p, name: p.name?.toUpperCase(), currentStock: p.stockLevels?.[currentStoreId] || 0 }))
                                    .sort((a, b) => b.currentStock - a.currentStock)
                                    .slice(0, 8)}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-5} textAnchor="middle" height={60} />
                                    <YAxis tick={{ fontSize: 11 }} />
                                    <Tooltip />
                                    <Bar dataKey="currentStock" fill="#6366f1" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}
            </div>

            {/* Modale de Personnalisation des indicateurs */}
            {showSettingsModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-lg rounded-sm shadow-2xl border-t-4 border-[#001d35] overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="p-5 border-b-2 border-gray-300 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-lg font-bold text-[#001d35] uppercase tracking-tight flex items-center gap-2">
                                    <Sliders className="w-5 h-5 text-[#001d35]" />
                                    Personnaliser l'affichage
                                </h3>
                                <p className="text-gray-500 text-xs mt-1 font-medium">Configurez la visibilité des indicateurs de performance</p>
                            </div>
                            <button 
                                onClick={() => setShowSettingsModal(false)}
                                className="p-1.5 hover:bg-slate-100 rounded-sm text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-5 overflow-y-auto space-y-5 custom-scrollbar flex-1">
                            {/* Section 1: Obligatoire */}
                            <div>
                                <h4 className="text-[11px] font-bold text-blue-600/70 uppercase tracking-widest mb-3 border-b pb-1 border-gray-200">
                                    Indicateurs Obligatoires (Toujours activés)
                                </h4>
                                <div className="space-y-3">
                                    {[
                                        { label: "Chiffre d'Affaires", desc: "L'argent total encaissé grâce aux ventes réalisées." },
                                        { label: 'Ventes', desc: 'Le nombre total de transactions (clients servis).' },
                                        { label: 'Marge Brute', desc: 'Bénéfice estimé sur le prix d\'achat.' },
                                        { label: 'Bénéfice Net Réel', desc: 'Marge brute après déduction de toutes les dépenses.' },
                                        { label: 'Évolution des Ventes (Graphique)', desc: 'Courbe d\'évolution sur les 7 derniers jours.' }
                                    ].map((item, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-2.5 bg-gray-50 border border-gray-200 rounded-sm">
                                            <div>
                                                <p className="text-sm font-bold text-gray-800">{item.label}</p>
                                                <p className="text-[11px] text-gray-500 mt-0.5">{item.desc}</p>
                                            </div>
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200/50 rounded-sm text-[10px] font-bold uppercase tracking-wider">
                                                <Check className="w-3 h-3" /> Requis
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Section 2: Optionnel */}
                            <div>
                                <h4 className="text-[11px] font-bold text-blue-600/70 uppercase tracking-widest mb-3 border-b pb-1 border-gray-200">
                                    Indicateurs Optionnels (Configurables)
                                </h4>
                                <div className="space-y-3">
                                    {[
                                        { key: 'showCatalogue', label: 'Total Catalogue', desc: 'Nombre de produits référencés dans l\'inventaire.' },
                                        { key: 'showAlertsStock', label: 'Alertes Stock', desc: 'Nombre de produits en rupture ou sous le seuil minimum.' },
                                        { key: 'showSuppliers', label: 'Total Fournisseurs', desc: 'Nombre de partenaires fournisseurs enregistrés.' },
                                        { key: 'showDebt', label: 'Dette Globale', desc: 'Somme totale due aux fournisseurs.' },
                                        { key: 'showReceivables', label: 'Total Créances', desc: 'Somme des crédits accordés aux clients.' },
                                        { key: 'showStockValue', label: 'Valeur Totale du Stock', desc: 'Valeur totale du stock actuel (au prix d\'achat).' },
                                        { key: 'showPotentialRevenue', label: 'Revenus Potentiels & Marge Latente', desc: 'Estimation des ventes si tout le stock était vendu.' },
                                        { key: 'showTopProducts', label: 'Top Produits (Graphique)', desc: 'Graphique en barres affichant les produits les plus stockés.' }
                                    ].map(item => (
                                        <div key={item.key} className="flex items-center justify-between p-2.5 hover:bg-slate-50/50 border border-gray-200 rounded-sm transition-colors">
                                            <div className="pr-4">
                                                <p className="text-sm font-bold text-gray-800">{item.label}</p>
                                                <p className="text-[11px] text-gray-500 mt-0.5">{item.desc}</p>
                                            </div>
                                            <button
                                                role="switch"
                                                aria-checked={preferences[item.key]}
                                                onClick={() => togglePreference(item.key)}
                                                className={`relative inline-flex h-5 w-10 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none ${
                                                    preferences[item.key] ? 'bg-[#001d35]' : 'bg-gray-200'
                                                }`}
                                            >
                                                <span
                                                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                                                        preferences[item.key] ? 'translate-x-5' : 'translate-x-0.5'
                                                    }`}
                                                />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 bg-slate-50 border-t-2 border-gray-300 flex justify-end">
                            <button
                                onClick={() => setShowSettingsModal(false)}
                                className="px-5 py-2 bg-[#001d35] hover:bg-[#002d52] text-white font-bold rounded-sm text-xs uppercase tracking-wider transition-colors cursor-pointer"
                            >
                                Terminer
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Global KPI Tooltip */}
            {activeTooltip && (() => {
                const { pos, flipX, flipY, text } = activeTooltip;
                const MARGIN = 8;
                // Horizontal: anchor left by default, right if flipX
                const leftStyle = flipX
                    ? { right: window.innerWidth - pos.right }
                    : { left: pos.left };
                // Vertical: above by default (translateY -100%), below if flipY
                const topStyle = flipY
                    ? { top: pos.bottom + MARGIN }
                    : { top: pos.top - MARGIN, transform: 'translateY(-100%)' };

                return (
                    <>
                        <div className="fixed inset-0 z-[9998]" onClick={() => setActiveTooltip(null)} />
                        <div
                            className="fixed z-[9999] w-64 bg-[#001d35] text-white text-xs rounded-md p-3 shadow-2xl leading-relaxed"
                            style={{ ...leftStyle, ...topStyle }}
                        >
                            {/* Arrow */}
                            {!flipY && (
                                <div className={`absolute -bottom-1.5 w-3 h-3 bg-[#001d35] rotate-45 ${flipX ? 'right-3' : 'left-3'}`}></div>
                            )}
                            {flipY && (
                                <div className={`absolute -top-1.5 w-3 h-3 bg-[#001d35] rotate-45 ${flipX ? 'right-3' : 'left-3'}`}></div>
                            )}
                            {text}
                        </div>
                    </>
                );
            })()}
        </div>
    );
};

export default Dashboard;
