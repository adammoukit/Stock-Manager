import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { useSettings } from '../../context/SettingsContext';
import { formatPrice } from '../../utils/currency';
import T from '../../utils/toast';
import { 
    Package, Plus, Search, Edit2, Trash2, X, Eye, 
    Download, Check, AlertTriangle, 
    HardHat, Droplet, Zap, PaintBucket, Wrench, PenTool, 
    Layers, Grid, Flower2, ShoppingBag, Box, Tag, Shield, 
    FolderTree, RefreshCw
} from 'lucide-react';

// Palette d'icônes disponibles pour les catégories
const AVAILABLE_ICONS = [
    { name: 'Package', component: Package, label: 'Colis / Général' },
    { name: 'HardHat', component: HardHat, label: 'Chantier / Sécurité' },
    { name: 'Droplet', component: Droplet, label: 'Plomberie' },
    { name: 'Zap', component: Zap, label: 'Électricité' },
    { name: 'PaintBucket', component: PaintBucket, label: 'Peinture' },
    { name: 'Wrench', component: Wrench, label: 'Outillage' },
    { name: 'PenTool', component: PenTool, label: 'Menuiserie' },
    { name: 'Layers', component: Layers, label: 'Matériaux' },
    { name: 'Grid', component: Grid, label: 'Carrelage' },
    { name: 'Flower2', component: Flower2, label: 'Jardin' },
    { name: 'ShoppingBag', component: ShoppingBag, label: 'Divers' },
    { name: 'Box', component: Box, label: 'Boîtes / Lots' },
    { name: 'Tag', component: Tag, label: 'Étiquette' },
    { name: 'Shield', component: Shield, label: 'Protection' }
];

// Palette de couleurs prédéfinies pour les badges
const AVAILABLE_COLORS = [
    { label: 'Bleu Marine', value: '#001d35' },
    { label: 'Bleu Royal', value: '#2563eb' },
    { label: 'Vert Émeraude', value: '#16a34a' },
    { label: 'Orange Sécurité', value: '#f77500' },
    { label: 'Ambre Chaud', value: '#d97706' },
    { label: 'Rouge Brique', value: '#dc2626' },
    { label: 'Violet Sombre', value: '#7c3aed' },
    { label: 'Cyan / Sarcelle', value: '#0891b2' },
    { label: 'Ardoise / Gris', value: '#475569' }
];

const getCategoryIconComponent = (iconName) => {
    const found = AVAILABLE_ICONS.find(i => i.name === iconName);
    return found ? found.component : Package;
};

