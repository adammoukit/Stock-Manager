import React, { useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { usePurchase } from '../../context/PurchaseContext';
import {
    Plus, Search, Filter, Truck, CheckCircle, Clock,
    AlertTriangle, ChevronDown, ChevronUp, Package,
    FileText, Download, Eye, ShieldAlert
} from 'lucide-react';
import { formatPrice } from '../../utils/currency';

const Replenishment = () => {
    const { products, getLowStockProducts } = useInventory();
    const { orders, suppliers, createOrder, receiveOrder, forceCompleteOrder } = usePurchase();

    const [showNewOrderModal, setShowNewOrderModal] = useState(false);
    const [showReceiveModal, setShowReceiveModal] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [filterStatus, setFilterStatus] = useState('All');

    // New Order State
    const [newOrderData, setNewOrderData] = useState({
        supplier: '',
        items: [] // { id, name, quantity, purchasePrice, stock, minStock }
    });
    const [productSearch, setProductSearch] = useState('');
    const [onlyLowStock, setOnlyLowStock] = useState(false);

    // Receive Order State
    const [receiveData, setReceiveData] = useState({}); // { productId: quantity }
    const [receivedBy, setReceivedBy] = useState('');
    const [isPaidCash, setIsPaidCash] = useState(false);

    // Filtered Orders
    const filteredOrders = orders.filter(order =>
        filterStatus === 'All' || order.status === filterStatus
    ).sort((a, b) => new Date(b.date) - new Date(a.date));

    // Product Selection Logic
    const availableProducts = products.filter(p =>
        (onlyLowStock ? p.stock <= p.minStock : true) &&
        p.name?.toLowerCase().includes(productSearch.toLowerCase())
    );

    const handleAddToOrder = (product) => {
        if (newOrderData.items.find(i => i.id === product.id)) return;

        // Suggest quantity: minStock * 2 or sufficient to reach safe level
        const suggestedQty = Math.max(10, (product.minStock * 2) - product.stock);

        setNewOrderData({
            ...newOrderData,
            items: [...newOrderData.items, {
                id: product.id,
                name: product.name,
                quantity: suggestedQty,
                purchasePrice: product.purchasePrice,
                stock: product.stock,
                minStock: product.minStock
            }]
        });
    };

    const handleRemoveFromOrder = (productId) => {
        setNewOrderData({
            ...newOrderData,
            items: newOrderData.items.filter(i => i.id !== productId)
        });
    };

    const handleCreateOrder = () => {
        if (!newOrderData.supplier || newOrderData.items.length === 0) return;

        createOrder(newOrderData.supplier, newOrderData.items);
        setShowNewOrderModal(false);
        setNewOrderData({ supplier: '', items: [] });
    };

    const openReceiveModal = (order) => {
        setSelectedOrder(order);
        setReceiveData({});
        setReceivedBy(''); // Reset received by
        setIsPaidCash(false);
        setShowReceiveModal(true);
    };

    const openDetailsModal = (order) => {
        setSelectedOrder(order);
        setShowDetailsModal(true);
    };

    const handleReceiveOrder = () => {
        if (!selectedOrder) return;
        if (!receivedBy.trim()) {
            alert("Veuillez entrer le nom du réceptionneur.");
            return;
        }
        receiveOrder(selectedOrder.id, receiveData, receivedBy, isPaidCash);
        setShowReceiveModal(false);
        setSelectedOrder(null);
    };

    const handleForceComplete = () => {
        if (!selectedOrder) return;
        const confirm = window.confirm("Action Manager Requise\n\nÊtes-vous sûr de vouloir clôturer cette commande partiellement livrée ?\nCette action est irréversible.");
        if (confirm) {
            forceCompleteOrder(selectedOrder.id);
            setShowDetailsModal(false);
            setSelectedOrder(null);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'Completed': return 'bg-green-100 text-green-700';
            case 'Partial': return 'bg-orange-100 text-orange-700';
            case 'Ordered': return 'bg-blue-100 text-blue-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-[#1c398e]">Réapprovisionnement</h2>
                    <p className="text-gray-500">Gérez vos commandes fournisseurs et stocks entrants</p>
                </div>
                <button
                    onClick={() => setShowNewOrderModal(true)}
                    className="bg-[#1c398e] hover:bg-blue-800 text-white px-4 py-2 rounded-sm flex items-center gap-2 transition-colors shadow-sm font-semibold"
                >
                    <Plus className="w-5 h-5" />
                    Nouvelle Commande
                </button>
            </div>

            {/* Filters */}
            <div className="flex gap-2 overflow-x-auto pb-2">
                {['All', 'Ordered', 'Partial', 'Completed'].map(status => (
                    <button
                        key={status}
                        onClick={() => setFilterStatus(status)}
                        className={`px-4 py-2 rounded-sm text-sm font-medium whitespace-nowrap transition-colors ${filterStatus === status
                            ? 'bg-gray-900 text-white'
                            : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                            }`}
                    >
                        {status === 'All' ? 'Tous' :
                            status === 'Ordered' ? 'Commandé' :
                                status === 'Partial' ? 'Partiellement Reçu' : 'Terminé'}
                    </button>
                ))}
            </div>

            {/* Orders List */}
            <div className="bg-white rounded-sm border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead style={{ backgroundColor: '#1c398e' }} className="text-white font-bold sticky top-0 z-10 shadow-sm uppercase tracking-wider text-[11px]">
                            <tr>
                                <th className="px-6 py-4">N° Commande</th>
                                <th className="px-6 py-4">Fournisseur</th>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4">Montant</th>
                                <th className="px-6 py-4">Reçu Par</th>
                                <th className="px-6 py-4">Statut</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                                <tbody className="divide-y-2 divide-gray-200">
                            {filteredOrders.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                                        Aucune commande trouvée.
                                    </td>
                                </tr>
                            ) : (
                                filteredOrders.map((order) => (
                                    <tr key={order.id} className="hover:bg-gray-50 transition-colors group">
                                        <td className="px-6 py-4 font-medium text-gray-900">
                                            <div className="flex items-center gap-2">
                                                {order.orderNumber}
                                                {order.status !== 'Completed' && (
                                                    <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-wide flex items-center gap-1">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>
                                                        Action Requise
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">{order.supplier}</td>
                                        <td className="px-6 py-4 text-gray-500">
                                            {new Date(order.date).toLocaleDateString('fr-FR')}
                                        </td>
                                        <td className="px-6 py-4 font-medium">
                                            {formatPrice(order.totalAmount)}
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">
                                            {order.receivedBy || '-'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${getStatusColor(order.status)}`}>
                                                {order.status === 'Ordered' ? 'Commandé' :
                                                    order.status === 'Partial' ? 'Partiel' : 'Terminé'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => openDetailsModal(order)}
                                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-sm transition-colors"
                                                title="Voir détails"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            {order.status !== 'Completed' && (
                                                <button
                                                    onClick={() => openReceiveModal(order)}
                                                    className="flex items-center gap-2 bg-[#1c398e] hover:bg-blue-800 cursor-pointer text-white font-medium text-sm px-4 py-2 rounded-sm transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                                                >
                                                    <Truck className="w-4 h-4" />
                                                    Réceptionner
                                                </button>
                                            )}
                                            {order.status === 'Completed' && (
                                                <span className="text-green-600 flex items-center justify-end gap-1 text-sm px-3 py-1.5">
                                                    <CheckCircle className="w-4 h-4" /> Reçu
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* New Order Modal */}
            {showNewOrderModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-sm shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-gray-900">Nouvelle Commande</h3>
                            <button onClick={() => setShowNewOrderModal(false)} className="text-gray-400 hover:text-gray-600">
                                &times;
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Supplier Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Fournisseur</label>
                                <select
                                    value={newOrderData.supplier}
                                    onChange={(e) => setNewOrderData({ ...newOrderData, supplier: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-sm focus:outline-none focus:ring-2 focus:ring-[#1c398e]"
                                >
                                    <option value="">Sélectionner un fournisseur</option>
                                    {suppliers.map(s => (<option key={s.id || s.name || s} value={s.name || s}>{s.name || s}</option>))}
                                </select>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-96">
                                {/* Product Selection */}
                                <div className="border border-gray-200 rounded-sm flex flex-col">
                                    <div className="p-3 border-b border-gray-200 bg-gray-50">
                                        <div className="relative mb-2">
                                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                            <input
                                                type="text"
                                                placeholder="Rechercher produit..."
                                                value={productSearch}
                                                onChange={(e) => setProductSearch(e.target.value)}
                                                className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-sm"
                                            />
                                        </div>
                                        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={onlyLowStock}
                                                onChange={(e) => setOnlyLowStock(e.target.checked)}
                                                className="rounded-sm text-[#1c398e] focus:ring-[#1c398e]"
                                            />
                                            Uniquement stock faible
                                        </label>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                        {availableProducts.map(p => (
                                            <div
                                                key={p.id}
                                                onClick={() => handleAddToOrder(p)}
                                                className="p-2 hover:bg-gray-50 rounded-sm cursor-pointer flex justify-between items-center border border-transparent hover:border-gray-200 transition-all"
                                            >
                                                <div>
                                                    <p className="font-bold text-sm text-gray-900">{p.name?.toUpperCase()}</p>
                                                    <p className="text-xs text-gray-500">Stock: {p.stock} | Min: {p.minStock}</p>
                                                </div>
                                                {p.stock <= p.minStock && <AlertTriangle className="w-4 h-4 text-red-500" />}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Order Items */}
                                <div className="border border-gray-200 rounded-sm flex flex-col">
                                    <div className="p-3 border-b border-gray-200 bg-gray-50 font-medium text-gray-700">
                                        Produits à commander ({newOrderData.items.length})
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                                        {newOrderData.items.length === 0 ? (
                                            <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                                                Sélectionnez des produits à gauche
                                            </div>
                                        ) : (
                                            newOrderData.items.map(item => (
                                                <div key={item.id} className="p-3 bg-gray-50 rounded-sm border border-gray-200">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <span className="font-bold text-sm">{item.name?.toUpperCase()}</span>
                                                        <button
                                                            onClick={() => handleRemoveFromOrder(item.id)}
                                                            className="text-red-400 hover:text-red-600"
                                                        >
                                                            &times;
                                                        </button>
                                                    </div>
                                                    <div className="flex gap-3">
                                                        <div className="flex-1">
                                                            <label className="text-xs text-gray-500 block mb-1">Quantité</label>
                                                            <input
                                                                type="number"
                                                                value={item.quantity}
                                                                onChange={(e) => {
                                                                    const items = newOrderData.items.map(i =>
                                                                        i.id === item.id ? { ...i, quantity: parseInt(e.target.value) || 0 } : i
                                                                    );
                                                                    setNewOrderData({ ...newOrderData, items });
                                                                }}
                                                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded-sm"
                                                            />
                                                        </div>
                                                        <div className="flex-1">
                                                            <label className="text-xs text-gray-500 block mb-1">Prix Achat</label>
                                                            <input
                                                                type="number"
                                                                value={item.purchasePrice}
                                                                onChange={(e) => {
                                                                    const items = newOrderData.items.map(i =>
                                                                        i.id === item.id ? { ...i, purchasePrice: parseFloat(e.target.value) || 0 } : i
                                                                    );
                                                                    setNewOrderData({ ...newOrderData, items });
                                                                }}
                                                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded-sm"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-200 flex justify-end gap-3 bg-gray-50 rounded-b">
                            <button
                                onClick={() => setShowNewOrderModal(false)}
                                className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-200 rounded-sm transition-colors"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleCreateOrder}
                                disabled={!newOrderData.supplier || newOrderData.items.length === 0}
                                className="px-6 py-2 bg-[#1c398e] text-white hover:bg-blue-800 cursor-pointer font-bold rounded-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-[#1c398e]/20"
                            >
                                Créer la Commande
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Receive Order Modal */}
            {showReceiveModal && selectedOrder && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-sm shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                        <div className="p-6 border-b border-gray-200">
                            <h3 className="text-xl font-bold text-gray-900">Réception Commande {selectedOrder.orderNumber}</h3>
                            <p className="text-sm text-gray-500">{selectedOrder.supplier} - {new Date(selectedOrder.date).toLocaleDateString()}</p>
                        </div>

                        <div className="p-6 bg-gray-50 border-b border-gray-200 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Réceptionné par <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    value={receivedBy}
                                    onChange={(e) => setReceivedBy(e.target.value)}
                                    placeholder="Nom du réceptionneur"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-sm focus:ring-2 focus:ring-[#1c398e] focus:outline-none"
                                />
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer bg-white p-3 border border-gray-200 rounded-sm">
                                <input 
                                    type="checkbox" 
                                    checked={isPaidCash}
                                    onChange={(e) => setIsPaidCash(e.target.checked)}
                                    className="w-4 h-4 text-[#1c398e] rounded-sm focus:ring-[#1c398e]"
                                />
                                <div>
                                    <span className="text-sm font-bold text-gray-900 block">Payé au comptant (Cash/Virement)</span>
                                    <span className="text-xs text-gray-500 block">Cochez si la marchandise a été réglée immédiatement. La dette du fournisseur n'augmentera pas.</span>
                                </div>
                            </label>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            <table className="w-full text-left text-sm">
                                <thead style={{ backgroundColor: '#1c398e' }} className="text-white font-bold uppercase tracking-wider text-[11px]">
                                    <tr>
                                        <th className="px-4 py-3">Produit</th>
                                        <th className="px-4 py-3">Commandé</th>
                                        <th className="px-4 py-3">Déjà Reçu</th>
                                        <th className="px-4 py-3">Reçu Maintenant</th>
                                    </tr>
                                </thead>
                                        <tbody className="divide-y-2 divide-gray-200">
                                    {selectedOrder.items.map(item => (
                                        <tr key={item.productId}>
                                            <td className="px-4 py-3 font-bold">{item.name?.toUpperCase()}</td>
                                            <td className="px-4 py-3">{item.quantityOrdered}</td>
                                            <td className="px-4 py-3">{item.quantityReceived}</td>
                                            <td className="px-4 py-3">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max={item.quantityOrdered - item.quantityReceived}
                                                    placeholder="0"
                                                    className="w-24 px-2 py-1 border border-gray-300 rounded-sm focus:ring-2 focus:ring-[#1c398e] focus:outline-none"
                                                    onChange={(e) => setReceiveData({
                                                        ...receiveData,
                                                        [item.productId]: e.target.value
                                                    })}
                                                    disabled={item.quantityReceived >= item.quantityOrdered}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="p-6 border-t border-gray-200 flex justify-end gap-3 bg-gray-50 rounded-b">
                            <button
                                onClick={() => setShowReceiveModal(false)}
                                className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-200 rounded-sm transition-colors"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleReceiveOrder}
                                className="px-6 py-2 bg-[#1c398e] text-white font-bold rounded-sm hover:bg-blue-800 transition-colors shadow-lg shadow-[#1c398e]/20"
                            >
                                Valider la Réception
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* View Details Modal */}
            {showDetailsModal && selectedOrder && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-sm shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">Détails Commande {selectedOrder.orderNumber}</h3>
                                <p className="text-sm text-gray-500">{selectedOrder.supplier} - {new Date(selectedOrder.date).toLocaleDateString()}</p>
                            </div>
                            <button onClick={() => setShowDetailsModal(false)} className="text-gray-400 hover:text-gray-600">
                                &times;
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Status Banner */}
                            <div className={`p-4 rounded-sm border ${selectedOrder.status === 'Completed' ? 'bg-green-50 border-green-200' :
                                selectedOrder.status === 'Partial' ? 'bg-orange-50 border-orange-200' : 'bg-blue-50 border-blue-200'
                                }`}>
                                <div className="flex items-center gap-2">
                                    <span className={`font-bold ${selectedOrder.status === 'Completed' ? 'text-green-800' :
                                        selectedOrder.status === 'Partial' ? 'text-orange-800' : 'text-blue-800'
                                        }`}>
                                        Statut: {selectedOrder.status === 'Ordered' ? 'Commandé' :
                                            selectedOrder.status === 'Partial' ? 'Partiellement Reçu' : 'Terminé'}
                                    </span>
                                </div>
                                {selectedOrder.notes && (
                                    <p className="text-sm mt-1 text-gray-600 italic">{selectedOrder.notes}</p>
                                )}
                            </div>

                            {/* Items Table */}
                            <table className="w-full text-left text-sm">
                                <thead style={{ backgroundColor: '#1c398e' }} className="text-white font-bold uppercase tracking-wider text-[11px]">
                                    <tr>
                                        <th className="px-4 py-3">Produit</th>
                                        <th className="px-4 py-3 text-right">Prix Achat</th>
                                        <th className="px-4 py-3 text-center">Commandé</th>
                                        <th className="px-4 py-3 text-center">Reçu</th>
                                        <th className="px-4 py-3 text-right">Total</th>
                                    </tr>
                                </thead>
                                        <tbody className="divide-y-2 divide-gray-200">
                                    {selectedOrder.items.map(item => (
                                        <tr key={item.productId}>
                                            <td className="px-4 py-3 font-bold">{item.name?.toUpperCase()}</td>
                                            <td className="px-4 py-3 text-right">{formatPrice(item.purchasePrice)}</td>
                                            <td className="px-4 py-3 text-center">{item.quantityOrdered}</td>
                                            <td className={`px-4 py-3 text-center font-bold ${item.quantityReceived < item.quantityOrdered ? 'text-orange-600' : 'text-green-600'
                                                }`}>
                                                {item.quantityReceived}
                                            </td>
                                            <td className="px-4 py-3 text-right font-medium">
                                                {formatPrice(item.purchasePrice * item.quantityOrdered)}
                                            </td>
                                        </tr>
                                    ))}
                                    <tr className="bg-gray-50 font-bold">
                                        <td colSpan="4" className="px-4 py-3 text-right">Total Commande</td>
                                        <td className="px-4 py-3 text-right">{formatPrice(selectedOrder.totalAmount)}</td>
                                    </tr>
                                </tbody>
                            </table>

                            {/* Manager Action for Partial Orders */}
                            {selectedOrder.status === 'Partial' && (
                                <div className="mt-6 p-4 border border-red-200 bg-red-50 rounded-sm">
                                    <div className="flex items-start gap-3">
                                        <ShieldAlert className="w-6 h-6 text-red-600 flex-shrink-0" />
                                        <div className="flex-1">
                                            <h4 className="font-bold text-red-900">Zone Manager</h4>
                                            <p className="text-sm text-red-700 mt-1">
                                                Cette commande est partiellement livrée. Si le reste des produits ne sera jamais livré, vous pouvez forcer la clôture de la commande.
                                            </p>
                                            <button
                                                onClick={handleForceComplete}
                                                className="mt-3 px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-sm hover:bg-red-700 transition-colors shadow-sm"
                                            >
                                                Forcer la Clôture (Directeur)
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t border-gray-200 flex justify-end bg-gray-50 rounded-b">
                            <button
                                onClick={() => setShowDetailsModal(false)}
                                className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-200 rounded-sm transition-colors"
                            >
                                Fermer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Replenishment;
