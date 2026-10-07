import React, { useState, useEffect } from 'react';
import { useInventory } from '../context/InventoryContext';
import { usePurchase } from '../context/PurchaseContext';
import {
    ArrowLeft, Printer, CheckCircle, Trash2, X, Package,
    ShieldAlert, Check, Clock, AlertTriangle, AlertCircle
} from 'lucide-react';
import { formatPrice } from '../utils/currency';
import { getProductArchetype } from '../utils/smartReplenishment';
import { formatOrderNumber } from '../utils/transactionFormat';
import T from '../utils/toast';

/**
 * Fiche Réapprovisionnement Plein Écran Officielle Kabllix ERP
 * Utilisée à la fois dans l'écran "Réapprovisionnement Intelligent" et dans "Bons de commande"
 */
const ReplenishmentOrderDetailModal = ({ order, onClose, returnLabel = "Retour" }) => {
    const { products } = useInventory();
    const { orders, receiveOrder, deleteOrder, forceCompleteOrder } = usePurchase();

    // Toujours synchroniser avec la version temps réel de la commande dans le contexte
    const currentOrder = (orders || []).find(o => String(o.id) === String(order?.id)) || order;
    const formattedOrderNum = formatOrderNumber(currentOrder?.orderNumber, currentOrder?.id, currentOrder?.date);

    // Modales internes
    const [showReceiveModal, setShowReceiveModal] = useState(false);
    const [receiveData, setReceiveData] = useState({});
    const [receivedBy, setReceivedBy] = useState('');
    const [isPaidCash, setIsPaidCash] = useState(false);
    const [isReceivingLoading, setIsReceivingLoading] = useState(false);

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showForceCompleteConfirm, setShowForceCompleteConfirm] = useState(false);

    // Fermeture avec la touche Échap
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                if (showReceiveModal) {
                    setShowReceiveModal(false);
                    return;
                }
                if (showDeleteConfirm) {
                    setShowDeleteConfirm(false);
                    return;
                }
                if (showForceCompleteConfirm) {
                    setShowForceCompleteConfirm(false);
                    return;
                }
                if (onClose) onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showReceiveModal, showDeleteConfirm, showForceCompleteConfirm, onClose]);

    if (!currentOrder) return null;

    // Réception de marchandise
    const handleReceiveSubmit = async () => {
        if (!receivedBy.trim()) {
            T.warning("Veuillez entrer le nom du réceptionneur.");
            return;
        }

        const hasAnyQty = Object.values(receiveData).some(v => Number(v) > 0);
        if (!hasAnyQty) {
            T.warning("Veuillez renseigner au moins une quantité reçue.");
            return;
        }

        setIsReceivingLoading(true);
        await new Promise(r => setTimeout(r, 800));

        receiveOrder(currentOrder.id, receiveData, receivedBy, isPaidCash);
        setIsReceivingLoading(false);
        setShowReceiveModal(false);
        setReceiveData({});
        setReceivedBy('');
        setIsPaidCash(false);
        T.success("Réception enregistrée avec succès !");
    };

    // Clôture forcée par le manager
    const handleForceCompleteSubmit = async () => {
        setShowForceCompleteConfirm(false);
        forceCompleteOrder(currentOrder.id);
        T.success("Commande clôturée définitivement.");
    };

    // Suppression du bon
    const handleDeleteSubmit = async () => {
        setShowDeleteConfirm(false);
        deleteOrder(currentOrder.id);
        T.success(`Le bon de commande ${formattedOrderNum} a été supprimé.`);
        if (onClose) onClose();
    };

    const totalOrdered = (currentOrder.items || []).reduce((acc, i) => acc + (i.quantityOrdered || 0), 0);
    const totalRec = (currentOrder.items || []).reduce((acc, i) => acc + (i.quantityReceived || 0), 0);
    const percent = totalOrdered > 0 ? Math.round((totalRec / totalOrdered) * 100) : 0;
    const remainingTotal = Math.max(0, totalOrdered - totalRec);

    return (
        <div className="fixed inset-0 z-50 bg-slate-100 flex flex-col overflow-hidden animate-in fade-in duration-150">
            {/* ── BARRE SUPÉRIEURE FIXE (Charte Kabllix #001d35 & #f77500) ── */}
            <div className="bg-[#001d35] text-white px-4 py-3 border-b-2 border-[#f77500] shadow-md flex items-center justify-between shrink-0 print:hidden">
                <div className="flex items-center gap-3">
                    {/* Bouton Retour */}
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-[4px] text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border border-white/20"
                    >
                        <ArrowLeft className="w-3.5 h-3.5 text-[#f77500]" />
                        <span>{returnLabel}</span>
                    </button>

                    <div className="h-5 w-px bg-white/20 hidden sm:block"></div>

                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] uppercase tracking-wider text-gray-300 font-medium">Bon de Commande :</span>
                            <h2 className="text-sm font-semibold text-white tracking-wide">
                                {formattedOrderNum}
                            </h2>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] text-[10px] font-semibold uppercase tracking-wider border ${
                                currentOrder.status === 'Completed' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400' :
                                currentOrder.status === 'Partial' ? 'bg-amber-500/20 text-amber-300 border-amber-400' :
                                'bg-blue-500/20 text-blue-300 border-blue-400'
                            }`}>
                                {currentOrder.status === 'Completed' ? 'Entièrement Reçu' :
                                 currentOrder.status === 'Partial' ? 'Livraison Partielle' : 'Commandé (En cours)'}
                            </span>
                        </div>
                        <p className="text-[11px] text-gray-300 font-normal">
                            Fournisseur : <strong className="text-white font-semibold">{currentOrder.supplier}</strong> — Émis le {new Date(currentOrder.date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} à {new Date(currentOrder.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                    </div>
                </div>

                {/* Actions En-tête */}
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => window.print()}
                        className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-[4px] border border-white/20 flex items-center gap-1.5 transition-all cursor-pointer"
                        title="Imprimer le bon de commande"
                    >
                        <Printer className="w-3.5 h-3.5 text-[#f77500]" />
                        <span className="hidden md:inline">Imprimer le Bon</span>
                    </button>

                    {currentOrder.status !== 'Completed' && (
                        <button
                            type="button"
                            onClick={() => setShowReceiveModal(true)}
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-[4px] shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                            <CheckCircle className="w-3.5 h-3.5 text-white" />
                            <span>Réceptionner Marchandises</span>
                        </button>
                    )}

                    {/* Bouton Supprimer ce bon */}
                    <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(true)}
                        className="px-3 py-1.5 bg-rose-600/90 hover:bg-rose-600 text-white text-xs font-semibold rounded-[4px] border border-rose-400 flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                        title="Supprimer ce réapprovisionnement"
                    >
                        <Trash2 className="w-3.5 h-3.5 text-white" />
                        <span className="hidden sm:inline">Supprimer ce bon</span>
                    </button>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 text-gray-300 hover:text-white hover:bg-white/10 rounded-[4px] transition-colors cursor-pointer"
                        title="Fermer la fiche (Échap)"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* ── CORPS DE LA FICHE DÉTAILLÉE (Scrollable) ── */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 max-w-7xl w-full mx-auto print:p-0 print:overflow-visible">
                {/* 4 StatCards Synthèse du Bon */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 print:grid-cols-4">
                    {/* 1. Montant Total */}
                    <div className="bg-white p-3.5 rounded-[4px] border-2 border-gray-300 shadow-sm">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Montant Total du Bon</p>
                        <h3 className="text-xl sm:text-2xl font-semibold text-[#001d35] mt-1">
                            {formatPrice(currentOrder.totalAmount)}
                        </h3>
                        <p className="text-[11px] text-gray-500 font-medium mt-1">Facturation prévisionnelle</p>
                    </div>

                    {/* 2. Références Distinctes */}
                    <div className="bg-white p-3.5 rounded-[4px] border-2 border-gray-300 shadow-sm">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Articles Réapprovisionnés</p>
                        <h3 className="text-xl sm:text-2xl font-semibold text-blue-900 mt-1">
                            {currentOrder.items?.length || 0} référence(s)
                        </h3>
                        <p className="text-[11px] text-gray-500 font-medium mt-1">Lignes de commande uniques</p>
                    </div>

                    {/* 3. Contenants Commandés vs Reçus */}
                    <div className="bg-white p-3.5 rounded-[4px] border-2 border-gray-300 shadow-sm">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Volumes Commandés vs Reçus</p>
                        <div className="flex items-baseline gap-2 mt-1">
                            <h3 className="text-xl sm:text-2xl font-semibold text-emerald-800">{totalRec}</h3>
                            <span className="text-sm font-semibold text-gray-500">/ {totalOrdered} unités/colis</span>
                        </div>
                        <p className="text-[11px] text-gray-500 font-medium mt-1">
                            Reste à livrer : <strong className="text-amber-800">{remainingTotal}</strong>
                        </p>
                    </div>

                    {/* 4. Taux de Réalisation */}
                    <div className="bg-white p-3.5 rounded-[4px] border-2 border-gray-300 shadow-sm">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Taux de Livraison</p>
                        <div className="flex items-center justify-between mt-1">
                            <h3 className="text-xl sm:text-2xl font-semibold text-[#001d35]">{percent}%</h3>
                            <span className="text-[11px] font-semibold text-gray-600">{totalRec} sur {totalOrdered}</span>
                        </div>
                        <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden mt-2 print:hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                    percent === 100 ? 'bg-emerald-500' : percent > 0 ? 'bg-amber-500' : 'bg-blue-500'
                                }`}
                                style={{ width: `${percent}%` }}
                            ></div>
                        </div>
                    </div>
                </div>

                {/* TABLEAU DES PRODUITS RÉAPPROVISIONNÉS */}
                <div className="bg-white rounded-[4px] border-2 border-gray-300 shadow-sm overflow-hidden">
                    <div className="p-3 bg-slate-50 border-b-2 border-gray-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-[#001d35]" />
                            <h4 className="text-xs font-semibold text-[#001d35] uppercase tracking-wider">
                                Fiche Détaillée des Produits Réapprovisionnés
                            </h4>
                        </div>
                        <div className="text-xs text-gray-600 font-medium">
                            Partenaire : <strong className="text-gray-900 font-semibold">{currentOrder.supplier}</strong>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-[#001d35] text-white font-semibold uppercase tracking-wider text-[10px] divide-x divide-white/20">
                                    <th className="px-3 py-2.5 w-10 text-center">#</th>
                                    <th className="px-3 py-2.5">Désignation du Produit</th>
                                    <th className="px-3 py-2.5 w-32">Conditionnement</th>
                                    <th className="px-3 py-2.5 text-right w-28">Prix Achat Appliqué</th>
                                    <th className="px-3 py-2.5 text-center w-24">Commandé</th>
                                    <th className="px-3 py-2.5 text-center w-24">Reçu</th>
                                    <th className="px-3 py-2.5 text-center w-24">Reste à Livrer</th>
                                    <th className="px-3 py-2.5 text-right w-28">Total Ligne</th>
                                    <th className="px-3 py-2.5 text-center w-28">Statut Ligne</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {currentOrder.items?.map((item, idx) => {
                                    const originalProd = (products || []).find(p => String(p.id) === String(item.productId));
                                    const archetype = originalProd ? getProductArchetype(originalProd) : null;
                                    const remaining = Math.max(0, (item.quantityOrdered || 0) - (item.quantityReceived || 0));
                                    const isFullyDelivered = (item.quantityReceived || 0) >= (item.quantityOrdered || 0);

                                    return (
                                        <tr key={item.productId || idx} className="hover:bg-blue-50/30 transition-colors">
                                            <td className="px-3 py-2.5 text-center text-gray-500 font-normal">
                                                {idx + 1}
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <div className="font-semibold text-gray-900">{item.name}</div>
                                                {originalProd?.barcode && (
                                                    <div className="text-[10px] text-gray-500 font-mono">
                                                        Réf: {originalProd.barcode}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-3 py-2.5 text-gray-700">
                                                {archetype ? (
                                                    <span className="inline-flex items-center text-[11px] font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-[3px] border border-gray-300">
                                                        {archetype === 'BOX' ? 'Boîte / Colis' : archetype === 'BULK' ? 'Vrac' : 'Unitaire'}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-500 text-[11px]">Standard</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2.5 text-right font-normal text-gray-700">
                                                {formatPrice(item.purchasePrice)}
                                            </td>
                                            <td className="px-3 py-2.5 text-center font-semibold text-gray-900">
                                                {item.quantityOrdered}
                                            </td>
                                            <td className={`px-3 py-2.5 text-center font-semibold ${
                                                isFullyDelivered ? 'text-emerald-700' : (item.quantityReceived > 0 ? 'text-amber-700' : 'text-gray-500')
                                            }`}>
                                                {item.quantityReceived || 0}
                                            </td>
                                            <td className="px-3 py-2.5 text-center font-semibold">
                                                {remaining > 0 ? (
                                                    <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded-[3px] border border-amber-200">
                                                        {remaining}
                                                    </span>
                                                ) : (
                                                    <span className="text-emerald-700 font-normal">0 (Soldé)</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2.5 text-right font-semibold text-[#001d35]">
                                                {formatPrice((item.purchasePrice || 0) * (item.quantityOrdered || 0))}
                                            </td>
                                            <td className="px-3 py-2.5 text-center">
                                                {isFullyDelivered ? (
                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[3px] text-[10px] font-semibold uppercase bg-emerald-50 text-emerald-800 border border-emerald-300">
                                                        <Check className="w-3 h-3 text-emerald-600" />
                                                        Livré
                                                    </span>
                                                ) : (item.quantityReceived > 0) ? (
                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[3px] text-[10px] font-semibold uppercase bg-amber-50 text-amber-800 border border-amber-300">
                                                        <Clock className="w-3 h-3 text-amber-600" />
                                                        Partiel
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[3px] text-[10px] font-semibold uppercase bg-blue-50 text-blue-800 border border-blue-300">
                                                        En attente
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr className="bg-slate-50 font-semibold border-t-2 border-gray-300 text-gray-900">
                                    <td colSpan="4" className="px-3 py-3 text-right uppercase text-[11px] text-gray-600">
                                        Total Bon de Réapprovisionnement
                                    </td>
                                    <td className="px-3 py-3 text-center text-xs font-semibold text-gray-900">
                                        {totalOrdered}
                                    </td>
                                    <td className="px-3 py-3 text-center text-xs font-semibold text-emerald-800">
                                        {totalRec}
                                    </td>
                                    <td className="px-3 py-3 text-center text-xs font-semibold text-amber-800">
                                        {remainingTotal}
                                    </td>
                                    <td className="px-3 py-3 text-right text-sm font-semibold text-[#001d35]">
                                        {formatPrice(currentOrder.totalAmount)}
                                    </td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* Zone Manager Clôture Forcée si commande partielle */}
                {currentOrder.status === 'Partial' && (
                    <div className="p-3.5 border-2 border-red-200 bg-red-50/70 rounded-[4px] flex items-start gap-3 print:hidden">
                        <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <h4 className="font-semibold text-red-900 text-xs uppercase tracking-wide">
                                Clôture Définitive Exceptionnelle (Manager)
                            </h4>
                            <p className="text-xs text-red-700 mt-0.5 font-normal">
                                Cette commande est partiellement livrée. Si le reliquat restant ne sera jamais livré par le fournisseur, vous pouvez clore définitivement la commande pour régulariser le registre.
                            </p>
                            <button
                                type="button"
                                onClick={() => setShowForceCompleteConfirm(true)}
                                className="mt-2 px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-[4px] hover:bg-red-700 transition-colors shadow-xs cursor-pointer"
                            >
                                Forcer la Clôture Définitive
                            </button>
                        </div>
                    </div>
                )}

                {/* Bouton de Fermeture en bas de page */}
                <div className="flex justify-end pt-2 pb-6 print:hidden">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 bg-[#001d35] hover:bg-[#00284a] text-white text-xs font-semibold uppercase tracking-wider rounded-[4px] shadow-sm flex items-center gap-2 transition-all cursor-pointer"
                    >
                        <ArrowLeft className="w-3.5 h-3.5 text-[#f77500]" />
                        <span>Fermer et Revenir</span>
                    </button>
                </div>
            </div>

            {/* ═════════════════════════════════════════════════════════════════════ */}
            {/* MODALE RÉCEPTION DE MARCHANDISES                                       */}
            {/* ═════════════════════════════════════════════════════════════════════ */}
            {showReceiveModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[120] p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[4px] shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col border-2 border-[#001d35]">
                        <div className="p-3.5 border-b border-gray-200 bg-[#001d35] text-white flex justify-between items-center">
                            <div>
                                <h3 className="text-sm font-semibold uppercase tracking-wide">Réception Bon de Commande {formattedOrderNum}</h3>
                                <p className="text-[11px] text-gray-300 mt-0.5 font-normal">{currentOrder.supplier} — {new Date(currentOrder.date).toLocaleDateString('fr-FR')}</p>
                            </div>
                            <button onClick={() => setShowReceiveModal(false)} className="text-gray-300 hover:text-white cursor-pointer text-lg font-bold">
                                &times;
                            </button>
                        </div>

                        <div className="p-4 bg-gray-50 border-b border-gray-200 space-y-3">
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
                                    Réceptionné par <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={receivedBy}
                                    onChange={(e) => setReceivedBy(e.target.value)}
                                    placeholder="Nom du magasinier / réceptionneur"
                                    className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-[4px] focus:outline-none focus:ring-1 focus:ring-[#001d35] bg-white font-normal"
                                />
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer bg-white p-2.5 border border-gray-300 rounded-[4px]">
                                <input
                                    type="checkbox"
                                    checked={isPaidCash}
                                    onChange={(e) => setIsPaidCash(e.target.checked)}
                                    className="w-4 h-4 text-[#001d35] rounded-xs focus:ring-0"
                                />
                                <div>
                                    <span className="text-xs font-semibold text-gray-900 block">Règlement au comptant (Cash / Virement)</span>
                                    <span className="text-[10px] text-gray-500 block font-normal">Cochez si la marchandise a été réglée immédiatement. La dette du fournisseur n'augmentera pas.</span>
                                </div>
                            </label>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-[#001d35] text-white font-semibold uppercase tracking-wider text-[10px] divide-x divide-white/20">
                                        <th className="px-3 py-2">Produit</th>
                                        <th className="px-3 py-2 text-center">Commandé</th>
                                        <th className="px-3 py-2 text-center">Déjà Reçu</th>
                                        <th className="px-3 py-2 text-center">Reçu Maintenant</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {currentOrder.items.map(item => (
                                        <tr key={item.productId} className="hover:bg-gray-50 border-b border-gray-100">
                                            <td className="px-3 py-2.5 font-semibold text-[#001d35]">{item.name}</td>
                                            <td className="px-3 py-2.5 text-center font-normal">{item.quantityOrdered}</td>
                                            <td className="px-3 py-2.5 text-center text-gray-500 font-normal">{item.quantityReceived || 0}</td>
                                            <td className="px-3 py-2.5 text-center">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max={item.quantityOrdered - (item.quantityReceived || 0)}
                                                    placeholder="0"
                                                    className="w-24 px-2 py-1 text-center font-semibold text-xs border border-gray-300 rounded-[4px] focus:outline-none focus:ring-1 focus:ring-[#001d35]"
                                                    onChange={(e) => setReceiveData({
                                                        ...receiveData,
                                                        [item.productId]: e.target.value
                                                    })}
                                                    disabled={(item.quantityReceived || 0) >= item.quantityOrdered}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="p-3 border-t border-gray-200 flex justify-end gap-2 bg-gray-50">
                            <button
                                type="button"
                                onClick={() => setShowReceiveModal(false)}
                                className="px-3 py-1.5 text-xs text-gray-700 font-semibold hover:bg-gray-200 rounded-[4px] transition-colors cursor-pointer"
                            >
                                Annuler
                            </button>
                            <button
                                type="button"
                                onClick={handleReceiveSubmit}
                                disabled={isReceivingLoading}
                                className="px-4 py-1.5 bg-[#001d35] text-white font-semibold text-xs uppercase tracking-wider rounded-[4px] hover:bg-[#00284a] transition-all shadow-sm cursor-pointer disabled:opacity-50"
                            >
                                {isReceivingLoading ? 'Validation en cours...' : 'Valider la Réception'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═════════════════════════════════════════════════════════════════════ */}
            {/* MODALE CONFIRMATION DE SUPPRESSION                                    */}
            {/* ═════════════════════════════════════════════════════════════════════ */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[130] p-4 animate-in fade-in duration-150">
                    <div className="bg-white rounded-[4px] shadow-2xl border-2 border-[#001d35] max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-150">
                        <div className="bg-[#001d35] text-white px-4 py-3 flex items-center justify-between border-b-2 border-[#f77500]">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-rose-500" />
                                <h3 className="font-semibold text-sm uppercase tracking-wide">
                                    Supprimer ce bon
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowDeleteConfirm(false)}
                                className="text-gray-300 hover:text-white cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-4 space-y-3">
                            <p className="text-xs text-gray-700 leading-relaxed">
                                Êtes-vous sûr de vouloir supprimer définitivement le bon de commande <strong>{formattedOrderNum}</strong> ({currentOrder.supplier}) ?
                            </p>
                            <p className="text-[11px] text-gray-500">
                                Cette action est irréversible et supprimera l'enregistrement du registre.
                            </p>
                        </div>

                        <div className="p-3 bg-gray-50 border-t border-gray-200 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setShowDeleteConfirm(false)}
                                className="px-3 py-1.5 text-xs text-gray-700 font-semibold hover:bg-gray-200 rounded-[4px] transition-colors cursor-pointer"
                            >
                                Annuler
                            </button>
                            <button
                                type="button"
                                onClick={handleDeleteSubmit}
                                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-[4px] transition-colors shadow-sm cursor-pointer"
                            >
                                Confirmer la suppression
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═════════════════════════════════════════════════════════════════════ */}
            {/* MODALE CONFIRMATION DE CLÔTURE FORCÉE                                  */}
            {/* ═════════════════════════════════════════════════════════════════════ */}
            {showForceCompleteConfirm && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[130] p-4 animate-in fade-in duration-150">
                    <div className="bg-white rounded-[4px] shadow-2xl border-2 border-[#001d35] max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-150">
                        <div className="bg-[#001d35] text-white px-4 py-3 flex items-center justify-between border-b-2 border-[#f77500]">
                            <div className="flex items-center gap-2">
                                <ShieldAlert className="w-5 h-5 text-amber-400" />
                                <h3 className="font-semibold text-sm uppercase tracking-wide">
                                    Clôture Définitive Manager
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowForceCompleteConfirm(false)}
                                className="text-gray-300 hover:text-white cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-4 space-y-3">
                            <p className="text-xs text-gray-700 leading-relaxed">
                                Voulez-vous clore définitivement le bon <strong>{formattedOrderNum}</strong> ?
                            </p>
                            <p className="text-[11px] text-gray-500">
                                Le reliquat restant non livré sera abandonné et le statut de la commande passera à "Entièrement Reçu (Clôturé)".
                            </p>
                        </div>

                        <div className="p-3 bg-gray-50 border-t border-gray-200 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setShowForceCompleteConfirm(false)}
                                className="px-3 py-1.5 text-xs text-gray-700 font-semibold hover:bg-gray-200 rounded-[4px] transition-colors cursor-pointer"
                            >
                                Annuler
                            </button>
                            <button
                                type="button"
                                onClick={handleForceCompleteSubmit}
                                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-[4px] transition-colors shadow-sm cursor-pointer"
                            >
                                Forcer la clôture
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReplenishmentOrderDetailModal;
