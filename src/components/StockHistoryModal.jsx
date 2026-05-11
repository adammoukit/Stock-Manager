import React from 'react';
import { X, ArrowUpRight, ArrowDownLeft, History } from 'lucide-react';
import { formatPrice } from '../utils/currency';
import { getUnitModel } from '../config/unitModels';

const StockHistoryModal = ({ product, movements, onClose }) => {
    const renderQuantity = (qty) => {
        const cf = parseFloat(product?.conversionFactor) || 1;
        const isContainer = (product?.unitArchetype === 'BOX' || product?.unitArchetype === 'BULK') && cf > 1;
        const subUnit = getUnitModel(product?.unit).subUnit;
        
        const val = Math.abs(parseFloat(qty) || 0);
        const wholeUnits = Math.floor(val);
        const fractionalPart = val - wholeUnits;
        
        if (isContainer && fractionalPart > 0) {
            const subUnitsCount = Math.round(fractionalPart * cf);
            if (wholeUnits > 0) {
                return `${wholeUnits.toLocaleString()} ${product.unit} et ${subUnitsCount.toLocaleString()} ${subUnit || 'unités'}`;
            } else {
                return `${subUnitsCount.toLocaleString()} ${subUnit || 'unités'}`;
            }
        }
        
        return `${val.toLocaleString()} ${product?.unit || 'Pièce'}`;
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-sm border-2 border-gray-300 shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden">
                <div className="flex justify-between items-center p-6 border-b-2 border-gray-300" style={{ backgroundColor: '#e6ecf2' }}>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-[#018f8f]/10 rounded-sm">
                            <History className="w-6 h-6 text-[#018f8f]" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Historique des Mouvements</h2>
                            <p className="text-sm text-gray-500">{product?.name}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {movements.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            Aucun mouvement enregistré pour ce produit.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {movements.map((movement) => (
                                <div key={movement.id} className="flex items-center justify-between p-4 bg-white rounded-sm border-2 border-gray-300 shadow-sm">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-2 rounded-full ${movement.type === 'IN' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                            {movement.type === 'IN' ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900">
                                                {movement.type === 'IN' ? 'Entrée de stock' : 'Sortie de stock'}
                                            </p>
                                            <p className="text-sm text-gray-500 font-medium">
                                                {new Date(movement.date).toLocaleString('fr-FR')} • {movement.reason}
                                            </p>
                                            {movement.details && (
                                                <p className="text-xs text-gray-400 mt-1 italic">
                                                    {movement.details}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`font-black text-xl ${movement.type === 'IN' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            {movement.type === 'IN' ? '+ ' : '- '}{renderQuantity(movement.quantity)}
                                        </p>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                            Par: {movement.user || 'Système'}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="p-4 bg-gray-50 border-t-2 border-gray-300 flex justify-end">
                    <button 
                        onClick={onClose}
                        className="px-8 py-2.5 rounded-sm font-bold bg-gray-200 text-gray-700 hover:bg-gray-300 border-2 border-gray-300 transition-all active:scale-95"
                    >
                        Fermer l'historique
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StockHistoryModal;
