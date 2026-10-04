import React, { useState, useEffect, useRef } from "react";
import { useInventory } from "../../context/InventoryContext";
import { useSales } from "../../context/SalesContext";
import { useSettings } from "../../context/SettingsContext";
import { useSession } from "../../context/SessionContext";
import { useAuth } from "../../context/AuthContext";
import { useDeliveries } from "../../context/DeliveryContext";
import { useNavigate } from "react-router-dom";
import {
    Search,
    X,
    RotateCcw,
    Trash2,
    Plus,
    Minus,
    ShoppingBag,
    CreditCard,
    Wallet,
    Users,
    CheckCircle2,
    FileText,
    Coins,
    Lock,
    AlertTriangle,
    ChevronDown,
    ShieldCheck,
    Boxes,
    Check
} from "lucide-react";
import Receipt from "../../components/Receipt";
import PaymentModal from "../../components/PaymentModal";
import FinancialInput from "../../components/FinancialInput";
import T from "../../utils/toast";
import { formatPrice } from "../../utils/currency";
import { getUnitModel, computeContainerStock, formatContainerStock } from "../../config/unitModels";

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
            className={`py-2.5 px-3 relative group border-r border-white/20 hover:bg-white/10 transition-colors select-none text-[10px] font-semibold uppercase tracking-wider text-white ${onClick ? 'cursor-pointer' : ''} ${className || ''}`}
            onClick={onClick}
        >
            <div className="flex items-center overflow-hidden whitespace-nowrap h-full">
                {children}
            </div>
            <div
                className={`absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-20 hover:bg-[#f77500]/60 ${isResizing ? 'bg-[#f77500]' : 'bg-transparent'}`}
                onMouseDown={handleMouseDown}
                onClick={(e) => e.stopPropagation()}
            ></div>
        </th>
    );
};

