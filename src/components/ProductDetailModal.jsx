import React, { useState, useEffect } from 'react';
import { 
    X, Package, Box, Layers, Tag, Barcode, DollarSign, 
    Truck, ShieldCheck, AlertTriangle, CheckCircle2, 
    Layers3, Calculator, Edit3, ShoppingCart, Info, TrendingUp
} from 'lucide-react';
import { formatPrice } from '../utils/currency';
import { getUnitModel, computeContainerStock, formatContainerStock } from '../config/unitModels';
import { useSettings } from '../context/SettingsContext';

/**
 * ProductDetailModal.jsx
 * Fiche détaillée du produit s'adaptant dynamiquement à la configuration et au type de produit :
 * - ARCHETYPE UNIT : Vente simple unitaire
 * - ARCHETYPE BOX : Boîte / Carton / Sachet avec vente à la pièce, petits lots, sous-conditionnements
 * - ARCHETYPE BULK : Vente au vrac / mesure (Mètre, Kg, Litre) avec déconditionnements fractionnés
 * Respect strict de la charte graphique Kabllix :
 * - #001d35 corporate, bordures border-2, border-radius 4px (rounded-[4px])
 * - Typographie Inter, labels en uppercase tracking-wider
 */
const ProductDetailModal = ({ product, onClose, onEdit, onAddToCart }) => {
    const { currentStoreId } = useSettings();
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        setIsLoading(false);
    }, [product?.id]);

    if (!product) return null;

    const unitModel = getUnitModel(product.unit, product.bulkUnit);
    const archetype = product.unitArchetype || unitModel?.archetype || 'UNIT';
    const cf = parseFloat(product.conversionFactor) || 1;
    const isContainer = (archetype === 'BOX' || archetype === 'BULK') && cf > 1;

    // Sous-unité
    const subUnitLabel = (() => {
        if (unitModel?.subUnit && unitModel.subUnit !== 'L/Kg') {
            return unitModel.subUnit;
        }
        if (unitModel?.subUnit === 'L/Kg') {
            return (product.bulkUnit && product.bulkUnit !== 'L/Kg') ? product.bulkUnit : 'Litre';
        }
        return product.bulkUnit || (archetype === 'BOX' ? 'Pièce' : 'unité');
    })();

    // Stocks
    const stockQty = product.stockLevels?.[currentStoreId] || 0;
    const minStock = product.minStockLevels?.[currentStoreId] || product.minStock || 0;
    const isOutOfStock = stockQty <= 0;
    const isLowStock = !isOutOfStock && stockQty <= minStock;

    // Prix & Marges
    const price = parseFloat(product.price) || 0;
    const purchasePrice = parseFloat(product.purchasePrice) || 0;
    const unitMargin = price - purchasePrice;
    const marginRate = price > 0 ? (unitMargin / price) * 100 : 0;

    // Total Stock Value
    const stockValuation = stockQty * purchasePrice;
    const retailValuation = stockQty * price;

    // Décomposition ultra-précise du stock pour les conteneurs (Vrac / Boîte)
    const stockBreakdown = computeContainerStock(stockQty, cf);

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150" 
                onClick={onClose} 
            />

            {/* Modal Dialog */}
            <div className="relative bg-white border-2 border-[#001d35] rounded-[4px] shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                
                {/* Header */}
                <div className="bg-[#001d35] px-4 py-3 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-2.5 text-white font-bold uppercase tracking-wider text-xs">
                        <Package className="w-4 h-4 text-amber-400" />
                        <span>Fiche Produit : <strong className="text-white font-extrabold">{product.name}</strong></span>
                        <span className="ml-2 bg-white/10 text-white/90 text-[10px] px-2 py-0.5 rounded-[4px] border border-white/20">
                            {archetype === 'BOX' ? 'Boîte / Carton' : archetype === 'BULK' ? 'Vrac / Mesure' : 'Unité Simple'}
                        </span>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="text-white/80 hover:text-white transition-colors cursor-pointer p-0.5"
                        title="Fermer"
                    >
                        <X className="w-4 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-3 sm:p-4 bg-gray-50/50 space-y-3">
                    
                    {/* 1. Barreau Supérieur : Identification & Badges */}
                    <div className="bg-white p-3 sm:p-4 border-2 border-gray-300 rounded-[4px] shadow-sm flex flex-wrap items-center justify-between gap-3">
                        <div className="space-y-1">
                            <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-blue-600/70">
                                Désignation de l'article
                            </p>
                            <h2 className="text-lg sm:text-xl font-bold text-[#001d35] tracking-wide uppercase">
                                {product.name}
                            </h2>
                            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                                <span className="bg-[#001d35]/10 text-[#001d35] font-semibold px-2 py-0.5 rounded-[4px] border border-[#001d35]/20">
                                    Catégorie : {product.category || 'Général'}
                                </span>
                                {product.supplier && (
                                    <span className="bg-gray-100 text-gray-700 font-semibold px-2 py-0.5 rounded-[4px] border border-gray-200 flex items-center gap-1">
                                        <Truck className="w-3.5 h-3.5 text-gray-500" />
                                        {product.supplier}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Code barre & Actions rapides */}
                        <div className="flex flex-col items-end gap-2">
                            {product.barcode ? (
                                <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-gray-700 bg-gray-50 px-2.5 py-1 rounded-[4px] border border-gray-300 shadow-2xs">
                                    <Barcode className="w-4 h-4 text-gray-500" />
                                    <span>{product.barcode}</span>
                                </div>
                            ) : (
                                <span className="text-gray-400 italic text-xs">Aucun code-barres</span>
                            )}
                            <div className="flex items-center gap-2">
                                {onAddToCart && (
                                    <button
                                        onClick={() => { onAddToCart(product); onClose(); }}
                                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[4px] text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer border border-emerald-700"
                                    >
                                        <ShoppingCart className="w-3.5 h-3.5" />
                                        <span>Ajouter Vente</span>
                                    </button>
                                )}
                                {onEdit && (
                                    <button
                                        onClick={() => { onEdit(product); onClose(); }}
                                        className="px-3 py-1.5 bg-[#001d35] hover:bg-blue-900 text-white rounded-[4px] text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer border border-[#001d35]"
                                    >
                                        <Edit3 className="w-3.5 h-3.5" />
                                        <span>Modifier</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 2. Grille Statistiques Clés : Stock Physique & Valeurs Financières (Identique au Dashboard) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {/* État du Stock */}
                        <div className="bg-white p-3 rounded-[4px] border-2 border-gray-300 shadow-sm relative group hover:shadow-md transition-shadow overflow-hidden min-h-[120px] flex flex-col justify-between">
                            <div>
                                <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-blue-600/70">
                                    Stock Disponible
                                </p>
                                <div className="flex items-baseline mt-2 font-semibold text-[#001d35] opacity-85">
                                    <h3 className="text-xl sm:text-2xl font-semibold">
                                        {isContainer 
                                            ? formatContainerStock(stockQty, cf, product.unit, subUnitLabel)
                                            : `${stockQty.toLocaleString('fr-FR')} ${product.unit || 'Pièce'}`
                                        }
                                    </h3>
                                </div>
                                {isContainer && (
                                    <p className="text-xs text-gray-500 mt-2 font-medium">
                                        Contenu net total : <strong className="text-[#001d35]">{stockBreakdown.exactTotalSubUnits.toLocaleString('fr-FR')} {subUnitLabel}</strong>
                                    </p>
                                )}
                            </div>
                            <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500 font-medium flex justify-between items-center">
                                <span>Seuil Min : <strong className="text-gray-700">{minStock} {product.unit}</strong></span>
                                <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-[4px] border ${
                                    isOutOfStock 
                                        ? 'bg-rose-50 text-rose-700 border-rose-200' 
                                        : isLowStock 
                                            ? 'bg-amber-50 text-amber-700 border-amber-200' 
                                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                }`}>
                                    {isOutOfStock ? 'Rupture' : isLowStock ? 'Stock Faible' : 'Optimal'}
                                </span>
                            </div>
                        </div>

                        {/* Prix de Vente Principal */}
                        <div className="bg-white p-3 rounded-[4px] border-2 border-gray-300 shadow-sm relative group hover:shadow-md transition-shadow overflow-hidden min-h-[120px] flex flex-col justify-between">
                            <div>
                                <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-blue-600/70">
                                    Prix de Vente Principal
                                </p>
                                <div className="flex items-baseline mt-2 font-semibold text-[#001d35] opacity-85">
                                    <h3 className="text-xl sm:text-2xl font-semibold">
                                        {formatPrice(price)}
                                    </h3>
                                </div>
                                <p className="text-xs text-gray-400 mt-2 font-medium">
                                    Par {product.unit || 'Unité standard'}
                                </p>
                            </div>
                            <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500 flex justify-between items-center font-medium">
                                <span>Marge brute :</span>
                                <strong className={`font-semibold ${marginRate >= 20 ? 'text-emerald-700' : 'text-amber-700'}`}>
                                    {marginRate.toFixed(1)}% ({formatPrice(unitMargin)})
                                </strong>
                            </div>
                        </div>

                        {/* Coût de Revient / Achat */}
                        <div className="bg-white p-3 rounded-[4px] border-2 border-gray-300 shadow-sm relative group hover:shadow-md transition-shadow overflow-hidden min-h-[120px] flex flex-col justify-between">
                            <div>
                                <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-blue-600/70">
                                    Prix d'Achat (PRU)
                                </p>
                                <div className="flex items-baseline mt-2 font-semibold text-[#001d35] opacity-85">
                                    <h3 className="text-xl sm:text-2xl font-semibold">
                                        {formatPrice(purchasePrice)}
                                    </h3>
                                </div>
                                <p className="text-xs text-gray-400 mt-2 font-medium">
                                    Coût unitaire d'acquisition
                                </p>
                            </div>
                            <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500 flex justify-between items-center font-medium">
                                <span>Valuation Stock :</span>
                                <strong className="text-gray-800 font-semibold">
                                    {formatPrice(stockValuation)}
                                </strong>
                            </div>
                        </div>

                        {/* Architecture / Modèle */}
                        <div className="bg-white p-3 rounded-[4px] border-2 border-gray-300 shadow-sm relative group hover:shadow-md transition-shadow overflow-hidden min-h-[120px] flex flex-col justify-between">
                            <div>
                                <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-blue-600/70">
                                    Type Conditionnement
                                </p>
                                <div className="flex items-baseline mt-2 font-semibold text-[#001d35] opacity-85">
                                    <h3 className="text-xl sm:text-2xl font-semibold">
                                        {archetype}
                                    </h3>
                                </div>
                                <p className="text-xs text-gray-400 mt-2 font-medium">
                                    {isContainer ? `1 ${product.unit} = ${cf} ${subUnitLabel}s` : 'Vente à la pièce directe'}
                                </p>
                            </div>
                            <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500 flex justify-between items-center font-medium">
                                <span>CA Potentiel :</span>
                                <strong className="text-gray-800 font-semibold">
                                    {formatPrice(retailValuation)}
                                </strong>
                            </div>
                        </div>
                    </div>

                    {/* 3. Section Canaux & Options de Vente Dédiée selon l'Archétype */}
                    <div className="bg-white border-2 border-gray-300 rounded-[4px] p-3 sm:p-4 shadow-sm space-y-3">
                        <div className="flex items-center justify-between border-b border-gray-200 pb-2.5">
                            <div className="flex items-center gap-2">
                                <Layers className="w-4 h-4 text-[#001d35]" />
                                <h3 className="text-sm font-semibold tracking-wide uppercase text-[11px] text-blue-600/70">
                                    Grille Tarifaire & Canaux de Vente Actifs
                                </h3>
                            </div>
                            <span className="text-[11px] font-medium text-gray-400">
                                Configuration de vente
                            </span>
                        </div>

                        {/* Tableau / Cartes des Canaux */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            
                            {/* Canal 1 : Vente Standard */}
                            <div className="p-3 bg-white border-2 border-gray-200 rounded-[4px] shadow-2xs flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-xs font-bold text-[#001d35] uppercase tracking-wider">
                                            1. Contenant Standard
                                        </span>
                                        <span className="bg-[#001d35] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-[4px]">
                                            PRINCIPAL
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-500 font-medium">
                                        Vente de base : 1 {product.unit || 'Unité'}
                                    </p>
                                </div>
                                <div className="mt-3 pt-2 border-t border-gray-200 flex items-center justify-between">
                                    <span className="text-xs text-gray-500 font-medium">Prix unitaire</span>
                                    <span className="text-sm font-semibold text-[#001d35]">
                                        {formatPrice(product.price)}
                                    </span>
                                </div>
                            </div>

                            {/* Canal 2 : Vente à la pièce (Si BOX) */}
                            {product.hasPiece && (
                                <div className="p-3 bg-blue-50/40 border-2 border-blue-200 rounded-[4px] shadow-2xs flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-xs font-bold text-blue-900 uppercase tracking-wider">
                                                2. Vente à la Pièce
                                            </span>
                                            <span className="bg-blue-700 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-[4px]">
                                                DÉTAIL
                                            </span>
                                        </div>
                                        <p className="text-xs text-blue-700 font-medium">
                                            1 {subUnitLabel} extraite du contenant
                                        </p>
                                    </div>
                                    <div className="mt-3 pt-2 border-t border-blue-200 flex items-center justify-between">
                                        <span className="text-xs text-blue-600 font-medium">Prix à la pièce</span>
                                        <span className="text-sm font-semibold text-blue-950">
                                            {formatPrice(product.piecePrice)}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Canal 3 : Vente en Gros / Carton (Si gros configuré) */}
                            {product.bulkPrice && (
                                <div className="p-3 bg-purple-50/40 border-2 border-purple-200 rounded-[4px] shadow-2xs flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-xs font-bold text-purple-900 uppercase tracking-wider">
                                                Vente en Gros
                                            </span>
                                            <span className="bg-purple-700 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-[4px]">
                                                GROS
                                            </span>
                                        </div>
                                        <p className="text-xs text-purple-700 font-medium">
                                            Par {product.bulkUnit || 'Carton / Pack'}
                                        </p>
                                    </div>
                                    <div className="mt-3 pt-2 border-t border-purple-200 flex items-center justify-between">
                                        <span className="text-xs text-purple-600 font-medium">Prix de gros</span>
                                        <span className="text-sm font-semibold text-purple-950">
                                            {formatPrice(product.bulkPrice)}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Canal 4 : Vente par Petits Lots (Multi-Lots) */}
                            {product.hasLot && product.lotPrice && (
                                <div className="p-3 bg-amber-50/40 border-2 border-amber-200 rounded-[4px] shadow-2xs flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                                                Option Petit Lot (Palier 1)
                                            </span>
                                            <span className="bg-amber-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-[4px]">
                                                LOT
                                            </span>
                                        </div>
                                        <p className="text-xs text-amber-700 font-medium">
                                            Lot de {product.retailStepQuantity || 10} {subUnitLabel}s
                                        </p>
                                    </div>
                                    <div className="mt-3 pt-2 border-t border-amber-200 flex items-center justify-between">
                                        <span className="text-xs text-amber-700 font-medium">Prix du lot</span>
                                        <span className="text-sm font-semibold text-amber-950">
                                            {formatPrice(product.lotPrice)}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Autres Paliers de Lots ou Conditionnements Définis */}
                            {product.packagings?.map((pkg, idx) => (
                                <div key={pkg.id || pkg.modelId || idx} className="p-3 bg-emerald-50/40 border-2 border-emerald-200 rounded-[4px] shadow-2xs flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider truncate">
                                                {pkg.name || `Option ${idx + 1}`}
                                            </span>
                                            <span className="bg-emerald-700 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-[4px]">
                                                {archetype === 'BOX' ? 'LOT' : 'FRACTIONNÉ'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-emerald-700 font-medium">
                                            Qté : {pkg.targetQty || '—'} {subUnitLabel}s
                                        </p>
                                    </div>
                                    <div className="mt-3 pt-2 border-t border-emerald-200 flex items-center justify-between">
                                        <span className="text-xs text-emerald-600 font-medium">Tarif</span>
                                        <span className="text-sm font-semibold text-emerald-950">
                                            {formatPrice(pkg.price)}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 4. Détails Techniques & Logistique */}
                    <div className="bg-white border-2 border-gray-300 rounded-[4px] p-3 sm:p-4 shadow-sm">
                        <h4 className="text-sm font-semibold tracking-wide uppercase text-[11px] text-blue-600/70 mb-2.5">
                            Spécifications Techniques & Données Internes
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                            <div className="bg-gray-50 p-2.5 rounded-[4px] border border-gray-200">
                                <span className="text-[10px] text-gray-400 font-semibold block uppercase">Identifiant interne (UUID)</span>
                                <span className="font-mono text-gray-700 font-medium truncate block mt-0.5">{product.id}</span>
                            </div>
                            <div className="bg-gray-50 p-2.5 rounded-[4px] border border-gray-200">
                                <span className="text-[10px] text-gray-400 font-semibold block uppercase">Unité de Base</span>
                                <span className="font-semibold text-[#001d35] block mt-0.5">{product.unit || 'Unité'}</span>
                            </div>
                            <div className="bg-gray-50 p-2.5 rounded-[4px] border border-gray-200">
                                <span className="text-[10px] text-gray-400 font-semibold block uppercase">Facteur de Conversion</span>
                                <span className="font-semibold text-[#001d35] block mt-0.5">{cf} {subUnitLabel} / {product.unit}</span>
                            </div>
                            <div className="bg-gray-50 p-2.5 rounded-[4px] border border-gray-200">
                                <span className="text-[10px] text-gray-400 font-semibold block uppercase">Sous-Unité Associée</span>
                                <span className="font-semibold text-[#001d35] block mt-0.5">{subUnitLabel}</span>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div className="p-3 sm:p-4 bg-slate-100 border-t-2 border-slate-300 flex items-center justify-between flex-shrink-0">
                    <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
                        Double-clic sur une ligne du catalogue pour ouvrir cette fiche.
                    </span>
                    <button 
                        onClick={onClose}
                        className="px-6 py-2 rounded-[4px] font-bold bg-[#001d35] text-white hover:bg-blue-900 border border-[#001d35] text-xs uppercase tracking-wider transition-all active:scale-95 cursor-pointer ml-auto"
                    >
                        Fermer la Fiche
                    </button>
                </div>

            </div>
        </div>
    );
};

export default ProductDetailModal;
