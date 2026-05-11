import React from 'react';
import { useSales } from '../../context/SalesContext';
import { FileText, Download, MessageSquare, Trash2, ShieldAlert } from 'lucide-react';
import { formatPrice } from '../../utils/currency';

const Reports = () => {
    const { transactions, cancelTransaction } = useSales();

    const handleSMSReport = () => {
        const todayStr = new Date().toLocaleDateString('fr-FR');
        const todaysTransactions = transactions.filter(t => new Date(t.date).toLocaleDateString('fr-FR') === todayStr);

        const completed = todaysTransactions.filter(t => t.status === 'completed');
        const canceled = todaysTransactions.filter(t => t.status === 'canceled');

        const caisse = completed.reduce((sum, t) => sum + t.amountGiven, 0);

        let text = `*CLÔTURE CAISSE : ${todayStr}*\n\n`;
        text += `Ventes (Terminées): ${completed.length}\n`;
        text += `Ventes (Annulées): ${canceled.length}\n`;
        text += `\n*TOTAL EN CAISSE : ${formatPrice(caisse)}*\n\n`;
        text += `- Envoyé depuis l'application de gestion`;

        const encodedText = encodeURIComponent(text);
        window.open(`https://wa.me/?text=${encodedText}`, '_blank');
    };

    const exportToCSV = () => {
        if (transactions.length === 0) return;

        const headers = ['ID Transaction', 'Date', 'Total', 'Articles', 'Statut'];
        const rows = transactions.map(t => [
            t.id,
            new Date(t.date).toLocaleString('fr-FR'),
            t.total,
            t.items.map(i => `${i.name} (x${i.quantity})`).join('; '),
            t.status
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `rapport_ventes_${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
    };

    const exportToPDF = () => {
        if (transactions.length === 0) return;

        const printWindow = window.open('', '', 'height=600,width=800');
        printWindow.document.write('<html><head><title>Rapport des Ventes</title>');
        printWindow.document.write('<style>');
        printWindow.document.write(`
            body { font-family: sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            h1 { color: #333; }
            .header { margin-bottom: 20px; }
            .total { font-weight: bold; margin-top: 20px; text-align: right; }
        `);
        printWindow.document.write('</style></head><body>');
        printWindow.document.write('<div class="header">');
        printWindow.document.write(`<h1>Rapport des Ventes</h1>`);
        printWindow.document.write(`<p>Date d'export: ${new Date().toLocaleString('fr-FR')}</p>`);
        printWindow.document.write('</div>');

        printWindow.document.write('<table>');
        printWindow.document.write('<thead><tr><th>ID</th><th>Date</th><th>Articles</th><th>Total</th><th>Statut</th></tr></thead>');
        printWindow.document.write('<tbody>');

        transactions.forEach(t => {
            printWindow.document.write(`
                <tr>
                    <td>#${t.id}</td>
                    <td>${new Date(t.date).toLocaleString('fr-FR')}</td>
                    <td>${t.items.map(i => `${i.name} (x${i.quantity})`).join(', ')}</td>
                    <td>${formatPrice(t.total)}</td>
                    <td>${t.status}</td>
                </tr>
            `);
        });

        printWindow.document.write('</tbody></table>');
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        printWindow.print();
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-[#018f8f]">Rapports & Historique</h2>
                    <p className="text-gray-500">Consultez l'historique des ventes et exportez vos données</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleSMSReport}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-sm flex items-center gap-2 transition-colors shadow-sm font-semibold"
                    >
                        <MessageSquare className="w-5 h-5" />
                        Clôture SMS
                    </button>
                    <button
                        onClick={exportToCSV}
                        className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-sm flex items-center gap-2 transition-colors shadow-sm"
                    >
                        <Download className="w-5 h-5" />
                        Export CSV
                    </button>
                    <button
                        onClick={exportToPDF}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-sm flex items-center gap-2 transition-colors shadow-sm font-semibold"
                    >
                        <FileText className="w-5 h-5" />
                        Export PDF
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-sm border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-primary-600" />
                        Historique des Ventes
                    </h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead style={{ backgroundColor: '#018f8f' }} className="text-white font-bold uppercase tracking-wider text-[11px]">
                            <tr>
                                <th className="px-6 py-4">ID Transaction</th>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4">Articles</th>
                                <th className="px-6 py-4">Total</th>
                                <th className="px-6 py-4">Statut</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y-2 divide-gray-200">
                            {transactions.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                                        Aucune transaction enregistrée.
                                    </td>
                                </tr>
                            ) : (
                                transactions.map((transaction) => (
                                    <tr key={transaction.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 font-mono text-gray-600">#{transaction.id}</td>
                                        <td className="px-6 py-4 text-gray-900">
                                            {new Date(transaction.date).toLocaleString('fr-FR')}
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">
                                            <div className="flex flex-col gap-1">
                                                {transaction.items.map((item, idx) => (
                                                    <span key={idx} className="text-sm">
                                                        {item.name} <span className="font-medium text-gray-900">x{item.quantity}</span>
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-medium text-gray-900">
                                            {formatPrice(transaction.total)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`${transaction.status === 'canceled' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'} px-2 py-1 rounded-sm text-xs font-medium`}>
                                                {transaction.status === 'completed' ? 'Terminé' : (transaction.status === 'canceled' ? 'Annulé' : transaction.status)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {transaction.status !== 'canceled' && transaction.status !== 'debt_payment' && (
                                                <button
                                                    onClick={() => {
                                                        if (window.confirm("Êtes-vous sûr de vouloir annuler cette vente ? (Anti-coulage: cette action laissera une trace).")) {
                                                            cancelTransaction(transaction.id);
                                                        }
                                                    }}
                                                    className="p-2 text-red-500 hover:bg-red-50 rounded-sm transition-colors"
                                                    title="Annuler Vente (Anti-Vol)"
                                                >
                                                    <ShieldAlert className="w-4 h-4" />
                                                </button>
                                            )}
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

export default Reports;
