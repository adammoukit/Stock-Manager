import React, { useState, useEffect } from 'react';
import { usePurchase } from '../../context/PurchaseContext';
import { useSettings } from '../../context/SettingsContext';
import {
    Package, Plus, Search, X, Printer, Eye, Trash2, CheckCircle2,
    Clock, Truck, XCircle, ChevronDown, Filter, Calendar,
    Building2, ArrowDownToLine, PackageCheck, AlertCircle,
    FileText, Edit3, RotateCcw
} from 'lucide-react';
import { formatPrice, formatRowPrice } from '../../utils/currency';
import T from '../../utils/toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import ReplenishmentOrderDetailModal from '../../components/ReplenishmentOrderDetailModal';

// ─── Status config ──────────────────────────────────────────────────────────
const STATUS_CONFIG = {
    'Draft':     { label: 'Brouillon',        color: 'bg-gray-100 text-gray-600 border-gray-200',     dot: 'bg-gray-400' },
    'Ordered':   { label: 'Commandé',          color: 'bg-blue-50 text-blue-700 border-blue-200',      dot: 'bg-blue-500' },
    'Partial':   { label: 'Partiellement reçu', color: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
    'Completed': { label: 'Reçu complet',      color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
};

// ─── Print PDF helper ────────────────────────────────────────────────────────
const printPurchaseOrder = (order, company) => {
    const win = window.open('', '_blank', 'width=900,height=700');
    const itemsHtml = order.items.map((item, i) => `
        <tr style="background:${i % 2 === 0 ? '#f9fafb' : '#fff'};">
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${item.name}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${item.quantityOrdered}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${item.quantityReceived || 0}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatRowPrice(item.purchasePrice)} F CFA</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">${formatRowPrice((item.purchasePrice || 0) * item.quantityOrdered)} F CFA</td>
        </tr>
    `).join('');

    const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG['Ordered'];
    win.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/>
    <title>BC ${order.orderNumber}</title>
    <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:'Segoe UI',Arial,sans-serif; color:#1f2937; background:#fff; padding:40px; font-size:13px; }
        .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:32px; padding-bottom:24px; border-bottom:3px solid #001d35; }
        .company-name { font-size:22px; font-weight:800; color:#001d35; }
        .company-info { color:#6b7280; font-size:12px; line-height:1.6; margin-top:4px; }
        .bc-meta { text-align:right; }
        .bc-num { font-size:24px; font-weight:900; color:#001d35; letter-spacing:1px; }
        table { width:100%; border-collapse:collapse; margin-top:8px; }
        thead tr { background:#001d35; color:#fff; }
        thead th { padding:10px 12px; text-align:left; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; }
        thead th:nth-child(2), thead th:nth-child(3) { text-align:center; }
        thead th:nth-child(4), thead th:nth-child(5) { text-align:right; }
        .total-final { text-align:right; font-size:16px; font-weight:800; color:#001d35; margin-top:16px; padding-top:12px; border-top:2px solid #001d35; }
        .footer { margin-top:40px; padding-top:16px; border-top:1px solid #e5e7eb; font-size:11px; color:#9ca3af; text-align:center; }
        @media print { body { padding:20px; } }
    </style></head><body>
    <div class="header">
        <div>
            <div class="company-name">${company.name || 'Mon Entreprise'}</div>
            <div class="company-info">
                ${company.address ? company.address + '<br/>' : ''}
                ${company.phone ? 'Tél : ' + company.phone + '<br/>' : ''}
                ${company.nif ? 'NIF : ' + company.nif : ''}
            </div>
        </div>
        <div class="bc-meta">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#9ca3af;letter-spacing:1px;margin-bottom:4px;">Bon de Commande</div>
            <div class="bc-num">${order.orderNumber}</div>
            <div style="color:#6b7280;font-size:12px;margin-top:6px;">Date : ${format(new Date(order.date), 'dd MMMM yyyy', { locale: fr })}</div>
            <div style="color:#6b7280;font-size:12px;">Statut : ${cfg.label}</div>
        </div>
    </div>

    <div style="margin-bottom:24px;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;margin-bottom:8px;">Fournisseur</div>
        <div style="background:#f9fafb;border:1px solid #e5e7eb;padding:12px 16px;border-radius:4px;">
            <div style="font-size:15px;font-weight:700;color:#001d35;">${order.supplier || '—'}</div>
        </div>
    </div>

    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;margin-bottom:8px;">Articles commandés</div>
    <table>
        <thead><tr>
            <th>Désignation</th>
            <th style="text-align:center;">Qté commandée</th>
            <th style="text-align:center;">Qté reçue</th>
            <th style="text-align:right;">P.U. Achat</th>
            <th style="text-align:right;">Total</th>
        </tr></thead>
        <tbody>${itemsHtml}</tbody>
    </table>

    <div class="total-final">
        Total : <span style="color:#f77500;">${formatRowPrice(order.totalAmount)} F CFA</span>
    </div>

    <div class="footer">Document généré par ${company.name || 'Mon Entreprise'} — ${format(new Date(), 'dd/MM/yyyy', { locale: fr })}</div>
    </body></html>`);
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); }, 400);
};

// ─── Main PurchaseOrders Page ────────────────────────────────────────────────
const PurchaseOrders = () => {
    const { orders, deleteOrder, forceCompleteOrder, suppliers, replenishmentQueue, generateOrdersFromQueue } = usePurchase();
    const { company } = useSettings();

    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('Tous');
    const [selectedOrder, setSelectedOrder] = useState(null);

    useEffect(() => {
        const t = setTimeout(() => setIsLoading(false), 1500);
        return () => clearTimeout(t);
    }, []);

    const filtered = orders.filter(o => {
        const q = search.toLowerCase();
        const matchSearch = !q || o.orderNumber?.toLowerCase().includes(q) || (o.supplier || '').toLowerCase().includes(q);
        const matchStatus = filterStatus === 'Tous' || o.status === filterStatus;
        return matchSearch && matchStatus;
    });

    const stats = {
        total: orders.length,
        pending: orders.filter(o => o.status === 'Ordered').length,
        partial: orders.filter(o => o.status === 'Partial').length,
        completed: orders.filter(o => o.status === 'Completed').length,
        totalValue: orders.filter(o => o.status !== 'Completed').reduce((s, o) => s + (o.totalAmount || 0), 0),
    };

    const handleGenerateFromQueue = () => {
        if (replenishmentQueue.length === 0) {
            T.warning('La file de réapprovisionnement est vide.');
            return;
        }
        const created = generateOrdersFromQueue();
        T.success(`${created.length} bon(s) de commande généré(s) depuis la file de réapprovisionnement !`);
    };

    if (isLoading) {
        return (
            <div className="min-h-[calc(100vh-140px)] flex items-center justify-center w-full animate-in fade-in duration-150">
                <div className="flex items-center justify-center bg-white p-8 rounded-sm shadow-xl border-2 border-gray-200">
                    <div className="relative h-12 w-12">
                        <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-t-transparent border-[#001d35]" />
                        <div className="absolute inset-1.5 animate-spin-reverse rounded-full border-2 border-b-transparent border-[#f77500] opacity-80" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* ── KPI Cards ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: 'Total Commandes', value: stats.total, sub: 'Toutes périodes', color: 'text-[#001d35]', img: '/icons8/fluency_240_tags.png' },
                    { label: 'En cours', value: stats.pending + stats.partial, sub: formatPrice(stats.totalValue) + ' en attente', color: 'text-blue-600', img: '/icons8/fluency_240_shopping-cart.png' },
                    { label: 'Réceptionnées', value: stats.completed, sub: 'Stock mis à jour', color: 'text-emerald-600', img: '/icons8/fluency_240_banknotes.png' },
                    { label: 'File Réappro.', value: replenishmentQueue.length, sub: 'Articles à commander', color: 'text-[#f77500]', img: '/icons8/fluency_240_high-priority.png' },
                ].map(card => (
                    <div key={card.label} className="bg-white p-4 rounded-sm border-2 border-gray-300 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                        <p className="text-[11px] font-bold text-blue-600/70 uppercase tracking-widest">{card.label}</p>
                        <h3 className={`text-2xl font-semibold mt-1 ${card.color}`}>{card.value}</h3>
                        <p className="text-xs text-gray-400 mt-1">{card.sub}</p>
                        <img src={card.img} alt="" className="absolute bottom-2 right-2 w-14 h-14 opacity-20 group-hover:opacity-40 transition-opacity pointer-events-none" />
                    </div>
                ))}
            </div>

            {/* ── Queue CTA ── */}
            {replenishmentQueue.length > 0 && (
                <div className="bg-amber-50 border-2 border-amber-300 rounded-sm p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-bold text-amber-900">
                                {replenishmentQueue.length} article(s) en attente dans la file de réapprovisionnement
                            </p>
                            <p className="text-xs text-amber-700 mt-0.5">
                                Vous pouvez les convertir en bon(s) de commande automatiquement.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleGenerateFromQueue}
                        className="flex items-center gap-2 px-4 py-2 bg-[#f77500] hover:bg-[#e06900] text-white rounded-sm text-xs font-bold transition-colors cursor-pointer shadow-sm whitespace-nowrap shrink-0"
                    >
                        <ArrowDownToLine className="w-3.5 h-3.5" />
                        Générer les bons de commande
                    </button>
                </div>
            )}

            {/* ── List ── */}
            <div className="bg-white border-2 border-gray-300 rounded-sm shadow-sm">
                <div className="p-3 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h3 className="text-[11px] font-bold uppercase tracking-widest text-blue-600/70">Bons de Commande Fournisseurs</h3>
                        <p className="text-xs text-gray-400 mt-0.5">{filtered.length} commande(s)</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative">
                            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                                placeholder="Numéro ou fournisseur..."
                                className="pl-8 pr-3 py-1.5 border border-gray-300 rounded-sm text-xs bg-gray-50 focus:outline-none focus:border-[#001d35] w-48"
                            />
                        </div>
                        {['Tous', 'Ordered', 'Partial', 'Completed'].map(s => {
                            const label = s === 'Tous' ? 'Tous' : STATUS_CONFIG[s]?.label || s;
                            return (
                                <button key={s}
                                    onClick={() => setFilterStatus(s)}
                                    className={`px-2.5 py-1.5 rounded-sm text-xs font-bold border transition-all cursor-pointer ${filterStatus === s ? 'bg-[#001d35] text-white border-[#001d35]' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    {filtered.length === 0 ? (
                        <div className="py-16 text-center">
                            <Package className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                            <p className="text-sm font-semibold text-gray-400">Aucun bon de commande</p>
                            <p className="text-xs text-gray-300 mt-1">
                                Ajoutez des articles à la file de réapprovisionnement, puis convertissez-les en bons de commande.
                            </p>
                        </div>
                    ) : (
                        <table className="w-full text-xs">
                            <thead style={{ backgroundColor: '#001d35' }}>
                                <tr>
                                    {['Numéro', 'Fournisseur', 'Date', 'Articles', 'Montant Total', 'Progression', 'Statut', 'Actions'].map(h => (
                                        <th key={h} className="px-3 py-2.5 text-left text-white font-bold uppercase tracking-wider text-[10px] whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filtered.map((order, idx) => {
                                    const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG['Ordered'];
                                    const completedItems = order.items.filter(i => i.quantityReceived >= i.quantityOrdered).length;
                                    const pct = order.items.length > 0 ? Math.round((completedItems / order.items.length) * 100) : 0;
                                    return (
                                        <tr key={order.id}
                                            className={`hover:bg-blue-50/30 transition-colors cursor-pointer ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}
                                            onClick={() => setSelectedOrder(order)}
                                        >
                                            <td className="px-3 py-2.5 font-mono font-bold text-[#001d35] text-[11px]">{order.orderNumber}</td>
                                            <td className="px-3 py-2.5 font-semibold text-[#001d35]">{order.supplier}</td>
                                            <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{format(new Date(order.date), 'dd/MM/yyyy', { locale: fr })}</td>
                                            <td className="px-3 py-2.5 text-gray-600">{order.items.length} art.</td>
                                            <td className="px-3 py-2.5 font-bold text-[#001d35] tabular-nums whitespace-nowrap">{formatPrice(order.totalAmount)}</td>
                                            <td className="px-3 py-2.5 min-w-[100px]">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                                                    </div>
                                                    <span className="text-[10px] font-bold text-gray-500 w-7 text-right">{pct}%</span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${cfg.color}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                                    {cfg.label}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                                    <button onClick={() => setSelectedOrder(order)}
                                                        className="p-1.5 text-[#001d35] hover:bg-blue-50 rounded-sm cursor-pointer" title="Voir">
                                                        <Eye className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button onClick={() => printPurchaseOrder(order, company)}
                                                        className="p-1.5 text-[#001d35] hover:bg-blue-50 rounded-sm cursor-pointer" title="Imprimer">
                                                        <Printer className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {selectedOrder && (
                <ReplenishmentOrderDetailModal
                    order={selectedOrder}
                    returnLabel="Retour aux Bons de Commande"
                    onClose={() => setSelectedOrder(null)}
                />
            )}
        </div>
    );
};

export default PurchaseOrders;
