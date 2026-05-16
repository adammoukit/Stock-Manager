import React, { useState } from 'react';
import { useClients } from '../../context/ClientContext';
import { useSales } from '../../context/SalesContext';
import { Search, Plus, User, Edit2, Trash2, X, AlertTriangle } from 'lucide-react';
import { formatPrice } from '../../utils/currency';

const Clients = () => {
    const { clients, addClient, updateClient, deleteClient } = useClients();
    const { debts } = useSales();
    const [searchTerm, setSearchTerm] = useState('');
    
    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        email: '',
        address: '',
        type: 'particulier',
        nif: ''
    });

    // Calculate debts for each client
    const clientDebts = clients.map(client => {
        const clientActiveDebts = debts.filter(d => d.status === 'pending' && d.customerName.toLowerCase() === client.name.toLowerCase());
        const totalDebt = clientActiveDebts.reduce((sum, d) => sum + (d.totalAmount - d.paidAmount), 0);
        return { ...client, totalDebt };
    });

    const filteredClients = clientDebts.filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        c.phone.includes(searchTerm)
    );

    const handleOpenModal = (client = null) => {
        if (client) {
            setEditingClient(client);
            setFormData({
                name: client.name,
                phone: client.phone || '',
                email: client.email || '',
                address: client.address || '',
                type: client.type || 'particulier',
                nif: client.nif || ''
            });
        } else {
            setEditingClient(null);
            setFormData({
                name: '',
                phone: '',
                email: '',
                address: '',
                type: 'particulier',
                nif: ''
            });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingClient(null);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            alert('Le nom du client est obligatoire.');
            return;
        }

        if (editingClient) {
            updateClient(editingClient.id, formData);
        } else {
            addClient(formData);
        }
        handleCloseModal();
    };

    const handleDelete = (id, name, totalDebt) => {
        if (totalDebt > 0) {
            alert(`Impossible de supprimer ce client. Il a une dette active de ${formatPrice(totalDebt)}.`);
            return;
        }
        if (window.confirm(`Voulez-vous vraiment supprimer le client "${name}" ?`)) {
            deleteClient(id);
        }
    };

    const handleWhatsApp = (phone, name, debt) => {
        if (!phone) {
            alert('Ce client n\'a pas de numéro de téléphone enregistré.');
            return;
        }
        let text = `Bonjour ${name},`;
        if (debt > 0) {
            text += `\n\nSauf erreur de notre part, votre solde débiteur s'élève à *${formatPrice(debt)}*.\nMerci de bien vouloir régulariser votre situation.\n`;
        }
        text += `\nCordialement,\nLa Quincaillerie.`;
        
        const encoded = encodeURIComponent(text);
        // Format phone number if needed (e.g., add country code if missing)
        window.open(`https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encoded}`, '_blank');
    };

    return (
        <div className="p-6 h-full flex flex-col gap-6 overflow-y-auto custom-scrollbar bg-[#f0f4f8]">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-[#1c398e] tracking-tight">Répertoire Clients</h2>
                    <p className="text-gray-500 text-sm mt-1 font-medium">Gérez vos clients, contacts et plafonds de crédit</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-sm border-2 border-gray-300 shadow-sm">
                    <p className="text-[11px] font-bold text-blue-600/70 uppercase tracking-widest mb-1">Total Clients</p>
                    <h3 className="text-xl sm:text-2xl font-semibold text-[#1c398e]">{clients.length}</h3>
                </div>
                <div className="bg-white p-4 rounded-sm border-2 border-gray-300 shadow-sm">
                    <p className="text-[11px] font-bold text-red-600/70 uppercase tracking-widest mb-1">Clients Débiteurs</p>
                    <h3 className="text-xl sm:text-2xl font-semibold text-red-600">{clientDebts.filter(c => c.totalDebt > 0).length}</h3>
                </div>
            </div>

            <div className="bg-white border-2 border-gray-300 rounded-sm shadow-sm overflow-hidden">
                <div className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex-1 relative group max-w-md">
                        <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#1c398e] transition-colors" />
                        <input
                            type="text"
                            placeholder="Rechercher par nom, téléphone..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-sm focus:outline-none focus:border-[#1c398e] focus:ring-4 focus:ring-[#1c398e]/5 text-sm font-bold text-gray-800 placeholder:text-gray-400"
                        />
                    </div>
                    <button
                        onClick={() => handleOpenModal()}
                        className="flex items-center justify-center gap-2 bg-[#f77500] hover:bg-[#e66a00] text-white px-6 py-3 rounded-sm font-black text-xs uppercase tracking-wider shadow-md transition-all active:scale-95"
                    >
                        <Plus className="w-5 h-5" />
                        Nouveau Client
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-sm border-2 border-gray-300 shadow-sm overflow-hidden flex-1">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead style={{ backgroundColor: '#365ac9' }} className="text-white font-bold sticky top-0 z-10 shadow-sm uppercase tracking-wider text-[11px]">
                            <tr className="divide-x-2 divide-[#224099]/40">
                                <th className="px-4 py-3">Client</th>
                                <th className="px-4 py-3">Contact</th>
                                <th className="px-4 py-3">Type</th>
                                <th className="px-4 py-3">Solde Débiteur</th>
                                <th className="px-4 py-3 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y-2 divide-[#e6e6e6]">
                            {filteredClients.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-8 text-center text-gray-500 font-bold">
                                        Aucun client trouvé.
                                    </td>
                                </tr>
                            ) : (
                                filteredClients.map((client) => (
                                    <tr key={client.id} className="divide-x-2 divide-[#e6e6e6] hover:bg-blue-50/40 transition-colors odd:bg-[#f3f3f3] even:bg-[#ffffff]">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-gray-200 p-2 rounded-full hidden sm:block">
                                                    <User className="w-4 h-4 text-gray-500" />
                                                </div>
                                                <div>
                                                    <div className="font-bold text-[#1c398e] text-[13px] tracking-wide uppercase">{client.name}</div>
                                                    {client.address && <div className="text-[10px] text-gray-500 mt-0.5">{client.address}</div>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-gray-700">{client.phone || '-'}</div>
                                            {client.email && <div className="text-[10px] text-gray-500">{client.email}</div>}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded-sm text-[10px] font-bold uppercase tracking-wider border ${
                                                client.type === 'entreprise' 
                                                ? 'bg-purple-50 text-purple-700 border-purple-200' 
                                                : 'bg-gray-100 text-gray-600 border-gray-200'
                                            }`}>
                                                {client.type}
                                            </span>
                                            {client.type === 'entreprise' && client.nif && (
                                                <div className="text-[9px] text-gray-400 mt-1">NIF: {client.nif}</div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            {client.totalDebt > 0 ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                                                    <span className="font-black text-red-600">{formatPrice(client.totalDebt)}</span>
                                                </div>
                                            ) : (
                                                <span className="font-bold text-gray-400">0 FCFA</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex justify-center gap-1">
                                                <button 
                                                    onClick={() => handleWhatsApp(client.phone, client.name, client.totalDebt)}
                                                    className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-sm transition-colors" 
                                                    title="Contacter sur WhatsApp"
                                                >
                                                    <i className="uil uil-whatsapp text-lg"></i>
                                                </button>
                                                <button 
                                                    onClick={() => handleOpenModal(client)}
                                                    className="p-2 text-gray-400 hover:text-[#1c398e] hover:bg-blue-50 rounded-sm transition-colors" 
                                                    title="Modifier"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(client.id, client.name, client.totalDebt)}
                                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-sm transition-colors" 
                                                    title="Supprimer"
                                                    disabled={client.id === '1'} // Prevent deleting the default client
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

            {/* Client Form Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-sm border-2 border-[#1c398e] shadow-xl w-full max-w-lg flex flex-col overflow-hidden">
                        <div className="flex justify-between items-center p-4 border-b-2 border-gray-200 bg-gray-50">
                            <h3 className="text-lg font-bold text-[#1c398e] uppercase tracking-wide">
                                {editingClient ? 'Modifier le Client' : 'Nouveau Client'}
                            </h3>
                            <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wide mb-1">
                                        Nom du Client / Entreprise <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="name"
                                        required
                                        value={formData.name}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 border-2 border-gray-300 rounded-sm focus:outline-none focus:border-[#1c398e] font-semibold"
                                        placeholder="Ex: Jean Dupont"
                                    />
                                </div>
                                
                                <div className="col-span-2 sm:col-span-1">
                                    <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wide mb-1">
                                        Téléphone
                                    </label>
                                    <input
                                        type="text"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 border-2 border-gray-300 rounded-sm focus:outline-none focus:border-[#1c398e]"
                                        placeholder="Ex: +221..."
                                    />
                                </div>

                                <div className="col-span-2 sm:col-span-1">
                                    <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wide mb-1">
                                        Email
                                    </label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 border-2 border-gray-300 rounded-sm focus:outline-none focus:border-[#1c398e]"
                                    />
                                </div>

                                <div className="col-span-2">
                                    <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wide mb-1">
                                        Type de Client
                                    </label>
                                    <div className="flex gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input 
                                                type="radio" 
                                                name="type" 
                                                value="particulier" 
                                                checked={formData.type === 'particulier'} 
                                                onChange={handleChange}
                                                className="accent-[#1c398e]"
                                            />
                                            <span className="text-sm font-medium">Particulier</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input 
                                                type="radio" 
                                                name="type" 
                                                value="entreprise" 
                                                checked={formData.type === 'entreprise'} 
                                                onChange={handleChange}
                                                className="accent-[#1c398e]"
                                            />
                                            <span className="text-sm font-medium">Entreprise</span>
                                        </label>
                                    </div>
                                </div>

                                {formData.type === 'entreprise' && (
                                    <div className="col-span-2">
                                        <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wide mb-1">
                                            NIF / RC
                                        </label>
                                        <input
                                            type="text"
                                            name="nif"
                                            value={formData.nif}
                                            onChange={handleChange}
                                            className="w-full px-3 py-2 border-2 border-gray-300 rounded-sm focus:outline-none focus:border-[#1c398e]"
                                            placeholder="Numéro d'Identification Fiscale"
                                        />
                                    </div>
                                )}

                                <div className="col-span-2">
                                    <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wide mb-1">
                                        Adresse Complète
                                    </label>
                                    <textarea
                                        name="address"
                                        value={formData.address}
                                        onChange={handleChange}
                                        rows="2"
                                        className="w-full px-3 py-2 border-2 border-gray-300 rounded-sm focus:outline-none focus:border-[#1c398e] resize-none"
                                    ></textarea>
                                </div>
                            </div>

                            <div className="pt-4 border-t-2 border-gray-100 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="px-6 py-2 border-2 border-gray-300 text-gray-700 font-bold text-xs uppercase tracking-wider rounded-sm hover:bg-gray-50 transition-colors"
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2 bg-[#1c398e] text-white font-bold text-xs uppercase tracking-wider rounded-sm hover:bg-[#162d70] shadow-md transition-all active:scale-95"
                                >
                                    {editingClient ? 'Mettre à jour' : 'Enregistrer'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Clients;
