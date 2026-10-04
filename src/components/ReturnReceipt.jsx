import React, { useRef, useState } from 'react';
import { X, Printer, RotateCcw, CheckCircle2, AlertTriangle, Ticket } from 'lucide-react';
import QRCode from 'react-qr-code';
import { formatPrice } from '../utils/currency';
import { useSettings } from '../context/SettingsContext';
import { Barcode } from '../utils/barcodeGenerator';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const ReturnReceipt = ({ returnRecord, creditNote, onClose }) => {
    const receiptRef = useRef();
    const [formatMode, setFormatMode] = useState('thermal'); // 'thermal' | 'a4'
    const { company, stores, currentStoreId } = useSettings();

    const returnDate = returnRecord?.date ? new Date(returnRecord.date) : new Date(0);
    const expiryDate = creditNote?.expiresAt
        ? new Date(creditNote.expiresAt)
        : (returnRecord?.date ? new Date(new Date(returnRecord.date).getTime() + 60 * 24 * 60 * 60 * 1000) : new Date(0));

    if (!returnRecord) return null;

    const activeStore = stores?.find(s => s.id === (returnRecord.storeId || currentStoreId)) || stores?.[0];
    const companyName = company?.name && company.name !== 'Quincaillerie La Prospérité' && company.name !== 'Mon Entreprise'
        ? company.name
        : (activeStore?.name || company?.name || 'Quincaillerie & Matériaux');
    const companyAddress = company?.address || activeStore?.address || 'Lomé, Togo';
    const companyPhone = company?.phone || activeStore?.phone || '+228 90 00 00 00';
    const companyNif = company?.nif || '';

    const isReliquat = creditNote?.type === 'change_reliquat' || returnRecord?.refundMethod === 'change_reliquat' || returnRecord?.type === 'change_reliquat';
    const isAvoir = returnRecord.refundMethod === 'avoir' || isReliquat;
    const isCash = returnRecord.refundMethod === 'cash';
    const isDebt = returnRecord.refundMethod === 'debt_deduction';
    const voucherCode = returnRecord.voucherCode || creditNote?.code || 'N/A';

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 print:p-0 print:bg-white print:static">
            <div className={`bg-white rounded-[4px] shadow-2xl border-t-4 border-[#001d35] border-x-2 border-b-2 border-gray-300 flex flex-col max-h-[92vh] w-full transition-all duration-200 print:shadow-none print:max-h-none print:w-full print:border-none ${
                formatMode === 'a4' ? 'max-w-3xl' : 'max-w-md'
            }`}>
                {/* Modal Toolbar (hidden on print) */}
                <div className="p-3.5 border-b-2 border-gray-300 flex justify-between items-center bg-gray-50 print:hidden flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <span className="p-1.5 bg-[#001d35] text-white rounded-[4px]">
                            <RotateCcw className="w-4 h-4 text-[#f77500]" />
                        </span>
                        <div>
                            <h2 className="text-xs font-bold text-[#001d35] uppercase tracking-wide">
                                {isReliquat ? "Bon de Reliquat (Avoir de Monnaie)" : isAvoir ? "Bon d'Avoir Client" : isCash ? 'Remboursement Espèces' : 'Avoir sur Créance'}
                            </h2>
                            <p className="text-[10px] text-gray-500 font-bold tracking-tight">{isReliquat ? (creditNote?.code || voucherCode) : returnRecord.returnNumber}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Format selector */}
                        <div className="flex bg-gray-200 p-0.5 rounded-[4px] text-xs font-medium border border-gray-300">
                            <button
                                onClick={() => setFormatMode('thermal')}
                                className={`px-2.5 py-1 rounded-[4px] transition-colors cursor-pointer text-[11px] font-bold uppercase tracking-wider ${
                                    formatMode === 'thermal' ? 'bg-[#001d35] text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                Ticket 80mm
                            </button>
                            <button
                                onClick={() => setFormatMode('a4')}
                                className={`px-2.5 py-1 rounded-[4px] transition-colors cursor-pointer text-[11px] font-bold uppercase tracking-wider ${
                                    formatMode === 'a4' ? 'bg-[#001d35] text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                Document A4
                            </button>
                        </div>

                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-1.5 bg-[#001d35] hover:bg-[#00284a] text-white px-3.5 py-1.5 rounded-[4px] text-xs font-bold uppercase tracking-wider transition-all shadow-sm cursor-pointer active:scale-95"
                        >
                            <Printer className="w-3.5 h-3.5 text-[#f77500]" />
                            <span>Imprimer</span>
                        </button>

                        <button
                            onClick={onClose}
                            className="p-1.5 hover:bg-gray-200 rounded-[4px] text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Printable Content Area */}
                <div ref={receiptRef} className="overflow-y-auto p-6 flex-1 print:p-0 print:overflow-visible font-sans">
                    {formatMode === 'thermal' ? (
                        /* ── FORMAT TICKET THERMIQUE 80MM ── */
                        <div className="max-w-[320px] mx-auto text-gray-900 font-sans text-xs leading-tight bg-white">
                            {/* En-tête magasin */}
                            <div className="text-center border-b border-dashed border-gray-400 pb-3 mb-3">
                                <h1 className="text-base font-black uppercase tracking-tight">{companyName}</h1>
                                {companyAddress && <p className="text-[11px] mt-0.5">{companyAddress}</p>}
                                {companyPhone && <p className="text-[11px]">Tél : {companyPhone}</p>}
                                {companyNif && <p className="text-[10px] text-gray-600">NIF : {companyNif}</p>}
                            </div>

                            {/* Titre du Bon */}
                            <div className="text-center bg-gray-100 py-2 px-1 rounded-[4px] border-2 border-gray-300 mb-3">
                                <p className="text-[10px] uppercase font-bold text-gray-600">
                                    {isReliquat ? "AVOIR DE MONNAIE NON RENDUE" : isAvoir ? "DOCUMENT OFFICIEL D'AVOIR" : isCash ? "JUSTIFICATIF SORTIE CAISSE" : "AVOIR SUR COMPTE CLIENT"}
                                </p>
                                <p className="text-sm font-black tracking-wide text-gray-900 mt-0.5">
                                    {isReliquat ? "BON DE RELIQUAT DE MONNAIE" : isAvoir ? "BON D'AVOIR" : isCash ? "REÇU REMBOURSEMENT" : "DÉDUCTION CRÉANCE"}
                                </p>
                                <p className="text-[11px] font-bold mt-0.5 text-[#001d35] tracking-tight">
                                    N° {isReliquat ? voucherCode : returnRecord.returnNumber}
                                </p>
                            </div>

                            {/* Code de l'Avoir (Si bon d'avoir) */}
                            {isAvoir && (
                                <div className="text-center p-2.5 my-2 border-2 border-dashed border-gray-800 rounded-[4px] bg-amber-50/50">
                                    <p className="text-[10px] uppercase tracking-wider font-bold text-gray-700">Code Bon d'Avoir à présenter</p>
                                    <p className="text-lg font-black tracking-widest text-[#001d35] my-1">{voucherCode}</p>
                                    <div className="flex justify-center my-1">
                                        <Barcode value={voucherCode} width={1.4} height={36} displayValue={false} />
                                    </div>
                                    <p className="text-[10px] text-gray-600">Valable 60 jours au comptoir de vente</p>
                                </div>
                            )}

                            {/* Détails du retour */}
                            <div className="space-y-1 text-[11px] border-b border-dashed border-gray-400 pb-2 mb-2">
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Date :</span>
                                    <span className="font-bold">{format(returnDate, 'dd/MM/yyyy HH:mm')}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Client :</span>
                                    <span className="font-bold text-right truncate max-w-[170px]">{returnRecord.customerName || 'Client Comptoir'}</span>
                                </div>
                                {returnRecord.transactionNumber && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Ticket d'Origine :</span>
                                        <span className="font-bold tracking-tight">{returnRecord.transactionNumber}</span>
                                    </div>
                                )}
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Caissier :</span>
                                    <span>{returnRecord.cashierName || 'Caisse'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Motif :</span>
                                    <span className="italic truncate max-w-[170px]">{returnRecord.reason || (isReliquat ? 'Monnaie indisponible' : 'Surplus')}</span>
                                </div>
                            </div>

                            {/* Section Articles ou Origine Reliquat */}
                            {isReliquat ? (
                                <div className="border-b border-dashed border-gray-400 pb-2 mb-2">
                                    <div className="bg-amber-50/70 p-2.5 rounded-[4px] border border-amber-200 text-left space-y-1">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1">
                                            <Ticket className="w-3.5 h-3.5 text-amber-700" />
                                            <span>Origine de l'Avoir</span>
                                        </p>
                                        <p className="text-[11px] text-gray-800 font-medium">
                                            Insuffisance de monnaie exacte en caisse lors du règlement d'un achat.
                                        </p>
                                        {creditNote?.notes && (
                                            <p className="text-[10px] text-gray-500 italic mt-0.5">{creditNote.notes}</p>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="border-b border-dashed border-gray-400 pb-2 mb-2">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Articles Retournés</p>
                                    <div className="space-y-1.5">
                                        {returnRecord.items?.map((item, idx) => (
                                            <div key={idx} className="flex justify-between items-start text-[11px]">
                                                 <div className="flex-1 pr-2">
                                                    <p className="font-bold">{item.name}</p>
                                                    <div className="flex items-center gap-1.5 text-[10px] text-gray-600">
                                                        <span>{item.quantityReturned || item.quantity} {item.unit || 'U.'} x {formatPrice(item.unitPrice || item.price)}</span>
                                                        <span className={`px-1.5 py-0.5 rounded-[4px] font-bold uppercase tracking-wider text-[9px] ${
                                                            item.condition === 'intact' || item.reintegrated
                                                                ? 'bg-emerald-100 text-emerald-800'
                                                                : 'bg-rose-100 text-rose-800'
                                                        }`}>
                                                            {item.condition === 'intact' || item.reintegrated ? 'En stock' : 'Avarié'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <span className="font-bold text-right tracking-tight">{formatPrice(item.totalRefund || ((item.quantityReturned || item.quantity) * (item.unitPrice || item.price)))}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Montant Total Remboursé */}
                            <div className="py-2 border-b border-dashed border-gray-400 mb-3">
                                <div className="flex justify-between items-baseline text-sm font-black">
                                    <span className="uppercase">Total Remboursé :</span>
                                    <span className="text-base text-gray-900 font-bold tracking-tight">{formatPrice(returnRecord.totalAmount)}</span>
                                </div>
                                <div className="flex justify-between items-center text-[10px] text-gray-600 mt-1">
                                    <span>Mode de règlement :</span>
                                    <span className="font-bold uppercase tracking-wider">
                                        {isAvoir ? "Bon d'Avoir (Crédit Magasin)" : isCash ? 'Espèces (Sortie Caisse)' : 'Déduction Dette'}
                                    </span>
                                </div>
                            </div>

                            {/* Mentions légales & Signature */}
                            <div className="text-[10px] text-gray-500 text-center space-y-2 mt-3">
                                {isAvoir ? (
                                    <p className="italic">
                                        Ce bon d'avoir est déductible sur vos prochains achats au comptoir. Conservez précieusement ce ticket.
                                    </p>
                                ) : (
                                    <p className="italic">
                                        Somme perçue en espèces à la caisse du magasin. Émargement client requis ci-dessous.
                                    </p>
                                )}

                                <div className="pt-4 grid grid-cols-2 gap-4 text-center border-t border-gray-200 mt-3">
                                    <div>
                                        <p className="font-bold uppercase tracking-wider text-gray-700 text-[10px]">Signature Caissier</p>
                                        <div className="h-10 border-b border-gray-300"></div>
                                    </div>
                                    <div>
                                        <p className="font-bold uppercase tracking-wider text-gray-700 text-[10px]">Signature Client</p>
                                        <div className="h-10 border-b border-gray-300"></div>
                                    </div>
                                </div>

                                <p className="text-[9px] text-gray-400 pt-2 font-medium">Merci pour votre confiance !</p>
                            </div>
                        </div>
                    ) : (
                        /* ── FORMAT DOCUMENT OFFICIEL A4 ── */
                        <div className="text-gray-800 text-xs leading-relaxed bg-white p-6 border-2 border-gray-300 rounded-[4px]">
                            {/* En-tête A4 */}
                            <div className="flex justify-between items-start border-b-2 border-[#001d35] pb-5 mb-5">
                                <div>
                                    <h1 className="text-xl font-black uppercase text-[#001d35] tracking-tight">{companyName}</h1>
                                    <p className="text-xs text-gray-600 mt-1 font-medium">{companyAddress}</p>
                                    <p className="text-xs text-gray-600">Tél : {companyPhone}</p>
                                    {companyNif && <p className="text-xs text-gray-600 font-medium">NIF : {companyNif}</p>}
                                </div>

                                <div className="text-right">
                                    <div className={`inline-block text-white px-4 py-1.5 rounded-[4px] font-bold text-sm uppercase tracking-wide ${isReliquat ? 'bg-amber-600' : 'bg-[#001d35]'}`}>
                                        {isReliquat ? "BON DE RELIQUAT (AVOIR)" : isAvoir ? "BON D'AVOIR" : isCash ? "REÇU DE REMBOURSEMENT" : "AVOIR SUR CRÉANCE"}
                                    </div>
                                    <p className="text-xs font-bold text-gray-700 mt-2 tracking-tight">N° {isReliquat ? voucherCode : returnRecord.returnNumber}</p>
                                    <p className="text-xs text-gray-500">Date : {format(returnDate, 'dd MMMM yyyy HH:mm', { locale: fr })}</p>
                                </div>
                            </div>

                            {/* Client & Infos Vente */}
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="bg-gray-50 p-3.5 rounded-[4px] border-2 border-gray-200">
                                    <p className="text-[10px] uppercase font-bold text-gray-500 mb-1 tracking-wider">Bénéficiaire / Client</p>
                                    <p className="text-sm font-bold text-gray-900">{returnRecord.customerName || 'Client Inconnu'}</p>
                                    {returnRecord.siteName && (
                                        <p className="text-xs text-gray-600 mt-0.5">Chantier : <strong className="text-gray-800">{returnRecord.siteName}</strong></p>
                                    )}
                                    {returnRecord.clientId && (
                                        <p className="text-[10px] text-gray-500 font-medium mt-0.5">ID Client : {returnRecord.clientId}</p>
                                    )}
                                </div>

                                <div className="bg-gray-50 p-3.5 rounded-[4px] border-2 border-gray-200">
                                    <p className="text-[10px] uppercase font-bold text-gray-500 mb-1 tracking-wider">Références {isReliquat ? "du Reliquat" : "du Retour"}</p>
                                    {returnRecord.transactionNumber ? (
                                        <p className="text-xs text-gray-700">Vente d'origine : <strong className="font-bold">{returnRecord.transactionNumber}</strong></p>
                                    ) : (
                                        <p className="text-xs text-gray-500 italic">Paiement au comptoir</p>
                                    )}
                                    <p className="text-xs text-gray-700 mt-1">Motif déclaré : <strong className="text-gray-900">{returnRecord.reason || (isReliquat ? 'Monnaie indisponible en caisse' : 'Surplus de chantier')}</strong></p>
                                    <p className="text-xs text-gray-700 mt-0.5">Opérateur de caisse : <span className="font-semibold">{returnRecord.cashierName || 'Caisse'}</span></p>
                                </div>
                            </div>

                            {/* Bannière Bon d'Avoir */}
                            {isAvoir && (
                                <div className="flex items-center justify-between p-4 mb-6 bg-blue-50/70 border-2 border-blue-200 rounded-[4px]">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 bg-[#001d35] text-white rounded-[4px]">
                                            <Ticket className="w-6 h-6 text-[#f77500]" />
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-bold text-[#001d35] uppercase tracking-wider">Code de l'Avoir pour rachat au POS</p>
                                            <p className="text-xl font-black tracking-widest text-[#001d35]">{voucherCode}</p>
                                            <p className="text-[11px] text-gray-500">Valable 60 jours jusqu'au {format(expiryDate, 'dd/MM/yyyy')}</p>
                                        </div>
                                    </div>
                                    <div className="bg-white p-2 border-2 border-gray-200 rounded-[4px]">
                                        <QRCode value={voucherCode} size={64} />
                                    </div>
                                </div>
                            )}

                            {/* Section Articles retournés ou Origine Reliquat */}
                            {isReliquat ? (
                                <div className="mb-6 p-4 bg-amber-50/80 border-2 border-amber-200 rounded-[4px]">
                                    <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase tracking-wider mb-1">
                                        <Ticket className="w-4 h-4 text-amber-600" />
                                        <span>Origine : Reliquat de Monnaie en Caisse</span>
                                    </div>
                                    <p className="text-xs text-gray-700 leading-relaxed">
                                        Ce bon d'avoir a été généré suite à une indisponibilité temporaire de monnaie exacte en espèces lors de l'encaissement. 
                                        Le solde créditeur de <strong>{formatPrice(creditNote?.initialAmount || returnRecord.totalAmount)}</strong> est conservé au profit du client et déductible sur ses prochains achats au comptoir.
                                    </p>
                                    {creditNote?.notes && (
                                        <p className="text-xs text-gray-500 mt-2 italic border-t border-amber-200 pt-1.5">{creditNote.notes}</p>
                                    )}
                                </div>
                            ) : (
                                <div className="mb-6">
                                    <table className="w-full text-left border-collapse border-2 border-gray-300">
                                        <thead>
                                            <tr className="bg-gray-100 text-gray-700 font-bold text-[11px] uppercase tracking-wider">
                                                <th className="p-2.5 border-2 border-gray-300">Désignation de l'Article</th>
                                                <th className="p-2.5 border-2 border-gray-300 text-center">Quantité</th>
                                                <th className="p-2.5 border-2 border-gray-300 text-right">Prix Unitaire</th>
                                                <th className="p-2.5 border-2 border-gray-300 text-center">État / Traitement</th>
                                                <th className="p-2.5 border-2 border-gray-300 text-right">Total Remboursé</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {returnRecord.items?.map((item, idx) => {
                                                const qty = item.quantityReturned || item.quantity;
                                                const price = item.unitPrice || item.price;
                                                const subtotal = item.totalRefund || (qty * price);
                                                const isIntact = item.condition === 'intact' || item.reintegrated;

                                                return (
                                                    <tr key={idx} className="hover:bg-gray-50">
                                                        <td className="p-2.5 border-2 border-gray-300 font-semibold text-gray-900">
                                                            {item.name}
                                                        </td>
                                                        <td className="p-2.5 border-2 border-gray-300 text-center font-bold">
                                                            {qty} {item.unit || 'unités'}
                                                        </td>
                                                        <td className="p-2.5 border-2 border-gray-300 text-right font-semibold">
                                                            {formatPrice(price)}
                                                        </td>
                                                        <td className="p-2.5 border-2 border-gray-300 text-center">
                                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[10px] font-bold uppercase tracking-wider ${
                                                                isIntact
                                                                    ? 'bg-emerald-100 text-emerald-800'
                                                                    : 'bg-rose-100 text-rose-800'
                                                            }`}>
                                                                {isIntact ? (
                                                                    <>
                                                                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                                                        Intact (Réintégré)
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <AlertTriangle className="w-3 h-3 text-rose-600" />
                                                                        Avarié (Rebut)
                                                                    </>
                                                                )}
                                                            </span>
                                                        </td>
                                                        <td className="p-2.5 border-2 border-gray-300 text-right font-bold text-gray-900 tracking-tight">
                                                            {formatPrice(subtotal)}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                        <tfoot>
                                            <tr className="bg-gray-50 font-black text-sm">
                                                <td colSpan={4} className="p-3 border-2 border-gray-300 text-right uppercase tracking-wider text-gray-700 text-xs">
                                                    Montant Total de la Compensation :
                                                </td>
                                                <td className="p-3 border-2 border-gray-300 text-right text-base text-[#001d35] font-bold tracking-tight">
                                                    {formatPrice(returnRecord.totalAmount)}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )}

                            {/* Récapitulatif comptable */}
                            <div className="bg-gray-50 p-4 rounded-[4px] border-2 border-gray-200 mb-8 flex justify-between items-center">
                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-gray-600">Règle Financière Appliquée</p>
                                    <p className="text-xs text-gray-800 mt-0.5">
                                        {isAvoir && "Émission d'un Bon d'Avoir non périssable immédiatement réutilisable lors de futurs achats."}
                                        {isCash && "Remboursement immédiat en espèces débité de la caisse active avec traçabilité d'audit."}
                                        {isDebt && "Imputation directe et déduction sur l'encours de dette client."}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Mode de règlement</span>
                                    <span className="inline-block px-3 py-1 bg-white border-2 border-gray-300 rounded-[4px] font-bold text-xs uppercase tracking-wider text-[#001d35] mt-1 shadow-2xs">
                                        {isAvoir ? "Bon d'Avoir" : isCash ? 'Espèces' : 'Déduction Dette'}
                                    </span>
                                </div>
                            </div>

                            {/* Signatures */}
                            <div className="grid grid-cols-2 gap-10 pt-4 border-t-2 border-gray-200">
                                <div>
                                    <p className="font-bold text-gray-800 uppercase tracking-wider text-[11px]">Visa Magasin & Caisse</p>
                                    <p className="text-[10px] text-gray-500">Pour contrôle de conformité et réintégration du stock</p>
                                    <div className="h-20 border-b-2 border-gray-300 mt-2"></div>
                                </div>
                                <div>
                                    <p className="font-bold text-gray-800 uppercase tracking-wider text-[11px]">Signature du Client</p>
                                    <p className="text-[10px] text-gray-500">Bon pour accord et réception de l'avoir ou du remboursement</p>
                                    <div className="h-20 border-b-2 border-gray-300 mt-2"></div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReturnReceipt;
