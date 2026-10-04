import React, { useState } from 'react';
import { useDeliveries } from '../../context/DeliveryContext';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';
import { 
    Search, Truck, CheckCircle2, Clock, FileText, Printer, 
    Calendar, Filter, Eye, AlertCircle, Check, X, Building2, User, ChevronRight, History
} from 'lucide-react';
import { formatPrice } from '../../utils/currency';
import T from '../../utils/toast';

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
            className="px-3 py-3 relative group border-r-2 border-[#e6e6e6]/40 hover:bg-[#001d35] transition-colors select-none text-left"
        >
            <div className="flex items-center overflow-hidden whitespace-nowrap">
                {title}
            </div>
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
    const { deliveryNotes, recordWithdrawal, deleteDeliveryNote } = useDeliveries();
    const { company, stores, currentStoreId } = useSettings();
    const { user } = useAuth();

    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    // Modals
    const [activeWithdrawModal, setActiveWithdrawModal] = useState(null); // Bon sélectionné pour décharge
    const [activeHistoryModal, setActiveHistoryModal] = useState(null); // Bon sélectionné pour historique
    const [withdrawForm, setWithdrawForm] = useState({
        items: {},
        receiverName: '',
        driverName: '',
        vehicleNumber: '',
        warehousemanName: '',
        notes: ''
    });

    const [colWidths, setColWidths] = useState({
        reference: 140,
        customer: 200,
        site: 150,
        date: 110,
        progress: 180,
        remaining: 200,
        status: 140,
        actions: 160
    });

    const handleResize = (columnId, newWidth) => {
        setColWidths(prev => ({ ...prev, [columnId]: newWidth }));
    };

    // Statistiques clés pour le gérant & magasinier
    const pendingCount = deliveryNotes.filter(d => d.status === 'pending').length;
    const partialCount = deliveryNotes.filter(d => d.status === 'partial').length;
    const completedCount = deliveryNotes.filter(d => d.status === 'completed').length;
    const totalCount = deliveryNotes.length;

    // Filtrage des bons
    const filteredNotes = deliveryNotes.filter(note => {
        const query = searchTerm.toLowerCase();
        const matchSearch = 
            note.reference?.toLowerCase().includes(query) ||
            note.customerName?.toLowerCase().includes(query) ||
            note.customerPhone?.toLowerCase().includes(query) ||
            note.siteName?.toLowerCase().includes(query) ||
            note.driverName?.toLowerCase().includes(query) ||
            note.items?.some(i => i.name?.toLowerCase().includes(query));

        const matchStatus = statusFilter === 'all' || note.status === statusFilter;
        const noteDate = note.createdAt ? new Date(note.createdAt).toISOString().slice(0, 10) : '';
        const matchDateFrom = !dateFrom || noteDate >= dateFrom;
        const matchDateTo = !dateTo || noteDate <= dateTo;

        return matchSearch && matchStatus && matchDateFrom && matchDateTo;
    });

    // Ouverture du modal de décharge
    const handleOpenWithdrawModal = (note) => {
        const initialItems = {};
        note.items.forEach(item => {
            initialItems[item.productId] = item.remainingQty > 0 ? item.remainingQty : 0;
        });

        const defaultWarehouseman = user?.firstName 
            ? `${user.firstName} ${user.lastName || ''}`.trim() 
            : (user?.name || user?.username || 'Magasinier');

        setWithdrawForm({
            items: initialItems,
            receiverName: note.customerName || '',
            driverName: note.driverName || '',
            vehicleNumber: note.vehicleNumber || '',
            warehousemanName: defaultWarehouseman,
            notes: ''
        });

        setActiveWithdrawModal(note);
    };

    // Validation de la décharge par le magasinier
    const handleConfirmWithdrawal = (e) => {
        e.preventDefault();
        if (!activeWithdrawModal) return;

        const withdrawnItems = Object.entries(withdrawForm.items).map(([productId, qty]) => ({
            productId,
            qty: parseFloat(qty) || 0
        })).filter(w => w.qty > 0);

        if (withdrawnItems.length === 0) {
            T.warning("Veuillez saisir au moins une quantité à retirer supérieure à 0.");
            return;
        }

        recordWithdrawal(activeWithdrawModal.id, {
            withdrawnItems,
            receiverName: withdrawForm.receiverName || activeWithdrawModal.customerName,
            driverName: withdrawForm.driverName,
            vehicleNumber: withdrawForm.vehicleNumber,
            warehousemanName: withdrawForm.warehousemanName,
            notes: withdrawForm.notes
        });

        setActiveWithdrawModal(null);
    };

    // Impression du Bon à Enlever ou de Décharge
    const handlePrintNote = (note) => {
        const printWindow = window.open('', '_blank', 'width=900,height=750');
        if (!printWindow) {
            T.error("Veuillez autoriser les fenêtres pop-up pour imprimer.");
            return;
        }

        const storeName = company?.name || "Quincaillerie Pro";
        const storePhone = company?.phone || "";
        const storeAddress = company?.address || "";
        const storeNif = company?.nif || "";

        const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Bon à Enlever - ${note.reference}</title>
    <meta charset="utf-8" />
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 30px; color: #1e293b; }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #001d35; padding-bottom: 15px; margin-bottom: 20px; }
        .title { font-size: 24px; font-weight: 900; color: #001d35; margin: 0; text-transform: uppercase; }
        .ref-box { background: #f1f5f9; border: 2px solid #001d35; padding: 10px 20px; text-align: center; border-radius: 4px; }
        .ref-number { font-size: 20px; font-weight: 900; color: #001d35; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px; }
        .card { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px 16px; }
        .card h4 { margin: 0 0 8px 0; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 800; }
        .card p { margin: 3px 0; font-size: 13px; font-weight: 600; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
        th { background: #001d35; color: white; text-transform: uppercase; font-size: 11px; padding: 10px 12px; text-align: left; }
        td { border-bottom: 1px solid #e2e8f0; padding: 10px 12px; font-size: 13px; }
        .badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 800; text-transform: uppercase; }
        .badge-pending { background: #fef3c7; color: #92400e; }
        .badge-partial { background: #dbeafe; color: #1e40af; }
        .badge-completed { background: #d1fae5; color: #065f46; }
        .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 50px; }
        .sign-box { border-top: 1px dashed #64748b; padding-top: 10px; text-align: center; font-size: 12px; font-weight: 700; color: #475569; }
        .sign-area { height: 70px; }
        @media print {
            body { margin: 15px; }
            button { display: none; }
        }
    </style>
</head>
<body>
    <div class="header">
        <div>
            <h1 class="title">${storeName}</h1>
            <p style="margin: 4px 0; font-size: 12px; color: #64748b;">${storeAddress} ${storePhone ? '• Tél: ' + storePhone : ''}</p>
            ${storeNif ? `<p style="margin: 2px 0; font-size: 11px; color: #64748b;">NIF: ${storeNif}</p>` : ''}
        </div>
        <div class="ref-box">
            <div style="font-size: 10px; text-transform: uppercase; font-weight: 800; color: #475569;">Bon à Enlever (Dépôt)</div>
            <div class="ref-number">${note.reference}</div>
            <div style="font-size: 11px; margin-top: 4px; color: #64748b;">${new Date(note.createdAt).toLocaleDateString('fr-FR')}</div>
        </div>
    </div>

    <div class="info-grid">
        <div class="card">
            <h4>Client & Destination</h4>
            <p><strong>Client :</strong> ${note.customerName || 'Client Comptoir'}</p>
            ${note.customerPhone ? `<p><strong>Téléphone :</strong> ${note.customerPhone}</p>` : ''}
            ${note.siteName ? `<p><strong>Chantier :</strong> ${note.siteName}</p>` : ''}
        </div>
        <div class="card">
            <h4>Détails Enlèvement & Statut</h4>
            <p><strong>Statut :</strong> <span class="badge badge-${note.status}">${note.status === 'completed' ? 'Soldé / Livré' : (note.status === 'partial' ? 'Retrait Partiel' : 'En Attente')}</span></p>
            ${note.driverName ? `<p><strong>Chauffeur :</strong> ${note.driverName}</p>` : ''}
            ${note.vehicleNumber ? `<p><strong>Véhicule :</strong> ${note.vehicleNumber}</p>` : ''}
            ${note.notes ? `<p><strong>Notes :</strong> ${note.notes}</p>` : ''}
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th>Désignation Article</th>
                <th style="text-align: center;">Quantité Commandée</th>
                <th style="text-align: center;">Déjà Retirée</th>
                <th style="text-align: center;">Reste à Enlever</th>
            </tr>
        </thead>
        <tbody>
            ${note.items.map(item => `
                <tr>
                    <td><strong>${item.name}</strong></td>
                    <td style="text-align: center; font-weight: bold;">${item.purchasedQty} ${item.unit}</td>
                    <td style="text-align: center; color: #0284c7; font-weight: bold;">${item.deliveredQty} ${item.unit}</td>
                    <td style="text-align: center; color: ${item.remainingQty > 0 ? '#b45309' : '#059669'}; font-weight: 800; font-size: 14px;">
                        ${item.remainingQty} ${item.unit}
                    </td>
                </tr>
            `).join('')}
        </tbody>
    </table>

    ${note.withdrawals?.length > 0 ? `
        <div style="margin-top: 20px;">
            <h4 style="font-size: 11px; text-transform: uppercase; color: #64748b; margin-bottom: 8px;">Historique des Décharges effectuées</h4>
            <table style="font-size: 12px;">
                <thead>
                    <tr style="background: #334155;">
                        <th>Date & Heure</th>
                        <th>Réceptionnaire / Chauffeur</th>
                        <th>Magasinier</th>
                        <th>Quantités Déchargées</th>
                    </tr>
                </thead>
                <tbody>
                    ${note.withdrawals.map(w => `
                        <tr>
                            <td>${new Date(w.date).toLocaleString('fr-FR')}</td>
                            <td>${w.receiverName || w.driverName || '-'}</td>
                            <td>${w.warehousemanName || '-'}</td>
                            <td>${w.items.map(i => {
                                const matched = note.items.find(it => it.productId === i.productId);
                                return `${matched ? matched.name : 'Article'} : <strong>${i.qty}</strong>`;
                            }).join(', ')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    ` : ''}

    <div class="signatures">
        <div>
            <div class="sign-area"></div>
            <div class="sign-box">Signature du Magasinier (Dépôt)</div>
        </div>
        <div>
            <div class="sign-area"></div>
            <div class="sign-box">Signature du Client / Chauffeur</div>
        </div>
    </div>

    <script>
        window.onload = function() { window.print(); }
    </script>
</body>
</html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-[#001d35] tracking-tight flex items-center gap-2.5">
                        <Truck className="w-7 h-7 text-amber-600" />
                        <span>Bons à Enlever & Retraits Dépôt</span>
                    </h2>
                    <p className="text-gray-500 text-sm mt-1 font-medium">
                        Gestion des sorties de stock, enlèvements partiels (ciment, fer, agrégats) et reliquats
                    </p>
                </div>
            </div>

            {/* 4 KPIs Métier Quincaillerie */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Total Bons */}
                <div className="bg-white p-3 rounded-sm border-2 border-gray-300 shadow-sm relative group hover:shadow-md transition-shadow overflow-hidden flex flex-col justify-center min-h-[120px]">
                    <div className="flex justify-between items-start relative z-10">
                        <div className="flex-1">
                            <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-blue-600/70">Total Bons Émis</p>
                            <div className="flex items-baseline mt-2 font-semibold opacity-85" style={{ color: '#001d35', opacity: 0.85 }}>
                                <h3 className="text-xl sm:text-2xl font-semibold">{totalCount}</h3>
                            </div>
                            <p className="text-xs text-gray-400 mt-1.5 font-medium">Commandes à retirer au dépôt</p>
                        </div>
                    </div>
                    <FileText className="absolute bottom-2 right-2 w-14 h-14 text-blue-900/10 group-hover:scale-105 transition-all pointer-events-none" />
                </div>

                {/* En attente complète */}
                <div 
                    onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}
                    className={`bg-white p-3 rounded-sm border-2 shadow-sm relative group hover:shadow-md transition-shadow overflow-hidden flex flex-col justify-center min-h-[120px] cursor-pointer ${
                        statusFilter === 'pending' ? 'border-amber-500 ring-1 ring-amber-400' : 'border-gray-300'
                    }`}
                >
                    <div className="flex justify-between items-start relative z-10">
                        <div className="flex-1">
                            <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-amber-600/80">À Servir (En attente)</p>
                            <div className="flex items-baseline mt-2 font-semibold opacity-85" style={{ color: '#b45309', opacity: 0.85 }}>
                                <h3 className="text-xl sm:text-2xl font-semibold">{pendingCount}</h3>
                            </div>
                            <p className="text-xs text-gray-400 mt-1.5 font-medium">Non entamés au hangar</p>
                        </div>
                    </div>
                    <Clock className="absolute bottom-2 right-2 w-14 h-14 text-amber-500/10 group-hover:scale-105 transition-all pointer-events-none" />
                </div>

                {/* Retraits partiels en cours (Reliquats) */}
                <div 
                    onClick={() => setStatusFilter(statusFilter === 'partial' ? 'all' : 'partial')}
                    className={`bg-white p-3 rounded-sm border-2 shadow-sm relative group hover:shadow-md transition-shadow overflow-hidden flex flex-col justify-center min-h-[120px] cursor-pointer ${
                        statusFilter === 'partial' ? 'border-blue-500 ring-1 ring-blue-400' : 'border-gray-300'
                    }`}
                >
                    <div className="flex justify-between items-start relative z-10">
                        <div className="flex-1">
                            <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-blue-600/70">Retraits Partiels</p>
                            <div className="flex items-baseline mt-2 font-semibold opacity-85" style={{ color: '#001d35', opacity: 0.85 }}>
                                <h3 className="text-xl sm:text-2xl font-semibold">{partialCount}</h3>
                            </div>
                            <p className="text-xs text-gray-400 mt-1.5 font-medium">Reliquats à enlever</p>
                        </div>
                    </div>
                    <Truck className="absolute bottom-2 right-2 w-14 h-14 text-blue-900/10 group-hover:scale-105 transition-all pointer-events-none" />
                </div>

                {/* Soldés / Livrés */}
                <div 
                    onClick={() => setStatusFilter(statusFilter === 'completed' ? 'all' : 'completed')}
                    className={`bg-white p-3 rounded-sm border-2 shadow-sm relative group hover:shadow-md transition-shadow overflow-hidden flex flex-col justify-center min-h-[120px] cursor-pointer ${
                        statusFilter === 'completed' ? 'border-emerald-500 ring-1 ring-emerald-400' : 'border-gray-300'
                    }`}
                >
                    <div className="flex justify-between items-start relative z-10">
                        <div className="flex-1">
                            <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-emerald-600/80">Soldés & Livrés</p>
                            <div className="flex items-baseline mt-2 font-semibold opacity-85" style={{ color: '#047857', opacity: 0.85 }}>
                                <h3 className="text-xl sm:text-2xl font-semibold">{completedCount}</h3>
                            </div>
                            <p className="text-xs text-gray-400 mt-1.5 font-medium">Sorties intégrales achevées</p>
                        </div>
                    </div>
                    <CheckCircle2 className="absolute bottom-2 right-2 w-14 h-14 text-emerald-500/10 group-hover:scale-105 transition-all pointer-events-none" />
                </div>
            </div>

            {/* Table & Barre d'outils */}
            <div className="bg-white rounded-sm shadow-sm border border-gray-200 flex flex-col">
                <div className="p-4 border-b border-gray-100 bg-gray-50 flex flex-col md:flex-row gap-4 justify-between items-center">
                    <div className="relative w-full md:w-1/3">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Rechercher BAE, client, chantier, article..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-white border-2 border-gray-200 rounded-sm font-semibold text-xs focus:outline-none focus:border-[#001d35] transition-colors shadow-2xs"
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                        {/* Filtre par Date */}
                        <div className="flex items-center gap-1.5 bg-white border-2 border-gray-200 rounded-sm px-2.5 py-1.5 shadow-2xs">
                            <Calendar className="w-3.5 h-3.5 text-gray-500" />
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={e => setDateFrom(e.target.value)}
                                className="text-xs border-none focus:ring-0 p-0 text-gray-700 font-bold bg-transparent"
                            />
                            <span className="text-gray-400 text-xs">à</span>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={e => setDateTo(e.target.value)}
                                className="text-xs border-none focus:ring-0 p-0 text-gray-700 font-bold bg-transparent"
                            />
                        </div>

                        {/* Filtre par Statut */}
                        <div className="flex items-center bg-white border-2 border-gray-200 rounded-sm px-2.5 py-1.5 shadow-2xs">
                            <Filter className="w-3.5 h-3.5 text-gray-500 mr-1.5" />
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="border-none bg-transparent p-0 text-xs font-bold text-gray-700 focus:ring-0 cursor-pointer"
                            >
                                <option value="all">Tous les bons</option>
                                <option value="pending">En attente (Non entamés)</option>
                                <option value="partial">Retraits partiels</option>
                                <option value="completed">Soldés / Livrés</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto pb-4">
                    <table className="w-full text-left text-sm table-fixed" style={{ minWidth: '1050px' }}>
                        <thead className="bg-[#001d35] border-b-2 border-[#001222] text-white font-black uppercase tracking-wider text-[11px]">
                            <tr>
                                <ResizableHeader columnId="reference" title="N° BAE" width={colWidths.reference} onResize={handleResize} />
                                <ResizableHeader columnId="customer" title="Client / Chantier" width={colWidths.customer} onResize={handleResize} />
                                <ResizableHeader columnId="date" title="Émis le" width={colWidths.date} onResize={handleResize} />
                                <ResizableHeader columnId="progress" title="Progression Enlèvement" width={colWidths.progress} onResize={handleResize} />
                                <ResizableHeader columnId="remaining" title="Articles & Reliquats" width={colWidths.remaining} onResize={handleResize} />
                                <ResizableHeader columnId="status" title="Statut" width={colWidths.status} onResize={handleResize} />
                                <th style={{ width: `${colWidths.actions}px` }} className="px-3 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y-2 divide-[#e6e6e6]">
                            {filteredNotes.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-12 text-center text-gray-500 font-medium">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center border border-amber-200 text-amber-700">
                                                <Truck className="w-6 h-6" />
                                            </div>
                                            <p className="text-base font-bold text-gray-800">Aucun bon d'enlèvement trouvé</p>
                                            <p className="text-xs text-gray-500 max-w-sm">
                                                Lorsqu'une vente au comptoir est enregistrée en mode <strong>« Bon à Enlever au Dépôt »</strong>, elle apparaît immédiatement ici pour le magasinier.
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredNotes.map((note) => {
                                    // Calcul du pourcentage global d'enlèvement
                                    const totalPurchased = note.items.reduce((s, i) => s + (i.purchasedQty || 0), 0);
                                    const totalDelivered = note.items.reduce((s, i) => s + (i.deliveredQty || 0), 0);
                                    const percent = totalPurchased > 0 ? Math.round((totalDelivered / totalPurchased) * 100) : 0;

                                    return (
                                        <tr
                                            key={note.id}
                                            className={`transition-colors divide-x-2 divide-[#e6e6e6] ${
                                                note.status === 'completed'
                                                    ? 'bg-gray-50/60 opacity-60 hover:opacity-100'
                                                    : (note.status === 'partial' ? 'bg-blue-50/20 hover:bg-blue-50/50' : 'bg-white hover:bg-amber-50/30')
                                            }`}
                                        >
                                            {/* N° BAE */}
                                            <td className="px-3 py-3 truncate">
                                                <span className="font-mono font-bold text-[#001d35] bg-blue-50/80 px-2 py-1 border border-blue-200 rounded-sm text-xs shadow-2xs">
                                                    {note.reference}
                                                </span>
                                            </td>

                                            {/* Client / Chantier */}
                                            <td className="px-3 py-3 truncate">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-[#001d35] text-xs uppercase tracking-wide truncate">
                                                        {note.customerName}
                                                    </span>
                                                    {note.siteName && (
                                                        <span className="text-[11px] text-amber-800 font-semibold flex items-center gap-1 mt-0.5 truncate">
                                                            <Building2 className="w-3 h-3 text-amber-600 flex-shrink-0" />
                                                            <span>{note.siteName}</span>
                                                        </span>
                                                    )}
                                                    {note.vehicleNumber && (
                                                        <span className="text-[10px] text-gray-500 truncate mt-0.5">
                                                            Véhicule : {note.vehicleNumber}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Date */}
                                            <td className="px-3 py-3 text-xs font-semibold text-gray-700 truncate">
                                                {new Date(note.createdAt).toLocaleDateString('fr-FR')}
                                                <span className="block text-[10px] text-gray-400 font-normal">
                                                    {new Date(note.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </td>

                                            {/* Progression */}
                                            <td className="px-3 py-3">
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex justify-between items-center text-[11px] font-bold">
                                                        <span className="text-gray-700">{totalDelivered} / {totalPurchased} sortis</span>
                                                        <span className={percent === 100 ? 'text-emerald-700' : (percent > 0 ? 'text-blue-700' : 'text-amber-700')}>
                                                            {percent}%
                                                        </span>
                                                    </div>
                                                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                                        <div 
                                                            className={`h-full transition-all duration-500 ${
                                                                percent === 100 ? 'bg-emerald-500' : (percent > 0 ? 'bg-blue-600' : 'bg-amber-400')
                                                            }`}
                                                            style={{ width: `${percent}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Articles & Reliquats */}
                                            <td className="px-3 py-3 truncate">
                                                <div className="space-y-1">
                                                    {note.items.slice(0, 2).map((item, idx) => (
                                                        <div key={idx} className="flex items-center justify-between text-xs">
                                                            <span className="truncate max-w-[130px] font-medium text-gray-800" title={item.name}>
                                                                {item.name}
                                                            </span>
                                                            <span className={`font-bold text-[11px] ml-1 px-1.5 py-0.5 rounded-sm ${
                                                                item.remainingQty > 0 ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-800'
                                                            }`}>
                                                                {item.remainingQty > 0 ? `Reste ${item.remainingQty} ${item.unit}` : 'Soldé'}
                                                            </span>
                                                        </div>
                                                    ))}
                                                    {note.items.length > 2 && (
                                                        <span className="text-[10px] text-gray-500 font-semibold block">
                                                            + {note.items.length - 2} autre(s) article(s)...
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Statut */}
                                            <td className="px-3 py-3">
                                                {note.status === 'completed' && (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold text-[10px] uppercase tracking-wider">
                                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                                        Soldé
                                                    </span>
                                                )}
                                                {note.status === 'partial' && (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-blue-50 text-blue-800 border border-blue-300 font-bold text-[10px] uppercase tracking-wider animate-pulse">
                                                        <Truck className="w-3.5 h-3.5 text-blue-600" />
                                                        Partiel
                                                    </span>
                                                )}
                                                {note.status === 'pending' && (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-amber-50 text-amber-900 border border-amber-300 font-bold text-[10px] uppercase tracking-wider">
                                                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                                                        En attente
                                                    </span>
                                                )}
                                            </td>

                                            {/* Actions */}
                                            <td className="px-3 py-3 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {note.status !== 'completed' && (
                                                        <button
                                                            onClick={() => handleOpenWithdrawModal(note)}
                                                            className="px-2.5 py-1.5 bg-[#001d35] hover:bg-blue-800 text-white rounded-sm font-bold text-xs uppercase flex items-center gap-1 shadow-2xs active:scale-95 transition-all"
                                                            title="Effectuer un retrait magasinier"
                                                        >
                                                            <Truck className="w-3.5 h-3.5" />
                                                            <span>Retrait</span>
                                                        </button>
                                                    )}

                                                    <button
                                                        onClick={() => handlePrintNote(note)}
                                                        className="p-1.5 bg-white border border-gray-300 hover:border-gray-400 text-gray-700 rounded-sm transition-colors shadow-2xs"
                                                        title="Imprimer le bon à enlever"
                                                    >
                                                        <Printer className="w-4 h-4" />
                                                    </button>

                                                    {note.withdrawals?.length > 0 && (
                                                        <button
                                                            onClick={() => setActiveHistoryModal(note)}
                                                            className="p-1.5 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-800 rounded-sm transition-colors shadow-2xs"
                                                            title="Voir l'historique des décharges"
                                                        >
                                                            <History className="w-4 h-4" />
                                                        </button>
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

            {/* Modal Décharge Magasinier */}
            {activeWithdrawModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-2xl rounded-sm shadow-2xl border-t-4 border-[#001d35] overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
                        <div className="p-5 border-b border-gray-200 flex justify-between items-start bg-white flex-shrink-0">
                            <div>
                                <h3 className="text-sm sm:text-base font-bold text-[#001d35] uppercase tracking-wide">
                                    Enregistrement de Décharge — {activeWithdrawModal.reference}
                                </h3>
                                <p className="text-gray-500 text-xs mt-0.5 font-normal">
                                    Client : <strong className="text-gray-800">{activeWithdrawModal.customerName}</strong>
                                    {activeWithdrawModal.siteName && <span> • Chantier : <strong className="text-gray-800">{activeWithdrawModal.siteName}</strong></span>}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setActiveWithdrawModal(null)}
                                className="text-gray-400 hover:text-gray-600 p-1 rounded transition-colors cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <form onSubmit={handleConfirmWithdrawal} className="flex flex-col flex-1 overflow-hidden">
                            <div className="p-5 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
                                {/* Table des articles à décharger */}
                                <div>
                                    <h4 className="text-[11px] font-bold text-blue-600/70 uppercase tracking-widest mb-2 border-b pb-1 border-gray-200">
                                        Articles à retirer aujourd'hui
                                    </h4>
                                    <div className="border border-gray-200 rounded-sm overflow-hidden shadow-2xs">
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-[#001d35] text-white font-bold uppercase text-[10px]">
                                                <tr>
                                                    <th className="p-2.5">Article</th>
                                                    <th className="p-2.5 text-center">Total Acheté</th>
                                                    <th className="p-2.5 text-center">Déjà Sorti</th>
                                                    <th className="p-2.5 text-center">Reste au Dépôt</th>
                                                    <th className="p-2.5 text-right w-36">Sortie ce jour</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 bg-white">
                                                {activeWithdrawModal.items.map((item) => (
                                                    <tr key={item.productId} className="hover:bg-gray-50">
                                                        <td className="p-2.5 font-bold text-gray-800">
                                                            {item.name}
                                                        </td>
                                                        <td className="p-2.5 text-center text-gray-600 font-semibold">
                                                            {item.purchasedQty} {item.unit}
                                                        </td>
                                                        <td className="p-2.5 text-center text-blue-700 font-semibold">
                                                            {item.deliveredQty} {item.unit}
                                                        </td>
                                                        <td className="p-2.5 text-center font-bold text-amber-900 bg-amber-50/50">
                                                            {item.remainingQty} {item.unit}
                                                        </td>
                                                        <td className="p-2.5 text-right">
                                                            <div className="flex items-center gap-1 justify-end">
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    max={item.remainingQty}
                                                                    step="any"
                                                                    disabled={item.remainingQty <= 0}
                                                                    value={withdrawForm.items[item.productId] ?? ''}
                                                                    onChange={(e) => {
                                                                        const val = e.target.value === '' ? '' : Math.min(item.remainingQty, Math.max(0, parseFloat(e.target.value) || 0));
                                                                        setWithdrawForm(prev => ({
                                                                            ...prev,
                                                                            items: { ...prev.items, [item.productId]: val }
                                                                        }));
                                                                    }}
                                                                    className="w-20 px-2 py-1 text-right text-xs font-bold border border-gray-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-[#001d35] disabled:bg-gray-100"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setWithdrawForm(prev => ({
                                                                            ...prev,
                                                                            items: { ...prev.items, [item.productId]: item.remainingQty }
                                                                        }));
                                                                    }}
                                                                    disabled={item.remainingQty <= 0}
                                                                    className="text-[10px] font-bold uppercase px-1.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-sm transition-colors disabled:opacity-30 cursor-pointer"
                                                                    title="Tout retirer"
                                                                >
                                                                    Max
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Informations de la décharge */}
                                <div>
                                    <h4 className="text-[11px] font-bold text-blue-600/70 uppercase tracking-widest mb-2 border-b pb-1 border-gray-200">
                                        Informations & Responsables de Décharge
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50/80 p-3.5 border border-gray-200 rounded-sm">
                                        <div>
                                            <label className="block text-[11px] font-semibold text-gray-700 uppercase tracking-wide mb-1">
                                                Réceptionnaire (Client / Chauffeur)
                                            </label>
                                            <input
                                                type="text"
                                                value={withdrawForm.receiverName}
                                                onChange={(e) => setWithdrawForm({ ...withdrawForm, receiverName: e.target.value })}
                                                placeholder="Ex: Koffi chauffeur"
                                                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#001d35] text-gray-800"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[11px] font-semibold text-gray-700 uppercase tracking-wide mb-1">
                                                N° Véhicule / Tricycle (Optionnel)
                                            </label>
                                            <input
                                                type="text"
                                                value={withdrawForm.vehicleNumber}
                                                onChange={(e) => setWithdrawForm({ ...withdrawForm, vehicleNumber: e.target.value })}
                                                placeholder="Ex: Tricycle TG-5421"
                                                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#001d35] text-gray-800"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[11px] font-semibold text-gray-700 uppercase tracking-wide mb-1">
                                                Magasinier responsable
                                            </label>
                                            <input
                                                type="text"
                                                value={withdrawForm.warehousemanName}
                                                onChange={(e) => setWithdrawForm({ ...withdrawForm, warehousemanName: e.target.value })}
                                                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#001d35] font-semibold text-gray-800"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[11px] font-semibold text-gray-700 uppercase tracking-wide mb-1">
                                                Observations / Remarques
                                            </label>
                                            <input
                                                type="text"
                                                value={withdrawForm.notes}
                                                onChange={(e) => setWithdrawForm({ ...withdrawForm, notes: e.target.value })}
                                                placeholder="Ex: Enlèvement sous la pluie, sacs intacts"
                                                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#001d35] text-gray-800"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="p-4 bg-white border-t border-gray-200 flex justify-end gap-3 flex-shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setActiveWithdrawModal(null)}
                                    className="px-5 py-2.5 border-2 border-gray-200 text-gray-700 font-bold uppercase tracking-wider text-xs hover:bg-gray-50 rounded-sm cursor-pointer transition-colors"
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2.5 bg-[#001d35] hover:bg-[#002d52] text-white font-bold uppercase tracking-wider text-xs rounded-sm cursor-pointer transition-all shadow-sm flex items-center justify-center gap-2"
                                >
                                    <Check className="w-4 h-4" />
                                    <span>Valider la Sortie Dépôt</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Historique des Décharges */}
            {activeHistoryModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-xl rounded-sm shadow-2xl border-t-4 border-[#001d35] overflow-hidden animate-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col">
                        {/* Header modale historique */}
                        <div className="p-5 border-b border-gray-200 flex justify-between items-start bg-white flex-shrink-0">
                            <div>
                                <h3 className="text-sm sm:text-base font-bold text-[#001d35] uppercase tracking-wide">
                                    Historique des Décharges — {activeHistoryModal.reference}
                                </h3>
                                <p className="text-gray-500 text-xs mt-0.5 font-normal">
                                    Client : <strong className="text-gray-800">{activeHistoryModal.customerName}</strong>
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setActiveHistoryModal(null)}
                                className="text-gray-400 hover:text-gray-600 p-1 rounded transition-colors cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-5 overflow-y-auto space-y-3 flex-1 custom-scrollbar">
                            {activeHistoryModal.withdrawals?.length === 0 ? (
                                <p className="text-center text-gray-500 text-xs py-8 font-medium">
                                    Aucune décharge n'a encore été effectuée pour ce bon.
                                </p>
                            ) : (
                                activeHistoryModal.withdrawals.map((w, idx) => (
                                    <div key={w.id || idx} className="p-3.5 bg-slate-50/80 border border-gray-200 rounded-sm space-y-2">
                                        <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                                            <span className="font-bold text-xs text-[#001d35] uppercase tracking-wide">
                                                Décharge N°{activeHistoryModal.withdrawals.length - idx}
                                            </span>
                                            <span className="text-[11px] text-gray-500 font-semibold">
                                                {new Date(w.date).toLocaleString('fr-FR')}
                                            </span>
                                        </div>
                                        <div className="text-xs text-gray-600 grid grid-cols-2 gap-2">
                                            <div>
                                                <span className="text-gray-400 block text-[10px] uppercase font-bold">Réceptionnaire :</span>
                                                <strong className="text-gray-800">{w.receiverName || w.driverName || '-'}</strong>
                                                {w.vehicleNumber && <span className="block text-[10px] text-gray-500">Véhicule : {w.vehicleNumber}</span>}
                                            </div>
                                            <div>
                                                <span className="text-gray-400 block text-[10px] uppercase font-bold">Magasinier :</span>
                                                <strong className="text-gray-800">{w.warehousemanName || '-'}</strong>
                                            </div>
                                        </div>
                                        <div>
                                            <span className="text-gray-400 block text-[10px] uppercase font-bold mb-1">Articles retirés :</span>
                                            <div className="flex flex-wrap gap-1.5">
                                                {w.items.map((it, i) => {
                                                    const matched = activeHistoryModal.items.find(m => m.productId === it.productId);
                                                    return (
                                                        <span key={i} className="text-[11px] bg-white border border-gray-300 px-2 py-0.5 rounded-sm font-bold text-gray-800">
                                                            {matched ? matched.name : 'Article'} : <span className="text-blue-700">+{it.qty} {matched?.unit}</span>
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 bg-white border-t border-gray-200 flex justify-end flex-shrink-0">
                            <button
                                type="button"
                                onClick={() => setActiveHistoryModal(null)}
                                className="px-5 py-2.5 bg-[#001d35] hover:bg-[#002d52] text-white font-bold uppercase tracking-wider text-xs rounded-sm cursor-pointer transition-colors shadow-sm"
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

export default Deliveries;
