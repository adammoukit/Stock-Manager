import React, { useState, useEffect } from 'react';
import { X, Save, Info, Calculator, ArrowLeft, Package, Search, Check, RefreshCcw } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { useSettings } from '../context/SettingsContext';
import { getUnitModel } from '../config/unitModels';
import { TAXONOMY } from '../config/taxonomy';

const ProductModal = ({ product, onClose, onSave }) => {
    const { products, deconditionModels } = useInventory();
    const { currentStoreId } = useSettings();
    const suppliers = [...new Set(products.map(p => p.supplier).filter(Boolean))];


    const [showUnitInfo, setShowUnitInfo] = useState(false);
    const [showRetailInfo, setShowRetailInfo] = useState(false);
    const [showBulkInfo, setShowBulkInfo] = useState(false);
    const [showStockInfo, setShowStockInfo] = useState(false);
    const [showAllModels, setShowAllModels] = useState(false);
    const [isLoading, setIsLoading] = useState(false);


    const [formData, setFormData] = useState({
        name: '',
        category: '',
        price: '',
        purchasePrice: '',
        bulkPurchasePrice: '',
        stock: '',
        minStock: '',
        supplier: '',
        unit: 'Unité',
        unitArchetype: 'UNIT',
        hasLot: false,
        lotPrice: '',
        retailStepQuantity: 10,
        bulkUnit: '',
        bulkPrice: '',
        conversionFactor: '',
        hasSubUnit: false,
        packagings: []
    });

    // Removed unused currentUnitType
    const currentUnitModel = getUnitModel(formData?.unit || 'Unité');
    // Assistant de saisie (Conditionnement)
    const [helperParams, setHelperParams] = useState({
        qtyPerContainer: '',
        containerCount: ''
    });

    useEffect(() => {
        if (product) {
            const factor = parseFloat(product.conversionFactor) || 1;
            const stockQty = product.stockLevels?.[currentStoreId] ?? product.stock ?? 0;

            // On essaie de reconstruire les paramètres de l'assistant si possible
            let initialQtyPerContainer = '';
            let initialContainerCount = '';

            if (product.unitArchetype === 'BOX' || product.unitArchetype === 'BULK') {
                initialQtyPerContainer = factor;
                initialContainerCount = stockQty;
            }

            setFormData({
                name: product.name || '',
                category: product.category || '',
                price: product.price || '',
                purchasePrice: product.purchasePrice || '',
                bulkPurchasePrice: product.bulkPurchasePrice || '',
                stock: stockQty,
                minStock: product.minStock || 0,
                supplier: product.supplier || '',
                unit: product.unit || 'Unité',
                unitArchetype: product.unitArchetype || 'UNIT',
                hasLot: product.hasLot || false,
                lotPrice: product.lotPrice || '',
                retailStepQuantity: product.retailStepQuantity || 10,
                bulkUnit: product.bulkUnit || '',
                bulkPrice: product.bulkPrice || '',
                conversionFactor: factor,
                hasSubUnit: product.hasSubUnit || (product.packagings && product.packagings.length > 0) || false,
                packagings: product.packagings || []
            });

            setHelperParams({
                qtyPerContainer: initialQtyPerContainer,
                containerCount: initialContainerCount
            });
        }
    }, [product, currentStoreId]);

    // Lock body scroll when modal is open
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = 'unset'; };
    }, []);

    const togglePackaging = (modelId) => {
        setFormData(prev => {
            const exists = prev.packagings.find(p => p.modelId === modelId);
            if (exists) {
                return { ...prev, packagings: prev.packagings.filter(p => p.modelId !== modelId) };
            } else {
                return { ...prev, packagings: [...prev.packagings, { modelId, deductionRatio: '', targetQty: '', price: '' }] };
            }
        });
    };

    const updatePackagingParams = (modelId, key, value) => {
        setFormData(prev => ({
            ...prev,
            packagings: prev.packagings.map(p => p.modelId === modelId ? { ...p, [key]: value } : p)
        }));
    };

    const handleSelectTaxonomy = (family, subCategory) => {
        const defaultUnit = subCategory.defaults.unit || 'Unité';
        setFormData(prev => ({
            ...prev,
            category: subCategory.name,
            unit: defaultUnit,
            unitArchetype: getUnitArchetype(defaultUnit),
            bulkUnit: subCategory.defaults.bulkUnit || '',
            hasLot: subCategory.defaults.retailStepQuantity > 1,
            retailStepQuantity: subCategory.defaults.retailStepQuantity || 10,
            hasSubUnit: subCategory.defaults.hasSubUnit || false,
            subUnitName: subCategory.defaults.subUnitName || '',
            subUnitConversion: subCategory.defaults.subUnitConversion || ''
        }));
        setSelectedFamily(family);
        setStep(3);
        setTaxonomySearch("");
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        const val = name === 'name' ? value.toUpperCase() : value;
        setFormData(prev => ({ ...prev, [name]: val }));
    };

    // Auto-calculate purchase price from bulk price / count
    // purchasePrice = gros / count (coût de l'unité de base)
    const handleBulkPriceOrContenanceChange = (e) => {
        const { name, value } = e.target;
        const updated = { ...formData, [name]: value };
        const bulk = parseFloat(name === 'bulkPurchasePrice' ? value : formData.bulkPurchasePrice);

        let divider = null;
        if (currentUnitModel.archetype === 'UNIT') {
            const contenance = parseFloat(name === 'conversionFactor' ? value : formData.conversionFactor);
            updated.stock = contenance || 0;
            divider = contenance;
        } else {
            divider = parseFloat(formData.stock);
        }

        if (!isNaN(bulk) && divider && divider > 0) {
            const unitCost = bulk / divider;
            updated.purchasePrice = Math.round(unitCost);
        }
        setFormData(updated);
    };

    const handleAssistantChange = (field, value) => {
        const newParams = { ...helperParams, [field]: value };
        setHelperParams(newParams);

        const per = parseFloat(newParams.qtyPerContainer);
        const count = parseFloat(newParams.containerCount);

        if (!isNaN(per) && !isNaN(count)) {
            // Logique intelligente basée sur l'archétype d'unité
            let totalStock; // La quantité réelle en "Unité de base" à ajouter au stock

            if (formData.unitArchetype === 'BOX') {
                // Pour une boîte de 100 vis : on reçoit 5 boîtes -> 500 unités en stock
                totalStock = per * count;
            } else if (formData.unitArchetype === 'BULK') {
                // Pour un sac de 50kg : on reçoit 10 sacs -> 500 kg en stock
                totalStock = per * count;
            } else {
                // Pour les unités simples : on reçoit 10 marteaux -> 10 unités en stock
                totalStock = count;
            }

            // Calcul du prix de revient basé sur l'unité de base (Boîte/Sac/Unité)
            const bulkPrice = parseFloat(formData.bulkPurchasePrice);
            let newPurchasePrice = formData.purchasePrice;

            if (!isNaN(bulkPrice) && count > 0) {
                // Le coût unitaire est celui de la "Boîte" ou du "Sac" puisque c'est l'unité de base
                const containerCost = bulkPrice / count;
                newPurchasePrice = Math.round(containerCost).toString();
            }

            setFormData(prev => ({
                ...prev,
                stock: count.toString(),
                conversionFactor: per.toString(),
                bulkUnit: prev.bulkUnit === '' && formData.unitArchetype === 'BOX' ? 'Pièce' : prev.bulkUnit,
                purchasePrice: newPurchasePrice
            }));
        }
    };

    // Lot quantity change doesn't alter base purchase price anymore
    const handleLotQtyChange = (e) => {
        const { value } = e.target;
        setFormData(prev => ({ ...prev, retailStepQuantity: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        setIsLoading(true);
        setTimeout(() => {
            onSave({
                ...formData,
                id: product?.id, // Assurer que l'ID est conservé
                price: parseFloat(formData.price),
                purchasePrice: parseFloat(formData.purchasePrice) || 0,
                bulkPurchasePrice: formData.bulkPurchasePrice ? parseFloat(formData.bulkPurchasePrice) : null,
                stock: parseFloat(formData.stock),
                minStock: parseFloat(formData.minStock),
                hasLot: formData.hasLot,
                lotPrice: formData.hasLot ? parseFloat(formData.lotPrice) : null,
                retailStepQuantity: formData.hasLot ? (parseFloat(formData.retailStepQuantity) || 10) : 1,
                bulkPrice: formData.bulkPrice ? parseFloat(formData.bulkPrice) : null,
                conversionFactor: parseFloat(formData.conversionFactor) || 1,
                helperParams: helperParams, // Sauvegarder pour l'édition
                hasSubUnit: formData.hasSubUnit,
                subUnitName: formData.hasSubUnit ? formData.subUnitName : null,
                subUnitConversion: formData.hasSubUnit ? (parseFloat(formData.subUnitConversion) || 1) : null,
                subUnitPrice: formData.hasSubUnit ? (parseFloat(formData.subUnitPrice) || 0) : null
            });
            setIsLoading(false);
        }, 2000);
    };

    // Computed helpers
    const lotQty = parseFloat(formData.retailStepQuantity) || 1;
    const detailUnits = ['Unité', 'Pièce', 'Kg', 'Mètre', 'Sac de ciment', 'Litre', 'Seau', 'M²', 'Cartouche', 'Bidon', 'Barre', 'Bobine', 'Couronne', 'Boîte', 'Carton'];
    const bulkUnits = ['Paquet', 'Boîte', 'Carton', 'Bobine', 'Fût', 'Bidon', 'Sac de ciment', 'Rouleau', 'Botte', 'Pot', 'Tonne'];

    // ─── RENDUS DES ETAPES ───


    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="rounded-sm border-2 border-gray-300 shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden" style={{ backgroundColor: '#e8eef4' }}>
                <div className="flex justify-between items-center p-6 border-b-2 border-gray-300 flex-shrink-0" style={{ backgroundColor: '#e6ecf2' }}>
                    <div className="flex items-center gap-3">
                        <h2 className="text-lg font-semibold text-gray-900 uppercase tracking-tight">
                            {product ? 'Modifier le produit' : 'Nouveau produit'}
                        </h2>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="overflow-y-auto w-full">
                    <form onSubmit={handleSubmit} className="p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                            {/* ── Nom ── */}
                            <div className="col-span-2">
                                <label className="flex items-center gap-3 text-[12px] font-semibold text-[#1c398e] uppercase tracking-wide mb-2">
                                    NOM DU PRODUIT
                                </label>
                                <p className="text-xs text-gray-500 mb-2">Désignation complète du produit et sa marque</p>
                                <input
                                    type="text"
                                    name="name"
                                    required
                                    value={formData.name}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-[#1c398e]/50 bg-white"
                                    placeholder="Ex: Ciment gris 35kg"
                                />
                            </div>

                            {/* ── Catégorie ── */}
                            <div>
                                <label className="flex items-center gap-3 text-[12px] font-semibold text-[#1c398e] uppercase tracking-wide mb-2">
                                    CATÉGORIE / TYPE
                                </label>
                                <p className="text-xs text-gray-500 mb-2">Sélectionnez la catégorie du produit</p>
                                <select
                                    name="category"
                                    required
                                    value={formData.category}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-[#1c398e]/50 bg-white"
                                >
                                    <option value="" disabled>Sélectionnez une catégorie...</option>
                                    {[...new Set([
                                        'Construction & Gros Œuvre',
                                        'Plomberie & Sanitaire',
                                        'Électricité',
                                        'Peinture & Droguerie',
                                        'Outillage',
                                        'Menuiserie & Bois',
                                        'Quincaillerie Générale',
                                        'Étanchéité & Couverture',
                                        'Carrelage & Revêtement',
                                        'Jardin & Extérieur',
                                        ...products.map(p => p.category).filter(Boolean)
                                    ])].sort().map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>

                            {/* ── Fournisseur ── */}
                            <div>
                                <label className="flex items-center gap-3 text-[12px] font-semibold text-[#1c398e] uppercase tracking-wide mb-2">
                                    <img src="/icons8/color_96_supplier.png" alt="" className="w-7 h-7" />
                                    FOURNISSEUR
                                </label>
                                <p className="text-xs text-gray-500 mb-2">Sélectionnez le fournisseur dans la liste</p>
                                <select
                                    name="supplier"
                                    value={formData.supplier}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                                >
                                    <option value="">-- Sélectionnez un fournisseur --</option>
                                    {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>

                            {/* ══ Unité de Base ══ */}
                            <div className="col-span-2 mt-2 mb-0">
                                <h3 className="font-semibold text-gray-900/60 border-b-2 border-gray-300 pb-2 uppercase tracking-widest text-xs">UNITÉ DE BASE (STOCK)</h3>
                            </div>

                            <div className="col-span-2">
                                <div className="flex items-center gap-2 mb-1">
                                    <label className="flex items-center gap-3 text-[12px] font-semibold text-[#1c398e] uppercase tracking-wide">
                                        TYPE DE CONDITIONNEMENT
                                    </label>
                                    <button type="button" onClick={() => setShowUnitInfo(!showUnitInfo)} className="text-primary-600 hover:text-primary-800 transition-colors">
                                        <Info className="w-4 h-4" />
                                    </button>
                                </div>
                                <p className="text-xs text-gray-500 mb-4">Déterminez comment ce produit est stocké et vendu.</p>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                                    {[
                                        { id: 'UNIT', label: 'Unité Unique', sub: 'Outils, Machines...', bg: 'bg-blue-50', text: 'text-blue-700' },
                                        { id: 'BOX', label: 'Boîte / Carton', sub: 'Vis, Clous, Chevilles...', bg: 'bg-amber-50', text: 'text-amber-700' },
                                        { id: 'BULK', label: 'Vrac (Sac de ciment, Litre...)', sub: 'Ciment, Peinture, Fer...', bg: 'bg-blue-50', text: 'text-blue-700' }
                                    ].map(arch => (
                                        <button
                                            key={arch.id}
                                            type="button"
                                            onClick={() => {
                                                const defaults = {
                                                    'UNIT': { unit: 'Unité', bulkUnit: '', unitArchetype: 'UNIT', hasLot: false, hasSubUnit: false },
                                                    'BOX': { unit: 'Boîte', bulkUnit: 'Pièce', unitArchetype: 'BOX', hasSubUnit: false },
                                                    'BULK': { unit: 'Sac de ciment', bulkUnit: 'Kg', unitArchetype: 'BULK', hasLot: false }
                                                }[arch.id];
                                                setFormData({ ...formData, ...defaults });
                                            }}
                                            className={`p-3 text-left transition-all rounded-sm border-2 ${formData.unitArchetype === arch.id
                                                ? 'border-[#1c398e] bg-[#1c398e]/10 text-[#1c398e] font-bold'
                                                : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
                                                }`}
                                        >
                                            <div className="text-sm">{arch.label}</div>
                                            <div className={`text-xs mt-1 ${formData.unitArchetype === arch.id ? 'text-[#1c398e]' : 'text-gray-500'}`}>{arch.sub}</div>
                                        </button>
                                    ))}
                                </div>

                                <label className="flex items-center gap-3 text-[11px] font-semibold text-gray-600 uppercase mb-3 tracking-widest">
                                    <img src="/icons8/color_96_layers.png" alt="" className="w-6 h-6" />
                                    UNITÉ DE BASE
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {detailUnits
                                        .filter(u => getUnitModel(u).archetype === formData.unitArchetype)
                                        .map(u => (
                                            <label
                                                key={u}
                                                className={`cursor-pointer px-4 py-2 border rounded-sm text-sm font-medium transition-all duration-200 select-none flex items-center gap-2 ${formData.unit === u
                                                    ? 'bg-primary-600 border-primary-600 text-white shadow-md'
                                                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm'
                                                    }`}
                                            >
                                                <input type="radio" name="unit" value={u} checked={formData.unit === u} onChange={handleChange} className="hidden" />
                                                {u}
                                            </label>
                                        ))}
                                    <input
                                        type="text"
                                        placeholder="Autre unité..."
                                        value={!detailUnits.includes(formData.unit) ? formData.unit : ''}
                                        onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                                        className="px-3 py-2 border border-gray-200 rounded-sm text-sm focus:ring-2 focus:ring-primary-500 w-32 bg-white"
                                    />
                                </div>
                            </div>


                            {/* ══ Calcul du Prix d'Achat ══ */}
                            <div className="col-span-2 mt-2">
                                <div className="flex items-center gap-2 border-b-2 border-gray-300 pb-2 mb-1">
                                    <h3 className="font-semibold text-gray-900/60 uppercase tracking-widest text-xs">CALCUL DU PRIX DE REVIENT</h3>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">Entrez le prix d'achat de votre lot / livraison et la quantité reçue pour calculer automatiquement le prix de revient unitaire.</p>
                            </div>

                            {/* Contenance / Quantité reçue avec Assistant */}
                            <div className="col-span-2 bg-white/50 p-4 rounded-sm border-2 border-dashed border-gray-300">
                                <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                                    Assistant de Réception : {formData.unit}
                                </h4>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                                    {currentUnitModel.archetype !== 'UNIT' ? (
                                        <>
                                            <div>
                                                <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1">
                                                    {currentUnitModel.contentLabel || `Contenu par ${formData.unit}`}
                                                </label>
                                                <input
                                                    type="number"
                                                    value={helperParams.qtyPerContainer}
                                                    onChange={(e) => handleAssistantChange('qtyPerContainer', e.target.value)}
                                                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-sm focus:ring-2 focus:ring-[#1c398e]/50 bg-white"
                                                    placeholder="Ex: 100"
                                                />
                                            </div>
                                            <div className="flex items-center justify-center h-10 text-gray-400 font-bold">×</div>
                                            <div>
                                                <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1">
                                                    {currentUnitModel.containerLabel || `Nombre de ${formData.unit}(s)`}
                                                </label>
                                                <input
                                                    type="number"
                                                    value={helperParams.containerCount}
                                                    onChange={(e) => handleAssistantChange('containerCount', e.target.value)}
                                                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-sm focus:ring-2 focus:ring-[#1c398e]/50 bg-white"
                                                    placeholder="Ex: 5"
                                                />
                                            </div>
                                        </>
                                    ) : (
                                        <div className="col-span-3">
                                            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Quantité Totale ({formData.unit}s)</label>
                                            <input
                                                type="number"
                                                name="conversionFactor"
                                                required
                                                min="1"
                                                step="any"
                                                value={formData.conversionFactor}
                                                onChange={handleBulkPriceOrContenanceChange}
                                                className="w-full px-4 py-2 border border-gray-200 rounded-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                                                placeholder="Ex: 10"
                                            />
                                        </div>
                                    )}
                                </div>

                                {currentUnitModel.archetype !== 'UNIT' && (
                                    <div className="mt-3 pt-3 border-t-2 border-gray-300 flex items-center justify-between">
                                        <span className="text-xs text-gray-500 font-medium">Auto-calcul du stock :</span>
                                        <div className="flex gap-2">
                                            <div className="bg-primary-50 px-3 py-1 border border-primary-200 rounded-sm">
                                                <span className="text-sm font-bold text-primary-700">
                                                    {formData.stock || 0} {formData.unit}(s)
                                                    <span className="text-xs font-normal text-primary-500 ml-1">
                                                        ({(parseFloat(formData.stock) * parseFloat(formData.conversionFactor)).toLocaleString() || 0} {currentUnitModel.subUnit}{(parseFloat(formData.stock) * parseFloat(formData.conversionFactor) > 1 && currentUnitModel.subUnit === 'Pièce') ? 's' : ''})
                                                    </span>
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Prix d'achat en gros / Montant payé */}
                            <div>
                                <label className="flex items-center gap-3 text-[12px] font-semibold text-[#1c398e] uppercase tracking-wide mb-2">
                                    MONTANT PAYÉ (CASH/DETTE) <span className="text-red-500">*</span>
                                </label>
                                <p className="text-xs text-gray-500 mb-2">Le montant total que vous avez payé pour cette livraison</p>
                                <input
                                    type="number"
                                    name="bulkPurchasePrice"
                                    required
                                    min="0"
                                    value={formData.bulkPurchasePrice}
                                    onChange={handleBulkPriceOrContenanceChange}
                                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-[#1c398e]/50 hide-arrows bg-white font-semibold text-gray-900"
                                    placeholder="Ex: 5000"
                                />
                            </div>
                            
                            {/* ── Prix de Vente (Remonté ici) ── */}
                            <div className="bg-blue-50 p-4 rounded-sm border-2 border-blue-200 shadow-inner col-span-2 md:col-span-1">
                                <label className="flex items-center gap-3 text-[12px] font-semibold text-blue-900 mb-2 uppercase tracking-wide">
                                    Prix de Vente : 1 {formData.unit} *
                                </label>
                                <input
                                    type="number"
                                    name="price"
                                    required
                                    min="0"
                                    value={formData.price}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border-2 border-blue-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-blue-500 hide-arrows font-semibold text-blue-900 shadow-sm"
                                    placeholder="Ex: 5000"
                                />
                            </div>

                            {/* Prix d'achat estimé (auto-calculé + modifiable) */}
                            <div className="col-span-2 md:col-span-1">
                                <label className="flex items-center gap-3 text-[12px] font-semibold text-[#1c398e] uppercase tracking-wide mb-2">
                                    {`COÛT UNITAIRE ESTIMÉ (${formData.unit})`}
                                </label>
                                <p className="text-xs text-gray-500 mb-2">
                                    {`= Montant payé ÷ ${currentUnitModel.archetype === 'UNIT' ? (formData.conversionFactor || 'Quantité') : (formData.stock || 'Nombre total de ' + formData.unit + 's')}.`}
                                    <span className="ml-1 italic">(Vous pouvez corriger si besoin)</span>
                                </p>
                                <input
                                    type="number"
                                    name="purchasePrice"
                                    required
                                    min="0"
                                    value={formData.purchasePrice}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border-2 border-green-200 bg-green-50 rounded-sm focus:outline-none focus:ring-2 focus:ring-green-400 hide-arrows font-medium text-green-800"
                                    placeholder="Calculé automatiquement"
                                />
                            </div>

                            {/* ══ Ventes Multi-Modales ══ */}
                            {formData.unitArchetype !== 'UNIT' && (
                                <>
                                    <div className="col-span-2 mt-4">
                                        <div className="flex items-center gap-2 border-b-2 border-gray-300 pb-2 mb-1">
                                            <h3 className="font-semibold text-gray-900/60 uppercase tracking-widest text-xs">OPTIONS DE VENTE MULTI-MODALES</h3>
                                        </div>
                                    </div>

                                    {/* Selection des Modes */}
                                    <div className="col-span-2">
                                        <div className="flex items-center gap-2 mb-2">
                                            <label className="block text-sm font-medium text-gray-700">Canaux de vente actifs (Optionnels)</label>
                                            <button type="button" onClick={() => setShowRetailInfo(!showRetailInfo)} className="text-[#007185] hover:text-[#C45500] transition-colors">
                                                <Info className="w-4 h-4" />
                                            </button>
                                        </div>
                                        {showRetailInfo && (
                                            <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-sm text-xs text-blue-800 shadow-sm">
                                                <p className="font-semibold mb-1">Comment fonctionnent les modes cumulatifs ?</p>
                                                <ul className="list-disc pl-5 space-y-1.5">
                                                    <li><strong>Vente Classique :</strong> Toujours active par défaut.</li>
                                                    {formData.unitArchetype === 'BOX' && <li><strong>Vente en petit Lot :</strong> Ajoute une option pour vendre un lot de pièces internes (ex: 10 vis).</li>}
                                                    {formData.unitArchetype === 'BULK' && <li><strong>Vente Fractionnée :</strong> Ajoute des options pour vendre par poids/volume exacts.</li>}
                                                </ul>
                                            </div>
                                        )}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                                            {/* Vente Lot */}
                                            {formData.unitArchetype === 'BOX' && (
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData(prev => ({ ...prev, hasLot: !prev.hasLot }))}
                                                    className={`p-4 rounded-sm border-2 text-left transition-all flex flex-col justify-between ${formData.hasLot ? 'border-[#1c398e] bg-[#1c398e]/10 text-[#1c398e]' : 'border-gray-200 hover:border-gray-400'}`}
                                                >
                                                    <div className="flex justify-between items-start w-full mb-2">
                                                        <div className={`font-bold ${formData.hasLot ? 'text-[#1c398e]' : 'text-gray-900'}`}>
                                                            + Option Petit Lot
                                                        </div>
                                                        <div className={`h-5 w-5 rounded-sm border flex items-center justify-center ${formData.hasLot ? 'bg-[#1c398e] border-[#1c398e] text-white' : 'border-gray-300'}`}>
                                                            {formData.hasLot && <Check className="w-3.5 h-3.5" />}
                                                        </div>
                                                    </div>
                                                    <div className={`text-xs mt-1 ${formData.hasLot ? 'text-[#1c398e]' : 'text-gray-500'}`}>Ex: Lot de 10 pièces</div>
                                                </button>
                                            )}

                                            {/* Vente Fractionnée */}
                                            {formData.unitArchetype === 'BULK' && (
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData(prev => ({ ...prev, hasSubUnit: !prev.hasSubUnit }))}
                                                    className={`p-4 rounded-sm border-2 text-left transition-all flex flex-col justify-between ${formData.hasSubUnit ? 'border-[#1c398e] bg-[#1c398e]/10 text-[#1c398e]' : 'border-gray-200 hover:border-gray-400'}`}
                                                >
                                                    <div className="flex justify-between items-start w-full mb-2">
                                                        <div className={`font-bold ${formData.hasSubUnit ? 'text-[#1c398e]' : 'text-gray-900'}`}>
                                                            + Vente Modèles
                                                        </div>
                                                        <div className={`h-5 w-5 rounded-sm border flex items-center justify-center ${formData.hasSubUnit ? 'bg-[#1c398e] border-[#1c398e] text-white' : 'border-gray-300'}`}>
                                                            {formData.hasSubUnit && <Check className="w-3.5 h-3.5" />}
                                                        </div>
                                                    </div>
                                                    <div className={`text-xs mt-1 ${formData.hasSubUnit ? 'text-[#1c398e]' : 'text-gray-500'}`}>Fractionnement (ex: 500g)</div>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Configuration des Prix selon les Modes Actifs */}
                            <div className="col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                {/* Prix de vente Classique (Toujours là) */}


                                {/* Configuration du Lot si actif */}
                                {formData.hasLot && (
                                    <div className="bg-primary-50 p-3 rounded-sm border border-primary-200">
                                        <div className="flex gap-3">
                                            <div className="w-1/3">
                                                <label className="block text-xs font-bold text-primary-900 mb-1">Qté (Pièces)</label>
                                                <input
                                                    type="number"
                                                    name="retailStepQuantity"
                                                    required
                                                    min="1"
                                                    value={formData.retailStepQuantity}
                                                    onChange={handleLotQtyChange}
                                                    className="w-full px-2 py-2 text-sm border border-primary-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-primary-500 hide-arrows bg-white"
                                                    placeholder="Ex: 10"
                                                />
                                            </div>
                                            <div className="w-2/3">
                                                <label className="block text-xs font-bold text-primary-900 mb-1">Prix du Lot (FCFA)</label>
                                                <input
                                                    type="number"
                                                    name="lotPrice"
                                                    required
                                                    min="0"
                                                    value={formData.lotPrice}
                                                    onChange={handleChange}
                                                    className="w-full px-3 py-2 text-sm border border-primary-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-primary-500 hide-arrows font-bold bg-white"
                                                    placeholder="Ex: 600"
                                                />
                                            </div>
                                        </div>
                                        {/* Indication Marge Lot */}
                                        {!isNaN(parseFloat(formData.purchasePrice)) && parseFloat(formData.conversionFactor) > 0 && parseFloat(formData.lotPrice) > 0 && (
                                            <div className="mt-2 text-[10px] text-right text-primary-700 font-medium">
                                                Coût Lot estimé: {Math.round((parseFloat(formData.purchasePrice) / parseFloat(formData.conversionFactor)) * parseFloat(formData.retailStepQuantity))} FCFA
                                                (Marge: {Math.round(((parseFloat(formData.lotPrice) - ((parseFloat(formData.purchasePrice) / parseFloat(formData.conversionFactor)) * parseFloat(formData.retailStepQuantity))) / parseFloat(formData.lotPrice)) * 100)}%)
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* ══ Modèles de Déconditionnement ══ */}
                            {formData.hasSubUnit && (
                                <div className="col-span-2">
                                    <div className="flex items-center justify-between mb-3 pt-3 border-t">
                                        <div>
                                            <h4 className="font-semibold text-gray-800 text-sm">📦 Créer des options de Vente Fractionnée</h4>
                                            <p className="text-xs text-gray-500 mt-0.5">
                                                Définissez vos propres quantités et prix (ex: 5 kilos à 750F).
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const newId = 'custom_' + Date.now();
                                                setFormData(prev => ({
                                                    ...prev,
                                                    packagings: [...prev.packagings, { modelId: newId, name: '', targetQty: '', price: '', deductionRatio: 0 }]
                                                }));
                                            }}
                                            className="text-xs bg-primary-50 text-primary-700 px-3 py-1.5 rounded-sm hover:bg-primary-100 transition-colors font-bold"
                                        >
                                            + Ajouter une option
                                        </button>
                                    </div>

                                    <div className="space-y-3">
                                        {formData.packagings.length === 0 && (
                                            <div className="p-6 text-center bg-gray-50 rounded-sm border border-dashed border-gray-200">
                                                <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                                                <p className="text-sm text-gray-500">Aucune option créée. Cliquez sur Ajouter.</p>
                                            </div>
                                        )}
                                        {formData.packagings.map((pkg, idx) => (
                                            <div key={pkg.modelId} className="border-2 border-primary-200 bg-white rounded-sm p-4 relative shadow-sm">
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData(prev => ({
                                                        ...prev,
                                                        packagings: prev.packagings.filter(p => p.modelId !== pkg.modelId)
                                                    }))}
                                                    className="absolute top-2 right-2 text-gray-400 hover:text-red-500 p-1 rounded-full hover:bg-gray-100 transition-colors"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="text-[11px] font-semibold text-gray-600 mb-1 block uppercase tracking-wide">
                                                            Quantité vendue ({currentUnitModel?.subUnit || 'unités'})
                                                        </label>
                                                        <input
                                                            type="number"
                                                            min="0.0001"
                                                            step="any"
                                                            value={pkg.targetQty}
                                                            onChange={(e) => {
                                                                const val = parseFloat(e.target.value) || 0;
                                                                const factor = parseFloat(formData.conversionFactor) || 1;
                                                                const subUnitName = currentUnitModel?.subUnit || 'unités';
                                                                const autoName = val > 0 ? `${val} ${subUnitName}` : '';
                                                                setFormData(prev => ({
                                                                    ...prev,
                                                                    packagings: prev.packagings.map(p => p.modelId === pkg.modelId ? {
                                                                        ...p,
                                                                        targetQty: e.target.value,
                                                                        name: autoName,
                                                                        deductionRatio: val / factor
                                                                    } : p)
                                                                }));
                                                            }}
                                                            className="w-full px-3 py-2 text-sm border-2 border-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-[#1c398e]/50 bg-white font-medium"
                                                            placeholder="Ex: 5"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[11px] font-semibold text-gray-600 mb-1 block uppercase tracking-wide">Prix (FCFA)</label>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={pkg.price}
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                setFormData(prev => ({
                                                                    ...prev,
                                                                    packagings: prev.packagings.map(p => p.modelId === pkg.modelId ? { ...p, price: val } : p)
                                                                }));
                                                            }}
                                                            className="w-full px-3 py-2 text-sm border-2 border-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-[#1c398e]/50 font-semibold text-[#1c398e] bg-white"
                                                            placeholder="Ex: 750"
                                                        />
                                                    </div>
                                                </div>
                                                {pkg.deductionRatio > 0 && (
                                                    <div className="mt-3 p-2 bg-amber-50 rounded-sm border-2 border-amber-200 flex items-center gap-2">
                                                        <Info className="w-4 h-4 text-amber-600 flex-shrink-0" />
                                                        <span className="text-[10px] text-amber-700 leading-tight">
                                                            Option <b className="uppercase">{pkg.name}</b> générée automatiquement.<br />
                                                            Cette vente retirera <b>{parseFloat(pkg.deductionRatio).toFixed(3)} {formData.unit}</b> du stock.
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}



                            {/* ══ Informations de Stock ══ */}
                            <div className="col-span-2 mt-2">
                                <div className="flex items-center gap-2 border-b-2 border-gray-300 pb-2">
                                    <h3 className="font-semibold text-gray-900/60 uppercase tracking-widest text-xs">INFORMATIONS DE STOCK</h3>
                                    <button type="button" onClick={() => setShowStockInfo(!showStockInfo)} className="text-[#007185] hover:text-[#C45500] transition-colors">
                                        <Info className="w-4 h-4" />
                                    </button>
                                </div>
                                {showStockInfo && (
                                    <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-sm text-xs text-blue-800 shadow-sm">
                                        <p className="font-semibold mb-1">Gestion des quantités</p>
                                        <ul className="list-disc pl-5 space-y-1.5">
                                            <li><strong>Stock actuel :</strong> Saisissez la quantité totale en unité de base. (ex: 2 boîtes de 100 pièces → inscrivez "200").</li>
                                            <li><strong>Stock minimum :</strong> Seuil d'alerte pour vous prévenir de recommander l'article.</li>
                                        </ul>
                                    </div>
                                )}
                            </div>

                            {/* Stock est maintenant synchronisé avec la quantité reçue ci-dessus */}

                            <div>
                                <label className="flex items-center gap-3 text-[12px] font-semibold text-[#1c398e] uppercase tracking-wide mb-2">
                                    <img src="/icons8/color_96_high-priority.png" alt="" className="w-7 h-7" />
                                    STOCK MINIMUM D'ALERTE
                                </label>
                                <p className="text-xs text-gray-500 mb-2">En dessous de ce seuil, une alerte sera déclenchée</p>
                                <input
                                    type="number"
                                    name="minStock"
                                    required
                                    min="0"
                                    step="any"
                                    value={formData.minStock}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-[#1c398e]/50 hide-arrows bg-white font-medium"
                                    placeholder="Ex: 50"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-6 border-t-2 border-gray-300 bg-gray-50/50 p-6">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-6 py-2.5 text-gray-700 hover:bg-gray-200 border-2 border-gray-300 rounded-sm font-bold transition-colors"
                            >
                                Annuler
                            </button>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="bg-[#1c398e] hover:bg-[#142b6b] text-white px-8 py-2.5 rounded-sm font-bold shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {isLoading ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                {product ? 'Mettre à jour' : 'Enregistrer le produit'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* Full-screen Loader for saving */}
            {isLoading && (
                <div className="fixed inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center z-[100] animate-in fade-in duration-200">
                    <div className="flex flex-col items-center gap-4 bg-white p-8 rounded-sm shadow-xl">
                        <div className="w-12 h-12 border-4 border-[#1c398e]/20 border-t-[#1c398e] rounded-full animate-spin"></div>
                        <p className="text-gray-700 font-medium animate-pulse">
                            {product ? 'Modification du produit...' : 'Création du produit...'}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductModal;
