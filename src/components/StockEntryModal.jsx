import React, { useState } from 'react';
import { X, Save, Calendar } from 'lucide-react';

const StockEntryModal = ({ product, onClose, onSave }) => {
    const [formData, setFormData] = useState({
        quantity: '',
        purchasePrice: product?.purchasePrice || '',
        batchNumber: '',
        expiryDate: '',
        supplier: product?.supplier || ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const getUnitArchetype = (u) => {
        const unit = u?.toLowerCase();
        if (['sac', 'kg', 'gramme', 'tonne', 'bobine', 'barre', 'seau', 'pot', 'bidon', 'litre', 'mètre', 'rouleau', 'tuyau'].includes(unit)) return 'BULK';
        if (['boîte', 'paquet', 'carton', 'sachet'].includes(unit)) return 'BOX';
        return 'UNIT';
    };

    const unitArchetype = product?.unitArchetype || getUnitArchetype(product?.unit);

    const [helperParams, setHelperParams] = useState({
        qtyPerContainer: product?.helperParams?.qtyPerContainer || product?.subUnitConversion || '',
        containerCount: ''
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleAssistantChange = (field, value) => {
        const newParams = { ...helperParams, [field]: value };
        setHelperParams(newParams);
        
        const per = parseFloat(newParams.qtyPerContainer);
        const count = parseFloat(newParams.containerCount);
        
        if (!isNaN(per) && !isNaN(count)) {
            let totalQty;
            if (unitArchetype === 'BOX' || unitArchetype === 'BULK') {
                totalQty = per * count;
            } else {
                totalQty = count;
            }
            setFormData(prev => ({ ...prev, quantity: totalQty.toString() }));
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (isSubmitting) return;
        setIsSubmitting(true);
        try {
            onSave(product.id, formData);
        } finally {
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-sm border-2 border-gray-300 shadow-xl w-full max-w-md overflow-hidden">
                <div className="flex justify-between items-center p-6 border-b-2 border-gray-300" style={{ backgroundColor: '#e6ecf2' }}>
                    <h2 className="text-xl font-bold text-gray-900">
                        Approvisionnement
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Produit</label>
                        <input
                            type="text"
                            value={product?.name?.toUpperCase()}
                            disabled
                            className="w-full px-4 py-2 bg-gray-100 border-2 border-gray-300 rounded-sm text-gray-700 font-bold"
                        />
                    </div>

                    <div className="bg-[#e8eef4]/50 p-4 rounded-sm border-2 border-dashed border-gray-300">
                        <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                            <Package className="w-4 h-4 text-primary-600" />
                            Assistant de Réception
                        </h4>
                        
                        {unitArchetype !== 'UNIT' ? (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">
                                            {unitArchetype === 'BOX' ? `Pièces par ${product.unit}` : 
                                             product.unit === 'Sac de ciment' ? 'Poids par Sac de ciment (Kg)' : 
                                             ['Bobine', 'Barre'].includes(product.unit) ? 'Longueur par unité (m)' : 
                                             'Contenance par unité (L)'}
                                        </label>
                                        <input
                                            type="number"
                                            value={helperParams.qtyPerContainer}
                                            onChange={(e) => handleAssistantChange('qtyPerContainer', e.target.value)}
                                            className="w-full px-3 py-2 border-2 border-gray-300 rounded-sm focus:ring-2 focus:ring-[#1c398e]/50 bg-white"
                                            placeholder="Ex: 50"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Nombre de {product.unit}(s)</label>
                                        <input
                                            type="number"
                                            value={helperParams.containerCount}
                                            onChange={(e) => handleAssistantChange('containerCount', e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-sm focus:ring-2 focus:ring-primary-500"
                                            placeholder="Ex: 10"
                                        />
                                    </div>
                                </div>
                                <div className="pt-2 border-t-2 border-gray-300 flex items-center justify-between">
                                    <span className="text-xs text-gray-500 font-medium">Réception calculée :</span>
                                    <span className="text-sm font-bold text-primary-700">
                                        {formData.quantity || 0} {product.unit}(s)
                                        <span className="text-xs font-normal text-primary-500 ml-1">
                                            ({(parseFloat(formData.quantity) * parseFloat(helperParams.qtyPerContainer)).toLocaleString() || 0} {unitArchetype === 'BOX' ? 'pièces' : (product.unit === 'Sac de ciment' ? 'Kg' : (['Bobine', 'Barre'].includes(product.unit) ? 'm' : 'L'))})
                                        </span>
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Quantité Totale ({product?.unit})</label>
                                <input
                                    type="number"
                                    name="quantity"
                                    required
                                    min="1"
                                    value={formData.quantity}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-[#1c398e]/50 text-center font-black text-lg bg-white"
                                    placeholder="Ex: 100"
                                />
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Prix d'achat Unitaire (FCFA)</label>
                        <p className="text-[10px] text-gray-400 mb-1 italic">Prix pour 1 {product?.unit === 'Sac de ciment' ? 'Kg' : ['Bobine', 'Barre'].includes(product?.unit) ? 'Mètre' : product?.unit}</p>
                        <input
                            type="number"
                            name="purchasePrice"
                            required
                            min="0"
                            value={formData.purchasePrice}
                            onChange={handleChange}
                            className="w-full px-4 py-2 border-2 border-blue-200 bg-blue-50/50 rounded-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-black text-blue-900"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Numéro de Lot / Batch</label>
                        <input
                            type="text"
                            name="batchNumber"
                            placeholder="Ex: LOT-2023-001"
                            value={formData.batchNumber}
                            onChange={handleChange}
                            className="w-full px-4 py-2 border-2 border-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-[#1c398e]/50 bg-white"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Date d'expiration (Optionnel)</label>
                        <div className="relative">
                            <Calendar className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="date"
                                name="expiryDate"
                                value={formData.expiryDate}
                                onChange={handleChange}
                                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Fournisseur</label>
                        <input
                            type="text"
                            name="supplier"
                            value={formData.supplier}
                            onChange={handleChange}
                            className="w-full px-4 py-2 border-2 border-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-[#1c398e]/50 bg-white"
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t-2 border-gray-300 bg-gray-50/50 p-6 -mx-6 -mb-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2.5 text-gray-700 hover:bg-gray-200 border-2 border-gray-300 rounded-sm font-bold transition-colors"
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-8 py-2.5 bg-[#1c398e] hover:bg-[#142b6b] text-white font-bold rounded-sm flex items-center gap-2 shadow-md transition-all active:scale-95 disabled:opacity-50"
                        >
                            <Save className="w-5 h-5" />
                            {isSubmitting ? 'Validation...' : 'Valider l\'entrée'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default StockEntryModal;
