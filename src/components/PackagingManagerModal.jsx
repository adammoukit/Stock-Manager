import React, { useState } from 'react';
import { 
    X, Plus, Trash2, Package, Info, Save, Box, 
    Layers, Check, AlertCircle
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { getUnitModel } from '../config/unitModels';
import { formatPrice } from '../utils/currency';
import FinancialInput from './FinancialInput';
import T from '../utils/toast';

const PackagingManagerModal = ({ product, onClose, onSave }) => {
    const { deconditionModels } = useInventory();
    const unitModel = getUnitModel(product.unit);
    const archetype = product.unitArchetype || unitModel?.archetype || 'UNIT';

    const [packagings, setPackagings] = useState(
        Array.isArray(product.packagings) ? product.packagings.map(p => ({ ...p })) : []
    );
    const [hasPiece, setHasPiece] = useState(product.hasPiece || false);
    const [piecePrice, setPiecePrice] = useState(product.piecePrice || '');
    const [hasLot, setHasLot] = useState(product.hasLot || false);
    const [lotPrice, setLotPrice] = useState(product.lotPrice || '');
    const [retailStepQuantity, setRetailStepQuantity] = useState(product.retailStepQuantity || 10);
    const [isSaving, setIsSaving] = useState(false);

    const conversionFactor = parseFloat(product.conversionFactor) || 1;

    // Résolution STRICTE et EXACTE de la sous-unité canonique :
    // 1. Le modèle canonique de l'unité fait TOUJOURS autorité absolue (Bobine/Rouleau -> Mètre, Sac de ciment -> Kilo, Boîte -> Pièce)
    // 2. Si le modèle est générique 'L/Kg' (ex: Pot, Bidon), on vérifie si l'article est un liquide (Litre) ou une masse (Kg)
    // 3. Ne JAMAIS laisser un champ legacy comme bulkUnit: 'Kg' polluer un produit de type Bobine ou Boîte !
    const subUnitLabel = (() => {
        if (unitModel?.subUnit && unitModel.subUnit !== 'L/Kg') {
            return unitModel.subUnit;
        }
        if (unitModel?.subUnit === 'L/Kg') {
            return (product.subUnit && product.subUnit !== 'L/Kg') ? product.subUnit : 'Litre';
        }
        return product.subUnit || (archetype === 'BOX' ? 'Pièce' : 'unité');
    })();
    const basePrice = parseFloat(product.price) || 0;

    // Formater quantité + sous-unité avec accord pluriel automatique (ex: 100 Mètres, 1 Mètre, 50 Kilos)
    const formatSubUnitWithQty = (qty, unit) => {
        const q = parseFloat(qty);
        if (!unit || isNaN(q)) return `${qty}`;
        if (q > 1 && !unit.endsWith('s') && !unit.endsWith('x') && unit !== 'L/Kg') {
            return `${qty} ${unit}s`;
        }
        return `${qty} ${unit}`;
    };

    // Type Badge info
    const typeInfo = (() => {
        switch (archetype) {
            case 'BOX': return {
                label: 'Boîte / Carton (Contenant Pièces)',
                badge: 'BOX',
                sub: `Unité interne contenue : ${unitModel?.subUnit || 'Pièce'}`,
                desc: 'Vente par boîte entière ou par lots de pièces / déconditionnements.',
                bgClass: 'bg-blue-50 border-blue-200 text-blue-800'
            };
            case 'BULK': return {
                label: 'Vrac / Poids / Contenance',
                badge: 'BULK',
                sub: `Sous-unité de mesure : ${subUnitLabel} (1 ${product.unit || 'Sac'} = ${formatSubUnitWithQty(conversionFactor, subUnitLabel)})`,
                desc: `Vente par ${product.unit || 'unité'} ou fractionné au détail (ex: au mètre, au kilo, ou montant précis).`,
                bgClass: 'bg-amber-50 border-amber-200 text-amber-800'
            };
            default: return {
                label: 'Unité Simple (Produit Unique)',
                badge: 'UNIT',
                sub: `Vendu directement à l'unité (${product.unit || 'Pièce'})`,
                desc: 'Produit unique vendu tel quel. Aucun conditionnement ou déconditionnement n\'est proposé.',
                bgClass: 'bg-slate-50 border-slate-200 text-slate-800'
            };
        }
    })();

    // Ajouter un conditionnement vide tout en haut de la liste pour visibilité immédiate
    const addEmptyPackaging = () => {
        const newId = `pkg_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
        if (archetype === 'BOX' && deconditionModels?.length > 0) {
            const usedIds = packagings.map(p => p.modelId);
            const avail = deconditionModels.filter(m => !usedIds.includes(m.id));
            if (avail.length > 0) {
                setPackagings(prev => [
                    {
                        modelId: avail[0].id,
                        targetQty: '',
                        deductionRatio: '',
                        price: '',
                        name: avail[0].name,
                    },
                    ...prev
                ]);
                return;
            }
        }
        setPackagings(prev => [
            {
                modelId: newId,
                targetQty: '',
                deductionRatio: '',
                price: '',
                name: '',
            },
            ...prev
        ]);
    };

    const removePackaging = (modelId) => {
        setPackagings(prev => prev.filter(p => p.modelId !== modelId));
    };

    const updatePkg = (modelId, key, value) => {
        setPackagings(prev => prev.map(p => {
            if (p.modelId !== modelId) return p;
            const updated = { ...p, [key]: value };

            if (key === 'targetQty') {
                const val = parseFloat(value) || 0;
                if (archetype === 'BULK') {
                    updated.deductionRatio = val > 0 && conversionFactor > 0 ? (val / conversionFactor) : '';
                    if (!updated.name || updated.name.toLowerCase().includes(subUnitLabel.toLowerCase())) {
                        updated.name = val > 0 ? formatSubUnitWithQty(val, subUnitLabel) : '';
                    }
                    if (!updated.price && basePrice > 0 && val > 0 && conversionFactor > 0) {
                        updated.price = Math.round((val / conversionFactor) * basePrice);
                    }
                } else if (archetype === 'BOX') {
                    updated.deductionRatio = val > 0 && conversionFactor > 0 ? (val / conversionFactor) : val;
                    if (!updated.name || updated.name.startsWith('Lot de')) {
                        updated.name = val > 0 ? `Lot de ${formatSubUnitWithQty(val, subUnitLabel)}` : '';
                    }
                }
            }

            if (key === 'modelId' && archetype === 'BOX') {
                const model = deconditionModels?.find(m => m.id === value);
                if (model) {
                    updated.name = model.name;
                    updated.modelId = value;
                }
            }

            return updated;
        }));
    };

    const handleSave = () => {
        if (archetype === 'UNIT') {
            onClose();
            return;
        }

        const normalized = packagings.map(p => {
            let name = p.name ? p.name.trim() : '';
            if (!name && p.targetQty) {
                name = formatSubUnitWithQty(p.targetQty, subUnitLabel);
            }
            return { ...p, name };
        });

        const missingName = normalized.some(p => !p.name || p.name.trim() === '');
        if (missingName) {
            T.warning("Veuillez renseigner un libellé ou une quantité pour chaque conditionnement (ex: 10 Kilo, 500 FCFA).");
            return;
        }

        const invalid = normalized.some(p => !p.price || parseFloat(p.price) <= 0);
        if (invalid) {
            T.warning("Chaque conditionnement doit comporter un prix de vente valide supérieur à 0.");
            return;
        }

        // Afficher le loader pendant 3 secondes avant de fermer la modale
        setIsSaving(true);
        setTimeout(() => {
            onSave({
                packagings: normalized,
                hasPiece,
                piecePrice: hasPiece ? parseFloat(piecePrice) || 0 : null,
                hasLot,
                lotPrice: hasLot ? parseFloat(lotPrice) || 0 : null,
                retailStepQuantity: hasLot ? parseInt(retailStepQuantity) || 10 : product.retailStepQuantity,
            });
            setIsSaving(false);
            onClose();
        }, 3000);
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl border-2 border-[#001d35] rounded-none overflow-hidden animate-in zoom-in-95 duration-150">

                {/* En-tête Moderne ERP */}
                <div className="bg-[#001d35] px-5 py-3.5 flex items-center justify-between flex-shrink-0 text-white border-b-2 border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/15 p-2 rounded-none border border-white/20">
                            <Box className="w-5 h-5 text-amber-400" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-white font-black uppercase tracking-wider text-sm">Gestion des Conditionnements</h2>
                                <span className="bg-white/20 text-white font-mono text-[10px] px-1.5 py-0.5 rounded-none font-bold">
                                    {typeInfo.badge}
                                </span>
                            </div>
                            <p className="text-white/70 text-[11px] font-medium mt-0.5 truncate max-w-md">
                                {product.name} {product.category ? `• ${product.category}` : ''}
                            </p>
                        </div>
                    </div>
                    {!isSaving && (
                        <button 
                            onClick={onClose} 
                            className="p-1.5 hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
                            title="Fermer"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>

                {/* Corps de la Modale */}
                {isSaving ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 bg-white min-h-[380px]">
                        <div className="flex flex-col items-center gap-5 bg-white px-10 py-8 rounded-sm shadow-2xl border border-gray-100 animate-in fade-in duration-150">
                            <div className="w-14 h-14 border-4 border-[#001d35]/20 border-t-[#001d35] rounded-full animate-spin"></div>
                            <div className="text-center">
                                <p className="text-gray-900 font-bold text-base">
                                    Enregistrement des conditionnements...
                                </p>
                                <p className="text-gray-500 text-sm mt-1">
                                    Mise à jour des stocks et des tarifs en cours
                                </p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/50">

                        {/* 1. Type de Conditionnement Détecté (Placé tout en haut) */}
                        <div className={`p-3 border-2 flex items-start gap-3 ${typeInfo.bgClass}`}>
                            <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-current opacity-80" />
                            <div className="flex-1 text-xs">
                                <div className="flex items-center gap-2 font-bold uppercase tracking-wide">
                                    <span>Type de Conditionnement : {typeInfo.label}</span>
                                </div>
                                <p className="mt-0.5 font-medium opacity-90">{typeInfo.sub}</p>
                                <p className="text-[11px] mt-1 opacity-80">{typeInfo.desc}</p>
                            </div>
                        </div>

                        {/* 2. Informations Clés Produit */}
                        <div className="grid grid-cols-3 gap-3 bg-white p-3 border-2 border-slate-200 shadow-2xs">
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Unité Principale</p>
                                <p className="text-sm font-black text-[#001d35] mt-0.5">{product.unit || 'Unité'}</p>
                                {conversionFactor > 1 && (
                                    <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                                        = {formatSubUnitWithQty(conversionFactor, subUnitLabel)}
                                    </p>
                                )}
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Prix de Vente Base</p>
                                <p className="text-sm font-black text-[#001d35] mt-0.5">{formatPrice(basePrice)}</p>
                                <p className="text-[10px] text-slate-400">par {product.unit || 'unité'}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Stock Actuel</p>
                                <p className="text-sm font-black text-emerald-700 mt-0.5">
                                    {product.stockLevels?.[product.currentStoreId] ?? product.stock ?? 0} {product.unit || 'unités'}
                                </p>
                                {conversionFactor > 1 && (
                                    <p className="text-[10px] text-emerald-600 font-medium">
                                        ≈ {formatSubUnitWithQty(((product.stockLevels?.[product.currentStoreId] ?? product.stock ?? 0) * conversionFactor).toLocaleString(), subUnitLabel)}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* 3. Section Conditionnements OU Alerte Produit Unique (UNIT) */}
                        {archetype === 'UNIT' ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center bg-white border-2 border-slate-200 p-8 space-y-3 shadow-2xs">
                                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                    <Package className="w-6 h-6" />
                                </div>
                                <p className="text-sm font-black text-[#001d35] uppercase tracking-wide">
                                    Produit Unique à Unité Simple
                                </p>
                                <p className="text-xs text-slate-500 max-w-md leading-relaxed">
                                    Ce produit est vendu exclusivement sous son unité principale (<strong>{product.unit || 'Pièce'}</strong>). 
                                    Aucune option de conditionnement ou de déconditionnement n'est proposée pour les articles à unité simple.
                                </p>
                            </div>
                        ) : (
                            <>
                                {/* Option Vente à la Pièce (BOX uniquement) */}
                                {archetype === 'BOX' && (
                                    <div className="bg-white border-2 border-blue-200 p-4 space-y-3 shadow-2xs">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-xs font-black text-[#001d35] uppercase tracking-wider">Option Vente à la Pièce</p>
                                                <p className="text-[11px] text-slate-500 mt-0.5">Permet de vendre à l'unité ({unitModel?.subUnit || 'pièce'}) depuis la boîte</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setHasPiece(v => !v)}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${hasPiece ? 'bg-[#001d35]' : 'bg-slate-300'}`}
                                            >
                                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${hasPiece ? 'translate-x-6' : 'translate-x-1'}`} />
                                            </button>
                                        </div>
                                        {hasPiece && (
                                            <div className="pt-3 border-t border-slate-100">
                                                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1 block">
                                                    Prix de vente unitaire à la pièce (FCFA)
                                                </label>
                                                <FinancialInput
                                                    min="0"
                                                    value={piecePrice}
                                                    onChange={e => setPiecePrice(e.target.value)}
                                                    className="w-full px-3 py-2 text-sm border-2 border-slate-300 focus:outline-none focus:border-[#001d35] font-bold text-[#001d35] bg-white"
                                                    placeholder="Ex: 50"
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Option Vente en Lot (BOX uniquement) */}
                                {archetype === 'BOX' && (
                                    <div className="bg-white border-2 border-blue-200 p-4 space-y-3 shadow-2xs">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-xs font-black text-[#001d35] uppercase tracking-wider">Option Vente en Petit Lot</p>
                                                <p className="text-[11px] text-slate-500 mt-0.5">Permet de vendre un lot groupé de pièces internes déconditionnées</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setHasLot(v => !v)}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${hasLot ? 'bg-[#001d35]' : 'bg-slate-300'}`}
                                            >
                                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${hasLot ? 'translate-x-6' : 'translate-x-1'}`} />
                                            </button>
                                        </div>
                                        {hasLot && (
                                            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                                                <div>
                                                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1 block">
                                                        Taille du lot ({unitModel?.subUnit || 'pièces'})
                                                    </label>
                                                    <input
                                                        type="number" min="1"
                                                        value={retailStepQuantity}
                                                        onChange={e => setRetailStepQuantity(e.target.value)}
                                                        className="w-full px-3 py-2 text-sm border-2 border-slate-300 focus:outline-none focus:border-[#001d35] font-semibold bg-white"
                                                        placeholder="Ex: 10"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1 block">
                                                        Prix du lot (FCFA)
                                                    </label>
                                                    <FinancialInput
                                                        min="0"
                                                        value={lotPrice}
                                                        onChange={e => setLotPrice(e.target.value)}
                                                        className="w-full px-3 py-2 text-sm border-2 border-slate-300 focus:outline-none focus:border-[#001d35] font-bold text-[#001d35] bg-white"
                                                        placeholder="Ex: 600"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Liste des Conditionnements Personnalisés */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                                                Conditionnements Disponibles ({packagings.length})
                                            </h3>
                                            <span className="text-[10px] text-slate-400 font-semibold">
                                                (affichés dans le panier POS et lors de la vente)
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={addEmptyPackaging}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#001d35] hover:bg-blue-900 text-white text-xs font-bold uppercase tracking-wider transition-all shadow-2xs cursor-pointer active:scale-95"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            Nouveau Conditionnement
                                        </button>
                                    </div>

                                    {packagings.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-8 text-center bg-white border-2 border-dashed border-slate-300 p-6">
                                            <Box className="w-10 h-10 text-slate-300 mb-2" />
                                            <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Aucun conditionnement configuré</p>
                                            <p className="text-[11px] text-slate-400 mt-1 max-w-sm">
                                                Cliquez sur « Nouveau Conditionnement » pour ajouter une option de vente (ex: 10 Kilo, 100 FCFA, 500 FCFA...).
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {packagings.map((pkg, idx) => {
                                                const parsedRatio = parseFloat(pkg.deductionRatio) || 0;
                                                const parsedPrice = parseFloat(pkg.price) || 0;

                                                return (
                                                    <div key={pkg.modelId || idx} className="bg-white border-2 border-slate-300 p-4 shadow-2xs relative group hover:border-[#001d35] transition-colors">
                                                        <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                                                            <div className="flex items-center gap-2">
                                                                <span className="bg-[#001d35] text-white font-mono text-[10px] px-1.5 py-0.5 font-bold">
                                                                    #{idx + 1}
                                                                </span>
                                                                <span className="text-xs font-black text-[#001d35] uppercase">
                                                                    {pkg.name || 'Conditionnement sans nom'}
                                                                </span>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => removePackaging(pkg.modelId)}
                                                                className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                                                title="Supprimer cette option"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>

                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                            {/* Libellé du conditionnement */}
                                                            <div>
                                                                <div className="flex items-center justify-between mb-1">
                                                                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                                                                        Nom de l'option
                                                                    </label>
                                                                    <span className="text-[9px] text-slate-400 font-medium">
                                                                        {pkg.targetQty ? '(auto si vide)' : '(ou montant)'}
                                                                    </span>
                                                                </div>
                                                                <input
                                                                    type="text"
                                                                    value={pkg.name}
                                                                    onChange={e => updatePkg(pkg.modelId, 'name', e.target.value)}
                                                                    className="w-full px-2.5 py-1.5 text-xs border-2 border-slate-300 focus:outline-none focus:border-[#001d35] font-bold text-slate-800 bg-white"
                                                                    placeholder={pkg.targetQty ? `Auto: ${formatSubUnitWithQty(pkg.targetQty, subUnitLabel)}` : `Ex: 10 ${subUnitLabel} ou 500 FCFA`}
                                                                />
                                                            </div>

                                                            {/* Quantité ou Nb de sous-unités */}
                                                            <div>
                                                                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide mb-1 block">
                                                                    Quantité ({subUnitLabel})
                                                                </label>
                                                                <input
                                                                    type="number"
                                                                    step="any"
                                                                    min="0"
                                                                    value={pkg.targetQty || ''}
                                                                    onChange={e => updatePkg(pkg.modelId, 'targetQty', e.target.value)}
                                                                    className="w-full px-2.5 py-1.5 text-xs border-2 border-slate-300 focus:outline-none focus:border-[#001d35] font-semibold text-slate-800 bg-white"
                                                                    placeholder={`Ex: 10`}
                                                                />
                                                            </div>

                                                            {/* Prix de Vente */}
                                                            <div>
                                                                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wide mb-1 block">
                                                                    Prix de Vente (FCFA)
                                                                </label>
                                                                <FinancialInput
                                                                    min="0"
                                                                    value={pkg.price || ''}
                                                                    onChange={e => updatePkg(pkg.modelId, 'price', e.target.value)}
                                                                    className="w-full px-2.5 py-1.5 text-xs border-2 border-slate-300 focus:outline-none focus:border-[#001d35] font-black text-[#001d35] bg-white"
                                                                    placeholder="Ex: 500"
                                                                />
                                                            </div>
                                                        </div>

                                                        {/* Détail de la déduction sur le stock principal */}
                                                        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                                                            <div className="text-slate-500 font-medium flex items-center gap-1.5">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-[#001d35]" />
                                                                <span>Impact Stock : </span>
                                                                {parsedRatio > 0 ? (
                                                                    <strong className="text-amber-700 font-bold">
                                                                        Retire {parsedRatio.toFixed(3)} {product.unit || 'sac'} par vente
                                                                        {conversionFactor > 1 && (
                                                                            <span className="text-slate-500 font-normal">
                                                                                {' '}(≈ {(parsedRatio * conversionFactor).toFixed(1)} {subUnitLabel})
                                                                            </span>
                                                                        )}
                                                                    </strong>
                                                                ) : (
                                                                    <span className="text-slate-400 italic">Déduction standard</span>
                                                                )}
                                                            </div>
                                                            {parsedPrice > 0 && (
                                                                <span className="font-black text-[#001d35]">
                                                                    {formatPrice(parsedPrice)}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Pied de Page / Boutons Actions */}
                {!isSaving && (
                    <div className="px-5 py-3.5 border-t-2 border-slate-200 flex items-center justify-between flex-shrink-0 bg-white">
                        {archetype === 'UNIT' ? (
                            <div className="flex items-center justify-between w-full">
                                <p className="text-[11px] text-slate-500 font-medium">
                                    Produit à unité simple : vente unitaire classique uniquement.
                                </p>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-5 py-2 bg-[#001d35] hover:bg-blue-900 text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                                >
                                    Fermer
                                </button>
                            </div>
                        ) : (
                            <>
                                <p className="text-[11px] text-slate-500 font-medium">
                                    * Les conditionnements créés seront directement sélectionnables lors de l'ajout au panier.
                                </p>
                                <div className="flex items-center gap-2.5">
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="px-4 py-2 border-2 border-slate-300 text-slate-700 text-xs font-bold uppercase tracking-wider hover:bg-slate-100 transition-colors cursor-pointer"
                                    >
                                        Annuler
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSave}
                                        className="flex items-center gap-2 px-5 py-2 bg-[#001d35] hover:bg-blue-900 text-white text-xs font-bold uppercase tracking-wider transition-all shadow-sm cursor-pointer active:scale-95"
                                    >
                                        <Save className="w-4 h-4 text-amber-400" />
                                        Enregistrer les Conditionnements
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}

            </div>
        </div>
    );
};

export default PackagingManagerModal;
