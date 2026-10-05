import React, { useState, useEffect, useRef } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { useSettings } from '../../context/SettingsContext';
import { useSales } from '../../context/SalesContext';
import { useDeliveries } from '../../context/DeliveryContext';
import T from '../../utils/toast';
import { 
    Search, Plus, Grid, List, Download, Printer, 
    Trash2, Edit3, History, PackagePlus, AlertTriangle, TrendingUp, 
    CheckCircle2, PackageX, ChevronDown, ChevronUp, X, Tag, RefreshCw, 
    FileSpreadsheet, FileText, Check, Box, Layers, Filter,
    ArrowUpDown, Sparkles, Layers3, ShoppingCart, MoreVertical, Truck, Barcode, Eye
} from 'lucide-react';
import { formatPrice } from '../../utils/currency';
import { getUnitModel, computeContainerStock, formatContainerStock } from '../../config/unitModels';
import ProductModal from '../../components/ProductModal';
import StockEntryModal from '../../components/StockEntryModal';
import StockHistoryModal from '../../components/StockHistoryModal';
import PackagingManagerModal from '../../components/PackagingManagerModal';
import ProductInsightModal from '../../components/ProductInsightModal';
import ProductDetailModal from '../../components/ProductDetailModal';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { usePurchase } from '../../context/PurchaseContext';
import { renderBarcodeSvg } from '../../utils/barcodeGenerator';

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
            className={`px-2 py-2 relative group border-r-2 border-white/20 hover:bg-white/10 transition-colors select-none ${onClick ? 'cursor-pointer' : ''} ${className || ''}`}
            onClick={onClick}
        >
            <div className="flex items-center overflow-hidden whitespace-nowrap h-full text-white font-bold uppercase tracking-wider text-[11px]">
                {children}
            </div>
            <div
                className={`absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-20 hover:bg-white/40 ${isResizing ? 'bg-white' : 'bg-transparent'}`}
                onMouseDown={handleMouseDown}
                onClick={(e) => e.stopPropagation()}
            ></div>
        </th>
    );
};

