import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Info, Calculator, ArrowLeft, Package, Search, Check, RefreshCcw, AlertTriangle, Scale, Barcode, Plus } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { useSettings } from '../context/SettingsContext';
import { getUnitModel, getAvailableMeasurementUnits } from '../config/unitModels';
import { TAXONOMY } from '../config/taxonomy';
import FinancialInput from './FinancialInput';
import { generateInternalBarcode, renderBarcodeSvg } from '../utils/barcodeGenerator';
import { productApi } from '../services/apiClient';

const ProductModal = ({ product, onClose, onSave }) => {
    const { products, deconditionModels, categories } = useInventory();
    const { currentStoreId } = useSettings();
    const suppliers = [...new Set(products.map(p => p.supplier).filter(Boolean))];


    const [showUnitInfo, setShowUnitInfo] = useState(false);
    const [showRetailInfo, setShowRetailInfo] = useState(false);
    const [showBulkInfo, setShowBulkInfo] = useState(false);
    const [showStockInfo, setShowStockInfo] = useState(false);
    const [showAllModels, setShowAllModels] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isGeneratingBarcode, setIsGeneratingBarcode] = useState(false);
    const [autoGenerateBarcode, setAutoGenerateBarcode] = useState(false);


    const [formData, setFormData] = useState({
        name: '',
        barcode: '',
        category: '',
        price: '',
        purchasePrice: '',
        bulkPurchasePrice: '',
        stock: '',
        minStock: '',
        supplier: '',
        unit: 'Unité',
        unitArchetype: 'UNIT',
        hasPiece: false,
        piecePrice: '',
        hasLot: false,
        lots: [
            { id: 'lot_default', quantity: '10', price: '' }
        ],
        lotPrice: '',
        retailStepQuantity: '',
        bulkUnit: '',
        bulkPrice: '',
        conversionFactor: 1,
        hasSubUnit: false,
        packagings: []
    });

    // Modèle d'unité calculé avec prise en compte de l'unité de mesure choisie (bulkUnit)
    const currentUnitModel = getUnitModel(formData?.unit || 'Unité', formData?.bulkUnit);
    // Assistant de saisie (Conditionnement)
    const [helperParams, setHelperParams] = useState({
        qtyPerContainer: '',
        containerCount: ''
    });

    // Unité du seuil de stock minimum : 'base' (Carton/Boîte) ou 'piece' (Pièce) - Aucun choix par défaut
    const [minStockUnit, setMinStockUnit] = useState('');
    const [minStockInput, setMinStockInput] = useState('');
    const [minStockError, setMinStockError] = useState(false);
    const minStockRef = useRef(null);

    useEffect(() => {
        if (product) {
            const factor = parseFloat(product.conversionFactor) || 1;
            const stockQty = product.stockLevels?.[currentStoreId] ?? product.stock ?? 0;
            const rawMinStock = product.minStockLevels?.[currentStoreId] ?? product.minStock ?? 0;

            // Reconstitution de l'unité et de la valeur saisie pour le stock minimum (aucun choix par défaut forcé)
            let initialMinStockUnit = '';
            let initialMinStockInput = '';

            if (rawMinStock !== undefined && rawMinStock !== null && rawMinStock !== '') {
                const numericMin = parseFloat(rawMinStock) || 0;
                if (product.helperParams?.minStockUnit) {
                    initialMinStockUnit = product.helperParams.minStockUnit;
                    if (initialMinStockUnit === 'piece') {
                        initialMinStockInput = product.helperParams.minStockInput !== undefined
                            ? product.helperParams.minStockInput.toString()
                            : (numericMin * factor).toString();
                    } else {
                        initialMinStockInput = numericMin.toString();
                    }
                } else if ((product.unitArchetype === 'BOX' || product.unitArchetype === 'BULK') && factor > 1 && numericMin > 0 && numericMin < 1) {
                    // Fraction dans la base : c'était très probablement saisi en pièces (ex: 0.20 pour 20 pièces sur 100)
                    initialMinStockUnit = 'piece';
                    initialMinStockInput = Math.round(numericMin * factor).toString();
                } else if (numericMin > 0) {
                    initialMinStockUnit = 'base';
                    initialMinStockInput = numericMin.toString();
                }
            }

            setMinStockUnit(initialMinStockUnit);
            setMinStockInput(initialMinStockInput);
            setMinStockError(false);

            // On essaie de reconstruire les paramètres de l'assistant si possible
            let initialQtyPerContainer = '';
            let initialContainerCount = '';

            if (product.unitArchetype === 'BOX' || product.unitArchetype === 'BULK') {
                initialQtyPerContainer = factor;
                initialContainerCount = stockQty;
            }

            let initialLots = [];
            if (Array.isArray(product.lots) && product.lots.length > 0) {
                initialLots = product.lots.map(l => ({
                    id: l.id || ('lot_' + Math.random().toString(36).substr(2, 9)),
                    quantity: (l.quantity || l.targetQty || '').toString(),
                    price: (l.price || '').toString()
                }));
            } else if (product.unitArchetype === 'BOX' && Array.isArray(product.packagings) && product.packagings.length > 0) {
                initialLots = product.packagings.map(pkg => ({
                    id: pkg.modelId || pkg.id || ('lot_' + Math.random().toString(36).substr(2, 9)),
                    quantity: (pkg.targetQty || '').toString(),
                    price: (pkg.price || '').toString()
                }));
            } else if (product.hasLot || product.retailStepQuantity || product.lotPrice) {
                initialLots = [{
                    id: 'lot_1',
                    quantity: (product.retailStepQuantity || 10).toString(),
                    price: product.lotPrice ? product.lotPrice.toString() : ''
                }];
            } else {
                initialLots = [{ id: 'lot_1', quantity: '10', price: '' }];
            }

            setFormData({
                name: product.name || '',
                barcode: product.barcode || '',
                category: product.category || '',
                price: product.price || '',
                purchasePrice: product.purchasePrice || '',
                bulkPurchasePrice: product.bulkPurchasePrice || '',
                stock: stockQty,
                minStock: product.minStock || 0,
                supplier: product.supplier || '',
                unit: product.unit || 'Unité',
                unitArchetype: product.unitArchetype || 'UNIT',
                hasPiece: product.hasPiece || false,
                piecePrice: product.piecePrice || '',
                hasLot: product.hasLot || (initialLots.length > 0 && initialLots.some(l => l.price)),
                lots: initialLots,
                lotPrice: product.lotPrice || initialLots[0]?.price || '',
                retailStepQuantity: product.retailStepQuantity || initialLots[0]?.quantity || '',
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
            retailStepQuantity: subCategory.defaults.retailStepQuantity || '',
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
        setFormData(prev => {
            const next = { ...prev, [name]: val };
            if (name === 'unit') {
                const model = getUnitModel(val);
                if (model?.subUnit) {
                    next.bulkUnit = model.subUnit;
                    next.subUnit = model.subUnit;
                }
            }
            return next;
        });
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

            let updatedMinStock = formData.minStock;
            if (minStockUnit === 'piece') {
                const numMin = parseFloat(minStockInput);
                if (!isNaN(numMin) && per > 0) {
                    updatedMinStock = (numMin / per).toString();
                }
            }

            setFormData(prev => ({
                ...prev,
                stock: count.toString(),
                conversionFactor: per.toString(),
                bulkUnit: prev.bulkUnit === '' && formData.unitArchetype === 'BOX' ? 'Pièce' : prev.bulkUnit,
                purchasePrice: newPurchasePrice,
                minStock: updatedMinStock
            }));
        }
    };

    // Gestion de la saisie du seuil minimum avec unité (Boîte/Carton vs Pièce)
    const handleMinStockInputChange = (e) => {
        const val = e.target.value;
        setMinStockInput(val);
        if (val.trim() !== '') {
            setMinStockError(false);
        }
        const num = parseFloat(val);
        const factor = parseFloat(formData.conversionFactor) || 1;

        if (isNaN(num) || num < 0) {
            setFormData(prev => ({ ...prev, minStock: '' }));
        } else if (minStockUnit === 'piece' && factor > 0) {
            // Conversion en unité de base (ex: 20 pièces / 100 = 0.2 boîte)
            setFormData(prev => ({ ...prev, minStock: (num / factor).toString() }));
        } else {
            setFormData(prev => ({ ...prev, minStock: val }));
        }
    };

    // Changement d'unité pour le seuil minimum (ex: switcher entre Boîte et Pièce)
    const handleMinStockUnitChange = (newUnit) => {
        if (newUnit === minStockUnit) {
            // Si on reclique sur le checkbox déjà sélectionné, on le décoche (aucun choix)
            setMinStockUnit('');
            return;
        }
        setMinStockUnit(newUnit);
        setMinStockError(false);
        const num = parseFloat(minStockInput);
        const factor = parseFloat(formData.conversionFactor) || 1;

        if (!isNaN(num) && num > 0 && factor > 0) {
            if (newUnit === 'piece' && minStockUnit === 'base') {
                // De boîte vers pièces (ex: 2 boîtes -> 200 pièces si factor=100)
                const inPieces = Math.round(num * factor * 10000) / 10000;
                setMinStockInput(inPieces.toString());
                setFormData(prev => ({ ...prev, minStock: num.toString() }));
            } else if (newUnit === 'base' && minStockUnit === 'piece') {
                // De pièces vers boîte (ex: 50 pièces -> 0.5 boîte)
                const inBase = Math.round((num / factor) * 10000) / 10000;
                setMinStockInput(inBase.toString());
                setFormData(prev => ({ ...prev, minStock: inBase.toString() }));
            } else if (!minStockUnit) {
                // Premier choix d'unité
                if (newUnit === 'piece') {
                    setFormData(prev => ({ ...prev, minStock: (num / factor).toString() }));
                } else {
                    setFormData(prev => ({ ...prev, minStock: num.toString() }));
                }
            }
        }
    };

    // Gestion du choix de l'unité de base pour Vrac / Boîte
    const handleBaseUnitSelect = (newUnit) => {
        if (!newUnit) return;
        const available = getAvailableMeasurementUnits(newUnit);
        const currentMeasure = formData.bulkUnit;
        const newMeasure = available.includes(currentMeasure) ? currentMeasure : available[0];
        
        setFormData(prev => ({
            ...prev,
            unit: newUnit,
            bulkUnit: prev.unitArchetype === 'BULK' ? newMeasure : (prev.unitArchetype === 'BOX' ? 'Pièce' : ''),
            subUnitName: prev.unitArchetype === 'BULK' ? newMeasure : (prev.unitArchetype === 'BOX' ? 'Pièce' : '')
        }));
    };

    // Gestion du choix de l'unité de mesure du contenu (Sous-unité en Vrac : Kg, Litre, Mètre, ml...)
    const handleMeasurementUnitSelect = (measureUnit) => {
        setFormData(prev => ({
            ...prev,
            bulkUnit: measureUnit,
            subUnitName: measureUnit
        }));
    };

    // Handlers pour la gestion des options de Petits Lots multiples
    const handleAddLot = () => {
        setFormData(prev => ({
            ...prev,
            lots: [
                ...(prev.lots || []),
                { id: 'lot_' + Date.now(), quantity: '', price: '' }
            ]
        }));
    };

    const handleRemoveLot = (lotId) => {
        setFormData(prev => {
            const nextLots = (prev.lots || []).filter(l => l.id !== lotId);
            const fallbackLots = nextLots.length > 0 ? nextLots : [{ id: 'lot_' + Date.now(), quantity: '', price: '' }];
            const firstLot = fallbackLots[0];
            return {
                ...prev,
                lots: fallbackLots,
                retailStepQuantity: firstLot?.quantity || '',
                lotPrice: firstLot?.price || ''
            };
        });
    };

    const handleLotChange = (lotId, field, value) => {
        setFormData(prev => {
            const updatedLots = (prev.lots || []).map(l => l.id === lotId ? { ...l, [field]: value } : l);
            const firstLot = updatedLots[0];
            return {
                ...prev,
                lots: updatedLots,
                retailStepQuantity: firstLot?.quantity || prev.retailStepQuantity,
                lotPrice: firstLot?.price || prev.lotPrice
            };
        });
    };

    /**
     * Génère un code EAN-13 via le serveur Java (vérification d'unicité en base incluse).
     * Bascule sur le générateur local JS si le serveur est injoignable (mode hors-ligne).
     * Maintient le loader actif pendant au moins 2 secondes pour une expérience visuelle fluide.
     */
    const handleGenerateBarcode = async () => {
        setIsGeneratingBarcode(true);
        const minDelay = new Promise(resolve => setTimeout(resolve, 2000));
        try {
            const [response] = await Promise.all([
                productApi.generateBarcode(),
                minDelay
            ]);
            setFormData(prev => ({ ...prev, barcode: response.barcode }));
        } catch (err) {
            console.warn('Serveur injoignable pour generate-barcode, fallback local :', err.message);
            const code = generateInternalBarcode();
            await minDelay;
            setFormData(prev => ({ ...prev, barcode: code }));
        } finally {
            setIsGeneratingBarcode(false);
        }
    };

    const handleToggleAutoBarcode = async (e) => {
        const checked = e.target.checked;
        setAutoGenerateBarcode(checked);
        if (checked) {
            await handleGenerateBarcode();
        } else {
            setFormData(prev => ({ ...prev, barcode: '' }));
        }
    };

    const handleBarcodeChange = (e) => {
        setAutoGenerateBarcode(false);
        handleChange(e);
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        // Validation stricte : un choix d'unité DOIT être fait (checkbox) et la valeur doit être valide
        if (!minStockUnit || minStockInput === '' || isNaN(parseFloat(minStockInput)) || parseFloat(minStockInput) < 0) {
            setMinStockError(true);
            minStockRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        // Calcul final et précis du stock minimum en unité de base
        const factor = parseFloat(formData.conversionFactor) || 1;
        const numInput = parseFloat(minStockInput) || 0;
        let calculatedMinStock = parseFloat(formData.minStock);
        if (isNaN(calculatedMinStock)) {
            calculatedMinStock = (minStockUnit === 'piece' && factor > 0) ? (numInput / factor) : numInput;
        }

        setIsLoading(true);
        setTimeout(() => {
            const subUnitName = currentUnitModel?.subUnit || 'Pièces';
            const validLots = (formData.lots || []).filter(l => parseFloat(l.quantity) > 0);
            const firstLot = validLots[0];

            const lotPackagings = validLots.map((l, idx) => ({
                modelId: l.id || ('lot_' + Date.now() + '_' + idx),
                name: `Lot de ${l.quantity} ${subUnitName}`,
                targetQty: parseFloat(l.quantity),
                price: parseFloat(l.price) || 0,
                deductionRatio: factor > 0 ? (parseFloat(l.quantity) / factor) : 0
            }));

            const finalPackagings = formData.unitArchetype === 'BOX'
                ? (formData.hasLot ? lotPackagings : [])
                : (formData.hasSubUnit ? formData.packagings : []);

            onSave({
                ...formData,
                id: product?.id, // Assurer que l'ID est conservé
                barcode: formData.barcode ? formData.barcode.trim() : null,
                price: parseFloat(formData.price),
                purchasePrice: parseFloat(formData.purchasePrice) || 0,
                bulkPurchasePrice: formData.bulkPurchasePrice ? parseFloat(formData.bulkPurchasePrice) : null,
                stock: parseFloat(formData.stock),
                minStock: calculatedMinStock,
                hasPiece: formData.hasPiece,
                piecePrice: formData.hasPiece ? parseFloat(formData.piecePrice) || null : null,
                hasLot: formData.hasLot && validLots.length > 0,
                lotPrice: formData.hasLot && firstLot ? (parseFloat(firstLot.price) || null) : null,
                retailStepQuantity: formData.hasLot && firstLot ? (parseFloat(firstLot.quantity) || 10) : 1,
                lots: formData.hasLot ? validLots : [],
                packagings: finalPackagings,
                bulkPrice: formData.bulkPrice ? parseFloat(formData.bulkPrice) : null,
                conversionFactor: parseFloat(formData.conversionFactor) || 1,
                helperParams: {
                    ...helperParams,
                    minStockUnit,
                    minStockInput
                }, // Sauvegarder pour l'édition
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
    const bulkBaseUnitCategories = [
        { label: 'Poids / Ensaché', units: ['Sac de ciment', 'Sac', 'Botte'] },
        { label: 'Liquides / Pâtes', units: ['Seau', 'Bidon', 'Pot', 'Fût', 'Cartouche', 'Bouteille'] },
        { label: 'Linéaire / Câbles & Fers', units: ['Rouleau', 'Bobine', 'Couronne', 'Barre', 'Tuyau', 'Fer'] }
    ];
    const bulkBaseUnits = bulkBaseUnitCategories.flatMap(c => c.units);
    const boxBaseUnits = ['Boîte', 'Carton', 'Paquet'];
    const allKnownBaseUnits = [...bulkBaseUnits, ...boxBaseUnits];
    const detailUnits = ['Unité', 'Pièce', 'Kg', 'Mètre', ...allKnownBaseUnits];
    const bulkUnits = ['Paquet', 'Boîte', 'Carton', 'Bobine', 'Fût', 'Bidon', 'Sac de ciment', 'Rouleau', 'Botte', 'Pot', 'Tonne'];

    // ─── RENDUS DES ETAPES ───


    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="rounded-sm border-2 border-gray-300 shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden" style={{ backgroundColor: '#e8eef4' }}>
                <div className="flex justify-between items-center p-6 border-b-2 border-gray-300 flex-shrink-0" style={{ backgroundColor: '#e6ecf2' }}>
                    <div className="flex items-center gap-3">
                        <h2 className="text-lg font-semibold text-gray-900 uppercase tracking-tight">
                            {product ? 'Modifier le produit' : 'Nouveau produit'}
                        </h2>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="overflow-y-auto w-full">
                    <form onSubmit={handleSubmit} className="p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                            {/* ── Nom ── */}
                            <div className="col-span-2">
                                <label className="flex items-center gap-3 text-[12px] font-semibold text-[#001d35] uppercase tracking-wide mb-2">
                                    NOM DU PRODUIT
                                </label>
                                <p className="text-xs text-gray-500 mb-2">Désignation complète du produit et sa marque</p>
                                <input
                                    type="text"
                                    name="name"
                                    required
                                    value={formData.name}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-[#001d35]/50 bg-white"
                                    placeholder="Ex: Ciment gris 35kg"
                                />
                            </div>

                            {/* ── Code-Barres / EAN-13 ── */}
                            <div className="col-span-2 bg-white/80 border-2 border-slate-300 rounded-sm p-4 shadow-2xs">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                                    <label className="flex items-center gap-2 text-[12px] font-bold text-[#001d35] uppercase tracking-wide">
                                        <div className="w-8 h-8 rounded bg-[#001d35]/10 flex items-center justify-center text-[#001d35]">
                                            <Barcode className="w-5 h-5" strokeWidth={1.75} />
                                        </div>
                                        <span>Code-Barres (EAN-13 / Douchette)</span>
                                    </label>
                                    <div className="flex items-center gap-3">
                                        <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={autoGenerateBarcode}
                                                onChange={handleToggleAutoBarcode}
                                                disabled={isGeneratingBarcode}
                                                className="w-4 h-4 rounded-sm border-gray-300 accent-[#001d35] cursor-pointer"
                                            />
                                            <span className="text-xs font-semibold text-slate-700">
                                                Générer un code interne automatique
                                            </span>
                                        </label>
                                        {isGeneratingBarcode && (
                                            <div className="flex items-center gap-1.5 text-xs text-amber-700 font-medium">
                                                <div className="w-3.5 h-3.5 border-2 border-amber-600/40 border-t-amber-600 rounded-full animate-spin" />
                                                <span>Génération...</span>
                                            </div>
                                        )}
                                        {formData.barcode && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setAutoGenerateBarcode(false);
                                                    setFormData(prev => ({ ...prev, barcode: '' }));
                                                }}
                                                className="px-2 py-1 text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-sm transition-colors cursor-pointer font-semibold"
                                                title="Effacer le code-barres"
                                            >
                                                Effacer
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <p className="text-xs text-gray-500 mb-2.5">
                                    Scannez avec la douchette ou cochez pour attribuer automatiquement un code interne vérifié.
                                    <span className="text-slate-600 font-medium"> Optionnel : laisser vide si le produit n'a pas de code-barres.</span>
                                </p>
                                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                                    <div className="relative flex-1 w-full">
                                        <input
                                            type="text"
                                            name="barcode"
                                            value={formData.barcode || ''}
                                            onChange={handleBarcodeChange}
                                            disabled={isGeneratingBarcode}
                                            placeholder={isGeneratingBarcode ? "Génération du code en cours..." : "Ex: 2001234567891 ou scannez avec la douchette..."}
                                            className="w-full pl-9 pr-4 py-2 border-2 border-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-[#001d35]/50 bg-white disabled:bg-slate-100 disabled:text-gray-400 font-mono text-sm tracking-wider font-semibold text-slate-800"
                                        />
                                        <Barcode className="w-5 h-5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" strokeWidth={1.5} />
                                    </div>
                                    {formData.barcode && (
                                        <div className="bg-white border border-gray-200 px-4 py-2 rounded-sm shrink-0 flex flex-col items-center gap-1 shadow-2xs">
                                            <div 
                                                dangerouslySetInnerHTML={{ __html: renderBarcodeSvg(formData.barcode, { width: 160, height: 48, showText: false }) }} 
                                            />
                                            <span className="text-[11px] font-medium font-mono text-slate-600 tracking-widest">{formData.barcode}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* ── Catégorie ── */}
                            <div>
                                <label className="flex items-center gap-3 text-[12px] font-semibold text-[#001d35] uppercase tracking-wide mb-2">
                                    CATÉGORIE / TYPE
                                </label>
                                <p className="text-xs text-gray-500 mb-2">Sélectionnez la catégorie du produit</p>
                                <select
                                    name="category"
                                    required
                                    value={formData.category}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-[#001d35]/50 bg-white cursor-pointer"
                                >
                                    <option value="" disabled>Sélectionnez une catégorie...</option>
                                    {[...new Set([
                                        ...(categories || []).map(c => c.name),
                                        ...products.map(p => p.category).filter(Boolean)
                                    ])].sort().map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>

                            {/* ── Fournisseur ── */}
                            <div>
                                <label className="flex items-center gap-3 text-[12px] font-semibold text-[#001d35] uppercase tracking-wide mb-2">
                                    <img src="/icons8/color_96_supplier.png" alt="" className="w-7 h-7" />
                                    FOURNISSEUR
                                </label>
                                <p className="text-xs text-gray-500 mb-2">Sélectionnez le fournisseur dans la liste</p>
                                <select
                                    name="supplier"
                                    value={formData.supplier}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white cursor-pointer"
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
                                    <label className="flex items-center gap-3 text-[12px] font-semibold text-[#001d35] uppercase tracking-wide">
                                        TYPE DE CONDITIONNEMENT
                                    </label>
                                    <button type="button" onClick={() => setShowUnitInfo(!showUnitInfo)} className="text-primary-600 hover:text-primary-800 transition-colors cursor-pointer">
                                        <Info className="w-4 h-4" />
                                    </button>
                                </div>
                                <p className="text-xs text-gray-500 mb-4">Déterminez comment ce produit est stocké et vendu.</p>
                                {showUnitInfo && (
                                    <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-sm text-xs text-blue-800 shadow-sm">
                                        <p className="font-semibold mb-1">Guide des conditionnements :</p>
                                        <ul className="list-disc pl-5 space-y-1">
                                            <li><strong>Unité Unique :</strong> Pour les articles vendus à l'unité sans décomposition (outils, machines...).</li>
                                            <li><strong>Boîte / Carton / Sachet :</strong> Pour les contenants de pièces (vis, clous...) avec possibilité de vente en petits lots.</li>
                                            <li><strong>Vrac :</strong> Pour les matériaux au poids, volume ou longueur (ciment, peinture, fer...) avec vente fractionnée.</li>
                                        </ul>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                                    {[
                                        { id: 'UNIT', label: 'Unité Unique', sub: 'Outils, Machines...' },
                                        { id: 'BOX', label: 'Boîte / Carton / Sachet', sub: 'Vis, Clous, Chevilles...' },
                                        { id: 'BULK', label: 'Vrac (Sac de ciment, Litre...)', sub: 'Ciment, Peinture, Fer...' }
                                    ].map(arch => {
                                        const isSelected = formData.unitArchetype === arch.id;
                                        return (
                                            <button
                                                key={arch.id}
                                                type="button"
                                                onClick={() => {
                                                    const defaults = {
                                                        'UNIT': { unit: 'Unité', bulkUnit: '', subUnit: '', unitArchetype: 'UNIT', hasLot: false, hasSubUnit: false },
                                                        'BOX': { unit: '', bulkUnit: 'Pièce', subUnit: 'Pièce', unitArchetype: 'BOX', hasSubUnit: false },
                                                        'BULK': { unit: '', bulkUnit: '', subUnit: '', unitArchetype: 'BULK', hasLot: false }
                                                    }[arch.id];
                                                    setFormData(prev => ({ ...prev, ...defaults }));
                                                    if (arch.id === 'UNIT' && minStockUnit === 'piece') {
                                                        setMinStockUnit('');
                                                    }
                                                }}
                                                className={`p-3.5 text-left transition-all rounded-[4px] border-2 cursor-pointer select-none flex flex-col justify-between ${
                                                    isSelected
                                                        ? 'border-[#001d35] bg-[#001d35]/10 text-[#001d35] font-bold shadow-xs'
                                                        : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400 hover:bg-gray-50/50'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        readOnly
                                                        className="w-4 h-4 rounded-[4px] border-gray-300 accent-[#001d35] cursor-pointer pointer-events-none shrink-0"
                                                    />
                                                    <span className={`text-sm ${isSelected ? 'font-bold text-[#001d35]' : 'font-semibold text-gray-800'}`}>
                                                        {arch.label}
                                                    </span>
                                                </div>
                                                <div className={`text-xs mt-2 ml-6.5 ${isSelected ? 'text-[#001d35]/80 font-medium' : 'text-gray-500'}`}>
                                                    {arch.sub}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* UNITÉ DE BASE & UNITÉS DE MESURE : affichée uniquement pour Boîte/Carton et Vrac */}
                                {formData.unitArchetype !== 'UNIT' && (
                                    <div className="animate-in fade-in duration-150 space-y-4">
                                        {/* 1. Sélection de l'unité de base / contenant */}
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <label className="flex items-center gap-2 text-[11px] font-semibold text-gray-700 uppercase tracking-widest">
                                                    <img src="/icons8/color_96_layers.png" alt="" className="w-5 h-5" />
                                                    <span>UNITÉ DE BASE ({formData.unitArchetype === 'BULK' ? 'CONTENANT VRAC' : 'CONTENANT'})</span>
                                                </label>
                                                <span className="text-[10px] text-gray-500 font-medium">
                                                    {formData.unitArchetype === 'BULK' ? 'Classés par familles physiques (Poids, Liquide, Linéaire)' : 'Boîte, Carton, Paquet...'}
                                                </span>
                                            </div>

                                            {formData.unitArchetype === 'BOX' ? (
                                                <div className="flex flex-wrap gap-2">
                                                    {boxBaseUnits.map(u => (
                                                        <label
                                                            key={u}
                                                            className={`cursor-pointer px-3.5 py-1.5 border-2 rounded-[4px] text-xs font-bold transition-all select-none flex items-center gap-2 ${
                                                                formData.unit === u
                                                                    ? 'bg-transparent border-[#001d35] text-[#001d35] shadow-xs'
                                                                    : 'bg-white border-gray-300 text-gray-700 hover:border-blue-400 hover:text-blue-900'
                                                            }`}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={formData.unit === u}
                                                                onChange={() => handleBaseUnitSelect(u)}
                                                                className="w-3.5 h-3.5 rounded-[4px] border-gray-300 accent-[#001d35] cursor-pointer shrink-0"
                                                            />
                                                            <span>{u}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="space-y-2.5">
                                                    {bulkBaseUnitCategories.map(cat => (
                                                        <div key={cat.label} className="bg-white/60 p-2.5 rounded-[4px] border border-gray-200">
                                                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">{cat.label}</span>
                                                            <div className="flex flex-wrap gap-2">
                                                                {cat.units.map(u => (
                                                                    <label
                                                                        key={u}
                                                                        className={`cursor-pointer px-3 py-1.5 border-2 rounded-[4px] text-xs font-bold transition-all select-none flex items-center gap-2 ${
                                                                            formData.unit === u
                                                                                ? 'bg-[#001d35]/10 border-[#001d35] text-[#001d35] shadow-xs'
                                                                                : 'bg-white border-gray-300 text-gray-700 hover:border-blue-400 hover:text-blue-900'
                                                                        }`}
                                                                    >
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={formData.unit === u}
                                                                            onChange={() => handleBaseUnitSelect(u)}
                                                                            className="w-3.5 h-3.5 rounded-[4px] border-gray-300 accent-[#001d35] cursor-pointer shrink-0"
                                                                        />
                                                                        <span>{u}</span>
                                                                    </label>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* 2. Juste en dessous si VRAC : Unités de mesure qui correspondent à cette unité de base */}
                                        {formData.unitArchetype === 'BULK' && formData.unit && (
                                            <div className="bg-blue-50/70 border-2 border-blue-200 rounded-[4px] p-3.5 animate-in fade-in duration-150">
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <label className="flex items-center gap-2 text-[11px] font-bold text-[#001d35] uppercase tracking-wide">
                                                        <Scale className="w-4 h-4 text-blue-700 shrink-0" />
                                                        <span>UNITÉ DE MESURE DU CONTENU POUR : <strong className="text-blue-900 underline">{formData.unit || 'ce contenant'}</strong></span>
                                                    </label>
                                                </div>
                                                <p className="text-xs text-gray-600 mb-2.5">
                                                    Indiquez comment est mesuré le contenu de votre <strong>{formData.unit || 'contenant'}</strong> (au kilo, au litre, au mètre...) :
                                                </p>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    {getAvailableMeasurementUnits(formData.unit).map(meas => {
                                                        const isSelected = (formData.bulkUnit || currentUnitModel.subUnit) === meas;
                                                        return (
                                                            <label
                                                                key={meas}
                                                                className={`cursor-pointer px-3.5 py-1.5 border-2 rounded-[4px] text-xs font-bold transition-all select-none flex items-center gap-2 ${
                                                                    isSelected
                                                                        ? 'bg-transparent border-[#001d35] text-[#001d35] shadow-xs'
                                                                        : 'bg-white border-slate-300 text-slate-700 hover:border-blue-400 hover:text-blue-900'
                                                                }`}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isSelected}
                                                                    onChange={() => handleMeasurementUnitSelect(meas)}
                                                                    className="w-3.5 h-3.5 rounded-[4px] border-gray-300 accent-[#001d35] cursor-pointer shrink-0"
                                                                />
                                                                <span>{meas}</span>
                                                            </label>
                                                        );
                                                    })}
                                                    <input
                                                        type="text"
                                                        placeholder="Autre mesure..."
                                                        value={!getAvailableMeasurementUnits(formData.unit).includes(formData.bulkUnit) ? (formData.bulkUnit || '') : ''}
                                                        onChange={(e) => handleMeasurementUnitSelect(e.target.value)}
                                                        className="px-3 py-1.5 border border-slate-300 rounded-[4px] text-xs focus:ring-2 focus:ring-[#001d35]/50 w-32 bg-white font-semibold text-slate-800"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>


                            {/* ══ Calcul du Prix d'Achat ══ */}
                            <div className="col-span-2 mt-2">
                                <div className="flex items-center gap-2 border-b-2 border-gray-300 pb-2 mb-1">
                                    <h3 className="font-semibold text-gray-900/60 uppercase tracking-widest text-xs">CALCUL DU PRIX DE REVIENT</h3>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">Entrez le prix d'achat de votre lot / livraison et la quantité reçue pour calculer automatiquement le prix de revient unitaire.</p>
                            </div>

                            {/* Contenance / Quantité reçue avec Assistant */}
                            <div className="col-span-2 bg-white/50 p-4 rounded-[4px] border-2 border-dashed border-gray-300">
                                <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                                    Assistant de Réception : {formData.unit}
                                </h4>

                                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-2.5 items-end">
                                    {currentUnitModel.archetype !== 'UNIT' ? (
                                        <>
                                            <div>
                                                <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1">
                                                    {formData.unitArchetype === 'BULK'
                                                        ? `Contenance par ${formData.unit} (en ${formData.bulkUnit || currentUnitModel.subUnit || 'mesure'})`
                                                        : (currentUnitModel.contentLabel || `Contenu par ${formData.unit}`)}
                                                </label>
                                                <input
                                                    type="number"
                                                    value={helperParams.qtyPerContainer}
                                                    onChange={(e) => handleAssistantChange('qtyPerContainer', e.target.value)}
                                                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-[4px] focus:ring-2 focus:ring-[#001d35]/50 bg-white"
                                                    placeholder={
                                                        formData.unitArchetype === 'BULK'
                                                            ? ((formData.bulkUnit || currentUnitModel.subUnit) === 'Kilo' ? "Ex: 50"
                                                                : (formData.bulkUnit || currentUnitModel.subUnit) === 'Litre' ? "Ex: 20"
                                                                : (formData.bulkUnit || currentUnitModel.subUnit) === 'Mètre' ? "Ex: 100"
                                                                : (formData.bulkUnit || currentUnitModel.subUnit) === 'Millilitre' ? "Ex: 310" : "Ex: 50")
                                                            : "Ex: 100"
                                                    }
                                                />
                                            </div>
                                            <div className="flex items-center justify-center h-10 px-1 text-gray-400 font-bold text-lg select-none">×</div>
                                            <div>
                                                <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1">
                                                    {currentUnitModel.containerLabel || `Nombre de ${formData.unit}(s)`}
                                                </label>
                                                <input
                                                    type="number"
                                                    value={helperParams.containerCount}
                                                    onChange={(e) => handleAssistantChange('containerCount', e.target.value)}
                                                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-[4px] focus:ring-2 focus:ring-[#001d35]/50 bg-white"
                                                    placeholder="Ex: 5"
                                                />
                                            </div>
                                        </>
                                    ) : (
                                        <div className="col-span-full">
                                            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Quantité Totale ({formData.unit}s)</label>
                                            <input
                                                type="number"
                                                name="conversionFactor"
                                                required
                                                min="1"
                                                step="any"
                                                value={formData.conversionFactor}
                                                onChange={handleBulkPriceOrContenanceChange}
                                                className="w-full px-4 py-2 border border-gray-200 rounded-[4px] focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                                                placeholder="Ex: 10"
                                            />
                                        </div>
                                    )}
                                </div>

                                {currentUnitModel.archetype !== 'UNIT' && (
                                    <div className="mt-3 pt-3 border-t-2 border-gray-300 flex items-center justify-between">
                                        <span className="text-xs text-gray-500 font-medium">Auto-calcul du stock :</span>
                                        <div className="flex gap-2">
                                            <div className="bg-primary-50 px-3 py-1 border border-primary-200 rounded-[4px]">
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
                                <label className="flex items-center gap-3 text-[12px] font-semibold text-[#001d35] uppercase tracking-wide mb-2">
                                    MONTANT PAYÉ (CASH/DETTE) <span className="text-red-500">*</span>
                                </label>
                                <p className="text-xs text-gray-500 mb-2">Le montant total que vous avez payé pour cette livraison</p>
                                <FinancialInput
                                    name="bulkPurchasePrice"
                                    required
                                    min="0"
                                    value={formData.bulkPurchasePrice}
                                    onChange={handleBulkPriceOrContenanceChange}
                                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-[#001d35]/50 bg-white font-semibold text-gray-900"
                                    placeholder="Ex: 5 000"
                                />
                            </div>
                            
                            {/* ── Prix de Vente (Remonté ici) ── */}
                            <div className="bg-blue-50 p-4 rounded-sm border-2 border-blue-200 shadow-inner col-span-2 md:col-span-1">
                                <label className="flex items-center gap-3 text-[12px] font-semibold text-blue-900 mb-2 uppercase tracking-wide">
                                    Prix de Vente : 1 {formData.unit} *
                                </label>
                                <FinancialInput
                                    name="price"
                                    required
                                    min="0"
                                    value={formData.price}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border-2 border-blue-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-blue-900 shadow-sm"
                                    placeholder="Ex: 5 000"
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
                                            <button type="button" onClick={() => setShowRetailInfo(!showRetailInfo)} className="text-[#007185] hover:text-[#C45500] transition-colors cursor-pointer">
                                                <Info className="w-4 h-4" />
                                            </button>
                                        </div>
                                        {showRetailInfo && (
                                            <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-[4px] text-xs text-blue-800 shadow-sm">
                                                <p className="font-semibold mb-1">Comment fonctionnent les modes cumulatifs ?</p>
                                                <ul className="list-disc pl-5 space-y-1.5">
                                                    <li><strong>Vente Classique :</strong> Toujours active par défaut.</li>
                                                    {formData.unitArchetype === 'BOX' && <li><strong>Vente en petit Lot :</strong> Ajoute une option pour vendre un lot de pièces internes (ex: 10 vis).</li>}
                                                    {formData.unitArchetype === 'BULK' && <li><strong>Vente Fractionnée :</strong> Ajoute des options pour vendre par poids/volume exacts.</li>}
                                                </ul>
                                            </div>
                                        )}
                                        <div className="space-y-3">

                                            {/* Option par pièce */}
                                            {formData.unitArchetype === 'BOX' && (
                                                <div className="flex flex-col md:flex-row items-stretch gap-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormData(prev => ({ ...prev, hasPiece: !prev.hasPiece }))}
                                                        className={`w-full md:w-60 shrink-0 p-3 text-left transition-all rounded-[4px] border-2 cursor-pointer select-none flex flex-col justify-center ${
                                                            formData.hasPiece
                                                                ? 'border-[#001d35] bg-[#001d35]/10 text-[#001d35] font-bold shadow-xs'
                                                                : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400 hover:bg-gray-50/50'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2.5">
                                                            <input
                                                                type="checkbox"
                                                                checked={formData.hasPiece}
                                                                readOnly
                                                                className="w-4 h-4 rounded-[4px] border-gray-300 accent-[#001d35] cursor-pointer pointer-events-none shrink-0"
                                                            />
                                                            <span className={`text-sm ${formData.hasPiece ? 'font-bold text-[#001d35]' : 'font-semibold text-gray-800'}`}>
                                                                Option par pièce
                                                            </span>
                                                        </div>
                                                        <div className={`text-xs mt-1.5 ml-6.5 ${formData.hasPiece ? 'text-[#001d35]/80 font-medium' : 'text-gray-500'}`}>
                                                            Vente à l'unité depuis la boite
                                                        </div>
                                                    </button>

                                                    {formData.hasPiece ? (
                                                        <div className="flex-1 bg-primary-50 p-3 rounded-[4px] border border-primary-200 animate-in fade-in duration-150 flex flex-col justify-center">
                                                            <div>
                                                                <label className="block text-xs font-bold text-primary-900 mb-1">Prix par pièce (FCFA)</label>
                                                                <FinancialInput
                                                                    name="piecePrice"
                                                                    required
                                                                    min="0"
                                                                    value={formData.piecePrice}
                                                                    onChange={handleChange}
                                                                    className="w-full px-3 py-1.5 text-sm border border-primary-300 rounded-[4px] focus:outline-none focus:ring-2 focus:ring-primary-500 font-bold bg-white"
                                                                    placeholder="Ex: 75"
                                                                />
                                                            </div>
                                                            {!isNaN(parseFloat(formData.purchasePrice)) && parseFloat(formData.conversionFactor) > 0 && parseFloat(formData.piecePrice) > 0 && (
                                                                <div className="mt-1.5 text-[10px] text-right text-primary-700 font-medium">
                                                                    Coût unitaire: {Math.round(parseFloat(formData.purchasePrice) / parseFloat(formData.conversionFactor))} FCFA
                                                                    {' '}(Marge: {Math.round(((parseFloat(formData.piecePrice) - (parseFloat(formData.purchasePrice) / parseFloat(formData.conversionFactor))) / parseFloat(formData.piecePrice)) * 100)}%)
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="hidden md:flex flex-1 items-center px-4 py-3 rounded-[4px] border border-dashed border-gray-200 text-xs text-gray-400 bg-gray-50/40">
                                                            Cochez cette option pour configurer le prix de vente à l'unité
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Vente Lot */}
                                            {formData.unitArchetype === 'BOX' && (
                                                <div className="flex flex-col md:flex-row items-stretch gap-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormData(prev => {
                                                            const nextHasLot = !prev.hasLot;
                                                            const currentLots = (prev.lots && prev.lots.length > 0) ? prev.lots : [{ id: 'lot_' + Date.now(), quantity: '10', price: '' }];
                                                            return { ...prev, hasLot: nextHasLot, lots: currentLots };
                                                        })}
                                                        className={`w-full md:w-60 shrink-0 p-3 text-left transition-all rounded-[4px] border-2 cursor-pointer select-none flex flex-col justify-center ${
                                                            formData.hasLot
                                                                ? 'border-[#001d35] bg-[#001d35]/10 text-[#001d35] font-bold shadow-xs'
                                                                : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400 hover:bg-gray-50/50'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2.5">
                                                            <input
                                                                type="checkbox"
                                                                checked={formData.hasLot}
                                                                readOnly
                                                                className="w-4 h-4 rounded-[4px] border-gray-300 accent-[#001d35] cursor-pointer pointer-events-none shrink-0"
                                                            />
                                                            <span className={`text-sm ${formData.hasLot ? 'font-bold text-[#001d35]' : 'font-semibold text-gray-800'}`}>
                                                                Option Petit Lot
                                                            </span>
                                                        </div>
                                                        <div className={`text-xs mt-1.5 ml-6.5 ${formData.hasLot ? 'text-[#001d35]/80 font-medium' : 'text-gray-500'}`}>
                                                            {formData.hasLot && formData.lots?.length > 1
                                                                ? `${formData.lots.length} options configurées`
                                                                : 'Ex: Lot de 10 pièces'}
                                                        </div>
                                                    </button>

                                                    {formData.hasLot ? (
                                                        <div className="flex-1 bg-primary-50 p-3 rounded-[4px] border border-primary-200 animate-in fade-in duration-150 flex flex-col gap-2.5">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-xs font-bold text-primary-900">
                                                                    Configuration des Petits Lots ({formData.lots?.length || 1})
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    onClick={handleAddLot}
                                                                    className="text-xs bg-[#001d35] hover:bg-[#00284c] text-white px-2.5 py-1 rounded-[4px] font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                                                                    title="Ajouter une autre option de lot"
                                                                >
                                                                    <Plus className="w-3.5 h-3.5" />
                                                                    <span>Ajouter un lot</span>
                                                                </button>
                                                            </div>

                                                            <div className="space-y-2">
                                                                {(formData.lots || [{ id: 'lot_default', quantity: '10', price: '' }]).map((lot, idx) => {
                                                                    const parsedPrice = parseFloat(lot.price);
                                                                    const parsedQty = parseFloat(lot.quantity);
                                                                    const purchaseP = parseFloat(formData.purchasePrice);
                                                                    const factor = parseFloat(formData.conversionFactor) || 1;
                                                                    const hasCostCalculation = !isNaN(purchaseP) && factor > 0 && parsedPrice > 0 && parsedQty > 0;
                                                                    const lotCost = hasCostCalculation ? Math.round((purchaseP / factor) * parsedQty) : 0;
                                                                    const marginPercent = hasCostCalculation && parsedPrice > 0 ? Math.round(((parsedPrice - lotCost) / parsedPrice) * 100) : 0;

                                                                    return (
                                                                        <div key={lot.id || idx} className="p-2.5 bg-white rounded-[4px] border border-primary-200 shadow-2xs">
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="text-[10px] font-bold text-primary-900 bg-primary-100/70 px-1.5 py-1 rounded-[4px] shrink-0">
                                                                                    Lot #{idx + 1}
                                                                                </span>
                                                                                <div className="w-1/3">
                                                                                    <label className="block text-[10px] font-bold text-gray-600 uppercase mb-0.5">
                                                                                        Qté ({currentUnitModel?.subUnit || 'Pièces'})
                                                                                    </label>
                                                                                    <input
                                                                                        type="number"
                                                                                        required
                                                                                        min="1"
                                                                                        value={lot.quantity || ''}
                                                                                        onChange={(e) => handleLotChange(lot.id, 'quantity', e.target.value)}
                                                                                        className="w-full px-2 py-1 text-sm border border-primary-300 rounded-[4px] focus:outline-none focus:ring-2 focus:ring-primary-500 hide-arrows bg-white font-medium"
                                                                                        placeholder="Ex: 10"
                                                                                    />
                                                                                </div>
                                                                                <div className="flex-1">
                                                                                    <label className="block text-[10px] font-bold text-gray-600 uppercase mb-0.5">
                                                                                        Prix du Lot (FCFA)
                                                                                    </label>
                                                                                    <FinancialInput
                                                                                        required
                                                                                        min="0"
                                                                                        value={lot.price || ''}
                                                                                        onChange={(e) => handleLotChange(lot.id, 'price', e.target.value)}
                                                                                        className="w-full px-3 py-1 text-sm border border-primary-300 rounded-[4px] focus:outline-none focus:ring-2 focus:ring-primary-500 font-bold bg-white"
                                                                                        placeholder="Ex: 600"
                                                                                    />
                                                                                </div>
                                                                                {(formData.lots || []).length > 1 && (
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => handleRemoveLot(lot.id)}
                                                                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-[4px] transition-colors cursor-pointer self-end mb-0.5 shrink-0"
                                                                                        title="Supprimer ce lot"
                                                                                    >
                                                                                        <X className="w-4 h-4" />
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                            {hasCostCalculation && (
                                                                                <div className="mt-1 text-[10px] text-right text-primary-700 font-medium">
                                                                                    Coût Lot estimé: {lotCost} FCFA
                                                                                    {' '}(Marge: {marginPercent}%)
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="hidden md:flex flex-1 items-center px-4 py-3 rounded-[4px] border border-dashed border-gray-200 text-xs text-gray-400 bg-gray-50/40">
                                                            Cochez cette option pour configurer un prix par lot (ex: 10 pièces)
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Vente Fractionnée */}
                                            {formData.unitArchetype === 'BULK' && (
                                                <div className="flex flex-col md:flex-row items-stretch gap-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormData(prev => ({ ...prev, hasSubUnit: !prev.hasSubUnit }))}
                                                        className={`w-full md:w-60 shrink-0 p-3 text-left transition-all rounded-[4px] border-2 cursor-pointer select-none flex flex-col justify-center ${
                                                            formData.hasSubUnit
                                                                ? 'border-[#001d35] bg-[#001d35]/10 text-[#001d35] font-bold shadow-xs'
                                                                : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400 hover:bg-gray-50/50'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2.5">
                                                            <input
                                                                type="checkbox"
                                                                checked={formData.hasSubUnit}
                                                                readOnly
                                                                className="w-4 h-4 rounded-[4px] border-gray-300 accent-[#001d35] cursor-pointer pointer-events-none shrink-0"
                                                            />
                                                            <span className={`text-sm ${formData.hasSubUnit ? 'font-bold text-[#001d35]' : 'font-semibold text-gray-800'}`}>
                                                                Vente Modèles
                                                            </span>
                                                        </div>
                                                        <div className={`text-xs mt-1.5 ml-6.5 ${formData.hasSubUnit ? 'text-[#001d35]/80 font-medium' : 'text-gray-500'}`}>
                                                            Fractionnement (ex: 500g)
                                                        </div>
                                                    </button>

                                                    {formData.hasSubUnit ? (
                                                        <div className="flex-1 bg-primary-50 px-4 py-3 rounded-[4px] border border-primary-200 animate-in fade-in duration-150 flex items-center justify-between text-xs text-primary-900">
                                                            <div>
                                                                <span className="font-bold">Mode fractionné actif</span> : configurez les déclinaisons de vente ci-dessous.
                                                            </div>
                                                            <span className="text-[11px] font-semibold bg-primary-100 text-primary-800 px-2 py-0.5 rounded-[4px]">
                                                                {formData.packagings.length} option(s)
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <div className="hidden md:flex flex-1 items-center px-4 py-3 rounded-[4px] border border-dashed border-gray-200 text-xs text-gray-400 bg-gray-50/40">
                                                            Cochez cette option pour créer des portions personnalisées au poids ou volume
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* ══ Modèles de Déconditionnement / Vente Fractionnée ══ */}
                            {formData.hasSubUnit && (
                                <div className="col-span-2">
                                    <div className="flex items-center justify-between mb-3 pt-3 border-t-2 border-gray-200">
                                        <div>
                                            <h4 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
                                                <Package className="w-4 h-4 text-[#001d35]" />
                                                <span>Options de Vente Fractionnée (Déconditionnement Vrac)</span>
                                            </h4>
                                            <p className="text-xs text-gray-500 mt-0.5">
                                                Définissez vos portions personnalisées en {formData.bulkUnit || currentUnitModel?.subUnit || 'mesure'} (ex: 5 {formData.bulkUnit || currentUnitModel?.subUnit || 'Kg'} à 750 FCFA).
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
                                            className="text-xs bg-[#001d35] text-white px-3 py-1.5 rounded-[4px] hover:bg-[#00284c] transition-colors font-bold cursor-pointer flex items-center gap-1.5 shadow-2xs"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            <span>Ajouter une option</span>
                                        </button>
                                    </div>

                                    {/* Suggestions rapides selon l'unité de mesure choisie */}
                                    {(() => {
                                        const currentSub = formData.bulkUnit || currentUnitModel?.subUnit || 'Kilo';
                                        const presetsBySub = {
                                            'Kilo': [1, 2, 5, 10, 25],
                                            'Gramme': [100, 250, 500, 750],
                                            'Litre': [0.5, 1, 2, 5, 10],
                                            'Millilitre': [50, 100, 250, 500],
                                            'Mètre': [1, 2, 5, 10, 20, 50],
                                            'Centimètre': [10, 25, 50]
                                        };
                                        const presets = presetsBySub[currentSub] || [1, 2, 5, 10];
                                        const factor = parseFloat(formData.conversionFactor) || 1;

                                        return (
                                            <div className="mb-3 p-2.5 bg-slate-50 border border-slate-200 rounded-[4px] flex flex-wrap items-center gap-2">
                                                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Suggestions rapides :</span>
                                                {presets.map(qty => {
                                                    if (factor > 0 && qty >= factor) return null;
                                                    return (
                                                        <button
                                                            key={qty}
                                                            type="button"
                                                            onClick={() => {
                                                                const subUnitName = formData.bulkUnit || currentUnitModel?.subUnit || 'unités';
                                                                const autoName = `${qty} ${subUnitName}`;
                                                                const exists = formData.packagings.some(p => parseFloat(p.targetQty) === qty);
                                                                if (exists) return;
                                                                const newId = 'custom_' + Date.now() + '_' + qty;
                                                                const ratio = factor > 0 ? (qty / factor) : 0;
                                                                setFormData(prev => ({
                                                                    ...prev,
                                                                    packagings: [...prev.packagings, {
                                                                        modelId: newId,
                                                                        name: autoName,
                                                                        targetQty: qty.toString(),
                                                                        price: '',
                                                                        deductionRatio: ratio
                                                                    }]
                                                                }));
                                                            }}
                                                            className="px-2.5 py-1 bg-white hover:bg-blue-50 border border-slate-300 hover:border-[#001d35] rounded-[4px] text-xs font-bold text-slate-700 hover:text-[#001d35] transition-all cursor-pointer shadow-2xs"
                                                        >
                                                            + {qty} {currentSub}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })()}

                                    <div className="space-y-3">
                                        {formData.packagings.length === 0 && (
                                            <div className="p-6 text-center bg-gray-50 rounded-[4px] border border-dashed border-gray-200">
                                                <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                                                <p className="text-sm text-gray-500">Aucune option créée. Cliquez sur Ajouter ou choisissez une suggestion.</p>
                                            </div>
                                        )}
                                        {formData.packagings.map((pkg) => {
                                            const val = parseFloat(pkg.targetQty) || 0;
                                            const priceVal = parseFloat(pkg.price) || 0;
                                            const factor = parseFloat(formData.conversionFactor) || 1;
                                            const purchaseP = parseFloat(formData.purchasePrice) || 0;
                                            const hasCostCalc = purchaseP > 0 && factor > 0 && val > 0;
                                            const estimatedCost = hasCostCalc ? Math.round((purchaseP / factor) * val) : 0;
                                            const marginPercent = (hasCostCalc && priceVal > 0) ? Math.round(((priceVal - estimatedCost) / priceVal) * 100) : 0;
                                            const subUnitName = formData.bulkUnit || currentUnitModel?.subUnit || 'unités';
                                            const deduction = factor > 0 ? (val / factor) : 0;

                                            return (
                                                <div key={pkg.modelId} className="border-2 border-primary-200 bg-white rounded-[4px] p-3.5 relative shadow-2xs">
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormData(prev => ({
                                                            ...prev,
                                                            packagings: prev.packagings.filter(p => p.modelId !== pkg.modelId)
                                                        }))}
                                                        className="absolute top-2 right-2 text-gray-400 hover:text-red-500 p-1 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
                                                        title="Supprimer cette option"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pr-6">
                                                        <div>
                                                            <label className="text-[11px] font-semibold text-gray-600 mb-1 block uppercase tracking-wide">
                                                                Quantité vendue ({subUnitName})
                                                            </label>
                                                            <input
                                                                type="number"
                                                                min="0.0001"
                                                                step="any"
                                                                value={pkg.targetQty}
                                                                onChange={(e) => {
                                                                    const newTarget = parseFloat(e.target.value) || 0;
                                                                    const currentFactor = parseFloat(formData.conversionFactor) || 1;
                                                                    const autoName = newTarget > 0 ? `${newTarget} ${subUnitName}` : '';
                                                                    setFormData(prev => ({
                                                                        ...prev,
                                                                        packagings: prev.packagings.map(p => p.modelId === pkg.modelId ? {
                                                                            ...p,
                                                                            targetQty: e.target.value,
                                                                            name: autoName,
                                                                            deductionRatio: currentFactor > 0 ? (newTarget / currentFactor) : 0
                                                                        } : p)
                                                                    }));
                                                                }}
                                                                className="w-full px-3 py-2 text-sm border-2 border-gray-300 rounded-[4px] focus:outline-none focus:ring-2 focus:ring-[#001d35]/50 bg-white font-medium"
                                                                placeholder="Ex: 5"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-[11px] font-semibold text-gray-600 mb-1 block uppercase tracking-wide">Prix de Vente (FCFA)</label>
                                                            <FinancialInput
                                                                min="0"
                                                                value={pkg.price}
                                                                onChange={(e) => {
                                                                    const pVal = e.target.value;
                                                                    setFormData(prev => ({
                                                                        ...prev,
                                                                        packagings: prev.packagings.map(p => p.modelId === pkg.modelId ? { ...p, price: pVal } : p)
                                                                    }));
                                                                }}
                                                                className="w-full px-3 py-2 text-sm border-2 border-gray-300 rounded-[4px] focus:outline-none focus:ring-2 focus:ring-[#001d35]/50 font-semibold text-[#001d35] bg-white"
                                                                placeholder="Ex: 750"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="mt-2.5 pt-2 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                                                        {deduction > 0 && (
                                                            <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-[4px] border border-amber-200">
                                                                ⚖️ Déduit exactement <strong>{Number(deduction.toFixed(4))} {formData.unit}</strong> du stock par vente
                                                            </span>
                                                        )}
                                                        {hasCostCalc && (
                                                            <span className="text-[11px] font-medium text-slate-600 ml-auto">
                                                                Coût de revient : <strong>{estimatedCost} FCFA</strong>
                                                                {priceVal > 0 && (
                                                                    <span className={`ml-1 font-bold ${marginPercent >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                                                        (Marge : {marginPercent}%)
                                                                    </span>
                                                                )}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}



                            {/* ══ Informations de Stock ══ */}
                            <div className="col-span-2 mt-2">
                                <div className="flex items-center gap-2 border-b-2 border-gray-300 pb-2">
                                    <h3 className="font-semibold text-gray-900/60 uppercase tracking-widest text-xs">INFORMATIONS DE STOCK</h3>
                                    <button type="button" onClick={() => setShowStockInfo(!showStockInfo)} className="text-[#007185] hover:text-[#C45500] transition-colors cursor-pointer">
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

                            {/* Colonne 1 : Stock Actuel (Récapitulatif synchronisé) */}
                            <div>
                                <div className="flex items-center justify-between gap-2 mb-2">
                                    <label className="flex items-center gap-2 text-[12px] font-semibold text-[#001d35] uppercase tracking-wide">
                                        <Package className="w-5 h-5 text-gray-700" />
                                        STOCK ACTUEL
                                    </label>
                                    <span className="text-[11px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-xs border border-gray-200">
                                        Auto-calculé
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500 mb-2">
                                    Quantité totale disponible en rayon / réserve
                                </p>
                                <div className="relative">
                                    <div className="w-full px-4 py-2 pr-24 border-2 border-gray-300 rounded-sm bg-gray-50 font-bold text-gray-900 text-sm flex items-center justify-between">
                                        <span className="text-base text-[#001d35]">{formData.stock || 0}</span>
                                    </div>
                                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-xs font-bold text-gray-500 uppercase">
                                        {formData.unit || 'Unité'}{parseFloat(formData.stock) > 1 ? 's' : ''}
                                    </div>
                                </div>
                                {formData.unitArchetype !== 'UNIT' && parseFloat(formData.conversionFactor) > 0 && (
                                    <p className="mt-1.5 text-[11px] font-semibold text-gray-600">
                                        Soit au total : <strong className="text-[#001d35]">{(parseFloat(formData.stock || 0) * parseFloat(formData.conversionFactor)).toLocaleString()} {currentUnitModel.subUnit || 'pièces'}</strong>
                                    </p>
                                )}
                            </div>

                            {/* Colonne 2 : Stock Minimum d'alerte avec sélecteur par Checkbox (aucun choix par défaut) */}
                            <div 
                                ref={minStockRef}
                                className={`rounded-sm transition-all duration-200 ${
                                    minStockError 
                                        ? 'border-2 border-red-500 bg-red-50/70 p-3 ring-2 ring-red-200 shadow-sm' 
                                        : 'border border-transparent p-0'
                                }`}
                            >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                                    <label className={`flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide ${minStockError ? 'text-red-700' : 'text-[#001d35]'}`}>
                                        <img src="/icons8/color_96_high-priority.png" alt="" className="w-6 h-6" />
                                        <span>STOCK MINIMUM D'ALERTE</span>
                                    </label>

                                    {/* Sélecteur d'unité par Checkbox (aucun choix par défaut) */}
                                    <div className="flex items-center gap-2">
                                        {/* Option 1: Unité de base (Boîte, Carton, Sac ou Unité) */}
                                        <label className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm border cursor-pointer select-none transition-all ${
                                            minStockUnit === 'base'
                                                ? 'bg-[#001d35] text-white border-[#001d35] shadow-xs font-bold'
                                                : minStockError
                                                    ? 'bg-white border-red-300 text-red-800 hover:border-red-400'
                                                    : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400'
                                        }`}>
                                            <input
                                                type="checkbox"
                                                name="minStockUnitChoice"
                                                checked={minStockUnit === 'base'}
                                                onChange={() => handleMinStockUnitChange('base')}
                                                className="w-3.5 h-3.5 rounded-xs border-gray-300 accent-[#001d35] cursor-pointer"
                                            />
                                            <span className="text-[11px] font-bold">
                                                {formData.unit || (formData.unitArchetype === 'UNIT' ? 'Unité' : 'Boîte')}
                                            </span>
                                        </label>

                                        {/* Option 2: Sous-unité / Pièce (affiché si Boîte ou Vrac) */}
                                        {formData.unitArchetype !== 'UNIT' && (
                                            <label className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm border cursor-pointer select-none transition-all ${
                                                minStockUnit === 'piece'
                                                    ? 'bg-[#001d35] text-white border-[#001d35] shadow-xs font-bold'
                                                    : minStockError
                                                        ? 'bg-white border-red-300 text-red-800 hover:border-red-400'
                                                        : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400'
                                            }`}>
                                                <input
                                                    type="checkbox"
                                                    name="minStockUnitChoice"
                                                    checked={minStockUnit === 'piece'}
                                                    onChange={() => handleMinStockUnitChange('piece')}
                                                    className="w-3.5 h-3.5 rounded-xs border-gray-300 accent-[#001d35] cursor-pointer"
                                                />
                                                <span className="text-[11px] font-bold">
                                                    {currentUnitModel.subUnit || 'Pièce'}
                                                </span>
                                            </label>
                                        )}
                                    </div>
                                </div>

                                <p className={`text-xs mb-2 ${minStockError ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                                    {minStockUnit 
                                        ? `En dessous de ce seuil (${minStockUnit === 'piece' ? (currentUnitModel.subUnit || 'pièces') : (formData.unit || 'unités')}), une alerte sera déclenchée`
                                        : "Veuillez cocher une unité ci-dessus pour définir le seuil d'alerte"}
                                </p>

                                <div className="relative">
                                    <input
                                        type="number"
                                        name="minStockInput"
                                        min="0"
                                        step="any"
                                        value={minStockInput}
                                        onChange={handleMinStockInputChange}
                                        className={`w-full px-4 py-2 pr-24 border-2 rounded-sm focus:outline-none bg-white font-semibold text-gray-900 text-sm transition-colors ${
                                            minStockError 
                                                ? 'border-red-500 focus:ring-2 focus:ring-red-300' 
                                                : 'border-gray-300 focus:ring-2 focus:ring-[#001d35]/50'
                                        }`}
                                        placeholder={minStockUnit ? (minStockUnit === 'piece' ? "Ex: 20" : "Ex: 2") : "Cochez d'abord une unité..."}
                                    />
                                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-xs font-bold uppercase">
                                        {minStockUnit ? (
                                            <span className="text-gray-400">
                                                {minStockUnit === 'piece' 
                                                    ? (currentUnitModel.subUnit || 'Pièce') 
                                                    : (formData.unit || 'Unité')}
                                            </span>
                                        ) : (
                                            <span className="text-amber-500 italic text-[11px]">Unité requise</span>
                                        )}
                                    </div>
                                </div>

                                {/* Message d'erreur et zone d'avertissement rouge */}
                                {minStockError && (
                                    <div className="flex items-center gap-2 mt-2.5 text-xs text-red-700 font-bold bg-white p-2.5 rounded-sm border border-red-300 shadow-2xs animate-in fade-in">
                                        <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                                        <span>Erreur : Vous devez cocher une unité de seuil d'alerte et saisir une quantité valide avant d'enregistrer.</span>
                                    </div>
                                )}

                                {/* Équivalence automatique visuelle discrète */}
                                {formData.unitArchetype !== 'UNIT' && parseFloat(formData.conversionFactor) > 0 && parseFloat(minStockInput) > 0 && minStockUnit && (
                                    <p className="mt-1.5 text-[11px] font-semibold text-[#001d35]">
                                        {minStockUnit === 'piece' ? (
                                            <>Équivaut à <strong>{(parseFloat(minStockInput) / parseFloat(formData.conversionFactor)).toFixed(2)} {formData.unit}</strong> restante{parseFloat(minStockInput) / parseFloat(formData.conversionFactor) > 1 ? 's' : ''}</>
                                        ) : (
                                            <>Équivaut à <strong>{(parseFloat(minStockInput) * parseFloat(formData.conversionFactor)).toLocaleString()} {currentUnitModel.subUnit || 'pièce'}{parseFloat(minStockInput) * parseFloat(formData.conversionFactor) > 1 ? 's' : ''}</strong></>
                                        )}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-6 border-t-2 border-gray-300 bg-gray-50/50 p-6">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-6 py-2.5 text-gray-700 hover:bg-gray-200 border-2 border-gray-300 rounded-sm font-bold transition-colors cursor-pointer"
                            >
                                Annuler
                            </button>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="bg-[#001d35] hover:bg-[#001222] text-white px-8 py-2.5 rounded-sm font-bold shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
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
                <div className="fixed inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-[100] animate-in fade-in duration-150">
                    <div className="flex flex-col items-center gap-5 bg-white px-10 py-8 rounded-sm shadow-2xl border border-gray-100">
                        <div className="w-14 h-14 border-4 border-[#001d35]/20 border-t-[#001d35] rounded-full animate-spin"></div>
                        <div className="text-center">
                            <p className="text-gray-900 font-bold text-base">
                                {product ? 'Modification du produit...' : 'Création du produit...'}
                            </p>
                            <p className="text-gray-500 text-sm mt-1">
                                Enregistrement dans le catalogue
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductModal;
