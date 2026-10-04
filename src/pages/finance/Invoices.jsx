import React, { useState, useEffect } from 'react';
import { useInvoices } from '../../context/InvoiceContext';
import { useSales } from '../../context/SalesContext';
import { useSettings } from '../../context/SettingsContext';
import {
    FileText, Plus, Search, X, Printer, Download, Eye, Trash2,
    CheckCircle2, Clock, Send, XCircle, ChevronDown, Filter,
    Building2, Phone, MapPin, Calendar, CreditCard, Package,
    ArrowLeft, Edit3, FileCheck
} from 'lucide-react';
import { formatPrice, formatRowPrice } from '../../utils/currency';
import T from '../../utils/toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// ─── Status config ──────────────────────────────────────────────────────────
const STATUS_CONFIG = {
    'Brouillon': { label: 'Brouillon', color: 'bg-gray-100 text-gray-600 border-gray-200', dot: 'bg-gray-400', icon: Edit3 },
    'Envoyée':   { label: 'Envoyée',   color: 'bg-blue-50 text-blue-700 border-blue-200',  dot: 'bg-blue-500', icon: Send },
    'Payée':     { label: 'Payée',     color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', icon: CheckCircle2 },
    'Annulée':   { label: 'Annulée',   color: 'bg-red-50 text-red-600 border-red-200',     dot: 'bg-red-400',  icon: XCircle },
};

const PAYMENT_METHODS = ['Espèces', 'Mobile Money', 'Chèque', 'Virement', 'Carte bancaire', 'Crédit'];

// ─── PDF Print helper ────────────────────────────────────────────────────────
const printInvoice = (invoice, company) => {
    const win = window.open('', '_blank', 'width=900,height=700');
    const itemsHtml = invoice.items.map((item, i) => `
        <tr style="background:${i % 2 === 0 ? '#f9fafb' : '#fff'};">
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${item.name}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${item.quantity}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatRowPrice(item.unitPrice)} F CFA</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">${formatRowPrice(item.total)} F CFA</td>
        </tr>
    `).join('');

    const statusColors = { 'Payée': '#10b981', 'Envoyée': '#3b82f6', 'Brouillon': '#6b7280', 'Annulée': '#ef4444' };
    const sColor = statusColors[invoice.status] || '#6b7280';

    win.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/>
    <title>Facture ${invoice.invoiceNumber}</title>
    <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:'Segoe UI',Arial,sans-serif; color:#1f2937; background:#fff; padding:40px; font-size:13px; }
        .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:32px; padding-bottom:24px; border-bottom:3px solid #001d35; }
        .company-name { font-size:22px; font-weight:800; color:#001d35; }
        .company-info { color:#6b7280; font-size:12px; line-height:1.6; margin-top:4px; }
        .invoice-meta { text-align:right; }
        .invoice-num { font-size:26px; font-weight:900; color:#001d35; letter-spacing:1px; }
        .status-badge { display:inline-block; padding:4px 12px; border-radius:20px; font-size:11px; font-weight:700; margin-top:6px; background:${sColor}20; color:${sColor}; border:1px solid ${sColor}60; }
        .section { margin-bottom:24px; }
        .section-title { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#9ca3af; margin-bottom:8px; }
        .client-box { background:#f9fafb; border:1px solid #e5e7eb; padding:12px 16px; border-radius:4px; }
        .client-name { font-size:15px; font-weight:700; color:#001d35; }
        .client-info { font-size:12px; color:#6b7280; margin-top:2px; }
        table { width:100%; border-collapse:collapse; margin-top:8px; }
        thead tr { background:#001d35; color:#fff; }
        thead th { padding:10px 12px; text-align:left; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; }
        thead th:nth-child(2) { text-align:center; }
        thead th:nth-child(3), thead th:nth-child(4) { text-align:right; }
        .totals { margin-top:16px; display:flex; justify-content:flex-end; }
        .totals-box { min-width:260px; }
        .total-row { display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #f3f4f6; font-size:13px; color:#6b7280; }
        .total-final { display:flex; justify-content:space-between; padding:10px 0 0; font-size:16px; font-weight:800; color:#001d35; }
        .footer { margin-top:40px; padding-top:16px; border-top:1px solid #e5e7eb; font-size:11px; color:#9ca3af; text-align:center; }
        .accent { color:#f77500; }
        @media print { body { padding:20px; } }
    </style></head><body>
    <div class="header">
        <div>
            <div class="company-name">${company.name || 'Mon Entreprise'}</div>
            <div class="company-info">
                ${company.address ? company.address + '<br/>' : ''}
                ${company.phone ? 'Tél : ' + company.phone + '<br/>' : ''}
                ${company.email ? company.email + '<br/>' : ''}
                ${company.nif ? 'NIF : ' + company.nif : ''}
            </div>
        </div>
        <div class="invoice-meta">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#9ca3af;letter-spacing:1px;margin-bottom:4px;">Facture</div>
            <div class="invoice-num">${invoice.invoiceNumber}</div>
            <div style="color:#6b7280;font-size:12px;margin-top:6px;">Émise le ${format(new Date(invoice.createdAt), 'dd MMMM yyyy', { locale: fr })}</div>
            ${invoice.dueDate ? `<div style="color:#6b7280;font-size:12px;">Échéance : ${format(new Date(invoice.dueDate), 'dd MMMM yyyy', { locale: fr })}</div>` : ''}
            <div class="status-badge">${invoice.status}</div>
        </div>
    </div>

    <div style="display:flex;gap:24px;margin-bottom:24px;">
        <div style="flex:1;">
            <div class="section-title">Facturé à</div>
            <div class="client-box">
                <div class="client-name">${invoice.client?.name || 'Client comptoir'}</div>
                ${invoice.client?.phone ? `<div class="client-info">Tél : ${invoice.client.phone}</div>` : ''}
                ${invoice.client?.address ? `<div class="client-info">${invoice.client.address}</div>` : ''}
            </div>
        </div>
        <div style="min-width:180px;">
            <div class="section-title">Règlement</div>
            <div class="client-box">
                <div class="client-name">${invoice.paymentMethod || 'Espèces'}</div>
            </div>
        </div>
    </div>

    <div class="section-title">Articles</div>
    <table>
        <thead><tr>
            <th>Désignation</th><th style="text-align:center;">Qté</th>
            <th style="text-align:right;">P.U.</th><th style="text-align:right;">Total</th>
        </tr></thead>
        <tbody>${itemsHtml}</tbody>
    </table>

    <div class="totals">
        <div class="totals-box">
            <div class="total-row"><span>Sous-total HT</span><span>${formatRowPrice(invoice.totalHT)} F CFA</span></div>
            ${invoice.tva > 0 ? `<div class="total-row"><span>TVA (${invoice.tva}%)</span><span>${formatRowPrice(invoice.totalTTC - invoice.totalHT)} F CFA</span></div>` : ''}
            <div class="total-final"><span>Total TTC</span><span class="accent">${formatRowPrice(invoice.totalTTC)} F CFA</span></div>
        </div>
    </div>

    ${invoice.notes ? `<div style="margin-top:24px;padding:12px 16px;background:#fffbf5;border:1px solid #fed7aa;border-radius:4px;font-size:12px;color:#92400e;"><strong>Note :</strong> ${invoice.notes}</div>` : ''}

    <div class="footer">${company.receiptMessage || 'Merci de votre confiance.'}</div>
    </body></html>`);
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); }, 400);
};

// ─── Invoice Detail Modal ────────────────────────────────────────────────────
const InvoiceDetailModal = ({ invoice, company, onClose, onStatusChange, onDelete }) => {
    const cfg = STATUS_CONFIG[invoice.status] || STATUS_CONFIG['Brouillon'];
    const StatusIcon = cfg.icon;
    const statuses = ['Brouillon', 'Envoyée', 'Payée', 'Annulée'];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-white rounded-sm shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col border border-gray-200 animate-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="flex items-start justify-between p-5 border-b border-gray-100">
                    <div>
                        <div className="flex items-center gap-3">
                            <FileCheck className="w-5 h-5 text-[#001d35]" />
                            <h2 className="text-base font-bold text-[#001d35] tracking-wide">{invoice.invoiceNumber}</h2>
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${cfg.color}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                {cfg.label}
                            </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1 ml-8">
                            Émise le {format(new Date(invoice.createdAt), 'dd MMMM yyyy à HH:mm', { locale: fr })}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-sm cursor-pointer transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    {/* Client + Payment */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-gray-50 border border-gray-200 rounded-sm p-4">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600/70 mb-2">Client</p>
                            <p className="font-bold text-[#001d35] text-sm">{invoice.client?.name || 'Client comptoir'}</p>
                            {invoice.client?.phone && <p className="text-xs text-gray-500 mt-1 flex items-center gap-1"><Phone className="w-3 h-3" />{invoice.client.phone}</p>}
                            {invoice.client?.address && <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1"><MapPin className="w-3 h-3" />{invoice.client.address}</p>}
                        </div>
                        <div className="bg-gray-50 border border-gray-200 rounded-sm p-4">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600/70 mb-2">Règlement</p>
                            <p className="font-bold text-[#001d35] text-sm flex items-center gap-2">
                                <CreditCard className="w-4 h-4 text-[#f77500]" />{invoice.paymentMethod}
                            </p>
                            {invoice.dueDate && (
                                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />Échéance : {format(new Date(invoice.dueDate), 'dd/MM/yyyy', { locale: fr })}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Items */}
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600/70 mb-2">Articles</p>
                        <div className="border border-gray-200 rounded-sm overflow-hidden">
                            <table className="w-full text-sm">
                                <thead style={{ backgroundColor: '#001d35' }}>
                                    <tr>
                                        <th className="px-3 py-2 text-left text-white text-xs font-bold uppercase tracking-wider">Désignation</th>
                                        <th className="px-3 py-2 text-center text-white text-xs font-bold uppercase tracking-wider w-16">Qté</th>
                                        <th className="px-3 py-2 text-right text-white text-xs font-bold uppercase tracking-wider w-28">P.U.</th>
                                        <th className="px-3 py-2 text-right text-white text-xs font-bold uppercase tracking-wider w-28">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {invoice.items.map((item, i) => (
                                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                                            <td className="px-3 py-2.5 text-[#001d35] font-medium text-xs">{item.name}</td>
                                            <td className="px-3 py-2.5 text-center text-xs text-gray-600">{item.quantity}</td>
                                            <td className="px-3 py-2.5 text-right text-xs text-gray-600">{formatRowPrice(item.unitPrice)} F</td>
                                            <td className="px-3 py-2.5 text-right text-xs font-bold text-[#001d35]">{formatRowPrice(item.total)} F</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div className="bg-gray-50 border-t border-gray-200 p-3 flex justify-end">
                                <div className="text-right space-y-1">
                                    <div className="flex items-center justify-between gap-8 text-xs text-gray-500">
                                        <span>Sous-total HT</span>
                                        <span>{formatRowPrice(invoice.totalHT)} F CFA</span>
                                    </div>
                                    {invoice.tva > 0 && (
                                        <div className="flex items-center justify-between gap-8 text-xs text-gray-500">
                                            <span>TVA</span>
                                            <span>{formatRowPrice(invoice.totalTTC - invoice.totalHT)} F CFA</span>
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between gap-8 text-sm font-black text-[#001d35] pt-1 border-t border-gray-300">
                                        <span>TOTAL TTC</span>
                                        <span className="text-[#f77500]">{formatPrice(invoice.totalTTC)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {invoice.notes && (
                        <div className="bg-amber-50 border border-amber-200 rounded-sm p-3 text-xs text-amber-800">
                            <strong>Note :</strong> {invoice.notes}
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-gray-100 bg-gray-50 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                        {statuses.filter(s => s !== invoice.status).map(s => {
                            const c = STATUS_CONFIG[s];
                            const Icon = c.icon;
                            return (
                                <button
                                    key={s}
                                    onClick={() => { onStatusChange(invoice.id, s); T.success(`Statut mis à jour : ${s}`); }}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 border border-gray-300 bg-white hover:bg-gray-50 rounded-sm text-xs font-bold text-gray-600 transition-colors cursor-pointer"
                                >
                                    <Icon className="w-3 h-3" />
                                    {s}
                                </button>
                            );
                        })}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => { onDelete(invoice.id); onClose(); T.success('Facture supprimée'); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 rounded-sm text-xs font-bold transition-colors cursor-pointer"
                        >
                            <Trash2 className="w-3.5 h-3.5" />Supprimer
                        </button>
                        <button
                            onClick={() => printInvoice(invoice, company)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#001d35] hover:bg-[#00284a] text-white rounded-sm text-xs font-bold transition-colors cursor-pointer shadow-sm"
                        >
                            <Printer className="w-3.5 h-3.5" />Imprimer / PDF
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── New Invoice Modal ───────────────────────────────────────────────────────
const NewInvoiceModal = ({ onClose, onSave, transactions, clients }) => {
    const [step, setStep] = useState('source'); // source | form
    const [sourceMode, setSourceMode] = useState(null); // 'transaction' | 'manual'
    const [selectedTx, setSelectedTx] = useState(null);
    const [txSearch, setTxSearch] = useState('');
    const [form, setForm] = useState({
        clientName: '', clientPhone: '', clientAddress: '',
        paymentMethod: 'Espèces', notes: '', dueDate: '', tva: 0,
        items: [{ name: '', quantity: 1, unitPrice: 0 }],
    });

    const filteredTx = transactions.slice(0, 50).filter(tx => {
        const q = txSearch.toLowerCase();
        return !q || tx.id?.toString().includes(q) || (tx.cashierName || '').toLowerCase().includes(q) ||
               (tx.items || []).some(i => (i.name || '').toLowerCase().includes(q));
    });

    const handleFromTransaction = () => {
        if (!selectedTx) return;
        setForm(prev => ({
            ...prev,
            clientName: selectedTx.customerName || '',
            paymentMethod: selectedTx.paymentMethod || 'Espèces',
            items: (selectedTx.items || []).map(i => ({
                name: i.name || i.label || 'Article',
                quantity: i.inputQuantity || i.quantity || 1,
                unitPrice: i.price || 0,
            }))
        }));
        setStep('form');
    };

    const totalHT = form.items.reduce((s, i) => s + ((parseFloat(i.unitPrice) || 0) * (parseFloat(i.quantity) || 0)), 0);
    const totalTTC = totalHT * (1 + (parseFloat(form.tva) || 0) / 100);

    const addItem = () => setForm(prev => ({ ...prev, items: [...prev.items, { name: '', quantity: 1, unitPrice: 0 }] }));
    const removeItem = (idx) => setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
    const updateItem = (idx, field, val) => setForm(prev => ({
        ...prev,
        items: prev.items.map((it, i) => i === idx ? { ...it, [field]: val } : it)
    }));

    const handleSave = () => {
        if (!form.items.some(i => i.name.trim())) { T.error('Ajoutez au moins un article.'); return; }
        onSave({
            client: { name: form.clientName || 'Client comptoir', phone: form.clientPhone, address: form.clientAddress },
            items: form.items.filter(i => i.name.trim()).map(i => ({
                ...i,
                quantity: parseFloat(i.quantity) || 1,
                unitPrice: parseFloat(i.unitPrice) || 0,
                total: (parseFloat(i.unitPrice) || 0) * (parseFloat(i.quantity) || 1),
            })),
            totalAmount: totalHT,
            totalHT,
            tva: parseFloat(form.tva) || 0,
            totalTTC,
            paymentMethod: form.paymentMethod,
            notes: form.notes,
            dueDate: form.dueDate || null,
            transactionId: selectedTx?.id || null,
        });
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-white rounded-sm shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-gray-200 animate-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between p-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        {step === 'form' && sourceMode === 'transaction' && (
                            <button onClick={() => setStep('source')} className="p-1.5 hover:bg-gray-100 rounded-sm cursor-pointer text-gray-500">
                                <ArrowLeft className="w-4 h-4" />
                            </button>
                        )}
                        <h2 className="text-sm font-bold text-[#001d35] tracking-wide uppercase">Nouvelle Facture</h2>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-sm cursor-pointer text-gray-400"><X className="w-4 h-4" /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-5">
                    {/* Step 1: Choose source */}
                    {step === 'source' && (
                        <div className="space-y-4">
                            <p className="text-xs text-gray-500 font-medium">Comment voulez-vous créer cette facture ?</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <button
                                    onClick={() => { setSourceMode('transaction'); }}
                                    className={`p-4 rounded-sm border-2 text-left transition-all cursor-pointer hover:border-[#001d35] hover:bg-blue-50/30 ${sourceMode === 'transaction' ? 'border-[#001d35] bg-blue-50/20' : 'border-gray-200'}`}
                                >
                                    <FileText className="w-5 h-5 text-[#001d35] mb-2" />
                                    <p className="font-bold text-[#001d35] text-sm">Depuis une vente</p>
                                    <p className="text-xs text-gray-500 mt-1">Importer les articles d'une vente existante</p>
                                </button>
                                <button
                                    onClick={() => { setSourceMode('manual'); setStep('form'); }}
                                    className={`p-4 rounded-sm border-2 text-left transition-all cursor-pointer hover:border-[#001d35] hover:bg-blue-50/30 ${sourceMode === 'manual' ? 'border-[#001d35] bg-blue-50/20' : 'border-gray-200'}`}
                                >
                                    <Edit3 className="w-5 h-5 text-[#f77500] mb-2" />
                                    <p className="font-bold text-[#001d35] text-sm">Facture manuelle</p>
                                    <p className="text-xs text-gray-500 mt-1">Saisir les articles manuellement</p>
                                </button>
                            </div>

                            {sourceMode === 'transaction' && (
                                <div className="space-y-3 mt-4">
                                    <div className="relative">
                                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            type="text" value={txSearch} onChange={e => setTxSearch(e.target.value)}
                                            placeholder="Rechercher une vente..."
                                            className="w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-300 rounded-sm text-xs focus:outline-none focus:border-[#001d35]"
                                        />
                                    </div>
                                    <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-sm divide-y divide-gray-100">
                                        {filteredTx.length === 0 ? (
                                            <div className="p-4 text-center text-xs text-gray-400">Aucune vente trouvée</div>
                                        ) : filteredTx.map(tx => (
                                            <button
                                                key={tx.id}
                                                onClick={() => setSelectedTx(tx)}
                                                className={`w-full text-left px-3 py-2.5 flex items-center justify-between transition-colors cursor-pointer ${selectedTx?.id === tx.id ? 'bg-[#001d35]/5 border-l-2 border-[#001d35]' : 'hover:bg-gray-50'}`}
                                            >
                                                <div>
                                                    <p className="text-xs font-bold text-[#001d35]">
                                                        {tx.customerName || 'Client comptoir'} — {(tx.items || []).length} art.
                                                    </p>
                                                    <p className="text-[10px] text-gray-400 mt-0.5">
                                                        {tx.date ? format(new Date(tx.date), 'dd/MM/yyyy HH:mm', { locale: fr }) : ''}
                                                    </p>
                                                </div>
                                                <span className="text-xs font-bold text-[#001d35]">{formatPrice(tx.total || 0)}</span>
                                            </button>
                                        ))}
                                    </div>
                                    {selectedTx && (
                                        <button
                                            onClick={handleFromTransaction}
                                            className="w-full py-2 bg-[#001d35] hover:bg-[#00284a] text-white rounded-sm text-xs font-bold transition-colors cursor-pointer"
                                        >
                                            Importer cette vente →
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 2: Form */}
                    {step === 'form' && (
                        <div className="space-y-4">
                            {/* Client */}
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600/70 mb-2">Informations client</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    <input
                                        type="text" placeholder="Nom du client *"
                                        value={form.clientName} onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))}
                                        className="px-3 py-1.5 border border-gray-300 rounded-sm text-xs focus:outline-none focus:border-[#001d35] bg-gray-50"
                                    />
                                    <input
                                        type="text" placeholder="Téléphone"
                                        value={form.clientPhone} onChange={e => setForm(f => ({ ...f, clientPhone: e.target.value }))}
                                        className="px-3 py-1.5 border border-gray-300 rounded-sm text-xs focus:outline-none focus:border-[#001d35] bg-gray-50"
                                    />
                                    <input
                                        type="text" placeholder="Adresse"
                                        value={form.clientAddress} onChange={e => setForm(f => ({ ...f, clientAddress: e.target.value }))}
                                        className="px-3 py-1.5 border border-gray-300 rounded-sm text-xs focus:outline-none focus:border-[#001d35] bg-gray-50 sm:col-span-2"
                                    />
                                </div>
                            </div>

                            {/* Payment & Due Date */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-blue-600/70 block mb-1">Mode de règlement</label>
                                    <select value={form.paymentMethod} onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))}
                                        className="w-full px-3 py-1.5 border border-gray-300 rounded-sm text-xs focus:outline-none focus:border-[#001d35] bg-gray-50">
                                        {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-blue-600/70 block mb-1">Date d'échéance</label>
                                    <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                                        className="w-full px-3 py-1.5 border border-gray-300 rounded-sm text-xs focus:outline-none focus:border-[#001d35] bg-gray-50" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-blue-600/70 block mb-1">TVA (%)</label>
                                    <input type="number" min="0" max="100" value={form.tva} onChange={e => setForm(f => ({ ...f, tva: e.target.value }))}
                                        className="w-full px-3 py-1.5 border border-gray-300 rounded-sm text-xs focus:outline-none focus:border-[#001d35] bg-gray-50" />
                                </div>
                            </div>

                            {/* Items */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600/70">Articles</p>
                                    <button onClick={addItem} className="flex items-center gap-1 text-[10px] font-bold text-[#001d35] hover:text-[#f77500] cursor-pointer">
                                        <Plus className="w-3 h-3" />Ajouter
                                    </button>
                                </div>
                                <div className="space-y-1.5">
                                    {form.items.map((item, idx) => (
                                        <div key={idx} className="flex items-center gap-1.5">
                                            <input
                                                type="text" placeholder="Désignation *"
                                                value={item.name} onChange={e => updateItem(idx, 'name', e.target.value)}
                                                className="flex-1 px-2.5 py-1.5 border border-gray-300 rounded-sm text-xs focus:outline-none focus:border-[#001d35] bg-gray-50"
                                            />
                                            <input
                                                type="number" placeholder="Qté" min="0"
                                                value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)}
                                                className="w-16 px-2 py-1.5 border border-gray-300 rounded-sm text-xs text-center focus:outline-none focus:border-[#001d35] bg-gray-50"
                                            />
                                            <input
                                                type="number" placeholder="P.U." min="0"
                                                value={item.unitPrice} onChange={e => updateItem(idx, 'unitPrice', e.target.value)}
                                                className="w-24 px-2 py-1.5 border border-gray-300 rounded-sm text-xs text-right focus:outline-none focus:border-[#001d35] bg-gray-50"
                                            />
                                            <span className="text-xs text-gray-500 w-24 text-right tabular-nums shrink-0">
                                                {formatRowPrice((parseFloat(item.unitPrice)||0)*(parseFloat(item.quantity)||0))} F
                                            </span>
                                            {form.items.length > 1 && (
                                                <button onClick={() => removeItem(idx)} className="p-1 text-gray-400 hover:text-red-500 cursor-pointer">
                                                    <X className="w-3 h-3" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-3 flex justify-end">
                                    <div className="text-right space-y-1">
                                        <div className="flex items-center gap-6 text-xs text-gray-500">
                                            <span>Sous-total HT</span>
                                            <span className="tabular-nums">{formatRowPrice(totalHT)} F CFA</span>
                                        </div>
                                        {form.tva > 0 && (
                                            <div className="flex items-center gap-6 text-xs text-gray-500">
                                                <span>TVA ({form.tva}%)</span>
                                                <span className="tabular-nums">{formatRowPrice(totalTTC - totalHT)} F CFA</span>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-6 text-sm font-black text-[#001d35] pt-1 border-t border-gray-200">
                                            <span>TOTAL TTC</span>
                                            <span className="text-[#f77500] tabular-nums">{formatPrice(totalTTC)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="text-[10px] font-bold uppercase tracking-widest text-blue-600/70 block mb-1">Note / Conditions</label>
                                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                                    rows={2} placeholder="Ex : Paiement à 30 jours, TVA non applicable..."
                                    className="w-full px-3 py-2 border border-gray-300 rounded-sm text-xs focus:outline-none focus:border-[#001d35] bg-gray-50 resize-none"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {step === 'form' && (
                    <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-2">
                        <button onClick={onClose} className="px-4 py-1.5 border border-gray-300 bg-white text-gray-600 rounded-sm text-xs font-bold hover:bg-gray-100 transition-colors cursor-pointer">
                            Annuler
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-4 py-1.5 bg-[#001d35] hover:bg-[#00284a] text-white rounded-sm text-xs font-bold transition-colors cursor-pointer shadow-sm flex items-center gap-1.5"
                        >
                            <FileCheck className="w-3.5 h-3.5" />Créer la facture
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Main Invoices Page ──────────────────────────────────────────────────────
const Invoices = () => {
    const { invoices, createInvoice, updateInvoiceStatus, deleteInvoice, invoiceStats } = useInvoices();
    const { transactions } = useSales();
    const { company } = useSettings();

    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('Tous');
    const [showNewModal, setShowNewModal] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState(null);

    useEffect(() => {
        const t = setTimeout(() => setIsLoading(false), 1500);
        return () => clearTimeout(t);
    }, []);

    const filtered = invoices.filter(inv => {
        const q = search.toLowerCase();
        const matchSearch = !q || inv.invoiceNumber.toLowerCase().includes(q) ||
            (inv.client?.name || '').toLowerCase().includes(q);
        const matchStatus = filterStatus === 'Tous' || inv.status === filterStatus;
        return matchSearch && matchStatus;
    });

    const handleCreateInvoice = (data) => {
        const inv = createInvoice(data);
        T.success(`Facture ${inv.invoiceNumber} créée !`);
        setShowNewModal(false);
        setSelectedInvoice(inv);
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
                    { label: 'Total Factures', value: invoiceStats.total, sub: 'Toutes périodes', color: 'text-[#001d35]', img: '/icons8/fluency_240_tags.png' },
                    { label: 'En attente', value: invoiceStats.sent, sub: formatPrice(invoiceStats.pendingAmount), color: 'text-blue-600', img: '/icons8/fluency_240_shopping-cart.png' },
                    { label: 'Payées', value: invoiceStats.paid, sub: formatPrice(invoiceStats.totalRevenue), color: 'text-emerald-600', img: '/icons8/fluency_240_banknotes.png' },
                    { label: 'Brouillons', value: invoiceStats.draft, sub: 'Non finalisées', color: 'text-gray-500', img: '/icons8/fluency_240_high-priority.png' },
                ].map(card => (
                    <div key={card.label} className="bg-white p-4 rounded-sm border-2 border-gray-300 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
                        <p className="text-[11px] font-bold text-blue-600/70 uppercase tracking-widest">{card.label}</p>
                        <h3 className={`text-2xl font-semibold mt-1 ${card.color}`}>{card.value}</h3>
                        <p className="text-xs text-gray-400 mt-1">{card.sub}</p>
                        <img src={card.img} alt="" className="absolute bottom-2 right-2 w-14 h-14 opacity-20 group-hover:opacity-40 transition-opacity pointer-events-none" />
                    </div>
                ))}
            </div>

            {/* ── List ── */}
            <div className="bg-white border-2 border-gray-300 rounded-sm shadow-sm">
                {/* Header */}
                <div className="p-3 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h3 className="text-[11px] font-bold uppercase tracking-widest text-blue-600/70">Facturation Officielle</h3>
                        <p className="text-xs text-gray-400 mt-0.5">{filtered.length} facture(s)</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Search */}
                        <div className="relative">
                            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                                placeholder="N° ou client..."
                                className="pl-8 pr-3 py-1.5 border border-gray-300 rounded-sm text-xs bg-gray-50 focus:outline-none focus:border-[#001d35] w-44"
                            />
                        </div>
                        {/* Status filter */}
                        {['Tous', 'Brouillon', 'Envoyée', 'Payée', 'Annulée'].map(s => (
                            <button key={s}
                                onClick={() => setFilterStatus(s)}
                                className={`px-2.5 py-1.5 rounded-sm text-xs font-bold border transition-all cursor-pointer ${filterStatus === s ? 'bg-[#001d35] text-white border-[#001d35]' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                                {s}
                            </button>
                        ))}
                        <button
                            onClick={() => setShowNewModal(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f77500] hover:bg-[#e06900] text-white rounded-sm text-xs font-bold transition-colors cursor-pointer shadow-sm"
                        >
                            <Plus className="w-3.5 h-3.5" />Nouvelle Facture
                        </button>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    {filtered.length === 0 ? (
                        <div className="py-16 text-center">
                            <FileText className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                            <p className="text-sm font-semibold text-gray-400">Aucune facture trouvée</p>
                            <p className="text-xs text-gray-300 mt-1">Créez votre première facture officielle</p>
                            <button onClick={() => setShowNewModal(true)}
                                className="mt-4 px-4 py-2 bg-[#001d35] text-white rounded-sm text-xs font-bold cursor-pointer hover:bg-[#00284a] transition-colors">
                                <Plus className="w-3.5 h-3.5 inline mr-1.5" />Créer une facture
                            </button>
                        </div>
                    ) : (
                        <table className="w-full text-xs">
                            <thead style={{ backgroundColor: '#001d35' }}>
                                <tr>
                                    {['Numéro', 'Client', 'Date', 'Échéance', 'Montant TTC', 'Règlement', 'Statut', 'Actions'].map(h => (
                                        <th key={h} className="px-3 py-2.5 text-left text-white font-bold uppercase tracking-wider text-[10px] whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filtered.map((inv, idx) => {
                                    const cfg = STATUS_CONFIG[inv.status] || STATUS_CONFIG['Brouillon'];
                                    return (
                                        <tr key={inv.id}
                                            className={`hover:bg-blue-50/30 transition-colors cursor-pointer ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}
                                            onClick={() => setSelectedInvoice(inv)}
                                        >
                                            <td className="px-3 py-2.5 font-mono font-bold text-[#001d35] text-[11px]">{inv.invoiceNumber}</td>
                                            <td className="px-3 py-2.5 font-semibold text-[#001d35]">{inv.client?.name || 'Client comptoir'}</td>
                                            <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{format(new Date(inv.createdAt), 'dd/MM/yyyy', { locale: fr })}</td>
                                            <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">
                                                {inv.dueDate ? format(new Date(inv.dueDate), 'dd/MM/yyyy', { locale: fr }) : '—'}
                                            </td>
                                            <td className="px-3 py-2.5 font-bold text-[#001d35] tabular-nums whitespace-nowrap">{formatPrice(inv.totalTTC)}</td>
                                            <td className="px-3 py-2.5 text-gray-500">{inv.paymentMethod}</td>
                                            <td className="px-3 py-2.5">
                                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${cfg.color}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                                    {cfg.label}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                                    <button onClick={() => setSelectedInvoice(inv)}
                                                        className="p-1.5 text-[#001d35] hover:bg-blue-50 rounded-sm cursor-pointer" title="Voir">
                                                        <Eye className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button onClick={() => printInvoice(inv, company)}
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

            {/* Modals */}
            {showNewModal && (
                <NewInvoiceModal
                    onClose={() => setShowNewModal(false)}
                    onSave={handleCreateInvoice}
                    transactions={transactions}
                    clients={[]}
                />
            )}
            {selectedInvoice && (
                <InvoiceDetailModal
                    invoice={selectedInvoice}
                    company={company}
                    onClose={() => setSelectedInvoice(null)}
                    onStatusChange={(id, status) => { updateInvoiceStatus(id, status); setSelectedInvoice(prev => ({ ...prev, status })); }}
                    onDelete={(id) => { deleteInvoice(id); setSelectedInvoice(null); }}
                />
            )}
        </div>
    );
};

export default Invoices;
