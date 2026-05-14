import React, { useState, useRef, useEffect } from 'react';
import { useSales } from '../../context/SalesContext';
import { useInventory } from '../../context/InventoryContext';
import { useSettings } from '../../context/SettingsContext';
import { FileText, Trash2, Check, Printer, Plus, Search, AlertTriangle, X, MessageCircle } from 'lucide-react';
import { formatPrice } from '../../utils/currency';
import { getUnitModel } from '../../config/unitModels';

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
            <div className="flex items-center justify-center overflow-hidden whitespace-nowrap h-full">
                {children}
            </div>
            <div
                className={`absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-20 hover:bg-[#e6e6e6] ${isResizing ? 'bg-[#e6e6e6]' : 'bg-transparent'}`}
                onMouseDown={handleMouseDown}
                onClick={(e) => e.stopPropagation()}
            ></div>
        </th>
    );
};const Quotes = () => {
    const { quotes, deleteQuote, convertQuoteToSale, addQuoteWithItems } = useSales();
    const { products } = useInventory();
    const { currentStoreId, company } = useSettings();

    const [showNewQuoteModal, setShowNewQuoteModal] = useState(false);
    const [newQuoteCustomer, setNewQuoteCustomer] = useState('');
    const [newQuoteItems, setNewQuoteItems] = useState([]);
    const [productSearch, setProductSearch] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedQuotes, setSelectedQuotes] = useState([]);

    const [openPackagingPicker, setOpenPackagingPicker] = useState(null);
    const pickerRefs = useRef({});

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (openPackagingPicker) {
                const pickerNode = pickerRefs.current[openPackagingPicker];
                if (pickerNode && !pickerNode.contains(event.target)) {
                    setOpenPackagingPicker(null);
                }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [openPackagingPicker]);

    const [colWidths, setColWidths] = useState({
        date: 150,
        customer: 250,
        articles: 300,
        total: 150,
        actions: 180
    });

    const handleResize = (columnId, newWidth) => {
        setColWidths(prev => ({
            ...prev,
            [columnId]: newWidth
        }));
    };

    const handlePrintQuote = (quote) => {
        const printWindow = window.open('', '_blank', 'width=900,height=700');
        
        const invoiceNumber = `DEV-${new Date(quote.date).getFullYear()}${String(new Date(quote.date).getMonth() + 1).padStart(2, '0')}-${String(quote.id).padStart(4, '0')}`;
        
        const htmlContent = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Devis — ${company.name}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 10pt;
      color: #1a1a1a;
      background: white;
      margin: 0;
    }
    table { border-collapse: collapse; width: 100%; }
    img { max-width: 100%; }
    @page { size: A4 portrait; margin: 0; }
    @media print {
      body { margin: 0; padding: 0; }
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }
  </style>
