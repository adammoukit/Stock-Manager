import React from 'react';
import { X, Printer, FileText, PackageOpen, Receipt as ReceiptIcon } from 'lucide-react';
import { formatPrice } from '../utils/currency';

const OPTIONS = [
    {
        id: 'thermal',
        icon: ReceiptIcon,
        label: 'Reçu Thermique',
        sublabel: 'Format 80mm',
        description: 'Ticket caisse standard pour imprimante thermique.',
        accent: '#018f8f',
        bg: '#f0fdfa',
        border: '#99f6e4',
    },
    {
        id: 'a4-invoice',
        icon: FileText,
        label: 'Facture de Vente',
        sublabel: 'Format A4',
        description: 'Facture professionnelle avec tous les détails de paiement.',
        accent: '#2563eb',
        bg: '#eff6ff',
        border: '#bfdbfe',
    },
    {
        id: 'a4-delivery',
        icon: PackageOpen,
        label: 'Bon à Enlever',
        sublabel: 'Format A4',
        description: 'Bon de livraison sans prix, avec zones de signature.',
        accent: '#d97706',
        bg: '#fffbeb',
        border: '#fde68a',
    },
];

const PrintOptionsDialog = ({ transaction, onSelect, onClose }) => {
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div
                className="bg-white rounded-sm shadow-2xl w-full max-w-lg overflow-hidden"
                style={{ animation: 'pop-in 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-sm flex items-center justify-center" style={{ backgroundColor: '#018f8f1a' }}>
                            <Printer className="w-5 h-5" style={{ color: '#018f8f' }} />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-gray-900">Format d'impression</h2>
                            <p className="text-xs text-gray-400">Choisissez le document à générer</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-gray-100 rounded-sm transition-colors text-gray-400 hover:text-gray-600"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Transaction summary */}
                <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 flex justify-between items-center text-xs text-gray-500">
                    <span>Transaction <span className="font-mono font-bold text-gray-700">#{transaction?.id}</span></span>
                    <span className="font-semibold text-gray-700">
                        {formatPrice(transaction?.total)}
                    </span>
                </div>

                {/* Option cards */}
                <div className="p-5 space-y-3">
                    {OPTIONS.map((opt) => {
                        const Icon = opt.icon;
                        return (
                            <button
                                key={opt.id}
                                onClick={() => onSelect(opt.id)}
                                className="w-full flex items-center gap-4 p-4 rounded-sm border-2 text-left transition-all group hover:shadow-md"
                                style={{
                                    backgroundColor: opt.bg,
                                    borderColor: opt.border,
                                }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.borderColor = opt.accent;
                                    e.currentTarget.style.transform = 'translateY(-1px)';
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.borderColor = opt.border;
                                    e.currentTarget.style.transform = 'translateY(0)';
                                }}
                            >
                                {/* Icon */}
                                <div
                                    className="w-12 h-12 rounded-sm flex items-center justify-center flex-shrink-0 shadow-sm"
                                    style={{ backgroundColor: opt.accent }}
                                >
                                    <Icon className="w-6 h-6 text-white" />
                                </div>

                                {/* Text */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline gap-2">
                                        <span className="font-bold text-gray-900">{opt.label}</span>
                                        <span
                                            className="text-xs font-semibold px-2 py-0.5 rounded-full"
                                            style={{ backgroundColor: opt.accent + '20', color: opt.accent }}
                                        >
                                            {opt.sublabel}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{opt.description}</p>
                                </div>

                                {/* Arrow */}
                                <svg
                                    className="w-5 h-5 flex-shrink-0 transition-transform group-hover:translate-x-1"
                                    style={{ color: opt.accent }}
                                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="px-6 pb-5 pt-1">
                    <button
                        onClick={onClose}
                        className="w-full py-2.5 rounded-sm border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors"
                    >
                        Fermer sans imprimer
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes pop-in {
                    from { opacity: 0; transform: scale(0.92) translateY(8px); }
                    to   { opacity: 1; transform: scale(1)   translateY(0); }
                }
            `}</style>
        </div>
    );
};

export default PrintOptionsDialog;
