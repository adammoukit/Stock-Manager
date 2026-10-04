import React, { useState, useEffect, useRef } from 'react';
import { useSales } from '../../context/SalesContext';
import { formatPrice } from '../../utils/currency';
import FinancialInput from '../../components/FinancialInput';
import { 
    Search, User, Users, CreditCard, MessageCircle, AlertTriangle, X, 
    CheckCircle2, Printer, Ticket, Check, FileText, Calendar, DollarSign,
    Building2, ArrowUpRight
} from 'lucide-react';
import T from '../../utils/toast';

const DebtBook = () => {
    const { debts, addDebtPayment, creditNotes, useCreditNote } = useSales();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDebt, setSelectedDebt] = useState(null);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [debtPaymentMethod, setDebtPaymentMethod] = useState('cash'); // 'cash' | 'avoir' | 'wave_om' | 'check' | 'bank'
    const [debtPaymentNote, setDebtPaymentNote] = useState('');
    const [receiptInfo, setReceiptInfo] = useState(null);
    const [activeTab, setActiveTab] = useState('customers'); // 'customers' | 'invoices'

    // ── Loader d'entrée de page (scroll top + 1,5s) identique à Réapprovisionnement Intelligent ──
    const [isPageLoading, setIsPageLoading] = useState(true);
    const pageLoadTimerRef = useRef(null);

    // ── Loader de validation d'au moins 1,5s identique à Réapprovisionnement Intelligent ──
    const [actionLoading, setActionLoading] = useState(null);

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
        pageLoadTimerRef.current = setTimeout(() => {
            setIsPageLoading(false);
        }, 1500);
        return () => {
            if (pageLoadTimerRef.current) clearTimeout(pageLoadTimerRef.current);
        };
    }, []);

    const triggerActionLoading = (message, callback) => {
        setActionLoading(message);
        setTimeout(() => {
            callback();
            setActionLoading(null);
        }, 1500);
    };

    const activeDebts = debts.filter(d => d.status === 'pending');

    // Group debts by customer
    const groupedDebts = activeDebts.reduce((acc, debt) => {
        if (!acc[debt.customerName]) {
            acc[debt.customerName] = {
                customerName: debt.customerName,
                clientId: debt.clientId,
                debts: [],
                totalAmount: 0,
                paidAmount: 0,
                remaining: 0
            };
        }
        acc[debt.customerName].debts.push(debt);
        acc[debt.customerName].totalAmount += (debt.totalAmount || 0);
        acc[debt.customerName].paidAmount += (debt.paidAmount || 0);
        acc[debt.customerName].remaining += Math.max(0, (debt.totalAmount || 0) - (debt.paidAmount || 0));
        return acc;
    }, {});

    const customers = Object.values(groupedDebts).filter(c =>
        c.customerName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Total metrics
    const totalRemainingAll = activeDebts.reduce((sum, d) => sum + Math.max(0, (d.totalAmount || 0) - (d.paidAmount || 0)), 0);
    const totalPaidAll = activeDebts.reduce((sum, d) => sum + (d.paidAmount || 0), 0);
    const totalAmountAll = activeDebts.reduce((sum, d) => sum + (d.totalAmount || 0), 0);

    // Filtered invoices for tab 2
    const filteredInvoices = activeDebts.filter(d =>
        (d.customerName && d.customerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (d.siteName && d.siteName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (d.id && String(d.id).includes(searchTerm))
    );

    // Active customer avoirs/advances
    const selectedCustomerAvoirs = selectedDebt ? (creditNotes || []).filter(cn =>
        (cn.status === 'active' || cn.status === 'partial') &&
        cn.remainingAmount > 0 &&
        ((cn.customerName && selectedDebt?.customerName && cn.customerName.toLowerCase().trim() === selectedDebt.customerName.toLowerCase().trim()) ||
         (cn.clientId && selectedDebt?.clientId && String(cn.clientId) === String(selectedDebt.clientId)))
    ) : [];
    const totalSelectedCustomerAvoir = selectedCustomerAvoirs.reduce((sum, cn) => sum + (cn.remainingAmount || 0), 0);

    const handlePayment = (e) => {
        if (e && e.preventDefault) e.preventDefault();
        const amount = parseFloat(paymentAmount);
        if (!amount || amount <= 0 || !selectedDebt) {
            T.warning("Veuillez saisir un montant de versement valide.");
            return;
        }

        const maxPayable = selectedDebt.remaining !== undefined 
            ? selectedDebt.remaining 
            : Math.max(0, (selectedDebt.totalAmount || 0) - (selectedDebt.paidAmount || 0));

        if (amount > maxPayable) {
            T.warning(`Le montant dépasse le reste dû de ${formatPrice(maxPayable)}.`);
            return;
        }

        if (debtPaymentMethod === 'avoir') {
            if (totalSelectedCustomerAvoir <= 0) {
                T.error("Ce client ne possède aucune avance ou bon d'avoir disponible.");
                return;
            }
            if (amount > totalSelectedCustomerAvoir) {
                T.warning(`Le montant (${formatPrice(amount)}) dépasse l'avance disponible (${formatPrice(totalSelectedCustomerAvoir)}).`);
                return;
            }
            // Déduire progressivement sur les avoirs
            let remToDeduct = amount;
            for (const cn of selectedCustomerAvoirs) {
                if (remToDeduct <= 0) break;
                const deduct = Math.min(cn.remainingAmount, remToDeduct);
                useCreditNote(cn.code, deduct);
                remToDeduct -= deduct;
            }
        }

        triggerActionLoading("Enregistrement du règlement...", () => {
            let remainingPayment = amount;
            
            // Check if paying a specific invoice or customer global
            if (selectedDebt.debts && selectedDebt.debts.length > 0) {
                // Customer global: pay down oldest debts first
                selectedDebt.debts.sort((a, b) => new Date(a.date) - new Date(b.date)).forEach(debt => {
                    if (remainingPayment <= 0) return;
                    const debtRemaining = Math.max(0, (debt.totalAmount || 0) - (debt.paidAmount || 0));
                    if (debtRemaining > 0) {
                        const pay = Math.min(debtRemaining, remainingPayment);
                        addDebtPayment(debt.id, pay, debtPaymentMethod, debtPaymentNote);
                        remainingPayment -= pay;
                    }
                });
            } else if (selectedDebt.id) {
                // Specific invoice
                addDebtPayment(selectedDebt.id, amount, debtPaymentMethod, debtPaymentNote);
            }

            const newRemaining = Math.max(0, maxPayable - amount);

            setReceiptInfo({
                customerName: selectedDebt.customerName,
                amount,
                method: debtPaymentMethod,
                note: debtPaymentNote,
                date: new Date().toISOString(),
                remaining: newRemaining,
                targetName: selectedDebt.debts ? 'Règlement Global Compte Débiteur' : `Facture #${selectedDebt.id}`
            });

            T.success(debtPaymentMethod === 'avoir'
                ? `Avance de ${formatPrice(amount)} imputée avec succès sur le compte client !`
                : `Règlement de ${formatPrice(amount)} encaissé avec succès !`
            );

            setSelectedDebt(null);
            setPaymentAmount('');
            setDebtPaymentNote('');
            setDebtPaymentMethod('cash');
        });
    };

    const handleWhatsApp = (customer) => {
        const text = `Bonjour ${customer.customerName},\n\nSauf erreur de notre part, votre solde débiteur s'élève à *${formatPrice(customer.remaining)}*.\n\nMerci de bien vouloir régulariser votre situation dans les meilleurs délais.\n\nCordialement,\nLa Quincaillerie.`;
        const encoded = encodeURIComponent(text);
        window.open(`https://wa.me/?text=${encoded}`, '_blank');
    };

    return (
        <div className="space-y-3 font-sans pb-10">

            {/* ── EN-TÊTE PRINCIPAL OFFICIEL KABLLIX ERP (IDENTIQUE RÉAPPROVISIONNEMENT) ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-[4px] border-2 border-gray-300 shadow-sm">
                <div>
                    <h1 className="text-base sm:text-lg font-bold text-[#001d35] tracking-tight flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-[#001d35]" />
                        <span>Carnet de Crédit & Règlements Débiteurs</span>
                    </h1>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2.5 py-1 rounded-[4px] border border-gray-300">
                        <strong>{customers.length}</strong> client(s) débiteur(s)
                    </span>
                    <span className="text-xs font-semibold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-[4px] border border-rose-200">
                        Total Dû : <strong>{formatPrice(totalRemainingAll)}</strong>
                    </span>
                </div>
            </div>

            {/* ── CONTENEUR PRINCIPAL UNIFIÉ (ONGLETS + CONTENUS DANS LE MÊME ARRIÈRE-PLAN) ── */}
            <div className="bg-white rounded-[4px] border-2 border-gray-300 shadow-sm overflow-hidden">
                {/* ── BARRE D'ONGLETS PRINCIPAUX INTÉGRÉE EN HAUT ── */}
                <div className="p-2 sm:p-2.5 bg-white border-b-2 border-gray-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
                    <div className="flex items-center gap-1 bg-gray-100/80 p-1 rounded-[4px] border-2 border-gray-300 flex-wrap" aria-label="Onglets du carnet de crédit">
                        {/* Onglet 1 : Synthèse par Client Débiteur */}
                        <button
                            type="button"
                            onClick={() => setActiveTab('customers')}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-[4px] transition-all cursor-pointer flex items-center gap-2 ${
                                activeTab === 'customers'
                                    ? 'bg-[#001d35] text-white shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                            }`}
                        >
                            <Users className={`w-3.5 h-3.5 ${
                                activeTab === 'customers' ? 'text-[#f77500]' : 'text-gray-500'
                            }`} />
                            <span>Synthèse par Client Débiteur</span>

                            {customers.length > 0 && (
                                <span className="min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold bg-rose-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                                    {customers.length}
                                </span>
                            )}
                        </button>

                        {/* Barre verticale de séparation */}
                        <div className="h-5 w-px bg-gray-300 mx-1 shrink-0" aria-hidden="true"></div>

                        {/* Onglet 2 : Registre Détaillé des Factures */}
                        <button
                            type="button"
                            onClick={() => setActiveTab('invoices')}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-[4px] transition-all cursor-pointer flex items-center gap-2 ${
                                activeTab === 'invoices'
                                    ? 'bg-[#001d35] text-white shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                            }`}
                        >
                            <FileText className={`w-3.5 h-3.5 ${
                                activeTab === 'invoices' ? 'text-[#f77500]' : 'text-gray-500'
                            }`} />
                            <span>Registre Détaillé des Factures Impayées</span>

                            {activeDebts.length > 0 && (
                                <span className="min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold bg-[#001d35] text-white flex items-center justify-center flex-shrink-0 shadow-xs border border-white/30">
                                    {activeDebts.length}
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                {/* ── CORPS DU CONTENEUR : CONTENU DE L'ONGLET ACTIF (MÊME ARRIÈRE-PLAN BLANC) ── */}
                <div className="p-3 space-y-3 bg-white">
                    {/* ── BARRE COMPACTE : Recherche + Métriques KPI inline (Identique à Réapprovisionnement Intelligent) ── */}
                    <div className="bg-slate-50/70 p-2.5 rounded-[4px] border-2 border-gray-300 shadow-2xs">
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                            {/* Champ de recherche */}
                            <div className="relative w-56 shrink-0">
                                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    placeholder="Rechercher client, chantier..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-[4px] focus:outline-none focus:ring-1 focus:ring-[#001d35] bg-white font-normal"
                                />
                            </div>

                            {/* Séparateur vertical */}
                            <div className="hidden sm:block h-6 w-px bg-gray-300 shrink-0" />

                            {/* Métriques KPI inline compactes */}
                            <div className="flex flex-wrap items-center gap-3 flex-1">
                                {/* Total Créances Dues */}
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Créances Dues :</span>
                                    <span className="text-xs font-bold px-2 py-0.5 rounded-[3px] border bg-rose-50 text-rose-700 border-rose-200">
                                        {formatPrice(totalRemainingAll)}
                                    </span>
                                </div>

                                <div className="h-4 w-px bg-gray-200 shrink-0 hidden sm:block" />

                                {/* Total Déjà Payé */}
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Déjà Encaissé :</span>
                                    <span className="text-xs font-bold px-2 py-0.5 rounded-[3px] border bg-emerald-50 text-emerald-700 border-emerald-200">
                                        {formatPrice(totalPaidAll)}
                                    </span>
                                </div>

                                <div className="h-4 w-px bg-gray-200 shrink-0 hidden sm:block" />

                                {/* Total Volume */}
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Volume Global Crédit :</span>
                                    <span className="text-xs font-bold px-2 py-0.5 rounded-[3px] border bg-[#001d35]/5 text-[#001d35] border-[#001d35]/20">
                                        {formatPrice(totalAmountAll)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ========================================================================= */}
                    {/* ONGLET 1 : SYNTHÈSE CLIENTS DÉBITEURS                                    */}
                    {/* ========================================================================= */}
                    {activeTab === 'customers' && (
                        <div className="border border-gray-200 rounded-[4px] overflow-hidden">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead className="bg-[#001d35] text-white font-semibold uppercase tracking-wider text-[10px] divide-x divide-white/20">
                                    <tr>
                                        <th className="px-3 py-2">Client Débiteur</th>
                                        <th className="px-3 py-2 text-center">Factures Dues</th>
                                        <th className="px-3 py-2 text-right">Volume Crédit</th>
                                        <th className="px-3 py-2 text-right">Déjà Versé</th>
                                        <th className="px-3 py-2 text-right">Reste à Payer</th>
                                        <th className="px-3 py-2 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {customers.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" className="px-4 py-8 text-center text-gray-500 font-semibold">
                                                Aucun client débiteur enregistré ou correspondant aux critères.
                                            </td>
                                        </tr>
                                    ) : (
                                        customers.map((c) => (
                                            <tr key={c.customerName} className="hover:bg-blue-50/40 transition-colors">
                                                <td className="px-3 py-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-[3px] bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
                                                            <User className="w-3.5 h-3.5 text-blue-700" />
                                                        </div>
                                                        <span className="font-bold text-[#001d35] text-xs uppercase tracking-tight">{c.customerName}</span>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    <span className="bg-gray-100 text-gray-700 font-semibold px-2 py-0.5 rounded-[3px] border border-gray-300 text-[10px]">
                                                        {c.debts.length} facture(s)
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2 text-right font-semibold text-gray-800">
                                                    {formatPrice(c.totalAmount)}
                                                </td>
                                                <td className="px-3 py-2 text-right font-semibold text-emerald-700">
                                                    {formatPrice(c.paidAmount)}
                                                </td>
                                                <td className="px-3 py-2 text-right">
                                                    <span className="font-bold text-rose-600">
                                                        {formatPrice(c.remaining)}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleWhatsApp(c)}
                                                            className="p-1.5 text-green-700 bg-green-50 border border-green-200 hover:bg-green-100 rounded-[4px] transition-all shadow-2xs active:scale-95 cursor-pointer"
                                                            title="Relancer par WhatsApp"
                                                        >
                                                            <img src="/icons8/fluency_48_whatsapp.png" alt="WhatsApp" className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setSelectedDebt(c);
                                                                setPaymentAmount(c.remaining.toString());
                                                                setDebtPaymentMethod('cash');
                                                                setDebtPaymentNote('');
                                                            }}
                                                            className="px-2.5 py-1 text-white bg-[#001d35] hover:bg-[#00284a] rounded-[4px] font-semibold text-[10px] tracking-wider uppercase transition-all cursor-pointer flex items-center gap-1 shadow-xs active:scale-95"
                                                        >
                                                            <CreditCard className="w-3 h-3 text-[#f77500]" />
                                                            <span>Encaisser</span>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* ========================================================================= */}
                    {/* ONGLET 2 : REGISTRE DÉTAILLÉ DES FACTURES IMPAYÉES                        */}
                    {/* ========================================================================= */}
                    {activeTab === 'invoices' && (
                        <div className="border border-gray-200 rounded-[4px] overflow-hidden">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead className="bg-[#001d35] text-white font-semibold uppercase tracking-wider text-[10px] divide-x divide-white/20">
                                    <tr>
                                        <th className="px-3 py-2">Date</th>
                                        <th className="px-3 py-2">Réf Facture</th>
                                        <th className="px-3 py-2">Client Débiteur</th>
                                        <th className="px-3 py-2">Chantier</th>
                                        <th className="px-3 py-2 text-right">Total Facture</th>
                                        <th className="px-3 py-2 text-right">Déjà Versé</th>
                                        <th className="px-3 py-2 text-right">Reste Dû</th>
                                        <th className="px-3 py-2 text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredInvoices.length === 0 ? (
                                        <tr>
                                            <td colSpan="8" className="px-4 py-8 text-center text-gray-500 font-semibold">
                                                Aucune facture impayée trouvée.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredInvoices.map((debt) => {
                                            const remaining = Math.max(0, (debt.totalAmount || 0) - (debt.paidAmount || 0));
                                            return (
                                                <tr key={debt.id} className="hover:bg-blue-50/40 transition-colors">
                                                    <td className="px-3 py-2 font-medium text-gray-600">
                                                        {new Date(debt.date).toLocaleDateString('fr-FR')}
                                                    </td>
                                                    <td className="px-3 py-2 font-semibold text-[#001d35]">
                                                        #{debt.id}
                                                    </td>
                                                    <td className="px-3 py-2 font-bold text-gray-900">
                                                        {debt.customerName}
                                                    </td>
                                                    <td className="px-3 py-2 font-medium text-gray-700">
                                                        🏗️ {debt.siteName || 'Comptoir / Général'}
                                                    </td>
                                                    <td className="px-3 py-2 text-right font-semibold text-gray-800">
                                                        {formatPrice(debt.totalAmount)}
                                                    </td>
                                                    <td className="px-3 py-2 text-right text-emerald-700 font-semibold">
                                                        {formatPrice(debt.paidAmount)}
                                                    </td>
                                                    <td className="px-3 py-2 text-right font-semibold text-rose-600">
                                                        {formatPrice(remaining)}
                                                    </td>
                                                    <td className="px-3 py-2 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setSelectedDebt(debt);
                                                                setPaymentAmount(remaining.toString());
                                                                setDebtPaymentMethod('cash');
                                                                setDebtPaymentNote('');
                                                            }}
                                                            className="px-2.5 py-1 text-white bg-emerald-700 hover:bg-emerald-800 rounded-[4px] font-semibold text-[10px] tracking-wider uppercase transition-all cursor-pointer flex items-center gap-1 mx-auto shadow-xs active:scale-95"
                                                        >
                                                            <DollarSign className="w-3 h-3 text-[#f77500]" />
                                                            <span>Encaisser</span>
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* ── MODAL D'ENCAISSEMENT OFFICIEL KABLLIX ERP (IDENTIQUE RÉAPPROVISIONNEMENT) ── */}
            {selectedDebt && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
                    <div className="bg-white w-full max-w-lg rounded-[4px] shadow-2xl border-2 border-[#001d35] overflow-hidden transform animate-in zoom-in-95 duration-150">
                        {/* En-tête officiel */}
                        <div className="p-3.5 sm:p-4 border-b-2 border-gray-300 flex justify-between items-center bg-white flex-shrink-0">
                            <div>
                                <h3 className="text-sm sm:text-base font-bold text-[#001d35] uppercase tracking-wide">
                                    Encaisser un Remboursement
                                </h3>
                                <p className="text-gray-500 text-xs mt-0.5 font-normal">
                                    Règlement d'impayé et apurement de créance client
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedDebt(null)}
                                className="text-gray-400 hover:text-gray-600 p-1 rounded-[4px] hover:bg-gray-100 transition-colors cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Corps du formulaire */}
                        <form onSubmit={handlePayment}>
                            <div className="p-4 space-y-3.5 bg-white text-xs">
                                {/* Carte récapitulative client */}
                                <div className="bg-slate-50/90 p-3 border-2 border-gray-200 rounded-[4px] space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="font-semibold text-gray-600 uppercase tracking-wide text-[11px]">Client Débiteur</span>
                                        <span className="font-bold text-[#001d35] text-xs">{selectedDebt.customerName}</span>
                                    </div>
                                    <div className="flex justify-between items-center pt-1.5 border-t border-gray-200">
                                        <span className="font-semibold text-gray-600 uppercase tracking-wide text-[11px]">Solde Dû à Solder</span>
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></div>
                                            <span className="font-bold text-rose-600 text-sm tracking-tight">
                                                {formatPrice(
                                                    selectedDebt.remaining !== undefined 
                                                        ? selectedDebt.remaining 
                                                        : Math.max(0, (selectedDebt.totalAmount || 0) - (selectedDebt.paidAmount || 0))
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                    {totalSelectedCustomerAvoir > 0 && (
                                        <div className="flex justify-between items-center pt-1.5 border-t border-emerald-200/80 bg-emerald-50/70 -mx-3 px-3 py-1.5 rounded-b-[3px]">
                                            <span className="font-bold text-emerald-800 uppercase tracking-wide text-[10px]">Avoirs / Avances Dispo</span>
                                            <span className="font-bold text-emerald-700 text-xs">{formatPrice(totalSelectedCustomerAvoir)}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Sélecteur de mode de règlement officiel */}
                                <div>
                                    <label className="block text-[11px] font-semibold text-[#001d35] uppercase tracking-wide mb-1.5">
                                        Mode de Règlement
                                    </label>
                                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => setDebtPaymentMethod('cash')}
                                            className={`py-2 px-2 rounded-[4px] font-semibold uppercase tracking-wider text-center border text-[11px] cursor-pointer transition-all ${
                                                debtPaymentMethod === 'cash'
                                                    ? 'bg-[#001d35] text-white border-[#001d35] shadow-xs'
                                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                            }`}
                                        >
                                            💵 Espèces
                                        </button>
                                        <button
                                            type="button"
                                            disabled={totalSelectedCustomerAvoir <= 0}
                                            onClick={() => {
                                                setDebtPaymentMethod('avoir');
                                                const maxP = selectedDebt.remaining !== undefined 
                                                    ? selectedDebt.remaining 
                                                    : Math.max(0, (selectedDebt.totalAmount || 0) - (selectedDebt.paidAmount || 0));
                                                setPaymentAmount(Math.min(totalSelectedCustomerAvoir, maxP).toString());
                                            }}
                                            className={`py-2 px-2 rounded-[4px] font-semibold uppercase tracking-wider text-center border text-[11px] cursor-pointer transition-all ${
                                                debtPaymentMethod === 'avoir'
                                                    ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                                                    : totalSelectedCustomerAvoir > 0
                                                    ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                                                    : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-50'
                                            }`}
                                        >
                                            <span>🎫 Avoir</span>
                                            {totalSelectedCustomerAvoir > 0 && (
                                                <span className="block text-[9px] font-bold opacity-90">
                                                    {formatPrice(totalSelectedCustomerAvoir)}
                                                </span>
                                            )}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setDebtPaymentMethod('wave_om')}
                                            className={`py-2 px-2 rounded-[4px] font-semibold uppercase tracking-wider text-center border text-[11px] cursor-pointer transition-all ${
                                                debtPaymentMethod === 'wave_om'
                                                    ? 'bg-[#001d35] text-white border-[#001d35] shadow-xs'
                                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                            }`}
                                        >
                                            📱 Mobile
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setDebtPaymentMethod('check')}
                                            className={`py-2 px-2 rounded-[4px] font-semibold uppercase tracking-wider text-center border text-[11px] cursor-pointer transition-all ${
                                                debtPaymentMethod === 'check'
                                                    ? 'bg-[#001d35] text-white border-[#001d35] shadow-xs'
                                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                            }`}
                                        >
                                            📝 Chèque
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setDebtPaymentMethod('bank')}
                                            className={`py-2 px-2 rounded-[4px] font-semibold uppercase tracking-wider text-center border text-[11px] cursor-pointer transition-all ${
                                                debtPaymentMethod === 'bank'
                                                    ? 'bg-[#001d35] text-white border-[#001d35] shadow-xs'
                                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                            }`}
                                        >
                                            🏦 Virement
                                        </button>
                                    </div>
                                </div>

                                {debtPaymentMethod === 'avoir' && (
                                    <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-[4px] text-xs text-amber-900 flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                            <Ticket className="w-4 h-4 text-amber-600 shrink-0" />
                                            <span>Imputation sur solde avoir disponible ({formatPrice(totalSelectedCustomerAvoir)})</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const maxP = selectedDebt.remaining !== undefined 
                                                    ? selectedDebt.remaining 
                                                    : Math.max(0, (selectedDebt.totalAmount || 0) - (selectedDebt.paidAmount || 0));
                                                setPaymentAmount(Math.min(totalSelectedCustomerAvoir, maxP).toString());
                                            }}
                                            className="font-bold underline text-amber-800 text-[10px] hover:text-amber-900 cursor-pointer ml-1"
                                        >
                                            Max possible
                                        </button>
                                    </div>
                                )}

                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="text-[11px] font-semibold text-[#001d35] uppercase tracking-wide">
                                            Montant du Versement (FCFA) <span className="text-rose-500">*</span>
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const maxP = selectedDebt.remaining !== undefined 
                                                    ? selectedDebt.remaining 
                                                    : Math.max(0, (selectedDebt.totalAmount || 0) - (selectedDebt.paidAmount || 0));
                                                if (debtPaymentMethod === 'avoir') {
                                                    setPaymentAmount(Math.min(totalSelectedCustomerAvoir, maxP).toString());
                                                } else {
                                                    setPaymentAmount(maxP.toString());
                                                }
                                            }}
                                            className="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer"
                                        >
                                            Tout solder (100%)
                                        </button>
                                    </div>
                                    <input
                                        type="number"
                                        autoFocus
                                        value={paymentAmount}
                                        onChange={(e) => setPaymentAmount(e.target.value)}
                                        placeholder="Ex: 50000"
                                        className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-[4px] focus:outline-none focus:ring-1 focus:ring-[#001d35] text-xs font-bold text-[#001d35]"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-semibold text-[#001d35] uppercase tracking-wide mb-1">
                                        Note ou Référence du Versement (Optionnel)
                                    </label>
                                    <input
                                        type="text"
                                        value={debtPaymentNote}
                                        onChange={(e) => setDebtPaymentNote(e.target.value)}
                                        placeholder="Ex: Reçu N° 4892 / Chèque N° 00472 / Virement UBA"
                                        className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-[4px] focus:outline-none focus:ring-1 focus:ring-[#001d35] text-xs text-gray-800"
                                    />
                                </div>
                            </div>

                            {/* Actions officielles */}
                            <div className="p-3.5 bg-slate-50 border-t-2 border-gray-200 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setSelectedDebt(null)}
                                    className="px-3.5 py-1.5 border border-gray-300 text-gray-700 font-semibold uppercase tracking-wider text-xs hover:bg-gray-100 rounded-[4px] cursor-pointer transition-colors"
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    className="flex items-center gap-1.5 px-4 py-1.5 bg-[#001d35] hover:bg-[#00284a] text-white font-semibold uppercase tracking-wider text-xs rounded-[4px] cursor-pointer transition-colors shadow-sm active:scale-95"
                                >
                                    <Check className="w-3.5 h-3.5 text-[#f77500]" />
                                    <span>Valider l'Encaissement</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── QUITTANCE / REÇU D'ENCAISSEMENT OFFICIEL KABLLIX ERP ── */}
            {receiptInfo && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
                    <div className="bg-white w-full max-w-md rounded-[4px] shadow-2xl border-2 border-[#001d35] overflow-hidden transform animate-in zoom-in-95 duration-150">
                        <div className="p-3.5 sm:p-4 border-b-2 border-gray-300 flex justify-between items-center bg-white">
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                <div>
                                    <h3 className="text-sm font-bold text-[#001d35] uppercase tracking-wide">
                                        Quittance de Règlement de Dette
                                    </h3>
                                    <p className="text-[10px] text-gray-500 font-normal">Paiement validé avec succès</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setReceiptInfo(null)}
                                className="text-gray-400 hover:text-gray-600 p-1 rounded-[4px] hover:bg-gray-100 transition-colors cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-4 space-y-3 text-xs font-sans">
                            <div className="bg-emerald-50/70 border border-emerald-200 rounded-[4px] p-3 text-center">
                                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                                    Montant Total Encaissé
                                </span>
                                <span className="text-2xl font-black text-emerald-700 mt-0.5 block">
                                    {formatPrice(receiptInfo.amount)}
                                </span>
                                <span className="text-[10px] font-semibold text-emerald-800 uppercase tracking-wider mt-1 inline-block bg-emerald-100 px-2 py-0.5 rounded-[3px]">
                                    Mode : {
                                        receiptInfo.method === 'avoir' ? '🎫 Avoir / Avance Imputée' :
                                        receiptInfo.method === 'wave_om' ? '📱 Mobile Money' :
                                        receiptInfo.method === 'check' ? '📝 Chèque' :
                                        receiptInfo.method === 'bank' ? '🏦 Virement' : '💵 Espèces'
                                    }
                                </span>
                            </div>

                            <div className="space-y-2 border-t border-b border-gray-200 py-3 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-gray-500 font-medium">Client Débiteur :</span>
                                    <strong className="text-[#001d35]">{receiptInfo.customerName}</strong>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500 font-medium">Portée :</span>
                                    <span className="font-semibold text-gray-800">{receiptInfo.targetName}</span>
                                </div>
                                {receiptInfo.note && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-500 font-medium">Référence / Note :</span>
                                        <span className="text-gray-700 font-semibold italic">{receiptInfo.note}</span>
                                    </div>
                                )}
                                <div className="flex justify-between pt-1 border-t border-gray-100">
                                    <span className="text-gray-500 font-medium">Date & Heure :</span>
                                    <span className="text-gray-700 font-medium">{new Date(receiptInfo.date).toLocaleString('fr-FR')}</span>
                                </div>
                                <div className="flex justify-between pt-1.5 border-t border-gray-200">
                                    <span className="text-gray-700 font-bold uppercase tracking-wider text-[11px]">Nouveau Solde Restant Dû :</span>
                                    <strong className={`text-sm ${receiptInfo.remaining > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                                        {formatPrice(receiptInfo.remaining)}
                                    </strong>
                                </div>
                            </div>
                        </div>

                        <div className="p-3.5 bg-slate-50 border-t-2 border-gray-200 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => window.print()}
                                className="px-3.5 py-1.5 border border-gray-300 text-gray-700 font-semibold uppercase tracking-wider text-xs hover:bg-white rounded-[4px] cursor-pointer transition-colors flex items-center gap-1.5"
                            >
                                <Printer className="w-3.5 h-3.5" />
                                <span>Imprimer Quittance</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setReceiptInfo(null)}
                                className="px-4 py-1.5 bg-[#001d35] hover:bg-[#00284a] text-white font-semibold uppercase tracking-wider text-xs rounded-[4px] cursor-pointer transition-colors shadow-sm"
                            >
                                Terminer
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── OVERLAY LOADER D'ACTION MÉTIER (1,5s au minimum, identique à Réapprovisionnement Intelligent) ── */}
            {actionLoading && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[250] p-4 animate-in fade-in duration-150">
                    <div className="bg-white rounded-[4px] p-6 shadow-2xl border-2 border-[#001d35] flex flex-col items-center max-w-sm text-center">
                        <div className="relative h-12 w-12 mb-3">
                            <div className="absolute inset-0 animate-spin rounded-full border-4 border-gray-200 border-t-[#001d35]"></div>
                            <div className="absolute inset-2 animate-spin-reverse rounded-full border-2 border-transparent border-b-[#f77500]"></div>
                        </div>
                        <h4 className="text-sm font-semibold text-[#001d35] uppercase tracking-wider">
                            Traitement en cours...
                        </h4>
                        <p className="text-xs text-gray-600 mt-1 font-medium">
                            {actionLoading}
                        </p>
                    </div>
                </div>
            )}

            {/* ── OVERLAY LOADER D'ENTRÉE DE PAGE (1,5s au montage, identique à Réapprovisionnement Intelligent) ── */}
            {isPageLoading && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[300] p-4 animate-in fade-in duration-150">
                    <div className="bg-white rounded-[4px] p-6 shadow-2xl border-2 border-[#001d35] flex flex-col items-center max-w-sm text-center">
                        <div className="relative h-12 w-12 mb-3">
                            <div className="absolute inset-0 animate-spin rounded-full border-4 border-gray-200 border-t-[#001d35]"></div>
                            <div className="absolute inset-2 animate-spin-reverse rounded-full border-2 border-transparent border-b-[#f77500]"></div>
                        </div>
                        <h4 className="text-sm font-semibold text-[#001d35] uppercase tracking-wider">
                            Chargement en cours...
                        </h4>
                        <p className="text-xs text-gray-600 mt-1 font-medium">
                            Carnet de Crédit & Règlements Clients
                        </p>
                    </div>
                </div>
            )}

        </div>
    );
};

export default DebtBook;
