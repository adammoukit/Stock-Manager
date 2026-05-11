import React, { useState } from 'react';
import { usePurchase } from '../../context/PurchaseContext';
import { Loader2 } from 'lucide-react';
import { formatPrice } from '../../utils/currency';
import toast from 'react-hot-toast';

const Suppliers = () => {
    const { suppliers, orders, addSupplier, updateSupplier, deleteSupplier, paySupplier } = usePurchase();

    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [selectedSupplier, setSelectedSupplier] = useState(null);

    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [selectedSupplierForPayment, setSelectedSupplierForPayment] = useState(null);
    const [isPaying, setIsPaying] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        contact: '',
        phone: '',
        email: '',
        address: '',
        balance: 0
    });

    const filteredSuppliers = suppliers.filter(s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.contact?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleOpenModal = (supplier = null) => {
        if (supplier) {
            setSelectedSupplier(supplier);
            setFormData(supplier);
        } else {
            setSelectedSupplier(null);
            setFormData({
                name: '',
                contact: '',
                phone: '',
                email: '',
                address: '',
                balance: 0
            });
        }
        setShowModal(true);
    };

    const handleOpenPaymentModal = (supplier) => {
        setSelectedSupplierForPayment(supplier);
        setPaymentAmount('');
        setShowPaymentModal(true);
    };

    const handlePaymentSubmit = (e) => {
        e.preventDefault();
        const amount = Number(paymentAmount);
        if (amount <= 0) {
            toast.error("Veuillez entrer un montant valide.");
            return;
        }
        if (amount > selectedSupplierForPayment.balance) {
            toast.error("Le montant dépasse la dette actuelle.");
            return;
        }

        setIsPaying(true);
        setTimeout(() => {
            paySupplier(selectedSupplierForPayment.id, amount);
            toast.success(`Paiement de ${formatPrice(amount)} enregistré.`);
            setIsPaying(false);
            setShowPaymentModal(false);
        }, 4000);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            toast.error("Le nom du fournisseur est requis.");
            return;
        }

        if (selectedSupplier) {
            updateSupplier(selectedSupplier.id, formData);
            toast.success("Fournisseur mis à jour avec succès");
        } else {
            addSupplier(formData);
            toast.success("Fournisseur ajouté avec succès");
        }
        setShowModal(false);
    };

    const handleDelete = (id, name) => {
        if (window.confirm(`Voulez-vous vraiment supprimer le fournisseur ${name} ?`)) {
            deleteSupplier(id);
            toast.success("Fournisseur supprimé");
        }
    };

    const totalBalance = suppliers.reduce((sum, s) => sum + (Number(s.balance) || 0), 0);
    const suppliersInDebt = suppliers.filter(s => (Number(s.balance) || 0) > 0).length;
    const totalOrdersCount = orders?.length || 0;
    const [showData, setShowData] = useState(false);

    React.useEffect(() => {
        const timer = setTimeout(() => {
            setShowData(true);
        }, 500); // Small delay for effect
        return () => clearTimeout(timer);
    }, []);

    const StatCard = ({ title, value, icon, iconUrl, color, subtitle, loading, isCurrency = false }) => (
        <div className="bg-white p-5 rounded-sm border-2 border-gray-300 shadow-sm relative group hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col justify-center min-h-[120px]">
            {loading ? (
                <div className="flex flex-col items-center justify-center space-y-3 py-2">
                    <div className="relative h-8 w-8">
                        <div className="absolute inset-0 animate-spin rounded-full border-2 border-t-transparent border-[#018f8f]"></div>
                        <div className="absolute inset-1 animate-spin-reverse rounded-full border-2 border-b-transparent border-[#f77500] opacity-60"></div>
                    </div>
                    <p className="text-[9px] font-black text-[#018f8f] uppercase tracking-[0.2em] animate-pulse">Sync...</p>
                </div>
            ) : (
                <>
                    <div className="relative z-10">
                        <p className="text-[11px] font-bold text-teal-600/70 uppercase tracking-widest mb-1">{title}</p>
                        <div className="flex items-baseline mt-2 font-semibold" style={{ color: '#005f5f' }}>
                            <h3 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                                {isCurrency ? formatPrice(value) : value}
                            </h3>
                        </div>
                        {subtitle && (
                            <p className="text-[10px] text-gray-400 mt-1 font-medium italic">{subtitle}</p>
                        )}
                    </div>

                    {/* Background 3D Illustration */}
                    {iconUrl && (
                        <img
                            src={iconUrl}
                            alt=""
                            crossOrigin="anonymous"
                            className="absolute bottom-1 right-1 w-16 h-16 opacity-90 group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-700 pointer-events-none"
                        />
                    )}
                </>
            )}
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-[#018f8f]">Mes Fournisseurs</h2>
                    <p className="text-gray-500 text-sm mt-1">Gérez votre répertoire de fournisseurs et leurs soldes</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="bg-[#018f8f] hover:bg-teal-700 text-white px-4 py-2 rounded-sm flex items-center gap-2 transition-colors shadow-sm font-semibold text-sm"
                >
                    <i className="uil uil-plus text-lg"></i>
                    Nouveau Fournisseur
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard
                    title="Total Fournisseurs"
                    value={suppliers.length}
                    icon="users-alt"
                    iconUrl="/icons8/fluency_240_group.png"
                    loading={!showData}
                />
                <StatCard
                    title="En Dette"
                    value={suppliersInDebt}
                    icon="exclamation-triangle"
                    iconUrl="/icons8/fluency_240_high-priority.png"
                    subtitle="Fournisseurs à payer"
                    loading={!showData}
                />
                <StatCard
                    title="Dette Globale"
                    value={totalBalance}
                    isCurrency={true}
                    icon="file-text"
                    iconUrl="/icons8/fluency_240_debt.png"
                    loading={!showData}
                />
                <StatCard
                    title="Bons de Commande"
                    value={totalOrdersCount}
                    icon="truck"
                    iconUrl="/icons8/fluency_240_truck.png"
                    subtitle="Total approvisionnements"
                    loading={!showData}
                />
            </div>

            <div className="bg-white rounded-sm border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[500px]">
                <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center gap-4">
                    <div className="relative flex-1 max-w-md">
                        <i className="uil uil-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                        <input
                            type="text"
                            placeholder="Rechercher par nom ou contact..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-sm focus:outline-none focus:ring-2 focus:ring-[#018f8f] bg-white transition-colors text-sm"
                        />
                    </div>
                </div>

                <div className="overflow-y-auto flex-1">
                    <table className="w-full text-left text-sm">
                        <thead style={{ backgroundColor: '#018f8f' }} className="text-white font-bold sticky top-0 z-10 uppercase tracking-wider text-[11px]">
                            <tr>
                                <th className="px-6 py-4">Fournisseur</th>
                                <th className="px-6 py-4">Contact & Coordonnées</th>
                                <th className="px-6 py-4">Adresse</th>
                                <th className="px-6 py-4 text-right">Solde Dû</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y-2 divide-gray-200">
                            {filteredSuppliers.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                                        Aucun fournisseur trouvé.
                                    </td>
                                </tr>
                            ) : (
                                filteredSuppliers.map((supplier) => (
                                    <tr key={supplier.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="font-bold text-gray-900">{supplier.name}</div>
                                                {supplier.balance > 0 && (
                                                    <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-wide flex items-center gap-1">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                                                        Dette
                                                    </span>
                                                )}
                                            </div>
                                            {supplier.contact && <div className="text-xs text-gray-500 flex items-center gap-1 mt-1"><i className="uil uil-user text-[11px]"></i> {supplier.contact}</div>}
                                        </td>
                                        <td className="px-6 py-4 space-y-1">
                                            {supplier.phone && <div className="text-xs text-gray-600 flex items-center gap-1.5"><i className="uil uil-phone text-sm text-gray-400"></i> {supplier.phone}</div>}
                                            {supplier.email && <div className="text-xs text-gray-600 flex items-center gap-1.5"><i className="uil uil-envelope text-sm text-gray-400"></i> {supplier.email}</div>}
                                            {!supplier.phone && !supplier.email && <span className="text-xs text-gray-400 italic">Non renseigné</span>}
                                        </td>
                                        <td className="px-6 py-4">
                                            {supplier.address ? (
                                                <div className="text-xs text-gray-600 flex items-start gap-1.5">
                                                    <i className="uil uil-map-marker text-sm text-gray-400 shrink-0 mt-0.5"></i>
                                                    <span className="line-clamp-2">{supplier.address}</span>
                                                </div>
                                            ) : <span className="text-xs text-gray-400 italic">-</span>}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className={`font-bold ${supplier.balance > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                                                {formatPrice(supplier.balance)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                {supplier.balance > 0 && (
                                                    <button
                                                        onClick={() => handleOpenPaymentModal(supplier)}
                                                        className="px-2 py-1 text-xs font-bold bg-[#018f8f] text-white hover:bg-teal-700 rounded-sm transition-colors shadow-sm"
                                                        title="Enregistrer un paiement"
                                                    >
                                                        Payer
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleOpenModal(supplier)}
                                                    className="p-1.5 text-gray-400 hover:text-[#018f8f] hover:bg-teal-50 rounded-sm transition-colors"
                                                    title="Modifier"
                                                >
                                                    <i className="uil uil-pen text-lg"></i>
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(supplier.id, supplier.name)}
                                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-sm transition-colors"
                                                    title="Supprimer"
                                                >
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

            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-sm shadow-xl w-full max-w-md flex flex-col animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                            <h3 className="text-lg font-bold text-gray-900">
                                {selectedSupplier ? 'Modifier le Fournisseur' : 'Nouveau Fournisseur'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                                &times;
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-5 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nom de l'entreprise <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-sm focus:outline-none focus:ring-2 focus:ring-[#018f8f] text-sm"
                                    placeholder="Ex: Cimco Togo"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nom du contact</label>
                                <input
                                    type="text"
                                    value={formData.contact}
                                    onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-sm focus:outline-none focus:ring-2 focus:ring-[#018f8f] text-sm"
                                    placeholder="Ex: Jean Dupont"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                                    <input
                                        type="tel"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-sm focus:outline-none focus:ring-2 focus:ring-[#018f8f] text-sm"
                                        placeholder="+228..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-sm focus:outline-none focus:ring-2 focus:ring-[#018f8f] text-sm"
                                        placeholder="contact@..."
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
                                <textarea
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-sm focus:outline-none focus:ring-2 focus:ring-[#018f8f] text-sm resize-none"
                                    rows="2"
                                    placeholder="Adresse complète"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Solde initial (Dette)</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="0"
                                        value={formData.balance}
                                        onChange={(e) => setFormData({ ...formData, balance: Number(e.target.value) })}
                                        className="w-full pl-3 pr-12 py-2 border border-gray-200 rounded-sm focus:outline-none focus:ring-2 focus:ring-[#018f8f] text-sm"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">
                                        FCFA
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">Montant que vous devez actuellement à ce fournisseur.</p>
                            </div>

                            <div className="pt-4 flex gap-3 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-sm text-sm transition-colors"
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-2 bg-[#018f8f] hover:bg-teal-700 text-white font-bold rounded-sm text-sm transition-colors"
                                >
                                    {selectedSupplier ? 'Mettre à jour' : 'Enregistrer'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Payment Modal */}
            {showPaymentModal && selectedSupplierForPayment && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-sm shadow-xl w-full max-w-sm flex flex-col animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                            <h3 className="text-lg font-bold text-gray-900">
                                Payer le fournisseur
                            </h3>
                            <button onClick={() => setShowPaymentModal(false)} className="text-gray-400 hover:text-gray-600">
                                &times;
                            </button>
                        </div>

                        <form onSubmit={handlePaymentSubmit} className="p-5 space-y-4">
                            <div className="bg-red-50 p-3 rounded-sm border border-red-100 mb-4">
                                <p className="text-sm text-gray-600">Fournisseur : <span className="font-bold text-gray-900">{selectedSupplierForPayment.name}</span></p>
                                <p className="text-sm text-gray-600">Dette actuelle : <span className="font-bold text-red-600">{formatPrice(selectedSupplierForPayment.balance)}</span></p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Montant du paiement <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        max={selectedSupplierForPayment.balance}
                                        value={paymentAmount}
                                        onChange={(e) => setPaymentAmount(e.target.value)}
                                        className="w-full pl-3 pr-12 py-2 border border-gray-200 rounded-sm focus:outline-none focus:ring-2 focus:ring-[#018f8f] text-sm font-medium"
                                        placeholder="Ex: 50000"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">
                                        FCFA
                                    </span>
                                </div>
                            </div>

                            <div className="pt-4 flex gap-3 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setShowPaymentModal(false)}
                                    className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-sm text-sm transition-colors"
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    disabled={isPaying}
                                    className="flex-1 py-2 bg-[#018f8f] hover:bg-teal-700 text-white font-bold rounded-sm text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
                                >
                                    {isPaying ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Traitement...
                                        </>
                                    ) : (
                                        'Confirmer le paiement'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Suppliers;
