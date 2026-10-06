import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSales } from '../../context/SalesContext';
import { useInventory } from '../../context/InventoryContext';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';
import { formatPrice } from '../../utils/currency';
import { exportToExcel } from '../../utils/excelExport';
import T from '../../utils/toast';
import { 
    Download, Printer, Search, CheckCircle2, AlertCircle, 
    Calendar, Filter, Eye, Loader2, RotateCcw
} from 'lucide-react';
import Receipt from '../../components/Receipt';
import { formatTransactionNumber } from '../../utils/transactionFormat';
import { 
    ResponsiveContainer, LineChart, Line, AreaChart, Area, 
    BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, 
    CartesianGrid, Tooltip, Legend 
} from 'recharts';
import { 
    startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, subWeeks,
    startOfMonth, endOfMonth, subMonths, startOfQuarter, endOfQuarter, 
    subQuarters, startOfYear, endOfYear, subYears, isWithinInterval, 
    format, parseISO 
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { getUnitModel } from '../../config/unitModels';

/**
 * Résout avec une extrême précision les détails d'un article vendu :
 * Nom, conditionnement (contenant entier vs petite quantité / fraction / déconditionnement),
 * quantité, prix, et impact stock.
 */
const resolveItemDetails = (item, productList) => {
    const product = productList?.find(p => String(p.id) === String(item.id || item.productId));
    const rawQty = Number(item.inputQuantity || item.quantity || 1);
    const qty = isNaN(rawQty) || rawQty <= 0 ? 1 : rawQty;
    const formattedQty = Number.isInteger(qty) ? qty : qty.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
    
    const cf = product && parseFloat(product.conversionFactor) > 0 ? parseFloat(product.conversionFactor) : 1;
    const baseUnit = product?.unit || product?.baseUnit || item.unit || 'Unité';
    const subUnit = product?.bulkUnit || (product ? getUnitModel(product.unit).subUnit : null);
    
    const saleType = (item.type || item.saleType || '').toLowerCase();
    const totalDeduction = item.stockDeduction != null ? Number(item.stockDeduction) : null;
    const unitDeduction = totalDeduction != null && qty > 0 ? (totalDeduction / qty) : null;
    
    let isFraction = false;
    let detailLabel = '';
    let fullConditioningLabel = '';

    // 1. Déconditionnement explicite par emballage (Packaging)
    if (item.packaging?.name) {
        detailLabel = item.packaging.name;
        isFraction = true;
    } else if (item.packagingName) {
        detailLabel = item.packagingName;
        isFraction = true;
    } else if (item.label && !['fract.', 'lot', 'pièce', baseUnit.toLowerCase()].includes(item.label.toLowerCase())) {
        detailLabel = item.label;
        isFraction = true;
    }

    // 2. Si le type est packaging ou vente fractionnée
    if ((saleType === 'packaging' || isFraction) && !detailLabel && product) {
        isFraction = true;
        // Recherche dans les packagings configurés sur le produit
        if (Array.isArray(product.packagings) && product.packagings.length > 0) {
            let matchedPkg = null;
            if (unitDeduction != null) {
                matchedPkg = product.packagings.find(pkg => {
                    const pkgRatio = pkg.targetQty && cf > 0 
                        ? (parseFloat(pkg.targetQty) / cf) 
                        : parseFloat(pkg.deductionRatio);
                    return Math.abs(pkgRatio - unitDeduction) < 0.005;
                });
            }
            if (!matchedPkg && item.price) {
                matchedPkg = product.packagings.find(pkg => Math.abs(parseFloat(pkg.price) - parseFloat(item.price)) < 1);
            }
            if (matchedPkg) {
                detailLabel = matchedPkg.name;
            }
        }
        
        // Si toujours non résolu mais conversionFactor > 1 et unitDeduction existe
        if (!detailLabel && unitDeduction != null && cf > 1 && subUnit) {
            const calculatedSubUnits = Math.round(unitDeduction * cf * 100) / 100;
            detailLabel = `${calculatedSubUnits} ${subUnit}`;
        }
    }

    // 3. Vente à la pièce
    if (saleType === 'piece') {
        isFraction = true;
        detailLabel = subUnit || 'Pièce';
        fullConditioningLabel = `À la pièce (${subUnit || 'Pièce'})`;
    } 
    // 4. Vente en lot
    else if (saleType === 'lot') {
        isFraction = true;
        const lotQty = product?.retailStepQuantity || 10;
        detailLabel = `Lot de ${lotQty} ${subUnit || 'Pièces'}`.trim();
        fullConditioningLabel = `Vente par lot (${lotQty} ${subUnit || 'Pièces'})`;
    }
    // 5. Détection mathématique de fraction par déduction de stock
    else if (!isFraction && unitDeduction != null && cf > 1 && unitDeduction < 0.99) {
        isFraction = true;
        const calculatedSubUnits = Math.round(unitDeduction * cf * 100) / 100;
        detailLabel = `${calculatedSubUnits} ${subUnit || ''}`.trim();
        fullConditioningLabel = `Petite quantité (${calculatedSubUnits} ${subUnit || ''})`.trim();
    }

    // Si ce n'est pas une fraction, c'est le contenant standard entier (Sac de ciment entier, Pot, Seau, etc.)
    if (!isFraction) {
        fullConditioningLabel = `${baseUnit} (Entier)`;
    } else if (!fullConditioningLabel) {
        fullConditioningLabel = detailLabel;
    }

    const price = item.price != null ? Number(item.price) : (item.isBulk ? item.bulkPrice : (product?.price || 0));
    const totalPrice = item.totalPrice != null ? Number(item.totalPrice) : (qty * price);

    return {
        productName: item.name || product?.name || 'Article',
        quantity: qty,
        formattedQty,
        isFraction,
        detailLabel, // Ex: "15 Litre", "15 Kilo"
        fullConditioningLabel, // Ex: "Sac de ciment (Entier)" ou "15 Litre"
        baseUnit,
        subUnit,
        price,
        totalPrice,
        totalDeduction: totalDeduction != null ? totalDeduction : (isFraction && cf > 1 ? (qty * (unitDeduction || 1)) : qty),
        conversionFactor: cf
    };
};

const SalesPerformance = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { transactions, isLoadingSales } = useSales();
    const { products } = useInventory();
    const { currentStoreId } = useSettings();
    const { user } = useAuth();

    // Périodes demandées : Jour, Hebdomadaire, Mensuelle, Trimestrielle, Annuelle
    const [period, setPeriod] = useState('day'); // 'day', 'week', 'month', 'quarter', 'year', 'custom'
    const [customStartDate, setCustomStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
    const [customEndDate, setCustomEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [chartMetric, setChartMetric] = useState('both'); // 'revenue', 'margin', 'both'
    const [topProductsMetric, setTopProductsMetric] = useState('revenue'); // 'revenue', 'quantity'
    const [searchTerm, setSearchTerm] = useState('');
    const [paymentFilter, setPaymentFilter] = useState('all');
    const [saleTypeFilter, setSaleTypeFilter] = useState('all');
    const [cashierFilter, setCashierFilter] = useState('all');
    const [sortBy, setSortBy] = useState('newest');
    const [isLoading, setIsLoading] = useState(true);
    const [filterLoading, setFilterLoading] = useState(false);
    const filterTimerRef = useRef(null);
    const [viewingTransaction, setViewingTransaction] = useState(null);
    const [receiptLoading, setReceiptLoading] = useState(false);
    const [hoveredArticleTooltip, setHoveredArticleTooltip] = useState(null);
    const tooltipCloseTimerRef = useRef(null);
    const [highlightSalesTable, setHighlightSalesTable] = useState(false);
    const highlightTimerRef = useRef(null);

    const handleArticleMouseEnter = (e, transaction) => {
        if (tooltipCloseTimerRef.current) {
            clearTimeout(tooltipCloseTimerRef.current);
            tooltipCloseTimerRef.current = null;
        }
        const rect = e.currentTarget.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const openAbove = spaceBelow < 260 && rect.top > 260;
        const leftPos = Math.max(12, Math.min(rect.left, window.innerWidth - 360));

        setHoveredArticleTooltip({
            transaction,
            coords: {
                top: openAbove ? undefined : rect.bottom + 2,
                bottom: openAbove ? (window.innerHeight - rect.top + 2) : undefined,
                left: leftPos
            }
        });
    };

    const handleArticleMouseLeave = () => {
        tooltipCloseTimerRef.current = setTimeout(() => {
            setHoveredArticleTooltip(null);
        }, 250);
    };

    const handleTooltipMouseEnter = () => {
        if (tooltipCloseTimerRef.current) {
            clearTimeout(tooltipCloseTimerRef.current);
            tooltipCloseTimerRef.current = null;
        }
    };

    const handleTooltipMouseLeave = () => {
        tooltipCloseTimerRef.current = setTimeout(() => {
            setHoveredArticleTooltip(null);
        }, 200);
    };

    useEffect(() => {
        const handleScroll = (e) => {
            if (e.target && e.target.closest && e.target.closest('#article-tooltip-card')) {
                return;
            }
            if (hoveredArticleTooltip) {
                setHoveredArticleTooltip(null);
            }
        };
        window.addEventListener('scroll', handleScroll, true);
        return () => {
            window.removeEventListener('scroll', handleScroll, true);
            if (tooltipCloseTimerRef.current) clearTimeout(tooltipCloseTimerRef.current);
        };
    }, [hoveredArticleTooltip]);

    const handleFilterChange = (setter, value) => {
        setFilterLoading(true);
        setter(value);
        if (filterTimerRef.current) clearTimeout(filterTimerRef.current);
        filterTimerRef.current = setTimeout(() => {
            setFilterLoading(false);
        }, 1500); // Au moins 1,5 seconde, identique à Réapprovisionnement Intelligent
    };

    useEffect(() => {
        return () => {
            if (filterTimerRef.current) clearTimeout(filterTimerRef.current);
        };
    }, []);

    const handleViewReceipt = (t) => {
        setReceiptLoading(true);
        setTimeout(() => {
            setReceiptLoading(false);
            setViewingTransaction(t);
        }, 2000);
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsLoading(false);
        }, 550);
        return () => clearTimeout(timer);
    }, []);

    // Synchronisation de la période depuis l'URL si demandée (ex: depuis le Dashboard)
    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        const urlPeriod = searchParams.get('period');
        if (urlPeriod && ['day', 'week', 'month', 'quarter', 'year', 'custom'].includes(urlPeriod)) {
            setPeriod(urlPeriod);
        }
    }, [location.search]);

    // Défilement automatique et encadrement orange pendant 5 secondes lors d'un clic depuis le Dashboard
    useEffect(() => {
        if (!isLoading && !isLoadingSales) {
            const hasScroll = location.hash === '#tableau-ventes-realisees' || 
                              location.search.includes('scroll=sales-table');
            if (hasScroll) {
                setHighlightSalesTable(true);
                const scrollTimer = setTimeout(() => {
                    const el = document.getElementById('tableau-ventes-realisees');
                    if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }, 200);

                if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
                highlightTimerRef.current = setTimeout(() => {
                    setHighlightSalesTable(false);
                }, 5000); // Encadrement orange pendant exactement 5 secondes

                return () => {
                    clearTimeout(scrollTimer);
                    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
                };
            }
        }
    }, [isLoading, isLoadingSales, location.hash, location.search]);

    useEffect(() => {
        return () => {
            if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
        };
    }, []);

    // Résolution des intervalles temporels
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
        const completedOnly = transactions.filter(t => t.status !== 'canceled');

        const curr = completedOnly.filter(t => {
            const date = new Date(t.date || t.transactionDate);
            return isWithinInterval(date, currentRange);
        });

        const prev = completedOnly.filter(t => {
            const date = new Date(t.date || t.transactionDate);
            return isWithinInterval(date, previousRange);
        });

        return { currentPeriodTx: curr, prevPeriodTx: prev };
    }, [transactions, currentRange, previousRange]);

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

    // Calcul des KPI globaux
    const stats = useMemo(() => {
        const revenue = currentPeriodTx.reduce((sum, t) => sum + (Number(t.total) || 0), 0);
        const margin = currentPeriodTx.reduce((sum, t) => sum + calculateTxMargin(t), 0);
        const ordersCount = currentPeriodTx.length;
        const avgTicket = ordersCount > 0 ? revenue / ordersCount : 0;
        const marginRate = revenue > 0 ? (margin / revenue) * 100 : 0;
        const totalItemsCount = currentPeriodTx.reduce((sum, t) => {
            return sum + (t.items || []).reduce((iSum, item) => iSum + (Number(item.inputQuantity) || Number(item.quantity) || 1), 0);
        }, 0);

        const prevRevenue = prevPeriodTx.reduce((sum, t) => sum + (Number(t.total) || 0), 0);
        const prevMargin = prevPeriodTx.reduce((sum, t) => sum + calculateTxMargin(t), 0);
        const prevOrdersCount = prevPeriodTx.length;
        const prevAvgTicket = prevOrdersCount > 0 ? prevRevenue / prevOrdersCount : 0;

        const calcGrowth = (curr, prev) => {
            if (prev === 0) return curr > 0 ? 100 : 0;
            return ((curr - prev) / prev) * 100;
        };

        return {
            revenue,
            revenueGrowth: calcGrowth(revenue, prevRevenue),

            margin,
            marginGrowth: calcGrowth(margin, prevMargin),

            ordersCount,
            ordersGrowth: calcGrowth(ordersCount, prevOrdersCount),

            avgTicket,
            avgTicketGrowth: calcGrowth(avgTicket, prevAvgTicket),

            marginRate,
            totalItemsCount
        };
    }, [currentPeriodTx, prevPeriodTx, products]);

    // Données pour le graphique d'évolution
    const timelineData = useMemo(() => {
        if (period === 'day') {
            // Cycle complet des 24 heures de la journée (de 00h à 23h)
            const hours = Array.from({ length: 24 }, (_, i) => i);
            return hours.map(hour => {
                const label = `${hour.toString().padStart(2, '0')}h`;
                const txInHour = currentPeriodTx.filter(t => {
                    const d = new Date(t.date || t.transactionDate);
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
                    const d = new Date(t.date || t.transactionDate);
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
                    const date = new Date(t.date || t.transactionDate);
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
                    const d = new Date(t.date || t.transactionDate);
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

        // Personnalisé
        const daysMap = {};
        currentPeriodTx.forEach(t => {
            const d = new Date(t.date || t.transactionDate);
            const key = format(d, 'dd/MM');
            if (!daysMap[key]) daysMap[key] = { label: key, revenue: 0, margin: 0, count: 0 };
            daysMap[key].revenue += Number(t.total) || 0;
            daysMap[key].margin += calculateTxMargin(t);
            daysMap[key].count += 1;
        });

        return Object.values(daysMap);
    }, [period, currentPeriodTx, currentRange, products]);

    // Répartition par mode de paiement
    const paymentMethodsData = useMemo(() => {
        const KABLLIX_ORANGE = '#f77500'; // Couleur exacte du point sur le 'i' du logo Kabllix
        const methods = {
            cash: { name: 'Espèces (Cash)', total: 0, count: 0, color: KABLLIX_ORANGE },
            wave: { name: 'Wave / Mobile Money', total: 0, count: 0, color: '#001d35' },
            bank_transfer: { name: 'Virement Bancaire', total: 0, count: 0, color: '#0284c7' },
            check: { name: 'Chèque', total: 0, count: 0, color: '#7c3aed' },
            credit: { name: 'Vente à Crédit', total: 0, count: 0, color: '#dc2626' },
            other: { name: 'Autre mode', total: 0, count: 0, color: '#64748b' }
        };

        currentPeriodTx.forEach(t => {
            const rawMethod = (t.paymentMethod || 'cash').toLowerCase();
            let key = 'other';
            if (rawMethod.includes('cash') || rawMethod.includes('espece') || rawMethod.includes('esp')) key = 'cash';
            else if (rawMethod.includes('wave') || rawMethod.includes('mobile') || rawMethod.includes('orange') || rawMethod.includes('momo')) key = 'wave';
            else if (rawMethod.includes('virement') || rawMethod.includes('bank')) key = 'bank_transfer';
            else if (rawMethod.includes('cheque') || rawMethod.includes('chèque')) key = 'check';
            else if (rawMethod.includes('credit') || rawMethod.includes('crédit')) key = 'credit';

            methods[key].total += Number(t.total) || 0;
            methods[key].count += 1;
        });

        const totalRev = stats.revenue || 1;
        const list = Object.values(methods)
            .filter(m => m.total > 0)
            .sort((a, b) => b.total - a.total);

        // Si une seule méthode de paiement est active, elle prend la couleur du point sur le 'i' (#f77500)
        if (list.length === 1) {
            list[0].color = KABLLIX_ORANGE;
        }

        return list.map(m => ({
            ...m,
            percentage: ((m.total / totalRev) * 100).toFixed(1)
        }));
    }, [currentPeriodTx, stats.revenue]);

    // Top Produits
    const topProducts = useMemo(() => {
        const map = {};

        currentPeriodTx.forEach(t => {
            (t.items || []).forEach(item => {
                const id = item.id || item.productId;
                if (!id) return;

                if (!map[id]) {
                    const prod = products.find(p => p.id === id);
                    map[id] = {
                        id,
                        name: item.name || prod?.name || 'Produit Inconnu',
                        category: prod?.category || 'Quincaillerie',
                        quantity: 0,
                        revenue: 0,
                        margin: 0,
                        unit: item.unit || prod?.baseUnit || 'Unité'
                    };
                }

                const qty = Number(item.inputQuantity) || Number(item.quantity) || 1;
                const rev = item.totalPrice != null
                    ? Number(item.totalPrice)
                    : (item.price || 0) * qty;

                const product = products.find(p => p.id === id);
                const cf = product && parseFloat(product.conversionFactor) > 0 ? parseFloat(product.conversionFactor) : 1;
                const isFractional = item.type === 'packaging' || item.type === 'lot';
                let deductedQty = item.stockDeduction;
                if (deductedQty == null) {
                    deductedQty = isFractional && cf > 1 ? qty / cf : qty;
                }
                const basicPurchase = product && product.purchasePrice != null
                    ? Number(product.purchasePrice)
                    : (rev / Math.max(0.0001, deductedQty)) * 0.8;
                const cost = basicPurchase * deductedQty;

                map[id].quantity += qty;
                map[id].revenue += rev;
                map[id].margin += (rev - cost);
            });
        });

        const list = Object.values(map);
        if (topProductsMetric === 'revenue') {
            return list.sort((a, b) => b.revenue - a.revenue).slice(0, 10);
        } else {
            return list.sort((a, b) => b.quantity - a.quantity).slice(0, 10);
        }
    }, [currentPeriodTx, products, topProductsMetric]);

    // Liste unique des caissiers / vendeurs de la période
    const availableCashiers = useMemo(() => {
        const set = new Set();
        currentPeriodTx.forEach(t => {
            const name = t.cashier || t.cashierName;
            if (name && typeof name === 'string' && name.trim()) {
                set.add(name.trim());
            }
        });
        return Array.from(set).sort();
    }, [currentPeriodTx]);

    // Transactions filtrées
    const filteredTransactionsList = useMemo(() => {
        return currentPeriodTx
            .filter(t => {
                if (paymentFilter !== 'all') {
                    const rawMethod = (t.paymentMethod || '').toLowerCase();
                    if (paymentFilter === 'cash' && !rawMethod.includes('cash') && !rawMethod.includes('espece')) return false;
                    if (paymentFilter === 'wave' && !rawMethod.includes('wave') && !rawMethod.includes('mobile')) return false;
                    if (paymentFilter === 'credit' && !rawMethod.includes('credit') && !rawMethod.includes('crédit')) return false;
                    if (paymentFilter === 'bank_transfer' && !rawMethod.includes('virement') && !rawMethod.includes('bank')) return false;
                    if (paymentFilter === 'check' && !rawMethod.includes('cheque') && !rawMethod.includes('chèque')) return false;
                }
                if (saleTypeFilter !== 'all') {
                    const hasFraction = (t.items || []).some(item => {
                        const d = resolveItemDetails(item, products);
                        return d.isFraction;
                    });
                    if (saleTypeFilter === 'fraction' && !hasFraction) return false;
                    if (saleTypeFilter === 'base' && hasFraction) return false;
                }
                if (cashierFilter !== 'all') {
                    const cName = String(t.cashier || t.cashierName || '').toLowerCase();
                    if (!cName.includes(cashierFilter.toLowerCase())) return false;
                }
                if (!searchTerm) return true;
                const term = searchTerm.toLowerCase();
                const idMatch = String(t.id).toLowerCase().includes(term);
                const refMatch = formatTransactionNumber(t, 'REC').toLowerCase().includes(term);
                const itemMatch = (t.items || []).some(i => (i.name || '').toLowerCase().includes(term));
                const cashierMatch = String(t.cashier || t.cashierName || '').toLowerCase().includes(term);
                const paymentMatch = String(t.paymentMethod || '').toLowerCase().includes(term);
                return idMatch || refMatch || itemMatch || cashierMatch || paymentMatch;
            })
            .sort((a, b) => {
                if (sortBy === 'amount_desc') return (Number(b.total) || 0) - (Number(a.total) || 0);
                if (sortBy === 'amount_asc') return (Number(a.total) || 0) - (Number(b.total) || 0);
                if (sortBy === 'margin_desc') return calculateTxMargin(b) - calculateTxMargin(a);
                if (sortBy === 'oldest') return new Date(a.date || a.transactionDate) - new Date(b.date || b.transactionDate);
                return new Date(b.date || b.transactionDate) - new Date(a.date || a.transactionDate);
            });
    }, [currentPeriodTx, paymentFilter, saleTypeFilter, cashierFilter, sortBy, searchTerm, products]);

    // Total général du journal des ventes (toutes les entrées filtrées de la période)
    const journalTotals = useMemo(() => {
        const revenue = filteredTransactionsList.reduce((sum, t) => sum + (Number(t.total) || 0), 0);
        const margin = filteredTransactionsList.reduce((sum, t) => sum + calculateTxMargin(t), 0);
        return { revenue, margin };
    }, [filteredTransactionsList, products]);

    // Composant StatCard respectant à 100% le Dashboard (Écran) et ultra-compact/sobre (Impression)
    const StatCard = ({ title, value, isCurrency, subtitle, iconUrl, growth }) => {
        const isPositive = growth >= 0;

        return (
            <div className="bg-white p-3 print:p-2 rounded-sm border-2 border-gray-300 print:border print:border-gray-400 shadow-sm print:shadow-none relative group hover:shadow-md transition-shadow overflow-hidden min-h-[120px] print:min-h-0 flex flex-col justify-center">
                {filterLoading ? (
                    <div className="flex flex-col items-center justify-center py-4 print:hidden">
                        <div className="relative h-8 w-8">
                            <div className="absolute inset-0 animate-spin rounded-full border-2 border-t-transparent border-[#001d35]"></div>
                            <div className="absolute inset-1 animate-spin-reverse rounded-full border-2 border-b-transparent border-[#f77500]"></div>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex justify-between items-start relative z-10">
                            <div className="flex-1">
                                <div className="flex items-center gap-1.5">
                                    <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-blue-600/70 print:text-gray-700 print:text-[10px] print:font-bold">{title}</p>
                                </div>
                                <div className="flex items-baseline mt-2 print:mt-1 font-semibold opacity-85" style={{ color: '#001d35', opacity: 0.85 }}>
                                    <h3 className="text-xl sm:text-2xl print:text-base font-semibold print:font-bold">
                                        {isCurrency ? formatPrice(value) : value}
                                    </h3>
                                </div>
                                {subtitle && (
                                    <p className="text-xs text-gray-400 mt-2 font-medium print:hidden">{subtitle}</p>
                                )}
                            </div>
                        </div>

                        {/* Background 3D Illustration - Masqué à l'impression */}
                        {iconUrl && (
                            <img
                                src={iconUrl}
                                alt=""
                                crossOrigin="anonymous"
                                className="absolute bottom-2 right-2 w-16 h-16 opacity-30 group-hover:opacity-50 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-700 pointer-events-none print:hidden"
                            />
                        )}

                        {growth !== undefined && (
                            <div className="mt-3 flex items-center text-sm z-10 print:hidden">
                                <i className={`uil ${isPositive ? 'uil-arrow-growth text-green-500' : 'uil-arrow-down-right text-red-500'} mr-1 text-lg`}></i>
                                <span className={`${isPositive ? 'text-green-500' : 'text-red-500'} font-medium`}>
                                    {isPositive ? '+' : ''}{growth.toFixed(1)}%
                                </span>
                                <span className="text-gray-400 ml-1 text-xs">vs {prevPeriodLabel}</span>
                            </div>
                        )}
                    </>
                )}
            </div>
        );
    };

    // Export Excel
    const exportExcel = () => {
        if (currentPeriodTx.length === 0) {
            T.warning("Aucune vente sur la période à exporter.");
            return;
        }
        const rows = currentPeriodTx.map(t => ({
            'ID Vente': t.id,
            'Date': format(new Date(t.date || t.transactionDate), 'dd/MM/yyyy HH:mm'),
            'Mode de Règlement': t.paymentMethod || 'Espèces',
            'Montant TTC': t.total,
            'Marge Réalisée': Math.round(calculateTxMargin(t)),
            'Articles': (t.items || []).map(i => `${i.name} (x${i.inputQuantity || i.quantity || 1})`).join('; ')
        }));

        const filename = `Performances_Ventes_${period}_${format(new Date(), 'yyyy-MM-dd')}`;
        exportToExcel(rows, filename, 'Performances Ventes');
        T.export(`${rows.length} vente(s) exportée(s) au format Excel (.xlsx)`);
    };

    if (isLoading || isLoadingSales) {
        return (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[200] p-4 animate-in fade-in duration-150">
                <div className="bg-white rounded-[4px] p-6 shadow-2xl border-2 border-[#001d35] flex flex-col items-center max-w-sm text-center">
                    <div className="relative h-12 w-12 mb-3">
                        <div className="absolute inset-0 animate-spin rounded-full border-4 border-gray-200 border-t-[#001d35]"></div>
                        <div className="absolute inset-2 animate-spin-reverse rounded-full border-2 border-transparent border-b-[#f77500]"></div>
                    </div>
                    <h4 className="text-sm font-semibold text-[#001d35] uppercase tracking-wider">
                        Chargement des performances...
                    </h4>
                    <p className="text-xs text-gray-600 mt-1 font-medium">
                        Analyse des données et calcul des marges
                    </p>
                </div>
            </div>
        );
    }

    return (
        <>
        <div className="space-y-4 print:space-y-2 w-full max-w-full min-w-0 overflow-x-hidden">
            {/* ─── EN-TÊTE SOBRE ET COMPACT DÉDIÉ À L'IMPRESSION ─── */}
            <div className="hidden print:flex items-center justify-between pb-2 mb-2 border-b border-gray-400">
                <div>
                    <h1 className="text-base font-black text-[#001d35] tracking-tight uppercase">
                        KABLLIX — Rapport des Performances Commerciales & Financières
                    </h1>
                    <p className="text-[11px] text-gray-600 font-medium">
                        Période analysée : <strong className="text-gray-900">{periodLabel}</strong>
                    </p>
                </div>
                <div className="text-right text-[10px] text-gray-500">
                    <p>Édité le : {format(new Date(), 'dd/MM/yyyy à HH:mm')}</p>
                    <p>Utilisateur : {user?.name || user?.email || 'Gestionnaire'}</p>
                </div>
            </div>

            {/* ─── EN-TÊTE ÉCRAN : Titre et Sélecteur de Période (Masqué à l'impression) ─── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
                <div>
                    <h2 className="text-2xl font-bold text-[#001d35] tracking-tight">Performances des Ventes</h2>
                    <p className="text-gray-500 text-sm mt-1 font-medium">Analyses commerciales et financières pour Gestionnaires & Propriétaires</p>
                </div>

                {/* Boutons Actions Rapides */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={exportExcel}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-sm border-2 border-gray-300 bg-white hover:bg-gray-50 text-[#001d35] transition-all cursor-pointer shadow-sm"
                        title="Exporter au format Excel (.xlsx)"
                    >
                        <Download className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Exporter Excel</span>
                    </button>
                    <button
                        onClick={() => window.print()}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-sm bg-[#001d35] hover:bg-[#00284a] text-white transition-all cursor-pointer shadow-sm"
                        title="Imprimer le bilan des performances"
                    >
                        <Printer className="w-3.5 h-3.5 text-[#f77500]" />
                        <span>Imprimer</span>
                    </button>
                </div>
            </div>

            {/* ─── BARRE DES ONGLETS DE PÉRIODE (Masquée à l'impression) ─── */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2.5 rounded-sm border-2 border-gray-300 shadow-sm print:hidden">
                <div className="flex items-center gap-1 bg-gray-100/80 p-1 rounded-sm border-2 border-gray-300">
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

            {/* ─── 3 CARTES KPI PRINCIPALES (DESIGN 100% DASHBOARD EN ÉCRAN, SOBRE & COMPACT EN IMPRESSION) ─── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 print:grid-cols-3 print:gap-2 w-full min-w-0">
                <StatCard
                    title="Chiffre d'Affaires"
                    value={stats.revenue}
                    isCurrency={true}
                    iconUrl="/icons8/fluency_240_banknotes.png"
                    growth={stats.revenueGrowth}
                    subtitle={`Total encaissé sur ${periodLabel.toLowerCase()}`}
                />
                <StatCard
                    title="Marge Brute Réelle"
                    value={stats.margin}
                    isCurrency={true}
                    iconUrl="/icons8/fluency_240_bullish.png"
                    growth={stats.marginGrowth}
                    subtitle={`Taux de marge moyen : ${stats.marginRate.toFixed(1)}%`}
                />
                <StatCard
                    title="Nombre de Ventes"
                    value={`${stats.ordersCount} tickets`}
                    iconUrl="/icons8/fluency_240_shopping-cart.png"
                    growth={stats.ordersGrowth}
                    subtitle={`${stats.totalItemsCount} articles vendus`}
                />

            </div>

            {/* ─── SECTION GRAPHIQUE ÉVOLUTION DES VENTES (STYLE DASHBOARD) ─── */}
            <div className="bg-white p-3 print:p-2 rounded-sm border-2 border-gray-300 print:border print:border-gray-400 shadow-sm print:shadow-none relative overflow-hidden w-full min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-gray-200 gap-3">
                    <div>
                        <h3 className="text-sm font-semibold tracking-wide uppercase text-[11px] text-blue-600/70">
                            Évolution des Ventes & Marges
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {periodLabel} — Total Ventes : {formatPrice(stats.revenue)} &bull; Marge : {formatPrice(stats.margin)}
                        </p>
                    </div>

                    {/* Sélecteur de courbe (Masqué à l'impression) */}
                    <div className="flex items-center gap-1 bg-gray-100/80 p-0.5 rounded-sm border-2 border-gray-300 self-start sm:self-auto print:hidden">
                        <button
                            onClick={() => setChartMetric('both')}
                            className={`px-2.5 py-1 text-xs font-bold rounded-sm transition-all cursor-pointer ${
                                chartMetric === 'both'
                                    ? 'bg-[#001d35] text-white shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                            }`}
                        >
                            Les Deux
                        </button>
                        <button
                            onClick={() => setChartMetric('revenue')}
                            className={`px-2.5 py-1 text-xs font-bold rounded-sm transition-all cursor-pointer ${
                                chartMetric === 'revenue'
                                    ? 'bg-[#001d35] text-white shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                            }`}
                        >
                            Ventes
                        </button>
                        <button
                            onClick={() => setChartMetric('margin')}
                            className={`px-2.5 py-1 text-xs font-bold rounded-sm transition-all cursor-pointer ${
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
                    {filterLoading ? (
                        <div className="h-64 flex flex-col items-center justify-center bg-white animate-in fade-in duration-150">
                            <div className="relative h-10 w-10">
                                <div className="absolute inset-0 animate-spin rounded-full border-4 border-gray-200 border-t-[#001d35]"></div>
                                <div className="absolute inset-1.5 animate-spin-reverse rounded-full border-2 border-transparent border-b-[#f77500]"></div>
                            </div>
                            <p className="text-xs font-semibold text-[#001d35] mt-3 uppercase tracking-wider">
                                Calcul de l'évolution des ventes...
                            </p>
                        </div>
                    ) : timelineData.length === 0 ? (
                        <div className="h-64 flex flex-col items-center justify-center text-gray-400">
                            <AlertCircle className="w-8 h-8 mb-2 stroke-[1.5]" />
                            <p className="text-xs font-semibold">Aucune vente enregistrée sur cette période</p>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={260}>
                            <AreaChart data={timelineData} margin={{ top: 10, right: 15, left: 0, bottom: 40 }}>
                                <defs>
                                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#001d35" stopOpacity={0.25} />
                                        <stop offset="95%" stopColor="#001d35" stopOpacity={0.0} />
                                    </linearGradient>
                                    <linearGradient id="colorMargin" x1="0" y1="0" x2="0" y2="1">
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
                                        fill="url(#colorSales)"
                                    />
                                )}
                                {(chartMetric === 'both' || chartMetric === 'margin') && (
                                    <Area
                                        type="monotone"
                                        dataKey="margin"
                                        stroke="#f77500"
                                        strokeWidth={2.5}
                                        fillOpacity={1}
                                        fill="url(#colorMargin)"
                                    />
                                )}
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            {/* ─── SECTION 2 : RÉPARTITION PAR PAIEMENT ET TOP PRODUITS (2-col) ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 print:grid-cols-2 print:gap-2 w-full min-w-0">
                {/* 1. Canaux de Paiement */}
                <div className="bg-white p-3 print:p-2 rounded-[4px] border-2 border-gray-300 print:border print:border-gray-400 shadow-sm print:shadow-none flex flex-col w-full min-w-0 overflow-hidden">
                    <h3 className="text-sm font-semibold tracking-wide uppercase text-[11px] text-blue-600/70">
                        Canaux de Paiement
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5 mb-3">Encaissements par mode de règlement</p>

                    {paymentMethodsData.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center">
                            <p className="text-xs text-gray-400">Aucun paiement enregistré</p>
                        </div>
                    ) : (
                        <>
                            <ResponsiveContainer width="100%" height={180}>
                                <PieChart>
                                    <Pie
                                        data={paymentMethodsData}
                                        dataKey="total"
                                        nameKey="name"
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={45}
                                        outerRadius={72}
                                        paddingAngle={3}
                                    >
                                        {paymentMethodsData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip 
                                        formatter={(value) => formatPrice(value)}
                                        contentStyle={{ borderRadius: '4px', border: '1px solid #e5e7eb', fontSize: '11px' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>

                            <div className="space-y-1.5 pt-3 mt-1 border-t border-gray-200">
                                {paymentMethodsData.map((method, idx) => (
                                    <div key={idx} className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2.5 h-2.5 rounded-[4px] flex-shrink-0" style={{ backgroundColor: method.color }} />
                                            <span className="font-semibold text-gray-700">{method.name}</span>
                                        </div>
                                        <div className="text-right whitespace-nowrap">
                                            <span className="font-bold text-[#001d35]">{formatPrice(method.total)}</span>
                                            <span className="text-gray-400 ml-1 font-medium">({method.percentage}%)</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* 2. Top Produits — BarChart horizontal */}
                <div className="bg-white p-3 print:p-2 rounded-sm border-2 border-gray-300 print:border print:border-gray-400 shadow-sm print:shadow-none flex flex-col w-full min-w-0 overflow-hidden">
                    <div className="flex items-center justify-between pb-2 border-b border-gray-200 mb-3">
                        <div>
                            <h3 className="text-sm font-semibold tracking-wide uppercase text-[11px] text-blue-600/70">
                                Top Produits les Plus Performants
                            </h3>
                            <p className="text-xs text-gray-500 mt-0.5">Palmarès des ventes de la quincaillerie</p>
                        </div>
                        <div className="flex items-center gap-1 bg-gray-100/80 p-0.5 rounded-sm border-2 border-gray-300 print:hidden">
                            <button
                                onClick={() => setTopProductsMetric('revenue')}
                                className={`px-2.5 py-1 text-xs font-bold rounded-sm transition-all cursor-pointer ${
                                    topProductsMetric === 'revenue'
                                        ? 'bg-[#001d35] text-white shadow-sm'
                                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                                }`}
                            >
                                Par C.A.
                            </button>
                            <button
                                onClick={() => setTopProductsMetric('quantity')}
                                className={`px-2.5 py-1 text-xs font-bold rounded-sm transition-all cursor-pointer ${
                                    topProductsMetric === 'quantity'
                                        ? 'bg-[#001d35] text-white shadow-sm'
                                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                                }`}
                            >
                                Par Volume
                            </button>
                        </div>
                    </div>

                    {filterLoading ? (
                        <div className="h-64 flex flex-col items-center justify-center bg-white animate-in fade-in duration-150">
                            <div className="relative h-10 w-10">
                                <div className="absolute inset-0 animate-spin rounded-full border-4 border-gray-200 border-t-[#001d35]"></div>
                                <div className="absolute inset-1.5 animate-spin-reverse rounded-full border-2 border-transparent border-b-[#f77500]"></div>
                            </div>
                            <p className="text-xs font-semibold text-[#001d35] mt-3 uppercase tracking-wider">
                                Classement des articles phares...
                            </p>
                        </div>
                    ) : topProducts.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center">
                            <p className="text-xs text-gray-400 font-medium">Aucune vente sur cette période</p>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={260}>
                            <BarChart
                                layout="vertical"
                                data={topProducts.slice(0, 7).map(p => ({
                                    name: p.name.length > 22 ? p.name.slice(0, 22) + '…' : p.name,
                                    value: topProductsMetric === 'revenue' ? p.revenue : p.quantity,
                                    fullName: p.name
                                }))}
                                margin={{ top: 0, right: 12, left: 0, bottom: 0 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                                <XAxis
                                    type="number"
                                    stroke="#6b7280"
                                    fontSize={10}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(v) => topProductsMetric === 'revenue'
                                        ? (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`)
                                        : v.toLocaleString('fr-FR')
                                    }
                                />
                                <YAxis
                                    type="category"
                                    dataKey="name"
                                    stroke="#6b7280"
                                    fontSize={10}
                                    tickLine={false}
                                    axisLine={false}
                                    width={110}
                                />
                                <Tooltip
                                    contentStyle={{ borderRadius: '4px', border: '1px solid #e5e7eb', fontSize: '11px' }}
                                    formatter={(value, name, props) => [
                                        topProductsMetric === 'revenue' ? formatPrice(value) : `${value.toLocaleString('fr-FR')} unités`,
                                        props.payload.fullName
                                    ]}
                                    cursor={{ fill: '#f3f4f6' }}
                                />
                                <Bar dataKey="value" fill="#001d35" radius={[0, 4, 4, 0]} maxBarSize={22} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            {/* ─── SECTION 3 : REGISTRE DÉTAILLÉ DES VENTES DE LA PÉRIODE ─── */}
            <div
                id="tableau-ventes-realisees"
                className="bg-white p-3 print:p-2 rounded-[4px] border-2 border-gray-300 print:border print:border-gray-400 shadow-sm print:shadow-none w-full min-w-0 overflow-hidden scroll-mt-6"
            >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-gray-200 gap-3">
                    <div>
                        <h3 className="text-sm font-semibold tracking-wide uppercase text-[11px] text-blue-600/70">
                            Journal des Ventes ({filteredTransactionsList.length} transactions)
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">Détail des règlements validés sur {periodLabel.toLowerCase()}</p>
                    </div>

                    {/* Filtres de recherche et de tri (Masqué à l'impression) */}
                    <div className="flex flex-wrap items-center gap-2 print:hidden">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700 mr-0.5 bg-gray-100 px-2 py-1 rounded-[4px] border border-gray-200">
                            <Filter className="w-3.5 h-3.5 text-[#f77500]" />
                            <span>Filtrer par :</span>
                        </div>

                        <div className="relative">
                            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Rechercher ticket, réf, article..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-8 pr-2.5 py-1 text-xs bg-gray-50 border border-gray-300 rounded-[4px] focus:outline-none focus:ring-1 focus:ring-[#001d35] min-w-[190px]"
                            />
                        </div>

                        <select
                            value={paymentFilter}
                            onChange={(e) => handleFilterChange(setPaymentFilter, e.target.value)}
                            className="text-xs bg-gray-50 border border-gray-300 rounded-[4px] px-2.5 py-1 font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#001d35] cursor-pointer"
                            title="Filtrer par mode de paiement"
                        >
                            <option value="all">Tous paiements</option>
                            <option value="cash">Espèces</option>
                            <option value="wave">Wave / Mobile</option>
                            <option value="credit">Crédit</option>
                            <option value="bank_transfer">Virement</option>
                            <option value="check">Chèque</option>
                        </select>

                        <select
                            value={saleTypeFilter}
                            onChange={(e) => handleFilterChange(setSaleTypeFilter, e.target.value)}
                            className="text-xs bg-gray-50 border border-gray-300 rounded-[4px] px-2.5 py-1 font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#001d35] cursor-pointer"
                            title="Filtrer par conditionnement"
                        >
                            <option value="all">Tous conditionnements</option>
                            <option value="base">Contenants entiers</option>
                            <option value="fraction">Petites quantités / Fractions</option>
                        </select>

                        {availableCashiers.length > 1 && (
                            <select
                                value={cashierFilter}
                                onChange={(e) => handleFilterChange(setCashierFilter, e.target.value)}
                                className="text-xs bg-gray-50 border border-gray-300 rounded-[4px] px-2.5 py-1 font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#001d35] cursor-pointer"
                                title="Filtrer par caissier / vendeur"
                            >
                                <option value="all">Tous caissiers</option>
                                {availableCashiers.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        )}

                        <select
                            value={sortBy}
                            onChange={(e) => handleFilterChange(setSortBy, e.target.value)}
                            className="text-xs bg-gray-50 border border-gray-300 rounded-[4px] px-2.5 py-1 font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#001d35] cursor-pointer"
                            title="Trier la liste"
                        >
                            <option value="newest">Plus récentes</option>
                            <option value="oldest">Plus anciennes</option>
                            <option value="amount_desc">Montant décroissant</option>
                            <option value="amount_asc">Montant croissant</option>
                            <option value="margin_desc">Marge décroissante</option>
                        </select>

                        {(searchTerm || paymentFilter !== 'all' || saleTypeFilter !== 'all' || cashierFilter !== 'all' || sortBy !== 'newest') && (
                            <button
                                type="button"
                                onClick={() => {
                                    setFilterLoading(true);
                                    setSearchTerm('');
                                    setPaymentFilter('all');
                                    setSaleTypeFilter('all');
                                    setCashierFilter('all');
                                    setSortBy('newest');
                                    if (filterTimerRef.current) clearTimeout(filterTimerRef.current);
                                    filterTimerRef.current = setTimeout(() => {
                                        setFilterLoading(false);
                                    }, 1500);
                                }}
                                className="text-[11px] text-[#001d35] hover:text-rose-600 font-semibold underline px-1 py-1 cursor-pointer transition-colors"
                                title="Réinitialiser tous les filtres"
                            >
                                Réinitialiser
                            </button>
                        )}
                    </div>
                </div>

                {/* Encadrement orange 5s depuis le Dashboard — porte uniquement sur le tableau */}
                <div className={`mt-3 w-full min-w-0 overflow-x-auto scrollbar-thin transition-all duration-700 ${
                    highlightSalesTable
                        ? 'rounded-[4px] ring-2 ring-[#f77500] ring-offset-1 shadow-lg shadow-[#f77500]/20'
                        : ''
                }`}>
                    {filterLoading ? (
                        <div className="py-16 flex flex-col items-center justify-center bg-white animate-in fade-in duration-150 min-h-[300px]">
                            <div className="relative h-10 w-10">
                                <div className="absolute inset-0 animate-spin rounded-full border-4 border-gray-200 border-t-[#001d35]"></div>
                                <div className="absolute inset-1.5 animate-spin-reverse rounded-full border-2 border-transparent border-b-[#f77500]"></div>
                            </div>
                            <p className="text-xs font-semibold text-[#001d35] mt-3 uppercase tracking-wider">
                                Filtrage du journal des ventes...
                            </p>
                            <p className="text-[11px] text-gray-500 mt-0.5 font-medium">
                                Actualisation des transactions, montants et marges
                            </p>
                        </div>
                    ) : filteredTransactionsList.length === 0 ? (
                        <div className="py-8 text-center text-gray-400 text-xs font-medium">
                            Aucune transaction trouvée pour ces critères
                        </div>
                    ) : (
                        <table className="w-full text-left text-xs">
                            <thead>
                                <tr className="border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                                    <th className="py-2 px-2 align-bottom">Réf.</th>
                                    <th className="py-2 px-2 align-bottom">Date & Heure</th>
                                    <th className="py-2 px-2 align-bottom">Paiement</th>
                                    <th className="py-2 px-2 align-bottom">Articles</th>
                                    <th className="py-2 px-2 text-right align-bottom">
                                        <span className="inline-block text-sm font-black text-[#001d35] normal-case mb-1 px-2 py-1 bg-blue-50 border border-blue-200 rounded-[4px] shadow-sm">
                                            {formatPrice(journalTotals.revenue)}
                                        </span>
                                        <span className="block mt-0.5">Montant Total</span>
                                    </th>
                                    <th className="py-2 px-2 text-right align-bottom">
                                        <span className={`inline-block text-sm font-black normal-case mb-1 px-2 py-1 border rounded-[4px] shadow-sm ${
                                            journalTotals.margin >= 0 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-rose-700 bg-rose-50 border-rose-200'
                                        }`}>
                                            {formatPrice(journalTotals.margin)}
                                        </span>
                                        <span className="block mt-0.5">Marge Estimée</span>
                                    </th>
                                    <th className="py-2 px-2 text-center align-bottom">Statut</th>
                                    <th className="py-2 px-2 text-center align-bottom print:hidden">Reçu</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredTransactionsList.slice(0, 50).map((t) => {
                                    const margin = calculateTxMargin(t);
                                    const rawMethod = (t.paymentMethod || 'cash').toLowerCase();
                                    const isCredit = rawMethod.includes('credit');
                                    const isWave = rawMethod.includes('wave') || rawMethod.includes('mobile');

                                    return (
                                        <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="py-2 px-2 font-mono font-bold text-gray-700">
                                                {formatTransactionNumber(t, 'REC')}
                                            </td>
                                            <td className="py-2 px-2 text-gray-600">
                                                {format(new Date(t.date || t.transactionDate), 'dd/MM/yyyy HH:mm')}
                                            </td>
                                            <td className="py-2 px-2">
                                                <span className={`inline-block px-1.5 py-0.5 rounded-sm text-[10px] font-bold ${
                                                    isCredit
                                                        ? 'bg-rose-100 text-rose-800'
                                                        : isWave
                                                        ? 'bg-amber-100 text-amber-800'
                                                        : 'bg-emerald-100 text-emerald-800'
                                                }`}>
                                                    {t.paymentMethod || 'Espèces'}
                                                </span>
                                                {t.changeReliquat && t.changeReliquat.amount > 0 && (
                                                    <div className="mt-1">
                                                        <span 
                                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs text-[9px] font-bold bg-amber-50 text-amber-900 border border-amber-300 whitespace-nowrap cursor-help"
                                                            title={`Reliquat de monnaie émis en Bon d'Avoir : ${t.changeReliquat.voucherCode || ''}`}
                                                        >
                                                            🎟️ Reliquat: {formatPrice(t.changeReliquat.amount)}
                                                        </span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="py-2 px-2 max-w-[280px] align-top">
                                                <div 
                                                    className="relative group cursor-help"
                                                    onMouseEnter={(e) => handleArticleMouseEnter(e, t)}
                                                    onMouseLeave={handleArticleMouseLeave}
                                                >
                                                    <div 
                                                        className="line-clamp-2 overflow-hidden text-ellipsis leading-tight"
                                                        style={{
                                                            display: '-webkit-box',
                                                            WebkitLineClamp: 2,
                                                            WebkitBoxOrient: 'vertical',
                                                            overflow: 'hidden'
                                                        }}
                                                    >
                                                        {(t.items || []).map((item, iIdx) => {
                                                            const details = resolveItemDetails(item, products);
                                                            return (
                                                                <span 
                                                                    key={iIdx} 
                                                                    className="inline-block bg-gray-100 text-gray-700 px-1 py-0.5 rounded-sm text-[10px] font-medium mr-1 mb-0.5 align-middle"
                                                                >
                                                                    {details.productName}
                                                                    {details.isFraction && details.detailLabel ? (
                                                                        <span className="text-gray-500 font-semibold ml-0.5">({details.detailLabel})</span>
                                                                    ) : null}
                                                                    <strong className="text-gray-900 ml-1">x{details.formattedQty}</strong>
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-2 px-2 text-right font-bold text-[#001d35]">
                                                {formatPrice(t.total)}
                                            </td>
                                            <td className={`py-2 px-2 text-right font-bold ${
                                                margin >= 0 ? 'text-emerald-600' : 'text-rose-600'
                                            }`}>
                                                {formatPrice(margin)}
                                            </td>
                                            <td className="py-2 px-2 text-center">
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-sm">
                                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                                    Validée
                                                </span>
                                            </td>
                                            <td className="py-2 px-2 text-center print:hidden">
                                                <div className="flex items-center justify-center gap-1">
                                                    <button
                                                        onClick={() => handleViewReceipt(t)}
                                                        title="Voir le reçu"
                                                        className="inline-flex items-center justify-center w-7 h-7 rounded-sm bg-[#001d35]/5 hover:bg-[#001d35]/15 text-[#001d35] transition-colors cursor-pointer"
                                                    >
                                                        <Eye className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => navigate('/sales/returns')}
                                                        title="Effectuer un retour / Avoir"
                                                        className="inline-flex items-center justify-center w-7 h-7 rounded-sm bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors cursor-pointer"
                                                    >
                                                        <RotateCcw className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>

        {/* ── Loader overlay 2s avant d'afficher le reçu (Même loader que Réapprovisionnement Intelligent) ── */}
        {receiptLoading && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[200] p-4 animate-in fade-in duration-150">
                <div className="bg-white rounded-[4px] p-6 shadow-2xl border-2 border-[#001d35] flex flex-col items-center max-w-sm text-center">
                    <div className="relative h-12 w-12 mb-3">
                        <div className="absolute inset-0 animate-spin rounded-full border-4 border-gray-200 border-t-[#001d35]"></div>
                        <div className="absolute inset-2 animate-spin-reverse rounded-full border-2 border-transparent border-b-[#f77500]"></div>
                    </div>
                    <h4 className="text-sm font-semibold text-[#001d35] uppercase tracking-wider">
                        Chargement du reçu...
                    </h4>
                    <p className="text-xs text-gray-600 mt-1 font-medium">
                        Génération du document de caisse en cours
                    </p>
                </div>
            </div>
        )}

        {/* ── Modal reçu ── */}
        {viewingTransaction && !receiptLoading && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <Receipt
                    transaction={viewingTransaction}
                    onClose={() => setViewingTransaction(null)}
                />
            </div>
        )}

        {/* ── Infobulle professionnelle scrollable pour la colonne Article ── */}
        {hoveredArticleTooltip && (
            <div
                id="article-tooltip-card"
                className="fixed z-[9999] pointer-events-auto transition-opacity duration-150 ease-out"
                style={{
                    top: hoveredArticleTooltip.coords.top,
                    bottom: hoveredArticleTooltip.coords.bottom,
                    left: hoveredArticleTooltip.coords.left,
                }}
                onMouseEnter={handleTooltipMouseEnter}
                onMouseLeave={handleTooltipMouseLeave}
            >
                <div className="bg-white text-gray-800 shadow-2xl rounded-sm p-3 border border-gray-300 w-84 max-w-[92vw] text-xs">
                    {/* En-tête sobre */}
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-200">
                        <div>
                            <span className="font-bold text-gray-900 text-xs block">
                                {formatTransactionNumber(hoveredArticleTooltip.transaction, 'REC')}
                            </span>
                            <span className="text-[10px] text-gray-500">
                                {format(new Date(hoveredArticleTooltip.transaction.date || hoveredArticleTooltip.transaction.transactionDate), 'dd/MM/yyyy HH:mm')}
                            </span>
                        </div>
                        <span className="text-[10px] uppercase font-semibold text-gray-500">
                            {hoveredArticleTooltip.transaction.items?.length || 0} article{(hoveredArticleTooltip.transaction.items?.length || 0) > 1 ? 's' : ''}
                        </span>
                    </div>

                    {/* Zone de défilement (scrollable) pour voir tout le contenu */}
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                        {(hoveredArticleTooltip.transaction.items || []).map((item, idx) => {
                            const details = resolveItemDetails(item, products);
                            return (
                                <div key={idx} className="pb-2 border-b border-gray-100 last:border-b-0 last:pb-0">
                                    <div className="flex items-start justify-between gap-2">
                                        <span className="font-medium text-gray-900 text-xs leading-tight">
                                            {details.productName}
                                            {details.isFraction && details.detailLabel ? (
                                                <span className="text-gray-500 ml-1">({details.detailLabel})</span>
                                            ) : null}
                                        </span>
                                        <span className="font-bold text-xs text-gray-900 shrink-0">
                                            x{details.formattedQty}
                                        </span>
                                    </div>

                                    <div className="flex justify-between items-center text-[10px] text-gray-500 mt-1">
                                        <span>P.U. : {formatPrice(details.price)}</span>
                                        <span className="font-semibold text-gray-800">
                                            Total : {formatPrice(details.totalPrice)}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Pied de l'infobulle */}
                    <div className="mt-2.5 pt-2 border-t border-gray-200 flex justify-between items-center text-[11px]">
                        <span className="text-gray-500">
                            Paiement : <span className="font-medium text-gray-800 capitalize">{hoveredArticleTooltip.transaction.paymentMethod || 'Espèces'}</span>
                        </span>
                        <span className="font-bold text-xs text-[#001d35]">
                            Total : {formatPrice(hoveredArticleTooltip.transaction.total)}
                        </span>
                    </div>
                </div>
            </div>
        )}
    </>
    );
};

export default SalesPerformance;
