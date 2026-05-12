import React, { useState } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { Users, Plus, Shield, MapPin, Edit2, Trash2, KeyRound, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';

const UsersManagement = () => {
    const { users, setUsers, roles, stores } = useSettings();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    
    // Form state for new/edit user
    const [formData, setFormData] = useState({
        id: null,
        name: '',
        roleId: 'cashier',
        storeId: stores[0]?.id || 1,
        pinCode: '',
        status: 'Actif'
    });

    const resetForm = () => {
        setFormData({
            id: null,
            name: '',
            roleId: 'cashier',
            storeId: stores[0]?.id || 1,
            pinCode: '',
            status: 'Actif'
        });
    };

    const handleOpenModal = (user = null) => {
        if (user) {
            setFormData({ ...user, pinCode: '' }); // Don't show PIN in edit by default for security, but allow updating it
        } else {
            resetForm();
        }
        setIsModalOpen(true);
    };

    const handleSave = (e) => {
        e.preventDefault();
        
        // Validation PIN
        if (formData.pinCode && (formData.pinCode.length < 6 || formData.pinCode.length > 8)) {
            toast.error("Le code PIN doit contenir entre 6 et 8 chiffres.");
            return;
        }

        // Add require PIN check for new user before loading
        if (!formData.id && !formData.pinCode) {
            toast.error("Un code PIN est requis pour un nouvel utilisateur.");
            return;
        }

        setIsLoading(true);

        setTimeout(() => {
            if (formData.id) {
                // Update
                setUsers(prev => prev.map(u => u.id === formData.id ? { ...u, ...formData, pinCode: formData.pinCode || u.pinCode } : u));
                toast.success("Utilisateur mis à jour avec succès");
            } else {
                // Add
                const newUser = {
                    ...formData,
                    id: Date.now(),
                    lastLogin: 'Jamais'
                };
                setUsers(prev => [...prev, newUser]);
                toast.success("Nouvel utilisateur ajouté");
            }
            setIsModalOpen(false);
            setIsLoading(false);
        }, 3000);
    };

    const handleDelete = (id) => {
        if (window.confirm("Êtes-vous sûr de vouloir supprimer cet utilisateur ?")) {
            setUsers(prev => prev.filter(u => u.id !== id));
            toast.success("Utilisateur supprimé");
        }
    };

    const getRoleName = (roleId) => roles.find(r => r.id === roleId)?.name || 'Inconnu';
    const getRoleColor = (roleId) => roles.find(r => r.id === roleId)?.color || 'bg-gray-100 text-gray-700';
    const getStoreName = (storeId) => stores.find(s => s.id === storeId)?.name || 'Toutes les boutiques';

    return (
        <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-[#1c398e] tracking-tight">Utilisateurs & Équipe</h2>
                    <p className="text-gray-500 text-sm mt-1 font-medium">Gérez les accès et les mots de passe (Code PIN) de vos employés.</p>
                </div>
                <button 
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 bg-[#1c398e] text-white px-4 py-2 rounded-sm hover:bg-blue-700 transition-colors shadow-md font-medium"
                >
                    <Plus className="w-5 h-5" />
                    Ajouter un employé
                </button>
            </div>

            {/* Liste des utilisateurs */}
            <div className="bg-white rounded-sm shadow-sm border-2 border-gray-300 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100 text-sm font-semibold text-gray-600">
                                <th className="p-4">Employé</th>
                                <th className="p-4">Rôle</th>
                                <th className="p-4">Boutique Assignée</th>
                                <th className="p-4">Statut</th>
                                <th className="p-4">Dernière Connexion</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {users.map(user => (
                                <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-bold">
                                                {user.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="font-medium text-gray-800">{user.name}</div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getRoleColor(user.roleId)}`}>
                                            <Shield className="w-3 h-3 inline-block mr-1" />
                                            {getRoleName(user.roleId)}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                            <MapPin className="w-4 h-4 text-gray-400" />
                                            {getStoreName(user.storeId)}
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className={`flex items-center gap-1.5 text-sm ${user.status === 'Actif' ? 'text-green-600' : 'text-red-600'}`}>
                                            <div className={`w-2 h-2 rounded-full ${user.status === 'Actif' ? 'bg-green-500' : 'bg-red-500'}`} />
                                            {user.status}
                                        </span>
                                    </td>
                                    <td className="p-4 text-sm text-gray-500">
                                        {user.lastLogin === 'Jamais' ? 'Jamais connecté' : new Date(user.lastLogin).toLocaleString('fr-FR')}
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button 
                                                onClick={() => handleOpenModal(user)}
                                                className="p-2 text-gray-400 hover:text-[#1c398e] hover:bg-blue-50 rounded-sm transition-colors"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(user.id)}
                                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-sm transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {users.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="p-8 text-center text-gray-500">
                                        Aucun utilisateur trouvé. Ajoutez votre premier employé !
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal Ajout/Modification */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-sm shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                <Users className="w-5 h-5 text-[#1c398e]" />
                                {formData.id ? 'Modifier l\'employé' : 'Nouvel employé'}
                            </h2>
                            <button 
                                onClick={() => setIsModalOpen(false)}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nom Complet</label>
                                <input 
                                    type="text" 
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                                    className="w-full p-2.5 bg-white border border-gray-200 rounded-sm focus:ring-2 focus:ring-[#1c398e] outline-none transition-all"
                                    placeholder="Ex: Kouassi Koffi"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Rôle</label>
                                    <select 
                                        value={formData.roleId}
                                        onChange={(e) => setFormData({...formData, roleId: e.target.value})}
                                        className="w-full p-2.5 bg-white border border-gray-200 rounded-sm focus:ring-2 focus:ring-[#1c398e] outline-none transition-all"
                                    >
                                        {roles.map(role => (
                                            <option key={role.id} value={role.id}>{role.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
                                    <select 
                                        value={formData.status}
                                        onChange={(e) => setFormData({...formData, status: e.target.value})}
                                        className="w-full p-2.5 bg-white border border-gray-200 rounded-sm focus:ring-2 focus:ring-[#1c398e] outline-none transition-all"
                                    >
                                        <option value="Actif">Actif</option>
                                        <option value="Inactif">Bloqué / Inactif</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Boutique Assignée</label>
                                <select 
                                    value={formData.storeId}
                                    onChange={(e) => setFormData({...formData, storeId: parseInt(e.target.value)})}
                                    className="w-full p-2.5 bg-white border border-gray-200 rounded-sm focus:ring-2 focus:ring-[#1c398e] outline-none transition-all"
                                >
                                    {stores.map(store => (
                                        <option key={store.id} value={store.id}>{store.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="p-4 bg-amber-50 border border-amber-100 rounded-sm">
                                <label className="block text-sm font-bold text-amber-900 mb-1 flex items-center gap-2">
                                    <KeyRound className="w-4 h-4" />
                                    Code PIN de connexion
                                </label>
                                <p className="text-xs text-amber-700 mb-2">Un code unique à 6 ou 8 chiffres pour que cet employé se connecte rapidement sur la caisse.</p>
                                <input 
                                    type="password" 
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    maxLength={8}
                                    value={formData.pinCode}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, '');
                                        setFormData({...formData, pinCode: val});
                                    }}
                                    className="w-full p-2.5 bg-white border border-amber-200 rounded-sm focus:ring-2 focus:ring-amber-500 outline-none transition-all text-center tracking-widest text-lg font-mono"
                                    placeholder={formData.id ? "Laissez vide pour conserver" : "• • • • • •"}
                                />
                            </div>

                            <div className="flex gap-3 pt-4 border-t border-gray-100">
                                <button 
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-4 py-2 text-gray-600 bg-gray-100 rounded-sm hover:bg-gray-200 font-medium transition-colors"
                                >
                                    Annuler
                                </button>
                                <button 
                                    type="submit"
                                    className="flex-1 px-4 py-2 text-white bg-[#1c398e] rounded-sm hover:bg-blue-700 font-medium transition-colors flex items-center justify-center gap-2"
                                >
                                    <Check className="w-5 h-5" />
                                    {formData.id ? 'Mettre à jour' : 'Enregistrer'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Full-screen Loader */}
            {isLoading && (
                <div className="fixed inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center z-[100] animate-in fade-in duration-200">
                    <div className="flex flex-col items-center gap-4 bg-white p-8 rounded-sm shadow-xl">
                        <div className="w-12 h-12 border-4 border-[#1c398e]/20 border-t-[#1c398e] rounded-full animate-spin"></div>
                        <p className="text-gray-700 font-medium animate-pulse">Enregistrement de l'employé...</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UsersManagement;
