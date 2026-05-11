import React, { useState } from 'react';
import { useSales } from '../../context/SalesContext';
import { formatPrice } from '../../utils/currency';
import { Search, User, CreditCard, MessageCircle, AlertTriangle } from 'lucide-react';

const DebtBook = () => {
    const { debts, addDebtPayment } = useSales();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDebt, setSelectedDebt] = useState(null);
    const [paymentAmount, setPaymentAmount] = useState('');

    const activeDebts = debts.filter(d => d.status === 'pending');

    // Group debts by customer
    const groupedDebts = activeDebts.reduce((acc, debt) => {
        if (!acc[debt.customerName]) {
            acc[debt.customerName] = {
                customerName: debt.customerName,
                debts: [],
                totalAmount: 0,
                paidAmount: 0,
                remaining: 0
            };
        }
        acc[debt.customerName].debts.push(debt);
        acc[debt.customerName].totalAmount += debt.totalAmount;
        acc[debt.customerName].paidAmount += debt.paidAmount;
        acc[debt.customerName].remaining += (debt.totalAmount - debt.paidAmount);
        return acc;
    }, {});

    const customers = Object.values(groupedDebts).filter(c =>
        c.customerName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handlePayment = () => {
        const amount = parseFloat(paymentAmount);
        if (!amount || amount <= 0 || !selectedDebt) return;

        // Distribute payment across oldest debts first, but here we just simplify by taking a whole customer logic
        // For precision, we pay the specific debt selected, but our UX allows selecting a customer
        // We will just pay down the oldest debt
        let remainingPayment = amount;

        selectedDebt.debts.sort((a, b) => new Date(a.date) - new Date(b.date)).forEach(debt => {
            if (remainingPayment <= 0) return;
            const debtRemaining = debt.totalAmount - debt.paidAmount;
            if (debtRemaining > 0) {
                const pay = Math.min(debtRemaining, remainingPayment);
                addDebtPayment(debt.id, pay);
                remainingPayment -= pay;
            }
        });

        setSelectedDebt(null);
        setPaymentAmount('');
    };

    const handleWhatsApp = (customer) => {
        const text = `Bonjour ${customer.customerName},\n\nSauf erreur de notre part, votre solde débiteur s'élève à *${formatPrice(customer.remaining)}*.\n\nMerci de bien vouloir régulariser votre situation dans les meilleurs délais.\n\nCordialement,\nLa Quincaillerie.`;
        const encoded = encodeURIComponent(text);
        window.open(`https://wa.me/?text=${encoded}`, '_blank');
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-[#018f8f] tracking-tight">Carnet de Crédit</h2>
                    <p className="text-gray-500 text-sm mt-1 font-medium">Gestion des impayés et relances clients</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* Total Debts Overview */}
                <div className="bg-white rounded-sm border-2 border-gray-100 p-6 shadow-sm relative overflow-hidden group hover:border-[#018f8f]/30 transition-colors">
                    <div className="relative z-10 flex flex-col h-full justify-between">
                        <div className="flex-1">
                            <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-teal-600/70">Total Créances</p>
                            <div className="flex items-baseline mt-2 font-semibold" style={{ color: '#005f5f' }}>
                                <h3 className="text-2xl sm:text-3xl font-semibold">
                                    {formatPrice(activeDebts.reduce((sum, d) => sum + (d.totalAmount - d.paidAmount), 0))}
                                </h3>
                            </div>
                        </div>
                    </div>
                    <img 
                        src="/icons8/fluency_96_ledger.png" 
                        alt="" 
                        className="absolute bottom-2 right-2 w-16 h-16 opacity-90 group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-700 pointer-events-none" 
                    />
                </div>
            </div>

            <div className="bg-white rounded-sm shadow-sm border border-gray-200 flex flex-col">
                <div className="p-4 border-b border-gray-100">
                    <div className="relative max-w-md">
                        <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Rechercher un client..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-[#018f8f] border-b-2 border-teal-800 text-white font-black uppercase tracking-widest text-[11px]">
                            <tr>
                                <th className="px-6 py-4">Client</th>
                                <th className="px-6 py-4">Total Dettes</th>
                                <th className="px-6 py-4">Déjà Payé</th>
                                <th className="px-6 py-4">Reste à Payer</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y-2 divide-gray-200">
                            {customers.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                                        Aucune dette enregistrée.
                                    </td>
                                </tr>
                            ) : (
                                customers.map((c) => (
                                    <tr key={c.customerName} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-teal-50 p-2 rounded-sm border border-teal-100">
                                                    <User className="w-4 h-4 text-teal-700" />
                                                </div>
                                                <span className="font-bold text-gray-900 uppercase text-[13px] tracking-wide">{c.customerName}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-semibold text-gray-700">{formatPrice(c.totalAmount)}</td>
                                        <td className="px-6 py-4 font-semibold text-teal-600">{formatPrice(c.paidAmount)}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                                                <span className="font-black text-red-600 tracking-tight">{formatPrice(c.remaining)}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => handleWhatsApp(c)}
                                                    className="p-2 text-green-700 bg-green-50 border border-green-200 hover:bg-green-100 rounded-sm transition-all shadow-sm active:scale-95"
                                                    title="Relancer par WhatsApp"
                                                >
                                                    <img src="/icons8/fluency_48_whatsapp.png" alt="WhatsApp" className="w-5 h-5" />
                                                </button>
                                                <button
                                                    onClick={() => { setSelectedDebt(c); setPaymentAmount(c.remaining.toString()); }}
                                                    className="px-3 py-2 text-white bg-teal-600 border border-teal-800 hover:bg-teal-700 rounded-sm transition-all shadow-sm active:scale-95 flex items-center gap-2"
                                                >
                                                    <CreditCard className="w-4 h-4" />
                                                    <span className="text-[11px] font-black uppercase tracking-widest">Encaisser</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Payment Modal for Debt */}
            {selectedDebt && (
                <div className="fixed inset-0 bg-teal-900/40 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-sm border-2 border-teal-800 shadow-[0_20px_50px_rgba(0,0,0,0.3)] w-full max-w-md overflow-hidden transform animate-in zoom-in-95 duration-200">
                        {/* En-tête */}
                        <div className="bg-[#018f8f] p-4 flex items-center gap-3 border-b-2 border-teal-800">
                            <div className="bg-white/20 p-2 rounded-sm border border-white/30 backdrop-blur-sm">
                                <img src="/icons8/fluency_48_bank-cards.png" alt="" className="w-6 h-6" />
                            </div>
                            <h3 className="text-white font-black uppercase tracking-[0.15em] text-sm">Remboursement</h3>
                        </div>

                        {/* Corps */}
                        <div className="p-6 space-y-6">
                            <div className="bg-gray-50 p-4 border border-gray-200 rounded-sm space-y-2 shadow-inner">
                                <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                                    <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Client</span>
                                    <span className="font-black text-gray-900 uppercase tracking-wide text-sm">{selectedDebt.customerName}</span>
                                </div>
                                <div className="flex justify-between items-center pt-2">
                                    <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Sous-total Dû</span>
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                                        <span className="font-black text-red-600 text-lg tracking-tight">{formatPrice(selectedDebt.remaining)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-[11px] font-black uppercase tracking-widest text-gray-700">Montant du Paiement</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-gray-400 text-sm">FCFA</span>
                                    <input
                                        type="number"
                                        min="0"
                                        max={selectedDebt.remaining}
                                        value={paymentAmount}
                                        onChange={(e) => setPaymentAmount(e.target.value)}
                                        className="w-full pl-16 pr-4 py-3 bg-white border-2 border-gray-300 rounded-sm font-black text-xl text-teal-800 focus:outline-none focus:border-teal-600 focus:ring-0 transition-colors shadow-inner"
                                        autoFocus
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="p-5 bg-gray-50 flex gap-3 border-t border-gray-100">
                            <button
                                onClick={() => setSelectedDebt(null)}
                                className="flex-1 px-4 py-3 rounded-sm border-2 border-gray-300 text-gray-700 font-black uppercase text-xs tracking-widest hover:bg-white hover:border-teal-600 hover:text-teal-600 transition-all active:scale-95"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handlePayment}
                                className="flex-1 px-4 py-3 rounded-sm bg-teal-600 border-2 border-teal-800 text-white font-black uppercase text-xs tracking-widest shadow-[0_4px_0_rgb(17,94,89)] hover:shadow-none hover:translate-y-1 transition-all active:scale-95"
                            >
                                Valider le Paiement
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DebtBook;
