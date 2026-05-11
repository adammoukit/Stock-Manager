import React, { useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { Package, Plus, Search, Edit2, Trash2, X, Save, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';

const Deconditionnement = () => {
    const { deconditionModels, addDeconditionModel, updateDeconditionModel, deleteDeconditionModel } = useInventory();
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        targetUnit: 'Kg'
    });

    const filteredModels = deconditionModels.filter(m => 
        m.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (m.description || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const openModal = (model = null) => {
        if (model) {
            setFormData({ 
                name: model.name, 
                description: model.description || '',
                targetUnit: model.targetUnit || 'Kg'
            });
            setEditingId(model.id);
        } else {
            setFormData({ name: '', description: '', targetUnit: 'Kg' });
            setEditingId(null);
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingId(null);
        setFormData({ name: '', description: '' });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        
        if (!formData.name.trim()) return toast.error('Veuillez donner un nom au modèle');

        if (editingId) {
            updateDeconditionModel(editingId, formData);
            toast.success('Modèle mis à jour');
        } else {
            addDeconditionModel(formData);
            toast.success('Modèle Créé');
        }
        closeModal();
    };

    const handleDelete = (id, isStandard) => {
        if (isStandard) {
            return toast.error('Les modèles standards ne peuvent pas être supprimés');
        }
        if (window.confirm('Voulez-vous vraiment supprimer ce modèle ? Les produits l\'utilisant pourraient être affectés.')) {
            deleteDeconditionModel(id);
            toast.success('Modèle supprimé');
        }
    };

    return (
        <div className="p-8 pb-32">
            <div className="flex justify-between items-start mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                        <Package className="w-8 h-8 text-primary-600" />
                        Modèles de Déconditionnement
                    </h1>
                    <p className="text-gray-500 mt-2 max-w-2xl">
                        Créez ici des "Gabarits" de déconditionnement (ex: Sachet 500g, Pot 1 Litre). 
                        Vous pourrez ensuite les affecter à vos produits lors de leur création.
                    </p>
                </div>
                <button
                    onClick={() => openModal()}
                    className="bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-sm flex items-center gap-2 font-medium transition-colors shadow-sm"
                >
                    <Plus className="w-5 h-5" />
                    Nouveau Modèle
                </button>
            </div>

            <div className="bg-white rounded-sm shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Rechercher un modèle..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-primary-50 text-primary-900 border-b border-primary-100">
                                <th className="p-4 font-semibold text-sm">Nom du Modèle</th>
                                <th className="p-4 font-semibold text-sm">Description interne</th>
                                <th className="p-4 font-semibold text-sm">Cible (Lien Unité)</th>
                                <th className="p-4 font-semibold text-sm">Statut</th>
                                <th className="p-4 font-semibold text-sm text-right w-24">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y-2 divide-gray-200">
                            {filteredModels.map((model) => (
                                <tr key={model.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="p-4 font-medium text-gray-900">
                                        {model.name}
                                    </td>
                                    <td className="p-4 text-gray-500 text-sm">
                                        {model.description || '-'}
                                    </td>
                                    <td className="p-4">
                                        <span className="inline-flex py-1 px-2.5 rounded-full bg-primary-50 text-primary-700 text-xs font-bold border border-primary-100">
                                            {model.targetUnit || 'Non défini'}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        {model.isStandard ? (
                                            <span className="inline-flex py-1 px-2.5 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold">
                                                Standard
                                            </span>
                                        ) : (
                                            <span className="inline-flex py-1 px-2.5 rounded-full bg-gray-100 text-gray-800 text-xs font-semibold">
                                                Personnalisé
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-4">
                                        <div className="flex justify-end gap-2">
                                            <button 
                                                onClick={() => openModal(model)}
                                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-sm transition-colors"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(model.id, model.isStandard)}
                                                disabled={model.isStandard}
                                                className={`p-1.5 rounded-sm transition-colors ${model.isStandard ? 'text-gray-300 cursor-not-allowed' : 'text-gray-400 hover:text-red-600 hover:bg-red-50'}`}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredModels.length === 0 && (
                                <tr>
                                    <td colSpan="4" className="p-8 text-center text-gray-500">
                                        Aucun modèle trouvé pour "{searchTerm}"
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de création / édition */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                    <div className="bg-white rounded-sm shadow-xl w-full max-w-md">
                        <div className="flex items-center justify-between p-6 border-b border-gray-100">
                            <h2 className="text-xl font-bold text-gray-900">
                                {editingId ? 'Modifier le modèle' : 'Nouveau Modèle'}
                            </h2>
                            <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nom du modèle <span className="text-red-500">*</span></label>
                                <p className="text-xs text-gray-500 mb-2">Sera affiché à la caisse (ex: Sachet 500g, Pot Échantillon)</p>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    placeholder="Ex: Sachet 500g"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Unité de référence (Cible) <span className="text-red-500">*</span></label>
                                <p className="text-[10px] text-gray-500 mb-2">Permet de filtrer ce modèle selon l'unité du produit (Sac de ciment -> Kg, Pot -> Litre)</p>
                                <select
                                    value={formData.targetUnit}
                                    onChange={(e) => setFormData({...formData, targetUnit: e.target.value})}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                                >
                                    <option value="Kg">Poids (Kg, g, Sac de ciment)</option>
                                    <option value="Litre">Volume (Litre, L, Pot)</option>
                                    <option value="Mètre">Longueur (Mètre, m, Barre)</option>
                                    <option value="Pièce">Quantité (Pièce, Unité, Boîte)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optionnel)</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    placeholder="Informations internes pour ce modèle..."
                                    rows="3"
                                />
                            </div>

                            <div className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={closeModal} className="px-4 py-2 text-gray-700 hover:bg-gray-100 border border-gray-200 rounded-sm transition-colors">
                                    Annuler
                                </button>
                                <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-sm hover:bg-primary-700 flex items-center gap-2">
                                    <Save className="w-4 h-4" />
                                    {editingId ? 'Sauvegarder' : 'Créer'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Deconditionnement;
