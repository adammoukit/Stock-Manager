import React, { useState } from 'react';
import {
    Search,
    Filter,
    ArrowUpCircle,
    ArrowDownCircle,
    RefreshCcw,
    Plus,
    Calendar,
    User as UserIcon,
    Store as StoreIcon,
    FileText,
    History,
    Package
} from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import { useInventory } from '../../context/InventoryContext';
import clsx from 'clsx';

const Movements = () => {
    const { stores, currentStoreId } = useSettings();
    const { products } = useInventory();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('ALL');
    const [filterStore, setFilterStore] = useState(currentStoreId || 'ALL');

    // Mock data for initial UI implementation
    const [movements] = useState([
        {
            id: 1,
            date: '2026-05-07T14:30:00',
            productName: 'Ciment CPJ 45',
            type: 'IN', // IN, OUT, ADJUST, TRANSFER
            quantity: 50,
            unit: 'Sacs',
            storeName: 'Boutique Principale',
            reason: 'Réapprovisionnement Lot #123',
            user: 'Jean Dupont'
        },
        {
            id: 2,
            date: '2026-05-07T15:15:00',
            productName: 'Peinture Glycéro Blanche 5L',
            type: 'OUT',
            quantity: 2,
            unit: 'Pots',
            storeName: 'Boutique Principale',
            reason: 'Vente #4567',
            user: 'Alice Koffi'
        },
        {
            id: 3,
            date: '2026-05-07T16:00:00',
            productName: 'Marteau de menuisier 300g',
            type: 'ADJUST',
            quantity: -1,
            unit: 'Pièces',
            storeName: 'Annexe Kara',
            reason: 'Casse / Dommage',
            user: 'Jean Dupont'
        },
        {
            id: 4,
            date: '2026-05-07T16:45:00',
            productName: 'Tuyau PVC Ø32',
            type: 'TRANSFER',
            quantity: 10,
            unit: 'Mètres',
            storeName: 'Boutique Principale',
            reason: 'Transfert vers Annexe Kara',
            user: 'Admin'
        }
    ]);

    const getTypeBadge = (type) => {
        switch (type) {
            case 'IN':
                return (
                    <div className="flex items-center justify-between gap-2 pr-2">
                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Entrée</span>
                        <img src="/icons8/fluency_48_download.png" alt="" className="w-3 h-3 rotate-90 opacity-70" />
                    </div>
                );
            case 'OUT':
                return (
                    <div className="flex items-center justify-between gap-2 pr-2">
                        <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Sortie</span>
                        <img src="/icons8/fluency_48_upload.png" alt="" className="w-3 h-3 rotate-90 opacity-70" />
                    </div>
                );
            case 'ADJUST':
                return (
                    <div className="flex items-center justify-between gap-2 pr-2">
                        <span className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Ajuste.</span>
                        <img src="/icons8/fluency_48_maintenance.png" alt="" className="w-3 h-3 opacity-70" />
                    </div>
                );
            case 'TRANSFER':
                return (
                    <div className="flex items-center justify-between gap-2 pr-2">
                        <span className="text-[10px] font-black text-purple-600 uppercase tracking-widest">Transf.</span>
                        <img src="/icons8/fluency_48_synchronize.png" alt="" className="w-3 h-3 opacity-70" />
                    </div>
                );
            default:
                return null;
        }
    };

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return new Intl.DateTimeFormat('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    };

    const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [period, setPeriod] = useState('7days');

    // Calculate stats based on movements
    const stats = {
        totalIn: movements.filter(m => m.type === 'IN').reduce((sum, m) => sum + m.quantity, 0),
        totalOut: movements.filter(m => m.type === 'OUT').reduce((sum, m) => sum + Math.abs(m.quantity), 0),
        adjustCount: movements.filter(m => m.type === 'ADJUST').length,
        transferCount: movements.filter(m => m.type === 'TRANSFER').length
    };

    return (
        <div className="space-y-4">
            {/* Header avec boutons d'action */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-sm border-2 border-gray-300 shadow-sm">
                <div>
                    <h2 className="text-2xl font-bold text-[#018f8f]">Mouvements & Ajustements</h2>
                    <p className="text-gray-500 text-sm mt-1 font-medium">Tracez chaque changement de stock et effectuez des corrections</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <button 
                        className="flex items-center justify-center gap-2 bg-white border-2 border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-sm font-bold shadow-sm transition-all active:scale-95"
                    >
                        <FileText className="w-5 h-5 text-teal-600" />
                        Exporter PDF
                    </button>
                    <button 
                        onClick={() => setIsTransferModalOpen(true)}
                        className="flex items-center justify-center gap-2 bg-[#018f8f] hover:bg-[#017a7a] text-white px-5 py-2.5 rounded-sm font-bold shadow-md transition-all active:scale-95"
                    >
                        <History className="w-5 h-5" />
                        Transférer Stock
                    </button>
                    <button 
                        onClick={() => setIsAdjustmentModalOpen(true)}
                        className="flex items-center justify-center gap-2 bg-[#f77500] hover:bg-[#e66a00] text-white px-5 py-2.5 rounded-sm font-bold shadow-md transition-all active:scale-95"
                    >
                        <Plus className="w-5 h-5" />
                        Nouvel Ajustement
                    </button>
                </div>
            </div>

            {/* Barre de Statistiques Rapides: Texture Premium */}
            {/* Barre de Statistiques Rapides: Style Dashboard Sync */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {[
                    { label: 'Entrées Stock', value: `+${stats.totalIn}`, icon: 'download.png', color: 'text-emerald-600' },
                    { label: 'Sorties Stock', value: `-${stats.totalOut}`, icon: 'upload.png', color: 'text-blue-600' },
                    { label: 'Ajustements', value: stats.adjustCount, icon: 'maintenance.png', color: 'text-orange-600' },
                    { label: 'Transferts', value: stats.transferCount, icon: 'synchronize.png', color: 'text-purple-600' }
                ].map((card, idx) => (
                    <div key={idx} className="bg-white p-5 rounded-sm border-2 border-gray-300 shadow-sm relative group hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col justify-center min-h-[120px]">
                        <div className="relative z-10">
                            <p className="text-[11px] font-bold text-teal-600/70 uppercase tracking-widest mb-1">{card.label}</p>
                            <div className="flex items-baseline mt-2 font-semibold" style={{ color: '#005f5f' }}>
                                <h3 className={`text-2xl sm:text-3xl font-semibold tracking-tight`}>
                                    {card.value}
                                </h3>
                            </div>
                        </div>
                        <img 
                            src={`https://img.icons8.com/fluency/240/${card.icon}`} 
                            alt="" 
                            crossOrigin="anonymous"
                            className={`absolute bottom-1 right-1 w-16 h-16 opacity-90 group-hover:scale-110 transition-transform duration-700 pointer-events-none ${(card.label === 'Entrées Stock' || card.label === 'Sorties Stock') ? 'rotate-90' : ''}`}
                        />
                    </div>
                ))}
            </div>

            {/* Adjustment Modal */}
            {isAdjustmentModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-sm border-2 border-gray-300 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b-2 border-gray-300 flex items-center justify-between" style={{ backgroundColor: '#e6ecf2' }}>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-[#018f8f]/10 rounded-sm">
                                    <RefreshCcw className="w-5 h-5 text-[#018f8f]" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900">Nouvel Ajustement de Stock</h3>
                            </div>
                            <button
                                onClick={() => setIsAdjustmentModalOpen(false)}
                                className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                            >
                                <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-5">
                            {/* Produit */}
                            <div className="space-y-2">
                                <label className="text-sm font-extrabold text-gray-800 flex items-center gap-3 uppercase mb-2">
                                    <img src="/icons8/color_96_product.png" alt="" className="w-7 h-7" />
                                    Sélectionner le Produit
                                </label>
                                <select className="w-full px-4 py-3 bg-white border-2 border-gray-300 rounded-sm focus:ring-2 focus:ring-[#018f8f]/50 outline-none font-medium">
                                    <option value="">-- Choisir un produit --</option>
                                    {products.map(p => (
                                        <option key={p.id} value={p.id}>{p.name.toUpperCase()}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Boutique */}
                            <div className="space-y-2">
                                <label className="text-sm font-extrabold text-gray-800 flex items-center gap-3 uppercase mb-2">
                                    <img src="/icons8/color_96_shop.png" alt="" className="w-7 h-7" />
                                    Boutique concernée
                                </label>
                                <select className="w-full px-4 py-3 bg-white border-2 border-gray-300 rounded-sm focus:ring-2 focus:ring-[#018f8f]/50 outline-none font-medium">
                                    {stores.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {/* Quantité */}
                                <div className="space-y-2">
                                    <label className="text-sm font-extrabold text-gray-800 flex items-center gap-3 uppercase mb-2">
                                        <img src="/icons8/color_96_numeric.png" alt="" className="w-7 h-7" />
                                        Quantité (+/-)
                                    </label>
                                    <input
                                        type="number"
                                        placeholder="Ex: -5 ou 10"
                                        className="w-full px-4 py-3 bg-white border-2 border-gray-300 rounded-sm focus:ring-2 focus:ring-[#018f8f]/50 outline-none font-black text-lg"
                                    />
                                </div>
                                {/* Motif */}
                                <div className="space-y-2">
                                    <label className="text-sm font-extrabold text-gray-800 flex items-center gap-3 uppercase mb-2">
                                        <img src="/icons8/color_96_edit-property.png" alt="" className="w-7 h-7" />
                                        Motif
                                    </label>
                                    <select className="w-full px-4 py-3 bg-white border-2 border-gray-300 rounded-sm focus:ring-2 focus:ring-[#018f8f]/50 outline-none font-medium">
                                        <option value="CORRECTION">Correction d'inventaire</option>
                                        <option value="LOSS">Perte / Vol</option>
                                        <option value="DAMAGE">Casse / Dommage</option>
                                        <option value="EXPIRATION">Péremption</option>
                                        <option value="GIFT">Don / Échantillon</option>
                                    </select>
                                </div>
                            </div>

                            {/* Commentaire */}
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700">Détails ou Observations supplémentaires</label>
                                <textarea
                                    rows="3"
                                    placeholder="Expliquez la raison de cet ajustement..."
                                    className="w-full px-4 py-3 bg-white border-2 border-gray-300 rounded-sm focus:ring-2 focus:ring-[#018f8f]/50 outline-none text-sm italic"
                                ></textarea>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 bg-gray-50 border-t-2 border-gray-300 flex justify-end gap-3">
                            <button
                                onClick={() => setIsAdjustmentModalOpen(false)}
                                className="px-6 py-2.5 rounded-sm font-bold text-gray-600 hover:bg-gray-200 transition-colors"
                            >
                                Annuler
                            </button>
                            <button
                                className="bg-[#018f8f] hover:bg-[#017a7a] text-white px-8 py-2.5 rounded-sm font-bold shadow-md transition-all active:scale-95"
                            >
                                Valider l'ajustement
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Transfer Modal */}
            {isTransferModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-sm border-2 border-gray-300 shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b-2 border-gray-300 flex items-center justify-between" style={{ backgroundColor: '#e6ecf2' }}>
                            <div className="flex items-center gap-3">
                                <div className="p-1 bg-purple-100 rounded-sm">
                                    <img src="/icons8/fluency_96_synchronize.png" alt="" className="w-8 h-8" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900">Transférer du Stock</h3>
                            </div>
                            <button 
                                onClick={() => setIsTransferModalOpen(false)}
                                className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                            >
                                <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-5">
                            {/* Produit */}
                            <div className="space-y-2">
                                <label className="text-sm font-extrabold text-gray-800 flex items-center gap-3 uppercase mb-2">
                                    <img src="/icons8/color_96_product.png" alt="" className="w-7 h-7" />
                                    Produit à Transférer
                                </label>
                                <select className="w-full px-4 py-3 bg-white border-2 border-gray-300 rounded-sm focus:ring-2 focus:ring-purple-600/50 outline-none font-medium">
                                    <option value="">-- Choisir un produit --</option>
                                    {products.map(p => (
                                        <option key={p.id} value={p.id}>{p.name.toUpperCase()}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {/* Boutique Source */}
                                <div className="space-y-2">
                                    <label className="text-[11px] font-black text-gray-400 uppercase">Depuis (Source)</label>
                                    <select className="w-full px-4 py-3 bg-red-50 border-2 border-red-200 rounded-sm focus:ring-2 focus:ring-red-600/50 outline-none font-bold text-red-700">
                                        {stores.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                                {/* Boutique Destination */}
                                <div className="space-y-2">
                                    <label className="text-[11px] font-black text-gray-400 uppercase">Vers (Destination)</label>
                                    <select className="w-full px-4 py-3 bg-emerald-50 border-2 border-emerald-200 rounded-sm focus:ring-2 focus:ring-emerald-600/50 outline-none font-bold text-emerald-700">
                                        {stores.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Quantité */}
                            <div className="space-y-2">
                                <label className="text-sm font-extrabold text-gray-800 flex items-center gap-3 uppercase mb-2">
                                    <img src="/icons8/color_96_numeric.png" alt="" className="w-7 h-7" />
                                    Quantité à déplacer
                                </label>
                                <input 
                                    type="number" 
                                    placeholder="Ex: 50"
                                    className="w-full px-4 py-3 bg-white border-2 border-gray-300 rounded-sm focus:ring-2 focus:ring-purple-600/50 outline-none font-black text-lg"
                                />
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 bg-gray-50 border-t-2 border-gray-300 flex justify-end gap-3">
                            <button 
                                onClick={() => setIsTransferModalOpen(false)}
                                className="px-6 py-2.5 rounded-sm font-bold text-gray-600 hover:bg-gray-200 transition-colors"
                            >
                                Annuler
                            </button>
                            <button 
                                className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-2.5 rounded-sm font-bold shadow-md transition-all active:scale-95"
                            >
                                Confirmer le Transfert
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Command Center: Filtres et Recherche */}
            <div className="p-4 border-2 border-gray-300 rounded-sm shadow-sm" style={{ backgroundColor: '#e6ecf2' }}>
                <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center">
                    {/* Recherche produit */}
                    <div className="relative flex-1">
                        <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Rechercher par nom de produit..."
                            className="w-full pl-10 pr-4 py-2.5 bg-white border-2 border-gray-300 rounded-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#018f8f] transition-all text-sm font-semibold"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* Filtre Période */}
                    <div className="flex items-center gap-1 bg-white p-1 rounded-sm border-2 border-gray-300">
                        {[
                            { key: 'today', label: 'Aujourd\'hui' },
                            { key: '7days', label: '7 jours' },
                            { key: 'month', label: 'Ce mois' },
                            { key: 'all', label: 'Tout' }
                        ].map(opt => (
                            <button
                                key={opt.key}
                                onClick={() => setPeriod(opt.key)}
                                className={`px-4 py-1.5 text-[11px] font-bold rounded-sm transition-all uppercase tracking-wider ${
                                    period === opt.key 
                                        ? 'bg-[#018f8f] text-white shadow-md' 
                                        : 'text-gray-500 hover:bg-gray-100'
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                    {/* Filtre Type */}
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 border-2 border-gray-300 rounded-sm">
                        <Filter className="w-4 h-4 text-[#018f8f]" />
                        <select
                            className="bg-transparent text-xs font-bold uppercase tracking-tight outline-none cursor-pointer text-gray-700 min-w-[120px]"
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                        >
                            <option value="ALL">Tous les types</option>
                            <option value="IN">Entrées</option>
                            <option value="OUT">Sorties</option>
                            <option value="ADJUST">Ajustements</option>
                            <option value="TRANSFER">Transferts</option>
                        </select>
                    </div>

                    {/* Filtre Boutique */}
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 border-2 border-gray-300 rounded-sm">
                        <StoreIcon className="w-4 h-4 text-[#018f8f]" />
                        <select
                            className="bg-transparent text-xs font-bold uppercase tracking-tight outline-none cursor-pointer text-gray-700 min-w-[150px]"
                            value={filterStore}
                            onChange={(e) => setFilterStore(e.target.value)}
                        >
                            <option value="ALL">Toutes les boutiques</option>
                            {stores.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Tableau des Mouvements */}
            <div className="bg-white rounded-sm border-2 border-gray-300 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-separate border-spacing-0">
                        <thead>
                            <tr style={{ backgroundColor: '#018f8f' }}>
                                <th className="px-4 py-4 text-[11px] font-black text-white uppercase tracking-[0.2em] border-r border-teal-700/50">Date & Heure</th>
                                <th className="px-4 py-4 text-[11px] font-black text-white uppercase tracking-[0.2em] border-r border-teal-700/50">Produit</th>
                                <th className="px-4 py-4 text-[11px] font-black text-white uppercase tracking-[0.2em] border-r border-teal-700/50">Type</th>
                                <th className="px-4 py-4 text-[11px] font-black text-white uppercase tracking-[0.2em] text-right border-r border-teal-700/50">Quantité</th>
                                <th className="px-4 py-4 text-[11px] font-black text-white uppercase tracking-[0.2em] border-r border-teal-700/50">Boutique</th>
                                <th className="px-4 py-4 text-[11px] font-black text-white uppercase tracking-[0.2em] border-r border-teal-700/50">Motif</th>
                                <th className="px-4 py-4 text-[11px] font-black text-white uppercase tracking-[0.2em] text-right">User</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y-2 divide-gray-200">
                            {movements.map((m) => (
                                <tr key={m.id} className="hover:bg-gray-50 transition-colors group">
                                    <td className="px-4 py-3 text-[13px] text-gray-700 whitespace-nowrap font-bold border-r border-gray-200">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="w-3.5 h-3.5 text-teal-600 opacity-50" />
                                            {formatDate(m.date)}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 border-r border-gray-200">
                                        <div className="text-sm font-bold text-gray-900 group-hover:text-[#018f8f] transition-colors uppercase tracking-tight">
                                            {m.productName}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 border-r border-gray-200">
                                        {getTypeBadge(m.type)}
                                    </td>
                                    <td className={clsx(
                                        "px-4 py-3 text-right whitespace-nowrap border-r border-gray-200",
                                    )}>
                                        <div className="flex items-baseline justify-end gap-1 font-semibold tracking-tight" style={{ color: '#005f5f' }}>
                                            <span className="text-sm">
                                                {m.quantity > 0 ? '+' : ''}{m.quantity}
                                            </span>
                                            <span className="text-[10px] opacity-60 uppercase font-bold">{m.unit}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-gray-600 font-black uppercase tracking-tight border-r border-gray-200">
                                        <div className="flex items-center gap-1.5">
                                            <StoreIcon className="w-3.5 h-3.5 text-teal-600/40" />
                                            {m.storeName}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 border-r border-gray-200">
                                        <div className="flex items-center gap-1.5 text-[11px] text-gray-500 font-bold max-w-[200px] truncate" title={m.reason}>
                                            {m.reason}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-600 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{m.user}</span>
                                            <div className="w-7 h-7 rounded-sm bg-gray-100 border border-gray-200 flex items-center justify-center text-[10px] font-black text-[#018f8f]">
                                                {m.user.substring(0, 1)}
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination (Simulation) */}
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                    <span className="text-xs text-gray-500 font-medium">Affichage de 1 à 4 sur 4 mouvements</span>
                    <div className="flex gap-1">
                        <button className="px-3 py-1 bg-white border border-gray-300 rounded text-xs font-bold text-gray-400 cursor-not-allowed">Précédent</button>
                        <button className="px-3 py-1 bg-white border border-gray-300 rounded text-xs font-bold text-gray-400 cursor-not-allowed">Suivant</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Movements;
