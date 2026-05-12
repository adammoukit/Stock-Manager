import React, { useState, useEffect } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { useSettings } from '../../context/SettingsContext';
import toast from 'react-hot-toast';
import { ChevronDown } from 'lucide-react';
import { formatPrice } from '../../utils/currency';
import { getUnitModel } from '../../config/unitModels';
import ProductModal from '../../components/ProductModal';
import StockEntryModal from '../../components/StockEntryModal';
import StockHistoryModal from '../../components/StockHistoryModal';
import { useSearchParams } from 'react-router-dom';

const ResizableHeader = ({ columnId, width, onResize, children, className, onClick }) => {
    const [isResizing, setIsResizing] = useState(false);

    const handleMouseDown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsResizing(true);
        const startX = e.clientX;
        const startWidth = width;

        const handleMouseMove = (moveEvent) => {
            const newWidth = Math.max(50, startWidth + (moveEvent.clientX - startX));
            onResize(columnId, newWidth);
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    return (
        <th
            style={{ width: `${width}px`, minWidth: `${width}px` }}
            className={`px-1 py-1.5 relative group border-r-2 border-[#e6e6e6]/40 hover:bg-white/10 transition-colors select-none ${onClick ? 'cursor-pointer' : ''} ${className || ''}`}
            onClick={onClick}
        >
            <div className="flex items-center overflow-hidden whitespace-nowrap h-full">
                {children}
            </div>
            <div
                className={`absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-20 hover:bg-[#e6e6e6] ${isResizing ? 'bg-[#e6e6e6]' : 'bg-transparent'}`}
                onMouseDown={handleMouseDown}
                onClick={(e) => e.stopPropagation()}
            ></div>
        </th>
    );
};

const ProductList = () => {
    const { products, refreshProducts, addProduct, updateProduct, deleteProduct, addSupply, getProductMovements, deconditionModels } = useInventory();
    const { currentStoreId, company } = useSettings();
    const [searchParams] = useSearchParams();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('All');
    const [showLowStockOnly, setShowLowStockOnly] = useState(false);
    const [selectedProductIds, setSelectedProductIds] = useState([]);
    const [showActionsMenu, setShowActionsMenu] = useState(false);

    // Modal states
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

    const [selectedProduct, setSelectedProduct] = useState(null);

    // Bulk operation modal state
    const [bulkModal, setBulkModal] = useState(null); // null | 'supplier' | 'category' | 'minStock'
    const [bulkValue, setBulkValue] = useState('');

    const [colWidths, setColWidths] = useState({
        checkbox: 40,
        name: 360,
        category: 90,
        purchasePrice: 130,
        price: 160,
        stock: 140,
        supplier: 150,
        actions: 60
    });

    const handleResize = (columnId, newWidth) => {
        setColWidths(prev => ({
            ...prev,
            [columnId]: newWidth
        }));
    };

    useEffect(() => {
        const filterParam = searchParams.get('filter');
        if (filterParam === 'low_stock') {
            setShowLowStockOnly(true);
        }
    }, [searchParams]);

    // Rafraîchissement automatique à l'ouverture du catalogue
    useEffect(() => {
        refreshProducts();
    }, []);

    const handleAddClick = () => {
        setSelectedProduct(null);
        setIsProductModalOpen(true);
    };

    const handleEditClick = (product) => {
        setSelectedProduct(product);
        setIsProductModalOpen(true);
    };

    const handleEntryClick = (product) => {
        setSelectedProduct(product);
        setIsEntryModalOpen(true);
    };

    const handleHistoryClick = (product) => {
        setSelectedProduct(product);
        setIsHistoryModalOpen(true);
    };

    // ── Bulk Operations ──────────────────────────────────────────────
    const handleBulkDelete = () => {
        if (!window.confirm(`Supprimer ${selectedProductIds.length} produit(s) ? Cette action est irréversible.`)) return;
        selectedProductIds.forEach(id => deleteProduct(id));
        toast.success(`${selectedProductIds.length} produit(s) supprimé(s)`);
        setSelectedProductIds([]);
    };

    const handleBulkExport = () => {
        const selected = products.filter(p => selectedProductIds.includes(p.id));
        const headers = ['Nom', 'Catégorie', 'Prix de vente', 'Prix d\'achat', 'Stock', 'Fournisseur', 'Unité'];
        const rows = selected.map(p => [
            p.name,
            p.category,
            p.price,
            p.purchasePrice || '',
            p.stockLevels?.[currentStoreId] || 0,
            p.supplier || '',
            p.unit || ''
        ]);
        const csvContent = [headers, ...rows].map(r => r.join(';')).join('\n');
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `export_produits_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click(); URL.revokeObjectURL(url);
        toast.success(`${selected.length} produit(s) exporté(s) en CSV`);
    };

    const handlePrintLabels = () => {
        const selected = products.filter(p => selectedProductIds.includes(p.id));
        const win = window.open('', '_blank');

        // Génère toutes les étiquettes pour un produit selon ses niveaux de prix actifs
        const buildLabels = (p) => {
            const labels = [];
            const cf = parseFloat(p.conversionFactor) || 1;
            const isContainer = (p.unitArchetype === 'BOX' || p.unitArchetype === 'BULK') && cf > 1;

            // 1. Prix unitaire de base (toujours présent)
            labels.push({
                tier: 'DÉTAIL',
                price: p.price,
                unit: p.unit || 'Unité',
                accent: '#1c398e'
            });

            // 2. Prix au lot (si activé)
            if (p.hasLot && p.lotPrice) {
                labels.push({
                    tier: `LOT DE ${p.retailStepQuantity || 10}`,
                    price: p.lotPrice,
                    unit: `Lot de ${p.retailStepQuantity || 10} ${p.unit || ''}`,
                    accent: '#d97706'
                });
            }

            // 3. Prix en gros / à la boîte ou au sac (si produit conteneur)
            if (isContainer && p.bulkPrice) {
                labels.push({
                    tier: 'GROS',
                    price: p.bulkPrice,
                    unit: p.unit || 'Carton',
                    accent: '#7c3aed'
                });
            }

            // 4. Conditionnements personnalisés (packagings)
            if (p.packagings?.length > 0) {
                p.packagings.forEach(pkg => {
                    if (pkg.price) {
                        const model = deconditionModels.find(m => m.id === pkg.modelId);
                        labels.push({
                            tier: (model?.name || 'COND.').toUpperCase(),
                            price: pkg.price,
                            unit: model?.name || pkg.modelId,
                            accent: '#059669'
                        });
                    }
                });
            }

            return labels.map(lbl => `
                <div style="display:inline-block;border:2px solid ${lbl.accent}22;padding:10px 14px;margin:6px;border-radius:4px;font-family:'Courier New',monospace;min-width:150px;vertical-align:top;position:relative;">
                    <div style="position:absolute;top:-1px;left:10px;background:${lbl.accent};color:#fff;font-size:9px;font-weight:900;letter-spacing:1.5px;padding:1px 6px;border-radius:0 0 4px 4px;">${lbl.tier}</div>
                    <div style="font-size:9px;color:#888;text-transform:uppercase;margin-top:10px;letter-spacing:0.5px;">${p.category || ''}</div>
                    <div style="font-weight:bold;font-size:12px;margin:4px 0;color:#111;">${p.name}</div>
                    <div style="font-size:20px;font-weight:900;color:${lbl.accent};">${Number(lbl.price).toLocaleString('fr-FR')} <span style="font-size:11px;">FCFA</span></div>
                    <div style="font-size:10px;color:#999;margin-top:2px;">/ ${lbl.unit}</div>
                </div>
            `).join('');
        };

        const allLabels = selected.map(p => `
            <div style="margin-bottom:12px;">
                <div style="font-size:10px;font-weight:bold;color:#333;margin-bottom:4px;padding-left:6px;border-left:3px solid #1c398e;">${p.name}</div>
                ${buildLabels(p)}
            </div>
        `).join('<hr style="border:none;border-top:1px dashed #ddd;margin:12px 0;">');

        win.document.write(`
            <html>
            <head>
                <title>Étiquettes — ${selected.length} produit(s)</title>
                <style>
                    body { padding: 20px; background: #fff; }
                    @media print {
                        body { padding: 8px; }
                        hr { display: none; }
                    }
                </style>
            </head>
            <body>${allLabels}</body>
            </html>
        `);
        win.document.close();
        setTimeout(() => win.print(), 300);
    };

    const handlePrintPDF = () => {
        const selected = products.filter(p => selectedProductIds.includes(p.id));
        const win = window.open('', '_blank');

        const title = showLowStockOnly
            ? 'LISTE DES PRODUITS EN RUPTURE DE STOCK'
            : 'CATALOGUE DES PRODUITS';

        const rows = selected.map(p => {
            const cf = parseFloat(p.conversionFactor) || 1;
            const isContainer = (p.unitArchetype === 'BOX' || p.unitArchetype === 'BULK') && cf > 1;
            const stockQty = p.stockLevels?.[currentStoreId] || 0;
            const subUnit = getUnitModel(p.unit).subUnit;

            const wholeUnits = Math.floor(stockQty);
            const fractionalPart = stockQty - wholeUnits;

            let stockDisplay = `${stockQty.toLocaleString()} ${p.unit || 'Pièce'}`;
            if (isContainer && fractionalPart > 0) {
                const subUnitsCount = Math.round(fractionalPart * cf);
                const mainPart = wholeUnits > 0 ? `${wholeUnits.toLocaleString()} ${p.unit} + ` : '';
                stockDisplay = `${mainPart}${subUnitsCount.toLocaleString()} ${subUnit || 'unités'}`;
            }

            let priceDisplay = `${formatPrice(p.price)} <span style="font-size:10px;font-weight:normal;color:#64748b;">/ ${p.unit || 'Unité'}</span>`;
            if (p.hasLot && p.lotPrice) {
                priceDisplay += `<div style="font-size:10px;margin-top:4px;color:#1c398e;">${formatPrice(p.lotPrice)} / Lot de ${p.retailStepQuantity || 10}</div>`;
            }
            if (p.packagings && p.packagings.length > 0) {
                priceDisplay += p.packagings.map(pkg =>
                    `<div style="font-size:10px;margin-top:4px;color:#1c398e;">${formatPrice(pkg.price)} / ${pkg.name}</div>`
                ).join('');
            }

            return `
                <tr>
                    <td style="padding: 10px; color: #1e293b; font-weight: 600;">${p.name}</td>
                    <td style="padding: 10px; color: #64748b;">${p.category}</td>
                    <td style="padding: 10px; color: #0f172a; font-weight: bold;">
                        ${stockDisplay}
                    </td>
                    <td style="padding: 10px; color: #64748b; text-align: right;">
                        ${formatPrice(p.purchasePrice || 0)}
                    </td>
                    <td style="padding: 10px; color: #0f172a; font-weight: bold; text-align: right;">
                        ${priceDisplay}
                    </td>
                    <td style="padding: 10px; color: #64748b;">${p.supplier || '-'}</td>
                </tr>
            `;
        }).join('');

        win.document.write(`
            <html>
            <head>
                <title>${title}</title>
                <style>
                    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; margin: 0; background: #fff; }
                    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 3px solid #1c398e; padding-bottom: 20px; }
                    .header-left { display: flex; align-items: center; gap: 15px; }
                    .logo-placeholder { width: 60px; height: 60px; background: #1c398e; color: white; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold; border-radius: 8px; }
                    .company-logo { max-width: 80px; max-height: 80px; object-fit: contain; }
                    .company-name { font-size: 22px; font-weight: 800; color: #0f172a; margin: 0; }
                    .company-nif { font-size: 12px; color: #64748b; margin-top: 4px; font-weight: 500; }
                    .header-right { text-align: right; font-size: 12px; color: #475569; line-height: 1.6; font-weight: 500; }
                    .title { text-align: center; font-size: 18px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 30px; }
                    .title span { border-bottom: 3px solid #1c398e; padding-bottom: 4px; }
                    table { width: 100%; border-collapse: collapse; font-size: 12px; border: 1px solid #cbd5e1; }
                    th, td { border: 1px solid #cbd5e1; }
                    th { background: #f8fafc; padding: 12px 10px; text-align: left; font-size: 11px; text-transform: uppercase; color: #64748b; border-bottom: 2px solid #94a3b8; font-weight: 700; letter-spacing: 0.5px; }
                    .footer { margin-top: 50px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 20px; font-weight: 500; }
                    @media print {
                        body { padding: 0; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="header-left">
                        ${company?.logo
                ? `<img src="${company.logo}" alt="Logo" class="company-logo" />`
                : `<div class="logo-placeholder">${company?.name?.charAt(0) || 'Q'}</div>`
            }
                        <div>
                            <h1 class="company-name">${company?.name || 'Entreprise'}</h1>
                            <div class="company-nif">NIF: ${company?.nif || 'Non renseigné'}</div>
                        </div>
                    </div>
                    <div class="header-right">
                        <div>${company?.address || ''}</div>
                        <div>${company?.email || ''}</div>
                        <div>${company?.phone || ''}</div>
                        <div style="margin-top: 8px; font-weight: bold; color: #1c398e;">
                            Imprimé le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}
                        </div>
                    </div>
                </div>

                <div class="title">
                    <span>${title}</span>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Désignation</th>
                            <th>Catégorie</th>
                            <th>Stock</th>
                            <th style="text-align: right;">Prix Achat</th>
                            <th style="text-align: right;">Prix Vente</th>
                            <th>Fournisseur</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>

                <div class="footer">
                    Généré par Quincaillerie Management System • ${selected.length} produit(s) listé(s)
                </div>
            </body>
            </html>
        `);
        win.document.close();
        setTimeout(() => win.print(), 500);
    };

    const handleBulkApply = () => {
        if (!bulkValue.trim()) { toast.error('Veuillez saisir une valeur'); return; }
        selectedProductIds.forEach(id => {
            const update = bulkModal === 'supplier' ? { supplier: bulkValue }
                : bulkModal === 'category' ? { category: bulkValue }
                    : { minStock: parseFloat(bulkValue) || 0 };
            updateProduct(id, update);
        });
        const labels = { supplier: 'fournisseur', category: 'catégorie', minStock: 'stock minimum' };
        toast.success(`${labels[bulkModal]} mis à jour pour ${selectedProductIds.length} produit(s)`);
        setBulkModal(null); setBulkValue(''); setSelectedProductIds([]);
    };

    const handleSaveProduct = (productData) => {
        if (selectedProduct) {
            // Passer le storeId pour que la mise à jour du stock soit isolée à la boutique active
            updateProduct(selectedProduct.id, productData, currentStoreId);
            toast.success(`Produit modifié avec succès`);
        } else {
            addProduct(productData);
            toast.success(`${productData.name} ajouté à l'inventaire`);
        }
        setIsProductModalOpen(false);
    };

    const handleSaveSupply = (productId, supplyData) => {
        addSupply(productId, supplyData);
        setIsEntryModalOpen(false);
    };

    const filteredProducts = products.filter(product => {
        const matchesSearch = product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            product.category.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesCategory = filterCategory === 'All' || product.category === filterCategory;
        const matchesLowStock = !showLowStockOnly || (product.stockLevels?.[currentStoreId] || 0) <= (product.minStockLevels?.[currentStoreId] || product.minStock || 0);

        return matchesSearch && matchesCategory && matchesLowStock;
    });

    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedProducts = [...filteredProducts].sort((a, b) => {
        if (!sortConfig.key) return 0;

        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        if (sortConfig.key === 'stock') {
            aValue = a.stockLevels?.[currentStoreId] || 0;
            bValue = b.stockLevels?.[currentStoreId] || 0;
        }

        // Handle string comparison case-insensitively
        if (typeof aValue === 'string') {
            aValue = aValue.toLowerCase();
            bValue = bValue?.toLowerCase();
        }

        if (aValue < bValue) {
            return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
            return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
    });

    const categories = ['All', ...new Set(products.map(p => p.category))];

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedProductIds(sortedProducts.map(p => p.id));
        } else {
            setSelectedProductIds([]);
        }
    };

    const handleSelectProduct = (id) => {
        setSelectedProductIds(prev => {
            if (prev.includes(id)) {
                return prev.filter(pId => pId !== id);
            } else {
                return [...prev, id];
            }
        });
    };

    const totalProducts = products.length;
    const lowStockCount = products.filter(p => (p.stockLevels?.[currentStoreId] || 0) <= (p.minStockLevels?.[currentStoreId] || p.minStock || 0)).length;
    const totalStockValue = products.reduce((sum, p) => sum + ((p.stockLevels?.[currentStoreId] || 0) * (p.purchasePrice || 0)), 0);
    const selectedCount = selectedProductIds.length;

    return (
        <div className="p-6 h-full flex flex-col gap-6 overflow-y-auto custom-scrollbar bg-[#f0f4f8]">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-[#1c398e] tracking-tight">Catalogue Produits</h2>
                    <p className="text-gray-500 text-sm mt-1 font-medium">Gestion et inventaire du stock de la quincaillerie</p>
                </div>
            </div>

            <div className="space-y-6">
            {/* Top Insight Bar: Statistiques de Classe Mondiale */}
            {/* Top Insight Bar: Texture Dashboard de Classe Mondiale */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Total Catalogue */}
                <div className="bg-white p-4 rounded-sm border-2 border-gray-300 shadow-sm relative group hover:shadow-md transition-shadow overflow-hidden">
                    <div className="relative z-10">
                        <p className="text-[11px] font-bold text-blue-600/70 uppercase tracking-widest mb-1">Total Catalogue</p>
                        <h3 className="text-xl sm:text-2xl font-semibold text-[#1c398e]">{totalProducts}</h3>
                        <p className="text-xs text-gray-400 mt-2 font-medium">Produits référencés</p>
                    </div>
                    <img
                        src="/icons8/fluency_240_product.png"
                        alt=""
                        className="absolute bottom-2 right-2 w-16 h-16 opacity-90 group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-700 pointer-events-none"
                    />
                </div>

                {/* Alertes Stock */}
                <div className="bg-white p-4 rounded-sm border-2 border-gray-300 shadow-sm relative group hover:shadow-md transition-shadow overflow-hidden">
                    <div className="relative z-10">
                        <p className="text-[11px] font-bold text-blue-600/70 uppercase tracking-widest mb-1">Alertes Stock</p>
                        <h3 className={`text-xl sm:text-2xl font-semibold ${lowStockCount > 0 ? 'text-red-600' : 'text-[#1c398e]'}`}>
                            {lowStockCount}
                        </h3>
                        <p className="text-xs text-gray-400 mt-2 font-medium">Articles en rupture</p>
                    </div>
                    <img
                        src="/icons8/fluency_240_high-priority.png"
                        alt=""
                        className="absolute bottom-2 right-2 w-16 h-16 opacity-90 group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-700 pointer-events-none"
                    />
                </div>

                {/* Valeur Stock */}
                <div className="bg-white p-4 rounded-sm border-2 border-gray-300 shadow-sm relative group hover:shadow-md transition-shadow overflow-hidden">
                    <div className="relative z-10">
                        <p className="text-[11px] font-bold text-blue-600/70 uppercase tracking-widest mb-1">Valeur Stock</p>
                        <h3 className="text-xl sm:text-2xl font-semibold text-[#1c398e]">{formatPrice(totalStockValue)}</h3>
                        <p className="text-xs text-gray-400 mt-2 font-medium">Prix d'achat total</p>
                    </div>
                    <img
                        src="/icons8/fluency_240_stack-of-money.png"
                        alt=""
                        className="absolute bottom-2 right-2 w-16 h-16 opacity-90 group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-700 pointer-events-none"
                    />
                </div>
            </div>

            {/* Main Command Center Toolbar */}
            <div className="bg-white border-2 border-gray-300 rounded-sm shadow-sm overflow-hidden">
                {/* Upper Toolbar: Search & Main Actions */}
                <div className="p-4 border-b-2 border-gray-100 flex flex-col lg:flex-row lg:items-center gap-4 bg-white">
                    <div className="flex-1 relative group">
                        <i className="uil uil-search text-xl absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#1c398e] transition-colors"></i>
                        <input
                            type="text"
                            placeholder="Rechercher un produit, une catégorie ou biper un code-barres..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-11 pr-16 py-3 border-2 border-gray-200 rounded-sm focus:outline-none focus:border-[#1c398e] focus:ring-4 focus:ring-[#1c398e]/5 bg-white transition-all text-sm font-bold text-gray-800 placeholder:text-gray-400 placeholder:font-medium"
                        />
                        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2">
                            {searchTerm && (
                                <button onClick={() => setSearchTerm('')} className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-red-500 transition-all">
                                    <i className="uil uil-multiply"></i>
                                </button>
                            )}
                            <div className="h-6 w-px bg-gray-200 mx-1"></div>
                            <kbd className="hidden sm:flex h-6 items-center gap-1 rounded-sm border border-gray-200 bg-gray-50 px-1.5 font-mono text-[10px] font-black text-gray-400">
                                <span className="text-xs">⌘</span>K
                            </kbd>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handlePrintPDF}
                            className="flex items-center justify-center gap-2 bg-white border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-3 rounded-sm font-black text-xs uppercase tracking-wider transition-all active:scale-95"
                        >
                            <i className="uil uil-print text-lg"></i>
                            PDF
                        </button>
                        <button
                            className="flex items-center justify-center gap-2 bg-white border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-3 rounded-sm font-black text-xs uppercase tracking-wider transition-all active:scale-95"
                        >
                            <i className="uil uil-download-alt text-lg"></i>
                            CSV
                        </button>
                        <div className="w-px h-8 bg-gray-200 mx-1"></div>
                        <button
                            onClick={handleAddClick}
                            className="flex items-center justify-center gap-2 bg-[#f77500] hover:bg-[#e66a00] text-white px-6 py-3 rounded-sm font-black text-xs uppercase tracking-wider shadow-md transition-all active:scale-95"
                        >
                            <i className="uil uil-plus text-lg"></i>
                            Nouveau Produit
                        </button>
                    </div>
                </div>

                {/* Lower Toolbar: Filters & Quick Settings */}
                <div className="px-4 py-3 border-b-2 border-gray-300 flex flex-wrap items-center justify-between gap-4" style={{ backgroundColor: '#e6ecf2' }}>
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Filtre Catégorie */}
                        <div className="flex items-center gap-2 bg-white px-3 py-1.5 border-2 border-gray-300 rounded-sm">
                            <i className="uil uil-tag-alt text-[#1c398e] text-lg"></i>
                            <select
                                value={filterCategory}
                                onChange={(e) => setFilterCategory(e.target.value)}
                                className="bg-transparent text-[11px] font-black outline-none cursor-pointer text-gray-700 min-w-[140px] uppercase tracking-wide"
                            >
                                {categories.map(cat => (
                                    <option key={cat} value={cat}>{cat === 'All' ? 'Toutes catégories' : cat}</option>
                                ))}
                            </select>
                        </div>

                        {/* Toggle Stock Faible */}
                        <button
                            onClick={() => setShowLowStockOnly(!showLowStockOnly)}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-sm border-2 font-black text-[11px] uppercase tracking-wide transition-all ${showLowStockOnly
                                    ? 'bg-red-600 border-red-600 text-white shadow-sm'
                                    : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                                }`}
                        >
                            <i className={`uil uil-exclamation-triangle text-lg ${showLowStockOnly ? 'text-white' : 'text-red-500'}`}></i>
                            Stock Faible
                        </button>

                        <div className="h-6 w-px bg-gray-300 mx-1"></div>

                        {/* Résultats rapides */}
                        <span className="text-[11px] font-black text-gray-500 uppercase tracking-widest">
                            {filteredProducts.length} Résultat{filteredProducts.length > 1 ? 's' : ''}
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Bulk Actions Menu (si sélection) */}
                        {selectedCount > 0 && (
                            <div className="flex items-center gap-2 animate-in slide-in-from-right-2 duration-300">
                                <span className="text-[11px] font-black text-[#1c398e] uppercase tracking-widest mr-2 bg-[#1c398e]/10 px-2 py-1 rounded-sm border border-[#1c398e]/20">
                                    {selectedCount} Sélectionnés
                                </span>
                                <button
                                    onClick={handlePrintLabels}
                                    className="p-2 bg-white border-2 border-gray-300 hover:border-amber-500 text-amber-600 rounded-sm transition-all"
                                    title="Imprimer étiquettes"
                                >
                                    <i className="uil uil-tag-alt text-lg"></i>
                                </button>
                                <button
                                    onClick={handleBulkDelete}
                                    className="p-2 bg-white border-2 border-gray-300 hover:border-red-500 text-red-600 rounded-sm transition-all"
                                    title="Supprimer la sélection"
                                >
                                    <i className="uil uil-trash-alt text-lg"></i>
                                </button>
                                <button
                                    onClick={() => setSelectedProductIds([])}
                                    className="p-2 bg-white border-2 border-gray-300 hover:bg-gray-100 text-gray-400 rounded-sm transition-all"
                                    title="Annuler la sélection"
                                >
                                    <i className="uil uil-multiply text-lg"></i>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Product Table Container */}
            <div className="bg-white rounded-sm border-2 border-gray-300 shadow-sm overflow-hidden flex flex-col h-[600px]">
                <div className="overflow-y-auto flex-1">
                    <table className="w-full text-left text-sm relative">
                        <thead style={{ backgroundColor: '#365ac9' }} className="text-white font-bold sticky top-0 z-10 shadow-sm uppercase tracking-wider text-[11px]">
                            <tr className="divide-x-2 divide-[#224099]/40">
                                <th style={{ width: `${colWidths.checkbox}px`, minWidth: `${colWidths.checkbox}px` }} className="px-1 py-1.5 border-r-2 border-[#e6e6e6]/40 text-center">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 rounded-sm border-white/20 accent-[#1c398e] cursor-pointer"
                                        checked={sortedProducts.length > 0 && selectedProductIds.length === sortedProducts.length}
                                        onChange={handleSelectAll}
                                    />
                                </th>
                                <ResizableHeader columnId="name" width={colWidths.name} onResize={handleResize} onClick={() => handleSort('name')}>
                                    <div className="flex items-center gap-2">
                                        <div className="flex flex-col items-center leading-none">
                                            <i className={`uil uil-arrow-up text-[10px] ${sortConfig.key === 'name' && sortConfig.direction === 'asc' ? 'text-white' : 'text-white/30'}`}></i>
                                            <i className={`uil uil-arrow-down text-[10px] ${sortConfig.key === 'name' && sortConfig.direction === 'desc' ? 'text-white' : 'text-white/30'}`}></i>
                                        </div>
                                        Produit
                                    </div>
                                </ResizableHeader>
                                <ResizableHeader columnId="category" width={colWidths.category} onResize={handleResize} onClick={() => handleSort('category')}>
                                    <div className="flex items-center gap-2">
                                        <div className="flex flex-col items-center leading-none">
                                            <i className={`uil uil-arrow-up text-[10px] ${sortConfig.key === 'category' && sortConfig.direction === 'asc' ? 'text-white' : 'text-white/30'}`}></i>
                                            <i className={`uil uil-arrow-down text-[10px] ${sortConfig.key === 'category' && sortConfig.direction === 'desc' ? 'text-white' : 'text-white/30'}`}></i>
                                        </div>
                                        Catégorie
                                    </div>
                                </ResizableHeader>
                                <ResizableHeader columnId="purchasePrice" width={colWidths.purchasePrice} onResize={handleResize} onClick={() => handleSort('purchasePrice')}>
                                    <div className="flex items-center justify-center gap-2 w-full">
                                        <div className="flex flex-col items-center leading-none">
                                            <i className={`uil uil-arrow-up text-[10px] ${sortConfig.key === 'purchasePrice' && sortConfig.direction === 'asc' ? 'text-white' : 'text-white/30'}`}></i>
                                            <i className={`uil uil-arrow-down text-[10px] ${sortConfig.key === 'purchasePrice' && sortConfig.direction === 'desc' ? 'text-white' : 'text-white/30'}`}></i>
                                        </div>
                                        Prix Achat
                                    </div>
                                </ResizableHeader>
                                <ResizableHeader columnId="price" width={colWidths.price} onResize={handleResize} onClick={() => handleSort('price')}>
                                    <div className="flex items-center justify-center gap-2 w-full">
                                        <div className="flex flex-col items-center leading-none">
                                            <i className={`uil uil-arrow-up text-[10px] ${sortConfig.key === 'price' && sortConfig.direction === 'asc' ? 'text-white' : 'text-white/30'}`}></i>
                                            <i className={`uil uil-arrow-down text-[10px] ${sortConfig.key === 'price' && sortConfig.direction === 'desc' ? 'text-white' : 'text-white/30'}`}></i>
                                        </div>
                                        Prix de Vente
                                    </div>
                                </ResizableHeader>
                                <ResizableHeader columnId="stock" width={colWidths.stock} onResize={handleResize} onClick={() => handleSort('stock')}>
                                    <div className="flex items-center gap-2">
                                        <div className="flex flex-col items-center leading-none">
                                            <i className={`uil uil-arrow-up text-[10px] ${sortConfig.key === 'stock' && sortConfig.direction === 'asc' ? 'text-white' : 'text-white/30'}`}></i>
                                            <i className={`uil uil-arrow-down text-[10px] ${sortConfig.key === 'stock' && sortConfig.direction === 'desc' ? 'text-white' : 'text-white/30'}`}></i>
                                        </div>
                                        Stock
                                    </div>
                                </ResizableHeader>
                                <ResizableHeader columnId="supplier" width={colWidths.supplier} onResize={handleResize} onClick={() => handleSort('supplier')}>
                                    <div className="flex items-center gap-2">
                                        <div className="flex flex-col items-center leading-none">
                                            <i className={`uil uil-arrow-up text-[10px] ${sortConfig.key === 'supplier' && sortConfig.direction === 'asc' ? 'text-white' : 'text-white/30'}`}></i>
                                            <i className={`uil uil-arrow-down text-[10px] ${sortConfig.key === 'supplier' && sortConfig.direction === 'desc' ? 'text-white' : 'text-white/30'}`}></i>
                                        </div>
                                        Fournisseur
                                    </div>
                                </ResizableHeader>
                                <th style={{ width: `${colWidths.actions}px`, minWidth: `${colWidths.actions}px` }} className="px-1 py-1.5 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y-2 divide-[#e6e6e6]">
                            {sortedProducts.map((product) => (
                                <tr key={product.id} className={`divide-x-2 divide-[#e6e6e6] transition-colors ${selectedProductIds.includes(product.id) ? 'bg-blue-50' : 'odd:bg-[#f3f3f3] even:bg-[#ffffff] hover:bg-blue-50/40'}`}>
                                    <td className="px-1 py-4 truncate text-center">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 rounded-sm border-gray-300 accent-[#1c398e] cursor-pointer"
                                            checked={selectedProductIds.includes(product.id)}
                                            onChange={() => handleSelectProduct(product.id)}
                                        />
                                    </td>
                                    <td className="px-1 py-1.5 font-semibold text-[#1c398e] truncate text-[14px] tracking-wide">{product.name?.toUpperCase()}</td>
                                    <td className="px-1 py-1.5 text-[#1c398e] truncate text-[13px] font-semibold">
                                        <span className="bg-[#1c398e]/10 px-2 py-1 rounded-sm text-xs border border-[#1c398e]/20">
                                            {product.category}
                                        </span>
                                    </td>
                                    <td className="px-1 py-1.5 font-semibold text-[#1c398e] text-[14px] truncate text-center">
                                        {product.purchasePrice ? formatPrice(product.purchasePrice) : <span className="text-gray-300 italic text-xs">—</span>}
                                    </td>
                                    <td className="px-1 py-1.5 truncate text-center">
                                        <div className="flex flex-col items-center">
                                            <div className="font-semibold text-[#1c398e] text-[14px]">
                                                {formatPrice(product.price)} <span className="text-gray-400 text-xs font-normal">/ {product.unit || 'Unité'}</span>
                                            </div>
                                            {product.hasLot && product.lotPrice && (
                                                <div style={{ color: '#1c398e' }} className="text-[11px] font-semibold mt-1.5 flex items-center gap-1.5 bg-blue-50/50 w-fit px-2 py-0.5 rounded-sm border border-[#1c398e]/20">
                                                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#1c398e' }}></div>
                                                    {formatPrice(product.lotPrice)} / Lot de {product.retailStepQuantity || 10}
                                                </div>
                                            )}
                                            {/* Modèles de vente fractionnée */}
                                            {product.packagings?.map(pkg => {
                                                return (
                                                    <div key={pkg.modelId} style={{ color: '#1c398e' }} className="text-[10px] font-bold mt-1.5 flex items-center gap-1.5 uppercase bg-blue-50 w-fit px-2 py-0.5 rounded-sm">
                                                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#1c398e' }}></div>
                                                        {formatPrice(pkg.price)} / {pkg.name}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </td>
                                    <td className="px-1 py-4">
                                        {(() => {
                                            const cf = parseFloat(product.conversionFactor) || 1;
                                            const isContainer = (product.unitArchetype === 'BOX' || product.unitArchetype === 'BULK') && cf > 1;
                                            const stockQty = product.stockLevels?.[currentStoreId] || 0;
                                            const subUnit = getUnitModel(product.unit).subUnit;
                                            const isLow = stockQty <= (product.minStockLevels?.[currentStoreId] || product.minStock || 0);

                                            return (
                                                <div className="flex flex-col items-center gap-1">
                                                    {/* PRIMARY: Base units (e.g., 7 Boîtes, 20 Sacs, or 5 Pièces) */}
                                                    <div className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-sm font-bold text-sm ${isLow ? 'text-red-600 bg-red-50' : 'bg-green-50 text-green-700'}`}>
                                                        {isLow && <i className="uil uil-exclamation-triangle text-lg"></i>}
                                                        <span>
                                                            {(() => {
                                                                const wholeUnits = Math.floor(stockQty);
                                                                const fractionalPart = stockQty - wholeUnits;

                                                                if (isContainer && fractionalPart > 0) {
                                                                    const subUnitsCount = Math.round(fractionalPart * cf);
                                                                    const mainPart = wholeUnits > 0 ? `${wholeUnits.toLocaleString()} ${product.unit} + ` : '';
                                                                    return `${mainPart}${subUnitsCount.toLocaleString()} ${subUnit || 'unités'}`;
                                                                }
                                                                return `${stockQty.toLocaleString()} ${product.unit || 'Pièce'}${(stockQty > 1 && !['Kg', 'Litre'].includes(product.unit)) ? 's' : ''}`;
                                                            })()}
                                                        </span>
                                                    </div>
                                                    {/* SECONDARY: Internal units (e.g., ≈ 700 pièces) */}
                                                    {isContainer && subUnit && (
                                                        <div className="text-[10px] text-gray-500 font-semibold bg-gray-50 px-2 py-0.5 rounded-sm border border-gray-100 flex items-center gap-1">
                                                            {(() => {
                                                                const wholeUnits = Math.floor(stockQty);
                                                                const fractionalPart = stockQty - wholeUnits;
                                                                if (fractionalPart > 0) {
                                                                    return <span>≈ {(stockQty * cf).toLocaleString()} {subUnit} au total</span>;
                                                                }
                                                                const internalQty = stockQty * cf;
                                                                const plural = internalQty > 1 && subUnit === 'Pièce' ? 's' : '';
                                                                return <span>≈ {internalQty.toLocaleString()} {subUnit}{plural}</span>;
                                                            })()}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </td>
                                    <td className="px-1 py-1.5 font-semibold text-[#1c398e] text-[13px] truncate">{product.supplier}</td>
                                    <td className="px-2 py-1.5 text-center">
                                        <div className="flex justify-center gap-1">
                                            <button
                                                onClick={() => handleEditClick(product)}
                                                className="p-2 text-gray-400 cursor-pointer hover:text-[#1c398e] hover:bg-blue-50 rounded-sm transition-colors"
                                                title="Modifier"
                                            >
                                                <i className="uil uil-pen text-lg"></i>
                                            </button>
                                            <button
                                                onClick={() => {
                                                    deleteProduct(product.id);
                                                    toast.success("Produit supprimé");
                                                }}
                                                className="p-2 text-gray-400 cursor-pointer hover:text-red-600 hover:bg-red-50 rounded-sm transition-colors"
                                                title="Supprimer"
                                            >
                                                <i className="uil uil-trash-alt text-lg"></i>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modals */}
            {
                isProductModalOpen && (
                    <ProductModal
                        product={selectedProduct}
                        onClose={() => setIsProductModalOpen(false)}
                        onSave={handleSaveProduct}
                    />
                )
            }

            {
                isEntryModalOpen && selectedProduct && (
                    <StockEntryModal
                        product={selectedProduct}
                        onClose={() => setIsEntryModalOpen(false)}
                        onSave={handleSaveSupply}
                    />
                )
            }

            {
                isHistoryModalOpen && selectedProduct && (
                    <StockHistoryModal
                        product={selectedProduct}
                        movements={getProductMovements(selectedProduct.id)}
                        onClose={() => setIsHistoryModalOpen(false)}
                    />
                )
            }

            {/* ── Modale d'action en masse ── */}
            {bulkModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-sm shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-start mb-5">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">
                                    {bulkModal === 'supplier' && 'Changer le fournisseur'}
                                    {bulkModal === 'category' && 'Changer la catégorie'}
                                    {bulkModal === 'minStock' && 'Mettre à jour le stock minimum'}
                                </h3>
                                <p className="text-sm text-gray-500 mt-1">
                                    Applicable à <span className="font-bold text-[#1c398e]">{selectedProductIds.length} produit{selectedProductIds.length > 1 ? 's' : ''}</span>
                                </p>
                            </div>
                            <button onClick={() => { setBulkModal(null); setBulkValue(''); }} className="p-1 hover:bg-gray-100 rounded-sm transition-colors">
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        <div className="space-y-2 mb-4 max-h-32 overflow-y-auto border border-gray-100 rounded-sm p-3 bg-gray-50">
                            {products.filter(p => selectedProductIds.includes(p.id)).map(p => (
                                <div key={p.id} className="text-sm text-gray-700 flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#1c398e] flex-shrink-0" />
                                    {p.name}
                                </div>
                            ))}
                        </div>

                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            {bulkModal === 'supplier' && 'Nouveau fournisseur'}
                            {bulkModal === 'category' && 'Nouvelle catégorie'}
                            {bulkModal === 'minStock' && 'Seuil minimum (unités)'}
                        </label>
                        <input
                            type={bulkModal === 'minStock' ? 'number' : 'text'}
                            value={bulkValue}
                            onChange={e => setBulkValue(e.target.value)}
                            placeholder={bulkModal === 'minStock' ? 'Ex: 10' : bulkModal === 'supplier' ? 'Ex: Cimco Togo' : 'Ex: Construction'}
                            className="w-full p-3 border border-gray-200 rounded-sm focus:outline-none focus:ring-2 focus:ring-[#1c398e] bg-gray-50 mb-5"
                            autoFocus
                            onKeyDown={e => e.key === 'Enter' && handleBulkApply()}
                        />
                        <div className="flex gap-3">
                            <button onClick={() => { setBulkModal(null); setBulkValue(''); }}
                                className="flex-1 py-2.5 border border-gray-200 rounded-sm text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                                Annuler
                            </button>
                            <button onClick={handleBulkApply}
                                className="flex-1 py-2.5 bg-[#1c398e] hover:bg-blue-700 text-white rounded-sm text-sm font-semibold transition-colors">
                                Appliquer aux {selectedProductIds.length} produit{selectedProductIds.length > 1 ? 's' : ''}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    </div>
);
};

export default ProductList;
