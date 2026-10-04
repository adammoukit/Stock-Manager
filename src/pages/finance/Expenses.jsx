import React from 'react';
import { useSales } from '../../context/SalesContext';
import { DollarSign, Plus, Trash2, TrendingDown, X } from 'lucide-react';
import { formatPrice } from '../../utils/currency';
import FinancialInput from '../../components/FinancialInput';
import T from '../../utils/toast';

const Expenses = () => {
    const { expenses, addExpense, deleteExpense } = useSales();

    const [showForm, setShowForm] = React.useState(false);
    const [formData, setFormData] = React.useState({
        description: '',
        amount: '',
        category: 'Loyer',
        date: new Date().toISOString().split('T')[0]
    });

    const categories = ['Loyer', 'Salaires', 'Électricité', 'Eau', 'Internet', 'Fournitures', 'Maintenance', 'Autre'];

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.description || !formData.amount) {
            T.warning("Veuillez renseigner la description et le montant.");
            return;
        }

        addExpense({
            description: formData.description,
            amount: parseFloat(formData.amount),
            category: formData.category,
            date: formData.date
        });

        setFormData({
            description: '',
            amount: '',
            category: 'Loyer',
            date: new Date().toISOString().split('T')[0]
        });
        setShowForm(false);
        T.saved("Dépense enregistrée avec succès");
    };

    const thisMonthExpenses = expenses.filter(e => {
        const expenseDate = new Date(e.date);
        const now = new Date();
        return expenseDate.getMonth() === now.getMonth() && expenseDate.getFullYear() === now.getFullYear();
    });

    const totalThisMonth = thisMonthExpenses.reduce((sum, e) => sum + e.amount, 0);
    const today = new Date().toISOString().split('T')[0];
    const totalToday = expenses
        .filter(e => e.date === today)
        .reduce((sum, e) => sum + e.amount, 0);

    const StatCard = ({ title, value, subValue, icon, colorClass, delay = "0" }) => (
        <div className="bg-white p-5 rounded-sm border-2 border-gray-300 shadow-sm relative group hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col justify-center min-h-[120px]">
            <div className="relative z-10">
                <p className="text-[11px] font-bold text-blue-600/70 uppercase tracking-widest mb-1">{title}</p>
                <h3 className={`text-xl sm:text-2xl font-semibold opacity-85 ${colorClass}`}>{value}</h3>
                {subValue && <p className="text-xs text-gray-400 mt-2 font-medium">{subValue}</p>}
            </div>
            <img 
                src={icon} 
                alt="" 
                className="absolute bottom-1 right-1 w-16 h-16 opacity-30 group-hover:opacity-50 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-700 pointer-events-none"
            />
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-[#001d35]">Gestion des Dépenses</h2>
                    <p className="text-gray-500">Enregistrez et suivez vos dépenses mensuelles</p>
                </div>
                <button
                    onClick={() => setShowForm(true)}
                    className="bg-[#001d35] hover:bg-blue-800 text-white px-4 py-2 rounded-sm flex items-center gap-2 transition-colors shadow-sm font-semibold cursor-pointer"
                >
                    <Plus className="w-5 h-5" />
                    Nouvelle Dépense
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard 
                    title="Dépenses du Mois"
                    value={formatPrice(totalThisMonth)}
                    subValue={`${thisMonthExpenses.length} transaction(s)`}
                    icon="/icons8/fluency_240_coins.png"
                    colorClass="text-red-600"
                />
                <StatCard 
                    title="Dépenses du Jour"
                    value={formatPrice(totalToday)}
                    subValue="Aujourd'hui"
                    icon="/icons8/fluency_240_coins.png"
                    colorClass="text-orange-600"
                />
                <StatCard 
                    title="Catégories Actives"
                    value={categories.length}
                    subValue="Types de frais"
                    icon="/icons8/fluency_240_tags.png"
                    colorClass="text-[#001d35]"
                />
            </div>

            {/* Modal Nouvelle Dépense */}
            {showForm && (
                <div 
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={() => setShowForm(false)}
                >
                    <div 
                        className="bg-white rounded-sm shadow-2xl border-t-4 border-[#001d35] w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header Modal */}
                        <div className="p-5 border-b border-gray-200 flex justify-between items-start bg-white flex-shrink-0">
                            <div>
                                <h3 className="text-sm sm:text-base font-bold text-[#001d35] uppercase tracking-wide">
                                    Nouvelle Dépense
                                </h3>
                                <p className="text-gray-500 text-xs mt-0.5 font-normal">
                                    Enregistrez une sortie ou charge d'exploitation
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowForm(false)}
                                className="text-gray-400 hover:text-gray-600 p-1 rounded transition-colors cursor-pointer"
                                title="Fermer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Formulaire */}
                        <form onSubmit={handleSubmit}>
                            <div className="p-5 space-y-4">
                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-700 uppercase tracking-wide mb-1.5">
                                        Désignation / Motif
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        className="w-full px-3 py-2.5 bg-gray-50/50 border border-gray-300 rounded-sm focus:outline-none focus:border-[#001d35] focus:bg-white text-xs font-medium text-gray-800"
                                        placeholder="Ex: Facture électricité, Achat fournitures, Carburant..."
                                        required
                                        autoFocus
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[11px] font-semibold text-gray-700 uppercase tracking-wide mb-1.5">
                                            Montant (FCFA)
                                        </label>
                                        <FinancialInput
                                            value={formData.amount}
                                            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                            className="w-full px-3 py-2.5 bg-gray-50/50 border border-gray-300 rounded-sm focus:outline-none focus:border-[#001d35] focus:bg-white text-sm font-bold text-[#001d35]"
                                            placeholder="0"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-semibold text-gray-700 uppercase tracking-wide mb-1.5">
                                            Catégorie
                                        </label>
                                        <select
                                            value={formData.category}
                                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                            className="w-full px-3 py-2.5 bg-gray-50/50 border border-gray-300 rounded-sm focus:outline-none focus:border-[#001d35] focus:bg-white text-xs font-medium text-gray-800"
                                        >
                                            {categories.map(cat => (
                                                <option key={cat} value={cat}>{cat}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-700 uppercase tracking-wide mb-1.5">
                                        Date de l'opération
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.date}
                                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                        className="w-full px-3 py-2.5 bg-gray-50/50 border border-gray-300 rounded-sm focus:outline-none focus:border-[#001d35] focus:bg-white text-xs font-medium text-gray-800"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Footer Modal Actions */}
                            <div className="p-4 bg-white border-t border-gray-200 flex justify-end gap-3 flex-shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setShowForm(false)}
                                    className="px-5 py-2.5 border-2 border-gray-200 text-gray-700 font-bold uppercase tracking-wider text-xs hover:bg-gray-50 rounded-sm cursor-pointer transition-colors text-center"
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2.5 bg-[#001d35] hover:bg-[#002d52] text-white font-bold uppercase tracking-wider text-xs rounded-sm cursor-pointer transition-colors shadow-sm text-center"
                                >
                                    Enregistrer la dépense
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Expenses List */}
            <div className="bg-white rounded-sm border-2 border-gray-300 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm relative">
                        <thead style={{ backgroundColor: '#001d35' }} className="text-white font-bold sticky top-0 z-10 shadow-sm uppercase tracking-wider text-[11px]">
                            <tr className="divide-x-2 divide-white/20">
                                <th className="px-4 py-2 border-r-2 border-[#e6e6e6]/40">Date</th>
                                <th className="px-4 py-2 border-r-2 border-[#e6e6e6]/40">Désignation / Motif</th>
                                <th className="px-4 py-2 border-r-2 border-[#e6e6e6]/40">Catégorie</th>
                                <th className="px-4 py-2 border-r-2 border-[#e6e6e6]/40 text-right">Montant</th>
                                <th className="px-4 py-2 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y-2 divide-[#e6e6e6]">
                            {expenses.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-4 py-8 text-center text-gray-500 font-semibold text-[14px] text-[#001d35]">
                                        Aucune dépense enregistrée pour le moment.
                                    </td>
                                </tr>
                            ) : (
                                [...expenses].reverse().map((expense) => (
                                    <tr key={expense.id} className="divide-x-2 divide-[#e6e6e6] transition-colors odd:bg-[#f3f3f3] even:bg-[#ffffff] hover:bg-blue-50/40">
                                        <td className="px-4 py-2 text-[#001d35] font-semibold text-[13px] uppercase">
                                            {new Date(expense.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </td>
                                        <td className="px-4 py-2 font-bold text-[#001d35] text-[14px] truncate">{expense.description.toUpperCase()}</td>
                                        <td className="px-4 py-2">
                                            <span className="bg-[#001d35]/10 text-[#001d35] px-2.5 py-0.5 rounded-sm text-xs font-semibold border border-[#001d35]/20 uppercase">
                                                {expense.category}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2 font-bold text-red-600 text-right text-[14px]">
                                            {formatPrice(expense.amount)}
                                        </td>
                                        <td className="px-4 py-2 text-right">
                                            <button
                                                onClick={() => {
                                                    if (window.confirm('Supprimer cette dépense ?')) {
                                                        deleteExpense(expense.id);
                                                        T.deleted("Dépense supprimée");
                                                    }
                                                }}
                                                className="p-1 text-gray-400 cursor-pointer hover:text-red-600 hover:bg-red-50 rounded-sm transition-colors"
                                                title="Supprimer"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Expenses;