const POS = () => {
    const { products, deconditionModels, categories: categoriesList } = useInventory();
    const { stores, currentStoreId } = useSettings();
    const { activeSession, isOverdue } = useSession();
    const { user } = useAuth();
    const { createDeliveryNote } = useDeliveries();
    const navigate = useNavigate();
    const {
        cart,
        addToCart,
        removeFromCart,
        updateCartItem,
        completeSale,
        cartTotal,
        addQuote
    } = useSales();

    const [searchTerm, setSearchTerm] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("All");
    const [showReceipt, setShowReceipt] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [lastTransaction, setLastTransaction] = useState(null);
    const [openPackagingPicker, setOpenPackagingPicker] = useState(null);
    const [paymentMethod, setPaymentMethod] = useState(null);
    const [isSearching, setIsSearching] = useState(false);
    const [displayProducts, setDisplayProducts] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [amountReceived, setAmountReceived] = useState(0);
    const [discount, setDiscount] = useState(0);
    const [paymentError, setPaymentError] = useState(false);
    const [amountError, setAmountError] = useState(false);

    const effectiveDiscount = discount > 0 ? discount : 0;
    const finalTotal = Math.max(0, cartTotal - effectiveDiscount);

    const [colWidths, setColWidths] = useState({
        name: 300,
        price: 200,
        stock: 180,
        actions: 140
    });

    const [cartColWidths, setCartColWidths] = useState({
        name: 350,
        quantity: 140,
        priceHT: 140,
        tax: 90,
        priceTTC: 140,
        totalTTC: 140,
        actions: 70
    });

    // Références pour la gestion du scanner code-barres / douchette
    const searchInputRef = useRef(null);
    const barcodeBufferRef = useRef({ buffer: '', lastKeyTime: 0 });

    // ── Loader d'entrée de page (scroll top + 1,5s) Identique à Réapprovisionnement ──
    const [isPageLoading, setIsPageLoading] = useState(true);
    const pageLoadTimerRef = useRef(null);

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
        pageLoadTimerRef.current = setTimeout(() => {
            setIsPageLoading(false);
            searchInputRef.current?.focus();
        }, 1500);
        return () => {
            if (pageLoadTimerRef.current) clearTimeout(pageLoadTimerRef.current);
        };
    }, []);

    const handleResize = (columnId, newWidth) => {
        setColWidths(prev => ({
            ...prev,
            [columnId]: newWidth
        }));
    };

    const handleCartResize = (columnId, newWidth) => {
        setCartColWidths(prev => ({
            ...prev,
            [columnId]: newWidth
        }));
    };

    /**
     * Traite un code scanné : recherche par code-barre exact
     * et ajout direct au panier avec feedback sonore/visuel.
     */
    const handleBarcodeScanned = (barcodeStr) => {
        const code = (barcodeStr || "").trim();
        if (!code) return false;

        const exactProduct = products.find(
            (p) => p.barcode && p.barcode.trim().toLowerCase() === code.toLowerCase()
        );

        if (exactProduct) {
            if (exactProduct.packagings?.length > 0 || exactProduct.hasLot || exactProduct.hasPiece) {
                setOpenPackagingPicker(exactProduct.id);
            } else {
                addToCart(exactProduct, { type: 'base' });
                T.cartAdd(exactProduct.name);
            }
            setSearchTerm("");
            setDisplayProducts([]);
            setTimeout(() => {
                searchInputRef.current?.focus();
            }, 60);
            return true;
        }

        return false;
    };

    // ── Détecteur de Douchette Global (Scan n'importe où sur l'écran) ───
    useEffect(() => {
        const handleGlobalKeyDown = (e) => {
            // Ignorer raccourcis système (Ctrl+C, Alt+Tab, etc.)
            if (e.ctrlKey || e.altKey || e.metaKey) return;

            const targetTag = e.target?.tagName;
            const isOtherInput = (targetTag === 'INPUT' && e.target !== searchInputRef.current) || targetTag === 'TEXTAREA' || targetTag === 'SELECT';

            const now = Date.now();
            const diff = now - barcodeBufferRef.current.lastKeyTime;

            // Si l'intervalle dépasse 100ms, c'est une frappe humaine lente -> réinitialiser le tampon
            if (diff > 100) {
                barcodeBufferRef.current.buffer = '';
            }
            barcodeBufferRef.current.lastKeyTime = now;

            if (e.key === 'Enter') {
                const buffer = barcodeBufferRef.current.buffer.trim();
                barcodeBufferRef.current.buffer = '';

                // Si un code scanné rapidement contient au moins 3 caractères
                if (buffer.length >= 3) {
                    const matched = handleBarcodeScanned(buffer);
                    if (matched) {
                        e.preventDefault();
                        e.stopPropagation();
                        return;
                    }
                }
                return;
            }

            // Ne pas accumuler si l'utilisateur saisit manuellement dans un autre champ (ex: montant perçu, remise)
            if (isOtherInput) return;

            if (e.key.length === 1) {
                barcodeBufferRef.current.buffer += e.key;
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown, true);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown, true);
    }, [products]);

    // ── Debounced Search Logic ────────────────────────────────────────
    useEffect(() => {
        if (searchTerm.trim() === "" && selectedCategory === 'All') {
            setDisplayProducts([]);
            setIsSearching(false);
            return;
        }

        setIsSearching(true);
        const handler = setTimeout(() => {
            const filtered = products.filter(
                (p) =>
                    (selectedCategory === 'All' || p.category === selectedCategory) &&
                    (p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        p.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (p.barcode && p.barcode.toLowerCase().includes(searchTerm.toLowerCase())))
            );
            setDisplayProducts(filtered);
            setIsSearching(false);
        }, 300);

        return () => clearTimeout(handler);
    }, [searchTerm, selectedCategory, products]);

    const handleSearchKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const code = searchTerm.trim();
            if (!code) return;

            // 1. Recherche par correspondance exacte de code-barre (douchette directe dans le champ)
            if (handleBarcodeScanned(code)) {
                return;
            }

            // 2. Si un seul résultat est présent dans les résultats filtrés
            if (displayProducts.length === 1) {
                const single = displayProducts[0];
                if (single.packagings?.length > 0 || single.hasLot || single.hasPiece) {
                    setOpenPackagingPicker(single.id);
                } else {
                    addToCart(single, { type: 'base' });
                    T.cartAdd(single.name);
                }
                setSearchTerm("");
                setDisplayProducts([]);
                searchInputRef.current?.focus();
                return;
            }

            // 3. Avertissement si format code-barre introuvable
            if (/^\d{6,14}$/.test(code)) {
                T.warning(`Code-barres "${code}" non trouvé dans le catalogue.`);
            }
        }
    };

    const categories = ['All', ...new Set([...(categoriesList || []).map(c => c.name), ...products.map(p => p.category)].filter(Boolean))];

    const highlightText = (text, highlight) => {
        if (!highlight.trim()) return text;
        const regex = new RegExp(`(${highlight})`, 'gi');
        const parts = text.split(regex);
        return (
            <>
                {parts.map((part, i) =>
                    regex.test(part) ? (
                        <mark key={i} className="bg-amber-100 text-amber-900 px-0.5 rounded-[2px] font-bold">{part.toUpperCase()}</mark>
                    ) : (
                        <span key={i}>{part.toUpperCase()}</span>
                    )
                )}
            </>
        );
    };

    const handleCheckout = async (preSelected = null) => {
        if (cart.length === 0) return;
        if (preSelected) setPaymentMethod(preSelected);
        setShowPaymentModal(true);
    };

    const handleConfirmPayment = async (paymentData) => {
        try {
            setIsProcessing(true);
            const cashierDisplayName = activeSession?.cashierName || (user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : (user?.name || user?.username || 'Caissier'));

            const transaction = await completeSale({
                ...paymentData,
                method: paymentData.method || 'cash',
                amountGiven: paymentData.amountGiven,
                change: paymentData.change,
                changeDue: paymentData.changeDue,
                changeReliquat: paymentData.changeReliquat,
                total: finalTotal,
                discount: effectiveDiscount,
                customerName: paymentData.customerName,
                customerPhone: paymentData.customerPhone,
                clientId: paymentData.clientId,
                siteName: paymentData.siteName,
                cashier: cashierDisplayName,
                cashierName: cashierDisplayName
            });

            if (paymentData.appliedCreditNote) {
                transaction.appliedCreditNote = paymentData.appliedCreditNote;
            }

            // Si mode Bon à Enlever au Dépôt -> Création automatique dans DeliveryContext
            if (paymentData.deliveryMode === 'warehouse') {
                const deliveryNote = createDeliveryNote(transaction, {
                    ...paymentData.deliveryInfo,
                    siteName: paymentData.siteName || paymentData.deliveryInfo?.siteName
                });
                transaction.deliveryNoteReference = deliveryNote.reference;
                transaction.deliveryNote = deliveryNote;
                transaction.deliveryMode = 'warehouse';
            }

            setLastTransaction(transaction);
            setShowPaymentModal(false);
            setShowReceipt(true);
            setAmountReceived(0);
            setDiscount(0);
            setPaymentMethod(null);
            T.paymentSuccess();
        } catch (error) {
            console.error("Erreur lors de la vente:", error);
            T.error("Erreur lors de l'enregistrement de la vente");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSaveQuote = () => {
        const customerName = prompt("Nom du client pour le devis :");
        if (customerName) {
            addQuote(customerName);
            T.saved("Devis enregistré avec succès !");
        }
    };

    // ── Écran si caisse non ouverte ──
    if (!activeSession) {
        return (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-5.5rem)] gap-4 font-sans pb-10">
                <div className="bg-white p-8 rounded-[4px] border-2 border-gray-300 shadow-sm text-center max-w-md w-full relative overflow-hidden">
                    <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-200">
                        <Lock className="w-8 h-8 text-[#001d35]" />
                    </div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Point de Vente & Caisse</p>
                    <h3 className="text-base sm:text-lg font-bold text-[#001d35] tracking-tight mb-2">Caisse Verrouillée</h3>
                    <p className="text-xs text-gray-500 font-normal mb-6 px-2">Vous devez obligatoirement ouvrir une session de caisse pour pouvoir enregistrer des ventes.</p>
                    <button
                        type="button"
                        onClick={() => navigate('/sessions')}
                        className="w-full py-2.5 bg-[#001d35] hover:bg-[#00284a] text-white font-semibold text-xs uppercase tracking-wider rounded-[4px] shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                    >
                        <CheckCircle2 className="w-4 h-4 text-[#f77500]" />
                        <span>Ouvrir une Session de Caisse</span>
                    </button>
                </div>
            </div>
        );
    }

    // ── Écran si session en retard de clôture ──
    if (activeSession && isOverdue) {
        return (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-5.5rem)] gap-4 font-sans pb-10">
                <div className="bg-white p-8 rounded-[4px] border-2 border-gray-300 shadow-sm text-center max-w-md w-full relative overflow-hidden">
                    <div className="bg-amber-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-300 animate-pulse">
                        <AlertTriangle className="w-8 h-8 text-amber-600" />
                    </div>
                    <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider mb-1">Session En Attente de Clôture</p>
                    <h3 className="text-base sm:text-lg font-bold text-[#001d35] tracking-tight mb-2">Session Non Clôturée</h3>
                    <p className="text-xs text-gray-500 font-normal mb-6 px-2">
                        La session ouverte le <strong className="text-gray-900 font-semibold">{new Date(activeSession.startTime).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</strong> à <strong className="text-gray-900 font-semibold">{new Date(activeSession.startTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</strong> par <strong className="text-gray-900 font-semibold">{activeSession.cashierName}</strong> n'a pas été fermée.<br/><br/>
                        Vous devez obligatoirement la clôturer avant de pouvoir faire de nouvelles ventes.
                    </p>
                    <button
                        type="button"
                        onClick={() => navigate('/sessions')}
                        className="w-full py-2.5 bg-[#001d35] hover:bg-[#00284a] text-white font-semibold text-xs uppercase tracking-wider rounded-[4px] shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                    >
                        <RotateCcw className="w-4 h-4 text-[#f77500]" />
                        <span>Clôturer la Session Précédente</span>
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="h-[calc(100vh-5.5rem)] flex flex-col space-y-2.5 font-sans overflow-hidden">

            {/* ── BARRE DE RECHERCHE ET SÉLECTEUR DE RAYONS (STYLE INVENTAIRE PHYSIQUE) ── */}
            <div className="bg-white p-2.5 rounded-[4px] border-2 border-gray-300 shadow-sm shrink-0">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                    <div className="flex flex-wrap items-center gap-2 flex-1 justify-start">
                        {/* Recherche texte / Code-barres */}
                        <div className="relative flex-1 min-w-[240px] max-w-lg">
                            {isSearching ? (
                                <div className="absolute left-2.5 top-1/2 -translate-y-1/2">
                                    <div className="w-3.5 h-3.5 border-2 border-[#001d35]/30 border-t-[#001d35] rounded-full animate-spin"></div>
                                </div>
                            ) : (
                                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                            )}
                            <input
                                ref={searchInputRef}
                                type="text"
                                placeholder="Rechercher par article, réf, code-barres (douchette)..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onKeyDown={handleSearchKeyDown}
                                autoFocus
                                className="w-full pl-8 pr-8 py-1.5 text-xs border border-gray-300 rounded-[4px] focus:outline-none focus:ring-1 focus:ring-[#001d35] bg-white font-normal text-gray-800"
                            />
                            {searchTerm && (
                                <button
                                    type="button"
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                                    title="Effacer la recherche"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        {/* Filtre Catégorie / Rayon */}
                        <select
                            value={selectedCategory || 'All'}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="px-2.5 py-1.5 text-xs border border-gray-300 rounded-[4px] bg-white font-normal text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#001d35]"
                        >
                            <option value="All">Toutes les catégories / rayons</option>
                            {categories.filter(c => c !== 'All').map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                        <button
                            type="button"
                            onClick={() => navigate('/sales/returns')}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-[4px] border border-gray-300 hover:bg-gray-50 text-gray-700 transition-all cursor-pointer shadow-2xs active:scale-95"
                            title="Gérer les retours d'articles et bons d'avoir"
                        >
                            <RotateCcw className="w-3.5 h-3.5 text-[#001d35]" />
                            <span>Retours & Avoirs</span>
                        </button>

                        {(searchTerm || selectedCategory !== 'All') && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearchTerm('');
                                    setSelectedCategory('All');
                                }}
                                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:text-red-700 hover:bg-red-50 rounded-[4px] border border-gray-200 transition-colors cursor-pointer"
                                title="Réinitialiser la recherche"
                            >
                                <RotateCcw className="w-3 h-3" />
                                <span>Effacer filtres</span>
                            </button>
                        )}
                        <span className="text-[11px] font-semibold text-gray-600 bg-gray-100 px-3 py-1.5 rounded-[4px] border border-gray-200">
                            Panier : {cart.length} article(s)
                        </span>
                    </div>
                </div>
            </div>

            {/* ── ZONE CENTRALE : TABLEAU DU PANIER + MODALE RÉSULTATS RECHERCHE ── */}
            <div className="bg-white border-2 border-gray-300 rounded-[4px] shadow-sm overflow-hidden flex flex-col flex-1 min-h-0 relative">

                {/* ── Dropdown / Liste des résultats de recherche (flottant) ── */}
                {(searchTerm || selectedCategory !== 'All') && (
                    <div className="absolute top-0 left-2 right-2 z-30 bg-white border-2 border-gray-300 shadow-xl rounded-[4px] max-h-[62vh] flex flex-col animate-in fade-in duration-150">
                        {/* Header résultats */}
                        <div className="p-2.5 bg-[#001d35] text-white border-b-2 border-[#f77500] flex items-center justify-between gap-2 shrink-0">
                            <div className="flex items-center gap-2">
                                <Search className="w-4 h-4 text-[#f77500]" />
                                <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
                                    Résultats du Catalogue ({displayProducts.length} article{displayProducts.length > 1 ? 's' : ''})
                                </h4>
                            </div>
                            <button
                                type="button"
                                onClick={() => { setSearchTerm(''); setSelectedCategory('All'); }}
                                className="text-white/80 hover:text-white transition-colors cursor-pointer p-0.5 rounded-[4px] hover:bg-white/10"
                                title="Fermer la liste"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Tableau résultats */}
                        <div className={`overflow-y-auto max-h-[50vh] transition-opacity duration-150 ${isSearching ? 'opacity-40' : 'opacity-100'}`}>
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-[#001d35] text-white font-semibold uppercase tracking-wider text-[10px] divide-x divide-white/20 sticky top-0 z-10 shadow-xs">
                                        <ResizableHeader columnId="name" width={colWidths.name} onResize={handleResize}>Désignation & Réf</ResizableHeader>
                                        <ResizableHeader columnId="price" width={colWidths.price} onResize={handleResize}>Tarification</ResizableHeader>
                                        <ResizableHeader columnId="stock" width={colWidths.stock} onResize={handleResize}>Stock Disponible</ResizableHeader>
                                        <th style={{ width: `${colWidths.actions}px`, minWidth: `${colWidths.actions}px` }} className="py-2.5 px-3 text-right text-[10px] font-semibold uppercase tracking-wider text-white">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {displayProducts.length === 0 ? (
                                        <tr>
                                            <td colSpan="4" className="py-10 text-center text-gray-500">
                                                <Boxes className="w-8 h-8 mx-auto text-gray-400 mb-1 opacity-60" />
                                                <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Aucun produit trouvé</p>
                                                <p className="text-[11px] text-gray-500 mt-0.5">Vérifiez l'orthographe ou le code-barres scanné.</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        displayProducts.map((product) => {
                                            const stockQty = product.stockLevels?.[currentStoreId] || 0;
                                            const isLow = stockQty <= (product.minStockLevels?.[currentStoreId] || product.minStock || 0);

                                            return (
                                                <tr key={product.id} className="transition-colors border-b border-gray-200 hover:bg-blue-50/60 bg-white">
                                                    {/* Produit */}
                                                    <td className="py-2.5 px-3">
                                                        <div className="font-semibold text-gray-900 text-xs">
                                                            {highlightText(product.name || '', searchTerm)}
                                                        </div>
                                                        <div className="text-[10px] text-gray-400 font-normal flex items-center gap-1.5 mt-0.5">
                                                            <span>{product.category}</span>
                                                            {product.barcode && (
                                                                <>
                                                                    <span className="text-gray-300">&bull;</span>
                                                                    <span className="font-mono text-gray-600 bg-gray-100 px-1 py-0.2 rounded-[2px] border border-gray-200">
                                                                        {product.barcode}
                                                                    </span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* Prix */}
                                                    <td className="py-2.5 px-3">
                                                        <div className="font-semibold text-[#001d35] text-xs">
                                                            {formatPrice(product.price)} <span className="text-gray-400 text-[10px] font-normal">/ {product.unit || 'Unité'}</span>
                                                        </div>
                                                        {(product.hasPiece || product.hasLot || product.packagings?.length > 0) && (
                                                            <div className="flex flex-wrap items-center gap-1 mt-1">
                                                                {product.hasPiece && product.piecePrice && (
                                                                    <span className="text-[9px] font-semibold flex items-center gap-1 bg-blue-50 text-blue-800 px-1.5 py-0.5 rounded-[3px] border border-blue-200">
                                                                        {formatPrice(product.piecePrice)} / {product.bulkUnit || getUnitModel(product.unit).subUnit || 'Pièce'}
                                                                    </span>
                                                                )}
                                                                {product.hasLot && product.lotPrice && (
                                                                    <span className="text-[9px] font-semibold flex items-center gap-1 bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded-[3px] border border-amber-200">
                                                                        {formatPrice(product.lotPrice)} / Lot {product.retailStepQuantity || 10}
                                                                    </span>
                                                                )}
                                                                {product.packagings?.map(pkg => (
                                                                    <span key={pkg.modelId} className="text-[9px] font-semibold flex items-center gap-1 bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded-[3px] border border-slate-200 uppercase">
                                                                        {formatPrice(pkg.price)} / {pkg.name}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </td>

                                                    {/* Stock */}
                                                    <td className="py-2.5 px-3">
                                                        {(() => {
                                                            const cf = parseFloat(product.conversionFactor) || 1;
                                                            const isContainer = (product.unitArchetype === 'BOX' || product.unitArchetype === 'BULK') && cf > 1;
                                                            const subUnit = product.bulkUnit || getUnitModel(product.unit).subUnit;
                                                            return (
                                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                                    <span className={`px-2 py-0.5 rounded-[3px] text-xs font-bold border ${isLow ? 'bg-rose-50 text-rose-800 border-rose-300' : 'bg-emerald-50 text-emerald-800 border-emerald-300'}`}>
                                                                        {isContainer 
                                                                            ? formatContainerStock(stockQty, cf, product.unit, subUnit)
                                                                            : `${stockQty.toLocaleString('fr-FR')} ${product.unit || ''}`
                                                                        }
                                                                    </span>
                                                                    {isContainer && subUnit && (
                                                                        <span className="text-[10px] text-gray-500 font-medium">
                                                                            ≈ {computeContainerStock(stockQty, cf).exactTotalSubUnits.toLocaleString('fr-FR')} {subUnit}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            );
                                                        })()}
                                                    </td>

                                                    {/* Action Ajouter */}
                                                    <td className="py-2.5 px-3 text-right">
                                                        {product.packagings?.length > 0 || product.hasLot || product.hasPiece ? (
                                                            <div className="relative inline-block text-left ml-auto">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setOpenPackagingPicker(openPackagingPicker === product.id ? null : product.id)}
                                                                    disabled={stockQty <= 0}
                                                                    className="px-2.5 py-1 bg-[#001d35] hover:bg-[#00284a] text-white rounded-[4px] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer text-xs font-semibold ml-auto"
                                                                >
                                                                    <Boxes className="w-3.5 h-3.5 text-[#f77500]" />
                                                                    <span>Options</span>
                                                                    <ChevronDown className="w-3 h-3 text-gray-300" />
                                                                </button>

                                                                {openPackagingPicker === product.id && (
                                                                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                                                                        <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={(e) => { e.stopPropagation(); setOpenPackagingPicker(null); }}></div>

                                                                        <div className="relative bg-white border-2 border-[#001d35] rounded-[4px] shadow-2xl w-full max-w-sm flex flex-col overflow-hidden animate-in fade-in duration-150">
                                                                            <div className="bg-[#001d35] px-4 py-2.5 flex items-center justify-between border-b-2 border-[#f77500]">
                                                                                <span className="text-white font-bold uppercase tracking-wider text-xs">Options de Vente : {product.name}</span>
                                                                                <button type="button" onClick={(e) => { e.stopPropagation(); setOpenPackagingPicker(null); }} className="text-white hover:text-[#f77500] transition-colors cursor-pointer">
                                                                                    <X className="w-4 h-4" />
                                                                                </button>
                                                                            </div>

                                                                            <div className="p-3 flex flex-col gap-2 bg-slate-50 max-h-[70vh] overflow-y-auto">
                                                                                {/* Option Unité standard */}
                                                                                <button
                                                                                    type="button"
                                                                                    className="w-full text-left px-3.5 py-2.5 text-xs bg-white hover:bg-blue-50/60 border border-gray-300 rounded-[4px] flex justify-between items-center transition-colors shadow-2xs group cursor-pointer"
                                                                                    onClick={(e) => { e.stopPropagation(); addToCart(product, { type: 'base' }); setOpenPackagingPicker(null); T.cartAdd(product.name); }}
                                                                                >
                                                                                    <span className="font-semibold text-gray-800 group-hover:text-[#001d35]">{product.unit || 'Unité'} (Entière)</span>
                                                                                    <span className="text-[#001d35] font-bold text-xs">{formatPrice(product.price)}</span>
                                                                                </button>

                                                                                {/* Option Pièce */}
                                                                                {product.hasPiece && product.piecePrice && (
                                                                                    <button
                                                                                        type="button"
                                                                                        className="w-full text-left px-3.5 py-2.5 text-xs bg-white hover:bg-blue-50/60 border border-gray-300 rounded-[4px] flex justify-between items-center transition-colors shadow-2xs group cursor-pointer"
                                                                                        onClick={(e) => { e.stopPropagation(); addToCart(product, { type: 'piece' }); setOpenPackagingPicker(null); T.cartAdd(`Pièce de ${product.name}`); }}
                                                                                    >
                                                                                        <span className="font-semibold text-gray-800 group-hover:text-[#001d35]">À la pièce ({product.bulkUnit || getUnitModel(product.unit).subUnit || 'Pièce'})</span>
                                                                                        <span className="text-[#001d35] font-bold text-xs">{formatPrice(product.piecePrice)}</span>
                                                                                    </button>
                                                                                )}

                                                                                {/* Option Lots */}
                                                                                {Array.isArray(product.lots) && product.lots.length > 0 ? (
                                                                                    product.lots.filter(l => parseFloat(l.price) > 0).map((l, lIdx) => (
                                                                                        <button
                                                                                            key={l.id || lIdx}
                                                                                            type="button"
                                                                                            className="w-full text-left px-3.5 py-2.5 text-xs bg-white hover:bg-amber-50/60 border border-amber-300 rounded-[4px] flex justify-between items-center transition-colors shadow-2xs group cursor-pointer"
                                                                                            onClick={(e) => { 
                                                                                                e.stopPropagation(); 
                                                                                                addToCart(product, { 
                                                                                                    type: 'lot', 
                                                                                                    price: parseFloat(l.price), 
                                                                                                    targetQty: parseFloat(l.quantity), 
                                                                                                    name: `Lot de ${l.quantity} ${product.bulkUnit || getUnitModel(product.unit).subUnit || 'Pièces'}` 
                                                                                                }); 
                                                                                                setOpenPackagingPicker(null); 
                                                                                                T.cartAdd(`Lot de ${l.quantity} de ${product.name}`); 
                                                                                            }}
                                                                                        >
                                                                                            <span className="font-semibold text-gray-800 group-hover:text-amber-700">Lot de {l.quantity} {product.bulkUnit || getUnitModel(product.unit).subUnit || 'Pièces'}</span>
                                                                                            <span className="text-amber-800 font-bold text-xs">{formatPrice(l.price)}</span>
                                                                                        </button>
                                                                                    ))
                                                                                ) : (product.hasLot && product.lotPrice ? (
                                                                                    <button
                                                                                        type="button"
                                                                                        className="w-full text-left px-3.5 py-2.5 text-xs bg-white hover:bg-amber-50/60 border border-amber-300 rounded-[4px] flex justify-between items-center transition-colors shadow-2xs group cursor-pointer"
                                                                                        onClick={(e) => { e.stopPropagation(); addToCart(product, { type: 'lot' }); setOpenPackagingPicker(null); T.cartAdd(`Lot de ${product.name}`); }}
                                                                                    >
                                                                                        <span className="font-semibold text-gray-800 group-hover:text-amber-700">Lot de {product.retailStepQuantity || 10} {product.bulkUnit || getUnitModel(product.unit).subUnit || 'Pièces'}</span>
                                                                                        <span className="text-amber-800 font-bold text-xs">{formatPrice(product.lotPrice)}</span>
                                                                                    </button>
                                                                                ) : null)}

                                                                                {/* Option Déconditionnement */}
                                                                                {product.packagings?.map(pkg => (
                                                                                    <button
                                                                                        key={pkg.modelId || pkg.id}
                                                                                        type="button"
                                                                                        className="w-full text-left px-3.5 py-2.5 text-xs bg-white hover:bg-blue-50/60 border border-gray-300 rounded-[4px] flex justify-between items-center transition-colors shadow-2xs group cursor-pointer"
                                                                                        onClick={(e) => { e.stopPropagation(); addToCart(product, { type: 'packaging', ...pkg, name: pkg.name }); setOpenPackagingPicker(null); T.cartAdd(pkg.name); }}
                                                                                    >
                                                                                        <span className="font-semibold text-gray-800 group-hover:text-[#001d35]">{pkg.name}</span>
                                                                                        <span className="text-[#001d35] font-bold text-xs">{formatPrice(pkg.price)}</span>
                                                                                    </button>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => { addToCart(product); T.cartAdd(product.name); }}
                                                                disabled={stockQty <= 0}
                                                                className="px-2.5 py-1 bg-[#001d35] hover:bg-[#00284a] text-white rounded-[4px] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all shadow-2xs flex items-center gap-1.5 ml-auto text-xs font-semibold"
                                                            >
                                                                <Plus className="w-3.5 h-3.5 text-[#f77500]" />
                                                                <span>Ajouter</span>
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ── SOUS-BARRE ENTÊTE DU PANIER (STYLE FEUILLE DE POINTAGE INVENTAIRE) ── */}
                <div className="p-2.5 bg-slate-50 border-b-2 border-gray-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
                    <div className="flex items-center gap-2">
                        <ShoppingBag className="w-4 h-4 text-[#001d35]" />
                        <h4 className="text-xs font-semibold text-[#001d35] uppercase tracking-wider">
                            Panier de Vente Actuel
                        </h4>
                    </div>
                    <div className="text-xs text-gray-600 font-medium">
                        Articles enregistrés : <strong className="text-gray-900 font-semibold">{cart.length} référence{cart.length > 1 ? 's' : ''}</strong>
                    </div>
                </div>

                {/* ── TABLEAU PRINCIPAL DU PANIER ── */}
                <div className="flex-1 overflow-y-auto bg-white min-h-[180px]">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr className="bg-[#001d35] text-white font-semibold uppercase tracking-wider text-[10px] divide-x divide-white/20 sticky top-0 z-10 shadow-xs">
                                <ResizableHeader columnId="name" width={cartColWidths.name} onResize={handleCartResize}>Désignation de l'Article</ResizableHeader>
                                <ResizableHeader columnId="quantity" width={cartColWidths.quantity} onResize={handleCartResize} className="text-center">Quantité</ResizableHeader>
                                <ResizableHeader columnId="priceHT" width={cartColWidths.priceHT} onResize={handleCartResize} className="text-right">Prix Unitaire HT</ResizableHeader>
                                <ResizableHeader columnId="tax" width={cartColWidths.tax} onResize={handleCartResize} className="text-center">Taxe (0%)</ResizableHeader>
                                <ResizableHeader columnId="priceTTC" width={cartColWidths.priceTTC} onResize={handleCartResize} className="text-right">Prix TTC</ResizableHeader>
                                <ResizableHeader columnId="totalTTC" width={cartColWidths.totalTTC} onResize={handleCartResize} className="text-right">Total Net TTC</ResizableHeader>
                                <th style={{ width: `${cartColWidths.actions}px`, minWidth: `${cartColWidths.actions}px` }} className="py-2.5 px-3 text-center text-[10px] font-semibold uppercase tracking-wider text-white">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {cart.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="py-16 text-center text-gray-500 bg-white">
                                        <ShoppingBag className="w-12 h-12 mx-auto text-gray-400 mb-2 opacity-60" />
                                        <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                            Panier de Vente Vide
                                        </h3>
                                        <p className="text-[11px] text-gray-500 mt-1 max-w-md mx-auto font-normal">
                                            Scannez un code-barres avec la douchette ou utilisez la barre de recherche ci-dessus pour ajouter des articles à la commande.
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                cart.map((item) => {
                                    const priceTTC = item.price;
                                    const priceHT = priceTTC;
                                    const totalTTC = priceTTC * item.inputQuantity;

                                    return (
                                        <tr key={item.cartKey} className="transition-colors border-b border-gray-200 hover:bg-blue-50/60 bg-white">
                                            {/* Produit */}
                                            <td className="py-2.5 px-3">
                                                <div className="font-semibold text-gray-900 text-xs">
                                                    {item.name}
                                                </div>
                                                {item.label && (
                                                    <div className="mt-0.5">
                                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-[3px] bg-slate-100 text-slate-800 border border-slate-200 text-[10px] font-semibold uppercase tracking-wider">
                                                            {item.label}
                                                        </span>
                                                    </div>
                                                )}
                                            </td>

                                            {/* Quantité (Stepper identique à Inventaire Physique) */}
                                            <td className="py-2 px-3 text-center">
                                                <div className="inline-flex items-center border border-gray-300 rounded-[4px] overflow-hidden bg-white shadow-2xs">
                                                    <button
                                                        type="button"
                                                        onClick={() => updateCartItem(item.cartKey, { inputQuantity: Math.max(1, item.inputQuantity - 1) })}
                                                        className="w-6 h-6 flex items-center justify-center bg-gray-50 hover:bg-gray-100 text-gray-600 font-medium text-xs cursor-pointer select-none border-r border-gray-200 transition-colors"
                                                        title="Diminuer la quantité"
                                                    >
                                                        −
                                                    </button>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={item.inputQuantity}
                                                        onChange={(e) => updateCartItem(item.cartKey, { inputQuantity: Math.max(1, parseFloat(e.target.value) || 0) })}
                                                        className="w-12 text-center font-semibold text-xs py-0.5 text-[#001d35] focus:outline-none"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => updateCartItem(item.cartKey, { inputQuantity: item.inputQuantity + 1 })}
                                                        className="w-6 h-6 flex items-center justify-center bg-gray-50 hover:bg-gray-100 text-gray-600 font-medium text-xs cursor-pointer select-none border-l border-gray-200 transition-colors"
                                                        title="Augmenter la quantité"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            </td>

                                            {/* Prix HT */}
                                            <td className="py-2.5 px-3 text-right font-semibold text-gray-600 text-xs">
                                                {formatPrice(priceHT)}
                                            </td>

                                            {/* Taxe */}
                                            <td className="py-2.5 px-3 text-center text-gray-400 font-normal text-xs">
                                                0 F CFA
                                            </td>

                                            {/* Prix TTC */}
                                            <td className="py-2.5 px-3 text-right font-semibold text-[#001d35] text-xs">
                                                {formatPrice(priceTTC)}
                                            </td>

                                            {/* Total Net TTC */}
                                            <td className="py-2.5 px-3 text-right font-bold text-xs">
                                                <span className="px-2 py-0.5 bg-slate-100 text-[#001d35] rounded-[3px] border border-gray-200 font-bold">
                                                    {formatPrice(totalTTC)}
                                                </span>
                                            </td>

                                            {/* Suppression */}
                                            <td className="py-2.5 px-3 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => removeFromCart(item.cartKey)}
                                                    className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-[4px] transition-all cursor-pointer mx-auto"
                                                    title="Supprimer du panier"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* ── Double Ring Spinner Overlay pendant validation ── */}
                {isProcessing && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/75 backdrop-blur-xs animate-in fade-in duration-150">
                        <div className="flex flex-col items-center gap-3 bg-white px-8 py-6 rounded-[4px] shadow-xl border-2 border-gray-300">
                            <div className="relative h-10 w-10">
                                <div className="absolute inset-0 animate-spin rounded-full border-4 border-gray-200 border-t-[#001d35]"></div>
                                <div className="absolute inset-1.5 animate-spin-reverse rounded-full border-2 border-transparent border-b-[#f77500]"></div>
                            </div>
                            <div className="text-center">
                                <p className="text-xs font-semibold text-[#001d35] uppercase tracking-wider">Traitement de l'encaissement...</p>
                                <p className="text-[11px] text-gray-500 mt-0.5 font-medium">Génération du reçu et mise à jour des stocks</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ── PIED DE PAGE FINANCIER HARMONISÉ (MODULES STYLE INVENTAIRE PHYSIQUE) ── */}
            <div className="bg-white border-2 border-gray-300 rounded-[4px] shadow-sm p-3 grid grid-cols-1 md:grid-cols-4 gap-3 shrink-0">

                {/* 1. Moyen de Paiement */}
                <div className={`p-2.5 rounded-[4px] border ${paymentError ? 'border-rose-400 bg-rose-50/60' : 'border-gray-200 bg-slate-50/70'} flex flex-col justify-between`}>
                    <div className="flex items-center gap-1.5 pb-1.5 border-b border-gray-200">
                        <Wallet className="w-3.5 h-3.5 text-[#001d35]" />
                        <h4 className="text-[11px] font-semibold text-[#001d35] uppercase tracking-wider">Moyen de Paiement</h4>
                    </div>

                    <div className="flex flex-col gap-1 mt-1.5">
                        <label className={`flex items-center gap-2 px-2 py-1 rounded-[3px] border cursor-pointer transition-colors text-xs font-semibold ${
                            paymentMethod === 'cash' 
                                ? 'bg-[#001d35] text-white border-[#001d35]' 
                                : 'bg-white hover:bg-gray-100 text-gray-700 border-gray-200'
                        }`}>
                            <input
                                type="checkbox"
                                checked={paymentMethod === 'cash'}
                                onChange={() => { setPaymentMethod('cash'); setPaymentError(false); setAmountError(false); }}
                                className="w-3.5 h-3.5 rounded-[2px] accent-[#f77500] cursor-pointer"
                            />
                            <Coins className="w-3.5 h-3.5 text-current" />
                            <span>Espèces (Cash)</span>
                        </label>

                        <label className={`flex items-center gap-2 px-2 py-1 rounded-[3px] border cursor-pointer transition-colors text-xs font-semibold ${
                            paymentMethod === 'card' 
                                ? 'bg-[#001d35] text-white border-[#001d35]' 
                                : 'bg-white hover:bg-gray-100 text-gray-700 border-gray-200'
                        }`}>
                            <input
                                type="checkbox"
                                checked={paymentMethod === 'card'}
                                onChange={() => { setPaymentMethod('card'); setPaymentError(false); setAmountError(false); }}
                                className="w-3.5 h-3.5 rounded-[2px] accent-[#f77500] cursor-pointer"
                            />
                            <CreditCard className="w-3.5 h-3.5 text-current" />
                            <span>Carte Bancaire</span>
                        </label>

                        <label className={`flex items-center gap-2 px-2 py-1 rounded-[3px] border cursor-pointer transition-colors text-xs font-semibold ${
                            paymentMethod === 'credit' 
                                ? 'bg-rose-700 text-white border-rose-800' 
                                : 'bg-white hover:bg-rose-50 text-rose-700 border-rose-200'
                        }`}>
                            <input
                                type="checkbox"
                                checked={paymentMethod === 'credit'}
                                onChange={() => { setPaymentMethod('credit'); setPaymentError(false); setAmountError(false); }}
                                className="w-3.5 h-3.5 rounded-[2px] accent-rose-600 cursor-pointer"
                            />
                            <Users className="w-3.5 h-3.5 text-current" />
                            <span>Crédit Client</span>
                        </label>
                    </div>
                </div>

                {/* 2. Résumé Facture */}
                <div className="p-2.5 rounded-[4px] border border-gray-200 bg-slate-50/70 flex flex-col justify-between">
                    <div className="flex items-center gap-1.5 pb-1.5 border-b border-gray-200">
                        <FileText className="w-3.5 h-3.5 text-[#001d35]" />
                        <h4 className="text-[11px] font-semibold text-[#001d35] uppercase tracking-wider">Résumé Facture</h4>
                    </div>

                    <div className="space-y-1.5 mt-1.5">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-500 font-medium">Total Brut HT :</span>
                            <span className="font-semibold text-gray-800">{formatPrice(cartTotal)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-500 font-medium">TVA (0.00%) :</span>
                            <span className="font-normal text-gray-400">0 F CFA</span>
                        </div>
                        {effectiveDiscount > 0 && (
                            <div className="flex items-center justify-between text-[11px] font-semibold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded-[3px] border border-amber-200">
                                <span>Remise :</span>
                                <span>-{formatPrice(effectiveDiscount)}</span>
                            </div>
                        )}
                        <div className="bg-[#001d35] text-white px-2.5 py-1.5 rounded-[4px] flex items-center justify-between shadow-xs">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-300">Net à Payer</span>
                            <span className="text-base font-bold text-white tracking-tight">{formatPrice(finalTotal)}</span>
                        </div>
                    </div>
                </div>

                {/* 3. Encaissement & Monnaie */}
                <div className="p-2.5 rounded-[4px] border border-gray-200 bg-slate-50/70 flex flex-col justify-between">
                    <div className="flex items-center gap-1.5 pb-1.5 border-b border-gray-200">
                        <Coins className="w-3.5 h-3.5 text-[#001d35]" />
                        <h4 className="text-[11px] font-semibold text-[#001d35] uppercase tracking-wider">Encaissement</h4>
                    </div>

                    <div className="space-y-1.5 mt-1.5">
                        <div>
                            <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 block mb-0.5">Montant Reçu (Espèces)</label>
                            <div className="relative">
                                <FinancialInput
                                    value={amountReceived || ''}
                                    onChange={(e) => { setAmountReceived(Math.max(0, parseFloat(e.target.value) || 0)); setAmountError(false); }}
                                    className={`w-full py-1 pl-2.5 pr-14 text-xs font-semibold rounded-[4px] border ${amountError ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-gray-300 bg-white text-[#001d35]'} focus:outline-none focus:ring-1 focus:ring-[#001d35]`}
                                    placeholder="0"
                                />
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400">F CFA</span>
                            </div>
                        </div>

                        {amountReceived > 0 && (
                            <div className="space-y-1 animate-in fade-in duration-100">
                                <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-[4px] px-2 py-1 flex items-center justify-between text-xs font-semibold">
                                    <span className="text-[10px] uppercase font-semibold text-emerald-900 tracking-wider">Monnaie due :</span>
                                    <span className="text-sm font-bold text-emerald-700">{formatPrice(Math.max(0, amountReceived - finalTotal))}</span>
                                </div>

                                {amountReceived > finalTotal && (
                                    <button
                                        type="button"
                                        onClick={() => handleCheckout('cash')}
                                        className="w-full text-left px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-[4px] text-[10px] font-semibold flex items-center justify-between transition-colors cursor-pointer"
                                        title="Gérer le reliquat en Bon d'Avoir ou Avance client"
                                    >
                                        <span className="flex items-center gap-1">
                                            <Coins className="w-3 h-3 text-amber-700" />
                                            Pas la monnaie ? (Reliquat)
                                        </span>
                                        <span className="underline font-bold">Avoir &rarr;</span>
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* 4. Actions de Caisse */}
                <div className="p-2.5 rounded-[4px] border border-gray-200 bg-slate-50/70 flex flex-col justify-between">
                    <div className="flex items-center gap-1.5 pb-1.5 border-b border-gray-200">
                        <ShieldCheck className="w-3.5 h-3.5 text-[#001d35]" />
                        <h4 className="text-[11px] font-semibold text-[#001d35] uppercase tracking-wider">Actions de Caisse</h4>
                    </div>

                    <div className="flex flex-col gap-1.5 mt-1.5">
                        <button
                            type="button"
                            onClick={() => handleCheckout(paymentMethod)}
                            disabled={cart.length === 0 || isProcessing}
                            className="w-full py-2 bg-[#001d35] hover:bg-[#00284a] text-white rounded-[4px] font-semibold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-sm active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#f77500]" />
                            <span>Valider Paiement</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleSaveQuote}
                            disabled={cart.length === 0}
                            className="w-full py-1.5 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 rounded-[4px] font-semibold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-2xs active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <FileText className="w-3.5 h-3.5 text-[#001d35]" />
                            <span>Créer un Devis</span>
                        </button>
                    </div>
                </div>

            </div>

            {/* Modal de Paiement */}
            {showPaymentModal && (
                <PaymentModal
                    total={finalTotal}
                    subtotal={cartTotal}
                    discount={effectiveDiscount}
                    preSelectedMethod={paymentMethod}
                    preSelectedAmount={amountReceived > 0 ? amountReceived.toString() : ''}
                    onConfirm={handleConfirmPayment}
                    onCancel={() => setShowPaymentModal(false)}
                    isProcessing={isProcessing}
                />
            )}

            {/* Reçu de Caisse */}
            {showReceipt && (
                <Receipt
                    transaction={lastTransaction}
                    onClose={() => setShowReceipt(false)}
                />
            )}

            {/* OVERLAY LOADER D'ENTRÉE DE PAGE (1,5s au montage) Identique à Réapprovisionnement */}
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
                            Point de Vente (POS)
                        </p>
                    </div>
                </div>
            )}

        </div>
    );
};

export default POS;
