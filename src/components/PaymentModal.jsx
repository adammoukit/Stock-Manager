import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    CreditCard, 
    Banknote, 
    X, 
    Truck, 
    ShoppingBag, 
    Building2, 
    User, 
    AlertTriangle, 
    Plus, 
    Check, 
    ShieldAlert, 
    MapPin, 
    Ticket, 
    Coins, 
    Wallet, 
    Users, 
    FileText, 
    Receipt, 
    ShieldCheck 
} from 'lucide-react';
import { formatPrice } from '../utils/currency';
import FinancialInput from './FinancialInput';
import { useClients } from '../context/ClientContext';
import { useSales } from '../context/SalesContext';

const PaymentModal = ({ 
    total, 
    subtotal, 
    discount = 0, 
    preSelectedMethod = 'cash', 
    preSelectedAmount = '', 
    onConfirm, 
    onCancel, 
    isProcessing 
}) => {
    const { clients, addClient, addSite } = useClients();
    const { debts, creditNotes, getCreditNote, useCreditNote } = useSales();

    const [paymentMethod, setPaymentMethod] = useState(preSelectedMethod || 'cash');
    const [amountGiven, setAmountGiven] = useState(
        preSelectedAmount || (preSelectedMethod === 'card' ? total.toString() : (preSelectedMethod === 'avoir' ? total.toString() : ''))
    );

    // Reliquat / Manque de monnaie state
    const [hasChangeShortage, setHasChangeShortage] = useState(false);
    const [reliquatType, setReliquatType] = useState('voucher'); // 'voucher' | 'client_credit'
    const [actualCashReturned, setActualCashReturned] = useState(0);

    // Bon d'Avoir state
    const [voucherCodeInput, setVoucherCodeInput] = useState('');
    const [appliedCreditNote, setAppliedCreditNote] = useState(null);
    const [voucherError, setVoucherError] = useState('');
    const [showVoucherInput, setShowVoucherInput] = useState(false);
    
    // Client selection state
    const [selectedClientId, setSelectedClientId] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [clientSearchTerm, setClientSearchTerm] = useState('');
    const [showClientDropdown, setShowClientDropdown] = useState(false);

    // Site / Chantier state
    const [selectedSiteMode, setSelectedSiteMode] = useState('existing'); // 'existing' or 'new'
    const [siteName, setSiteName] = useState('');
    const [saveNewSiteToProfile, setSaveNewSiteToProfile] = useState(true);

    // Delivery info state
    const [driverName, setDriverName] = useState('');
    const [vehicleNumber, setVehicleNumber] = useState('');
    const [deliveryNotes, setDeliveryNotes] = useState('');
    const [deliveryMode, setDeliveryMode] = useState('counter'); // 'counter' (Comptoir) ou 'warehouse' (Bon à Enlever)
    
    // Credit limit override
    const [overrideCreditLimit, setOverrideCreditLimit] = useState(false);
    const [error, setError] = useState('');

    // Deduction from applied credit note
    const noteDeduction = appliedCreditNote ? Math.min(total, appliedCreditNote.remainingAmount) : 0;
    const netToPay = Math.max(0, total - noteDeduction);

    // Sync with preSelected props when they change
    useEffect(() => {
        if (preSelectedMethod) {
            setPaymentMethod(preSelectedMethod);
            if (preSelectedMethod === 'card') {
                setAmountGiven(netToPay.toString());
            } else if (preSelectedMethod === 'avoir') {
                setShowVoucherInput(true);
            }
        }
    }, [preSelectedMethod]);

    useEffect(() => {
        if (preSelectedAmount) {
            setAmountGiven(preSelectedAmount);
        }
    }, [preSelectedAmount]);

    // Active client object
    const selectedClient = useMemo(() => {
        if (selectedClientId) {
            return clients.find(c => c.id === selectedClientId) || null;
        }
        if (customerName) {
            return clients.find(c => c.name.toLowerCase().trim() === customerName.toLowerCase().trim()) || null;
        }
        return null;
    }, [selectedClientId, customerName, clients]);

    // Section 2 refs for auto-scroll and field highlight (Compte Client & Chantier)
    const clientSectionRef = useRef(null);
    const customerInputRef = useRef(null);
    const siteInputRef = useRef(null);
    const [highlightClientErrors, setHighlightClientErrors] = useState(false);

    const isClientMissing = !selectedClient && !customerName.trim();
    const isSiteMissing = !siteName.trim();
    const hasClientError = highlightClientErrors && isClientMissing;
    const hasSiteError = highlightClientErrors && isSiteMissing;

    const scrollToClientSection = (focusTarget = null) => {
        setHighlightClientErrors(true);
        setError('');
        if (clientSectionRef.current) {
            clientSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        setTimeout(() => {
            if (focusTarget === 'site' || (!isClientMissing && isSiteMissing)) {
                siteInputRef.current?.focus();
            } else {
                customerInputRef.current?.focus();
            }
        }, 250);
    };

    // Compute existing debt for this client
    const currentOutstandingDebt = useMemo(() => {
        if (!selectedClient) return 0;
        return debts
            .filter(d => (d.clientId && d.clientId === selectedClient.id) || (d.customerName && d.customerName.toLowerCase().trim() === selectedClient.name.toLowerCase().trim()))
            .reduce((sum, d) => sum + Math.max(0, (d.totalAmount || 0) - (d.paidAmount || 0)), 0);
    }, [selectedClient, debts]);

    // Credit calculations
    const downPayment = paymentMethod === 'credit' ? (parseFloat(amountGiven) || 0) : 0;
    const newDebtAmount = Math.max(0, netToPay - downPayment);
    const projectedTotalDebt = currentOutstandingDebt + newDebtAmount;
    const clientCreditLimit = selectedClient?.creditLimit || 0;
    const isCreditLimitExceeded = paymentMethod === 'credit' && clientCreditLimit > 0 && projectedTotalDebt > clientCreditLimit;
    const excessAmount = isCreditLimitExceeded ? (projectedTotalDebt - clientCreditLimit) : 0;

    // Filter clients for autocomplete dropdown
    const filteredClients = useMemo(() => {
        const term = clientSearchTerm.trim().toLowerCase();
        if (!term) return clients.slice(0, 8);
        return clients.filter(c => 
            c.name.toLowerCase().includes(term) || 
            (c.phone && c.phone.includes(term))
        ).slice(0, 8);
    }, [clients, clientSearchTerm]);

    // Active credit notes for selected client
    const clientAvailableCreditNotes = useMemo(() => {
        if (!selectedClient && !customerName) return [];
        return (creditNotes || []).filter(c => {
            const matchClient = (selectedClient && c.clientId === selectedClient.id) ||
                (customerName && c.customerName && c.customerName.toLowerCase().trim() === customerName.toLowerCase().trim());
            const isUsable = (c.status === 'active' || c.status === 'partial') && c.remainingAmount > 0 && new Date(c.expiresAt).getTime() >= Date.now();
            return matchClient && isUsable;
        });
    }, [creditNotes, selectedClient, customerName]);

    const clientTotalAvailableAvoir = useMemo(() => {
        return clientAvailableCreditNotes.reduce((sum, n) => sum + (n.remainingAmount || 0), 0);
    }, [clientAvailableCreditNotes]);

    const clientAvailableReliquats = useMemo(() => {
        return clientAvailableCreditNotes.filter(n => n.type === 'change_reliquat');
    }, [clientAvailableCreditNotes]);

    const clientTotalReliquat = useMemo(() => {
        return clientAvailableReliquats.reduce((sum, n) => sum + (n.remainingAmount || 0), 0);
    }, [clientAvailableReliquats]);

    // Handle selecting a client from autocomplete
    const handleSelectClient = (client) => {
        setSelectedClientId(client.id);
        setCustomerName(client.name);
        setCustomerPhone(client.phone || '');
        setClientSearchTerm(client.name);
        setShowClientDropdown(false);
        setError('');

        if (client.sites && client.sites.length > 0) {
            const firstActive = client.sites.find(s => s.status === 'active') || client.sites[0];
            setSiteName(firstActive.name);
            setSelectedSiteMode('existing');
            if (highlightClientErrors) {
                setHighlightClientErrors(false);
            }
        } else {
            setSiteName('');
            setSelectedSiteMode('new');
        }
    };

    const handleClearClient = () => {
        setSelectedClientId('');
        setCustomerName('');
        setCustomerPhone('');
        setSiteName('');
        setClientSearchTerm('');
        setSelectedSiteMode('new');
        handleRemoveVoucher();
    };

    const handleApplyVoucher = (codeToUse) => {
        const code = (codeToUse || voucherCodeInput).trim().toUpperCase();
        if (!code) {
            setVoucherError("Veuillez saisir un code d'avoir.");
            return;
        }
        const note = getCreditNote(code);
        if (!note) {
            setVoucherError("Bon d'avoir introuvable ou expiré.");
            return;
        }
        if (note.status === 'used' || note.remainingAmount <= 0) {
            setVoucherError("Ce bon d'avoir a déjà été entièrement utilisé.");
            return;
        }
        if (new Date(note.expiresAt).getTime() < Date.now()) {
            setVoucherError("Ce bon d'avoir est expiré.");
            return;
        }

        const deduction = Math.min(total, note.remainingAmount);
        setAppliedCreditNote({
            ...note,
            appliedAmount: deduction
        });
        setVoucherCodeInput(note.code);
        setVoucherError('');

        const remainingNet = total - deduction;
        if (remainingNet === 0) {
            setPaymentMethod('avoir');
            setAmountGiven(total.toString());
        } else {
            if (paymentMethod === 'avoir' || !paymentMethod) {
                setPaymentMethod('cash');
            }
            if (paymentMethod === 'card') {
                setAmountGiven(remainingNet.toString());
            } else if (paymentMethod === 'credit') {
                setAmountGiven('0');
            } else {
                setAmountGiven(remainingNet.toString());
            }
        }
    };

    const handleRemoveVoucher = () => {
        setAppliedCreditNote(null);
        setVoucherCodeInput('');
        setVoucherError('');
        if (paymentMethod === 'avoir') {
            setPaymentMethod('cash');
            setAmountGiven('');
        }
    };

    const handleMethodSelect = (method) => {
        setPaymentMethod(method);
        if (method === 'card') {
            setAmountGiven(netToPay.toString());
        } else if (method === 'credit') {
            setAmountGiven('0');
        } else if (method === 'avoir') {
            setAmountGiven(total.toString());
            // Si le client a un bon d'avoir ou reliquat disponible et qu'aucun n'est appliqué, on l'applique automatiquement !
            if (!appliedCreditNote && clientAvailableCreditNotes.length > 0) {
                handleApplyVoucher(clientAvailableCreditNotes[0].code);
            } else {
                setShowVoucherInput(true);
            }
        } else {
            setAmountGiven(preSelectedAmount || '');
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
        let currentApplied = appliedCreditNote;

        // Si l'utilisateur a saisi un code dans l'input sans cliquer sur "Appliquer"
        if (!currentApplied && voucherCodeInput.trim()) {
            const code = voucherCodeInput.trim().toUpperCase();
            const note = getCreditNote(code);
            if (note && (note.status === 'active' || note.status === 'partial') && (parseFloat(note.remainingAmount) || 0) > 0) {
                const deduction = Math.min(total, parseFloat(note.remainingAmount) || 0);
                currentApplied = {
                    ...note,
                    appliedAmount: deduction
                };
                setAppliedCreditNote(currentApplied);
            }
        }

        // Si le mode de règlement sélectionné est 'avoir' mais qu'aucun avoir n'est appliqué
        if (paymentMethod === 'avoir') {
            if (!currentApplied && clientAvailableCreditNotes.length > 0) {
                const note = clientAvailableCreditNotes[0];
                const deduction = Math.min(total, parseFloat(note.remainingAmount) || 0);
                currentApplied = {
                    ...note,
                    appliedAmount: deduction
                };
                setAppliedCreditNote(currentApplied);
            }

            if (!currentApplied) {
                setError("Veuillez sélectionner ou appliquer un Bon d'Avoir ou Reliquat valide avant de confirmer.");
                setShowVoucherInput(true);
                return;
            }

            const currentDeduction = currentApplied ? Math.min(total, parseFloat(currentApplied.remainingAmount) || 0) : 0;
            const currentNetToPay = Math.max(0, total - currentDeduction);
            if (currentNetToPay > 0) {
                setError(`Le bon d'avoir couvre ${formatPrice(currentDeduction)}. Veuillez sélectionner un mode de règlement (Espèces, Carte ou Crédit) pour le reste de ${formatPrice(currentNetToPay)}.`);
                return;
            }
        }

        const effectiveDeduction = currentApplied ? Math.min(total, parseFloat(currentApplied.remainingAmount) || 0) : 0;
        const effectiveNetToPay = Math.max(0, total - effectiveDeduction);
        const amount = parseFloat(amountGiven);

        if (!paymentMethod) {
            setError('Veuillez sélectionner un mode de paiement');
            return;
        }

        if (paymentMethod !== 'credit' && paymentMethod !== 'avoir' && (!amountGiven || isNaN(amount))) {
            setError('Veuillez entrer un montant valide');
            return;
        }

        if ((paymentMethod === 'credit' || deliveryMode === 'warehouse') && !customerName.trim()) {
            scrollToClientSection('client');
            setError('Veuillez renseigner le nom du client ou sélectionner un compte client.');
            return;
        }

        if (paymentMethod !== 'credit' && paymentMethod !== 'avoir' && amount < effectiveNetToPay) {
            setError(`Le montant doit être au moins ${formatPrice(effectiveNetToPay)}`);
            return;
        }

        // Credit limit check
        if (isCreditLimitExceeded && !overrideCreditLimit) {
            setError(`Le plafond de crédit (${formatPrice(clientCreditLimit)}) est dépassé de ${formatPrice(excessAmount)}. Accordez une dérogation exceptionnelle pour valider.`);
            return;
        }

        const theoreticalChange = paymentMethod !== 'credit' && paymentMethod !== 'avoir' ? Math.max(0, amount - effectiveNetToPay) : 0;
        const cashToReturn = hasChangeShortage ? Math.min(theoreticalChange, Math.max(0, parseFloat(actualCashReturned) || 0)) : theoreticalChange;
        const unreturnedAmount = Math.max(0, theoreticalChange - cashToReturn);

        // Validation si option 'Avance sur compte client' sélectionnée sans client ou sans attribution chantier
        if (hasChangeShortage && unreturnedAmount > 0 && reliquatType === 'client_credit' && (isClientMissing || isSiteMissing)) {
            scrollToClientSection();
            return;
        }

        // Save new site to client profile if requested
        if (selectedClient && siteName.trim() && selectedSiteMode === 'new' && saveNewSiteToProfile) {
            const alreadyExists = selectedClient.sites?.some(s => s.name.toLowerCase().trim() === siteName.toLowerCase().trim());
            if (!alreadyExists) {
                addSite(selectedClient.id, {
                    name: siteName.trim(),
                    status: 'active'
                });
            }
        }

        // Vérification de sécurité sur le bon d'avoir
        if (currentApplied) {
            const checkNote = getCreditNote(currentApplied.code);
            if (!checkNote) {
                setError("Le bon d'avoir appliqué est introuvable.");
                return;
            }
            if (checkNote.status === 'used' || (parseFloat(checkNote.remainingAmount) || 0) <= 0) {
                setError("Ce bon d'avoir a déjà été entièrement utilisé.");
                return;
            }
            if (checkNote.expiresAt && new Date(checkNote.expiresAt).getTime() < Date.now()) {
                setError("Ce bon d'avoir est expiré.");
                return;
            }
        }

        let resolvedClientId = selectedClient?.id || null;
        let resolvedClientName = customerName.trim() || selectedClient?.name || '';

        // Si le client n'est pas encore enregistré par ID mais qu'un nom a été saisi
        if (!resolvedClientId && resolvedClientName) {
            const existingClient = clients.find(c => c.name.toLowerCase().trim() === resolvedClientName.toLowerCase());
            if (existingClient) {
                resolvedClientId = existingClient.id;
            } else if (reliquatType === 'client_credit') {
                // Création automatique du client pour persister son avance dans le Répertoire clients
                const newClient = addClient({
                    name: resolvedClientName,
                    phone: customerPhone.trim() || '',
                    address: '',
                    type: 'particulier',
                    creditLimit: 0,
                    pricingTier: 'normal',
                    createdVia: 'pos_reliquat',
                    creationNote: `Création automatique en caisse lors du règlement (Avance reliquat : ${formatPrice(unreturnedAmount)})`
                });
                resolvedClientId = newClient?.id || null;
            }
        }

        let changeReliquatData = null;
        if (hasChangeShortage && unreturnedAmount > 0) {
            const now = new Date();
            const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
            const rand = Math.floor(1000 + Math.random() * 9000);
            changeReliquatData = {
                type: reliquatType,
                amount: unreturnedAmount,
                actualCashReturned: cashToReturn,
                voucherCode: `AVR-${dateStr.slice(2, 6)}-${rand}`,
                customerName: resolvedClientName || 'Client Comptoir',
                clientId: resolvedClientId || null
            };
        }

        onConfirm({
            method: paymentMethod,
            amountGiven: paymentMethod === 'avoir' ? total : amount,
            change: cashToReturn,
            changeDue: theoreticalChange,
            changeReliquat: changeReliquatData,
            customerName: resolvedClientName || undefined,
            customerPhone: customerPhone.trim() || undefined,
            clientId: resolvedClientId || null,
            siteName: siteName.trim() || undefined,
            deliveryMode,
            appliedCreditNote: currentApplied ? {
                code: currentApplied.code,
                amount: currentApplied.appliedAmount
            } : null,
            deliveryInfo: deliveryMode === 'warehouse' ? {
                customerName: customerName.trim(),
                customerPhone: customerPhone.trim(),
                siteName: siteName.trim(),
                driverName: driverName.trim(),
                vehicleNumber: vehicleNumber.trim(),
                notes: deliveryNotes.trim()
            } : null
        });
    };

    const change = amountGiven && !isNaN(parseFloat(amountGiven))
        ? Math.max(0, parseFloat(amountGiven) - netToPay)
        : 0;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white w-full max-w-xl rounded-[4px] shadow-2xl border-2 border-[#001d35] overflow-hidden animate-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col">
                
                {/* ── HEADER MODAL KABLLIX ERP HARMONISÉ ── */}
                <div className="bg-[#001d35] text-white px-4 py-3 flex justify-between items-center border-b-2 border-[#f77500] shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="p-1.5 bg-white/10 rounded-[4px]">
                            <Receipt className="w-4 h-4 text-[#f77500]" />
                        </div>
                        <div>
                            <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-white">
                                Validation & Encaissement
                            </h3>
                            <p className="text-gray-300 text-[10px] font-normal">
                                Affectation Chantier, Client & Sécurisation Règlement
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={isProcessing}
                        className="text-gray-300 hover:text-white p-1 rounded-[4px] hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-50"
                        title="Fermer"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
                    
                    {/* ── RÉSUMÉ FINANCIER HARMONISÉ (MODULES STYLE POS) ── */}
                    <div className="bg-slate-50/70 border border-gray-200 p-3 rounded-[4px] space-y-2">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-500 font-medium">Total Brut HT :</span>
                            <span className="font-semibold text-gray-800">{formatPrice(subtotal || total)}</span>
                        </div>
                        {discount > 0 && (
                            <div className="flex items-center justify-between text-[11px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-[3px] border border-amber-200">
                                <span>Remise appliquée :</span>
                                <span>-{formatPrice(discount)}</span>
                            </div>
                        )}
                        {appliedCreditNote && (
                            <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-[3px] border border-emerald-200">
                                <span>Déduction Bon d'Avoir ({appliedCreditNote.code}) :</span>
                                <span>-{formatPrice(noteDeduction)}</span>
                            </div>
                        )}
                        <div className="bg-[#001d35] text-white px-3 py-2 rounded-[4px] flex items-center justify-between shadow-xs">
                            <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-300">
                                    {appliedCreditNote ? "Reste Net à Payer" : "Net Total TTC à Payer"}
                                </p>
                                <p className="text-xl sm:text-2xl font-bold text-white tracking-tight">{formatPrice(netToPay)}</p>
                            </div>
                            <div className="text-right flex flex-col items-end gap-1">
                                <span className="text-[11px] bg-white/10 text-white border border-white/20 font-semibold px-2.5 py-0.5 rounded-[3px]">
                                    {deliveryMode === 'warehouse' ? '🚚 Bon à Enlever' : '🛍️ Emporté Comptoir'}
                                </span>
                                {selectedClient?.pricingTier && selectedClient.pricingTier !== 'normal' && (
                                    <span className="text-[10px] bg-[#f77500] text-white font-bold px-2 py-0.5 rounded-[3px]">
                                        {selectedClient.pricingTier === 'artisan' ? '⭐ Tarif Artisan (-5%)' : '👑 Tarif Grossiste (-10%)'}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── 1. MODE DE DÉLIVRANCE DES MARCHANDISES ── */}
                    <div className="bg-slate-50/70 border border-gray-200 rounded-[4px] p-3 space-y-2">
                        <div className="flex items-center gap-1.5 pb-1.5 border-b border-gray-200 text-[#001d35] font-semibold text-xs uppercase tracking-wider">
                            <Truck className="w-3.5 h-3.5 text-[#001d35]" />
                            <span>1. Mode de mise à disposition des marchandises</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <button
                                type="button"
                                onClick={() => setDeliveryMode('counter')}
                                className={`flex items-start gap-2.5 p-2.5 border rounded-[4px] text-left transition-all cursor-pointer ${
                                    deliveryMode === 'counter'
                                        ? 'border-[#001d35] bg-white ring-1 ring-[#001d35] shadow-xs'
                                        : 'border-gray-200 hover:border-gray-300 bg-white'
                                }`}
                            >
                                <div className={`p-1.5 rounded-[4px] ${deliveryMode === 'counter' ? 'bg-[#001d35] text-white' : 'bg-gray-100 text-gray-600'}`}>
                                    <ShoppingBag className="w-4 h-4" />
                                </div>
                                <div>
                                    <p className="font-semibold text-xs text-gray-900 uppercase">Emporté Comptoir</p>
                                    <p className="text-[11px] text-gray-500">Marchandises remises immédiatement au guichet</p>
                                </div>
                            </button>

                            <button
                                type="button"
                                onClick={() => setDeliveryMode('warehouse')}
                                className={`flex items-start gap-2.5 p-2.5 border rounded-[4px] text-left transition-all cursor-pointer ${
                                    deliveryMode === 'warehouse'
                                        ? 'border-amber-600 bg-white ring-1 ring-amber-600 shadow-xs'
                                        : 'border-gray-200 hover:border-gray-300 bg-white'
                                }`}
                            >
                                <div className={`p-1.5 rounded-[4px] ${deliveryMode === 'warehouse' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                                    <Truck className="w-4 h-4" />
                                </div>
                                <div>
                                    <p className="font-semibold text-xs text-amber-950 uppercase">Bon à Enlever au Dépôt</p>
                                    <p className="text-[11px] text-amber-700">Retrait différé, chargement camion ou partiel</p>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* ── 2. COMPTE CLIENT & ATTRIBUTION CHANTIER (CONTENEUR UNIFIÉ) ── */}
                    <div 
                        ref={clientSectionRef}
                        className={`border rounded-[4px] p-3 space-y-3 transition-all duration-300 ${
                            (hasClientError || hasSiteError)
                                ? 'bg-rose-50/50 border-rose-400 ring-2 ring-rose-200/80 shadow-sm'
                                : 'bg-slate-50/70 border-gray-200'
                        }`}
                    >
                        <div className="flex items-center justify-between pb-1.5 border-b border-gray-200">
                            <div className="flex items-center gap-1.5 text-[#001d35] font-semibold text-xs uppercase tracking-wider">
                                <User className="w-3.5 h-3.5 text-[#001d35]" />
                                <span>2. Compte Client & Attribution Chantier</span>
                            </div>
                            {selectedClient && (
                                <button
                                    type="button"
                                    onClick={handleClearClient}
                                    className="text-[11px] text-gray-500 hover:text-rose-600 underline font-semibold cursor-pointer"
                                >
                                    Changer de client
                                </button>
                            )}
                        </div>

                        {/* Recherche Client Autocomplete */}
                        <div className="relative">
                            <label className="block text-[10px] font-semibold text-gray-600 uppercase tracking-wider mb-1 flex items-center justify-between">
                                <span>
                                    Rechercher ou Saisir le Nom du Client {paymentMethod === 'credit' && <span className="text-rose-600 font-bold">* (Obligatoire à crédit)</span>}
                                </span>
                                {hasClientError && (
                                    <span className="text-[10px] font-bold text-rose-600 animate-pulse flex items-center gap-1">
                                        <AlertTriangle className="w-3 h-3 text-rose-600" />
                                        Champ client obligatoire pour l'avance
                                    </span>
                                )}
                            </label>
                            <div className="relative">
                                <input
                                    ref={customerInputRef}
                                    type="text"
                                    value={customerName}
                                    onChange={(e) => {
                                        setCustomerName(e.target.value);
                                        setClientSearchTerm(e.target.value);
                                        setShowClientDropdown(true);
                                        if (selectedClientId) setSelectedClientId('');
                                        if (highlightClientErrors && e.target.value.trim() && !isSiteMissing) {
                                            setHighlightClientErrors(false);
                                        }
                                    }}
                                    onFocus={() => setShowClientDropdown(true)}
                                    placeholder="Tapez le nom d'un client (ex: Koffi, BTP Plus, SOGEA...)"
                                    className={`w-full px-3 py-1.5 text-xs rounded-[4px] font-semibold pr-8 transition-all ${
                                        hasClientError
                                            ? 'border-2 border-rose-500 bg-rose-50/40 text-rose-950 ring-2 ring-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-500 placeholder:text-rose-400'
                                            : 'border border-gray-300 focus:outline-none focus:ring-1 focus:ring-[#001d35] bg-white text-gray-800'
                                    }`}
                                />
                                {customerName && (
                                    <button
                                        type="button"
                                        onClick={handleClearClient}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>

                            {/* Dropdown Suggestions */}
                            {showClientDropdown && filteredClients.length > 0 && (
                                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-300 rounded-[4px] shadow-xl z-30 max-h-48 overflow-y-auto">
                                    <div className="p-1.5 bg-gray-100 text-[10px] font-bold uppercase text-gray-500 tracking-wider">
                                        Clients Enregistrés ({filteredClients.length})
                                    </div>
                                    {filteredClients.map(c => {
                                        const cDebts = debts.filter(d => (d.clientId === c.id) || (d.customerName && d.customerName.toLowerCase().trim() === c.name.toLowerCase().trim()));
                                        const cDebtTotal = cDebts.reduce((sum, d) => sum + Math.max(0, (d.totalAmount || 0) - (d.paidAmount || 0)), 0);

                                        const cAvoirs = (creditNotes || []).filter(cn => 
                                            (cn.status === 'active' || cn.status === 'partial') &&
                                            cn.remainingAmount > 0 &&
                                            new Date(cn.expiresAt).getTime() >= Date.now() &&
                                            ((cn.clientId && cn.clientId === c.id) || (cn.customerName && cn.customerName.toLowerCase().trim() === c.name.toLowerCase().trim()))
                                        );
                                        const cAvoirTotal = cAvoirs.reduce((sum, cn) => sum + (cn.remainingAmount || 0), 0);
                                        const cHasReliquat = cAvoirs.some(cn => cn.type === 'change_reliquat');

                                        return (
                                            <button
                                                key={c.id}
                                                type="button"
                                                onClick={() => handleSelectClient(c)}
                                                className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-100 last:border-b-0 flex items-center justify-between transition-colors cursor-pointer"
                                            >
                                                <div>
                                                    <p className="font-bold text-xs text-[#001d35]">{c.name}</p>
                                                    <p className="text-[11px] text-gray-500">{c.phone || 'Sans contact'} • {c.sites?.length || 0} chantiers</p>
                                                </div>
                                                <div className="text-right flex flex-col items-end gap-1">
                                                    {cAvoirTotal > 0 && (
                                                        <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-[3px] border animate-pulse ${
                                                            cHasReliquat 
                                                                ? 'bg-amber-100 text-amber-950 border-amber-400 shadow-2xs' 
                                                                : 'bg-emerald-100 text-emerald-950 border-emerald-400 shadow-2xs'
                                                        }`}>
                                                            <Ticket className="w-3 h-3 text-amber-600" />
                                                            <span>{cHasReliquat ? '🎟️ Reliquat :' : '🎟️ Avoir :'} {formatPrice(cAvoirTotal)}</span>
                                                        </span>
                                                    )}
                                                    {cDebtTotal > 0 ? (
                                                        <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-[3px] border border-rose-200">
                                                            Dette: {formatPrice(cDebtTotal)}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-[3px]">
                                                            À jour
                                                        </span>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Alerte Attention : Avoir / Reliquat disponible pour le client sélectionné */}
                        {clientAvailableCreditNotes.length > 0 && !appliedCreditNote && (
                            <div className={`p-2.5 rounded-[4px] border-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-sm animate-in fade-in duration-150 ${
                                clientAvailableReliquats.length > 0
                                    ? 'bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border-amber-400 text-amber-950'
                                    : 'bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-400 text-emerald-950'
                            }`}>
                                <div className="flex items-start gap-2.5">
                                    <div className={`p-2 rounded-full mt-0.5 text-white shadow-xs shrink-0 ${
                                        clientAvailableReliquats.length > 0 ? 'bg-amber-600 animate-pulse' : 'bg-emerald-600'
                                    }`}>
                                        <Ticket className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-[3px] shadow-2xs ${
                                                clientAvailableReliquats.length > 0 
                                                    ? 'bg-amber-600 text-white animate-pulse' 
                                                    : 'bg-emerald-700 text-white'
                                            }`}>
                                                {clientAvailableReliquats.length > 0 
                                                    ? '⚠️ ATTENTION : RELIQUAT DE MONNAIE EN ATTENTE' 
                                                    : '🎟️ BON D\'AVOIR DISPONIBLE'}
                                            </span>
                                            <span className="text-xs font-black text-[#001d35] bg-white px-2 py-0.5 rounded-[3px] border border-gray-300">
                                                {formatPrice(clientTotalAvailableAvoir)}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-gray-700 mt-1 font-medium">
                                            {clientAvailableReliquats.length > 0 ? (
                                                <>
                                                    Ce client a <strong>{formatPrice(clientTotalReliquat)} de reliquat de monnaie non rendu</strong> à déduire.
                                                    {clientAvailableCreditNotes.length > clientAvailableReliquats.length && ` (Total avoirs : ${formatPrice(clientTotalAvailableAvoir)})`}
                                                </>
                                            ) : (
                                                <>Ce client possède un bon d'avoir actif utilisable immédiatement sur cet achat.</>
                                            )}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleApplyVoucher(clientAvailableCreditNotes[0].code)}
                                    className="px-3.5 py-2 bg-[#001d35] hover:bg-[#00284a] text-white text-xs font-bold uppercase tracking-wider rounded-[4px] shadow-sm transition-all active:scale-95 shrink-0 flex items-center justify-center gap-1.5 cursor-pointer self-start sm:self-center"
                                >
                                    <span>Appliquer l'avoir</span>
                                    <span className="text-[#f77500]">({clientAvailableCreditNotes[0].code})</span>
                                </button>
                            </div>
                        )}

                        {/* Coordonnées Client & Attribution Chantier */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div>
                                <label className="block text-[10px] font-semibold text-gray-600 uppercase tracking-wider mb-1">
                                    Téléphone du Client
                                </label>
                                <input
                                    type="tel"
                                    value={customerPhone}
                                    onChange={(e) => setCustomerPhone(e.target.value)}
                                    placeholder="Ex: +228 90 12 34 56"
                                    className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-[4px] focus:outline-none focus:ring-1 focus:ring-[#001d35] bg-white text-gray-800"
                                />
                            </div>

                            {/* Chantier (Site) */}
                            <div>
                                <label className="block text-[10px] font-semibold text-gray-600 uppercase tracking-wider mb-1 flex items-center justify-between">
                                    <span>Chantier / Destination</span>
                                    {hasSiteError && (
                                        <span className="text-[10px] font-bold text-rose-600 animate-pulse flex items-center gap-1">
                                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                                            Attribution chantier obligatoire
                                        </span>
                                    )}
                                </label>
                                {selectedClient && selectedClient.sites && selectedClient.sites.length > 0 && selectedSiteMode === 'existing' ? (
                                    <div className="space-y-1">
                                        <select
                                            ref={siteInputRef}
                                            value={siteName || ''}
                                            onChange={(e) => {
                                                if (e.target.value === '__NEW__') {
                                                    setSelectedSiteMode('new');
                                                    setSiteName('');
                                                } else {
                                                    setSiteName(e.target.value);
                                                    if (highlightClientErrors && e.target.value && !isClientMissing) {
                                                        setHighlightClientErrors(false);
                                                    }
                                                }
                                            }}
                                            className={`w-full px-3 py-1.5 text-xs rounded-[4px] font-semibold transition-all ${
                                                hasSiteError
                                                    ? 'border-2 border-rose-500 bg-rose-50/40 text-rose-950 ring-2 ring-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-500'
                                                    : 'border border-gray-300 focus:outline-none focus:ring-1 focus:ring-[#001d35] bg-white text-[#001d35]'
                                            }`}
                                        >
                                            <option value="">-- Sans chantier spécifique --</option>
                                            {selectedClient.sites.map(s => (
                                                <option key={s.id} value={s.name}>
                                                    🏗️ {s.name} {s.location ? `(${s.location})` : ''} [{s.status === 'completed' ? 'Terminé' : 'Actif'}]
                                                </option>
                                            ))}
                                            <option value="__NEW__" className="font-bold text-blue-700">+ Ajouter un nouveau chantier...</option>
                                        </select>
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        <div className="relative">
                                            <input
                                                ref={siteInputRef}
                                                type="text"
                                                value={siteName}
                                                onChange={(e) => {
                                                    setSiteName(e.target.value);
                                                    if (highlightClientErrors && e.target.value.trim() && !isClientMissing) {
                                                        setHighlightClientErrors(false);
                                                    }
                                                }}
                                                placeholder="Ex: Villa Agoè, Immeuble Port..."
                                                className={`w-full px-3 py-1.5 text-xs rounded-[4px] transition-all ${
                                                    hasSiteError
                                                        ? 'border-2 border-rose-500 bg-rose-50/40 text-rose-950 ring-2 ring-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-500 placeholder:text-rose-400'
                                                        : 'border border-gray-300 focus:outline-none focus:ring-1 focus:ring-[#001d35] bg-white text-gray-800'
                                                }`}
                                            />
                                            {selectedClient && selectedClient.sites && selectedClient.sites.length > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedSiteMode('existing')}
                                                    className="text-[10px] text-blue-600 hover:underline font-bold mt-1 block cursor-pointer"
                                                >
                                                    ← Choisir parmi les chantiers enregistrés
                                                </button>
                                            )}
                                        </div>
                                        {selectedClient && siteName.trim() && selectedSiteMode === 'new' && (
                                            <label className="flex items-center gap-1.5 text-[11px] text-gray-600 font-semibold cursor-pointer pt-0.5">
                                                <input
                                                    type="checkbox"
                                                    checked={saveNewSiteToProfile}
                                                    onChange={(e) => setSaveNewSiteToProfile(e.target.checked)}
                                                    className="w-3.5 h-3.5 accent-[#001d35] rounded-[2px]"
                                                />
                                                <span>Sauvegarder ce chantier dans la fiche client</span>
                                            </label>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Logistics details (Driver, Notes) if Bon à Enlever */}
                        {deliveryMode === 'warehouse' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-gray-200">
                                <div>
                                    <label className="block text-[10px] font-semibold text-gray-600 uppercase tracking-wider mb-1">
                                        Véhicule / Tricycle (Optionnel)
                                    </label>
                                    <input
                                        type="text"
                                        value={vehicleNumber}
                                        onChange={(e) => setVehicleNumber(e.target.value)}
                                        placeholder="Ex: Tricycle TG-4521"
                                        className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-[4px] focus:outline-none focus:ring-1 focus:ring-[#001d35] bg-white text-gray-800"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-semibold text-gray-600 uppercase tracking-wider mb-1">
                                        Instructions Magasinier (Optionnel)
                                    </label>
                                    <input
                                        type="text"
                                        value={deliveryNotes}
                                        onChange={(e) => setDeliveryNotes(e.target.value)}
                                        placeholder="Ex: Prévoir retrait en 2 fois"
                                        className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-[4px] focus:outline-none focus:ring-1 focus:ring-[#001d35] bg-white text-gray-800"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── 3. BON D'AVOIR / CRÉDIT D'ACHAT CLIENT ── */}
                    <div className="bg-slate-50/70 border border-gray-200 rounded-[4px] p-3 space-y-2">
                        <div className="flex justify-between items-center pb-1.5 border-b border-gray-200">
                            <div className="flex items-center gap-1.5 text-[#001d35] font-semibold text-xs uppercase tracking-wider">
                                <Ticket className="w-3.5 h-3.5 text-[#001d35]" />
                                <span>3. Bon d'Avoir / Crédit d'Achat</span>
                            </div>
                            {!appliedCreditNote && (
                                <button
                                    type="button"
                                    onClick={() => setShowVoucherInput(!showVoucherInput)}
                                    className="text-[10px] text-[#001d35] hover:text-[#f77500] font-semibold underline cursor-pointer"
                                >
                                    {showVoucherInput ? "Masquer saisie code" : "Saisir un code d'avoir"}
                                </button>
                            )}
                        </div>

                        {/* If voucher is already applied */}
                        {appliedCreditNote ? (
                            <div className={`border rounded-[4px] p-2.5 flex justify-between items-center text-xs shadow-xs ${
                                appliedCreditNote.type === 'change_reliquat'
                                    ? 'bg-amber-50/90 border-amber-400 ring-1 ring-amber-300'
                                    : 'bg-emerald-50 border-emerald-300'
                            }`}>
                                <div className="flex items-center gap-2">
                                    <div className={`p-1.5 text-white rounded-[4px] shadow-2xs ${
                                        appliedCreditNote.type === 'change_reliquat' ? 'bg-amber-600' : 'bg-emerald-600'
                                    }`}>
                                        <Ticket className="w-4 h-4 text-white" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-900 flex flex-wrap items-center gap-1.5">
                                            <span className={appliedCreditNote.type === 'change_reliquat' ? 'text-amber-950 font-black' : 'text-emerald-950'}>
                                                Avoir {appliedCreditNote.code}
                                            </span>
                                            {appliedCreditNote.type === 'change_reliquat' ? (
                                                <span className="text-[10px] bg-amber-500 text-white px-2 py-0.5 rounded-[2px] font-black uppercase tracking-wider animate-pulse flex items-center gap-1 shadow-2xs">
                                                    🎟️ RELIQUAT DE MONNAIE
                                                </span>
                                            ) : (
                                                <span className="text-[10px] bg-blue-100 text-blue-900 px-1.5 py-0.5 rounded-[2px] font-bold uppercase tracking-wider">
                                                    📦 RETOUR ARTICLE
                                                </span>
                                            )}
                                            <span className="text-[10px] bg-emerald-200 text-emerald-900 px-1.5 py-0.5 rounded-[2px] font-bold uppercase tracking-wider">
                                                Appliqué
                                            </span>
                                        </p>
                                        <p className="text-[11px] text-gray-700 mt-0.5">
                                            Montant déduit : -<strong>{formatPrice(noteDeduction)}</strong> • Reste sur l'avoir : {formatPrice(Math.max(0, appliedCreditNote.remainingAmount - noteDeduction))}
                                            {appliedCreditNote.notes && <span className="italic text-gray-500 ml-1">({appliedCreditNote.notes})</span>}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleRemoveVoucher}
                                    className="text-xs font-bold uppercase tracking-wider text-rose-600 hover:text-rose-800 underline cursor-pointer shrink-0 ml-2"
                                >
                                    Retirer
                                </button>
                            </div>
                        ) : (
                            <>
                                {/* Client available credit notes */}
                                {clientAvailableCreditNotes.length > 0 && (
                                    <div className="space-y-1.5">
                                        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                                            <span>Bons d'avoirs disponibles pour {customerName || 'ce client'} ({clientAvailableCreditNotes.length}) :</span>
                                            {clientAvailableReliquats.length > 0 && (
                                                <span className="text-[9px] bg-amber-500 text-white font-black px-1.5 py-0.2 rounded-[2px] uppercase animate-pulse">
                                                    Dont Reliquat Monnaie
                                                </span>
                                            )}
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {clientAvailableCreditNotes.map(note => {
                                                const isReliquat = note.type === 'change_reliquat';
                                                return (
                                                    <button
                                                        key={note.id}
                                                        type="button"
                                                        onClick={() => handleApplyVoucher(note.code)}
                                                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] text-xs font-bold transition-all shadow-2xs cursor-pointer border ${
                                                            isReliquat
                                                                ? 'bg-amber-50 hover:bg-amber-100 border-amber-400 text-amber-950 ring-1 ring-amber-300'
                                                                : 'bg-white border-gray-300 hover:border-[#001d35] text-[#001d35] hover:bg-slate-50'
                                                        }`}
                                                    >
                                                        <Ticket className={`w-3.5 h-3.5 ${isReliquat ? 'text-amber-600' : 'text-[#f77500]'}`} />
                                                        <span>{note.code} ({formatPrice(note.remainingAmount)})</span>
                                                        {isReliquat ? (
                                                            <span className="text-[9px] bg-amber-500 text-white font-black px-1.5 py-0.2 rounded-[2px] uppercase">
                                                                🎟️ Reliquat
                                                            </span>
                                                        ) : (
                                                            <span className="text-[9px] bg-slate-100 text-slate-700 font-semibold px-1 py-0.2 rounded-[2px] uppercase border border-slate-200">
                                                                Retour
                                                            </span>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Manual code input */}
                                {(showVoucherInput || clientAvailableCreditNotes.length === 0) && (
                                    <div className="space-y-1">
                                        <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                                            Saisir un Code Bon d'Avoir (ex: AVR-...)
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                placeholder="Code Bon d'Avoir"
                                                value={voucherCodeInput}
                                                onChange={(e) => setVoucherCodeInput(e.target.value.toUpperCase())}
                                                className="flex-1 px-3 py-1.5 text-xs border border-gray-300 rounded-[4px] font-mono font-bold uppercase focus:outline-none focus:ring-1 focus:ring-[#001d35] bg-white"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => handleApplyVoucher()}
                                                className="bg-[#001d35] hover:bg-[#00284a] text-white px-3.5 py-1.5 rounded-[4px] text-xs font-semibold uppercase tracking-wider cursor-pointer transition-colors shadow-xs"
                                            >
                                                Appliquer
                                            </button>
                                        </div>
                                        {voucherError && (
                                            <p className="text-[11px] font-bold text-rose-600">{voucherError}</p>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* ── 4. MODE DE RÈGLEMENT & ENCAISSEMENT (UNIFIÉ AVEC LE POS) ── */}
                    <div className="bg-slate-50/70 border border-gray-200 rounded-[4px] p-3 space-y-3">
                        <div className="flex justify-between items-center pb-1.5 border-b border-gray-200">
                            <div className="flex items-center gap-1.5 text-[#001d35] font-semibold text-xs uppercase tracking-wider">
                                <Wallet className="w-3.5 h-3.5 text-[#001d35]" />
                                <span>4. Mode de Règlement {netToPay > 0 && appliedCreditNote ? "(Reste à régler)" : ""}</span>
                            </div>
                            {netToPay > 0 && (
                                <span className="text-xs font-bold text-[#001d35]">
                                    À payer : {formatPrice(netToPay)}
                                </span>
                            )}
                        </div>

                        {netToPay === 0 ? (
                            <div className="bg-emerald-50 border border-emerald-300 rounded-[4px] p-3 text-center space-y-1">
                                <div className="inline-flex p-1.5 bg-emerald-600 text-white rounded-full mb-0.5">
                                    <Check className="w-4 h-4" />
                                </div>
                                <p className="font-bold text-xs text-emerald-950 uppercase tracking-wide">
                                    Total 100% Réglé par Bon d'Avoir
                                </p>
                                <p className="text-[11px] text-emerald-800">
                                    Aucun règlement en espèces ou mobile requis. Le solde du panier est intégralement couvert par l'avoir.
                                </p>
                            </div>
                        ) : (
                            <>
                                {/* Grille des 4 modes de paiement (toujours visible pour flexibilité caissier) */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {/* 1. Espèces (Cash) */}
                                    <button
                                        type="button"
                                        onClick={() => handleMethodSelect('cash')}
                                        className={`flex flex-col items-center justify-center gap-1 p-2.5 rounded-[4px] border transition-all cursor-pointer ${
                                            paymentMethod === 'cash'
                                                ? 'bg-[#001d35] text-white border-[#001d35] shadow-xs ring-1 ring-[#001d35]'
                                                : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-700'
                                        }`}
                                    >
                                        <Coins className={`w-4 h-4 ${paymentMethod === 'cash' ? 'text-[#f77500]' : 'text-gray-500'}`} />
                                        <span className="font-semibold text-xs uppercase tracking-wide">Espèces</span>
                                        <span className={`text-[10px] ${paymentMethod === 'cash' ? 'text-gray-300' : 'text-gray-400'}`}>Cash</span>
                                    </button>

                                    {/* 2. Mobile / Carte */}
                                    <button
                                        type="button"
                                        onClick={() => handleMethodSelect('card')}
                                        className={`flex flex-col items-center justify-center gap-1 p-2.5 rounded-[4px] border transition-all cursor-pointer ${
                                            paymentMethod === 'card'
                                                ? 'bg-[#001d35] text-white border-[#001d35] shadow-xs ring-1 ring-[#001d35]'
                                                : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-700'
                                        }`}
                                    >
                                        <CreditCard className={`w-4 h-4 ${paymentMethod === 'card' ? 'text-blue-300' : 'text-gray-500'}`} />
                                        <span className="font-semibold text-xs uppercase tracking-wide">Mobile / Carte</span>
                                        <span className={`text-[10px] ${paymentMethod === 'card' ? 'text-gray-300' : 'text-gray-400'}`}>T-Money / Flooz</span>
                                    </button>

                                    {/* 3. Crédit Client */}
                                    <button
                                        type="button"
                                        onClick={() => handleMethodSelect('credit')}
                                        className={`flex flex-col items-center justify-center gap-1 p-2.5 rounded-[4px] border transition-all cursor-pointer ${
                                            paymentMethod === 'credit'
                                                ? 'bg-rose-700 text-white border-rose-800 shadow-xs ring-1 ring-rose-700'
                                                : 'bg-white hover:bg-rose-50 border-rose-200 text-rose-700'
                                        }`}
                                    >
                                        <Users className={`w-4 h-4 ${paymentMethod === 'credit' ? 'text-white' : 'text-rose-600'}`} />
                                        <span className="font-semibold text-xs uppercase tracking-wide">Crédit Client</span>
                                        <span className={`text-[10px] ${paymentMethod === 'credit' ? 'text-rose-100' : 'text-rose-500'}`}>Compte client</span>
                                    </button>

                                    {/* 4. Bon d'Avoir */}
                                    <button
                                        type="button"
                                        onClick={() => handleMethodSelect('avoir')}
                                        className={`flex flex-col items-center justify-center gap-1 p-2.5 rounded-[4px] border transition-all cursor-pointer ${
                                            paymentMethod === 'avoir'
                                                ? 'bg-purple-700 text-white border-purple-800 shadow-xs ring-1 ring-purple-700'
                                                : 'bg-white hover:bg-purple-50 border-purple-200 text-purple-700'
                                        }`}
                                    >
                                        <Ticket className={`w-4 h-4 ${paymentMethod === 'avoir' ? 'text-white' : 'text-purple-600'}`} />
                                        <span className="font-semibold text-xs uppercase tracking-wide">Bon d'Avoir</span>
                                        <span className={`text-[10px] ${paymentMethod === 'avoir' ? 'text-purple-100' : 'text-purple-500'}`}>Code Avoir</span>
                                    </button>
                                </div>

                                {paymentMethod && paymentMethod !== 'avoir' && (
                                    <div className="space-y-3 pt-1">
                                        <div>
                                            <label className="block text-[10px] font-semibold text-gray-600 uppercase tracking-wider mb-1">
                                                {paymentMethod === 'cash' 
                                                    ? 'Montant perçu en espèces' 
                                                    : (paymentMethod === 'credit' ? "Acompte versé aujourd'hui (0 si crédit total)" : 'Montant')}
                                            </label>
                                            <div className="relative">
                                                <FinancialInput
                                                    value={amountGiven}
                                                    onChange={handleAmountChange}
                                                    disabled={paymentMethod === 'card'}
                                                    placeholder="0"
                                                    className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-[4px] focus:outline-none focus:ring-1 focus:ring-[#001d35] font-semibold text-base text-[#001d35] disabled:bg-gray-100 pr-16"
                                                    autoFocus={paymentMethod === 'cash' && deliveryMode !== 'warehouse'}
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">
                                                    FCFA
                                                </span>
                                            </div>
                                        </div>

                                        {/* Affichage Monnaie Due (Thème Emerald identique au POS) */}
                                        {paymentMethod === 'cash' && amountGiven && change > 0 && (
                                            <div className="space-y-2 mt-2">
                                                <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-[4px] px-3 py-2 flex items-center justify-between text-xs font-semibold">
                                                    <div>
                                                        <span className="text-[10px] uppercase font-semibold text-emerald-900 tracking-wider block">Monnaie théorique due au client :</span>
                                                        <span className="text-[11px] text-emerald-700 font-medium">Sur versement de {formatPrice(parseFloat(amountGiven))}</span>
                                                    </div>
                                                    <span className="text-lg font-bold text-emerald-700">{formatPrice(change)}</span>
                                                </div>

                                                {/* Module Gestion Manque de Monnaie / Reliquat */}
                                                <div className={`p-2.5 rounded-[4px] border transition-all ${
                                                    hasChangeShortage 
                                                        ? 'bg-blue-50/70 border-[#001d35]' 
                                                        : 'bg-white border-gray-200'
                                                }`}>
                                                    <label className="flex items-center gap-2 cursor-pointer select-none">
                                                        <input
                                                            type="checkbox"
                                                            checked={hasChangeShortage}
                                                            onChange={(e) => {
                                                                const checked = e.target.checked;
                                                                setHasChangeShortage(checked);
                                                                if (checked) {
                                                                    setActualCashReturned(0);
                                                                }
                                                            }}
                                                            className="w-4 h-4 rounded-[2px] accent-[#f77500] cursor-pointer"
                                                        />
                                                        <div className="flex-1">
                                                            <span className="text-xs font-bold text-[#001d35] uppercase tracking-wider flex items-center gap-1.5">
                                                                <Coins className="w-3.5 h-3.5 text-[#f77500]" />
                                                                Pas la monnaie exacte ? (Gestion du Reliquat)
                                                            </span>
                                                            <p className="text-[11px] text-gray-500 font-normal">
                                                                Émettez un Bon d'Avoir ou créditez le compte client au lieu de rendre en espèces.
                                                            </p>
                                                        </div>
                                                    </label>

                                                    {hasChangeShortage && (
                                                        <div className="mt-2.5 pt-2.5 border-t border-gray-200 space-y-2 animate-in fade-in duration-150">
                                                            <div className="grid grid-cols-2 gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setReliquatType('voucher')}
                                                                    className={`p-2 rounded-[4px] border text-left transition-all cursor-pointer ${
                                                                        reliquatType === 'voucher'
                                                                            ? 'bg-[#001d35] text-white border-[#001d35] shadow-xs'
                                                                            : 'bg-white hover:bg-gray-50 border-gray-300 text-gray-800'
                                                                    }`}
                                                                >
                                                                    <span className="text-xs font-bold uppercase tracking-wider block">🎟️ Bon de Reliquat</span>
                                                                    <span className={`text-[10px] block mt-0.5 ${reliquatType === 'voucher' ? 'text-gray-300' : 'text-gray-500'}`}>
                                                                        Avoir imprimé avec code unique
                                                                    </span>
                                                                </button>

                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setReliquatType('client_credit');
                                                                        if (isClientMissing || isSiteMissing) {
                                                                            scrollToClientSection();
                                                                        }
                                                                    }}
                                                                    className={`p-2 rounded-[4px] border text-left transition-all cursor-pointer ${
                                                                        reliquatType === 'client_credit'
                                                                            ? 'bg-[#001d35] text-white border-[#001d35] shadow-xs'
                                                                            : 'bg-white hover:bg-gray-50 border-gray-300 text-gray-800'
                                                                    }`}
                                                                >
                                                                    <span className="text-xs font-bold uppercase tracking-wider block">👤 Compte Client</span>
                                                                    <span className={`text-[10px] block mt-0.5 ${reliquatType === 'client_credit' ? 'text-gray-300' : 'text-gray-500'}`}>
                                                                        Avance créditée sur sa fiche
                                                                    </span>
                                                                </button>
                                                            </div>

                                                            {reliquatType === 'client_credit' && (isClientMissing || isSiteMissing) && (
                                                                <div className="text-[11px] text-amber-800 bg-amber-50 p-2 rounded-[3px] border border-amber-200 font-medium flex items-center justify-between">
                                                                    <span>⚠️ Renseignez le client et le chantier dans la section « 2. Compte Client » ci-dessus pour lui attribuer cet avoir.</span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => scrollToClientSection()}
                                                                        className="text-[10px] font-bold text-amber-900 underline hover:text-amber-950 ml-2 shrink-0 cursor-pointer"
                                                                    >
                                                                        Renseigner ↑
                                                                    </button>
                                                                </div>
                                                            )}

                                                            {/* Saisie monnaie réellement rendue */}
                                                            <div className="bg-slate-50 p-2.5 rounded-[4px] border border-gray-200 space-y-1.5">
                                                                <div className="flex justify-between items-center text-xs">
                                                                    <span className="text-gray-600 font-medium">Monnaie rendue en pièces/billets :</span>
                                                                    <div className="flex items-center gap-1">
                                                                        <input
                                                                            type="number"
                                                                            min="0"
                                                                            max={change}
                                                                            value={actualCashReturned}
                                                                            onChange={(e) => setActualCashReturned(Math.min(change, Math.max(0, parseFloat(e.target.value) || 0)))}
                                                                            className="w-24 text-right px-2 py-1 text-xs border border-gray-300 rounded-[4px] font-bold text-[#001d35] focus:outline-none focus:ring-1 focus:ring-[#001d35] bg-white"
                                                                            placeholder="0"
                                                                        />
                                                                        <span className="text-[10px] text-gray-500 font-semibold">FCFA</span>
                                                                    </div>
                                                                </div>

                                                                <div className="flex justify-between items-center text-xs pt-1.5 border-t border-gray-200 font-bold">
                                                                    <span className="text-amber-800">
                                                                        Reliquat non rendu mis en {reliquatType === 'voucher' ? "Bon d'Avoir" : 'Avance Client'} :
                                                                    </span>
                                                                    <span className="text-amber-900 bg-amber-50 px-2 py-0.5 rounded-[3px] border border-amber-200">
                                                                        {formatPrice(Math.max(0, change - (parseFloat(actualCashReturned) || 0)))}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* ── 5. SÉCURISATION PLAFOND DE CRÉDIT (STYLE HARMONISÉ) ── */}
                    {paymentMethod === 'credit' && selectedClient && (
                        <div className={`p-3 rounded-[4px] border space-y-2.5 ${
                            isCreditLimitExceeded 
                                ? 'bg-rose-50 border-rose-300 text-rose-950' 
                                : 'bg-emerald-50 border-emerald-300 text-emerald-950'
                        }`}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider">
                                    {isCreditLimitExceeded ? (
                                        <>
                                            <AlertTriangle className="w-4 h-4 text-rose-600 animate-bounce" />
                                            <span className="text-rose-700">Dépassement du Plafond de Crédit</span>
                                        </>
                                    ) : (
                                        <>
                                            <Check className="w-4 h-4 text-emerald-600" />
                                            <span className="text-emerald-800">Contrôle Solvabilité Conforme</span>
                                        </>
                                    )}
                                </div>
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-[3px] bg-white border border-gray-200">
                                    Plafond : {clientCreditLimit > 0 ? formatPrice(clientCreditLimit) : 'Illimité (Non plafonné)'}
                                </span>
                            </div>

                            <div className="text-xs space-y-1 bg-white/80 p-2.5 rounded-[3px] border border-black/5">
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Dette antérieure en cours :</span>
                                    <span className="font-bold text-gray-900">{formatPrice(currentOutstandingDebt)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">+ Ce nouveau crédit (après acompte) :</span>
                                    <span className="font-bold text-[#001d35]">+{formatPrice(newDebtAmount)}</span>
                                </div>
                                <div className="flex justify-between border-t border-gray-200 pt-1 font-bold text-xs">
                                    <span>= Dette totale après cette vente :</span>
                                    <span className={isCreditLimitExceeded ? 'text-rose-700' : 'text-emerald-800'}>
                                        {formatPrice(projectedTotalDebt)}
                                    </span>
                                </div>
                                {isCreditLimitExceeded && (
                                    <div className="flex justify-between text-xs font-bold text-rose-600 pt-0.5">
                                        <span>Excédent non autorisé :</span>
                                        <span>+{formatPrice(excessAmount)}</span>
                                    </div>
                                )}
                            </div>

                            {/* Override Checkbox if exceeded */}
                            {isCreditLimitExceeded && (
                                <div className="pt-2 border-t border-rose-200">
                                    <label className="flex items-start gap-2.5 cursor-pointer bg-white p-2.5 rounded-[4px] border border-rose-300">
                                        <input
                                            type="checkbox"
                                            checked={overrideCreditLimit}
                                            onChange={(e) => setOverrideCreditLimit(e.target.checked)}
                                            className="w-4 h-4 mt-0.5 text-rose-600 rounded-[2px] accent-rose-600 cursor-pointer"
                                        />
                                        <div>
                                            <span className="text-xs font-bold text-rose-900 uppercase tracking-wide block">
                                                Dérogation Exceptionnelle de la Direction
                                            </span>
                                            <span className="text-[11px] text-rose-700">
                                                Cocher pour forcer l'enregistrement de cette vente malgré le dépassement du plafond autorisé.
                                            </span>
                                        </div>
                                    </label>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Message d'erreur */}
                    {error && (
                        <div className="bg-rose-50 border border-rose-300 text-rose-800 px-3.5 py-2.5 rounded-[4px] text-xs font-semibold flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}
                </div>

                {/* ── FOOTER ACTIONS HARMONISÉ ── */}
                <div className="p-3.5 bg-white border-t border-gray-200 flex gap-2.5 shrink-0">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={isProcessing}
                        className="flex-1 py-2 border border-gray-300 text-gray-700 font-semibold uppercase tracking-wider text-xs hover:bg-gray-50 rounded-[4px] cursor-pointer transition-colors disabled:opacity-50"
                    >
                        Annuler
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={isProcessing || (isCreditLimitExceeded && !overrideCreditLimit)}
                        className={`flex-1 py-2 font-semibold uppercase tracking-wider text-xs rounded-[4px] cursor-pointer transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 ${
                            isCreditLimitExceeded && !overrideCreditLimit
                                ? 'bg-gray-400 cursor-not-allowed text-white'
                                : paymentMethod === 'credit'
                                ? 'bg-rose-700 hover:bg-rose-800 text-white'
                                : 'bg-[#001d35] hover:bg-[#00284a] text-white'
                        }`}
                    >
                        {isProcessing ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : paymentMethod === 'credit' ? (
                            "✍️ Enregistrer la Vente à Crédit"
                        ) : (
                            "💳 Valider le Paiement"
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PaymentModal;
