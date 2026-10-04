import React, { useState, useEffect, useMemo } from 'react';
import { 
    X, TrendingUp, PieChart, DollarSign, Package, 
    ShoppingCart, AlertTriangle, CheckCircle2, 
    ArrowUpRight, Percent, Tag, Barcode, Layers, 
    Clock, ShieldAlert, Award, Zap
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { useSales } from '../context/SalesContext';
import { useSettings } from '../context/SettingsContext';
import { formatPrice } from '../utils/currency';
import { getUnitModel } from '../config/unitModels';

/**
 * ProductInsightModal.jsx
 * Fiche d'Analyse Stratégique, Performance Commerciale et Occupation du Stock
 * Respecte à la lettre la charte graphique corporate Kabllix :
 * - Typographie Inter calibrée, graisses de texte et tracking maîtrisés
 * - Bordures arrondies standardisées (rounded-[4px] / rounded-sm)
 * - Loader strict de 1.5s avec spinner exclusif (sans texte)
 */
const ProductInsightModal = ({ product, onClose }) => {
    const { products } = useInventory();
    const { transactions } = useSales();
    const { currentStoreId } = useSettings();

    // Loader obligatoire de 1.5s à l'ouverture
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        setIsLoading(true);
        const timer = setTimeout(() => {
            setIsLoading(false);
        }, 1500);
        return () => clearTimeout(timer);
    }, [product?.id]);

    // Mode du graphique circulaire : 'value' (FCFA) ou 'volume' (Unités)
    const [chartMode, setChartMode] = useState('value');

    if (!product) return null;

    // ── 1. Données Produits & Stock Local ──
    const stockQty = product.stockLevels?.[currentStoreId] || 0;
    const minStock = product.minStockLevels?.[currentStoreId] || product.minStock || 0;
    const purchasePrice = parseFloat(product.purchasePrice) || 0;
    const price = parseFloat(product.price) || 0;
    const unit = product.unit || 'Pièce';
    const cf = parseFloat(product.conversionFactor) || 1;
    const isContainer = (product.unitArchetype === 'BOX' || product.unitArchetype === 'BULK') && cf > 1;
    const subUnit = product.bulkUnit || getUnitModel(product.unit).subUnit;

    const isOutOfStock = stockQty <= 0;
    const isLowStock = !isOutOfStock && stockQty <= minStock;

    // Valeurs financières
    const productStockValue = stockQty * purchasePrice;
    const productRetailValue = stockQty * price;
    const potentialProfit = Math.max(0, productRetailValue - productStockValue);

    // Marges
    const unitMargin = price - purchasePrice;
    const marginRate = price > 0 ? ((unitMargin / price) * 100) : 0;

    // ── 2. Performance Commerciale (Ventes Historiques) ──
    const salesMetrics = useMemo(() => {
        if (!transactions || !Array.isArray(transactions)) {
            return { totalSoldQty: 0, totalRevenue: 0, totalProfit: 0, count: 0, lastSaleDate: null };
        }

        let totalSoldQty = 0;
        let totalRevenue = 0;
        let count = 0;
        let lastSaleDate = null;

        transactions.forEach(tx => {
            const items = tx.items || [];
            items.forEach(item => {
                const itemId = item.id || item.productId;
                if (itemId === product.id) {
                    const qty = parseFloat(item.quantity || item.inputQuantity || 1) || 0;
                    const salePrice = parseFloat(item.price || item.unitPrice || 0) || 0;
                    totalSoldQty += qty;
                    totalRevenue += (qty * salePrice);
                    count += 1;

                    if (tx.date && (!lastSaleDate || new Date(tx.date) > new Date(lastSaleDate))) {
                        lastSaleDate = tx.date;
                    }
                }
            });
        });

        const totalCostOfGoodsSold = totalSoldQty * purchasePrice;
        const totalProfit = Math.max(0, totalRevenue - totalCostOfGoodsSold);

        return {
            totalSoldQty,
            totalRevenue,
            totalProfit,
            count,
            lastSaleDate
        };
    }, [transactions, product.id, purchasePrice]);

    // ── 3. Occupation du Stock Global du Magasin ──
    const storeTotals = useMemo(() => {
        if (!products || !Array.isArray(products)) return { totalValue: 0, totalUnits: 0 };
        return products.reduce((acc, p) => {
            const pQty = p.stockLevels?.[currentStoreId] || 0;
            const pBuy = parseFloat(p.purchasePrice) || 0;
            acc.totalValue += (pQty * pBuy);
            acc.totalUnits += pQty;
            return acc;
        }, { totalValue: 0, totalUnits: 0 });
    }, [products, currentStoreId]);

    // Ratios d'occupation
    const valueRatio = storeTotals.totalValue > 0 
        ? Math.min(100, Math.max(0, (productStockValue / storeTotals.totalValue) * 100)) 
        : 0;

    const volumeRatio = storeTotals.totalUnits > 0 
        ? Math.min(100, Math.max(0, (stockQty / storeTotals.totalUnits) * 100)) 
        : 0;

    const activeRatio = chartMode === 'value' ? valueRatio : volumeRatio;
    const activeProductVal = chartMode === 'value' ? productStockValue : stockQty;
    const activeTotalVal = chartMode === 'value' ? storeTotals.totalValue : storeTotals.totalUnits;
    const activeRestVal = Math.max(0, activeTotalVal - activeProductVal);

    // Paramètres SVG du Donut Chart
    const size = 170;
    const strokeWidth = 20;
    const center = size / 2;
    const radius = center - strokeWidth;
    const circumference = 2 * Math.PI * radius;
    const progressOffset = circumference - (activeRatio / 100) * circumference;

    // ── 4. Intelligence Stock Dormant & Vélocité (Vision 360°) ──
    const dormancyAnalysis = useMemo(() => {
        if (stockQty <= 0) {
            return {
                status: 'OUT_OF_STOCK',
                label: 'Épuisé',
                days: 0,
                isDormant: false,
                severity: 'neutral',
                badgeClass: 'bg-slate-200 text-slate-700',
                title: 'Rupture de Stock',
                message: 'Aucun capital immobilisé actuellement sur cette référence.',
                action: 'Réapprovisionner si forte demande client'
            };
        }

        const now = new Date();

        if (!salesMetrics.lastSaleDate || salesMetrics.count === 0) {
            return {
                status: 'NEVER_SOLD',
                label: 'Stock Inerte (0 vente)',
                days: null,
                isDormant: true,
                severity: 'danger',
                badgeClass: 'bg-rose-100 border border-rose-300 text-rose-800',
                title: 'Alerte : Aucune sortie enregistrée',
                message: `${formatPrice(productStockValue)} immobilisés (${stockQty} ${unit}) sans aucune vente constatée dans l'historique.`,
                action: 'Déstockage promotionnel ou révision du tarif'
            };
        }

        const lastDate = new Date(salesMetrics.lastSaleDate);
        const diffMs = Math.max(0, now - lastDate);
        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (days >= 60) {
            return {
                status: 'CRITICAL_DORMANT',
                label: `Dormant Critique (${days} j)`,
                days,
                isDormant: true,
                severity: 'danger',
                badgeClass: 'bg-rose-100 border border-rose-300 text-rose-800',
                title: `Alerte Produit Dormant — ${days} jours sans vente`,
                message: `${formatPrice(productStockValue)} de capital bloqué sans aucune rotation depuis plus de 2 mois.`,
                action: 'Remise agressive conseillée pour libérer la trésorerie'
            };
        } else if (days >= 30) {
            return {
                status: 'SLOW_MOVER',
                label: `Ralentissement (${days} j)`,
                days,
                isDormant: true,
                severity: 'warning',
                badgeClass: 'bg-amber-100 border border-amber-300 text-amber-800',
                title: `Avertissement : Rotation lente (${days} jours)`,
                message: `Dernière vente il y a ${days} jours. Risque d'immobilisation prolongée de trésorerie.`,
                action: 'Éviter tout réapprovisionnement avant écoulement'
            };
        } else if (days >= 10) {
            return {
                status: 'MODERATE',
                label: `Rotation Normale (${days} j)`,
                days,
                isDormant: false,
                severity: 'info',
                badgeClass: 'bg-blue-100 border border-blue-200 text-blue-800',
                title: `Rotation régulière (Dernière vente il y a ${days} j)`,
                message: `Rythme de vente modéré et sain pour cette catégorie d'articles.`,
                action: 'Niveau d\'attention opérationnel normal'
            };
        } else {
            return {
                status: 'FAST_MOVER',
                label: `Fast-Mover (${days === 0 ? "Aujourd'hui" : `${days} j`})`,
                days,
                isDormant: false,
                severity: 'success',
                badgeClass: 'bg-emerald-100 border border-emerald-300 text-emerald-800',
                title: `Excellente vélocité marchande`,
                message: `Produit à rotation active (dernière vente il y a ${days === 0 ? "moins de 24h" : `${days} jour(s)`}).`,
                action: 'Surveiller le seuil pour anticiper la commande'
            };
        }
    }, [stockQty, salesMetrics.lastSaleDate, salesMetrics.count, productStockValue, unit]);

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4">
            {/* Backdrop identique au modal de conditionnement */}
            <div 
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150" 
                onClick={onClose} 
            />

            {/* Container du Modal avec la bordure signature border-2 border-[#001d35] et rounded-sm */}
            <div className="relative bg-white border-2 border-[#001d35] rounded-sm shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                
                {/* ── Entête Corporate Identique au Modal de Conditionnement ── */}
                <div className="bg-[#001d35] px-4 py-3 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-2 text-white font-bold uppercase tracking-wider text-xs">
                        <TrendingUp className="w-4 h-4 text-amber-400" />
                        <span>Performance & Analyse : {product.name}</span>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="text-white/80 hover:text-white transition-colors cursor-pointer p-0.5"
                        title="Fermer"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* ── Corps du Modal : Loader strict de 1.5s SANS TEXTE ou Contenu Final ── */}
                {isLoading ? (
                    <div className="min-h-[460px] flex items-center justify-center p-12 bg-slate-50">
                        <div className="relative h-12 w-12">
                            <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-t-transparent border-[#001d35]"></div>
                            <div className="absolute inset-1.5 animate-spin-reverse rounded-full border-2 border-b-transparent border-[#f77500] opacity-90"></div>
                        </div>
                    </div>
                ) : (
                    <div className="p-4 bg-slate-50 space-y-3 flex-1 overflow-y-auto">

                        {/* Barre d'identité du produit (style identique à la ligne titre du modal conditionnement) */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-slate-800">
                                    {product.name}
                                </span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-none bg-slate-200 text-slate-700 uppercase tracking-wider">
                                    {product.category || 'Général'}
                                </span>
                                {product.barcode && (
                                    <span className="text-[10px] font-mono text-slate-600 bg-white border border-slate-300 px-1.5 py-0.5 rounded-none flex items-center gap-1">
                                        <Barcode className="w-3 h-3 text-slate-500" />
                                        {product.barcode}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {product.supplier && (
                                    <span className="text-[11px] text-slate-500 font-medium">
                                        Fournisseur : <strong className="text-slate-800 font-bold">{product.supplier}</strong>
                                    </span>
                                )}
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-none uppercase tracking-wider ${
                                    isOutOfStock 
                                        ? 'bg-rose-500 text-white' 
                                        : isLowStock 
                                            ? 'bg-amber-500 text-white' 
                                            : 'bg-emerald-600 text-white'
                                }`}>
                                    {isOutOfStock ? 'Rupture' : isLowStock ? 'Stock Faible' : 'En Stock'}
                                </span>
                                {stockQty > 0 && (
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-none uppercase tracking-wider flex items-center gap-1 ${dormancyAnalysis.badgeClass}`}>
                                        {dormancyAnalysis.isDormant ? '⚠️' : '⚡'} {dormancyAnalysis.label}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Grille Principale : 4 KPI Cards + Graphique Donut */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">

                            {/* Bloc Gauche : 4 KPI Cards (7 colonnes) */}
                            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                
                                {/* Card 1 : Capital Stock Immobilisé */}
                                <div className="bg-white p-3.5 border-2 border-slate-300 rounded-none shadow-2xs relative group hover:border-[#001d35] transition-colors overflow-hidden flex flex-col justify-between">
                                    <div className="relative z-10">
                                        <p className="text-[11px] font-bold text-blue-600/70 uppercase tracking-widest mb-1">Capital Immobilisé</p>
                                        <h3 className="text-xl sm:text-2xl font-semibold text-[#001d35]">
                                            {formatPrice(productStockValue)}
                                        </h3>
                                        <p className="text-xs text-slate-400 mt-2 font-medium">
                                            {stockQty.toLocaleString()} {unit} × {formatPrice(purchasePrice)}
                                        </p>
                                    </div>
                                    <img 
                                        src="/icons8/fluency_240_box.png" 
                                        alt="" 
                                        className="absolute bottom-2 right-2 w-14 h-14 opacity-25 group-hover:opacity-40 group-hover:scale-105 pointer-events-none transition-all duration-500" 
                                    />
                                </div>

                                {/* Card 2 : Chiffre d'Affaires Réalisé */}
                                <div className="bg-white p-3.5 border-2 border-slate-300 rounded-none shadow-2xs relative group hover:border-[#001d35] transition-colors overflow-hidden flex flex-col justify-between">
                                    <div className="relative z-10">
                                        <p className="text-[11px] font-bold text-blue-600/70 uppercase tracking-widest mb-1">Chiffre d'Affaires</p>
                                        <h3 className="text-xl sm:text-2xl font-semibold text-[#001d35]">
                                            {formatPrice(salesMetrics.totalRevenue)}
                                        </h3>
                                        <p className="text-xs text-slate-400 mt-2 font-medium">
                                            {salesMetrics.totalSoldQty.toLocaleString()} {unit} vendus ({salesMetrics.count} ventes)
                                        </p>
                                    </div>
                                    <img 
                                        src="/icons8/fluency_240_banknotes.png" 
                                        alt="" 
                                        className="absolute bottom-2 right-2 w-14 h-14 opacity-25 group-hover:opacity-40 group-hover:scale-105 pointer-events-none transition-all duration-500" 
                                    />
                                </div>

                                {/* Card 3 : Marge Commerciale Réalisée */}
                                <div className="bg-white p-3.5 border-2 border-slate-300 rounded-none shadow-2xs relative group hover:border-[#001d35] transition-colors overflow-hidden flex flex-col justify-between">
                                    <div className="relative z-10">
                                        <p className="text-[11px] font-bold text-blue-600/70 uppercase tracking-widest mb-1">Bénéfice Réalisé</p>
                                        <h3 className="text-xl sm:text-2xl font-semibold text-emerald-700">
                                            {formatPrice(salesMetrics.totalProfit)}
                                        </h3>
                                        <p className="text-xs text-slate-400 mt-2 font-medium">
                                            Marge unitaire : {formatPrice(unitMargin)} ({marginRate.toFixed(1)}%)
                                        </p>
                                    </div>
                                    <img 
                                        src="/icons8/fluency_240_bullish.png" 
                                        alt="" 
                                        className="absolute bottom-2 right-2 w-14 h-14 opacity-25 group-hover:opacity-40 group-hover:scale-105 pointer-events-none transition-all duration-500" 
                                    />
                                </div>

                                {/* Card 4 : Potentiel Marchand Restant */}
                                <div className="bg-white p-3.5 border-2 border-slate-300 rounded-none shadow-2xs relative group hover:border-[#001d35] transition-colors overflow-hidden flex flex-col justify-between">
                                    <div className="relative z-10">
                                        <p className="text-[11px] font-bold text-blue-600/70 uppercase tracking-widest mb-1">Potentiel Vente</p>
                                        <h3 className="text-xl sm:text-2xl font-semibold text-[#001d35]">
                                            {formatPrice(productRetailValue)}
                                        </h3>
                                        <p className="text-xs text-slate-400 mt-2 font-medium">
                                            Marge latente : {formatPrice(potentialProfit)}
                                        </p>
                                    </div>
                                    <img 
                                        src="/icons8/fluency_240_cash-in-hand.png" 
                                        alt="" 
                                        className="absolute bottom-2 right-2 w-14 h-14 opacity-25 group-hover:opacity-40 group-hover:scale-105 pointer-events-none transition-all duration-500" 
                                    />
                                </div>

                                {/* Barre Récapitulative des Prix & Rentabilité */}
                                <div className="sm:col-span-2 bg-white px-4 py-2.5 border-2 border-slate-300 rounded-none shadow-2xs flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Achat :</span>
                                        <strong className="text-slate-800 font-mono font-bold">{formatPrice(purchasePrice)}</strong>
                                    </div>
                                    <span className="text-slate-300 font-bold">→</span>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Vente :</span>
                                        <strong className="text-[#001d35] font-mono font-bold">{formatPrice(price)}</strong>
                                    </div>
                                    <span className="text-slate-300 font-bold">→</span>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Marge Brute :</span>
                                        <strong className={`font-mono font-bold ${marginRate >= 20 ? 'text-emerald-700' : 'text-amber-700'}`}>
                                            {marginRate.toFixed(1)}% ({formatPrice(unitMargin)})
                                        </strong>
                                    </div>
                                </div>
                            </div>

                            {/* Bloc Droit : Graphique Donut d'Occupation du Stock (5 colonnes) */}
                            <div className="lg:col-span-5 bg-white p-4 border-2 border-slate-300 rounded-none shadow-2xs flex flex-col justify-between hover:border-[#001d35] transition-colors">
                                
                                {/* En-tête du Donut avec Tabs */}
                                <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2">
                                    <p className="text-[11px] font-bold text-blue-600/70 uppercase tracking-widest flex items-center gap-1.5">
                                        <PieChart className="w-3.5 h-3.5 text-[#001d35]" />
                                        Poids dans le Stock
                                    </p>
                                    {/* Toggle Mode Valeur / Volume style boutons conditionnement */}
                                    <div className="inline-flex p-0.5 bg-slate-100 rounded-none border border-slate-300 text-[10px] font-bold">
                                        <button
                                            type="button"
                                            onClick={() => setChartMode('value')}
                                            className={`px-2.5 py-1 rounded-none transition-all cursor-pointer ${
                                                chartMode === 'value' 
                                                    ? 'bg-[#001d35] text-white shadow-2xs' 
                                                    : 'text-slate-600 hover:text-slate-900'
                                            }`}
                                        >
                                            Valeur FCFA
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setChartMode('volume')}
                                            className={`px-2.5 py-1 rounded-none transition-all cursor-pointer ${
                                                chartMode === 'volume' 
                                                    ? 'bg-[#001d35] text-white shadow-2xs' 
                                                    : 'text-slate-600 hover:text-slate-900'
                                            }`}
                                        >
                                            Volume Unités
                                        </button>
                                    </div>
                                </div>

                                {/* Le Cercle Donut SVG vectoriel haute précision */}
                                <div className="relative flex items-center justify-center my-1">
                                    <svg width={size} height={size} className="transform -rotate-90">
                                        {/* Anneau de fond (Reste du magasin) */}
                                        <circle
                                            cx={center}
                                            cy={center}
                                            r={radius}
                                            fill="transparent"
                                            stroke="#e2e8f0"
                                            strokeWidth={strokeWidth}
                                        />
                                        {/* Anneau actif (Ce produit) */}
                                        <circle
                                            cx={center}
                                            cy={center}
                                            r={radius}
                                            fill="transparent"
                                            stroke="#001d35"
                                            strokeWidth={strokeWidth}
                                            strokeDasharray={circumference}
                                            strokeDashoffset={progressOffset}
                                            strokeLinecap="round"
                                            className="transition-all duration-700 ease-out"
                                        />
                                    </svg>

                                    {/* Pourcentage au Centre */}
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                                        <span className="text-2xl sm:text-3xl font-bold text-[#001d35] tracking-tight">
                                            {activeRatio.toFixed(1)}%
                                        </span>
                                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                                            {chartMode === 'value' ? 'du capital stock' : 'des unités stock'}
                                        </span>
                                    </div>
                                </div>

                                {/* Légende du Donut */}
                                <div className="space-y-1.5 pt-2 border-t border-slate-200 text-xs font-semibold">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2.5 h-2.5 rounded-full bg-[#001d35]" />
                                            <span className="text-slate-700">Ce produit :</span>
                                        </div>
                                        <span className="font-mono text-[#001d35] font-bold">
                                            {chartMode === 'value' ? formatPrice(activeProductVal) : `${activeProductVal.toLocaleString()} ${unit}`}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                                            <span className="text-slate-500">Reste du magasin :</span>
                                        </div>
                                        <span className="font-mono text-slate-600 font-medium">
                                            {chartMode === 'value' ? formatPrice(activeRestVal) : `${activeRestVal.toLocaleString()} unités`}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── Encart Stratégique 360° : Diagnostic Produit Dormant & Trésorerie ── */}
                        <div className={`p-3.5 border-2 rounded-none shadow-2xs flex items-start justify-between gap-3 flex-wrap sm:flex-nowrap transition-colors ${
                            dormancyAnalysis.severity === 'danger' 
                                ? 'border-rose-300 bg-rose-50/80 text-rose-950' 
                                : dormancyAnalysis.severity === 'warning'
                                    ? 'border-amber-300 bg-amber-50/80 text-amber-950'
                                    : dormancyAnalysis.severity === 'success'
                                        ? 'border-emerald-300 bg-emerald-50/80 text-emerald-950'
                                        : 'border-slate-300 bg-white text-slate-800'
                        }`}>
                            <div className="flex items-start gap-2.5 min-w-0">
                                <div className={`p-1.5 rounded-none flex-shrink-0 mt-0.5 ${
                                    dormancyAnalysis.severity === 'danger' 
                                        ? 'bg-rose-100 text-rose-700' 
                                        : dormancyAnalysis.severity === 'warning'
                                            ? 'bg-amber-100 text-amber-700'
                                            : dormancyAnalysis.severity === 'success'
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : 'bg-slate-100 text-slate-600'
                                }`}>
                                    {dormancyAnalysis.isDormant ? (
                                        <AlertTriangle className="w-4 h-4" />
                                    ) : (
                                        <Zap className="w-4 h-4" />
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-[11px] font-bold uppercase tracking-wider">
                                            {dormancyAnalysis.title}
                                        </span>
                                        <span className={`text-[9px] font-black px-1.5 py-0.2 rounded-none uppercase tracking-wider ${dormancyAnalysis.badgeClass}`}>
                                            {dormancyAnalysis.label}
                                        </span>
                                    </div>
                                    <p className="text-xs mt-0.5 opacity-90 font-medium">
                                        {dormancyAnalysis.message}
                                    </p>
                                </div>
                            </div>
                            <div className="self-center sm:self-auto flex-shrink-0 text-right">
                                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                                    Action Recommandée Gérant
                                </span>
                                <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-none border mt-0.5 ${
                                    dormancyAnalysis.severity === 'danger'
                                        ? 'bg-rose-100/90 border-rose-300 text-rose-800'
                                        : dormancyAnalysis.severity === 'warning'
                                            ? 'bg-amber-100/90 border-amber-300 text-amber-900'
                                            : 'bg-emerald-100/90 border-emerald-300 text-emerald-900'
                                }`}>
                                    💡 {dormancyAnalysis.action}
                                </span>
                            </div>
                        </div>

                        {/* Bloc Inférieur : Audit de Disponibilité, Déconditionnement & Rotation */}
                        <div className="bg-white p-4 border-2 border-slate-300 rounded-none shadow-2xs space-y-3 hover:border-[#001d35] transition-colors">
                            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                                <p className="text-[11px] font-bold text-blue-600/70 uppercase tracking-widest flex items-center gap-1.5">
                                    <Layers className="w-3.5 h-3.5 text-[#001d35]" />
                                    Audit de Disponibilité & Rotation
                                </p>
                                <div className="text-[11px] text-slate-500 font-medium">
                                    Dernière vente : <strong className="text-slate-800 font-semibold">{salesMetrics.lastSaleDate ? new Date(salesMetrics.lastSaleDate).toLocaleDateString('fr-FR') : 'Aucune'}</strong>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-0.5">
                                {/* Stock Actuel vs Minimum */}
                                <div className="bg-slate-50 p-3 border border-slate-200 rounded-none">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Réserve / Seuil</span>
                                        <span className="text-xs font-mono font-bold text-slate-800">
                                            {stockQty} / {minStock} min
                                        </span>
                                    </div>
                                    <div className="w-full bg-slate-200 h-2 rounded-none overflow-hidden">
                                        <div 
                                            className={`h-full rounded-none transition-all duration-500 ${
                                                isOutOfStock 
                                                    ? 'bg-rose-500 w-0' 
                                                    : isLowStock 
                                                        ? 'bg-amber-500' 
                                                        : 'bg-emerald-600'
                                            }`}
                                            style={{ width: `${Math.min(100, minStock > 0 ? (stockQty / (minStock * 2)) * 100 : 100)}%` }}
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-1 font-medium">
                                        {isOutOfStock ? 'Rupture complète de stock' : isLowStock ? 'Réapprovisionnement recommandé' : 'Niveau de stock optimal'}
                                    </p>
                                </div>

                                {/* Conditionnement & Unités Multiples */}
                                <div className="bg-slate-50 p-3 border border-slate-200 rounded-none">
                                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Conditionnement</span>
                                    <div className="text-xs text-slate-800 font-semibold">
                                        Unité principale : <strong className="text-[#001d35]">{unit}</strong>
                                    </div>
                                    {isContainer && (
                                        <div className="text-[11px] text-slate-500 mt-0.5 font-medium">
                                            1 {unit} = {cf} {subUnit || 'unités'}
                                        </div>
                                    )}
                                    {product.packagings?.length > 0 && (
                                        <div className="text-[10px] text-emerald-700 font-bold mt-1">
                                            {product.packagings.length} conditionnement(s) actif(s)
                                        </div>
                                    )}
                                </div>

                                {/* Fréquence de Vente */}
                                <div className="bg-slate-50 p-3 border border-slate-200 rounded-none">
                                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Fréquence de Vente</span>
                                    <div className="text-xs text-slate-800 font-semibold">
                                        {salesMetrics.count > 0 ? (
                                            <span>Présent dans <strong className="text-[#001d35]">{salesMetrics.count}</strong> vente(s)</span>
                                        ) : (
                                            <span className="text-slate-400 italic">Aucune vente enregistrée</span>
                                        )}
                                    </div>
                                    {salesMetrics.count > 0 && (
                                        <p className="text-[10px] text-slate-500 mt-0.5 font-medium">
                                            Moyenne : {(salesMetrics.totalSoldQty / salesMetrics.count).toFixed(1)} {unit} / ticket
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                    </div>
                )}

                {/* ── Pied de Page du Modal (Style identique au pied des modals ERP Kabllix) ── */}
                <div className="px-4 py-2.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between flex-shrink-0">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Kabllix Analytics & Stock Intelligence
                    </span>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-[#001d35] hover:bg-blue-800 text-white rounded-none font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-2xs active:scale-95"
                    >
                        Fermer la fiche
                    </button>
                </div>

            </div>
        </div>
    );
};

export default ProductInsightModal;
