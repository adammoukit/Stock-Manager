import React from 'react';
import { useSales } from '../../context/SalesContext';
import { DollarSign, Plus, Trash2, TrendingDown } from 'lucide-react';
import { formatPrice } from '../../utils/currency';

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
        if (!formData.description || !formData.amount) return;

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
                <p className="text-[11px] font-bold text-teal-600/70 uppercase tracking-widest mb-1">{title}</p>
                <h3 className={`text-2xl font-black ${colorClass}`}>{value}</h3>
                {subValue && <p className="text-[10px] text-gray-400 mt-1 font-medium italic">{subValue}</p>}
            </div>
            <img 
                src={icon} 
                alt="" 
                className="absolute bottom-1 right-1 w-16 h-16 opacity-90 group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-700 pointer-events-none"
            />
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-[#018f8f]">Gestion des Dépenses</h2>
                    <p className="text-gray-500">Enregistrez et suivez vos dépenses mensuelles</p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="bg-[#018f8f] hover:bg-teal-700 text-white px-4 py-2 rounded-sm flex items-center gap-2 transition-colors shadow-sm font-semibold"
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
                    colorClass="text-[#018f8f]"
                />
            </div>

            {/* Add Expense Form */}
            {showForm && (
                <div className="bg-white rounded-sm border-2 border-gray-300 shadow-lg p-6 animate-in slide-in-from-top-4 duration-300">
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b-2 border-gray-100">
                        <img src="/icons8/fluency_96_plus.png" alt="" className="w-8 h-8" />
                        <h3 className="text-xl font-black text-gray-900 uppercase">Nouvelle Dépense</h3>
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="flex items-center gap-3 text-sm font-extrabold text-gray-800 mb-2 uppercase">
                                    <img src="/icons8/color_96_align-left.png" alt="" className="w-7 h-7" />
                                    Désignation / Motif
                                </label>
                                <input
                                    type="text"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-[#018f8f]/50 bg-white font-medium"
                                    placeholder="Ex: Facture d'électricité Mai"
                                    required
                                />
                            </div>
                            <div>
                                <label className="flex items-center gap-3 text-sm font-extrabold text-gray-800 mb-2 uppercase">
                                    <img src="/icons8/color_96_money-bag.png" alt="" className="w-7 h-7" />
                                    Montant (FCFA)
                                </label>
                                <input
                                    type="number"
                                    value={formData.amount}
                                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-[#018f8f]/50 bg-white font-black text-lg"
                                    placeholder="0"
                                    required
                                />
                            </div>
                            <div>
                                <label className="flex items-center gap-3 text-sm font-extrabold text-gray-800 mb-2 uppercase">
                                    <img src="/icons8/color_96_tag.png" alt="" className="w-7 h-7" />
                                    Catégorie
                                </label>
                                <select
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-[#018f8f]/50 bg-white font-bold"
                                >
                                    {categories.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="flex items-center gap-3 text-sm font-extrabold text-gray-800 mb-2 uppercase">
                                    <img src="/icons8/color_96_calendar.png" alt="" className="w-7 h-7" />
                                    Date de l'opération
                                </label>
                                <input
                                    type="date"
                                    value={formData.date}
                                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-[#018f8f]/50 bg-white font-bold"
                                    required
                                />
                            </div>
                        </div>
                        <div className="flex gap-4 pt-4">
                            <button
                                type="submit"
                                className="bg-[#018f8f] hover:bg-teal-700 text-white px-8 py-3 rounded-sm font-black uppercase tracking-wider shadow-md active:scale-95 transition-all"
                            >
                                Enregistrer la dépense
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowForm(false)}
                                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-8 py-3 rounded-sm font-black uppercase tracking-wider transition-all"
                            >
                                Annuler
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Expenses List */}
            <div className="bg-white rounded-sm border-2 border-gray-300 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-separate border-spacing-0">
                        <thead style={{ backgroundColor: '#018f8f' }} className="text-white font-bold uppercase tracking-wider text-[11px]">
                            <tr className="divide-x-2 divide-teal-700/40">
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4">Désignation / Motif</th>
                                <th className="px-6 py-4">Catégorie</th>
                                <th className="px-6 py-4 text-right">Montant</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y-2 divide-gray-200">
                            {expenses.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-gray-400 font-medium italic">
                                        Aucune dépense enregistrée pour le moment.
                                    </td>
                                </tr>
                            ) : (
                                [...expenses].reverse().map((expense) => (
                                    <tr key={expense.id} className="hover:bg-gray-50 transition-colors group divide-x-2 divide-gray-200">
                                        <td className="px-6 py-3 text-gray-600 font-bold text-xs uppercase">
                                            {new Date(expense.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </td>
                                        <td className="px-6 py-3 font-extrabold text-gray-900 group-hover:text-[#018f8f] transition-colors">{expense.description.toUpperCase()}</td>
                                        <td className="px-6 py-3">
                                            <span className="bg-teal-50 text-[#018f8f] px-3 py-1 rounded-sm text-[10px] font-black border border-teal-100 uppercase">
                                                {expense.category}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3 font-black text-red-600 text-right bg-red-50/30">
                                            {formatPrice(expense.amount)}
                                        </td>
                                        <td className="px-6 py-3 text-right">
                                            <button
                                                onClick={() => {
                                                    if (window.confirm('Supprimer cette dépense ?')) {
                                                        deleteExpense(expense.id);
                                                    }
                                                }}
                                                className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-all active:scale-90"
                                                title="Supprimer"
                                            >
                                                <Trash2 className="w-4 h-4" />
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
