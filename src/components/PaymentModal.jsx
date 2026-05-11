import React, { useState } from 'react';
import { CreditCard, Banknote, X } from 'lucide-react';
import { formatPrice } from '../utils/currency';

const PaymentModal = ({ total, preSelectedMethod, onConfirm, onCancel, isProcessing }) => {
    const [paymentMethod, setPaymentMethod] = useState(preSelectedMethod || '');
    const [amountGiven, setAmountGiven] = useState(preSelectedMethod === 'card' ? total.toString() : '');
    const [customerName, setCustomerName] = useState('');
    const [error, setError] = useState('');

    const handleMethodSelect = (method) => {
        setPaymentMethod(method);
        if (method === 'card') {
            setAmountGiven(total.toString());
        } else if (method === 'credit') {
            setAmountGiven('0');
        } else {
            setAmountGiven('');
        }
        setError('');
    };

    const handleAmountChange = (e) => {
        const value = e.target.value;
        if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
            setAmountGiven(value);
            setError('');
        }
    };

    const handleConfirm = () => {
        const amount = parseFloat(amountGiven);

        if (!paymentMethod) {
            setError('Veuillez sélectionner un mode de paiement');
            return;
        }

        if (!amountGiven || isNaN(amount)) {
            setError('Veuillez entrer un montant valide');
            return;
        }

        if (paymentMethod === 'credit' && !customerName.trim()) {
            setError('Veuillez entrer le nom du client (débiteur)');
            return;
        }

        if (paymentMethod !== 'credit' && amount < total) {
            setError(`Le montant doit être au moins ${formatPrice(total)}`);
            return;
        }

        onConfirm({
            method: paymentMethod,
            amountGiven: amount,
            change: paymentMethod !== 'credit' ? amount - total : 0,
            customerName: paymentMethod === 'credit' ? customerName : undefined
        });
    };

    const change = amountGiven && !isNaN(parseFloat(amountGiven))
        ? Math.max(0, parseFloat(amountGiven) - total)
        : 0;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-sm shadow-2xl max-w-md w-full">
                <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-900">Paiement</h2>
                    <button
                        onClick={onCancel}
                        disabled={isProcessing}
                        className="p-2 hover:bg-gray-100 rounded-sm transition-colors text-gray-600 disabled:opacity-50"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Total */}
                    <div className="bg-primary-50 p-4 rounded-sm">
                        <p className="text-sm text-gray-600">Montant total</p>
                        <p className="text-3xl font-bold text-primary-600">{formatPrice(total)}</p>
                    </div>


                    {/* Payment Method - Only show if not pre-selected */}
                    {!preSelectedMethod && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-3">
                                Mode de paiement
                            </label>
                            <div className="grid grid-cols-3 gap-3">
                                <button
                                    onClick={() => handleMethodSelect('cash')}
                                    className={`flex flex-col items-center gap-2 p-4 border-2 rounded-sm transition-all ${paymentMethod === 'cash'
                                        ? 'border-green-500 bg-green-50 text-green-700'
                                        : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                >
                                    <Banknote className="w-8 h-8" />
                                    <span className="font-medium">Espèces</span>
                                </button>
                                <button
                                    onClick={() => handleMethodSelect('card')}
                                    className={`flex flex-col items-center gap-2 p-4 border-2 rounded-sm transition-all ${paymentMethod === 'card'
                                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                                        : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                >
                                    <CreditCard className="w-8 h-8" />
                                    <span className="font-medium">Carte</span>
                                </button>
                                <button
                                    onClick={() => handleMethodSelect('credit')}
                                    className={`flex flex-col items-center gap-2 p-4 border-2 rounded-sm transition-all ${paymentMethod === 'credit'
                                        ? 'border-red-500 bg-red-50 text-red-700'
                                        : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                >
                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                                    <span className="font-medium">Crédit</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Amount Given & Customer Name */}
                    {paymentMethod && (
                        <div className="space-y-4">
                            {paymentMethod === 'credit' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Nom du Client / Débiteur
                                    </label>
                                    <input
                                        type="text"
                                        value={customerName}
                                        onChange={(e) => setCustomerName(e.target.value)}
                                        placeholder="Ex: Koffi Maçon"
                                        className="w-full px-4 py-3 border border-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-primary-500 font-medium"
                                        autoFocus
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    {paymentMethod === 'cash' ? 'Montant reçu' : (paymentMethod === 'credit' ? 'Acompte (Optionnel)' : 'Montant')}
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={amountGiven}
                                        onChange={handleAmountChange}
                                        disabled={paymentMethod === 'card'}
                                        placeholder="0.00"
                                        className="w-full px-4 py-3 border border-gray-300 rounded-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-lg font-medium disabled:bg-gray-100"
                                        autoFocus={paymentMethod === 'cash'}
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                                        FCFA
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Change */}
                    {paymentMethod === 'cash' && amountGiven && change > 0 && (
                        <div className="bg-yellow-50 p-4 rounded-sm border border-yellow-200">
                            <p className="text-sm text-gray-600">Monnaie à rendre</p>
                            <p className="text-2xl font-bold text-yellow-700">{formatPrice(change)}</p>
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-sm text-sm">
                            {error}
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-gray-200 flex gap-3">
                    <button
                        onClick={onCancel}
                        disabled={isProcessing}
                        className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-3 rounded-sm font-medium transition-colors disabled:opacity-50"
                    >
                        Annuler
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={isProcessing}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-sm font-medium transition-colors text-lg flex justify-center items-center gap-2 disabled:opacity-50"
                    >
                        {isProcessing ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            "💳 Payer"
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PaymentModal;