</head>
<body>
  <div style="width:210mm;min-height:297mm;padding:15mm 18mm;margin:0 auto;font-family:'Segoe UI',Arial,sans-serif;font-size:10pt;color:#1a1a1a;background:white;">
    <!-- HEADER -->
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 5mm; border-bottom: 3px solid #1c398e; padding-bottom: 5mm;">
        <div style="flex: 1;">
            ${company.logo ? `<img src="${company.logo}" alt="Logo" style="height: 14mm; margin-bottom: 3mm; object-fit: contain;" />` : ''}
            <div style="font-size: 15pt; font-weight: 800; color: #1c398e; letter-spacing: -0.5px; text-transform: uppercase;">
                ${company.name}
            </div>
            <div style="font-size: 8.5pt; color: #555; margin-top: 1.5mm; line-height: 1.6;">
                ${company.address ? `<div>${company.address}</div>` : ''}
                ${company.phone ? `<div>Tél : ${company.phone}</div>` : ''}
                ${company.email ? `<div>Email : ${company.email}</div>` : ''}
                ${company.nif ? `<div>NIF : ${company.nif}</div>` : ''}
            </div>
        </div>

        <div style="text-align: right; min-width: 65mm; padding-left: 8mm;">
            <div style="font-size: 8.5pt; color: #444; line-height: 2;">
                <div><span style="color: #888;">N° :</span> <strong style="color: #1c398e;">${invoiceNumber}</strong></div>
                <div><span style="color: #888;">Date :</span> ${new Date(quote.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
                <div><span style="color: #888;">Heure :</span> ${new Date(quote.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
        </div>
    </div>

    <!-- TITLE -->
    <div style="text-align: center; margin: 4mm 0 8mm 0; text-transform: uppercase;">
        <div style="font-size: 16pt; font-weight: 900; color: #1a1a1a; letter-spacing: 4px; display: inline-block; border-bottom: 2px solid #1c398e; padding-bottom: 1mm; margin-bottom: 1mm;">
            Devis Proforma
        </div>
        <div style="font-size: 7.5pt; color: #666; font-weight: bold; letter-spacing: 1px;">
            (Valable 30 jours)
        </div>
    </div>

    <!-- CLIENT -->
    ${quote.customerName ? `
    <div style="display: flex; gap: 6mm; margin-bottom: 6mm;">
        <div style="flex: 1; background-color: #f8f9fa; border: 1px solid #e9ecef; border-radius: 2px; padding: 3mm 4mm;">
            <div style="font-size: 7.5pt; font-weight: 700; color: #1c398e; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 1.5mm;">
                Client
            </div>
            <div style="font-size: 9pt; color: #333;">
                ${quote.customerName}
            </div>
        </div>
    </div>
    ` : ''}

    <!-- TABLE -->
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 6mm; font-size: 9pt;">
        <thead>
            <tr>
                <th style="padding: 2.5mm 3mm; background-color: #1c398e; color: white; text-align: left; font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Désignation</th>
                <th style="padding: 2.5mm 3mm; background-color: #1c398e; color: white; text-align: center; font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; width: 15%;">Qté</th>
                <th style="padding: 2.5mm 3mm; background-color: #1c398e; color: white; text-align: right; font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; width: 20%;">P.U</th>
                <th style="padding: 2.5mm 3mm; background-color: #1c398e; color: white; text-align: right; font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; width: 20%;">Total</th>
            </tr>
        </thead>
        <tbody>
            ${quote.items.map((item, index) => {
                const qty = item.quantity || item.inputQuantity || 1;
                return `
            <tr style="background-color: ${index % 2 === 0 ? '#ffffff' : '#f8f9fa'};">
                <td style="padding: 2.5mm 3mm; border-bottom: 1px solid #e9ecef; color: #1a1a1a;">
                    <div style="font-weight: 600;">${item.name}</div>
                </td>
                <td style="padding: 2.5mm 3mm; border-bottom: 1px solid #e9ecef; text-align: center; color: #444;">
                    ${qty} ${item.unit || ''}
                </td>
                <td style="padding: 2.5mm 3mm; border-bottom: 1px solid #e9ecef; text-align: right; color: #444;">
                    ${formatPrice(item.price)}
                </td>
                <td style="padding: 2.5mm 3mm; border-bottom: 1px solid #e9ecef; text-align: right; color: #1a1a1a; font-weight: 600;">
                    ${formatPrice(item.price * qty)}
                </td>
            </tr>
            `}).join('')}
        </tbody>
    </table>

    <!-- TOTALS -->
    <div style="display: flex; justify-content: flex-end; margin-top: 2mm;">
        <div style="width: 70mm;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 3mm 4mm; background-color: #1c398e; color: white; font-weight: 800; font-size: 11pt; border-radius: 2px;">
                <span style="text-transform: uppercase; font-size: 8pt; letter-spacing: 1px;">Net à Payer</span>
                <span>${formatPrice(quote.total)}</span>
            </div>
        </div>
    </div>

    <!-- FOOTER -->
    <div style="margin-top: 15mm; border-top: 1px solid #e9ecef; padding-top: 4mm; display: flex; justify-content: space-between; font-size: 7.5pt; color: #888;">
        <div>Document généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
        <div>Merci de votre confiance.</div>
    </div>
  </div>
</body>
</html>
        `;

        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 400);
    };

    const handleWhatsAppQuote = (quote) => {
        let text = `*DEVIS - LA QUINCAILLERIE*\n`;
        text += `Client: ${quote.customerName}\n`;
        text += `Date: ${new Date(quote.date).toLocaleDateString('fr-FR')}\n\n`;
        text += `*ARTICLES:*\n`;
        quote.items.forEach(item => {
            text += `- ${item.quantity} ${item.unit || 'x'} ${item.name} : ${formatPrice(item.price * item.quantity)}\n`;
        });
        text += `\n*TOTAL: ${formatPrice(quote.total)}*\n\n`;
        text += `Merci de votre confiance !`;

        const encodedText = encodeURIComponent(text);
        window.open(`https://wa.me/?text=${encodedText}`, '_blank');
    };

    const handleAddToQuote = (product, options = null) => {
        let finalItem = { ...product };
        let itemKey = product.id; 

        if (options) {
            if (options.type === 'base') {
                finalItem.price = product.price;
                finalItem.unit = product.unit;
            } else if (options.type === 'lot') {
                finalItem.price = product.lotPrice;
                finalItem.unit = `Lot de ${product.retailStepQuantity || 10} ${getUnitModel(product.unit).subUnit || 'Pièces'}`;
                itemKey = `${product.id}-lot`;
            } else if (options.type === 'packaging') {
                finalItem.price = options.price;
                finalItem.unit = options.name;
                itemKey = `${product.id}-${options.modelId}`;
            }
        }

        setNewQuoteItems(prev => {
            const existing = prev.find(item => item.quoteItemKey === itemKey || (!item.quoteItemKey && item.id === itemKey));
            if (existing) {
                return prev.map(item => (item.quoteItemKey === itemKey || (!item.quoteItemKey && item.id === itemKey)) ? { ...item, quantity: item.quantity + 1 } : item);
            }
            return [...prev, { ...finalItem, quantity: 1, quoteItemKey: itemKey }];
        });
        setOpenPackagingPicker(null);
    };

    const handleRemoveFromQuote = (itemKey) => {
        setNewQuoteItems(prev => prev.filter(item => (item.quoteItemKey || item.id) !== itemKey));
    };

    const handleUpdateQuantity = (itemKey, quantity) => {
        if (quantity <= 0) {
            handleRemoveFromQuote(itemKey);
            return;
        }
        setNewQuoteItems(prev => prev.map(item => (item.quoteItemKey || item.id) === itemKey ? { ...item, quantity } : item));
    };

    const handleCreateQuote = () => {
        if (!newQuoteCustomer.trim()) {
            alert("Veuillez entrer le nom du client.");
            return;
        }
        if (newQuoteItems.length === 0) {
            alert("Veuillez ajouter des produits au devis.");
            return;
        }
        addQuoteWithItems(newQuoteCustomer, newQuoteItems);
        setShowNewQuoteModal(false);
        setNewQuoteCustomer('');
        setNewQuoteItems([]);
        setProductSearch('');
    };

    const filteredProducts = products.filter(product =>
        product.name?.toLowerCase().includes(productSearch.toLowerCase()) ||
        product.category.toLowerCase().includes(productSearch.toLowerCase())
    );

    const quoteTotal = newQuoteItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const filteredQuotes = quotes.filter(q => 
        q.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
        q.items.some(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedQuotes(filteredQuotes.map(q => q.id));
        } else {
            setSelectedQuotes([]);
        }
    };

    const handleSelectQuote = (id) => {
        setSelectedQuotes(prev => 
            prev.includes(id) ? prev.filter(qId => qId !== id) : [...prev, id]
        );
    };

    const handleBulkDelete = () => {
        if (window.confirm(`Voulez-vous vraiment supprimer ${selectedQuotes.length} devis ?`)) {
            selectedQuotes.forEach(id => deleteQuote(id));
            setSelectedQuotes([]);
        }
    };

    return (
        <div className="p-3 h-full flex flex-col gap-4 overflow-y-auto custom-scrollbar bg-[#f0f4f8]">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-[#1c398e] tracking-tight">Devis & Proformas</h2>
                    <p className="text-gray-500 text-sm mt-1 font-medium">Gérez les devis clients et convertissez-les en ventes</p>
                </div>
            </div>

            {/* Top Insight Bar */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Total Devis */}
                <div className="bg-white p-4 rounded-sm border-2 border-gray-300 shadow-sm relative group hover:shadow-md transition-shadow overflow-hidden">
                    <div className="relative z-10">
                        <p className="text-[11px] font-bold text-blue-600/70 uppercase tracking-widest mb-1">Total Devis</p>
                        <h3 className="text-xl sm:text-2xl font-semibold text-[#1c398e]">{quotes.length}</h3>
                        <p className="text-xs text-gray-400 mt-2 font-medium">Devis enregistrés</p>
                    </div>
                </div>

                {/* Valeur Globale */}
                <div className="bg-white p-4 rounded-sm border-2 border-gray-300 shadow-sm relative group hover:shadow-md transition-shadow overflow-hidden">
                    <div className="relative z-10">
                        <p className="text-[11px] font-bold text-blue-600/70 uppercase tracking-widest mb-1">Valeur Globale</p>
                        <h3 className="text-xl sm:text-2xl font-semibold text-[#1c398e]">{formatPrice(quotes.reduce((sum, q) => sum + q.total, 0))}</h3>
                        <p className="text-xs text-gray-400 mt-2 font-medium">Montant total des devis</p>
                    </div>
                </div>
            </div>

            {/* Main Command Center Toolbar */}
            <div className="bg-white border-2 border-gray-300 rounded-sm shadow-sm overflow-hidden">
                <div className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white">
                    <div className="flex-1 relative group max-w-md">
                        <i className="uil uil-search text-xl absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#1c398e] transition-colors"></i>
                        <input
                            type="text"
                            placeholder="Rechercher un devis..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-sm focus:outline-none focus:border-[#1c398e] focus:ring-4 focus:ring-[#1c398e]/5 bg-white transition-all text-sm font-bold text-gray-800 placeholder:text-gray-400 placeholder:font-medium"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        {selectedQuotes.length > 0 && (
                            <button
                                onClick={handleBulkDelete}
                                className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-sm font-black text-xs uppercase tracking-wider shadow-md transition-all active:scale-95"
                            >
                                <i className="uil uil-trash-alt text-lg"></i>
                                Supprimer ({selectedQuotes.length})
                            </button>
                        )}
                        <button
                            onClick={() => setShowNewQuoteModal(true)}
                            className="flex items-center justify-center gap-2 bg-[#f77500] hover:bg-[#e66a00] text-white px-6 py-3 rounded-sm font-black text-xs uppercase tracking-wider shadow-md transition-all active:scale-95"
                        >
                            <i className="uil uil-plus text-lg"></i>
                            Nouveau Devis
                        </button>
                    </div>
                </div>
            </div>

            {/* Table Container */}
            <div className="bg-white rounded-sm border-2 border-gray-300 shadow-sm overflow-hidden flex flex-col h-[600px]">
                <div className="overflow-y-auto flex-1">
                    <table className="w-full text-left text-sm relative">
                        <thead style={{ backgroundColor: '#365ac9' }} className="text-white font-bold sticky top-0 z-10 shadow-sm uppercase tracking-wider text-[11px]">
                            <tr className="divide-x-2 divide-[#224099]/40">
                                <th className="px-3 py-1.5 w-10 text-center">
                                    <input 
                                        type="checkbox" 
                                        className="w-4 h-4 cursor-pointer accent-[#f77500]"
                                        checked={filteredQuotes.length > 0 && selectedQuotes.length === filteredQuotes.length}
                                        onChange={handleSelectAll}
                                    />
                                </th>
                                <ResizableHeader columnId="date" width={colWidths.date} onResize={handleResize}>Date</ResizableHeader>
                                <ResizableHeader columnId="customer" width={colWidths.customer} onResize={handleResize}>Client</ResizableHeader>
                                <ResizableHeader columnId="articles" width={colWidths.articles} onResize={handleResize}>Articles</ResizableHeader>
                                <ResizableHeader columnId="total" width={colWidths.total} onResize={handleResize}>Total</ResizableHeader>
                                <th style={{ width: `${colWidths.actions}px`, minWidth: `${colWidths.actions}px` }} className="px-1 py-1.5 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y-2 divide-[#e6e6e6]">
                            {filteredQuotes.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-8 text-center text-gray-500 font-bold">
                                        Aucun devis trouvé.
                                    </td>
                                </tr>
                            ) : (
                                filteredQuotes.map((quote) => (
                                    <tr key={quote.id} className={`divide-x-2 divide-[#e6e6e6] hover:bg-blue-50/40 transition-colors ${selectedQuotes.includes(quote.id) ? 'bg-blue-50' : 'odd:bg-[#f3f3f3] even:bg-[#ffffff]'}`}>
                                        <td className="px-3 py-3 text-center">
                                            <input 
                                                type="checkbox" 
                                                className="w-4 h-4 cursor-pointer accent-[#f77500]"
                                                checked={selectedQuotes.includes(quote.id)}
                                                onChange={() => handleSelectQuote(quote.id)}
                                            />
                                        </td>
                                        <td className="px-2 py-3 font-semibold text-[#1c398e] truncate text-[13px] tracking-wide text-center">
                                            {new Date(quote.date).toLocaleDateString('fr-FR')} <br/>
                                            <span className="text-[10px] text-gray-400 font-medium">{new Date(quote.date).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}</span>
                                        </td>
                                        <td className="px-2 py-3 font-bold text-[#1c398e] truncate text-[14px] tracking-wide text-center">
                                            {quote.customerName}
                                        </td>
                                        <td className="px-2 py-3 text-center">
                                            <div className="flex flex-col items-center gap-1">
                                                <span className="bg-[#1c398e]/10 px-2 py-0.5 rounded-sm text-xs border border-[#1c398e]/20 text-[#1c398e] font-bold w-fit">
                                                    {quote.items.length} articles
                                                </span>
                                                <div className="text-[11px] text-gray-500 font-medium mt-1 truncate max-w-[280px]" title={quote.items.map(i => i.name).join(', ')}>
                                                    {quote.items.map(i => i.name).join(', ')}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-2 py-3 font-bold text-[#1c398e] text-[14px] truncate text-center">
                                            {formatPrice(quote.total)}
                                        </td>
                                        <td className="px-2 py-3 text-center">
                                            <div className="flex justify-center gap-1">
                                                <button onClick={() => handlePrintQuote(quote)} className="p-2 text-gray-400 hover:text-[#1c398e] hover:bg-blue-50 rounded-sm transition-colors" title="Imprimer">
                                                    <i className="uil uil-print text-lg"></i>
                                                </button>
                                                <button onClick={() => handleWhatsAppQuote(quote)} className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-sm transition-colors" title="Envoyer sur WhatsApp">
                                                    <i className="uil uil-whatsapp text-lg"></i>
                                                </button>
                                                <button onClick={() => { if (window.confirm('Convertir ce devis en vente ? Le stock sera déduit.')) convertQuoteToSale(quote); }} className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-sm transition-colors" title="Convertir en Vente">
                                                    <i className="uil uil-check text-lg"></i>
                                                </button>
                                                <button onClick={() => { if (window.confirm('Supprimer ce devis ?')) deleteQuote(quote.id); }} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-sm transition-colors" title="Supprimer">
                                                    <i className="uil uil-trash-alt text-lg"></i>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* New Quote Modal */}
            {showNewQuoteModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-sm shadow-xl w-full max-w-[95vw] h-[95vh] flex flex-col">
                        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-gray-900">Nouveau Devis</h3>
                            <button onClick={() => setShowNewQuoteModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
                            {/* Product Selection (Left) */}
                            <div className="flex-1 flex flex-col border-r border-gray-200 p-6 overflow-hidden">
                                <div className="mb-4">
                                    <div className="relative">
                                        <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            type="text"
                                            placeholder="Rechercher un produit..."
                                            value={productSearch}
                                            onChange={(e) => setProductSearch(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-sm focus:outline-none focus:ring-2 focus:ring-[#1c398e]"
                                        />
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto bg-white rounded-sm border-2 border-gray-300 shadow-sm custom-scrollbar">
                                    <table className="w-full text-left text-sm relative">
                                        <thead style={{ backgroundColor: '#365ac9' }} className="text-white font-bold sticky top-0 z-10 shadow-sm uppercase tracking-wider text-[11px]">
                                            <tr className="divide-x-2 divide-[#224099]/40">
                                                <th className="px-4 py-3 border-r-2 border-[#e6e6e6]/40">Produit</th>
                                                <th className="px-4 py-3 border-r-2 border-[#e6e6e6]/40">Catégorie</th>
                                                <th className="px-4 py-3 border-r-2 border-[#e6e6e6]/40">Prix</th>
                                                <th className="px-4 py-3 border-r-2 border-[#e6e6e6]/40">Stock</th>
                                                <th className="px-4 py-3 border-r-2 border-[#e6e6e6]/40">Fournisseur</th>
                                                <th className="px-4 py-3 text-center">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y-2 divide-[#e6e6e6]">
                                            {filteredProducts.map((product) => (
                                                <tr key={product.id} className="divide-x-2 divide-[#e6e6e6] hover:bg-blue-50/40 transition-colors odd:bg-[#f3f3f3] even:bg-[#ffffff]">
                                                    <td className="px-4 py-3 font-semibold text-[#1c398e]">{product.name}</td>
                                                    <td className="px-4 py-3 text-gray-600">
                                                        <span className="bg-gray-200/50 text-gray-700 px-2 py-1 rounded-sm text-[11px] font-bold border border-gray-300">
                                                            {product.category}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-[#1c398e]">{formatPrice(product.price)}</span>
                                                            <span className="text-[10px] text-gray-400 font-medium">/ {product.unit || 'Unité'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {(() => {
                                                            const cf = parseFloat(product.conversionFactor) || 1;
                                                            const isContainer = (product.unitArchetype === 'BOX' || product.unitArchetype === 'BULK') && cf > 1;
                                                            const stockQty = product.stockLevels?.[currentStoreId] || 0;
                                                            const subUnit = getUnitModel(product.unit).subUnit;
                                                            const isLow = stockQty <= (product.minStockLevels?.[currentStoreId] || product.minStock || 0);

                                                            return (
                                                                <div className="flex flex-col gap-1">
                                                                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-sm font-bold text-[11px] w-fit border ${isLow ? 'text-red-600 bg-red-50 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                                                                        {isLow && <AlertTriangle className="w-3 h-3" />}
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
                                                                    {isContainer && subUnit && (
                                                                        <div className="text-[10px] text-gray-500 font-semibold bg-gray-50 px-1.5 py-0.5 rounded-sm border border-gray-200 flex items-center gap-1 w-fit shadow-sm">
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
                                                    <td className="px-4 py-3 text-gray-600 text-[13px] font-medium">{product.supplier}</td>
                                                    <td className="px-4 py-3 text-center">
                                                        {(() => {
                                                            const cf = parseFloat(product.conversionFactor) || 1;
                                                            const isContainer = (product.unitArchetype === 'BOX' || product.unitArchetype === 'BULK') && cf > 1;
                                                            const hasPackagings = product.packagings?.length > 0;
                                                            const isComplex = isContainer || product.hasLot || hasPackagings;

                                                            if (isComplex) {
                                                                return (
                                                                    <div className="relative flex justify-center" ref={node => pickerRefs.current[product.id] = node}>
                                                                        <button
                                                                            onClick={() => setOpenPackagingPicker(openPackagingPicker === product.id ? null : product.id)}
                                                                            className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#f77500] text-white hover:bg-[#e66a00] rounded-sm text-xs font-bold transition-all shadow-sm active:scale-95 w-full max-w-[120px]"
                                                                        >
                                                                            Modèles
                                                                            <i className={`uil uil-angle-down text-lg transition-transform duration-200 ${openPackagingPicker === product.id ? 'rotate-180' : ''}`}></i>
                                                                        </button>

                                                                        {openPackagingPicker === product.id && (
                                                                            <div className="absolute right-0 top-full mt-1 w-[260px] bg-white rounded-sm shadow-xl border-2 border-[#1c398e] z-50 overflow-hidden transform opacity-100 scale-100 transition-all origin-top-right">
                                                                                <div className="bg-[#1c398e] text-white px-3 py-2 flex justify-between items-center border-b border-[#1c398e]">
                                                                                    <span className="font-bold text-xs uppercase tracking-wider">Sélectionner</span>
                                                                                    <button onClick={(e) => { e.stopPropagation(); setOpenPackagingPicker(null); }} className="text-white/80 hover:text-white transition-colors">
                                                                                        <X className="w-4 h-4" />
                                                                                    </button>
                                                                                </div>
                                                                                <div className="p-2 flex flex-col gap-1.5 bg-gray-50 text-left">
                                                                                    <button className="w-full text-left px-3 py-2 text-xs bg-white hover:bg-blue-50 border border-gray-200 rounded-sm flex justify-between items-center transition-colors shadow-sm group"
                                                                                        onClick={(e) => { e.stopPropagation(); handleAddToQuote(product, { type: 'base' }); }}>
                                                                                        <span className="font-bold text-gray-700 group-hover:text-[#1c398e]">{product.unit || 'Unité'}</span>
                                                                                        <span className="text-[#1c398e] font-black">{formatPrice(product.price)}</span>
                                                                                    </button>
                                                                                    {product.hasLot && product.lotPrice && (
                                                                                        <button className="w-full text-left px-3 py-2 text-xs bg-white hover:bg-amber-50 border border-gray-200 rounded-sm flex justify-between items-center transition-colors shadow-sm group"
                                                                                            onClick={(e) => { e.stopPropagation(); handleAddToQuote(product, { type: 'lot' }); }}>
                                                                                            <span className="font-bold text-gray-700 group-hover:text-amber-600">Lot de {product.retailStepQuantity || 10}</span>
                                                                                            <span className="text-amber-600 font-black">{formatPrice(product.lotPrice)}</span>
                                                                                        </button>
                                                                                    )}
                                                                                    {product.packagings?.map(pkg => (
                                                                                        <button key={pkg.modelId} className="w-full text-left px-3 py-2 text-xs bg-white hover:bg-blue-50 border border-gray-200 rounded-sm flex justify-between items-center transition-colors shadow-sm group"
                                                                                            onClick={(e) => { e.stopPropagation(); handleAddToQuote(product, { type: 'packaging', ...pkg, name: pkg.name }); }}>
                                                                                            <span className="font-bold text-gray-700 group-hover:text-[#1c398e]">{pkg.name}</span>
                                                                                            <span style={{ color: '#1c398e' }} className="font-black">{formatPrice(pkg.price)}</span>
                                                                                        </button>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            }

                                                            return (
                                                                <button
                                                                    onClick={() => handleAddToQuote(product)}
                                                                    className="mx-auto flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#f77500] text-white hover:bg-[#e66a00] rounded-sm text-xs font-bold transition-all shadow-sm active:scale-95 w-full max-w-[120px]"
                                                                >
                                                                    <Plus className="w-3.5 h-3.5" />
                                                                    Select
                                                                </button>
                                                            );
                                                        })()}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Quote Details (Right) */}
                            <div className="w-full lg:w-1/3 flex flex-col bg-gray-50 p-6 overflow-hidden">
                                <div className="mb-6">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Nom du Client <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={newQuoteCustomer}
                                        onChange={(e) => setNewQuoteCustomer(e.target.value)}
                                        placeholder="Entrez le nom du client (Obligatoire)"
                                        className={`w-full px-4 py-2 border-2 rounded-sm focus:outline-none transition-colors ${
                                            !newQuoteCustomer.trim() 
                                                ? 'border-red-500 bg-red-50/30 focus:border-red-600 focus:ring-2 focus:ring-red-200' 
                                                : 'border-gray-300 focus:border-[#1c398e] focus:ring-2 focus:ring-[#1c398e]/20'
                                        }`}
                                    />
                                </div>

                                <div className="flex-1 overflow-y-auto space-y-3 mb-4">
                                    {newQuoteItems.length === 0 ? (
                                        <div className="text-center text-gray-500 py-10">
                                            Aucun article sélectionné.
                                        </div>
                                    ) : (
                                        newQuoteItems.map(item => (
                                            <div key={item.quoteItemKey || item.id} className="bg-white p-3 rounded-sm border border-gray-200 shadow-sm">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-sm text-[#1c398e]">{item.name}</span>
                                                        <span className="text-[11px] text-gray-500 font-semibold">{item.unit || 'Unité'}</span>
                                                    </div>
                                                    <button
                                                        onClick={() => handleRemoveFromQuote(item.quoteItemKey || item.id)}
                                                        className="text-red-400 hover:text-red-600 mt-0.5"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <div className="text-sm font-black text-[#f77500]">
                                                        {formatPrice(item.price * item.quantity)}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => handleUpdateQuantity(item.quoteItemKey || item.id, item.quantity - 1)}
                                                            className="w-6 h-6 flex items-center justify-center bg-gray-100 text-gray-600 rounded-sm hover:bg-gray-200 transition-colors"
                                                        >
                                                            -
                                                        </button>
                                                        <span className="text-sm font-bold w-6 text-center text-gray-800">{item.quantity}</span>
                                                        <button
                                                            onClick={() => handleUpdateQuantity(item.quoteItemKey || item.id, item.quantity + 1)}
                                                            className="w-6 h-6 flex items-center justify-center bg-gray-100 text-gray-600 rounded-sm hover:bg-gray-200 transition-colors"
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>

                                <div className="border-t border-gray-200 pt-4 mt-auto">
                                    <div className="flex justify-between items-center mb-4">
                                        <span className="text-lg font-bold text-gray-900">Total</span>
                                        <span className="text-xl font-bold text-[#1c398e]">{formatPrice(quoteTotal)}</span>
                                    </div>
                                    <button
                                        onClick={handleCreateQuote}
                                        disabled={!newQuoteCustomer.trim() || newQuoteItems.length === 0}
                                        className={`w-full py-3 font-bold rounded-sm shadow-lg transition-all transform flex items-center justify-center gap-2 ${
                                            !newQuoteCustomer.trim() || newQuoteItems.length === 0
                                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none hover:translate-y-0'
                                                : 'bg-[#1c398e] hover:bg-[#162d70] text-white cursor-pointer shadow-[#1c398e]/20 hover:-translate-y-0.5'
                                        }`}
                                    >
                                        Enregistrer le Devis
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Quotes;