const Categories = () => {
    const { products, categories, addCategory, updateCategory, deleteCategory } = useInventory();
    const { currentStoreId } = useSettings();

    // ── Loader d'entrée de page (scroll top + 1,5s) ──
    const [isPageLoading, setIsPageLoading] = useState(true);
    const pageLoadTimerRef = useRef(null);

    // ── Loader de validation d'au moins 1,5s pour les actions métier ──
    const [actionLoading, setActionLoading] = useState(null);

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
        pageLoadTimerRef.current = setTimeout(() => {
            setIsPageLoading(false);
        }, 1500);
        return () => {
            if (pageLoadTimerRef.current) clearTimeout(pageLoadTimerRef.current);
        };
    }, []);

    const triggerActionLoading = (message, callback) => {
        setActionLoading(message);
        setTimeout(() => {
            callback();
            setActionLoading(null);
        }, 1500);
    };

    const [searchTerm, setSearchTerm] = useState('');
    const [stockFilter, setStockFilter] = useState('all'); // 'all' | 'with_stock' | 'empty'

    // Modal Create / Edit
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        color: '#001d35',
        icon: 'Package'
    });

    // Modal View Products of a Category
    const [selectedCategoryForProducts, setSelectedCategoryForProducts] = useState(null);
    const [productSearchWithinCategory, setProductSearchWithinCategory] = useState('');

    // Calcul des statistiques enrichies pour chaque catégorie
    const enrichedCategories = useMemo(() => {
        return categories.map(cat => {
            const catProducts = products.filter(p => p.category?.toLowerCase() === cat.name?.toLowerCase());
            const productCount = catProducts.length;

            const totalStockUnits = catProducts.reduce((sum, p) => {
                const stockQty = p.stockLevels?.[currentStoreId] ?? p.stock ?? 0;
                return sum + (Number(stockQty) || 0);
            }, 0);

            const totalStockValue = catProducts.reduce((sum, p) => {
                const stockQty = p.stockLevels?.[currentStoreId] ?? p.stock ?? 0;
                return sum + ((Number(stockQty) || 0) * (Number(p.price) || 0));
            }, 0);

            const avgPrice = productCount > 0
                ? catProducts.reduce((sum, p) => sum + (Number(p.price) || 0), 0) / productCount
                : 0;

            return {
                ...cat,
                productCount,
                totalStockUnits,
                totalStockValue,
                avgPrice,
                products: catProducts
            };
        });
    }, [categories, products, currentStoreId]);

    // Métriques globales pour les KPI cards
    const globalStats = useMemo(() => {
        const totalCats = categories.length;
        const totalArticles = enrichedCategories.reduce((sum, c) => sum + c.productCount, 0);
        const totalStockUnits = enrichedCategories.reduce((sum, c) => sum + c.totalStockUnits, 0);
        const totalStockValue = enrichedCategories.reduce((sum, c) => sum + c.totalStockValue, 0);
        const catsWithStock = enrichedCategories.filter(c => c.totalStockUnits > 0).length;
        const emptyCats = enrichedCategories.filter(c => c.productCount === 0).length;

        return {
            totalCats,
            totalArticles,
            totalStockUnits,
            totalStockValue,
            catsWithStock,
            emptyCats
        };
    }, [categories, enrichedCategories]);

    // Filtrage dynamique
    const filteredCategories = useMemo(() => {
        return enrichedCategories.filter(cat => {
            const matchesSearch = cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (cat.description && cat.description.toLowerCase().includes(searchTerm.toLowerCase()));

            let matchesStock = true;
            if (stockFilter === 'with_stock') matchesStock = cat.totalStockUnits > 0;
            if (stockFilter === 'empty') matchesStock = cat.productCount === 0;

            return matchesSearch && matchesStock;
        });
    }, [enrichedCategories, searchTerm, stockFilter]);

    // Handlers
    const handleOpenCreateModal = () => {
        setEditingCategory(null);
        setFormData({
            name: '',
            description: '',
            color: '#001d35',
            icon: 'Package'
        });
        setIsFormModalOpen(true);
    };

    const handleOpenEditModal = (cat) => {
        setEditingCategory(cat);
        setFormData({
            name: cat.name,
            description: cat.description || '',
            color: cat.color || '#001d35',
            icon: cat.icon || 'Package'
        });
        setIsFormModalOpen(true);
    };

    const handleCloseFormModal = () => {
        setIsFormModalOpen(false);
        setEditingCategory(null);
    };

    const handleFormSubmit = (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            T.warning("Le nom de la catégorie est obligatoire.");
            return;
        }

        // Vérifier les doublons de nom
        const duplicate = categories.find(c => 
            c.name.trim().toLowerCase() === formData.name.trim().toLowerCase() && 
            (!editingCategory || c.id !== editingCategory.id)
        );

        if (duplicate) {
            T.warning(`Une catégorie nommée "${formData.name}" existe déjà.`);
            return;
        }

        if (editingCategory) {
            triggerActionLoading("Mise à jour de la catégorie...", () => {
                updateCategory(editingCategory.id, formData);
                T.saved(`Catégorie "${formData.name}" mise à jour avec succès !`);
                handleCloseFormModal();
            });
        } else {
            triggerActionLoading("Création de la catégorie...", () => {
                addCategory(formData);
                T.success(`Catégorie "${formData.name}" créée avec succès !`);
                handleCloseFormModal();
            });
        }
    };

    const handleDeleteCategory = (cat) => {
        if (cat.productCount > 0) {
            const confirm = window.confirm(
                `Attention : La catégorie "${cat.name}" contient ${cat.productCount} produit(s).\n\n` +
                `Si vous la supprimez, ces articles seront automatiquement réassignés à la catégorie "Général".\n\n` +
                `Voulez-vous continuer ?`
            );
            if (!confirm) return;
        } else {
            if (!window.confirm(`Voulez-vous vraiment supprimer la catégorie "${cat.name}" ?`)) return;
        }

        triggerActionLoading("Suppression de la catégorie...", () => {
            deleteCategory(cat.id, 'Général');
            T.deleted(`Catégorie "${cat.name}" supprimée`);
        });
    };

    const handleExportCSV = () => {
        if (enrichedCategories.length === 0) {
            T.warning("Aucune catégorie à exporter.");
            return;
        }

        triggerActionLoading("Génération de l'export CSV...", () => {
            const headers = ['Nom Catégorie', 'Description', 'Nombre Articles', 'Stock Total', 'Valeur Stock (FCFA)', 'Prix Moyen (FCFA)'];
            const rows = enrichedCategories.map(c => [
                c.name,
                c.description || '',
                c.productCount,
                c.totalStockUnits,
                c.totalStockValue,
                Math.round(c.avgPrice)
            ]);

            const csvContent = [
                headers.join(','),
                ...rows.map(r => r.map(cell => `"${cell}"`).join(','))
            ].join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `categories_quincaillerie_${new Date().toISOString().slice(0, 10)}.csv`;
            link.click();
            T.export("Export CSV des catégories réussi !");
        });
    };

    // Produits filtrés pour la modal d'aperçu d'une catégorie
    const productsInSelectedCategory = useMemo(() => {
        if (!selectedCategoryForProducts) return [];
        return selectedCategoryForProducts.products.filter(p => 
            p.name.toLowerCase().includes(productSearchWithinCategory.toLowerCase()) ||
            (p.supplier && p.supplier.toLowerCase().includes(productSearchWithinCategory.toLowerCase()))
        );
    }, [selectedCategoryForProducts, productSearchWithinCategory]);

    return (
        <div className="space-y-3 font-sans pb-10">

            {/* ── EN-TÊTE PRINCIPAL OFFICIEL KABLLIX ERP (IDENTIQUE RÉAPPROVISIONNEMENT) ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-[4px] border-2 border-gray-300 shadow-sm">
                <div>
                    <h1 className="text-base sm:text-lg font-bold text-[#001d35] tracking-tight flex items-center gap-2">
                        <FolderTree className="w-5 h-5 text-[#001d35]" />
                        <span>Gestion des Catégories</span>
                    </h1>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handleExportCSV}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-[4px] border-2 border-gray-300 bg-white hover:bg-gray-50 text-[#001d35] transition-all cursor-pointer shadow-sm active:scale-95"
                        title="Exporter le résumé des catégories au format CSV"
                    >
                        <Download className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Exporter CSV</span>
                    </button>
                    <button
                        type="button"
                        onClick={handleOpenCreateModal}
                        className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold uppercase tracking-wider rounded-[4px] bg-[#001d35] hover:bg-[#00284a] text-white transition-all cursor-pointer shadow-sm active:scale-95"
                    >
                        <Plus className="w-3.5 h-3.5 text-[#f77500]" />
                        <span>Nouvelle Catégorie</span>
                    </button>
                </div>
            </div>

            {/* ── 4 STATCARDS KPI HARMONISÉES AVEC RÉAPPROVISIONNEMENT ET DASHBOARD ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. Total Catégories */}
                <div className="bg-white p-3.5 rounded-[4px] border-2 border-gray-300 shadow-sm relative group hover:shadow-md transition-shadow overflow-hidden min-h-[120px] flex flex-col justify-center">
                    <div className="flex justify-between items-start relative z-10">
                        <div className="flex-1">
                            <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-[#001d35]">
                                Total Catégories
                            </p>
                            <div className="flex items-baseline mt-2 font-semibold" style={{ color: '#001d35' }}>
                                <h3 className="text-xl sm:text-2xl font-semibold text-[#001d35]">
                                    {globalStats.totalCats}
                                </h3>
                            </div>
                            <p className="text-xs text-gray-600 mt-2 font-medium">
                                Dont {globalStats.catsWithStock} famille(s) active(s) en stock
                            </p>
                        </div>
                    </div>
                    <img
                        src="/icons8/fluency_240_tags.png"
                        alt=""
                        className="absolute bottom-2 right-2 w-16 h-16 opacity-80 group-hover:opacity-100 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-700 pointer-events-none"
                    />
                </div>

                {/* 2. Articles Référencés */}
                <div className="bg-white p-3.5 rounded-[4px] border-2 border-gray-300 shadow-sm relative group hover:shadow-md transition-shadow overflow-hidden min-h-[120px] flex flex-col justify-center">
                    <div className="flex justify-between items-start relative z-10">
                        <div className="flex-1">
                            <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-[#001d35]">
                                Articles Catalogués
                            </p>
                            <div className="flex items-baseline mt-2 font-semibold" style={{ color: '#001d35' }}>
                                <h3 className="text-xl sm:text-2xl font-semibold text-[#001d35]">
                                    {globalStats.totalArticles}
                                </h3>
                            </div>
                            <p className="text-xs text-gray-600 mt-2 font-medium">
                                Références associées aux catégories
                            </p>
                        </div>
                    </div>
                    <img
                        src="/icons8/fluency_240_product.png"
                        alt=""
                        className="absolute bottom-2 right-2 w-16 h-16 opacity-80 group-hover:opacity-100 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-700 pointer-events-none"
                    />
                </div>

                {/* 3. Volume Stock Total */}
                <div className="bg-white p-3.5 rounded-[4px] border-2 border-gray-300 shadow-sm relative group hover:shadow-md transition-shadow overflow-hidden min-h-[120px] flex flex-col justify-center">
                    <div className="flex justify-between items-start relative z-10">
                        <div className="flex-1">
                            <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-emerald-700">
                                Volume Stock Global
                            </p>
                            <div className="flex items-baseline mt-2 font-semibold" style={{ color: '#047857' }}>
                                <h3 className="text-xl sm:text-2xl font-semibold text-emerald-700">
                                    {globalStats.totalStockUnits.toLocaleString()}
                                </h3>
                            </div>
                            <p className="text-xs text-gray-600 mt-2 font-medium">
                                Unités physiques disponibles en rayon
                            </p>
                        </div>
                    </div>
                    <img
                        src="/icons8/fluency_240_box.png"
                        alt=""
                        className="absolute bottom-2 right-2 w-16 h-16 opacity-80 group-hover:opacity-100 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-700 pointer-events-none"
                    />
                </div>

                {/* 4. Valeur Estimée Catalogue */}
                <div className="bg-white p-3.5 rounded-[4px] border-2 border-gray-300 shadow-sm relative group hover:shadow-md transition-shadow overflow-hidden min-h-[120px] flex flex-col justify-center">
                    <div className="flex justify-between items-start relative z-10">
                        <div className="flex-1">
                            <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-[#001d35]">
                                Valeur Stock Estimée
                            </p>
                            <div className="flex items-baseline mt-2 font-semibold" style={{ color: '#f77500' }}>
                                <h3 className="text-xl sm:text-2xl font-semibold text-[#f77500]">
                                    {formatPrice(globalStats.totalStockValue)}
                                </h3>
                            </div>
                            <p className="text-xs text-gray-600 mt-2 font-medium">
                                Valorisation marchande de l'inventaire
                            </p>
                        </div>
                    </div>
                    <img
                        src="/icons8/fluency_240_coins.png"
                        alt=""
                        className="absolute bottom-2 right-2 w-16 h-16 opacity-80 group-hover:opacity-100 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-700 pointer-events-none"
                    />
                </div>
            </div>

            {/* ── BARRE DE RECHERCHE ET FILTRES RAPIDES (HARMONISÉE AVEC RÉAPPROVISIONNEMENT) ── */}
            <div className="bg-white p-2.5 rounded-[4px] border-2 border-gray-300 shadow-sm">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                    {/* Recherche */}
                    <div className="relative flex-1 min-w-[220px] max-w-md">
                        <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Rechercher une catégorie ou description..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-8 pr-8 py-1.5 text-xs border border-gray-300 rounded-[4px] focus:outline-none focus:ring-1 focus:ring-[#001d35] bg-white font-normal text-[#001d35] placeholder:text-gray-400"
                        />
                        {searchTerm && (
                            <button 
                                onClick={() => setSearchTerm('')} 
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                                title="Effacer la recherche"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Filtres par boutons onglets (badge masqué si 0) */}
                    <div className="flex items-center gap-1 bg-gray-100/80 p-1 rounded-[4px] border-2 border-gray-300 flex-wrap">
                        {[
                            { key: 'all', label: 'Toutes les catégories', count: globalStats.totalCats },
                            { key: 'with_stock', label: 'En Stock', count: globalStats.catsWithStock },
                            { key: 'empty', label: 'Vides (0 art.)', count: globalStats.emptyCats }
                        ].map(f => (
                            <button
                                key={f.key}
                                type="button"
                                onClick={() => setStockFilter(f.key)}
                                className={`px-2.5 py-1 text-xs font-semibold rounded-[4px] transition-all cursor-pointer flex items-center gap-1.5 ${
                                    stockFilter === f.key
                                        ? 'bg-[#001d35] text-white shadow-sm'
                                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                                }`}
                            >
                                <span>{f.label}</span>
                                {f.count > 0 && (
                                    <span className={`min-w-4 h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center flex-shrink-0 ${
                                        stockFilter === f.key 
                                            ? 'bg-[#f77500] text-white' 
                                            : 'bg-gray-300 text-gray-700'
                                    }`}>
                                        {f.count}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── TABLEAU OFFICIEL DES CATÉGORIES (DESIGN ET ERGONOMIE HARMONISÉS) ── */}
            <div className="bg-white border-2 border-gray-300 rounded-[4px] shadow-sm overflow-hidden min-h-[350px] flex flex-col justify-start">
                {filteredCategories.length === 0 ? (
                    <div className="p-12 text-center text-gray-500 my-auto">
                        <FolderTree className="w-12 h-12 mx-auto text-gray-400 mb-2 opacity-60" />
                        <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Aucune catégorie trouvée
                        </h3>
                        <p className="text-[11px] text-gray-500 mt-1 max-w-md mx-auto font-normal">
                            {searchTerm 
                                ? `Aucun résultat pour "${searchTerm}". Essayez un autre mot-clé ou réinitialisez les filtres.` 
                                : `Créez votre première catégorie pour organiser vos articles et optimiser le réapprovisionnement.`}
                        </p>
                        <button
                            type="button"
                            onClick={handleOpenCreateModal}
                            className="mt-4 px-3.5 py-2 bg-[#001d35] hover:bg-[#00284a] text-white text-xs font-semibold uppercase tracking-wider rounded-[4px] inline-flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 transition-all"
                        >
                            <Plus className="w-3.5 h-3.5 text-[#f77500]" />
                            <span>Créer une Catégorie</span>
                        </button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-[#001d35] text-white font-semibold uppercase tracking-wider text-[10px] divide-x divide-white/20 sticky top-0">
                                    <th className="py-2.5 px-3 w-56">Catégorie</th>
                                    <th className="py-2.5 px-3">Description & Spécificités</th>
                                    <th className="py-2.5 px-3 w-32 text-center">Articles Référencés</th>
                                    <th className="py-2.5 px-3 w-36 text-right">Stock Disponible</th>
                                    <th className="py-2.5 px-3 w-36 text-right">Prix Moyen</th>
                                    <th className="py-2.5 px-3 w-40 text-right">Valeur Estimée</th>
                                    <th className="py-2.5 px-2 text-center w-28">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredCategories.map((cat, idx) => {
                                    const IconComponent = getCategoryIconComponent(cat.icon);
                                    return (
                                        <tr 
                                            key={cat.id} 
                                            className={`transition-colors border-b border-gray-200 hover:bg-blue-50/50 ${
                                                idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'
                                            }`}
                                        >
                                            {/* Nom & Icône de catégorie */}
                                            <td className="py-2.5 px-3">
                                                <div className="flex items-center gap-2.5">
                                                    <div 
                                                        className="w-7 h-7 rounded-[4px] flex items-center justify-center text-white shrink-0 shadow-xs"
                                                        style={{ backgroundColor: cat.color || '#001d35' }}
                                                    >
                                                        <IconComponent className="w-3.5 h-3.5" />
                                                    </div>
                                                    <div>
                                                        <div className="font-semibold text-gray-900 text-xs leading-tight">
                                                            {cat.name}
                                                        </div>
                                                        <div className="text-[10px] text-gray-400 font-normal">
                                                            ID: {cat.id?.slice(0, 8) || 'auto'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Description */}
                                            <td className="py-2.5 px-3 text-gray-600 font-normal max-w-sm truncate text-[11px]" title={cat.description || ''}>
                                                {cat.description || <span className="text-gray-400 italic">Aucune description</span>}
                                            </td>

                                            {/* Nombre d'articles */}
                                            <td className="py-2.5 px-3 text-center">
                                                <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-[4px] text-xs font-bold ${
                                                    cat.productCount > 0 
                                                        ? 'bg-blue-50 text-[#001d35] border border-blue-200' 
                                                        : 'bg-gray-100 text-gray-400 border border-gray-200'
                                                }`}>
                                                    {cat.productCount} {cat.productCount <= 1 ? 'article' : 'articles'}
                                                </span>
                                            </td>

                                            {/* Stock total disponible */}
                                            <td className="py-2.5 px-3 text-right font-semibold text-gray-800">
                                                {cat.totalStockUnits > 0 ? (
                                                    <span>{cat.totalStockUnits.toLocaleString()} <span className="text-[10px] font-normal text-gray-500">unités</span></span>
                                                ) : (
                                                    <span className="text-rose-600 font-medium text-[11px]">0 unité</span>
                                                )}
                                            </td>

                                            {/* Prix moyen */}
                                            <td className="py-2.5 px-3 text-right font-medium text-gray-700">
                                                {formatPrice(cat.avgPrice)}
                                            </td>

                                            {/* Valeur marchande estimée */}
                                            <td className="py-2.5 px-3 text-right font-bold text-[#f77500]">
                                                {formatPrice(cat.totalStockValue)}
                                            </td>

                                            {/* Actions */}
                                            <td className="py-2.5 px-2 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedCategoryForProducts(cat);
                                                            setProductSearchWithinCategory('');
                                                        }}
                                                        className="p-1.5 text-gray-600 hover:text-[#001d35] hover:bg-gray-100 rounded-[4px] transition-colors cursor-pointer"
                                                        title="Voir les articles"
                                                    >
                                                        <Eye className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenEditModal(cat)}
                                                        className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-[4px] transition-colors cursor-pointer"
                                                        title="Modifier"
                                                    >
                                                        <Edit2 className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteCategory(cat)}
                                                        className="p-1.5 text-gray-600 hover:text-rose-600 hover:bg-rose-50 rounded-[4px] transition-colors cursor-pointer"
                                                        title="Supprimer"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
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
            </div>

            {/* ── MODALE CRÉATION / MODIFICATION HARMONISÉE AVEC RÉAPPROVISIONNEMENT ── */}
            {isFormModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[110] p-4 animate-in fade-in duration-150">
                    <div className="bg-white rounded-[4px] shadow-2xl border-2 border-[#001d35] max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col">
                        {/* Header Modal */}
                        <div className="bg-[#001d35] text-white px-4 py-3 flex items-center justify-between border-b-2 border-[#f77500]">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-[4px] bg-white/10 flex items-center justify-center shrink-0">
                                    <FolderTree className="w-4 h-4 text-[#f77500]" />
                                </div>
                                <div>
                                    <h3 className="text-xs font-semibold uppercase tracking-wider text-white">
                                        {editingCategory ? 'Modifier la Catégorie' : 'Nouvelle Catégorie'}
                                    </h3>
                                    <p className="text-[10px] text-gray-300">Organisation et segmentation du catalogue</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={handleCloseFormModal}
                                className="text-gray-300 hover:text-white p-1 rounded-[4px] transition-colors cursor-pointer"
                                title="Fermer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Formulaire */}
                        <form onSubmit={handleFormSubmit} className="p-4 space-y-3.5 text-xs">
                            <div>
                                <label className="block text-[11px] font-semibold text-[#001d35] uppercase mb-1">
                                    Nom de la catégorie <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ex: Sanitaire & Robinetterie, Câblage..."
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3 py-1.5 border border-gray-300 rounded-[4px] text-xs font-semibold text-[#001d35] focus:outline-none focus:ring-1 focus:ring-[#001d35]"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-semibold text-[#001d35] uppercase mb-1">
                                    Description & Rayon
                                </label>
                                <textarea
                                    rows="2"
                                    placeholder="Types d'articles inclus, rayonnage, spécificités..."
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-3 py-1.5 border border-gray-300 rounded-[4px] text-xs text-[#001d35] focus:outline-none focus:ring-1 focus:ring-[#001d35]"
                                />
                            </div>

                            {/* Choix de l'icône */}
                            <div>
                                <label className="block text-[11px] font-semibold text-[#001d35] uppercase mb-1.5">
                                    Icône représentative
                                </label>
                                <div className="grid grid-cols-7 gap-1.5 max-h-32 overflow-y-auto p-1 bg-slate-50 border border-gray-200 rounded-[4px]">
                                    {AVAILABLE_ICONS.map((iconItem) => {
                                        const IconComp = iconItem.component;
                                        const isSelected = formData.icon === iconItem.name;
                                        return (
                                            <button
                                                key={iconItem.name}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, icon: iconItem.name })}
                                                className={`p-1.5 rounded-[4px] flex flex-col items-center justify-center transition-all cursor-pointer ${
                                                    isSelected 
                                                        ? 'bg-[#001d35] text-white shadow-xs ring-2 ring-[#f77500]' 
                                                        : 'hover:bg-gray-200/70 text-gray-700'
                                                }`}
                                                title={iconItem.label}
                                            >
                                                <IconComp className="w-4 h-4" />
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Choix de la couleur */}
                            <div>
                                <label className="block text-[11px] font-semibold text-[#001d35] uppercase mb-1.5">
                                    Couleur de badge
                                </label>
                                <div className="flex items-center gap-2 flex-wrap">
                                    {AVAILABLE_COLORS.map((colorItem) => {
                                        const isSelected = formData.color === colorItem.value;
                                        return (
                                            <button
                                                key={colorItem.value}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, color: colorItem.value })}
                                                className={`w-6 h-6 rounded-full transition-transform cursor-pointer flex items-center justify-center ${
                                                    isSelected ? 'scale-110 ring-2 ring-offset-2 ring-[#001d35]' : 'hover:scale-105'
                                                }`}
                                                style={{ backgroundColor: colorItem.value }}
                                                title={colorItem.label}
                                            >
                                                {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Aperçu du badge */}
                            <div className="p-2.5 bg-slate-50 rounded-[4px] border border-gray-200 flex items-center justify-between">
                                <span className="text-[11px] text-gray-500 font-medium">Aperçu en liste :</span>
                                <div className="flex items-center gap-2">
                                    <div 
                                        className="w-6 h-6 rounded-[4px] flex items-center justify-center text-white"
                                        style={{ backgroundColor: formData.color }}
                                    >
                                        {React.createElement(getCategoryIconComponent(formData.icon), { className: 'w-3.5 h-3.5' })}
                                    </div>
                                    <span className="font-semibold text-gray-900 text-xs">
                                        {formData.name.trim() || 'Exemple de catégorie'}
                                    </span>
                                </div>
                            </div>

                            {/* Footer Buttons */}
                            <div className="pt-3 border-t border-gray-200 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={handleCloseFormModal}
                                    className="px-3.5 py-1.5 border border-gray-300 rounded-[4px] text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    className="flex items-center gap-1.5 px-4 py-1.5 bg-[#001d35] hover:bg-[#00284a] text-white text-xs font-semibold uppercase tracking-wider rounded-[4px] transition-all shadow-sm cursor-pointer"
                                >
                                    <Check className="w-3.5 h-3.5 text-[#f77500]" />
                                    <span>{editingCategory ? 'Enregistrer' : 'Créer la catégorie'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── MODALE LISTE DES ARTICLES DE LA CATÉGORIE HARMONISÉE ── */}
            {selectedCategoryForProducts && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[110] p-4 animate-in fade-in duration-150">
                    <div className="bg-white rounded-[4px] shadow-2xl border-2 border-[#001d35] max-w-3xl w-full overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
                        {/* Header Modal */}
                        <div className="bg-[#001d35] text-white px-4 py-3 flex items-center justify-between border-b-2 border-[#f77500]">
                            <div className="flex items-center gap-2.5">
                                <div 
                                    className="w-7 h-7 rounded-[4px] flex items-center justify-center text-white shrink-0 shadow-xs"
                                    style={{ backgroundColor: selectedCategoryForProducts.color || '#001d35' }}
                                >
                                    {React.createElement(getCategoryIconComponent(selectedCategoryForProducts.icon), { className: 'w-3.5 h-3.5' })}
                                </div>
                                <div>
                                    <h3 className="text-xs font-semibold uppercase tracking-wider text-white">
                                        Articles associés : {selectedCategoryForProducts.name}
                                    </h3>
                                    <p className="text-[10px] text-gray-300">
                                        {selectedCategoryForProducts.productCount} référence(s) &bull; Stock : {selectedCategoryForProducts.totalStockUnits} unités &bull; Valeur : {formatPrice(selectedCategoryForProducts.totalStockValue)}
                                    </p>
                                </div>
                            </div>
                            <button 
                                type="button"
                                onClick={() => setSelectedCategoryForProducts(null)} 
                                className="text-gray-300 hover:text-white p-1 rounded-[4px] transition-colors cursor-pointer"
                                title="Fermer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Search in Modal */}
                        <div className="p-2.5 bg-slate-50 border-b border-gray-200">
                            <div className="relative">
                                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    placeholder="Filtrer les articles dans cette catégorie..."
                                    value={productSearchWithinCategory}
                                    onChange={(e) => setProductSearchWithinCategory(e.target.value)}
                                    className="w-full pl-8 pr-4 py-1.5 text-xs border border-gray-300 rounded-[4px] bg-white font-normal text-[#001d35] focus:outline-none focus:ring-1 focus:ring-[#001d35]"
                                />
                            </div>
                        </div>

                        {/* Product Table */}
                        <div className="flex-1 overflow-y-auto p-3">
                            {productsInSelectedCategory.length === 0 ? (
                                <div className="text-center py-10 text-gray-400">
                                    <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
                                    <p className="text-xs font-semibold text-gray-600">Aucun article trouvé dans cette catégorie</p>
                                </div>
                            ) : (
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-[#001d35] text-white font-semibold uppercase tracking-wider text-[10px] divide-x divide-white/20 sticky top-0">
                                            <th className="py-2 px-3">Désignation</th>
                                            <th className="py-2 px-3">Fournisseur</th>
                                            <th className="py-2 px-3 text-right">Prix Vente</th>
                                            <th className="py-2 px-3 text-right">Stock</th>
                                            <th className="py-2 px-3 text-center">État Stock</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {productsInSelectedCategory.map((p, pIdx) => {
                                            const stockQty = p.stockLevels?.[currentStoreId] ?? p.stock ?? 0;
                                            const isLow = stockQty <= (p.minStock || 0);
                                            return (
                                                <tr 
                                                    key={p.id} 
                                                    className={`hover:bg-blue-50/40 border-b border-gray-200 ${
                                                        pIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'
                                                    }`}
                                                >
                                                    <td className="py-2 px-3 font-semibold text-[#001d35]">{p.name}</td>
                                                    <td className="py-2 px-3 text-gray-500 font-normal">{p.supplier || '—'}</td>
                                                    <td className="py-2 px-3 text-right font-semibold text-[#001d35]">{formatPrice(p.price)}</td>
                                                    <td className="py-2 px-3 text-right font-semibold">{stockQty} {p.unit || ''}</td>
                                                    <td className="py-2 px-3 text-center">
                                                        {isLow ? (
                                                            <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-[4px] text-[10px] font-semibold">
                                                                Critique (min {p.minStock || 0})
                                                            </span>
                                                        ) : (
                                                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-[4px] text-[10px] font-semibold">
                                                                Optimal
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-3 bg-gray-50 border-t border-gray-200 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setSelectedCategoryForProducts(null)}
                                className="px-4 py-1.5 bg-[#001d35] hover:bg-[#00284a] text-white text-xs font-semibold uppercase tracking-wider rounded-[4px] cursor-pointer shadow-sm"
                            >
                                Fermer
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── OVERLAY LOADER D'ACTION MÉTIER (1,5s au minimum pour chaque action) ── */}
            {actionLoading && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[200] p-4 animate-in fade-in duration-150">
                    <div className="bg-white rounded-[4px] p-6 shadow-2xl border-2 border-[#001d35] flex flex-col items-center max-w-sm text-center">
                        <div className="relative h-12 w-12 mb-3">
                            <div className="absolute inset-0 animate-spin rounded-full border-4 border-gray-200 border-t-[#001d35]"></div>
                            <div className="absolute inset-2 animate-spin-reverse rounded-full border-2 border-transparent border-b-[#f77500]"></div>
                        </div>
                        <h4 className="text-sm font-semibold text-[#001d35] uppercase tracking-wider">
                            Traitement en cours...
                        </h4>
                        <p className="text-xs text-gray-600 mt-1 font-medium">
                            {actionLoading}
                        </p>
                    </div>
                </div>
            )}

            {/* ── OVERLAY LOADER D'ENTRÉE DE PAGE (1,5s au montage + scroll top) ── */}
            {isPageLoading && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[300] p-4 animate-in fade-in duration-150">
                    <div className="bg-white rounded-[4px] p-6 shadow-2xl border-2 border-[#001d35] flex flex-col items-center max-w-sm text-center">
                        <div className="relative h-12 w-12 mb-3">
                            <div className="absolute inset-0 animate-spin rounded-full border-4 border-gray-200 border-t-[#001d35]"></div>
                            <div className="absolute inset-2 animate-spin-reverse rounded-full border-2 border-transparent border-b-[#f77500]"></div>
                        </div>
                        <h4 className="text-sm font-semibold text-[#001d35] uppercase tracking-wider">
                            Chargement en cours...
                        </h4>
                        <p className="text-xs text-gray-600 mt-1 font-medium">
                            Gestion des Catégories
                        </p>
                    </div>
                </div>
            )}

        </div>
    );
};

export default Categories;
