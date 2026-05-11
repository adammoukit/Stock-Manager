import React, { useEffect, useState } from 'react';
import { useInventory } from '../context/InventoryContext';
import { useSales } from '../context/SalesContext';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { usePurchase } from '../context/PurchaseContext';
import { Eye, ChevronDown } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { formatPrice } from '../utils/currency';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
    const [showAlerts, setShowAlerts] = useState(true);
    const [activeTooltip, setActiveTooltip] = useState(null);
    const [period, setPeriod] = useState('today');
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

    // ── Auto-reload after login to ensure real data ──────────────────
    React.useEffect(() => {
        const needsRefresh = sessionStorage.getItem('kabllix_refresh_needed');
        if (needsRefresh === 'true') {
            console.log("Dashboard: Premier accès après login détecté. Rechargement forcé pour les données réelles...");
            sessionStorage.removeItem('kabllix_refresh_needed');
            window.location.reload();
        }
    }, []);

    // ── Period filter ────────────────────────────────────────────────
    const filterByPeriod = (txList) => {
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        return txList.filter(t => {
            const d = new Date(t.date || t.createdAt || t.timestamp);
            const dStr = d.toISOString().split('T')[0];
            if (period === 'today') return dStr === todayStr;
            if (period === '7days') return (now - d) <= 7 * 24 * 60 * 60 * 1000;
            if (period === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            return true; // 'all'
        });
    };

    const filteredTx = filterByPeriod(transactions);

    // Calculate metrics (based on filtered period)
    const totalRevenue = filteredTx.reduce((sum, t) => sum + t.total, 0);
    const totalOrders = filteredTx.length;
    const lowStockCount = getLowStockProducts().length;
    const totalStockValue = products.reduce((sum, p) => sum + ((p.stockLevels?.[currentStoreId] || 0) * (p.purchasePrice || 0)), 0);
    const potentialStockRevenue = products.reduce((sum, p) => sum + ((p.stockLevels?.[currentStoreId] || 0) * (p.price || 0)), 0);

    // Calculate estimated margin
    const estimatedMargin = filteredTx.reduce((sum, t) => {
        const transactionMargin = t.items.reduce((itemSum, item) => {
            const product = products.find(p => p.id === item.id);
            const salePriceTotal = item.isBulk ? item.bulkPrice * item.inputQuantity : item.price * (item.inputQuantity || item.quantity);
            const deductedQty = item.stockDeduction || item.quantity || 1;
            const basicUnitPurchasePrice = product && product.purchasePrice
                ? product.purchasePrice
                : (salePriceTotal / deductedQty) * 0.8;
            const costTotal = basicUnitPurchasePrice * deductedQty;
            return itemSum + (salePriceTotal - costTotal);
        }, 0);
        return sum + transactionMargin;
    }, 0);

    // Calculate total expenses (filtered by same period)
    const filteredExpenses = filterByPeriod(
        expenses.map(e => ({ ...e, date: e.date || e.createdAt }))
    );
    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

    // Calculate Net Profit
    const netProfit = estimatedMargin - totalExpenses;

    // Supplier metrics
    const totalSuppliers = suppliers.length;
    const globalDebt = suppliers.reduce((sum, s) => sum + (s.balance || 0), 0);

    // Customer Debt metrics (Créances)
    const totalReceivables = debts.reduce((sum, d) => sum + ((d.totalAmount || 0) - (d.paidAmount || 0)), 0);

    // Build real sales data: last 7 days from transactions
    const salesData = (() => {
        const days = [];
        const dayLabels = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
        const today = new Date();

        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD

            const daySales = transactions
                .filter(t => {
                    const tDate = new Date(t.date || t.createdAt || t.timestamp);
                    return tDate.toISOString().split('T')[0] === dateStr;
                })
                .reduce((sum, t) => sum + (t.total || 0), 0);

            days.push({
                name: i === 0 ? "Auj." : dayLabels[date.getDay()],
                sales: daySales,
                date: dateStr
            });
        }
        return days;
    })();


    // Simplified StatCard to use standard formatting
    const StatCard = ({ tooltipId, title, value, icon, iconUrl, color, trend, subtitle, onAction, isCurrency, loading, tooltip }) => {
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
            <div className="bg-white p-3 rounded-sm border-2 border-gray-300 shadow-sm relative group hover:shadow-md transition-shadow overflow-hidden min-h-[120px] flex flex-col justify-center">
                {loading ? (
                    <div className="flex flex-col items-center justify-center space-y-3 py-2">
                        <div className="relative h-8 w-8">
                            <div className="absolute inset-0 animate-spin rounded-full border-2 border-t-transparent border-[#018f8f]"></div>
                            <div className="absolute inset-1 animate-spin-reverse rounded-full border-2 border-b-transparent border-[#f77500] opacity-60"></div>
                        </div>
                        <p className="text-[9px] font-black text-[#018f8f] uppercase tracking-[0.2em] animate-pulse">Synchronisation...</p>
                    </div>
                ) : (
                    <>
                        <div className="flex justify-between items-start relative z-10">
                            <div className="flex-1">
                                <div className="flex items-center gap-1.5">
                                    <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-teal-600/70">{title}</p>
                                    {tooltip && (
                                        <button
                                            ref={btnRef}
                                            onClick={handleToggle}
                                            className={`w-4 h-4 rounded-full text-[10px] font-black leading-none flex-shrink-0 flex items-center justify-center transition-colors cursor-pointer ${isOpen ? 'bg-[#018f8f] text-white' : 'bg-gray-200 hover:bg-[#018f8f] text-gray-500 hover:text-white'}`}
                                        >?</button>
                                    )}
                                </div>
                                <div className="flex items-baseline mt-2 font-semibold" style={{ color: '#005f5f' }}>
                                    <h3 className="text-2xl sm:text-3xl font-semibold">
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
                                className="absolute bottom-2 right-2 w-16 h-16 opacity-90 group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-700 pointer-events-none"
                            />
                        )}

                        {trend && (
                            <div className="mt-4 flex items-center text-sm">
                                <i className="uil uil-arrow-growth text-green-500 mr-1 text-lg"></i>
                                <span className="text-green-500 font-medium">{trend}</span>
                                <span className="text-gray-400 ml-1 text-xs">vs sem. dernière</span>
                            </div>
                        )}
                        {onAction && (
                            <button
                                onClick={onAction}
                                className="absolute top-4 right-4 p-2 bg-gray-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-teal-50 hover:text-teal-600"
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
        <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex flex-col items-center justify-center z-20 space-y-3">
            <div className="relative h-10 w-10">
                <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-t-transparent border-[#018f8f]"></div>
                <div className="absolute inset-1.5 animate-spin-reverse rounded-full border-[3px] border-b-transparent border-[#f77500] opacity-70"></div>
            </div>
            <p className="text-[10px] font-black text-[#018f8f] uppercase tracking-[0.3em] animate-pulse">Sync. en cours...</p>
        </div>
    );

    return (
        <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-[#018f8f] tracking-tight">Tableau de bord</h2>
                    <p className="text-gray-500 text-sm mt-1 font-medium">Vue d'ensemble de votre activité financière</p>
                </div>

                {/* Period Selector */}
                <div className="flex items-center gap-1 bg-gray-100/80 p-1 rounded-sm self-start sm:self-auto border-2 border-gray-300">
                    {[
                        { key: 'today', label: "Aujourd'hui" },
                        { key: '7days', label: '7 jours' },
                        { key: 'month', label: 'Ce mois' },
                        { key: 'all', label: 'Tout' },
                    ].map(opt => (
                        <button
                            key={opt.key}
                            onClick={() => setPeriod(opt.key)}
                            className={`px-3 py-1.5 text-xs font-bold rounded-sm transition-all ${period === opt.key
                                ? 'bg-white text-[#018f8f] shadow-sm ring-1 ring-gray-200/50'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard
                    tooltipId="ca"
                    title="Chiffre d'Affaires"
                    value={totalRevenue}
                    isCurrency={true}
                    iconUrl="/icons8/fluency_240_banknotes.png"
                    trend="+12%"
                    loading={!showData}
                    tooltip="L'argent total encaissé grâce aux ventes réalisées sur la période sélectionnée."
                />
                <StatCard
                    tooltipId="ventes"
                    title="Ventes"
                    value={totalOrders}
                    iconUrl="/icons8/fluency_240_shopping-cart.png"
                    loading={!showData}
                    tooltip="Le nombre de transactions (clients servis) sur la période sélectionnée."
                />
                <StatCard
                    tooltipId="marge"
                    title="Marge Brute"
                    value={estimatedMargin}
                    isCurrency={true}
                    iconUrl="/icons8/fluency_240_bullish.png"
                    subtitle="Estimation sur prix d'achat"
                    loading={!showData}
                    tooltip="Bénéfice estimé des ventes = Prix de vente − Prix d'achat, avant déduction des dépenses."
                />
                <StatCard
                    tooltipId="benefice"
                    title="Bénéfice Net Réel"
                    value={netProfit}
                    isCurrency={true}
                    iconUrl="/icons8/fluency_240_coins.png"
                    subtitle={`Après dépenses (${formatPrice(totalExpenses)})`}
                    loading={!showData}
                    tooltip="Marge Brute moins toutes les dépenses/charges enregistrées. Votre vrai bénéfice."
                />
            </div>



            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {/* Évolution des Ventes */}
                <div className="bg-white p-3 rounded-sm border-2 border-gray-300 shadow-sm relative overflow-hidden">
                    {!showData && <LoadingOverlay />}
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-sm font-semibold tracking-wide uppercase text-[11px] text-teal-600/70">Évolution des Ventes</h3>
                            <p className="text-xs text-gray-500 mt-0.5">7 derniers jours — Total : {formatPrice(salesData.reduce((s, d) => s + d.sales, 0))}</p>
                        </div>
                    </div>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={salesData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                <XAxis dataKey="name" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    formatter={(value) => [formatPrice(value), 'Ventes']}
                                    labelFormatter={(label) => `Jour : ${label}`}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="sales"
                                    stroke="#018f8f"
                                    strokeWidth={3}
                                    dot={{ r: 4, fill: '#018f8f', strokeWidth: 2, stroke: '#fff' }}
                                    activeDot={{ r: 6, fill: '#018f8f', stroke: '#fff', strokeWidth: 2 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Nouveau Secteur : Métriques du Catalogue & Fournisseurs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 h-fit">
                    <StatCard
                        tooltipId="catalogue"
                        title="Total Catalogue"
                        value={products.length}
                        subtitle="Articles référencés"
                        iconUrl="/icons8/fluency_240_product.png"
                        loading={!showData}
                        tooltip="Le nombre total de produits/références enregistrés dans votre inventaire."
                    />
                    <StatCard
                        tooltipId="alertes"
                        title="Alertes Stock"
                        value={lowStockCount}
                        subtitle="À réapprovisionner"
                        iconUrl="/icons8/fluency_240_high-priority.png"
                        loading={!showData}
                        tooltip="Nombre de produits dont le stock est en dessous du seuil minimum défini. Action requise."
                    />
                    <StatCard
                        tooltipId="fournisseurs"
                        title="Total Fournisseurs"
                        value={totalSuppliers}
                        subtitle="Partenaires enregistrés"
                        iconUrl="/icons8/fluency_240_group.png"
                        loading={!showData}
                        tooltip="Le nombre de fournisseurs avec qui vous travaillez, enregistrés dans le module Fournisseurs."
                    />
                    <StatCard
                        tooltipId="dette"
                        title="Dette Globale"
                        value={globalDebt}
                        isCurrency={true}
                        subtitle="Solde dû aux fournisseurs"
                        iconUrl="/icons8/fluency_240_debt.png"
                        loading={!showData}
                        tooltip="La somme totale que vous devez encore payer à vos fournisseurs pour vos achats de marchandises."
                    />
                    <StatCard
                        tooltipId="creances"
                        title="Total Créances"
                        value={totalReceivables}
                        isCurrency={true}
                        subtitle="Carnet de crédit (Clients)"
                        iconUrl="/icons8/fluency_240_ledger.png"
                        loading={!showData}
                        tooltip="L'argent que vos clients vous doivent encore (ventes faites à crédit non encore réglées)."
                    />
                    <StatCard
                        tooltipId="stock"
                        title="Valeur Totale du Stock"
                        value={totalStockValue}
                        isCurrency={true}
                        subtitle="Capital immobilisé (Prix achat)"
                        iconUrl="/icons8/fluency_240_box.png"
                        loading={!showData}
                        tooltip="L'argent que vous avez investi pour acheter la marchandise qui est actuellement dans vos rayons (calculé sur le prix d'achat)."
                    />
                    <div className="sm:col-span-2">
                        <StatCard
                            tooltipId="potentiel"
                            title="Revenus Potentiels"
                            value={potentialStockRevenue}
                            isCurrency={true}
                            subtitle={`Marge latente : ${formatPrice(potentialStockRevenue - totalStockValue)}`}
                            iconUrl="/icons8/fluency_240_cash-in-hand.png"
                            loading={!showData}
                            tooltip="Si vous vendiez tout votre stock aujourd'hui aux prix affichés, voici l'argent total que vous encaisseriez. La marge latente = ce montant moins la valeur d'achat du stock."
                        />
                    </div>
                </div>

                {/* Top Produits */}
                <div className="lg:col-span-2 bg-white p-3 rounded-sm border-2 border-gray-300 shadow-sm mt-0 relative overflow-hidden">
                    {!showData && <LoadingOverlay />}
                    <h3 className="text-sm font-semibold tracking-wide uppercase text-[11px] text-teal-600/70 mb-4">Top Produits (Plus Grand Stock)</h3>
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
            </div>

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
                            className="fixed z-[9999] w-64 bg-[#005f5f] text-white text-xs rounded-md p-3 shadow-2xl leading-relaxed"
                            style={{ ...leftStyle, ...topStyle }}
                        >
                            {/* Arrow */}
                            {!flipY && (
                                <div className={`absolute -bottom-1.5 w-3 h-3 bg-[#005f5f] rotate-45 ${flipX ? 'right-3' : 'left-3'}`}></div>
                            )}
                            {flipY && (
                                <div className={`absolute -top-1.5 w-3 h-3 bg-[#005f5f] rotate-45 ${flipX ? 'right-3' : 'left-3'}`}></div>
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