const ProductList = () => {
    const { products, refreshProducts, addProduct, updateProduct, deleteProduct, addSupply, getProductMovements, deconditionModels, categories: categoriesList } = useInventory();
    const { currentStoreId, company } = useSettings();
    const { addToCart, cart } = useSales();
    const navigate = useNavigate();
    const cartItemsCount = cart?.reduce((sum, item) => sum + (item.inputQuantity || 1), 0) ?? 0;
    const { getReservedStockMap } = useDeliveries();
    const reservedStockMap = getReservedStockMap ? getReservedStockMap() : {};
    const { replenishmentQueue, addToReplenishmentQueue } = usePurchase();
    const [searchParams] = useSearchParams();
    const [searchTerm, setSearchTerm] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [isLoadingPage, setIsLoadingPage] = useState(true);
    const [loadingMessage, setLoadingMessage] = useState("Mise à jour des stocks et des tarifs en cours (1.5s)...");

    // Action Réapprovisionnement Intelligent
    const handleAddToReplenishment = (product) => {
        const calculated = addToReplenishmentQueue(product);
        if (calculated) {
            const detail = calculated.archetype === 'BOX' 
                ? `${calculated.recommendedContainers} ${calculated.containerLabel} (${calculated.totalSubUnits} pcs)`
                : calculated.archetype === 'BULK'
                    ? `${calculated.recommendedContainers} ${calculated.containerLabel} (${calculated.totalSubUnits} ${calculated.subUnitLabel})`
                    : `${calculated.recommendedContainers} ${calculated.containerLabel}`;
            T.success(`📦 Ajouté au réapprovisionnement : ${product.name} — Recommandé : ${detail}`);
        }
    };

    // State for packaging / deconditioning picker modal
    const [cartPackagingProduct, setCartPackagingProduct] = useState(null);
    // State for row action dropdown menu
    const [openMenuId, setOpenMenuId] = useState(null);
    const menuRef = useRef(null);
    // State for packaging manager modal
    const [packagingProduct, setPackagingProduct] = useState(null);

    // Sauvegarde des conditionnements depuis le modal
    const handleSavePackaging = async (updates) => {
        try {
            await updateProduct(packagingProduct.id, {
                ...packagingProduct,
                packagings: updates.packagings,
                hasPiece: updates.hasPiece,
                piecePrice: updates.piecePrice,
                hasLot: updates.hasLot,
                lotPrice: updates.lotPrice,
                retailStepQuantity: updates.retailStepQuantity,
            });
            T.success('Conditionnements mis à jour !');
        } catch (err) {
            T.error('Erreur lors de la sauvegarde.');
        } finally {
            setPackagingProduct(null);
        }
    };

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setOpenMenuId(null);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsLoadingPage(false);
        }, 1500);
        return () => clearTimeout(timer);
    }, []);

    const handleFilterLowStockWithLoader = (e) => {
        if (e) e.stopPropagation();
        setLoadingMessage("Filtrage des produits en alerte de stock (1.5s)...");
        setIsLoadingPage(true);
        setShowLowStockOnly(true);
        setTimeout(() => {
            setIsLoadingPage(false);
            setLoadingMessage("Mise à jour des stocks et des tarifs en cours (1.5s)...");
        }, 1500);
    };

    // ── Cart / Packaging Handlers ─────────────────────────────────────
    const handleAddToCartSingle = (product) => {
        if (product.packagings?.length > 0 || product.hasLot || product.hasPiece) {
            setCartPackagingProduct(product);
        } else {
            addToCart(product, { type: 'base' });
            T.cartAdd(product.name);
        }
    };

    const handleAddToCartSelected = () => {
        const selectedProds = products.filter(p => selectedProductIds.includes(p.id));
        if (selectedProds.length === 0) return;

        if (selectedProds.length === 1) {
            handleAddToCartSingle(selectedProds[0]);
            return;
        }

        let addedCount = 0;
        const prodsWithPackaging = [];

        selectedProds.forEach(prod => {
            if (prod.packagings?.length > 0 || prod.hasLot || prod.hasPiece) {
                prodsWithPackaging.push(prod);
            } else {
                addToCart(prod, { type: 'base' });
                addedCount++;
            }
        });

        if (prodsWithPackaging.length > 0) {
            setCartPackagingProduct(prodsWithPackaging[0]);
            if (addedCount > 0) {
                T.cartAdd(`${addedCount} produit(s) standard(s) ajouté(s) — Choisissez le conditionnement pour les autres`);
            }
        } else {
            T.cartAdd(`${addedCount} produit(s) ajouté(s) au panier POS !`);
        }
    };

    useEffect(() => {
        if (searchQuery.trim() === '') {
            setSearchTerm('');
            setIsSearching(false);
            return;
        }
        setIsSearching(true);
        const handler = setTimeout(() => {
            setSearchTerm(searchQuery);
            setIsSearching(false);
        }, 250);
        return () => clearTimeout(handler);
    }, [searchQuery]);

    const [filterCategory, setFilterCategory] = useState('All');
    const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
    const [categorySearchQuery, setCategorySearchQuery] = useState('');
    const categoryDropdownRef = React.useRef(null);

    const tableScrollRef = React.useRef(null);
    const [isBulkActionsOpen, setIsBulkActionsOpen] = useState(false);
    const bulkActionsDropdownRef = React.useRef(null);

    // Close category and bulk actions dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target)) {
                setIsCategoryDropdownOpen(false);
            }
            if (bulkActionsDropdownRef.current && !bulkActionsDropdownRef.current.contains(event.target)) {
                setIsBulkActionsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const [showLowStockOnly, setShowLowStockOnly] = useState(() => {
        const f = searchParams.get('filter');
        return f === 'low_stock' || f === 'rupture' || f === 'out_of_stock';
    });
    const [selectedProductIds, setSelectedProductIds] = useState([]);

    // Modal states
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [insightProduct, setInsightProduct] = useState(null);
    const [detailProduct, setDetailProduct] = useState(null);

    // Bulk operation modal state
    const [bulkModal, setBulkModal] = useState(null);
    const [bulkValue, setBulkValue] = useState('');

    const [colWidths, setColWidths] = useState({
        checkbox: 42,
        name: 240,
        barcode: 150,
        category: 120,
        purchasePrice: 130,
        price: 160,
        stock: 165,
        supplier: 140,
        actions: 110
    });

    const handleResize = (columnId, newWidth) => {
        setColWidths(prev => ({
            ...prev,
            [columnId]: newWidth
        }));
    };

    useEffect(() => {
        const filterParam = searchParams.get('filter');
        if (filterParam === 'low_stock' || filterParam === 'rupture' || filterParam === 'out_of_stock') {
            setShowLowStockOnly(true);
            const timer = setTimeout(() => {
                const el = document.getElementById('product-list-container');
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [searchParams]);

    useEffect(() => {
        refreshProducts();
    }, []);

    const savedCatalogScrollY = useRef(0);

    const handleAddClick = () => {
        savedCatalogScrollY.current = window.scrollY;
        setSelectedProduct(null);
        setIsProductModalOpen(true);
        window.scrollTo({ top: 0, behavior: 'instant' });
    };

    const handleEditClick = (product) => {
        savedCatalogScrollY.current = window.scrollY;
        setSelectedProduct(product);
        setIsProductModalOpen(true);
        window.scrollTo({ top: 0, behavior: 'instant' });
    };

    const handleCloseProductModal = () => {
        setIsProductModalOpen(false);
        setTimeout(() => {
            window.scrollTo({ top: savedCatalogScrollY.current, behavior: 'instant' });
        }, 10);
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
        T.deleted(`${selectedProductIds.length} produit(s) supprimé(s)`);
        setSelectedProductIds([]);
    };

    const handleBulkExport = () => {
        const targetIds = selectedProductIds.length > 0 ? selectedProductIds : filteredProducts.map(p => p.id);
        const selected = products.filter(p => targetIds.includes(p.id));
        const headers = ['SKU / Code', 'Code-Barres', 'Nom Produit', 'Catégorie', 'Prix de Vente', 'Prix d\'Achat', 'Stock Actuel', 'Stock Min', 'Fournisseur', 'Unité'];
        const rows = selected.map(p => [
            p.id?.substring(0, 8) || '',
            p.barcode || '',
            p.name,
            p.category,
            p.price,
            p.purchasePrice || 0,
            p.stockLevels?.[currentStoreId] || 0,
            p.minStockLevels?.[currentStoreId] || p.minStock || 0,
            p.supplier || '',
            p.unit || ''
        ]);
        const csvContent = [headers, ...rows].map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';')).join('\n');
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; 
        a.download = `Export_Produits_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click(); 
        URL.revokeObjectURL(url);
        T.export(`${selected.length} produit(s) exporté(s) en CSV`);
    };

    const handlePrintLabels = (targetProduct = null) => {
        let selected = [];
        if (targetProduct && targetProduct.id) {
            selected = [targetProduct];
        } else {
            const targetIds = selectedProductIds.length > 0 ? selectedProductIds : filteredProducts.map(p => p.id);
            selected = products.filter(p => targetIds.includes(p.id));
        }

        if (selected.length === 0) {
            T.error("Aucun produit sélectionné pour l'impression");
            return;
        }

        const win = window.open('', '_blank');

        const buildLabels = (p) => {
            const labels = [];
            const cf = parseFloat(p.conversionFactor) || 1;
            const isContainer = (p.unitArchetype === 'BOX' || p.unitArchetype === 'BULK') && cf > 1;

            labels.push({
                tier: 'DÉTAIL',
                price: p.price,
                unit: p.unit || 'Unité',
                accent: '#001d35'
            });

            if (p.hasLot && p.lotPrice) {
                labels.push({
                    tier: `LOT (${p.retailStepQuantity || 10})`,
                    price: p.lotPrice,
                    unit: `Lot de ${p.retailStepQuantity || 10} ${p.unit || ''}`,
                    accent: '#d97706'
                });
            }

            if (isContainer && p.bulkPrice) {
                labels.push({
                    tier: 'GROS / CARTON',
                    price: p.bulkPrice,
                    unit: p.unit || 'Carton',
                    accent: '#7c3aed'
                });
            }

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

            const barcodeSvg = p.barcode ? renderBarcodeSvg(p.barcode, { width: 160, height: 50, showText: true }) : '';

            return labels.map(lbl => `
                <div style="display:inline-block;border:2px solid ${lbl.accent};padding:12px 16px;margin:8px;border-radius:6px;font-family:sans-serif;min-width:180px;vertical-align:top;position:relative;background:#fff;">
                    <div style="position:absolute;top:-10px;left:12px;background:${lbl.accent};color:#fff;font-size:9px;font-weight:900;letter-spacing:1.5px;padding:2px 8px;border-radius:3px;text-transform:uppercase;">${lbl.tier}</div>
                    <div style="font-size:9px;color:#64748b;text-transform:uppercase;margin-top:10px;letter-spacing:1px;font-weight:bold;">${p.category || 'GÉNÉRAL'}</div>
                    <div style="font-weight:800;font-size:13px;margin:6px 0;color:#0f172a;text-transform:uppercase;">${p.name}</div>
                    <div style="font-size:22px;font-weight:900;color:${lbl.accent};">${Number(lbl.price).toLocaleString('fr-FR')} <span style="font-size:11px;">FCFA</span></div>
                    <div style="font-size:10px;color:#64748b;margin-top:4px;font-weight:600;">/ ${lbl.unit}</div>
                    ${barcodeSvg ? `<div style="margin-top:8px;padding-top:6px;border-top:1px dashed #e2e8f0;text-align:center;">${barcodeSvg}</div>` : ''}
                </div>
            `).join('');
        };

        const allLabels = selected.map(p => `
            <div style="margin-bottom:16px;">
                <div style="font-size:11px;font-weight:800;color:#001d35;margin-bottom:6px;padding-left:8px;border-left:4px solid #001d35;text-transform:uppercase;letter-spacing:0.5px;">${p.name}</div>
                ${buildLabels(p)}
            </div>
        `).join('<hr style="border:none;border-top:1px dashed #cbd5e1;margin:16px 0;">');

        win.document.write(`
            <html>
            <head>
                <title>Étiquettes Produit — ${selected.length} produit(s)</title>
                <style>
                    body { padding: 24px; background: #fff; font-family: system-ui, -apple-system, sans-serif; }
                    @media print { body { padding: 8px; } hr { display: none; } }
                </style>
            </head>
            <body>${allLabels}</body>
            </html>
        `);
        win.document.close();
        setTimeout(() => win.print(), 300);
    };

    const handlePrintPDF = () => {
        const targetIds = selectedProductIds.length > 0 ? selectedProductIds : filteredProducts.map(p => p.id);
        const selected = products.filter(p => targetIds.includes(p.id));
        const win = window.open('', '_blank');

        const title = showLowStockOnly
            ? 'LISTE DES PRODUITS EN RUPTURE DE STOCK'
            : 'CATALOGUE GÉNÉRAL DES PRODUITS';

        const rows = selected.map(p => {
            const cf = parseFloat(p.conversionFactor) || 1;
            const isContainer = (p.unitArchetype === 'BOX' || p.unitArchetype === 'BULK') && cf > 1;
            const stockQty = p.stockLevels?.[currentStoreId] || 0;
            const subUnit = p.bulkUnit || getUnitModel(p.unit).subUnit;

            const stockDisplay = isContainer 
                ? formatContainerStock(stockQty, cf, p.unit, subUnit)
                : `${stockQty.toLocaleString('fr-FR')} ${p.unit || 'Pièce'}`;

            return `
                <tr>
                    <td style="padding:8px 10px; color:#001d35; font-weight:700;">${p.name}</td>
                    <td style="padding:8px 10px; font-family:monospace; font-weight:600; color:#1e293b;">${p.barcode || '—'}</td>
                    <td style="padding:8px 10px; color:#475569;">${p.category}</td>
                    <td style="padding:8px 10px; color:#0f172a; font-weight:800;">${stockDisplay}</td>
                    <td style="padding:8px 10px; color:#475569; text-align:right;">${formatPrice(p.purchasePrice || 0)}</td>
                    <td style="padding:8px 10px; color:#001d35; font-weight:800; text-align:right;">${formatPrice(p.price)} / ${p.unit || 'Unité'}</td>
                    <td style="padding:8px 10px; color:#475569;">${p.supplier || '-'}</td>
                </tr>
            `;
        }).join('');

        win.document.write(`
            <html>
            <head>
                <title>${title}</title>
                <style>
                    body { font-family: 'Inter', -apple-system, sans-serif; padding: 30px; margin: 0; background: #fff; font-size: 12px; }
                    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #001d35; padding-bottom: 16px; margin-bottom: 24px; }
                    .company-name { font-size: 20px; font-weight: 900; color: #001d35; }
                    .doc-title { font-size: 14px; font-weight: 800; color: #0f172a; text-transform: uppercase; margin-top: 4px; }
                    table { width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; }
                    th { background: #001d35; color: #fff; padding: 10px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; }
                    td { border: 1px solid #e2e8f0; }
                    tr:nth-child(even) { background: #f8fafc; }
                    .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div>
                        <div class="company-name">${company?.name || 'KABLLIX SYSTEM'}</div>
                        <div class="doc-title">${title}</div>
                    </div>
                    <div style="text-align: right; font-size: 11px; color: #64748b;">
                        <div>Date: ${new Date().toLocaleDateString('fr-FR')} ${new Date().toLocaleTimeString('fr-FR')}</div>
                        <div>Total Articles: <strong>${selected.length}</strong></div>
                    </div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Désignation</th>
                            <th>Code-Barres</th>
                            <th>Catégorie</th>
                            <th>Stock Disponible</th>
                            <th style="text-align:right;">Prix Achat</th>
                            <th style="text-align:right;">Prix Vente</th>
                            <th>Fournisseur</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
                <div class="footer">Rapport édité via Kabllix Management System</div>
            </body>
            </html>
        `);
        win.document.close();
        setTimeout(() => win.print(), 400);
    };

    const handleBulkApply = () => {
        if (!bulkValue.trim()) { T.error('Veuillez saisir une valeur'); return; }
        selectedProductIds.forEach(id => {
            const update = bulkModal === 'supplier' ? { supplier: bulkValue }
                : bulkModal === 'category' ? { category: bulkValue }
                    : { minStock: parseFloat(bulkValue) || 0 };
            updateProduct(id, update);
        });
        const labels = { supplier: 'fournisseur', category: 'catégorie', minStock: 'stock minimum' };
        T.success(`${labels[bulkModal]} mis à jour pour ${selectedProductIds.length} produit(s)`);
        setBulkModal(null); setBulkValue(''); setSelectedProductIds([]);
    };

    const handleSaveProduct = (productData) => {
        if (selectedProduct) {
            updateProduct(selectedProduct.id, productData, currentStoreId);
            T.productUpdated(productData.name || 'Produit');
        } else {
            addProduct(productData);
            T.productCreated(productData.name);
        }
        setIsProductModalOpen(false);
        setTimeout(() => {
            window.scrollTo({ top: savedCatalogScrollY.current, behavior: 'instant' });
        }, 10);
    };

    const handleSaveSupply = (productId, supplyData) => {
        addSupply(productId, supplyData);
        setIsEntryModalOpen(false);
    };

    const filteredProducts = products.filter(product => {
        const matchesSearch = product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            product.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            product.supplier?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            product.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (product.barcode && product.barcode.toLowerCase().includes(searchTerm.toLowerCase()));

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
        if (!sortConfig.key) {
            // Ordre naturel de création croissant : les nouveaux produits sont positionnés en fin de tableau
            if (a.createdAt && b.createdAt) {
                return new Date(a.createdAt) - new Date(b.createdAt);
            }
            return 0;
        }

        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        if (sortConfig.key === 'stock') {
            aValue = a.stockLevels?.[currentStoreId] || 0;
            bValue = b.stockLevels?.[currentStoreId] || 0;
        }

        if (aValue === null || aValue === undefined) aValue = '';
        if (bValue === null || bValue === undefined) bValue = '';

        if (typeof aValue === 'string') {
            aValue = aValue.toLowerCase();
            bValue = typeof bValue === 'string' ? bValue.toLowerCase() : '';
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    const categories = ['All', ...new Set([...(categoriesList || []).map(c => c.name), ...products.map(p => p.category)].filter(Boolean))];
    const searchedCategories = categories.filter(cat => 
        cat === 'All' || cat.toLowerCase().includes(categorySearchQuery.toLowerCase())
    );

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

    // Metrics Calculations
    const totalProducts = products.length;
    const lowStockCount = products.filter(p => (p.stockLevels?.[currentStoreId] || 0) <= (p.minStockLevels?.[currentStoreId] || p.minStock || 0)).length;
    const outOfStockCount = products.filter(p => (p.stockLevels?.[currentStoreId] || 0) <= 0).length;
    const totalStockValue = products.reduce((sum, p) => sum + ((p.stockLevels?.[currentStoreId] || 0) * (p.purchasePrice || 0)), 0);
    const totalRetailValue = products.reduce((sum, p) => sum + ((p.stockLevels?.[currentStoreId] || 0) * (p.price || 0)), 0);

    if (isLoadingPage) {
        return (
            <div className="min-h-[calc(100vh-140px)] flex items-center justify-center w-full animate-in fade-in duration-150">
                <div className="flex items-center justify-center bg-white p-8 rounded-[4px] shadow-xl border-2 border-gray-200">
                    <div className="relative h-12 w-12">
                        <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-t-transparent border-[#001d35]"></div>
                        <div className="absolute inset-1.5 animate-spin-reverse rounded-full border-2 border-b-transparent border-[#f77500] opacity-80"></div>
                    </div>
                </div>
            </div>
        );
    }

    if (isProductModalOpen) {
        return (
            <ProductModal
                product={selectedProduct}
                onClose={handleCloseProductModal}
                onSave={handleSaveProduct}
            />
        );
    }

    return (
        <div className="space-y-4">

            {/* ── Badge Panier Flottant (visible dès qu'il y a ≥1 article) ── */}
            {cartItemsCount > 0 && (
                <button
                    onClick={() => navigate('/pos')}
                    title={`Panier POS — ${cartItemsCount} article(s) — Cliquer pour ouvrir le POS`}
                    className="fixed bottom-6 right-6 z-[9999] flex items-center gap-2.5 bg-[#001d35] hover:bg-[#00284a] text-white px-3.5 py-2 rounded-full shadow-xl border border-[#f77500]/40 transition-all duration-200 hover:scale-105 active:scale-95 group animate-in fade-in slide-in-from-bottom-2 duration-300 cursor-pointer"
                >
                    <span className="relative">
                        <ShoppingCart className="w-4 h-4 text-white" />
                        <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-0.5 rounded-full bg-[#f77500] text-white text-[10px] font-black flex items-center justify-center shadow-md border border-white/30">
                            {cartItemsCount}
                        </span>
                    </span>
                    <span className="text-xs font-bold tracking-wide">Voir le panier</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-[#f77500] animate-pulse shrink-0" />
                </button>
            )}


            {/* Top Insight Bar — Exactement le style et la typographie du Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Total Catalogue */}
                <div className="bg-white p-4 rounded-sm border-2 border-gray-300 shadow-sm relative group hover:shadow-md transition-shadow overflow-hidden flex flex-col justify-between">
                    <div className="relative z-10 flex flex-col justify-between h-full">
                        <div className="flex items-center justify-between gap-2 mb-1 min-h-[28px]">
                            <p className="text-[11px] font-bold text-blue-600/70 uppercase tracking-widest">Total Catalogue</p>
                            <button
                                onClick={handleAddClick}
                                className="px-2.5 py-1 bg-[#001d35] hover:bg-blue-800 text-white rounded-sm font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer border border-[#001d35] hover:scale-105 active:scale-95 shrink-0 whitespace-nowrap"
                                title="Créer un nouveau produit dans le catalogue"
                            >
                                <Plus className="w-3.5 h-3.5 text-white" />
                                <span>Nouveau Produit</span>
                            </button>
                        </div>
                        <div>
                            <h3 className="text-xl sm:text-2xl font-semibold text-[#001d35] opacity-85">{totalProducts}</h3>
                            <p className="text-xs text-gray-400 mt-2 font-medium">Produits référencés ({categories.length - 1} cat.)</p>
                        </div>
                    </div>
                    <img
                        src="/icons8/fluency_240_tags.png"
                        alt="Catalogue"
                        className="absolute bottom-2 right-2 w-16 h-16 opacity-30 group-hover:opacity-50 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-700 pointer-events-none"
                    />
                </div>

                {/* Valeur Totale Stock */}
                <div className="bg-white p-4 rounded-sm border-2 border-gray-300 shadow-sm relative group hover:shadow-md transition-shadow overflow-hidden flex flex-col justify-between">
                    <div className="relative z-10 flex flex-col justify-between h-full">
                        <div className="flex items-center justify-between gap-2 mb-1 min-h-[28px]">
                            <p className="text-[11px] font-bold text-blue-600/70 uppercase tracking-widest">Valeur Totale Stock</p>
                        </div>
                        <div>
                            <h3 className="text-xl sm:text-2xl font-semibold text-[#001d35] opacity-85">{formatPrice(totalStockValue)}</h3>
                            <p className="text-xs text-gray-400 mt-2 font-medium">Vente estimée: {formatPrice(totalRetailValue)}</p>
                        </div>
                    </div>
                    <img
                        src="/icons8/fluency_240_banknotes.png"
                        alt="Valeur Stock"
                        className="absolute bottom-2 right-2 w-16 h-16 opacity-30 group-hover:opacity-50 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-700 pointer-events-none"
                    />
                </div>

                {/* Alertes Stock */}
                <div 
                    onClick={lowStockCount > 0 ? handleFilterLowStockWithLoader : undefined}
                    className={`bg-white p-4 rounded-sm border-2 border-gray-300 shadow-sm relative group hover:shadow-md transition-all overflow-hidden flex flex-col justify-between ${
                        lowStockCount > 0 ? 'cursor-pointer hover:border-amber-400' : ''
                    }`}
                    title={lowStockCount > 0 ? "Cliquer pour filtrer les produits en alerte de stock" : "Alertes Stock"}
                >
                    <div className="relative z-10 flex flex-col justify-between h-full">
                        <div className="flex items-center gap-1.5 mb-1 min-h-[28px]">
                            <p className="text-[11px] font-bold text-blue-600/70 uppercase tracking-widest">Alertes Stock</p>
                            {lowStockCount > 0 && (
                                <span 
                                    onClick={handleFilterLowStockWithLoader}
                                    className="w-5 h-5 rounded-full bg-amber-500 text-white text-xs font-black flex items-center justify-center animate-pulse flex-shrink-0 shadow-sm border border-amber-400 cursor-pointer hover:scale-110 active:scale-95 transition-transform" 
                                    title="Cliquer pour filtrer les produits en alerte de stock"
                                >
                                    !
                                </span>
                            )}
                        </div>
                        <div>
                            <h3 className={`text-xl sm:text-2xl font-semibold opacity-85 ${lowStockCount > 0 ? 'text-red-600' : 'text-[#001d35]'}`}>
                                {lowStockCount}
                            </h3>
                            <p className="text-xs text-gray-400 mt-2 font-medium">Ruptures totales : {outOfStockCount}</p>
                        </div>
                    </div>
                    <img
                        src="/icons8/fluency_240_high-priority.png"
                        alt=""
                        className="absolute bottom-2 right-2 w-16 h-16 opacity-30 group-hover:opacity-50 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-700 pointer-events-none"
                    />
                </div>
            </div>

            {/* Barre de Contrôle Compacte (Recherche, Filtres, Actions) */}
            <div id="product-list-container" className="bg-white border-2 border-gray-300 rounded-sm p-2 sm:p-2.5 shadow-sm scroll-mt-6">
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                    {/* Partie Gauche : Recherche à largeur maîtrisée + Filtre Catégorie compact */}
                    <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                        {/* Recherche compacte */}
                        <div className="relative w-60 sm:w-72 md:w-80 shrink-0">
                            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                                {isSearching ? (
                                    <div className="w-3.5 h-3.5 border-2 border-[#001d35]/20 border-t-[#001d35] rounded-full animate-spin" />
                                ) : (
                                    <Search className="w-3.5 h-3.5 text-gray-400" />
                                )}
                            </div>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Rechercher un produit..."
                                className="w-full pl-8 pr-7 py-1.5 bg-gray-50 border border-gray-300 rounded-sm text-xs font-semibold text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-[#001d35] focus:bg-white transition-all"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-red-600 cursor-pointer"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        {/* Filtre par Catégories (Padding réduit et bouton compact) */}
                        <div className="relative inline-block text-left" ref={categoryDropdownRef}>
                            <button
                                type="button"
                                onClick={() => setIsCategoryDropdownOpen(prev => !prev)}
                                className={`px-2.5 py-1.5 rounded-sm border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                                    filterCategory !== 'All'
                                        ? 'bg-[#001d35] text-white border-[#001d35]'
                                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-[#001d35]'
                                }`}
                            >
                                <Filter className={`w-3.5 h-3.5 shrink-0 ${filterCategory !== 'All' ? 'text-white' : 'text-[#001d35]'}`} />
                                <span className="font-semibold truncate max-w-[120px] sm:max-w-[160px]">
                                    {filterCategory === 'All' ? 'Catégories' : filterCategory}
                                </span>
                                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                                    filterCategory !== 'All' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                                }`}>
                                    {filterCategory === 'All' ? products.length : filteredProducts.length}
                                </span>
                                <ChevronDown className={`w-3 h-3 shrink-0 transition-transform duration-200 ${isCategoryDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {/* Dropdown Menu Popover compact */}
                            {isCategoryDropdownOpen && (
                                <div className="absolute left-0 mt-1 w-56 bg-white rounded-sm border-2 border-gray-300 shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                                    <div className="p-1.5 bg-gray-50 border-b border-gray-200">
                                        <div className="relative">
                                            <Search className="w-3 h-3 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
                                            <input
                                                type="text"
                                                value={categorySearchQuery}
                                                onChange={(e) => setCategorySearchQuery(e.target.value)}
                                                placeholder="Rechercher une catégorie..."
                                                className="w-full pl-7 pr-6 py-1 text-xs bg-white border border-gray-300 rounded-sm focus:outline-none focus:border-[#001d35]"
                                                autoFocus
                                            />
                                            {categorySearchQuery && (
                                                <button
                                                    onClick={() => setCategorySearchQuery('')}
                                                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="max-h-60 overflow-y-auto py-0.5 divide-y divide-gray-100">
                                        {searchedCategories.map(cat => {
                                            const count = cat === 'All' ? products.length : products.filter(p => p.category === cat).length;
                                            const isSelected = filterCategory === cat;
                                            return (
                                                <button
                                                    key={cat}
                                                    onClick={() => {
                                                        setFilterCategory(cat);
                                                        setIsCategoryDropdownOpen(false);
                                                    }}
                                                    className={`w-full text-left px-2.5 py-1.5 text-xs font-semibold flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                                                        isSelected 
                                                            ? 'bg-[#001d35]/5 text-[#001d35] border-l-4 border-[#001d35]' 
                                                            : 'text-gray-700 hover:bg-gray-50 border-l-4 border-transparent'
                                                    }`}
                                                >
                                                    <span className="truncate flex-1">{cat === 'All' ? 'Toutes les catégories' : cat}</span>
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
                                                        isSelected ? 'bg-[#001d35] text-white' : 'bg-gray-100 text-gray-500'
                                                    }`}>
                                                        {count}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                        {searchedCategories.length === 0 && (
                                            <div className="px-3 py-3 text-center text-xs text-gray-400 font-medium">
                                                Aucune catégorie trouvée
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Badge Filtre Actif + Bouton Réinitialiser compact */}
                        {filterCategory !== 'All' && (
                            <div className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 text-[#001d35] px-2 py-1 rounded-sm text-xs font-bold">
                                <span className="truncate max-w-[130px]">{filterCategory}</span>
                                <button
                                    onClick={() => setFilterCategory('All')}
                                    className="p-0.5 hover:bg-blue-100 rounded-full text-[#001d35] hover:text-red-600 transition-colors cursor-pointer ml-0.5"
                                    title="Réinitialiser à toutes les catégories"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Actions Produits (Boutons compacts) */}
                    <div className="flex flex-wrap items-center gap-1.5">
                        {/* Accès Réapprovisionnement Intelligent */}
                        <Link
                            to="/replenishment"
                            className="px-2.5 py-1.5 bg-[#001d35] hover:bg-[#00284a] text-white border border-[#001d35] rounded-sm text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                            title="Accéder au réapprovisionnement intelligent des articles"
                        >
                            <Truck className="w-3.5 h-3.5 text-[#f77500]" />
                            <span>Réapprovisionnement</span>
                            {replenishmentQueue?.length > 0 && (
                                <span className="w-4 h-4 rounded-full bg-red-600 text-white text-[10px] font-semibold flex items-center justify-center">
                                    {replenishmentQueue.length}
                                </span>
                            )}
                        </Link>

                        {/* Toggle Ruptures */}
                        <button
                            onClick={() => setShowLowStockOnly(!showLowStockOnly)}
                            className={`px-2.5 py-1.5 rounded-sm border text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                                showLowStockOnly 
                                    ? 'bg-amber-600 text-white border-amber-700 shadow-2xs' 
                                    : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                            }`}
                        >
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Ruptures ({lowStockCount})</span>
                        </button>

                        {/* Imprimer & Export */}
                        <button
                            onClick={handlePrintLabels}
                            className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-[#001d35] border border-gray-300 rounded-sm text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                            title="Imprimer les étiquettes de prix"
                        >
                            <Printer className="w-3.5 h-3.5" />
                            <span className="hidden md:inline">Étiquettes</span>
                        </button>

                        <button
                            onClick={handlePrintPDF}
                            className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-[#001d35] border border-gray-300 rounded-sm text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                            title="Imprimer en PDF"
                        >
                            <FileText className="w-3.5 h-3.5" />
                            <span className="hidden md:inline">PDF</span>
                        </button>

                        <button
                            onClick={handleBulkExport}
                            className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-[#001d35] text-xs font-bold uppercase tracking-wider rounded-sm flex items-center gap-1 transition-colors cursor-pointer border border-gray-300"
                            title="Exporter la vue au format CSV"
                        >
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                            <span className="hidden md:inline">CSV</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Vue Unique : Tableau Compact du Catalogue */}
            <div className="bg-white rounded-sm border-2 border-gray-300 shadow-sm flex flex-col h-[calc(100vh-250px)] min-h-[480px] overflow-hidden relative">
                    <div className="overflow-auto flex-1 relative" ref={tableScrollRef}>
                        <table className="w-full text-left text-sm relative border-collapse">
                            <thead style={{ backgroundColor: '#001d35' }} className="text-white font-bold sticky top-0 z-20 shadow-sm uppercase tracking-wider text-[11px]">
                                <tr className="divide-x-2 divide-white/20">
                                    <th style={{ width: `${colWidths.checkbox}px`, minWidth: `${colWidths.checkbox}px` }} className="px-1 py-1.5 border-r-2 border-white/20 text-center">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 rounded-sm border-white/20 accent-[#001d35] cursor-pointer"
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
                                    <ResizableHeader columnId="barcode" width={colWidths.barcode} onResize={handleResize} onClick={() => handleSort('barcode')}>
                                        <div className="flex items-center justify-center gap-2 w-full">
                                            <div className="flex flex-col items-center leading-none">
                                                <i className={`uil uil-arrow-up text-[10px] ${sortConfig.key === 'barcode' && sortConfig.direction === 'asc' ? 'text-white' : 'text-white/30'}`}></i>
                                                <i className={`uil uil-arrow-down text-[10px] ${sortConfig.key === 'barcode' && sortConfig.direction === 'desc' ? 'text-white' : 'text-white/30'}`}></i>
                                            </div>
                                            Code-Barres
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
                                {sortedProducts.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="py-16 text-center text-gray-500 font-medium">
                                            <Box className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                                            <p className="text-base text-gray-700 font-bold">Aucun produit ne correspond à votre recherche</p>
                                            <p className="text-xs text-gray-400 mt-1">Essayez de réinitialiser vos filtres ou d'ajouter un nouveau produit.</p>
                                        </td>
                                    </tr>
                                ) : (
                                    sortedProducts.map((product) => {
                                        const stockQty = product.stockLevels?.[currentStoreId] || 0;
                                        const reservedQty = reservedStockMap[product.id] || 0;
                                        const availableQty = Math.max(0, stockQty - reservedQty);
                                        const minStock = product.minStockLevels?.[currentStoreId] || product.minStock || 0;
                                        const isLow = stockQty <= minStock;
                                        const cf = parseFloat(product.conversionFactor) || 1;
                                        const isContainer = (product.unitArchetype === 'BOX' || product.unitArchetype === 'BULK') && cf > 1;
                                        const subUnit = product.bulkUnit || getUnitModel(product.unit).subUnit;
                                        const isSelected = selectedProductIds.includes(product.id);
                                        const isSimpleUnit = product.unitArchetype === 'UNIT' || (!product.unitArchetype && getUnitModel(product.unit).archetype === 'UNIT');

                                        return (
                                            <tr 
                                                key={product.id} 
                                                onDoubleClick={(e) => {
                                                    // Ne pas ouvrir si on double-clique sur la case à cocher ou les boutons d'action
                                                    if (e.target.closest('input[type="checkbox"]') || e.target.closest('button')) return;
                                                    setDetailProduct(product);
                                                }}
                                                className={`divide-x-2 divide-[#e6e6e6] transition-colors cursor-pointer select-none ${
                                                    isSelected ? 'bg-blue-50' : 'odd:bg-[#f8fafc] even:bg-[#ffffff] hover:bg-blue-50/50'
                                                }`}
                                                title="Double-clic pour voir les détails complets du produit"
                                            >
                                                <td className="px-1 py-0.5 text-center">
                                                    <input
                                                        type="checkbox"
                                                        className="w-4 h-4 rounded-sm border-gray-300 accent-[#001d35] cursor-pointer"
                                                        checked={isSelected}
                                                        onChange={() => handleSelectProduct(product.id)}
                                                    />
                                                </td>

                                                {/* Designation */}
                                                <td className="px-2 py-1 font-semibold text-[#001d35] text-[14px] tracking-wide">
                                                    <div className="truncate">{product.name?.toUpperCase()}</div>
                                                </td>

                                                {/* Code-Barres */}
                                                <td className="px-2 py-1 text-center align-middle">
                                                    {product.barcode ? (() => {
                                                        const barcodeSvg = renderBarcodeSvg(product.barcode, {
                                                            width: 110,
                                                            height: 22,
                                                            showText: false,
                                                            lineColor: '#001d35'
                                                        });
                                                        return (
                                                            <div 
                                                                className="inline-flex flex-col items-center justify-center px-1.5 py-0.5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-[#001d35]/40 rounded-sm transition-all shadow-2xs group/code cursor-pointer mx-auto max-w-[130px]"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    navigator.clipboard.writeText(product.barcode);
                                                                    T.success(`Code-barres ${product.barcode} copié !`);
                                                                }}
                                                                title="Cliquer pour copier le code-barres"
                                                            >
                                                                {/* Code-barres (barres graphiques en haut) */}
                                                                {barcodeSvg ? (
                                                                    <div 
                                                                        className="w-full flex items-center justify-center overflow-hidden"
                                                                        dangerouslySetInnerHTML={{ __html: barcodeSvg }}
                                                                    />
                                                                ) : (
                                                                    <Barcode className="w-4 h-4 text-slate-400 group-hover/code:text-[#001d35] transition-colors" strokeWidth={1.5} />
                                                                )}
                                                                {/* Numéros en bas */}
                                                                <span className="font-mono text-[10px] font-bold text-slate-700 group-hover/code:text-[#001d35] tracking-wider mt-0.5 leading-none transition-colors">
                                                                    {product.barcode}
                                                                </span>
                                                            </div>
                                                        );
                                                    })() : (
                                                        <span className="text-gray-300 italic text-xs">—</span>
                                                    )}
                                                </td>

                                                {/* Category */}
                                                <td className="px-1 py-0.5 text-[#001d35] truncate text-[13px] font-semibold">
                                                    <span className="bg-[#001d35]/10 px-2 py-0.5 rounded-sm text-xs border border-[#001d35]/20">
                                                        {product.category}
                                                    </span>
                                                </td>

                                                {/* Purchase Price */}
                                                <td className="px-1 py-0.5 font-semibold text-[#001d35] text-[14px] truncate text-center">
                                                    {product.purchasePrice ? formatPrice(product.purchasePrice) : <span className="text-gray-300 italic text-xs">—</span>}
                                                </td>

                                                {/* Selling Price */}
                                                <td className="px-1 py-0.5 truncate text-center">
                                                    <div className="flex flex-col items-center">
                                                        <div className="font-semibold text-[#001d35] text-[14px]">
                                                            {formatPrice(product.price)} <span className="text-gray-400 text-xs font-normal">/ {product.unit || 'Unité'}</span>
                                                        </div>
                                                        {product.hasPiece && product.piecePrice && (
                                                            <div className="text-[11px] font-semibold mt-0.5 flex items-center gap-1.5 bg-blue-50/50 w-fit px-2 py-0.5 rounded-sm border border-[#001d35]/20 text-[#001d35]">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-[#001d35]" />
                                                                {formatPrice(product.piecePrice)} / Pièce ({product.bulkUnit || getUnitModel(product.unit).subUnit || 'Pièce'})
                                                            </div>
                                                        )}
                                                        {product.hasLot && product.lotPrice && (
                                                            <div className="text-[11px] font-semibold mt-0.5 flex items-center gap-1.5 bg-blue-50/50 w-fit px-2 py-0.5 rounded-sm border border-[#001d35]/20 text-[#001d35]">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-[#001d35]" />
                                                                {formatPrice(product.lotPrice)} / Lot de {product.retailStepQuantity || 10}
                                                            </div>
                                                        )}
                                                        {product.packagings?.map(pkg => (
                                                            <div key={pkg.modelId} className="text-[10px] font-bold mt-0.5 flex items-center gap-1.5 uppercase bg-blue-50 text-[#001d35] w-fit px-2 py-0.5 rounded-sm">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-[#001d35]" />
                                                                {formatPrice(pkg.price)} / {pkg.name}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </td>

                                                {/* Stock Status */}
                                                <td className="px-1 py-0.5">
                                                    <div className="flex flex-col items-center gap-1">
                                                        <div 
                                                            title={isContainer && cf > 1
                                                                ? `Stock Physique : ${stockQty} ${product.unit} (≈ ${(stockQty * cf).toLocaleString()} ${subUnit}) | Seuil min : ${minStock} ${product.unit}`
                                                                : `Stock Physique : ${stockQty} ${product.unit || 'unités'} | Seuil min : ${minStock} ${product.unit || 'unités'}`
                                                            }
                                                            className={`flex items-center justify-center gap-1.5 px-2.5 py-0.5 rounded-sm font-bold text-sm cursor-help ${
                                                                isLow ? 'text-red-600 bg-red-50 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                            }`}
                                                        >
                                                            {isLow && <i className="uil uil-exclamation-triangle text-lg"></i>}
                                                            <span>
                                                                {isContainer 
                                                                    ? formatContainerStock(stockQty, cf, product.unit, subUnit)
                                                                    : `${stockQty.toLocaleString('fr-FR')} ${product.unit || 'Pièce'}`
                                                                }
                                                            </span>
                                                        </div>

                                                        {/* Badge Stock Réservé (Bons à Enlever) */}
                                                        {reservedQty > 0 && (
                                                            <div className="text-[10px] font-bold text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-sm flex items-center gap-1 shadow-2xs" title="Marchandises déjà payées en attente d'enlèvement au dépôt">
                                                                <Truck className="w-3 h-3 text-amber-700 shrink-0" />
                                                                <span>Réservé : {reservedQty} {product.unit}</span>
                                                            </div>
                                                        )}

                                                        {/* Stock Disponible Réel à la vente */}
                                                        {reservedQty > 0 && (
                                                            <div className="text-[10px] font-extrabold text-blue-900 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-sm">
                                                                Dispo vente : {availableQty} {product.unit}
                                                            </div>
                                                        )}

                                                        {isContainer && subUnit && (
                                                            <div className="text-[10px] text-gray-500 font-semibold bg-gray-50 px-2 py-0.5 rounded-sm border border-gray-200">
                                                                ≈ {computeContainerStock(stockQty, cf).exactTotalSubUnits.toLocaleString('fr-FR')} {subUnit}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Supplier */}
                                                <td className="px-1 py-0.5 font-semibold text-[#001d35] text-[13px] truncate">{product.supplier || '—'}</td>

                                                {/* Actions */}
                                                <td className="px-1 py-0.5 text-center">
                                                    <div className="flex justify-center items-center gap-0.5">


                                                        {/* Bouton Panier POS */}
                                                        <button
                                                            onClick={() => handleAddToCartSingle(product)}
                                                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-sm transition-colors cursor-pointer"
                                                            title="Ajouter au panier POS"
                                                        >
                                                            <ShoppingCart className="w-4 h-4" />
                                                        </button>

                                                        {/* Bouton 3 points */}
                                                        <div className="relative" ref={openMenuId === product.id ? menuRef : null}>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === product.id ? null : product.id); }}
                                                                className="p-2 text-gray-400 hover:text-[#001d35] hover:bg-gray-100 rounded-sm transition-colors cursor-pointer"
                                                                title="Plus d'actions"
                                                            >
                                                                <MoreVertical className="w-4 h-4" />
                                                            </button>

                                                            {openMenuId === product.id && (
                                                                <div className="absolute right-0 top-full mt-0.5 w-56 bg-white border border-gray-200 shadow-xl z-[60] py-0.5 rounded-sm animate-in fade-in zoom-in-95 duration-100">
                                                                    <button
                                                                        onClick={() => { handleAddToReplenishment(product); setOpenMenuId(null); }}
                                                                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-[#001d35] hover:bg-orange-50 hover:text-orange-900 transition-colors cursor-pointer whitespace-nowrap"
                                                                    >
                                                                        <PackagePlus className="w-3.5 h-3.5 flex-shrink-0 text-[#f77500]" />
                                                                        Ajouter au réapprovisionnement
                                                                    </button>
                                                                    <button
                                                                        onClick={() => { setDetailProduct(product); setOpenMenuId(null); }}
                                                                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-[#001d35] hover:bg-slate-100 transition-colors cursor-pointer whitespace-nowrap"
                                                                    >
                                                                        <Eye className="w-3.5 h-3.5 flex-shrink-0 text-[#001d35]" />
                                                                        Voir la fiche produit
                                                                    </button>
                                                                    <button
                                                                        onClick={() => { handleEntryClick(product); setOpenMenuId(null); }}
                                                                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer whitespace-nowrap"
                                                                    >
                                                                        <Truck className="w-3.5 h-3.5 flex-shrink-0" />
                                                                        Approvisionner ce produit (Entrée)
                                                                    </button>
                                                                    <button
                                                                        onClick={() => { setInsightProduct(product); setOpenMenuId(null); }}
                                                                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer whitespace-nowrap"
                                                                    >
                                                                        <TrendingUp className="w-3.5 h-3.5 flex-shrink-0 text-emerald-600" />
                                                                        Performance & Analyse
                                                                    </button>
                                                                    <button
                                                                        onClick={() => { handleHistoryClick(product); setOpenMenuId(null); }}
                                                                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer whitespace-nowrap"
                                                                    >
                                                                        <History className="w-3.5 h-3.5 flex-shrink-0" />
                                                                        Historique
                                                                    </button>
                                                                    <button
                                                                        onClick={() => { handleEditClick(product); setOpenMenuId(null); }}
                                                                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer whitespace-nowrap"
                                                                    >
                                                                        <Edit3 className="w-3.5 h-3.5 flex-shrink-0" />
                                                                        Modifier ce produit
                                                                    </button>
                                                                    <button
                                                                        onClick={() => { handlePrintLabels(product); setOpenMenuId(null); }}
                                                                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer whitespace-nowrap"
                                                                    >
                                                                        <Tag className="w-3.5 h-3.5 flex-shrink-0 text-slate-500" />
                                                                        Étiquette
                                                                    </button>
                                                                    {!isSimpleUnit && (
                                                                        <button
                                                                            onClick={() => { setPackagingProduct(product); setOpenMenuId(null); }}
                                                                            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-[#001d35] hover:bg-amber-50 hover:text-amber-800 transition-colors cursor-pointer whitespace-nowrap"
                                                                        >
                                                                            <Box className="w-3.5 h-3.5 flex-shrink-0 text-amber-600" />
                                                                            Conditionnement
                                                                        </button>
                                                                    )}
                                                                    <div className="border-t border-gray-100 my-0.5" />
                                                                    <button
                                                                        onClick={() => {
                                                                            setOpenMenuId(null);
                                                                            if (window.confirm(`Supprimer ${product.name} ?`)) {
                                                                                deleteProduct(product.id);
                                                                                T.deleted("Produit supprimé");
                                                                            }
                                                                        }}
                                                                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors cursor-pointer whitespace-nowrap"
                                                                    >
                                                                        <Trash2 className="w-3.5 h-3.5 flex-shrink-0" />
                                                                        Supprimer
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pied de Tableau ERP Fixe au bas du conteneur de tableau */}
                    <div className="bg-slate-100/95 backdrop-blur-md border-t-2 border-slate-300 px-4 py-2 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] flex flex-wrap items-center justify-between gap-3 text-xs text-slate-700 select-none z-20 shrink-0 rounded-none">
                        {/* Contrôles Gauche : Actions, Navigation & Sélection */}
                        <div className="flex items-center gap-2.5">
                            {/* Menu Déroulant Actions (Style ERP SAP / Oracle) */}
                            <div className="relative inline-block text-left" ref={bulkActionsDropdownRef}>
                                <button
                                    type="button"
                                    onClick={() => setIsBulkActionsOpen(prev => !prev)}
                                    className="px-3 py-1.5 bg-white border-2 border-slate-300 hover:bg-slate-50 text-slate-800 font-bold rounded-none shadow-2xs flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 text-xs"
                                >
                                    <span>Actions</span>
                                    <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${isBulkActionsOpen ? 'rotate-180' : ''}`} />
                                </button>
                                {isBulkActionsOpen && (
                                    <div className="absolute left-0 bottom-full mb-1.5 w-56 bg-white border-2 border-slate-300 rounded-none shadow-2xl z-50 py-1.5 text-slate-800 animate-in fade-in zoom-in-95 duration-100">
                                        <button
                                            type="button"
                                            onClick={() => { setIsBulkActionsOpen(false); handleBulkExport(); }}
                                            className="w-full text-left px-3 py-2 text-xs font-semibold hover:bg-blue-50 hover:text-[#001d35] flex items-center gap-2 cursor-pointer"
                                        >
                                            <FileSpreadsheet className="w-4 h-4 text-[#001d35]" />
                                            Exporter au format CSV ({sortedProducts.length})
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setIsBulkActionsOpen(false); handlePrintLabels(); }}
                                            className="w-full text-left px-3 py-2 text-xs font-semibold hover:bg-blue-50 hover:text-[#001d35] flex items-center gap-2 cursor-pointer"
                                        >
                                            <Printer className="w-4 h-4 text-[#001d35]" />
                                            Imprimer les étiquettes de prix
                                        </button>
                                        {selectedProductIds.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => { setIsBulkActionsOpen(false); handleAddToCartSelected(); }}
                                                className="w-full text-left px-3 py-2 text-xs font-bold text-[#001d35] hover:bg-blue-50 flex items-center gap-2 cursor-pointer border-t border-slate-200"
                                            >
                                                <ShoppingCart className="w-4 h-4 text-[#001d35]" />
                                                Ajouter au panier POS ({selectedProductIds.length})
                                            </button>
                                        )}
                                        {selectedProductIds.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => { setIsBulkActionsOpen(false); handleDeleteSelected(); }}
                                                className="w-full text-left px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer border-t border-slate-200 mt-1 pt-2"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                                Supprimer la sélection ({selectedProductIds.length})
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Bouton rapide Ajouter au Panier POS si des éléments sont cochés */}
                            {selectedProductIds.length > 0 && (
                                <button
                                    type="button"
                                    onClick={handleAddToCartSelected}
                                    className="px-3 py-1.5 bg-[#001d35] hover:bg-blue-800 text-white font-bold rounded-none shadow-2xs flex items-center gap-1.5 cursor-pointer text-xs transition-all active:scale-95 border border-[#001d35] animate-in fade-in zoom-in-95 duration-100"
                                >
                                    <ShoppingCart className="w-3.5 h-3.5 text-amber-400" />
                                    <span>Ajouter au panier ({selectedProductIds.length})</span>
                                </button>
                            )}

                            {/* Flèches Haut/Bas ERP */}
                            <div className="flex items-center border-2 border-slate-300 rounded-none bg-white overflow-hidden shadow-2xs">
                                <button
                                    type="button"
                                    onClick={() => tableScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
                                    className="p-1.5 hover:bg-blue-50 hover:text-[#001d35] text-slate-600 transition-colors border-r border-slate-200 cursor-pointer"
                                    title="Remonter tout en haut du tableau"
                                >
                                    <ChevronUp className="w-4 h-4 stroke-[2.5]" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => tableScrollRef.current?.scrollTo({ top: tableScrollRef.current.scrollHeight, behavior: 'smooth' })}
                                    className="p-1.5 hover:bg-blue-50 hover:text-[#001d35] text-slate-600 transition-colors cursor-pointer"
                                    title="Descendre tout en bas du tableau"
                                >
                                    <ChevronDown className="w-4 h-4 stroke-[2.5]" />
                                </button>
                            </div>

                            {/* Compteur d'articles & sélection */}
                            <div className="text-xs font-semibold text-slate-600 flex items-center gap-2 pl-2 border-l-2 border-slate-300">
                                <span>Affichage : <strong className="text-slate-900 font-bold">{sortedProducts.length}</strong> / {products.length} articles</span>
                                {selectedProductIds.length > 0 && (
                                    <span className="bg-[#001d35] text-white px-2.5 py-0.5 rounded-none font-bold text-[11px] uppercase tracking-wider shadow-2xs">
                                        {selectedProductIds.length} sélectionné(s)
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

            {/* Barre Console Flottante pour Actions Groupées */}
            {selectedProductIds.length > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#001d35] text-white rounded-sm shadow-2xl border-2 border-blue-400 p-3 px-5 z-40 flex items-center gap-4 animate-in slide-in-from-bottom duration-300">
                    <div className="flex items-center gap-2 border-r border-blue-400/40 pr-4">
                        <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
                        <span className="text-sm font-bold text-white">
                            {selectedProductIds.length} SÉLECTIONNÉ(S)
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setBulkModal('supplier')}
                            className="px-3 py-1.5 bg-blue-800 hover:bg-blue-700 text-xs font-bold rounded-sm border border-blue-400 text-white transition-colors cursor-pointer"
                        >
                            Changer Fournisseur
                        </button>
                        <button
                            onClick={() => setBulkModal('category')}
                            className="px-3 py-1.5 bg-blue-800 hover:bg-blue-700 text-xs font-bold rounded-sm border border-blue-400 text-white transition-colors cursor-pointer"
                        >
                            Changer Catégorie
                        </button>
                        <button
                            onClick={handlePrintLabels}
                            className="px-3 py-1.5 bg-white text-[#001d35] hover:bg-gray-100 text-xs font-bold rounded-sm transition-colors cursor-pointer flex items-center gap-1"
                        >
                            <Printer className="w-3.5 h-3.5" /> Étiquettes
                        </button>
                        <button
                            onClick={handleBulkDelete}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-xs font-bold rounded-sm text-white transition-colors cursor-pointer flex items-center gap-1"
                        >
                            <Trash2 className="w-3.5 h-3.5" /> Supprimer
                        </button>
                    </div>

                    <button
                        onClick={() => setSelectedProductIds([])}
                        className="p-1 hover:bg-blue-800 rounded-sm text-blue-200 hover:text-white transition-colors ml-2"
                        title="Annuler la sélection"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Modales */}

            {isEntryModalOpen && selectedProduct && (
                <StockEntryModal
                    product={selectedProduct}
                    onClose={() => setIsEntryModalOpen(false)}
                    onSave={handleSaveSupply}
                />
            )}

            {isHistoryModalOpen && selectedProduct && (
                <StockHistoryModal
                    product={selectedProduct}
                    movements={getProductMovements(selectedProduct.id)}
                    onClose={() => setIsHistoryModalOpen(false)}
                />
            )}

            {packagingProduct && (
                <PackagingManagerModal
                    product={packagingProduct}
                    onClose={() => setPackagingProduct(null)}
                    onSave={handleSavePackaging}
                />
            )}

            {insightProduct && (
                <ProductInsightModal
                    product={insightProduct}
                    onClose={() => setInsightProduct(null)}
                />
            )}

            {detailProduct && (
                <ProductDetailModal
                    product={detailProduct}
                    onClose={() => setDetailProduct(null)}
                    onEdit={(p) => handleEditClick(p)}
                    onAddToCart={(p) => handleAddToCartSingle(p)}
                />
            )}

            {/* Modale d'action en masse */}
            {bulkModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-sm shadow-2xl w-full max-w-md p-6 border-2 border-gray-300">
                        <div className="flex justify-between items-start mb-5">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 uppercase">
                                    {bulkModal === 'supplier' && 'Modifier le fournisseur'}
                                    {bulkModal === 'category' && 'Modifier la catégorie'}
                                    {bulkModal === 'minStock' && 'Mettre à jour le stock minimum'}
                                </h3>
                                <p className="text-xs text-gray-500 mt-1">
                                    Impact sur <strong className="text-[#001d35]">{selectedProductIds.length} produit(s)</strong>
                                </p>
                            </div>
                            <button onClick={() => { setBulkModal(null); setBulkValue(''); }} className="p-1 hover:bg-gray-100 rounded-sm text-gray-500">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-1 mb-4 max-h-32 overflow-y-auto border border-gray-200 rounded-sm p-3 bg-gray-50 text-xs">
                            {products.filter(p => selectedProductIds.includes(p.id)).map(p => (
                                <div key={p.id} className="text-gray-700 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#001d35] flex-shrink-0" />
                                    {p.name}
                                </div>
                            ))}
                        </div>

                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                            {bulkModal === 'supplier' && 'Nouveau Fournisseur'}
                            {bulkModal === 'category' && 'Nouvelle Catégorie'}
                            {bulkModal === 'minStock' && 'Seuil Minimum (Unités)'}
                        </label>
                        <input
                            type={bulkModal === 'minStock' ? 'number' : 'text'}
                            value={bulkValue}
                            onChange={e => setBulkValue(e.target.value)}
                            placeholder={bulkModal === 'minStock' ? 'Ex: 10' : bulkModal === 'supplier' ? 'Ex: Cimco Togo' : 'Ex: Conserves'}
                            className="w-full p-2.5 border-2 border-gray-300 rounded-sm focus:outline-none focus:border-[#001d35] bg-gray-50 text-sm font-semibold mb-5"
                            autoFocus
                            onKeyDown={e => e.key === 'Enter' && handleBulkApply()}
                        />
                        <div className="flex gap-3">
                            <button 
                                onClick={() => { setBulkModal(null); setBulkValue(''); }}
                                className="flex-1 py-2.5 border border-gray-300 rounded-sm text-xs font-bold text-gray-700 hover:bg-gray-100 uppercase tracking-wider"
                            >
                                Annuler
                            </button>
                            <button 
                                onClick={handleBulkApply}
                                className="flex-1 py-2.5 bg-[#001d35] hover:bg-blue-800 text-white rounded-sm text-xs font-bold uppercase tracking-wider shadow-sm"
                            >
                                Appliquer
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Choix du Conditionnement / Déconditionnement (Exactement comme POS) */}
            {cartPackagingProduct && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div 
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150" 
                        onClick={() => setCartPackagingProduct(null)} 
                    />

                    {/* Modal Content */}
                    <div className="relative bg-white border-2 border-[#001d35] rounded-sm shadow-2xl w-full max-w-sm flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <div className="bg-[#001d35] px-4 py-3 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-white font-bold uppercase tracking-wider text-xs">
                                <ShoppingCart className="w-4 h-4 text-amber-400" />
                                <span>Choisir le Conditionnement</span>
                            </div>
                            <button 
                                onClick={() => setCartPackagingProduct(null)} 
                                className="text-white/80 hover:text-white transition-colors cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        
                        <div className="p-4 bg-slate-50 space-y-3">
                            <p className="text-xs font-bold text-slate-800 border-b border-slate-200 pb-2">
                                {cartPackagingProduct.name}
                            </p>

                            {/* Option 1: Unité de base */}
                            <button 
                                className="w-full text-left px-4 py-3 bg-white hover:bg-blue-50 border-2 border-slate-300 rounded-none flex justify-between items-center transition-colors shadow-2xs group cursor-pointer"
                                onClick={() => {
                                    addToCart(cartPackagingProduct, { type: 'base' });
                                    setCartPackagingProduct(null);
                                    T.cartAdd(cartPackagingProduct.name);
                                }}
                            >
                                <div>
                                    <span className="font-bold text-slate-800 group-hover:text-[#001d35] block text-xs">
                                        {cartPackagingProduct.unit || 'Unité'} (Entière)
                                    </span>
                                    <span className="text-[10px] text-slate-400">Conditionnement standard</span>
                                </div>
                                <span className="font-semibold text-[#001d35] text-[14px]">
                                    {formatPrice(cartPackagingProduct.price)}
                                </span>
                            </button>

                            {/* Option 2: À la pièce */}
                            {cartPackagingProduct.hasPiece && cartPackagingProduct.piecePrice && (
                                <button 
                                    className="w-full text-left px-4 py-3 bg-white hover:bg-blue-50 border-2 border-slate-300 rounded-none flex justify-between items-center transition-colors shadow-2xs group cursor-pointer"
                                    onClick={() => {
                                        addToCart(cartPackagingProduct, { type: 'piece' });
                                        setCartPackagingProduct(null);
                                        T.cartAdd(`Pièce de ${cartPackagingProduct.name}`);
                                    }}
                                >
                                    <div>
                                        <span className="font-bold text-slate-800 group-hover:text-[#001d35] block text-xs">
                                            À la pièce ({cartPackagingProduct.bulkUnit || getUnitModel(cartPackagingProduct.unit).subUnit || 'Pièce'})
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-medium">Prix unitaire à la pièce</span>
                                    </div>
                                    <span className="font-semibold text-[#001d35] text-[14px]">
                                        {formatPrice(cartPackagingProduct.piecePrice)}
                                    </span>
                                </button>
                            )}

                            {/* Option 3: Lots multiples ou Lot unique */}
                            {Array.isArray(cartPackagingProduct.lots) && cartPackagingProduct.lots.length > 0 ? (
                                cartPackagingProduct.lots.filter(l => parseFloat(l.price) > 0).map((l, lIdx) => (
                                    <button 
                                        key={l.id || lIdx}
                                        className="w-full text-left px-4 py-3 bg-white hover:bg-amber-50 border-2 border-slate-300 rounded-[4px] flex justify-between items-center transition-colors shadow-2xs group cursor-pointer"
                                        onClick={() => {
                                            addToCart(cartPackagingProduct, { 
                                                type: 'lot',
                                                price: parseFloat(l.price),
                                                targetQty: parseFloat(l.quantity),
                                                name: `Lot de ${l.quantity} ${cartPackagingProduct.bulkUnit || getUnitModel(cartPackagingProduct.unit).subUnit || 'Pièces'}`
                                            });
                                            setCartPackagingProduct(null);
                                            T.cartAdd(`Lot de ${l.quantity} de ${cartPackagingProduct.name}`);
                                        }}
                                    >
                                        <div>
                                            <span className="font-bold text-slate-800 group-hover:text-amber-600 block text-xs">
                                                Lot de ${l.quantity} ${cartPackagingProduct.bulkUnit || getUnitModel(cartPackagingProduct.unit).subUnit || 'Pièces'}
                                            </span>
                                            <span className="text-[10px] text-amber-600 font-medium">Option petit lot déconditionné</span>
                                        </div>
                                        <span className="font-semibold text-[#001d35] text-[14px]">
                                            {formatPrice(l.price)}
                                        </span>
                                    </button>
                                ))
                            ) : (cartPackagingProduct.hasLot && cartPackagingProduct.lotPrice ? (
                                <button 
                                    className="w-full text-left px-4 py-3 bg-white hover:bg-amber-50 border-2 border-slate-300 rounded-[4px] flex justify-between items-center transition-colors shadow-2xs group cursor-pointer"
                                    onClick={() => {
                                        addToCart(cartPackagingProduct, { type: 'lot' });
                                        setCartPackagingProduct(null);
                                        T.cartAdd(`Lot de ${cartPackagingProduct.name}`);
                                    }}
                                >
                                    <div>
                                        <span className="font-bold text-slate-800 group-hover:text-amber-600 block text-xs">
                                            Lot de {cartPackagingProduct.retailStepQuantity || 10} {cartPackagingProduct.bulkUnit || getUnitModel(cartPackagingProduct.unit).subUnit || 'Pièces'}
                                        </span>
                                        <span className="text-[10px] text-amber-600 font-medium">Prix au lot déconditionné</span>
                                    </div>
                                    <span className="font-semibold text-[#001d35] text-[14px]">
                                        {formatPrice(cartPackagingProduct.lotPrice)}
                                    </span>
                                </button>
                            ) : null)}

                            {/* Option 3: Conditionnements spécifiques (Cartons, Paquets, Rouleaux...) */}
                            {cartPackagingProduct.packagings?.map(pkg => (
                                <button 
                                    key={pkg.modelId} 
                                    className="w-full text-left px-4 py-3 bg-white hover:bg-blue-50 border-2 border-slate-300 rounded-none flex justify-between items-center transition-colors shadow-2xs group cursor-pointer"
                                    onClick={() => {
                                        addToCart(cartPackagingProduct, { type: 'packaging', ...pkg, name: pkg.name });
                                        setCartPackagingProduct(null);
                                        T.cartAdd(`${pkg.name} (${cartPackagingProduct.name})`);
                                    }}
                                >
                                    <div>
                                        <span className="font-bold text-slate-800 group-hover:text-[#001d35] block text-xs">
                                            {pkg.name}
                                        </span>
                                        <span className="text-[10px] text-slate-400">Déconditionnement spécifique</span>
                                    </div>
                                    <span className="font-semibold text-[#001d35] text-[14px]">
                                        {formatPrice(pkg.price)}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductList;
