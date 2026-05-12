import React, { useState } from "react";
import { useInventory } from "../../context/InventoryContext";
import { useSales } from "../../context/SalesContext";
import { useSettings } from "../../context/SettingsContext";
import { useSession } from "../../context/SessionContext";
import { useNavigate } from "react-router-dom";
import {
    ChevronDown
} from "lucide-react";
import Receipt from "../../components/Receipt";
import PaymentModal from "../../components/PaymentModal";
import toast from 'react-hot-toast';
import { formatPrice } from "../../utils/currency";
import { getUnitModel } from "../../config/unitModels";

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
            className={`px-2 py-2 relative group border-r-2 border-[#e6e6e6]/40 hover:bg-white/10 transition-colors select-none ${onClick ? 'cursor-pointer' : ''} ${className || ''}`}
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

const POS = () => {
    const { products, deconditionModels } = useInventory();
    const { currentStoreId } = useSettings();
    const { activeSession } = useSession();
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

    const [colWidths, setColWidths] = useState({
        name: 300,
        price: 200,
        stock: 180,
        actions: 140
    });

    const [cartColWidths, setCartColWidths] = useState({
        name: 350,
        quantity: 150,
        priceHT: 150,
        tax: 100,
        priceTTC: 150,
        totalTTC: 150,
        actions: 80
    });

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

    // ── Debounced Search Logic ────────────────────────────────────────
    React.useEffect(() => {
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
                        p.category.toLowerCase().includes(searchTerm.toLowerCase()))
            );
            setDisplayProducts(filtered);
            setIsSearching(false);
        }, 500); // 500ms delay to simulate network/debounce

        return () => clearTimeout(handler);
    }, [searchTerm, selectedCategory, products]);

    const categories = ['All', ...new Set(products.map(p => p.category))];

    const highlightText = (text, highlight) => {
        if (!highlight.trim()) return text;
        const regex = new RegExp(`(${highlight})`, 'gi');
        const parts = text.split(regex);
        return (
            <>
                {parts.map((part, i) =>
                    regex.test(part) ? (
                        <mark key={i} className="bg-yellow-200 px-0.5 rounded-sm ">{part.toUpperCase()}</mark>
                    ) : (
                        <span key={i}>{part.toUpperCase()}</span>
                    )
                )}
            </>
        );
    };

    const handleCheckout = async () => {
        if (cart.length === 0) return;

        const finalTotal = cartTotal - discount;
        let hasError = false;

        // Validation du moyen de paiement
        if (!paymentMethod) {
            setPaymentError(true);
            toast.error("Veuillez sélectionner un moyen de paiement.", { icon: '⚠️' });
            hasError = true;
        } else {
            setPaymentError(false);
        }

        // Validation basique pour les espèces
        if (paymentMethod === 'cash') {
            if (!amountReceived || amountReceived === 0) {
                setAmountError(true);
                toast.error("Veuillez saisir le montant reçu en espèces.", { icon: '⚠️' });
                hasError = true;
            } else if (amountReceived < finalTotal) {
                setAmountError(true);
                toast.error("Le montant reçu en espèces est insuffisant.", { icon: '⚠️' });
                hasError = true;
            } else {
                setAmountError(false);
            }
        }

        if (hasError) return;

        try {
            setIsProcessing(true);
            const transaction = await completeSale({
                method: paymentMethod || 'cash',
                amountGiven: paymentMethod === 'cash' ? (amountReceived > 0 ? amountReceived : finalTotal) : finalTotal,
                change: paymentMethod === 'cash' && amountReceived > finalTotal ? amountReceived - finalTotal : 0,
                total: finalTotal,
                discount: discount
            });

            setLastTransaction(transaction);
            setShowReceipt(true);
            setAmountReceived(0);
            setDiscount(0);
            toast.success("Paiement validé avec succès !", { icon: '💶' });
        } catch (error) {
            toast.error("Erreur lors de l'enregistrement de la vente");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSaveQuote = () => {
        const customerName = prompt("Nom du client pour le devis :");
        if (customerName) {
            addQuote(customerName);
            toast.success("Devis enregistré avec succès !");
        }
    };

    if (!activeSession) {
        return (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-5.5rem)] gap-6 bg-[#f0f4f8]">
                <div className="bg-white p-10 rounded-md shadow-sm border-t-4 border-[#1c398e] text-center max-w-md w-full">
                    <div className="bg-slate-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
                        <i className="uil uil-lock text-5xl text-[#1c398e]"></i>
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 uppercase tracking-wide mb-3">Caisse Verrouillée</h2>
                    <p className="text-slate-500 mb-8 font-medium">Vous devez obligatoirement ouvrir une session de caisse pour pouvoir effectuer des ventes.</p>
                    <button onClick={() => navigate('/sessions')} className="w-full py-4 bg-[#1c398e] hover:bg-blue-800 text-white font-black rounded-md uppercase tracking-wider transition-colors flex items-center justify-center gap-2">
                        <i className="uil uil-unlock"></i>
                        Ouvrir la Caisse
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 gap-6 h-[calc(100vh-5.5rem)]">
            <div className="bg-white rounded-sm shadow-sm border-2 border-gray-300 flex flex-col overflow-hidden">
                {/* ── Header Row 1 : Titre + Recherche + Filtre ── */}
                <div className="px-4 pt-4 pb-3 border-b border-gray-200 bg-[#e6ecf2] flex items-center gap-3">
                    {/* Barre de recherche */}
                    <div className="relative w-full max-w-sm">
                        {isSearching ? (
                            <div className="absolute left-3 top-1/2 -translate-y-1/2">
                                <div className="w-5 h-5 border-2 border-[#1c398e] border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        ) : (
                            <i className="uil uil-search text-xl absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                        )}
                        <input
                            type="text"
                            placeholder="Rechercher un produit..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-10 py-2 bg-white border-2 border-gray-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-[#1c398e] focus:border-[#1c398e] font-semibold text-gray-800"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100"
                                title="Effacer la recherche"
                            >
                                <i className="uil uil-multiply"></i>
                            </button>
                        )}
                    </div>

                    {/* Filtre catégorie */}
                    <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="px-4 py-2 bg-white border-2 border-gray-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-[#1c398e] focus:border-[#1c398e] font-bold text-gray-700 uppercase text-xs flex-shrink-0"
                    >
                        {categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                </div>


                {/* ── Zone Principale POS (Tableau Panier Actuel) ── */}
                <div className="flex-1 relative overflow-hidden bg-gray-50 flex flex-col">

                    {/* ── Dropdown de Recherche (visible seulement lors d'une recherche) ── */}
                    {(searchTerm || selectedCategory !== 'All') && (
                        <div className="absolute top-0 left-4 z-30 bg-white border-2 border-gray-300 shadow-[0_20px_50px_rgba(0,0,0,0.2)] rounded-b-lg max-h-[60vh] w-[850px] max-w-[calc(100%-2rem)] flex flex-col animate-in fade-in slide-in-from-top-2 duration-200">

                            {/* Header du dropdown */}
                            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50 flex-shrink-0">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                                    {isSearching ? 'Recherche...' : `${displayProducts.length} résultat${displayProducts.length !== 1 ? 's' : ''}`}
                                </span>
                                <button
                                    onClick={() => { setSearchTerm(''); setSelectedCategory('All'); }}
                                    className="p-1 text-red-500 hover:bg-red-50 rounded-full transition-all"
                                    title="Fermer"
                                >
                                    <i className="uil uil-times-circle text-2xl"></i>
                                </button>
                            </div>

                            {/* Tableau résultats */}
                            <div className={`overflow-y-auto custom-scrollbar transition-opacity duration-200 ${isSearching ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                                <table className="w-full text-left text-sm border-separate border-spacing-0">
                                    <thead style={{ backgroundColor: '#365ac9' }} className="text-white font-bold sticky top-0 z-10 shadow-sm uppercase tracking-wider text-[11px]">
                                        <tr className="divide-x-2 divide-[#224099]/40">
                                            <ResizableHeader columnId="name" width={colWidths.name} onResize={handleResize}>Produit</ResizableHeader>
                                            <ResizableHeader columnId="price" width={colWidths.price} onResize={handleResize}>Prix</ResizableHeader>
                                            <ResizableHeader columnId="stock" width={colWidths.stock} onResize={handleResize}>Stock</ResizableHeader>
                                            <th style={{ width: `${colWidths.actions}px`, minWidth: `${colWidths.actions}px` }} className="px-2 py-2 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y-2 divide-[#e6e6e6]">
                                        {displayProducts.length === 0 ? (
                                            <tr>
                                                <td colSpan="4" className="px-2 py-10 text-center text-gray-500">
                                                    <div className="flex flex-col items-center gap-2">
                                                        <i className="uil uil-search text-4xl text-gray-300"></i>
                                                        <p className="text-base font-medium">Aucun produit trouvé</p>
                                                        <p className="text-sm text-gray-400">Essayez un autre mot-clé ou catégorie</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            displayProducts.map((product) => {
                                                const stockQty = product.stockLevels?.[currentStoreId] || 0;
                                                const isLow = stockQty <= (product.minStockLevels?.[currentStoreId] || product.minStock || 0);
                                                return (
                                                    <tr key={product.id} className="divide-x-2 divide-[#e6e6e6] odd:bg-[#f3f3f3] even:bg-[#ffffff] hover:bg-blue-50/40 transition-colors">
                                                        <td className="px-2 py-1.5 font-semibold text-[#1c398e] truncate text-[13px] tracking-wide">
                                                            {highlightText(product.name || '', searchTerm)}
                                                        </td>
                                                        <td className="px-2 py-1.5 truncate">
                                                            <div className="font-semibold text-[#1c398e] text-[14px]">
                                                                {formatPrice(product.price)} <span className="text-gray-400 text-xs font-normal">/ {product.unit || 'Unité'}</span>
                                                            </div>
                                                            {product.hasLot && product.lotPrice && (
                                                                <div style={{ color: '#1c398e' }} className="text-[11px] font-semibold mt-1.5 flex items-center gap-1.5 bg-blue-50/50 w-fit px-2 py-0.5 rounded-sm border border-[#1c398e]/20">
                                                                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#1c398e' }}></div>
                                                                    {formatPrice(product.lotPrice)} / Lot de {product.retailStepQuantity || 10} {getUnitModel(product.unit).subUnit || 'Pièces'}
                                                                </div>
                                                            )}
                                                            {product.packagings?.map(pkg => (
                                                                <div key={pkg.modelId} style={{ color: '#1c398e' }} className="text-[10px] font-bold mt-1.5 flex items-center gap-1.5 uppercase bg-blue-50/50 w-fit px-2 py-0.5 rounded-sm border border-[#1c398e]/20">
                                                                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#1c398e' }}></div>
                                                                    {formatPrice(pkg.price)} / {pkg.name}
                                                                </div>
                                                            ))}
                                                        </td>
                                                        <td className="px-2 py-1.5">
                                                            {(() => {
                                                                const cf = parseFloat(product.conversionFactor) || 1;
                                                                const isContainer = (product.unitArchetype === 'BOX' || product.unitArchetype === 'BULK') && cf > 1;
                                                                const subUnit = getUnitModel(product.unit).subUnit;
                                                                const wholeUnits = Math.floor(stockQty);
                                                                const fractionalPart = stockQty - wholeUnits;
                                                                return (
                                                                    <div className="flex flex-col gap-0.5">
                                                                        <span className={`px-2.5 py-1 rounded-sm text-sm font-bold ${isLow ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                                                            {isContainer && fractionalPart > 0
                                                                                ? `${wholeUnits > 0 ? `${wholeUnits} ${product.unit} + ` : ''}${Math.round(fractionalPart * cf)} ${subUnit || 'unités'}`
                                                                                : `${stockQty.toLocaleString()} ${product.unit || ''}`}
                                                                        </span>
                                                                        {isContainer && subUnit && (
                                                                            <span className="text-[9px] text-gray-500 font-semibold pl-1">
                                                                                ≈ {(stockQty * cf).toLocaleString()} {subUnit}{fractionalPart > 0 ? ' au total' : ''}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })()}
                                                        </td>
                                                        <td className="px-2 py-1.5 text-right">
                                                            {product.packagings?.length > 0 || product.hasLot ? (
                                                                <div className="relative inline-block text-left ml-auto">
                                                                    <button
                                                                        onClick={() => setOpenPackagingPicker(openPackagingPicker === product.id ? null : product.id)}
                                                                        disabled={stockQty <= 0}
                                                                        className="px-3 py-2 text-white rounded-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center gap-2"
                                                                        style={{ backgroundColor: '#1c398e' }}
                                                                    >
                                                                        <i className="uil uil-box text-lg"></i>
                                                                        <span className="text-sm font-medium">Options</span>
                                                                        <ChevronDown className="w-3 h-3" />
                                                                    </button>
                                                                    {openPackagingPicker === product.id && (
                                                                        <div className="fixed inset-0 z-[100] flex items-center justify-center">
                                                                            {/* Backdrop */}
                                                                            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={(e) => { e.stopPropagation(); setOpenPackagingPicker(null); }}></div>

                                                                            {/* Modal Content */}
                                                                            <div className="relative bg-white border-2 border-[#1c398e] rounded-[2px] shadow-2xl w-full max-w-sm flex flex-col overflow-hidden animate-fade-in">
                                                                                <div className="bg-[#1c398e] px-4 py-2.5 flex items-center justify-between">
                                                                                    <span className="text-white font-black uppercase tracking-wider text-xs">Options : {product.name}</span>
                                                                                    <button onClick={(e) => { e.stopPropagation(); setOpenPackagingPicker(null); }} className="text-white/80 hover:text-white transition-colors">
                                                                                        <i className="uil uil-times text-xl"></i>
                                                                                    </button>
                                                                                </div>
                                                                                <div className="p-2.5 flex flex-col gap-2 bg-gray-50">
                                                                                    <button className="w-full text-left px-4 py-3 text-sm bg-white hover:bg-blue-50 border-2 border-gray-200 rounded-[2px] flex justify-between items-center transition-colors shadow-sm group"
                                                                                        onClick={(e) => { e.stopPropagation(); addToCart(product, { type: 'base' }); setOpenPackagingPicker(null); toast.success(`${product.name} ajouté`, { icon: '🛒' }); }}>
                                                                                        <span className="font-bold text-gray-700 group-hover:text-[#1c398e]">{product.unit || 'Unité'} (Entière)</span>
                                                                                        <span className="text-[#1c398e] font-black">{formatPrice(product.price)}</span>
                                                                                    </button>
                                                                                    {product.hasLot && product.lotPrice && (
                                                                                        <button className="w-full text-left px-4 py-3 text-sm bg-white hover:bg-amber-50 border-2 border-gray-200 rounded-[2px] flex justify-between items-center transition-colors shadow-sm group"
                                                                                            onClick={(e) => { e.stopPropagation(); addToCart(product, { type: 'lot' }); setOpenPackagingPicker(null); toast.success(`Lot ajouté`, { icon: '📦' }); }}>
                                                                                            <span className="font-bold text-gray-700 group-hover:text-amber-600">Lot de {product.retailStepQuantity || 10} {getUnitModel(product.unit).subUnit || 'Pièces'}</span>
                                                                                            <span className="text-amber-600 font-black">{formatPrice(product.lotPrice)}</span>
                                                                                        </button>
                                                                                    )}
                                                                                    {product.packagings?.map(pkg => (
                                                                                        <button key={pkg.modelId} className="w-full text-left px-4 py-3 text-sm bg-white hover:bg-blue-50 border-2 border-gray-200 rounded-[2px] flex justify-between items-center transition-colors shadow-sm group"
                                                                                            onClick={(e) => { e.stopPropagation(); addToCart(product, { type: 'packaging', ...pkg, name: pkg.name }); setOpenPackagingPicker(null); toast.success(`${pkg.name} ajouté`, { icon: '📏' }); }}>
                                                                                            <span className="font-bold text-gray-700 group-hover:text-[#1c398e]">{pkg.name}</span>
                                                                                            <span style={{ color: '#1c398e' }} className="font-black">{formatPrice(pkg.price)}</span>
                                                                                        </button>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    onClick={() => { addToCart(product); toast.success(`${product.name} ajouté`, { icon: '🛒' }); }}
                                                                    disabled={stockQty <= 0}
                                                                    className="px-3 py-2 bg-green-600 text-white rounded-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center gap-2 ml-auto"
                                                                >
                                                                    <i className="uil uil-plus text-lg"></i>
                                                                    <span className="text-sm font-medium">Ajouter</span>
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

                    {/* ── Tableau du Panier (Main Area) ── */}
                    <div className="flex-1 flex flex-col overflow-hidden relative">
                        <div className="flex-1 overflow-y-auto custom-scrollbar bg-white flex flex-col">
                            <table className="w-full text-left text-sm border-separate border-spacing-0 border-b-2 border-gray-300 flex-1 h-full">
                                <thead style={{ backgroundColor: '#365ac9' }} className="text-white font-bold sticky top-0 z-20 shadow-sm uppercase tracking-wider text-[11px] border-b-[3px] border-[#1c398e]">
                                    <tr className="divide-x-[3px] divide-[#224099]">
                                        <ResizableHeader columnId="name" width={cartColWidths.name} onResize={handleCartResize}>Produit</ResizableHeader>
                                        <ResizableHeader columnId="quantity" width={cartColWidths.quantity} onResize={handleCartResize}>Qté</ResizableHeader>
                                        <ResizableHeader columnId="priceHT" width={cartColWidths.priceHT} onResize={handleCartResize}>Prix HT</ResizableHeader>
                                        <ResizableHeader columnId="tax" width={cartColWidths.tax} onResize={handleCartResize}>Taxe (0%)</ResizableHeader>
                                        <ResizableHeader columnId="priceTTC" width={cartColWidths.priceTTC} onResize={handleCartResize}>Prix TTC</ResizableHeader>
                                        <ResizableHeader columnId="totalTTC" width={cartColWidths.totalTTC} onResize={handleCartResize}>Total TTC</ResizableHeader>
                                        <th style={{ width: `${cartColWidths.actions}px`, minWidth: `${cartColWidths.actions}px` }} className="px-4 py-3 text-center">
                                            <i className="uil uil-trash-alt text-lg"></i>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white">
                                    {cart.length === 0 ? (
                                        <tr className="h-full">
                                            <td colSpan="7" className="py-20 text-center opacity-40 select-none border-b border-gray-200 h-full">
                                                <div className="flex flex-col items-center justify-center gap-4 h-full">
                                                    <i className="uil uil-shopping-basket text-7xl text-[#1c398e]"></i>
                                                    <div className="flex flex-col gap-1">
                                                        <p className="text-lg font-black text-[#1c398e] uppercase tracking-[0.2em]">Panier Vide</p>
                                                        <p className="text-sm text-gray-400 font-medium">Scannez ou recherchez un produit pour commencer la vente</p>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        cart.map((item) => {
                                            const taxRate = 0; // 0% au Togo (déjà appliqué ou non applicable)
                                            const priceTTC = item.price;
                                            const priceHT = priceTTC; // HT = TTC quand taxe = 0
                                            const taxAmount = 0;
                                            const totalTTC = priceTTC * item.inputQuantity;

                                            return (
                                                <tr key={item.cartKey} className="divide-x-[3px] divide-gray-300 group transition-colors odd:bg-[#f3f3f3] even:bg-[#ffffff] hover:bg-blue-50/40">
                                                    {/* Produit */}
                                                    <td className="px-4 py-4 border-b border-gray-200">
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="font-bold text-[#1c398e] text-[14px] uppercase tracking-wide">
                                                                {item.name}
                                                            </span>
                                                            <span className="text-[11px] text-gray-400 font-bold uppercase">
                                                                {item.label}
                                                            </span>
                                                        </div>
                                                    </td>

                                                    {/* Quantité */}
                                                    <td className="px-4 py-4 border-b border-gray-200">
                                                        <div className="flex items-center gap-2 bg-gray-50 border-2 border-gray-200 rounded-sm p-1 w-fit group-hover:border-[#1c398e]/30 transition-colors">
                                                            <button
                                                                onClick={() => updateCartItem(item.cartKey, { inputQuantity: Math.max(1, item.inputQuantity - 1) })}
                                                                className="w-7 h-7 flex items-center justify-center bg-white border border-gray-300 rounded-sm hover:text-red-600 hover:border-red-200 transition-colors shadow-sm"
                                                            >
                                                                <i className="uil uil-minus text-sm"></i>
                                                            </button>
                                                            <input
                                                                type="number"
                                                                value={item.inputQuantity}
                                                                onChange={(e) => updateCartItem(item.cartKey, { inputQuantity: Math.max(1, parseFloat(e.target.value) || 0) })}
                                                                className="w-12 text-center bg-transparent font-semibold text-[#1c398e] text-sm focus:outline-none"
                                                            />
                                                            <button
                                                                onClick={() => updateCartItem(item.cartKey, { inputQuantity: item.inputQuantity + 1 })}
                                                                className="w-7 h-7 flex items-center justify-center bg-white border border-gray-300 rounded-sm hover:text-green-600 hover:border-green-200 transition-colors shadow-sm"
                                                            >
                                                                <i className="uil uil-plus text-sm"></i>
                                                            </button>
                                                        </div>
                                                    </td>

                                                    {/* Prix HT */}
                                                    <td className="px-4 py-4 font-semibold text-gray-500 text-sm border-b border-gray-200">
                                                        {formatPrice(priceHT)}
                                                    </td>

                                                    {/* Taxe */}
                                                    <td className="px-4 py-4 border-b border-gray-200 font-semibold text-gray-400 text-sm">
                                                        0 F CFA
                                                    </td>

                                                    {/* Prix TTC */}
                                                    <td className="px-4 py-4 font-semibold text-[#1c398e] text-sm border-b border-gray-200">
                                                        {formatPrice(priceTTC)}
                                                    </td>

                                                    {/* Total TTC */}
                                                    <td className="px-4 py-4 border-b border-gray-200">
                                                        <span className="px-3 py-1.5 bg-[#1c398e]/5 border border-[#1c398e]/10 rounded-sm font-semibold text-[#1c398e] text-sm tracking-tight">
                                                            {formatPrice(totalTTC)}
                                                        </span>
                                                    </td>

                                                    {/* Action */}
                                                    <td className="px-4 py-4 text-center border-b border-gray-200">
                                                        <button
                                                            onClick={() => removeFromCart(item.cartKey)}
                                                            className="w-9 h-9 flex items-center justify-center text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-full transition-all"
                                                        >
                                                            <i className="uil uil-trash-alt text-xl"></i>
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                    {/* Lignes vides pour allonger les traits vers le bas */}
                                    {cart.length > 0 && cart.length < 15 && [...Array(15 - cart.length)].map((_, i) => (
                                        <tr key={`empty-${i}`} className="divide-x-[3px] divide-gray-300 h-14 bg-white/30">
                                            <td className="border-b border-gray-50/50"></td>
                                            <td className="border-b border-gray-50/50"></td>
                                            <td className="border-b border-gray-50/50"></td>
                                            <td className="border-b border-gray-50/50"></td>
                                            <td className="border-b border-gray-50/50"></td>
                                            <td className="border-b border-gray-50/50"></td>
                                            <td className="border-b border-gray-50/50"></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* ── Pied de Page Financier (Financial Footer - FIXE) ── */}
                    <div className="sticky bottom-0 bg-gray-100 border-t-4 border-gray-300 px-4 py-3 grid grid-cols-1 md:grid-cols-4 gap-3 shadow-[0_-10px_30px_rgba(0,0,0,0.2)] z-30 flex-shrink-0">

                        {/* Colonne 1 : Choix du Paiement (Fieldset) */}
                        <fieldset className={`border-[3px] ${paymentError ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-[#e3e9ef]'} rounded-[2px] p-2 pt-0.5 transition-colors`}>
                            <legend className={`text-[16px] font-bold uppercase tracking-wider ${paymentError ? 'text-red-600 bg-red-50' : 'text-gray-600 bg-[#e3e9ef]'} px-2 ml-1 transition-colors`}>Moyen De Paiement</legend>
                            <div className="flex flex-col gap-1.5 mt-1">
                                <label className={`flex items-center gap-3 px-2 py-1.5 rounded-[2px] cursor-pointer transition-colors ${paymentMethod === 'cash' ? 'bg-blue-50/50' : 'hover:bg-gray-50'}`}>
                                    <input type="checkbox" checked={paymentMethod === 'cash'} onChange={() => { setPaymentMethod('cash'); setPaymentError(false); setAmountError(false); }} className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded-[2px] focus:ring-blue-600 accent-[#1c398e]" />
                                    <div className="flex items-center gap-2">
                                        <i className={`uil uil-money-bill text-lg ${paymentMethod === 'cash' ? 'text-blue-600' : 'text-gray-400'}`}></i>
                                        <span className={`text-sm font-bold uppercase tracking-wider ${paymentMethod === 'cash' ? 'text-blue-800' : 'text-gray-500'}`}>Espèces</span>
                                    </div>
                                </label>

                                <label className={`flex items-center gap-3 px-2 py-1.5 rounded-[2px] cursor-pointer transition-colors ${paymentMethod === 'card' ? 'bg-blue-50/50' : 'hover:bg-gray-50'}`}>
                                    <input type="checkbox" checked={paymentMethod === 'card'} onChange={() => { setPaymentMethod('card'); setPaymentError(false); setAmountError(false); }} className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded-[2px] focus:ring-blue-600 accent-blue-600" />
                                    <div className="flex items-center gap-2">
                                        <i className={`uil uil-credit-card text-lg ${paymentMethod === 'card' ? 'text-blue-600' : 'text-gray-400'}`}></i>
                                        <span className={`text-sm font-bold uppercase tracking-wider ${paymentMethod === 'card' ? 'text-blue-800' : 'text-gray-500'}`}>Carte Bancaire</span>
                                    </div>
                                </label>

                                <label className={`flex items-center gap-3 px-2 py-1.5 rounded-[2px] cursor-pointer transition-colors ${paymentMethod === 'credit' ? 'bg-red-50/50' : 'hover:bg-gray-50'}`}>
                                    <input type="checkbox" checked={paymentMethod === 'credit'} onChange={() => { setPaymentMethod('credit'); setPaymentError(false); setAmountError(false); }} className="w-3.5 h-3.5 text-red-600 border-gray-300 rounded-[2px] focus:ring-red-600 accent-red-600" />
                                    <div className="flex items-center gap-2">
                                        <i className={`uil uil-users-alt text-lg ${paymentMethod === 'credit' ? 'text-red-600' : 'text-gray-400'}`}></i>
                                        <span className={`text-sm font-bold uppercase tracking-wider ${paymentMethod === 'credit' ? 'text-red-800' : 'text-gray-500'}`}>Crédit Client</span>
                                    </div>
                                </label>
                            </div>
                        </fieldset>

                        {/* Colonne 2 : Encaissement (Fieldset) */}
                        <fieldset className="border-[3px] border-gray-200 bg-[#e3e9ef] rounded-[2px] p-2 pt-0.5">
                            <legend className="text-[16px] font-bold uppercase tracking-wider text-gray-600 px-2 ml-1 bg-[#e3e9ef]">Encaissement</legend>
                            <div className="flex flex-col gap-2 mt-1 px-1">
                                <div className="mt-4">
                                    <label className="text-[13px] font-bold uppercase tracking-wider text-gray-500 mb-1 block">Montant Reçu (Espèces)</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={amountReceived || ''}
                                            onChange={(e) => { setAmountReceived(Math.max(0, parseFloat(e.target.value) || 0)); setAmountError(false); }}
                                            onWheel={(e) => e.currentTarget.blur()}
                                            className={`w-full ${amountError ? 'bg-red-50 border-red-500 text-red-700' : 'bg-white border-gray-300 text-blue-700'} border-2 rounded-[2px] px-3 py-1.5 font-semibold text-lg focus:outline-none ${amountError ? 'focus:border-red-600' : 'focus:border-blue-400'} transition-colors shadow-inner [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                                            placeholder="0"
                                        />
                                        <span className={`absolute right-3 top-1/2 -translate-y-1/2 ${amountError ? 'text-red-400' : 'text-blue-300'} font-black text-xs`}>F CFA</span>
                                    </div>
                                </div>
                                {amountReceived > 0 && (
                                    <div className="animate-fade-in">
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1 block">Monnaie à Rendre</label>
                                        <div className="w-full bg-blue-600 border-2 border-blue-700 rounded-[2px] px-3 py-1 flex justify-between items-center shadow-md">
                                            <span className="text-white text-xl font-semibold tracking-tight">
                                                {formatPrice(Math.max(0, amountReceived - cartTotal))}
                                            </span>
                                            <i className="uil uil-coins text-blue-300/50 text-xl"></i>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </fieldset>

                        {/* Colonne 3 : Résumé (Fieldset) */}
                        <fieldset className="border-[3px] border-gray-200 bg-[#e3e9ef] rounded-[2px] p-2 pt-0.5">
                            <legend className="text-[16px] font-bold uppercase tracking-wider text-gray-600 px-2 ml-1 bg-[#e3e9ef]">Résumé Facture</legend>
                            <div className="flex flex-col gap-2 mt-1 px-1 h-[calc(100%-1rem)] pb-1">
                                <div className="flex items-center">
                                    <span className="text-xs font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap mr-4">Total Brut HT</span>
                                    <div className="flex-1 border-2 border-gray-200 rounded-[2px] px-3 py-1 bg-white">
                                        <span className="block text-base font-semibold text-gray-600 text-right tracking-tight">
                                            {formatPrice(cartTotal)}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center border-b border-gray-100 pb-2">
                                    <span className="text-xs font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap mr-4">TVA (0.00%)</span>
                                    <div className="flex-1 border-2 border-gray-200 rounded-[2px] px-3 py-1 bg-white">
                                        <span className="block text-sm font-semibold text-gray-300 italic text-right">
                                            0 F CFA
                                        </span>
                                    </div>
                                </div>
                                <div className="flex flex-col flex-1 mt-0.5">
                                    <span className="text-xs font-bold uppercase tracking-wider text-[#1c398e] mb-1 block">Net à Payer</span>
                                    <div className="w-full flex-1 border-2 border-[#1c398e] rounded-[2px] px-3 py-1 bg-white shadow-sm flex items-center justify-center min-h-[40px]">
                                        <span className="block text-2xl font-semibold text-[#1c398e] tracking-tighter text-center">
                                            {formatPrice(cartTotal)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </fieldset>

                        {/* Colonne 4 : Actions (Fieldset) */}
                        <fieldset className="border-[3px] border-gray-200 bg-[#e3e9ef] rounded-[2px] p-2 pt-0.5">
                            <legend className="text-[16px] font-bold uppercase tracking-wider text-[#1c398e] px-2 ml-1 bg-[#e3e9ef] border-[3px] border-[#1c398e]/30 rounded-sm">Actions de Caisse</legend>
                            <div className="flex flex-col gap-2 mt-1 h-full justify-center px-1">
                                <button
                                    onClick={() => handleCheckout(paymentMethod)}
                                    disabled={cart.length === 0}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-[2px] bg-green-600 border-2 border-green-700 text-white text-xs font-black uppercase tracking-wide hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
                                >
                                    <i className="uil uil-check-circle text-lg"></i>
                                    <span>Valider Paiement</span>
                                </button>
                                <button
                                    onClick={handleSaveQuote}
                                    disabled={cart.length === 0}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-[2px] bg-white border-2 border-[#1c398e] text-[#1c398e] text-xs font-bold uppercase tracking-wide hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                >
                                    <i className="uil uil-file-alt text-base"></i>
                                    <span>Créer Devis</span>
                                </button>
                            </div>
                        </fieldset>

                    </div>

                </div>
            </div>

            {/* Receipt Modal */}
            {showReceipt && (
                <Receipt
                    transaction={lastTransaction}
                    onClose={() => setShowReceipt(false)}
                />
            )}


        </div>
    );
};

export default POS;
