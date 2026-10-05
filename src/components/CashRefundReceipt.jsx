import React, { useRef, useState } from 'react';
import { X, Printer, Banknote, CheckCircle2, Ticket, ShieldCheck } from 'lucide-react';
import QRCode from 'react-qr-code';
import { formatPrice } from '../utils/currency';
import { useSettings } from '../context/SettingsContext';
import { Barcode } from '../utils/barcodeGenerator';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const CashRefundReceipt = ({ refundData, onClose }) => {
    const receiptRef = useRef();
    const [formatMode, setFormatMode] = useState('thermal'); // 'thermal' | 'a4'
    const { company, stores, currentStoreId } = useSettings();

    if (!refundData) return null;

    const {
        receiptCode,
        refundedAmount,
        remainingBalance,
        creditNote,
        cashierName,
        recipientName,
        motif,
        date = new Date()
    } = refundData;

    const activeStore = stores?.find(s => s.id === (creditNote?.storeId || currentStoreId)) || stores?.[0];
    const companyName = company?.name && company.name !== 'Quincaillerie La Prospérité' && company.name !== 'Mon Entreprise'
        ? company.name
        : (activeStore?.name || company?.name || 'Quincaillerie & Matériaux');
    const companyAddress = company?.address || activeStore?.address || 'Lomé, Togo';
    const companyPhone = company?.phone || activeStore?.phone || '+228 90 00 00 00';
    const companyNif = company?.nif || '';

    const isReliquat = creditNote?.type === 'change_reliquat';
    const initialAvailable = (parseFloat(refundedAmount) || 0) + (parseFloat(remainingBalance) || 0);
    const refundDate = date ? new Date(date) : new Date();

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[110] p-4 print:p-0 print:bg-white print:static animate-in fade-in duration-150">
            <div className={`bg-white rounded-[4px] shadow-2xl border-2 border-[#001d35] flex flex-col max-h-[92vh] w-full transition-all duration-200 print:shadow-none print:max-h-none print:w-full print:border-none ${
                formatMode === 'a4' ? 'max-w-3xl' : 'max-w-md'
            }`}>
                {/* Modal Toolbar (hidden on print) */}
                <div className="bg-[#001d35] text-white px-4 py-3 flex justify-between items-center border-b-2 border-[#f77500] print:hidden shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center shrink-0">
                            <Banknote className="w-4 h-4 text-[#f77500]" />
                        </div>
                        <div>
                            <h2 className="text-xs font-semibold uppercase tracking-wider text-white flex items-center gap-1.5">
                                <span>Reçu Décharge Remboursement Espèces</span>
                                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] px-1.5 py-0.2 rounded font-semibold">
                                    Validé
                                </span>
                            </h2>
                            <p className="text-[10px] text-gray-300 font-normal">
                                Réf. <span className="font-semibold text-white">{receiptCode}</span> &bull; Avoir {creditNote?.code}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Format selector */}
                        <div className="flex bg-white/10 p-0.5 rounded-[4px] text-xs font-medium border border-white/20">
                            <button
                                onClick={() => setFormatMode('thermal')}
                                className={`px-2.5 py-1 rounded-[4px] transition-colors cursor-pointer text-[10px] font-semibold uppercase tracking-wider ${
                                    formatMode === 'thermal' ? 'bg-[#f77500] text-white shadow-xs' : 'text-gray-300 hover:text-white'
                                }`}
                            >
                                Ticket 80mm
                            </button>
                            <button
                                onClick={() => setFormatMode('a4')}
                                className={`px-2.5 py-1 rounded-[4px] transition-colors cursor-pointer text-[10px] font-semibold uppercase tracking-wider ${
                                    formatMode === 'a4' ? 'bg-[#f77500] text-white shadow-xs' : 'text-gray-300 hover:text-white'
                                }`}
                            >
                                Document A4
                            </button>
                        </div>

                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-[4px] text-xs font-semibold uppercase tracking-wider transition-all border border-white/20 cursor-pointer active:scale-95"
                        >
                            <Printer className="w-3.5 h-3.5 text-[#f77500]" />
                            <span>Imprimer</span>
                        </button>

                        <button
                            onClick={onClose}
                            className="text-gray-300 hover:text-white p-1 rounded-[4px] transition-colors cursor-pointer"
                            title="Fermer"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Printable Content Area */}
                <div ref={receiptRef} className="overflow-y-auto p-6 flex-1 print:p-0 print:overflow-visible font-sans">
                    {formatMode === 'thermal' ? (
                        /* ── FORMAT TICKET THERMIQUE 80MM ── */
                        <div className="w-[80mm] mx-auto text-gray-900 text-xs font-mono leading-tight bg-white p-2">
                            {/* Header */}
                            <div className="text-center pb-2 border-b border-dashed border-gray-400">
                                <h1 className="text-sm font-bold tracking-tight uppercase">{companyName}</h1>
                                {activeStore?.name && activeStore.name !== companyName && (
                                    <p className="text-[10px] text-gray-700 font-semibold">{activeStore.name}</p>
                                )}
                                <p className="text-[10px] text-gray-600">{companyAddress}</p>
                                <p className="text-[10px] text-gray-600">Tél : {companyPhone}</p>
                                {companyNif && <p className="text-[9px] text-gray-500">NIF : {companyNif}</p>}
                            </div>

                            {/* Titre Document */}
                            <div className="text-center py-2 border-b border-dashed border-gray-400">
                                <p className="font-extrabold text-[12px] uppercase tracking-wide">DÉCHARGE REMBOURSEMENT ESPÈCES</p>
                                <p className="text-[10px] font-bold text-gray-600">Réf : {receiptCode}</p>
                                <p className="text-[9px] text-gray-500">{format(refundDate, 'dd/MM/yyyy HH:mm', { locale: fr })}</p>
                            </div>

                            {/* Détails Avoir */}
                            <div className="py-2 text-[10px] space-y-1 border-b border-dashed border-gray-400">
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Bon d'Avoir :</span>
                                    <span className="font-bold">{creditNote?.code || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Type :</span>
                                    <span className="font-semibold">{isReliquat ? 'Reliquat de Monnaie' : "Avoir sur Retour"}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Bénéficiaire :</span>
                                    <span className="font-bold">{recipientName || creditNote?.customerName || 'Client'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Caissier :</span>
                                    <span className="font-semibold">{cashierName || 'Caissier'}</span>
                                </div>
                                {motif && (
                                    <div className="pt-1 text-[9px] text-gray-600 italic">
                                        Motif : {motif}
                                    </div>
                                )}
                            </div>

                            {/* Montant Remboursé */}
                            <div className="py-3 border-b-2 border-black space-y-1.5 text-center">
                                <div className="text-[10px] uppercase font-bold text-gray-600">Montant Décaissé en Espèces</div>
                                <div className="text-xl font-black tracking-tight text-emerald-800">
                                    {formatPrice(refundedAmount)}
                                </div>
                                <div className="text-[9px] text-gray-600">
                                    Solde initial : {formatPrice(initialAvailable)}
                                </div>
                                <div className="text-[10px] font-bold">
                                    Solde restant sur bon : {formatPrice(remainingBalance)}
                                </div>
                                <div className="text-[9px] uppercase font-bold text-gray-500">
                                    Statut : {remainingBalance <= 0 ? 'BON TOTALEMENT CLÔTURÉ' : 'BON PARTIELLEMENT UTILISÉ'}
                                </div>
                            </div>

                            {/* Barcode & Signature */}
                            <div className="pt-3 text-center space-y-3">
                                <div className="flex justify-center">
                                    <Barcode value={receiptCode} width={1.4} height={32} fontSize={9} />
                                </div>

                                <div className="text-[8px] text-gray-600 italic px-2">
                                    « Le client reconnaît avoir reçu l'intégralité du montant en espèces ci-dessus. »
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-[9px] pt-2 border-t border-dashed border-gray-400">
                                    <div className="text-center">
                                        <p className="font-bold">Pour Acquit (Client) :</p>
                                        <div className="h-8"></div>
                                    </div>
                                    <div className="text-center">
                                        <p className="font-bold">Le Caissier :</p>
                                        <div className="h-8"></div>
                                    </div>
                                </div>

                                <p className="text-[8px] text-gray-400 pt-1">
                                    Document généré le {format(new Date(), 'dd/MM/yyyy HH:mm')} • Système Kabllix ERP
                                </p>
                            </div>
                        </div>
                    ) : (
                        /* ── FORMAT DOCUMENT A4 ── */
                        <div className="w-full max-w-2xl mx-auto bg-white p-8 text-gray-800 leading-normal border border-gray-200 rounded-[4px] shadow-xs print:border-none print:shadow-none print:p-0">
                            {/* Header Entreprise */}
                            <div className="flex justify-between items-start pb-5 border-b-2 border-[#001d35]">
                                <div>
                                    <h1 className="text-xl font-black text-[#001d35] tracking-tight uppercase">{companyName}</h1>
                                    {activeStore?.name && activeStore.name !== companyName && (
                                        <p className="text-xs font-semibold text-gray-700">{activeStore.name}</p>
                                    )}
                                    <p className="text-xs text-gray-600 mt-1">{companyAddress}</p>
                                    <p className="text-xs text-gray-600">Tél : {companyPhone}</p>
                                    {companyNif && <p className="text-xs text-gray-500">NIF : {companyNif}</p>}
                                </div>
                                <div className="text-right">
                                    <div className="inline-block bg-emerald-50 border-2 border-emerald-600 text-emerald-800 px-3 py-1.5 rounded-[4px] text-xs font-bold uppercase tracking-wider mb-2">
                                        Décharge Remboursement Espèces
                                    </div>
                                    <p className="text-xs font-bold text-gray-700">Réf : <span className="font-mono text-[#001d35]">{receiptCode}</span></p>
                                    <p className="text-xs text-gray-500">Date : {format(refundDate, 'dd MMMM yyyy à HH:mm', { locale: fr })}</p>
                                </div>
                            </div>

                            {/* Bloc Informations Bénéficiaire & Bon */}
                            <div className="grid grid-cols-2 gap-4 my-5 bg-gray-50 p-4 rounded-[4px] border border-gray-200">
                                <div className="space-y-1.5 text-xs">
                                    <h3 className="font-bold text-[#001d35] uppercase text-[11px] tracking-wide border-b border-gray-200 pb-1">
                                        Bénéficiaire des Fonds
                                    </h3>
                                    <p className="font-bold text-gray-900 text-sm">{recipientName || creditNote?.customerName || 'Client Comptoir'}</p>
                                    {creditNote?.siteName && <p className="text-gray-600">Chantier : {creditNote.siteName}</p>}
                                    <p className="text-gray-600">Mode : Remise immédiate d'espèces en caisse</p>
                                </div>
                                <div className="space-y-1.5 text-xs">
                                    <h3 className="font-bold text-[#001d35] uppercase text-[11px] tracking-wide border-b border-gray-200 pb-1">
                                        Avoir d'Origine
                                    </h3>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Code Bon :</span>
                                        <span className="font-mono font-bold text-[#001d35]">{creditNote?.code || 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Type :</span>
                                        <span className="font-semibold">{isReliquat ? 'Reliquat Monnaie' : "Bon d'Avoir"}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Caissier Décaissant :</span>
                                        <span className="font-semibold text-gray-900">{cashierName || 'Caissier'}</span>
                                    </div>
                                </div>
                            </div>

                            {motif && (
                                <div className="mb-5 p-3 bg-amber-50/60 border border-amber-200 rounded-[4px] text-xs text-gray-700">
                                    <span className="font-bold text-amber-900">Motif du remboursement : </span>
                                    {motif}
                                </div>
                            )}

                            {/* Récapitulatif Financier */}
                            <div className="border border-gray-300 rounded-[4px] overflow-hidden mb-6">
                                <table className="w-full text-xs">
                                    <thead className="bg-[#001d35] text-white font-bold uppercase text-[10px]">
                                        <tr>
                                            <th className="py-2.5 px-3 text-left">Désignation de l'Opération</th>
                                            <th className="py-2.5 px-3 text-right">Montant Initial</th>
                                            <th className="py-2.5 px-3 text-right">Montant Remboursé</th>
                                            <th className="py-2.5 px-3 text-right">Solde Restant</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 font-medium">
                                        <tr className="bg-white">
                                            <td className="py-3 px-3">
                                                <p className="font-bold text-gray-900">Remboursement Espèces du Bon {creditNote?.code}</p>
                                                <p className="text-[10px] text-gray-500">Sortie de caisse certifiée Kabllix ERP</p>
                                            </td>
                                            <td className="py-3 px-3 text-right text-gray-700">{formatPrice(initialAvailable)}</td>
                                            <td className="py-3 px-3 text-right font-bold text-emerald-700 text-sm">{formatPrice(refundedAmount)}</td>
                                            <td className="py-3 px-3 text-right font-bold text-[#001d35]">{formatPrice(remainingBalance)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Total Box */}
                            <div className="flex justify-end mb-6">
                                <div className="w-72 bg-emerald-50 border-2 border-emerald-600 rounded-[4px] p-3 text-right">
                                    <span className="text-[10px] font-bold text-emerald-900 uppercase block tracking-wider">
                                        Total Espèces Payé au Client
                                    </span>
                                    <span className="text-2xl font-black text-emerald-800 tracking-tight block">
                                        {formatPrice(refundedAmount)}
                                    </span>
                                    <span className="text-[10px] font-semibold text-emerald-700 block mt-0.5">
                                        {remainingBalance <= 0 ? '✓ Solde du bon intégralement soldé' : `Reliquat restant sur le bon : ${formatPrice(remainingBalance)}`}
                                    </span>
                                </div>
                            </div>

                            {/* Mention d'engagement et Décharge */}
                            <div className="bg-gray-50 border border-gray-200 rounded-[4px] p-3 text-[11px] text-gray-700 italic mb-8">
                                Je soussigné(e) <strong>{recipientName || creditNote?.customerName || 'le client'}</strong>, atteste et certifie avoir reçu en espèces de la caisse la somme de <strong>{formatPrice(refundedAmount)}</strong> à titre de remboursement total ou partiel du bon référencé ci-dessus, et dégage l'établissement de toute réclamation ultérieure relative à ce montant.
                            </div>

                            {/* Signatures */}
                            <div className="grid grid-cols-2 gap-8 pt-4 border-t-2 border-dashed border-gray-300">
                                <div className="text-center space-y-1">
                                    <p className="text-xs font-bold text-gray-900 uppercase">Le Bénéficiaire</p>
                                    <p className="text-[10px] text-gray-500 italic">Mention manuscrite « Pour acquit » + Signature</p>
                                    <div className="h-16 border-b border-gray-300"></div>
                                </div>
                                <div className="text-center space-y-1">
                                    <p className="text-xs font-bold text-[#001d35] uppercase">Le Caissier / Responsable</p>
                                    <p className="text-[10px] text-gray-500 italic">Cachet & Signature de la caisse</p>
                                    <div className="h-16 border-b border-gray-300"></div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="mt-8 pt-3 border-t border-gray-200 flex justify-between items-center text-[10px] text-gray-400">
                                <span>Kabllix ERP • Décharge officielle de remboursement</span>
                                <span>Généré le {format(new Date(), 'dd/MM/yyyy à HH:mm')}</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CashRefundReceipt;
