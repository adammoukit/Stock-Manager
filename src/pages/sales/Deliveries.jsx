import React, { useState } from 'react';
import { Search, Truck, CheckCircle2, Clock, FileText, Printer, MoreVertical, Calendar, Filter, Eye } from 'lucide-react';
import { formatPrice, formatRowPrice } from '../../utils/currency';

const mockDeliveries = [
    { id: 'BL-2023-001', customerName: 'Entreprise BTP SARL', createdAt: '2023-10-25', deliveryDate: '2023-10-26', status: 'delivered', itemsCount: 45, totalValue: 1250000 },
    { id: 'BL-2023-002', customerName: 'Quincaillerie du Centre', createdAt: '2023-10-26', deliveryDate: null, status: 'in_transit', itemsCount: 12, totalValue: 340000 },
    { id: 'BL-2023-003', customerName: 'Jean Dupont', createdAt: '2023-10-27', deliveryDate: null, status: 'pending', itemsCount: 3, totalValue: 75000 },
    { id: 'BL-2023-004', customerName: 'Société Générale de Construction', createdAt: '2023-10-27', deliveryDate: null, status: 'pending', itemsCount: 120, totalValue: 4500000 },
];

const ResizableHeader = ({ columnId, title, width, onResize }) => {
    const [isResizing, setIsResizing] = useState(false);

    const handleMouseDown = (e) => {
        e.preventDefault();
        setIsResizing(true);
        const startX = e.clientX;
        const startWidth = width;

        const handleMouseMove = (moveEvent) => {
            requestAnimationFrame(() => {
                const newWidth = Math.max(60, startWidth + (moveEvent.clientX - startX));
                onResize(columnId, newWidth);
            });
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
            className="px-4 py-4 relative group border-r-2 border-[#e6e6e6]/40 hover:bg-[#1c398e] transition-colors select-none"
        >
            <div className="flex items-center overflow-hidden whitespace-nowrap">
                {title}
            </div>
            {/* Poignée de redimensionnement (Drag Handle) */}
            <div
                onMouseDown={handleMouseDown}
                className={`absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-20 transition-colors flex justify-center items-center ${isResizing ? 'bg-blue-400' : 'hover:bg-blue-400/50'}`}
                title="Glisser pour redimensionner"
            >
                <div className={`w-0.5 h-1/3 rounded-full ${isResizing ? 'bg-white' : 'bg-transparent group-hover:bg-blue-200'}`}></div>
            </div>
        </th>
    );
};

const Deliveries = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [deliveries, setDeliveries] = useState(mockDeliveries);
    const [statusFilter, setStatusFilter] = useState('all');
    const [openMenuId, setOpenMenuId] = useState(null);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    // État pour les largeurs de colonnes
    const [colWidths, setColWidths] = useState({
        id: 130,
        client: 220,
        createdAt: 110,
        deliveryDate: 110,
        articles: 100,
        ht: 120,
        tax: 90,
        ttc: 130,
        status: 160,
        actions: 140
    });

    const handleResize = (columnId, newWidth) => {
        setColWidths(prev => ({ ...prev, [columnId]: newWidth }));
    };

    const handleMarkAsTransit = (id) => {
        setDeliveries(deliveries.map(d => d.id === id ? { ...d, status: 'in_transit' } : d));
    };

    const handleMarkAsDelivered = (id) => {
        setDeliveries(deliveries.map(d => d.id === id ? { ...d, status: 'delivered' } : d));
    };

    const filteredDeliveries = deliveries.filter(d => {
        const matchSearch = d.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || d.id.toLowerCase().includes(searchTerm.toLowerCase());
        const matchStatus = statusFilter === 'all' || d.status === statusFilter;
        const matchDateFrom = !dateFrom || new Date(d.date) >= new Date(dateFrom);
        const matchDateTo = !dateTo || new Date(d.date) <= new Date(dateTo);
        return matchSearch && matchStatus && matchDateFrom && matchDateTo;
    });

    const pendingCount = deliveries.filter(d => d.status === 'pending').length;
    const transitCount = deliveries.filter(d => d.status === 'in_transit').length;
    const deliveredCount = deliveries.filter(d => d.status === 'delivered').length;

    const getStatusStyle = (status) => {
        switch (status) {
            case 'pending':
                return {
                    bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700',
                    dot: 'bg-amber-500', label: 'En attente'
                };
            case 'in_transit':
                return {
                    bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700',
                    dot: 'bg-blue-500', label: 'En transit'
                };
            case 'delivered':
                return {
                    bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700',
                    dot: 'bg-emerald-500', label: 'Livré'
                };
            default:
                return {
                    bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700',
                    dot: 'bg-gray-500', label: 'Inconnu'
                };
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-[#1c398e] tracking-tight">Bons de Livraison</h2>
                    <p className="text-gray-500 text-sm mt-1 font-medium">Gestion des expéditions et livraisons clients</p>
                </div>
                <button className="px-4 py-2 bg-[#1c398e] shadow-[0_4px_0_#10255c] hover:shadow-none hover:translate-y-1 transition-all active:scale-95 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Nouveau BL
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* KPI: En attente */}
                <div className="bg-white rounded-sm border-2 border-gray-100 p-6 shadow-sm relative overflow-hidden group hover:border-[#1c398e]/30 transition-colors">
                    <div className="relative z-10 flex flex-col h-full justify-between">
                        <div className="flex-1">
                            <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-blue-600/70">À Préparer</p>
                            <div className="flex items-baseline mt-2 font-semibold" style={{ color: '#1c398e' }}>
                                <h3 className="text-xl sm:text-2xl font-semibold">
                                    {pendingCount}
                                </h3>
                            </div>
                        </div>
                    </div>
                    <div className="absolute bottom-2 right-2 flex items-end opacity-90 group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-700 pointer-events-none">
                        <img src="/icons8/fluency_96_worker-male.png" alt="" className="w-14 h-14 relative -mr-6 z-0" />
                        <img src="/icons8/fluency_96_clipboard.png" alt="" className="w-10 h-10 relative z-10 drop-shadow-md" />
                    </div>
                </div>

                {/* KPI: En Transit */}
                <div className="bg-white rounded-sm border-2 border-gray-100 p-6 shadow-sm relative overflow-hidden group hover:border-[#1c398e]/30 transition-colors">
                    <div className="relative z-10 flex flex-col h-full justify-between">
                        <div className="flex-1">
                            <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-blue-600/70">En Transit</p>
                            <div className="flex items-baseline mt-2 font-semibold" style={{ color: '#1c398e' }}>
                                <h3 className="text-xl sm:text-2xl font-semibold">
                                    {transitCount}
                                </h3>
                            </div>
                        </div>
                    </div>
                    <img
                        src="/icons8/fluency_96_truck.png"
                        alt=""
                        className="absolute bottom-2 right-2 w-16 h-16 opacity-90 group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-700 pointer-events-none"
                    />
                </div>

                {/* KPI: Livrés */}
                <div className="bg-white rounded-sm border-2 border-gray-100 p-6 shadow-sm relative overflow-hidden group hover:border-[#1c398e]/30 transition-colors">
                    <div className="relative z-10 flex flex-col h-full justify-between">
                        <div className="flex-1">
                            <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-blue-600/70">Livrés (Mois)</p>
                            <div className="flex items-baseline mt-2 font-semibold" style={{ color: '#1c398e' }}>
                                <h3 className="text-xl sm:text-2xl font-semibold">
                                    {deliveredCount}
                                </h3>
                            </div>
                        </div>
                    </div>
                    <img
                        src="/icons8/fluency_96_ok.png"
                        alt=""
                        className="absolute bottom-2 right-2 w-16 h-16 opacity-90 group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-700 pointer-events-none"
                    />
                </div>
            </div>

            <div className="bg-white rounded-sm shadow-sm border border-gray-200 flex flex-col">
                <div className="p-4 border-b border-gray-100 bg-gray-50 flex flex-col md:flex-row gap-4 justify-between items-center">
                    <div className="relative w-full md:w-1/3">
                        <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Rechercher par n° BL ou client..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white border-2 border-gray-200 rounded-sm font-semibold text-sm focus:outline-none focus:border-blue-600 focus:ring-0 transition-colors shadow-sm"
                        />
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                        {/* Filtre par Date */}
                        <div className="flex items-center gap-2 bg-white border-2 border-gray-200 rounded-sm px-3 py-1.5 shadow-sm focus-within:border-blue-600 transition-colors">
                            <Calendar className="w-4 h-4 text-blue-600" />
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={e => setDateFrom(e.target.value)}
                                className="text-xs border-none focus:ring-0 p-0 text-gray-600 font-bold bg-transparent"
                            />
                            <span className="text-gray-400 font-bold text-xs">au</span>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={e => setDateTo(e.target.value)}
                                className="text-xs border-none focus:ring-0 p-0 text-gray-600 font-bold bg-transparent"
                            />
                        </div>

                        {/* Filtre par Statut */}
                        <div className="flex items-center bg-white border-2 border-gray-200 rounded-sm px-3 py-1.5 shadow-sm focus-within:border-blue-600 transition-colors">
                            <Filter className="w-4 h-4 text-blue-600 mr-2" />
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="border-none bg-transparent p-0 text-xs font-bold text-gray-700 focus:ring-0 cursor-pointer"
                            >
                                <option value="all">Tous les statuts</option>
                                <option value="pending">À Préparer</option>
                                <option value="in_transit">En Transit</option>
                                <option value="delivered">Livrés</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto pb-4">
                    <table className="w-full text-left text-sm table-fixed" style={{ minWidth: '1000px' }}>
                        <thead className="bg-[#1c398e] border-b-2 border-blue-800 text-white font-black uppercase tracking-widest text-[11px]">
                            <tr>
                                <ResizableHeader columnId="id" title="N° BL" width={colWidths.id} onResize={handleResize} />
                                <ResizableHeader columnId="client" title="Client" width={colWidths.client} onResize={handleResize} />
                                <ResizableHeader columnId="createdAt" title="Créé le" width={colWidths.createdAt} onResize={handleResize} />
                                <ResizableHeader columnId="deliveryDate" title="Livré le" width={colWidths.deliveryDate} onResize={handleResize} />
                                <ResizableHeader columnId="articles" title="Articles" width={colWidths.articles} onResize={handleResize} />
                                <ResizableHeader columnId="ht" title="Total HT (FCFA)" width={colWidths.ht} onResize={handleResize} />
                                <ResizableHeader columnId="tax" title="Taxe (0%)" width={colWidths.tax} onResize={handleResize} />
                                <ResizableHeader columnId="ttc" title="Total TTC (FCFA)" width={colWidths.ttc} onResize={handleResize} />
                                <ResizableHeader columnId="status" title="Statut" width={colWidths.status} onResize={handleResize} />
                                <th style={{ width: `${colWidths.actions}px` }} className="px-4 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y-2 divide-[#e6e6e6]">
                            {filteredDeliveries.length === 0 ? (
                                <tr>
                                    <td colSpan="9" className="px-6 py-8 text-center text-gray-500 font-semibold">
                                        Aucun bon de livraison trouvé.
                                    </td>
                                </tr>
                            ) : (
                                filteredDeliveries.map((delivery) => {
                                    const statusStyle = getStatusStyle(delivery.status);

                                    return (
                                        <tr
                                            key={delivery.id}
                                            className={`transition-all duration-300 divide-x-2 divide-[#e6e6e6] ${delivery.status === 'delivered' ? 'opacity-50 hover:opacity-100 bg-gray-50/50 grayscale-[20%]' : 'odd:bg-[#f3f3f3] even:bg-[#ffffff] hover:bg-blue-50/40'}`}
                                        >
                                            <td className="px-4 py-4 truncate">
                                                <span className="font-semibold text-[#1c398e] bg-blue-50/50 px-2 py-1 border border-[#1c398e]/20 rounded-sm text-[13px]">
                                                    {delivery.id}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 truncate" title={delivery.customerName}>
                                                <span className="font-semibold text-[#1c398e] uppercase text-[13px] tracking-wide">
                                                    {delivery.customerName}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 font-semibold text-[#1c398e] text-[13px] truncate">
                                                {new Date(delivery.createdAt).toLocaleDateString('fr-FR')}
                                            </td>
                                            <td className="px-4 py-4 font-semibold text-gray-500 text-[13px] truncate">
                                                {delivery.deliveryDate ? (
                                                    <span className="text-[#1c398e]">{new Date(delivery.deliveryDate).toLocaleDateString('fr-FR')}</span>
                                                ) : (
                                                    '-'
                                                )}
                                            </td>
                                            <td className="px-4 py-4 truncate">
                                                <span className="font-semibold text-[#1c398e] text-[14px]">{delivery.itemsCount} unités</span>
                                            </td>
                                            <td className="px-4 py-4 font-semibold text-[#1c398e] text-[14px] truncate">
                                                {formatRowPrice(delivery.totalValue)}
                                            </td>
                                            <td className="px-4 py-4 font-semibold text-gray-400 text-[13px] truncate">
                                                0
                                            </td>
                                            <td className="px-4 py-4 font-semibold text-[#1c398e] text-[15px] truncate">
                                                {formatRowPrice(delivery.totalValue)}
                                            </td>
                                            <td className="px-4 py-4 relative overflow-hidden truncate">
                                                {delivery.status !== 'delivered' && (
                                                    <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-sm border ${statusStyle.bg} ${statusStyle.border} relative z-10`}>
                                                        <div className={`w-2 h-2 rounded-full ${statusStyle.dot} ${delivery.status === 'in_transit' ? 'animate-pulse' : ''}`}></div>
                                                        <span className={`text-[10px] font-black uppercase tracking-wider ${statusStyle.text}`}>
                                                            {statusStyle.label}
                                                        </span>
                                                    </div>
                                                )}

                                                {/* Grand Badge Incliné façon Tampon de fond */}
                                                {delivery.status === 'delivered' && (
                                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                                                        <div className="border-[3px] border-emerald-500/50 text-emerald-600/60 px-8 py-1 rounded-md font-black uppercase tracking-[0.5em] text-lg -rotate-[25deg] w-48 text-center select-none shadow-[inset_0_0_10px_rgba(16,185,129,0.1)] bg-white/40 backdrop-blur-[1px]">
                                                            LIVRÉ
                                                        </div>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 text-right whitespace-nowrap">
                                                <div className="relative inline-block text-left ml-auto">
                                                    <button
                                                        onClick={() => setOpenMenuId(openMenuId === delivery.id ? null : delivery.id)}
                                                        className="p-2 text-gray-500 bg-white border-2 border-gray-200 hover:border-blue-500 hover:text-blue-600 rounded-sm transition-all shadow-sm active:scale-95"
                                                        title="Actions"
                                                    >
                                                        <MoreVertical className="w-5 h-5" />
                                                    </button>
                                                    {openMenuId === delivery.id && (
                                                        <>
                                                            <div className="fixed inset-0 z-30" onClick={() => setOpenMenuId(null)}></div>
                                                            <div className="absolute right-0 top-full mt-1 z-40 bg-white border-2 border-gray-200 rounded-sm shadow-xl min-w-[200px] py-1 flex flex-col items-stretch text-left">
                                                                {delivery.status === 'pending' && (
                                                                    <button
                                                                        onClick={() => { handleMarkAsTransit(delivery.id); setOpenMenuId(null); }}
                                                                        className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-blue-700 hover:bg-blue-50 flex items-center gap-2"
                                                                    >
                                                                        <Truck className="w-4 h-4" />
                                                                        Expédier
                                                                    </button>
                                                                )}
                                                                {delivery.status === 'in_transit' && (
                                                                    <button
                                                                        onClick={() => { handleMarkAsDelivered(delivery.id); setOpenMenuId(null); }}
                                                                        className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-emerald-700 hover:bg-emerald-50 flex items-center gap-2"
                                                                    >
                                                                        <CheckCircle2 className="w-4 h-4" />
                                                                        Confirmer Livraison
                                                                    </button>
                                                                )}
                                                                {(delivery.status === 'pending' || delivery.status === 'in_transit') && (
                                                                    <div className="h-px bg-gray-200 my-1"></div>
                                                                )}
                                                                <button
                                                                    onClick={() => setOpenMenuId(null)}
                                                                    className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                                                >
                                                                    <Printer className="w-4 h-4" />
                                                                    Imprimer BL
                                                                </button>
                                                                <button
                                                                    onClick={() => setOpenMenuId(null)}
                                                                    className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-[#1c398e] hover:bg-blue-50 flex items-center gap-2"
                                                                >
                                                                    <Eye className="w-4 h-4" />
                                                                    Voir les détails
                                                                </button>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Deliveries;
