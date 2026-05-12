import React, { useState } from 'react';
import { useSales } from '../../context/SalesContext';
import { useInventory } from '../../context/InventoryContext';
import { FileText, Trash2, Check, Printer, Plus, Search, AlertTriangle, X, MessageCircle } from 'lucide-react';
import { formatPrice } from '../../utils/currency';

const Quotes = () => {
    const { quotes, deleteQuote, convertQuoteToSale, addQuoteWithItems } = useSales();
    const { products } = useInventory();

    const [showNewQuoteModal, setShowNewQuoteModal] = useState(false);
    const [newQuoteCustomer, setNewQuoteCustomer] = useState('');
    const [newQuoteItems, setNewQuoteItems] = useState([]);
    const [productSearch, setProductSearch] = useState('');

    const handlePrintQuote = (quote) => {
        const printWindow = window.open('', '', 'height=600,width=800');
        printWindow.document.write('<html><head><title>Devis</title>');
        printWindow.document.write('<style>');
        printWindow.document.write(`
            body { font-family: sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            h1 { color: #333; }
            .header { margin-bottom: 20px; }
            .total { font-weight: bold; margin-top: 20px; text-align: right; font-size: 1.2em; }
        `);
        printWindow.document.write('</style></head><body>');
        printWindow.document.write('<div class="header">');
        printWindow.document.write(`<h1>Devis</h1>`);
        printWindow.document.write(`<p>Client: <strong>${quote.customerName}</strong></p>`);
        printWindow.document.write(`<p>Date: ${new Date(quote.date).toLocaleString('fr-FR')}</p>`);
        printWindow.document.write('</div>');

        printWindow.document.write('<table>');
        printWindow.document.write('<thead><tr><th>Produit</th><th>Prix Unitaire</th><th>Quantité</th><th>Total</th></tr></thead>');
        printWindow.document.write('<tbody>');

        quote.items.forEach(item => {
            printWindow.document.write(`
                <tr>
                    <td>${item.name}</td>
                    <td>${formatPrice(item.price)}</td>
                    <td>${item.quantity}</td>
                    <td>${formatPrice(item.price * item.quantity)}</td>
                </tr>
            `);
        });

        printWindow.document.write('</tbody></table>');
        printWindow.document.write(`<div class="total">Total: ${formatPrice(quote.total)}</div>`);
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        printWindow.print();
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

    const handleAddToQuote = (product) => {
        setNewQuoteItems(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) {
                return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
            }
            return [...prev, { ...product, quantity: 1 }];
        });
    };

    const handleRemoveFromQuote = (productId) => {
        setNewQuoteItems(prev => prev.filter(item => item.id !== productId));
    };

    const handleUpdateQuantity = (productId, quantity) => {
        if (quantity <= 0) {
            handleRemoveFromQuote(productId);
            return;
        }
        setNewQuoteItems(prev => prev.map(item => item.id === productId ? { ...item, quantity } : item));
    };

    const handleCreateQuote = () => {
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

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-[#1c398e]">Devis & Proformas</h2>
                    <p className="text-gray-500">Gérez les devis clients et convertissez-les en ventes</p>
                </div>
                <button
                    onClick={() => setShowNewQuoteModal(true)}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-sm flex items-center gap-2 transition-colors shadow-sm font-bold"
                >
                    <Plus className="w-5 h-5" />
                    Créer un Devis
                </button>
            </div>

            <div className="bg-white rounded-sm border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead style={{ backgroundColor: '#1c398e' }} className="text-white font-bold sticky top-0 z-10 shadow-sm uppercase tracking-wider text-[11px]">
                            <tr>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4">Client</th>
                                <th className="px-6 py-4">Articles</th>
                                <th className="px-6 py-4">Total</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y-2 divide-gray-200">
                            {quotes.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                                        Aucun devis enregistré.
                                    </td>
                                </tr>
                            ) : (
                                quotes.map((quote) => (
                                    <tr key={quote.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 text-gray-900">
                                            {new Date(quote.date).toLocaleString('fr-FR')}
                                        </td>
                                        <td className="px-6 py-4 font-medium text-gray-900">{quote.customerName}</td>
                                        <td className="px-6 py-4 text-gray-600">
                                            {quote.items.length} articles
                                            <div className="text-xs text-gray-400 mt-1">
                                                {quote.items.map(i => i.name).join(', ').substring(0, 30)}...
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-bold text-gray-900">
                                            {formatPrice(quote.total)}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => handlePrintQuote(quote)}
                                                    className="p-2 text-gray-500 hover:bg-gray-100 rounded-sm transition-colors"
                                                    title="Imprimer"
                                                >
                                                    <Printer className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleWhatsAppQuote(quote)}
                                                    className="p-2 text-green-600 hover:bg-green-100 rounded-sm transition-colors"
                                                    title="Envoyer sur WhatsApp"
                                                >
                                                    <MessageCircle className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (window.confirm('Voulez-vous convertir ce devis en vente ? Le stock sera déduit.')) {
                                                            convertQuoteToSale(quote);
                                                        }
                                                    }}
                                                    className="p-2 text-green-600 hover:bg-green-50 rounded-sm transition-colors"
                                                    title="Convertir en Vente"
                                                >
                                                    <Check className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (window.confirm('Supprimer ce devis ?')) {
                                                            deleteQuote(quote.id);
                                                        }
                                                    }}
                                                    className="p-2 text-red-500 hover:bg-red-50 rounded-sm transition-colors"
                                                    title="Supprimer"
                                                >
                                                    <Trash2 className="w-4 h-4" />
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
                    <div className="bg-white rounded-sm shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
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
                                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                        />
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto border border-gray-200 rounded-sm">
                                    <table className="w-full text-left text-sm">
                                        <thead style={{ backgroundColor: '#1c398e' }} className="text-white font-bold sticky top-0 z-10 shadow-sm uppercase tracking-wider text-[11px]">
                                            <tr>
                                                <th className="px-4 py-3">Produit</th>
                                                <th className="px-4 py-3">Catégorie</th>
                                                <th className="px-4 py-3">Prix</th>
                                                <th className="px-4 py-3">Stock</th>
                                                <th className="px-4 py-3">Fournisseur</th>
                                                <th className="px-4 py-3 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y-2 divide-gray-200">
                                            {filteredProducts.map((product) => (
                                                <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-4 py-3 font-medium text-gray-900">{product.name}</td>
                                                    <td className="px-4 py-3 text-gray-600">
                                                        <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-sm text-xs">
                                                            {product.category}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 font-medium">{formatPrice(product.price)}</td>
                                                    <td className="px-4 py-3">
                                                        <div className={`flex items-center gap-1 ${product.stock <= product.minStock ? 'text-red-600 font-bold' : 'text-green-600'}`}>
                                                            {product.stock <= product.minStock && <AlertTriangle className="w-3 h-3" />}
                                                            {product.stock}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-gray-500 text-sm">{product.supplier}</td>
                                                    <td className="px-4 py-3 text-right">
                                                        <button
                                                            onClick={() => handleAddToQuote(product)}
                                                            className="px-3 py-1 bg-primary-50 text-primary-600 hover:bg-primary-100 rounded-sm text-xs font-bold transition-colors"
                                                        >
                                                            Ajouter
                                                        </button>
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
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Nom du Client</label>
                                    <input
                                        type="text"
                                        value={newQuoteCustomer}
                                        onChange={(e) => setNewQuoteCustomer(e.target.value)}
                                        placeholder="Entrez le nom du client"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                                    />
                                </div>

                                <div className="flex-1 overflow-y-auto space-y-3 mb-4">
                                    {newQuoteItems.length === 0 ? (
                                        <div className="text-center text-gray-500 py-10">
                                            Aucun article sélectionné.
                                        </div>
                                    ) : (
                                        newQuoteItems.map(item => (
                                            <div key={item.id} className="bg-white p-3 rounded-sm border border-gray-200 shadow-sm">
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="font-medium text-sm text-gray-900">{item.name}</span>
                                                    <button
                                                        onClick={() => handleRemoveFromQuote(item.id)}
                                                        className="text-red-400 hover:text-red-600"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <div className="text-sm font-medium text-primary-600">
                                                        {formatPrice(item.price * item.quantity)}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                                                            className="w-6 h-6 flex items-center justify-center bg-gray-100 rounded-sm hover:bg-gray-200"
                                                        >
                                                            -
                                                        </button>
                                                        <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                                                        <button
                                                            onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                                                            className="w-6 h-6 flex items-center justify-center bg-gray-100 rounded-sm hover:bg-gray-200"
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
                                        <span className="text-xl font-bold text-primary-600">{formatPrice(quoteTotal)}</span>
                                    </div>
                                    <button
                                        onClick={handleCreateQuote}
                                        className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-sm shadow-lg shadow-green-600/20 transition-all transform hover:-translate-y-0.5"
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
