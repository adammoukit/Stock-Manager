import React, { useState, useMemo, useEffect } from 'react';
import { useSession } from '../../context/SessionContext';
import { useSales } from '../../context/SalesContext';
import { formatPrice } from '../../utils/currency';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Lock, Unlock, Calculator, TrendingUp, TrendingDown, Clock, Activity, ArrowDownCircle, X } from 'lucide-react';
import toast from 'react-hot-toast';

const Sessions = () => {
    const { activeSession, pastSessions, openSession, closeSession } = useSession();
    const { transactions, expenses, addExpense } = useSales();

    const [initialAmountInput, setInitialAmountInput] = useState('');
    const [countedAmountInput, setCountedAmountInput] = useState('');
    const [currentTime, setCurrentTime] = useState(new Date());
    const [showWithdrawModal, setShowWithdrawModal] = useState(false);
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [withdrawLabel, setWithdrawLabel] = useState('');

    // Horloge en temps réel
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Calcule des totaux en direct pour la session active
    const sessionStats = useMemo(() => {
        if (!activeSession) return { totalSales: 0, totalExpenses: 0, expectedAmount: 0 };

        const startTime = new Date(activeSession.startTime).getTime();

        // Ventes réalisées pendant cette session
        const sessionSales = transactions.filter(t => {
            const tTime = new Date(t.date || t.transactionDate).getTime();
            return tTime >= startTime;
        });

        // Seuls les encaissements en espèces influencent la caisse physique (simplification)
        const totalSalesCash = sessionSales
            .filter(t => t.paymentMethod === 'cash')
            .reduce((sum, t) => sum + (parseFloat(t.amountGiven) || 0) - (parseFloat(t.change) || parseFloat(t.changeAmount) || 0), 0);

        // Dépenses réalisées pendant cette session
        const sessionExpenses = expenses.filter(e => {
            const eTime = new Date(e.date).getTime();
            return eTime >= startTime;
        });
        const totalExpensesCash = sessionExpenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);

        const expected = activeSession.initialAmount + totalSalesCash - totalExpensesCash;

        return {
            totalSales: totalSalesCash,
            totalExpenses: totalExpensesCash,
            expectedAmount: expected
        };
    }, [activeSession, transactions, expenses]);

    const handleOpenSession = (e) => {
        e.preventDefault();
        const amount = parseFloat(initialAmountInput);
        if (isNaN(amount) || amount < 0) {
            toast.error("Veuillez entrer un montant valide");
            return;
        }
        openSession(amount);
        setInitialAmountInput('');
        toast.success("Session ouverte avec succès !");
    };

    const handleCloseSession = (e) => {
        e.preventDefault();
        const counted = parseFloat(countedAmountInput);
        if (isNaN(counted) || counted < 0) {
            toast.error("Veuillez entrer le montant compté");
            return;
        }

        closeSession(counted, sessionStats.expectedAmount, sessionStats.totalSales, sessionStats.totalExpenses);
        setCountedAmountInput('');
        toast.success("Session clôturée !");
    };

    const handleWithdraw = (e) => {
        e.preventDefault();
        const amount = parseFloat(withdrawAmount);
        if (isNaN(amount) || amount <= 0) {
            toast.error('Veuillez entrer un montant valide.');
            return;
        }
        if (!withdrawLabel.trim()) {
            toast.error('Veuillez indiquer le motif de la sortie.');
            return;
        }
        addExpense({
            amount,
            label: withdrawLabel.trim(),
            category: 'Sortie de caisse',
            paymentMethod: 'cash'
        });
        setWithdrawAmount('');
        setWithdrawLabel('');
        setShowWithdrawModal(false);
        toast.success(`Sortie de ${formatPrice(amount)} enregistrée.`);
    };

    return (
        <div className="p-6 h-full flex flex-col gap-6 overflow-y-auto custom-scrollbar bg-[#f0f4f8]">
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-2xl font-bold text-[#018f8f] tracking-tight">Gestion de Caisse</h2>
                    <p className="text-gray-500 text-sm mt-1 font-medium">Ouvrez une session pour commencer à vendre, et clôturez-la en fin de journée.</p>
                </div>
                {/* Bandeau d'état en haut à droite */}
                <div className="flex items-center gap-3">
                    {/* Horloge */}
                    <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-sm px-3 py-2 shadow-sm">
                        <Clock size={14} className="text-slate-400" />
                        <span className="text-slate-700 font-semibold text-sm tabular-nums">
                            {format(currentTime, 'HH:mm:ss')}
                        </span>
                    </div>
                    {/* État de la caisse */}
                    {activeSession ? (
                        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-sm px-3 py-2 shadow-sm">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <div>
                                <p className="text-emerald-700 font-bold text-[11px] uppercase tracking-wider">Caisse Ouverte</p>
                                <p className="text-emerald-600 text-[10px] font-medium">{activeSession.cashierName} &bull; depuis {format(new Date(activeSession.startTime), 'HH:mm', { locale: fr })}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-sm px-3 py-2 shadow-sm">
                            <span className="w-2 h-2 rounded-full bg-red-500"></span>
                            <p className="text-red-700 font-bold text-[11px] uppercase tracking-wider">Caisse Fermée</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">

                {/* Section d'Action (Ouverture/Clôture) */}
                <div className="lg:col-span-1 flex flex-col gap-4">
                    {!activeSession ? (
                        <div className="bg-white rounded-sm shadow-sm border border-gray-200 overflow-hidden">
                            <div className="bg-[#018f8f] p-4 flex items-center gap-3">
                                <div className="bg-white/20 p-2 rounded-sm border border-white/30 backdrop-blur-sm">
                                    <Unlock className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-white font-semibold uppercase tracking-[0.1em] text-sm">Ouvrir la Caisse</h2>
                                    <p className="text-teal-100 text-[10px] uppercase tracking-wider font-medium">Initiez une nouvelle session</p>
                                </div>
                            </div>

                            <form onSubmit={handleOpenSession} className="flex flex-col gap-4 p-5">
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Fond de Caisse Initial (F CFA)</label>
                                    <div className="relative">

                                        <input
                                            type="number"
                                            value={initialAmountInput}
                                            onChange={(e) => setInitialAmountInput(e.target.value)}
                                            onWheel={(e) => e.currentTarget.blur()}
                                            className="w-full pl-10 pr-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-sm focus:outline-none focus:border-[#018f8f] font-semibold text-2xl text-slate-800 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            placeholder="Ex: 15000"
                                            required
                                            min="0"
                                        />
                                    </div>
                                </div>
                                <button type="submit" className="w-full py-3 bg-[#018f8f] hover:bg-teal-700 text-white font-semibold rounded-sm transition-colors uppercase tracking-widest flex items-center justify-center gap-2 mt-2 cursor-pointer">
                                    <Unlock size={18} />
                                    Démarrer la session
                                </button>
                            </form>
                        </div>
                    ) : (
                        <div className="bg-white rounded-sm shadow-sm border border-gray-200 overflow-hidden">
                            <div className="bg-blue-900 p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="bg-white/10 p-2 rounded-sm border border-white/20 backdrop-blur-sm">
                                        <Lock className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-white font-black uppercase tracking-[0.1em] text-sm">Clôturer la Caisse</h2>
                                        <p className="text-blue-200 text-[10px] uppercase tracking-wider flex items-center gap-1 mt-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                            Session Active
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <form onSubmit={handleCloseSession} className="flex flex-col gap-4 p-5">
                                <div className="p-4 bg-slate-50 rounded-sm border border-slate-200 flex flex-col gap-1">
                                    <p className="text-[11px] font-bold text-slate-500 uppercase">Montant Attendu (Théorique)</p>
                                    <h3 className="text-2xl sm:text-3xl font-semibold text-[#005f5f] border-t border-slate-200 pt-1 mt-1">{formatPrice(sessionStats.expectedAmount)}</h3>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Espèces en Tiroir (Comptées)</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Calculator size={16} className="text-slate-400" />
                                        </div>
                                        <input
                                            type="number"
                                            value={countedAmountInput}
                                            onChange={(e) => setCountedAmountInput(e.target.value)}
                                            onWheel={(e) => e.currentTarget.blur()}
                                            className="w-full pl-10 pr-4 py-3 bg-white border-2 border-slate-300 rounded-sm focus:outline-none focus:border-blue-900 font-bold text-xl text-slate-800 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            placeholder="Ex: 50000"
                                            required
                                            min="0"
                                        />
                                    </div>
                                    {countedAmountInput !== '' && (
                                        <div className={`mt-3 p-3 rounded-sm border-2 text-sm font-bold flex items-center justify-between ${parseFloat(countedAmountInput) === sessionStats.expectedAmount
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                : 'bg-red-50 text-red-700 border-red-200'
                                            }`}>
                                            <span>Écart de caisse :</span>
                                            <span>{formatPrice(parseFloat(countedAmountInput) - sessionStats.expectedAmount)}</span>
                                        </div>
                                    )}
                                </div>
                                <button type="submit" className="w-full py-4 bg-blue-900 hover:bg-blue-950 text-white font-bold rounded-sm transition-all uppercase tracking-[0.15em] text-sm flex items-center justify-center gap-2 mt-2 shadow-sm hover:shadow-md cursor-pointer">
                                    <Lock size={18} />
                                    Clôturer & Valider
                                </button>
                            </form>
                        </div>
                    )}
                </div>

                {/* Section Dashboard (Session Active) */}
                <div className="lg:col-span-3 flex flex-col gap-4">
                    {activeSession ? (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            <fieldset className="bg-white px-5 pb-5 pt-2 md:px-6 md:pb-6 md:pt-3 min-h-[170px] flex flex-col justify-start rounded-sm shadow-sm border-2 border-slate-300 relative overflow-hidden group">
                                <legend className="text-[14px] font-black tracking-wider uppercase text-blue-900 px-2 bg-white">
                                    Fond Initial
                                </legend>
                                <div className="flex justify-between items-start relative z-10">
                                    <div className="flex-1">
                                        <div className="flex items-baseline mt-1 font-semibold" style={{ color: '#005f5f' }}>
                                            <h3 className="text-2xl sm:text-3xl font-semibold">{formatPrice(activeSession.initialAmount)}</h3>
                                        </div>
                                        <p className="text-sm text-gray-500 mt-2 font-medium pr-16 sm:pr-20">Déclaré à {format(new Date(activeSession.startTime), 'HH:mm', { locale: fr })}</p>
                                    </div>
                                </div>
                                <img
                                    src="/icons8/fluency_240_cash-in-hand.png"
                                    alt=""
                                    className="absolute -bottom-2 right-0 w-20 h-20 opacity-90 group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-700 pointer-events-none"
                                />
                            </fieldset>
                            <fieldset className="bg-white px-5 pb-5 pt-2 md:px-6 md:pb-6 md:pt-3 min-h-[170px] flex flex-col justify-start rounded-sm shadow-sm border-2 border-slate-300 relative overflow-hidden group">
                                <legend className="text-[14px] font-black tracking-wider uppercase text-blue-900 px-2 bg-white flex items-center gap-1">
                                    <TrendingUp size={16} /> Encaissements
                                </legend>
                                <div className="flex justify-between items-start relative z-10">
                                    <div className="flex-1">
                                        <div className="flex items-baseline mt-1 font-semibold" style={{ color: '#005f5f' }}>
                                            <h3 className="text-2xl sm:text-3xl font-semibold">+{formatPrice(sessionStats.totalSales)}</h3>
                                        </div>
                                        <p className="text-sm text-gray-500 mt-2 font-medium pr-16 sm:pr-20">Ventes en espèces uniquement</p>
                                    </div>
                                </div>
                                <img
                                    src="/icons8/fluency_240_stack-of-money.png"
                                    alt=""
                                    className="absolute -bottom-2 right-0 w-20 h-20 opacity-90 group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-700 pointer-events-none"
                                />
                            </fieldset>
                            <fieldset className="bg-white px-5 pb-5 pt-2 md:px-6 md:pb-6 md:pt-3 min-h-[170px] flex flex-col justify-start rounded-sm shadow-sm border-2 border-slate-300 relative overflow-hidden group md:col-span-2 xl:col-span-1">
                                <legend className="text-[14px] font-black tracking-wider uppercase text-blue-900 px-2 bg-white flex items-center gap-1">
                                    <TrendingDown size={16} /> Sorties de caisse
                                </legend>
                                <div className="flex justify-between items-start relative z-10">
                                    <div className="flex-1">
                                        <div className="flex items-baseline mt-1 font-semibold" style={{ color: '#005f5f' }}>
                                            <h3 className="text-2xl sm:text-3xl font-semibold text-red-600">-{formatPrice(sessionStats.totalExpenses)}</h3>
                                        </div>
                                        <p className="text-sm text-gray-500 mt-2 font-medium pr-16 sm:pr-20">Dépenses de la session courante</p>
                                    </div>
                                </div>
                                <img
                                    src="/icons8/fluency_240_debt.png"
                                    alt=""
                                    className="absolute -bottom-2 right-0 w-20 h-20 opacity-90 group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-700 pointer-events-none"
                                />
                            </fieldset>
                        </div>
                        
                        {/* Bouton Action Sortie de Caisse */}
                        <div className="mt-6 flex justify-end">
                            <button 
                                onClick={() => setShowWithdrawModal(true)}
                                className="group flex items-center gap-3 bg-white border-2 border-red-500 text-red-600 hover:bg-red-50 px-6 py-3 rounded-sm font-black uppercase tracking-widest text-xs transition-all shadow-sm hover:shadow-md cursor-pointer"
                            >
                                <ArrowDownCircle size={20} className="group-hover:scale-110 transition-transform" />
                                Effectuer une sortie de caisse
                            </button>
                        </div>
                        </>
                    ) : (
                        <div className="bg-slate-200/50 rounded-md border-2 border-dashed border-slate-300 flex items-center justify-center h-full min-h-[200px]">
                            <div className="text-center">
                                <img
                                    src="/icons8/fluency_240_cash-in-hand.png"
                                    alt=""
                                    className="w-20 h-20 mx-auto mb-3 opacity-60"
                                />
                                <p className="text-slate-500 font-medium">Ouvrez une session pour voir les statistiques en direct</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Historique des Sessions */}
            <div className="bg-white rounded-md shadow-sm mt-2">
                <div className="p-4 border-b border-slate-100">
                    <h3 className="font-bold text-slate-800 uppercase tracking-wide text-sm">Historique des clôtures</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                            <tr>
                                <th className="px-6 py-3">Date</th>
                                <th className="px-6 py-3">Ouverture</th>
                                <th className="px-6 py-3">Clôture</th>
                                <th className="px-6 py-3">Caissier</th>
                                <th className="px-6 py-3 text-right">Attendu</th>
                                <th className="px-6 py-3 text-right">Compté</th>
                                <th className="px-6 py-3 text-right">Écart</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {pastSessions.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-10 text-center text-slate-500">Aucun historique disponible</td>
                                </tr>
                            ) : (
                                pastSessions.map(session => (
                                    <tr key={session.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-3 font-medium text-slate-800">
                                            {format(new Date(session.startTime), 'dd MMM yyyy', { locale: fr })}
                                        </td>
                                        <td className="px-6 py-3 text-slate-500">
                                            {format(new Date(session.startTime), 'HH:mm')}
                                        </td>
                                        <td className="px-6 py-3 text-slate-500">
                                            {session.endTime ? format(new Date(session.endTime), 'HH:mm') : '-'}
                                        </td>
                                        <td className="px-6 py-3 text-slate-600">
                                            {session.cashierName || 'Inconnu'}
                                        </td>
                                        <td className="px-6 py-3 text-right text-slate-600 font-medium">
                                            {formatPrice(session.expectedAmount)}
                                        </td>
                                        <td className="px-6 py-3 text-right font-bold text-slate-800">
                                            {formatPrice(session.actualAmount)}
                                        </td>
                                        <td className="px-6 py-3 text-right">
                                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-bold ${session.difference === 0
                                                    ? 'bg-emerald-100 text-emerald-800'
                                                    : session.difference > 0
                                                        ? 'bg-blue-100 text-blue-800'
                                                        : 'bg-red-100 text-red-800'
                                                }`}>
                                                {session.difference > 0 ? '+' : ''}{formatPrice(session.difference)}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            {/* Modal Sortie de Caisse */}
            {showWithdrawModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-md rounded-sm shadow-2xl border-t-4 border-red-600 overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Nouvelle Sortie</h3>
                                    <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mt-1">Enregistrement d'une dépense espèce</p>
                                </div>
                                <button 
                                    onClick={() => setShowWithdrawModal(false)}
                                    className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors cursor-pointer"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleWithdraw} className="space-y-5">
                                <fieldset className="border-2 border-slate-200 rounded-sm p-4 pt-2 bg-slate-50/50">
                                    <legend className="px-2 text-[11px] font-black uppercase tracking-widest text-slate-500 bg-transparent">Détails de l'opération</legend>
                                    
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">Motif / Description</label>
                                            <input 
                                                type="text"
                                                value={withdrawLabel}
                                                onChange={(e) => setWithdrawLabel(e.target.value)}
                                                className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-sm focus:outline-none focus:border-red-500 font-semibold text-slate-700 transition-all"
                                                placeholder="Ex: Achat fournitures, Transport..."
                                                required
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5 ml-1">Montant (F CFA)</label>
                                            <div className="relative">
                                                <input 
                                                    type="number"
                                                    value={withdrawAmount}
                                                    onChange={(e) => setWithdrawAmount(e.target.value)}
                                                    onWheel={(e) => e.currentTarget.blur()}
                                                    className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-sm focus:outline-none focus:border-red-500 font-black text-2xl text-red-600 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                    placeholder="0"
                                                    required
                                                    min="1"
                                                />
                                                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-red-300 text-sm">F</span>
                                            </div>
                                        </div>
                                    </div>
                                </fieldset>

                                <div className="flex gap-3 pt-2">
                                    <button 
                                        type="button"
                                        onClick={() => setShowWithdrawModal(false)}
                                        className="flex-1 py-3 border-2 border-slate-200 text-slate-500 font-bold uppercase tracking-widest text-[10px] hover:bg-slate-50 transition-colors rounded-sm cursor-pointer"
                                    >
                                        Annuler
                                    </button>
                                    <button 
                                        type="submit"
                                        className="flex-[2] py-3 bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 transition-all rounded-sm shadow-lg shadow-red-200 cursor-pointer"
                                    >
                                        <ArrowDownCircle size={16} />
                                        Valider la sortie
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Sessions;
