import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useClients } from '../../context/ClientContext';
import { useSales } from '../../context/SalesContext';
import { 
    Search, Plus, User, Users, Edit2, Trash2, X, AlertTriangle, Eye, Printer, 
    Phone, MapPin, Building2, CreditCard, CheckCircle2, Clock, Check, 
    ChevronLeft, ChevronRight, MessageSquare, Download, Calendar, DollarSign, ArrowUpRight, 
    ArrowDownRight, Tag, ShieldCheck, ShieldAlert, FileText, CheckSquare, Layers,
    Ticket, Wallet, History, UserCheck, UserPlus, Coins, Filter
} from 'lucide-react';
import { formatPrice } from '../../utils/currency';
import T from '../../utils/toast';

const Clients = () => {
    const { clients, addClient, updateClient, deleteClient, addSite, updateSite, deleteSite } = useClients();
    const { debts, addDebtPayment, transactions, creditNotes, useCreditNote } = useSales();

    // ── Loader d'entrée de page (scroll top + 1,5s) ──
    const [isPageLoading, setIsPageLoading] = useState(true);
    const pageLoadTimerRef = useRef(null);

    // ── Loader de 1 seconde sur chaque sélection de filtre (Identique à Inventaire Physique) ──
    const [filterLoading, setFilterLoading] = useState(false);
    const filterTimerRef = useRef(null);

    const handleFilterChange = (setterOrFn, value) => {
        setFilterLoading(true);
        setOpsPage(1); // Réinitialiser à la page 1 sur tout changement de filtre
        if (typeof setterOrFn === 'function') {
            if (value !== undefined) {
                setterOrFn(value);
            } else {
                setterOrFn();
            }
        }
        if (filterTimerRef.current) clearTimeout(filterTimerRef.current);
        filterTimerRef.current = setTimeout(() => {
            setFilterLoading(false);
        }, 1000); // 1 seconde
    };

    // ── Loader de validation d'au moins 1,5s pour les actions métier ──
    const [actionLoading, setActionLoading] = useState(null);

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
        pageLoadTimerRef.current = setTimeout(() => {
            setIsPageLoading(false);
        }, 1500);
        return () => {
            if (pageLoadTimerRef.current) clearTimeout(pageLoadTimerRef.current);
            if (filterTimerRef.current) clearTimeout(filterTimerRef.current);
        };
    }, []);

    const triggerActionLoading = (message, callback) => {
        setActionLoading(message);
        setTimeout(() => {
            callback();
            setActionLoading(null);
        }, 1500);
    };

    // Filters and search
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('all'); // 'all', 'particulier', 'artisan', 'entreprise', 'debtor'
    const [creditStatusFilter, setCreditStatusFilter] = useState('all'); // 'all', 'debtor', 'exceeded', 'avance', 'avoir', 'up_to_date'
    const [clientPeriod, setClientPeriod] = useState('today'); // 'today' (par défaut) | '7days' | 'month' | 'all' | 'custom'
    const [clientCustomStartDate, setClientCustomStartDate] = useState('');
    const [clientCustomEndDate, setClientCustomEndDate] = useState('');
    const [currentView, setCurrentView] = useState('clients'); // 'clients' | 'operations'
    const [operationFilter, setOperationFilter] = useState('none'); // 'none' (Aucun par défaut) | 'all' (Toutes les opérations) | 'reliquat_credit' | ...
    const [operationClientFilter, setOperationClientFilter] = useState('all'); // 'all' (Tous les clients) | nom du client
    const [operationPeriod, setOperationPeriod] = useState('today'); // 'today' par défaut (pour ne pas surcharger le serveur) | '7days' | 'month' | 'all' | 'custom'
    const [operationCustomStartDate, setOperationCustomStartDate] = useState('');
    const [operationCustomEndDate, setOperationCustomEndDate] = useState('');

    // ── Sélection multiple de clients (Checkbox & Bulk Check) ──
    const [selectedClientIds, setSelectedClientIds] = useState([]);

    // ── Sélection multiple d'opérations (Checkbox & Bulk Check) ──
    const [selectedOperationIds, setSelectedOperationIds] = useState([]);

    // ── Pagination pour l'Historique des opérations (10 par page par défaut) ──
    const [opsPage, setOpsPage] = useState(1);
    const [opsPerPage, setOpsPerPage] = useState(10);

    // Client Form Modal (Create / Edit)
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        email: '',
        address: '',
        type: 'particulier',
        nif: '',
        creditLimit: 0,
        pricingTier: 'normal'
    });

    // Fiche Client 360° Modal
    const [selectedClient360, setSelectedClient360] = useState(null);
    const [activeTab360, setActiveTab360] = useState('chantiers'); // 'chantiers', 'dettes', 'achats'
    const [siteFilterForPurchases, setSiteFilterForPurchases] = useState('all');

    // Quick Debt Payment Modal inside 360°
    const [paymentDebtTarget, setPaymentDebtTarget] = useState(null);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [debtPaymentMethod, setDebtPaymentMethod] = useState('cash'); // 'cash' | 'avoir' | 'wave_om' | 'check' | 'bank'
    const [debtPaymentNote, setDebtPaymentNote] = useState('');
    const [lastDebtPaymentReceipt, setLastDebtPaymentReceipt] = useState(null);

    // New Site Form inside 360°
    const [isAddingSite, setIsAddingSite] = useState(false);
    const [newSiteData, setNewSiteData] = useState({
        name: '',
        location: '',
        status: 'active',
        notes: ''
    });

    // Enriched client list with calculated debts, sites and avoirs
    const enrichedClients = useMemo(() => {
        const now = Date.now();
        return clients.map(client => {
            const clientActiveDebts = debts.filter(d => 
                (d.clientId && d.clientId === client.id) || 
                (d.customerName && d.customerName.toLowerCase().trim() === client.name.toLowerCase().trim())
            );
            
            const totalDebt = clientActiveDebts
                .filter(d => d.status === 'pending')
                .reduce((sum, d) => sum + Math.max(0, (d.totalAmount || 0) - (d.paidAmount || 0)), 0);

            const activeSitesCount = (client.sites || []).filter(s => s.status !== 'completed').length;
            const totalSitesCount = (client.sites || []).length;
            const limit = parseFloat(client.creditLimit) || 0;
            const isExceeded = limit > 0 && totalDebt > limit;
            const utilizationRate = limit > 0 ? Math.min(100, Math.round((totalDebt / limit) * 100)) : 0;

            // Avoirs et Avances actifs
            const activeAvoirs = (creditNotes || []).filter(cn =>
                (cn.status === 'active' || cn.status === 'partial') &&
                cn.remainingAmount > 0 &&
                new Date(cn.expiresAt).getTime() >= now &&
                ((cn.clientId && String(cn.clientId) === String(client.id)) ||
                 (cn.customerName && client.name && cn.customerName.toLowerCase().trim() === client.name.toLowerCase().trim()))
            );
            const totalAvoir = activeAvoirs.reduce((sum, cn) => sum + (cn.remainingAmount || 0), 0);

            // Avances créditées directement sur compte client (choix 'client_credit')
            const clientAdvances = activeAvoirs.filter(cn => cn.reliquatMode === 'client_credit');
            const totalAvance = clientAdvances.reduce((sum, cn) => sum + (cn.remainingAmount || 0), 0);
            const hasAvance = totalAvance > 0;

            // Reliquats sous forme de bon d'avoir imprimé (choix 'voucher')
            const voucherReliquats = activeAvoirs.filter(cn => cn.type === 'change_reliquat' && cn.reliquatMode !== 'client_credit');
            const totalReliquatVoucher = voucherReliquats.reduce((sum, cn) => sum + (cn.remainingAmount || 0), 0);
            const hasReliquat = totalReliquatVoucher > 0;

            // Avoirs standards (retours d'articles)
            const standardAvoirs = activeAvoirs.filter(cn => cn.type !== 'change_reliquat');
            const totalAvoirStandard = standardAvoirs.reduce((sum, cn) => sum + (cn.remainingAmount || 0), 0);

            return {
                ...client,
                creditLimit: limit,
                totalDebt,
                allDebts: clientActiveDebts,
                activeSitesCount,
                totalSitesCount,
                isExceeded,
                utilizationRate,
                activeAvoirs,
                totalAvoir,
                clientAdvances,
                totalAvance,
                hasAvance,
                voucherReliquats,
                totalReliquatVoucher,
                hasReliquat,
                standardAvoirs,
                totalAvoirStandard,
                totalReliquat: totalReliquatVoucher + totalAvance
            };
        });
    }, [clients, debts, creditNotes]);

    // Active 360° Client live data (kept in sync with state)
    const active360Client = useMemo(() => {
        if (!selectedClient360) return null;
        return enrichedClients.find(c => c.id === selectedClient360.id) || selectedClient360;
    }, [selectedClient360, enrichedClients]);

    // ── Helper pour filtrage temporel ──
    const isWithinOpPeriod = (dateStr, periodKey, startCustom, endCustom) => {
        if (!dateStr) return false;
        if (periodKey === 'all') return true;

        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return true;
        const now = new Date();

        if (periodKey === 'today') {
            return d.getFullYear() === now.getFullYear() &&
                d.getMonth() === now.getMonth() &&
                d.getDate() === now.getDate();
        }

        if (periodKey === '7days') {
            const diffMs = now.getTime() - d.getTime();
            return diffMs <= (7 * 24 * 60 * 60 * 1000) && diffMs >= -(60 * 60 * 1000);
        }

        if (periodKey === 'month') {
            return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
        }

        if (periodKey === 'custom') {
            if (!startCustom && !endCustom) return true;
            const opTime = d.getTime();
            if (startCustom && !endCustom) {
                return opTime >= new Date(startCustom + 'T00:00:00').getTime();
            }
            if (!startCustom && endCustom) {
                return opTime <= new Date(endCustom + 'T23:59:59').getTime();
            }
            return opTime >= new Date(startCustom + 'T00:00:00').getTime() &&
                opTime <= new Date(endCustom + 'T23:59:59').getTime();
        }

        return true;
    };

    // Filtered list
    const filteredClients = useMemo(() => {
        return enrichedClients.filter(c => {
            const matchSearch = 
                c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                (c.phone && c.phone.includes(searchTerm)) ||
                (c.address && c.address.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (c.sites && c.sites.some(s => s.name.toLowerCase().includes(searchTerm.toLowerCase())));
            
            if (!matchSearch) return false;

            if (typeFilter === 'debtor') {
                if (c.totalDebt <= 0) return false;
            } else if (typeFilter !== 'all') {
                if (c.type !== typeFilter) return false;
            }

            // Statut Crédit & Encours
            if (creditStatusFilter === 'debtor') {
                if (c.totalDebt <= 0) return false;
            } else if (creditStatusFilter === 'exceeded') {
                if (!c.isExceeded) return false;
            } else if (creditStatusFilter === 'avance') {
                if (c.totalAvance <= 0) return false;
            } else if (creditStatusFilter === 'avoir') {
                if (c.totalAvoirStandard <= 0 && c.totalReliquatVoucher <= 0) return false;
            } else if (creditStatusFilter === 'up_to_date') {
                if (c.totalDebt > 0) return false;
            }

            // Période (Date de création ou activité)
            if (clientPeriod !== 'all') {
                const datesToCheck = [];
                if (c.createdAt) datesToCheck.push(c.createdAt);
                if (c.updatedAt) datesToCheck.push(c.updatedAt);
                (c.allDebts || []).forEach(d => {
                    if (d.date) datesToCheck.push(d.date);
                    if (d.createdAt) datesToCheck.push(d.createdAt);
                });
                (c.activeAvoirs || []).forEach(a => {
                    if (a.createdAt) datesToCheck.push(a.createdAt);
                    if (a.date) datesToCheck.push(a.date);
                });

                if (datesToCheck.length > 0) {
                    const matchDate = datesToCheck.some(dt => isWithinOpPeriod(dt, clientPeriod, clientCustomStartDate, clientCustomEndDate));
                    if (!matchDate) return false;
                }
            }

            return true;
        });
    }, [enrichedClients, searchTerm, typeFilter, creditStatusFilter, clientPeriod, clientCustomStartDate, clientCustomEndDate]);

    // Global KPI metrics
    const metrics = useMemo(() => {
        const totalClients = enrichedClients.length;
        const debtors = enrichedClients.filter(c => c.totalDebt > 0);
        const totalOutstandingDebt = debtors.reduce((sum, c) => sum + c.totalDebt, 0);
        const totalActiveSites = enrichedClients.reduce((sum, c) => sum + (c.activeSitesCount || 0), 0);

        return {
            totalClients,
            debtorsCount: debtors.length,
            totalOutstandingDebt,
            totalActiveSites
        };
    }, [enrichedClients]);

    // ── JOURNAL D'AUDIT COMPLET & HISTORIQUE DES OPÉRATIONS CLIENTS ──
    const allOperationsList = useMemo(() => {
        const ops = [];

        // 1. Avoirs et Reliquats de caisse (avec distinction claire pour les avances sur compte client)
        (creditNotes || []).forEach(cn => {
            const isClientCredit = cn.reliquatMode === 'client_credit';
            const isReliquat = cn.type === 'change_reliquat';
            
            ops.push({
                id: `op_cn_${cn.id}`,
                date: cn.createdAt || new Date().toISOString(),
                category: isClientCredit ? 'reliquat_credit' : (isReliquat ? 'reliquat_voucher' : 'credit_note'),
                typeLabel: isClientCredit 
                    ? 'Avance Reliquat Compte Client' 
                    : (isReliquat ? "Bon Reliquat (Ticket)" : "Bon d'Avoir (Retour)"),
                badgeColor: isClientCredit 
                    ? 'bg-emerald-100 text-emerald-950 border-emerald-300 font-bold' 
                    : (isReliquat ? 'bg-amber-100 text-amber-950 border-amber-300' : 'bg-purple-100 text-purple-950 border-purple-300'),
                clientName: cn.customerName || 'Client Inconnu',
                clientId: cn.clientId || null,
                siteName: cn.siteName || null,
                amount: cn.initialAmount || 0,
                remainingAmount: cn.remainingAmount || 0,
                impactType: 'credit_advance', // Augmente l'avoir / avance du client
                refCode: cn.code,
                cashier: cn.cashierName || 'Caisse POS',
                notes: cn.notes || (isClientCredit ? "Monnaie non rendue créditée en avance sur le compte client" : "Avoir émis"),
                status: cn.status,
                raw: cn
            });
        });

        // 2. Créations de comptes clients (avec mise en exergue des créations automatiques via reliquat)
        (clients || []).forEach(c => {
            const isAutoCreated = c.createdVia === 'pos_reliquat' || (c.creationNote && c.creationNote.includes('reliquat'));
            ops.push({
                id: `op_client_${c.id}`,
                date: c.createdAt || new Date().toISOString(),
                category: isAutoCreated ? 'auto_client' : 'client_created',
                typeLabel: isAutoCreated 
                    ? 'Création Auto (Reliquat Caisse)' 
                    : 'Ouverture Compte Client',
                badgeColor: isAutoCreated 
                    ? 'bg-blue-100 text-[#001d35] border-blue-400 font-bold' 
                    : 'bg-slate-100 text-slate-800 border-slate-300',
                clientName: c.name,
                clientId: c.id,
                siteName: (c.sites && c.sites.length > 0) ? c.sites[0].name : null,
                amount: c.creditLimit || 0,
                impactType: 'info',
                refCode: `CLI-${(c.id || '').slice(-6).toUpperCase()}`,
                cashier: isAutoCreated ? 'Caisse POS (Automatique)' : 'Direction / CRM',
                notes: c.creationNote || (isAutoCreated 
                    ? "Compte créé automatiquement lors de la gestion du reliquat de monnaie en caisse"
                    : `Ouverture de compte (${c.type || 'particulier'} - ${c.phone || 'Sans contact'})`),
                status: 'active',
                raw: c
            });

            // Sites / chantiers rattachés au client
            (c.sites || []).forEach(s => {
                ops.push({
                    id: `op_site_${s.id}`,
                    date: s.createdAt || c.createdAt || new Date().toISOString(),
                    category: 'site',
                    typeLabel: 'Attribution Chantier',
                    badgeColor: 'bg-cyan-100 text-cyan-950 border-cyan-300',
                    clientName: c.name,
                    clientId: c.id,
                    siteName: s.name,
                    amount: 0,
                    impactType: 'info',
                    refCode: `SITE-${(s.id || '').slice(-6).toUpperCase()}`,
                    cashier: 'CRM / Caisse',
                    notes: `Chantier "${s.name}" (${s.location || 'Localisation non précisée'}) [${s.status === 'completed' ? 'Terminé' : 'Actif'}]`,
                    status: s.status,
                    raw: s
                });
            });
        });

        // 3. Règlements de dettes et ventes à crédit
        (debts || []).forEach(d => {
            // Vente à terme
            ops.push({
                id: `op_debt_${d.id}`,
                date: d.date || new Date().toISOString(),
                category: 'credit_sale',
                typeLabel: 'Vente à Crédit',
                badgeColor: 'bg-rose-100 text-rose-950 border-rose-300',
                clientName: d.customerName || 'Client Inconnu',
                clientId: d.clientId || null,
                siteName: d.siteName || null,
                amount: d.totalAmount || 0,
                remainingAmount: Math.max(0, (d.totalAmount || 0) - (d.paidAmount || 0)),
                impactType: 'debt_increase',
                refCode: `FAC-${d.id}`,
                cashier: 'Caisse POS',
                notes: `Facture crédit de ${formatPrice(d.totalAmount)} (Acompte: ${formatPrice(d.paidAmount || 0)})`,
                status: d.status,
                raw: d
            });

            // Règlements enregistrés sur cette dette
            (d.payments || []).forEach((p, pIdx) => {
                ops.push({
                    id: `op_pay_${p.id || `${d.id}_${pIdx}`}`,
                    date: p.date || d.date || new Date().toISOString(),
                    category: 'debt_payment',
                    typeLabel: 'Règlement Dette',
                    badgeColor: 'bg-emerald-100 text-emerald-950 border-emerald-300 font-bold',
                    clientName: d.customerName || 'Client Inconnu',
                    clientId: d.clientId || null,
                    siteName: d.siteName || null,
                    amount: p.amount || 0,
                    remainingAmount: 0,
                    impactType: 'debt_decrease',
                    refCode: `PAY-FAC-${d.id}`,
                    cashier: 'Caisse Recouvrement',
                    notes: `Versement de ${formatPrice(p.amount)} par ${p.method === 'cash' ? 'Espèces' : (p.method === 'avoir' ? "Bon d'Avoir" : (p.method === 'wave_om' ? 'Mobile Money' : p.method || 'Espèces'))}. ${p.note || ''}`,
                    status: 'completed',
                    raw: p
                });
            });
        });

        // Tri par date décroissante (plus récent au début)
        return ops.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [creditNotes, clients, debts]);

    // Filtrage dynamique de l'historique des opérations
    const filteredOperations = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        return allOperationsList.filter(op => {
            const matchesSearch = !term || (
                op.clientName.toLowerCase().includes(term) ||
                (op.siteName && op.siteName.toLowerCase().includes(term)) ||
                (op.refCode && op.refCode.toLowerCase().includes(term)) ||
                (op.notes && op.notes.toLowerCase().includes(term)) ||
                (op.typeLabel && op.typeLabel.toLowerCase().includes(term)) ||
                (op.cashier && op.cashier.toLowerCase().includes(term))
            );

            if (!matchesSearch) return false;

            // Filtre temporel par date
            if (!isWithinOpPeriod(op.date, operationPeriod, operationCustomStartDate, operationCustomEndDate)) {
                return false;
            }

            // Filtre par client sélectionné
            if (operationClientFilter !== 'all') {
                const matchesClient = (op.clientName && op.clientName.toLowerCase() === operationClientFilter.toLowerCase()) ||
                    (op.clientId && op.clientId === operationClientFilter);
                if (!matchesClient) return false;
            }

            if (operationFilter === 'reliquat_credit') return op.category === 'reliquat_credit';
            if (operationFilter === 'auto_client') return op.category === 'auto_client';
            if (operationFilter === 'debt_payment') return op.category === 'debt_payment';
            if (operationFilter === 'credit_sale') return op.category === 'credit_sale';
            if (operationFilter === 'site') return op.category === 'site';

            return true;
        });
    }, [allOperationsList, searchTerm, operationFilter, operationClientFilter, operationPeriod, operationCustomStartDate, operationCustomEndDate]);

    // ── Pagination pour l'Historique des opérations (10 par page par défaut) ──
    const totalOpsPages = Math.max(1, Math.ceil(filteredOperations.length / opsPerPage));
    const paginatedOperations = useMemo(() => {
        const start = (opsPage - 1) * opsPerPage;
        return filteredOperations.slice(start, start + opsPerPage);
    }, [filteredOperations, opsPage, opsPerPage]);

    // KPI Metrics pour la vue Historique des Opérations
    const operationMetrics = useMemo(() => {
        const totalOps = allOperationsList.length;
        const reliquatOps = allOperationsList.filter(o => o.category === 'reliquat_credit');
        const totalReliquatAmount = reliquatOps.reduce((sum, o) => sum + (o.amount || 0), 0);
        const autoClientOps = allOperationsList.filter(o => o.category === 'auto_client');
        const paymentOps = allOperationsList.filter(o => o.category === 'debt_payment');
        const totalPaymentsAmount = paymentOps.reduce((sum, o) => sum + (o.amount || 0), 0);
        const creditSaleOps = allOperationsList.filter(o => o.category === 'credit_sale');
        const siteOps = allOperationsList.filter(o => o.category === 'site');

        return {
            totalOps,
            reliquatCount: reliquatOps.length,
            totalReliquatAmount,
            autoClientCount: autoClientOps.length,
            paymentCount: paymentOps.length,
            totalPaymentsAmount,
            creditSaleCount: creditSaleOps.length,
            siteCount: siteOps.length
        };
    }, [allOperationsList]);

    // Open/Close Client Form Modal
    const handleOpenModal = (client = null) => {
        if (client) {
            setEditingClient(client);
            setFormData({
                name: client.name,
                phone: client.phone || '',
                email: client.email || '',
                address: client.address || '',
                type: client.type || 'particulier',
                nif: client.nif || '',
                creditLimit: client.creditLimit || 0,
                pricingTier: client.pricingTier || 'normal'
            });
        } else {
            setEditingClient(null);
            setFormData({
                name: '',
                phone: '',
                email: '',
                address: '',
                type: 'particulier',
                nif: '',
                creditLimit: 0,
                pricingTier: 'normal'
            });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingClient(null);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            T.warning('Le nom du client est obligatoire.');
            return;
        }

        const payload = {
            ...formData,
            creditLimit: parseFloat(formData.creditLimit) || 0
        };

        if (editingClient) {
            triggerActionLoading("Mise à jour de la fiche client...", () => {
                updateClient(editingClient.id, payload);
                T.saved(`Client "${formData.name}" mis à jour`);
                handleCloseModal();
            });
        } else {
            triggerActionLoading("Création du compte client...", () => {
                addClient(payload);
                T.success(`Client "${formData.name}" ajouté avec succès`);
                handleCloseModal();
            });
        }
    };

    const handleDelete = (id, name, totalDebt) => {
        if (totalDebt > 0) {
            T.error(`Impossible de supprimer ce client. Il a un solde débiteur actif de ${formatPrice(totalDebt)}.`);
            return;
        }
        if (window.confirm(`Voulez-vous vraiment supprimer définitivement le client "${name}" ?`)) {
            triggerActionLoading("Suppression du client...", () => {
                deleteClient(id);
                T.deleted(`Client "${name}" supprimé`);
                if (selectedClient360?.id === id) setSelectedClient360(null);
            });
        }
    };

    // WhatsApp Smart Reminder
    const handleWhatsAppReminder = (client, debtAmount = null) => {
        if (!client.phone) {
            T.warning("Ce client n'a pas de numéro de téléphone renseigné.");
            return;
        }
        const debt = debtAmount !== null ? debtAmount : (client.totalDebt || 0);
        const sitesNames = (client.sites || []).map(s => s.name).join(', ') || 'Achats Comptoir';

        let text = `*RAPPEL DE SITUATION CLIENT - QUINCAILLERIE*\n\n`;
        text += `Bonjour ${client.name},\n`;
        if (debt > 0) {
            text += `Sauf omission ou versement récent de votre part, votre solde débiteur en cours s'élève à *${formatPrice(debt)}*.\n\n`;
            if (client.sites && client.sites.length > 0) {
                text += `🏗️ *Chantier(s) concerné(s) :* ${sitesNames}\n\n`;
            }
            text += `Merci de bien vouloir passer en caisse ou nous faire parvenir votre règlement par Mobile Money (T-Money / Moov Money).\n`;
        } else {
            text += `Nous vous remercions pour votre confiance continue. Votre compte est actuellement en règle (Solde : 0 FCFA).\n`;
        }
        text += `\nRestant à votre entière disposition,\n*La Direction de la Quincaillerie*`;

        const encoded = encodeURIComponent(text);
        const cleanPhone = client.phone.replace(/[^0-9]/g, '');
        window.open(`https://wa.me/${cleanPhone}?text=${encoded}`, '_blank');
    };

    // Print Certified A4 Account Statement
    const handlePrintAccountStatement = (client) => {
        triggerActionLoading("Préparation du relevé de compte A4...", () => {
            const printWindow = window.open('', '_blank');
            if (!printWindow) {
                T.error("Veuillez autoriser les fenêtres pop-up pour imprimer le relevé.");
                return;
            }

            const clientDebtsList = debts.filter(d => 
                (d.clientId && d.clientId === client.id) || 
                (d.customerName && d.customerName.toLowerCase().trim() === client.name.toLowerCase().trim())
            );

            const totalInvoiced = clientDebtsList.reduce((sum, d) => sum + (d.totalAmount || 0), 0);
            const totalPaid = clientDebtsList.reduce((sum, d) => sum + (d.paidAmount || 0), 0);
            const remainingBalance = totalInvoiced - totalPaid;

            const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Relevé de Compte - ${client.name}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #111827;
            padding: 30px;
            margin: 0;
            font-size: 13px;
            line-height: 1.5;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #001d35;
            padding-bottom: 15px;
            margin-bottom: 20px;
        }
        .store-title {
            font-size: 18px;
            font-weight: 800;
            color: #001d35;
            text-transform: uppercase;
        }
        .store-sub {
            font-size: 11px;
            color: #6b7280;
            margin-top: 2px;
        }
        .doc-badge {
            text-align: right;
        }
        .doc-title {
            font-size: 14px;
            font-weight: 800;
            color: #001d35;
            text-transform: uppercase;
        }
        .doc-meta {
            font-size: 11px;
            color: #4b5563;
        }
        .client-box {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            padding: 12px 16px;
            margin-bottom: 20px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
        }
        .client-name {
            font-size: 15px;
            font-weight: 800;
            color: #001d35;
        }
        .kpi-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            margin-bottom: 20px;
        }
        .kpi-card {
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            padding: 10px 14px;
            background: #fff;
        }
        .kpi-card.highlight {
            background: #fef2f2;
            border-color: #fecaca;
        }
        .kpi-label {
            font-size: 10px;
            text-transform: uppercase;
            font-weight: 700;
            color: #64748b;
        }
        .kpi-val {
            font-size: 16px;
            font-weight: 800;
            color: #001d35;
            margin-top: 4px;
        }
        .kpi-card.highlight .kpi-val {
            color: #b91c1c;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
            margin-top: 10px;
        }
        th {
            background-color: #001d35;
            color: #ffffff;
            font-weight: 700;
            text-transform: uppercase;
            font-size: 10px;
            padding: 8px 10px;
            text-align: left;
        }
        td {
            padding: 8px 10px;
            border-bottom: 1px solid #e2e8f0;
        }
        tr:nth-child(even) {
            background-color: #f8fafc;
        }
        .signatures {
            margin-top: 40px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
            page-break-inside: avoid;
        }
        .sig-block {
            border: 1px dashed #cbd5e1;
            border-radius: 4px;
            height: 90px;
            padding: 10px;
            position: relative;
        }
        .sig-title {
            font-size: 11px;
            font-weight: 700;
            color: #475569;
            text-transform: uppercase;
        }
        .sig-line {
            position: absolute;
            bottom: 10px;
            left: 10px;
            right: 10px;
            border-top: 1px solid #cbd5e1;
        }
        @media print {
            body { padding: 0; }
            @page { margin: 1.5cm; }
        }
    </style>
</head>
<body>
    <div class="header">
        <div>
            <div class="store-title">QUINCAILLERIE MODERNE & MATÉRIAUX</div>
            <div class="store-sub">Ciment • Fers à Béton • Plomberie • Sanitaire • Peinture • Électricité</div>
            <div class="store-sub">Tél: (+228) 90 12 34 56 / 99 88 77 66 • Lomé, TOGO</div>
        </div>
        <div class="doc-badge">
            <div class="doc-title">RELEVÉ DE COMPTE CLIENT</div>
            <div class="doc-meta">Émis le : ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
            <div class="doc-meta">Réf : REC-${client.id.slice(-6).toUpperCase()}</div>
        </div>
    </div>

    <div class="client-box">
        <div>
            <div class="client-name">${client.name}</div>
            <div><strong>Contact :</strong> ${client.phone || 'Non renseigné'}</div>
            <div><strong>Email :</strong> ${client.email || '-'}</div>
            <div><strong>Adresse :</strong> ${client.address || 'Lomé'}</div>
        </div>
        <div>
            <div><strong>Type de Compte :</strong> ${client.type ? client.type.toUpperCase() : 'PARTICULIER'}</div>
            ${client.nif ? `<div><strong>NIF / RC :</strong> ${client.nif}</div>` : ''}
            <div><strong>Plafond de Crédit Autorisé :</strong> ${client.creditLimit > 0 ? formatPrice(client.creditLimit) : 'Sans plafond'}</div>
            <div><strong>Barème Tarifaire :</strong> ${client.pricingTier === 'wholesale' ? 'Grossiste (-10%)' : (client.pricingTier === 'artisan' ? 'Artisan (-5%)' : 'Tarif Standard')}</div>
        </div>
    </div>

    <div class="kpi-grid">
        <div class="kpi-card">
            <div class="kpi-label">Total Facturé</div>
            <div class="kpi-val">${formatPrice(totalInvoiced)}</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">Total Règlements Reçus</div>
            <div class="kpi-val" style="color: #15803d;">${formatPrice(totalPaid)}</div>
        </div>
        <div class="kpi-card highlight">
            <div class="kpi-label">Solde Restant Dû</div>
            <div class="kpi-val">${formatPrice(remainingBalance)}</div>
        </div>
    </div>

    <div style="font-weight: 800; font-size: 12px; margin-bottom: 8px; color: #001d35; text-transform: uppercase;">
        Détail Chronologique des Factures & Règlements
    </div>

    <table>
        <thead>
            <tr>
                <th>Date</th>
                <th>Pièce / Réf</th>
                <th>Chantier</th>
                <th style="text-align: right;">Montant Vente</th>
                <th style="text-align: right;">Déjà Payé</th>
                <th style="text-align: right;">Reste à Payer</th>
                <th style="text-align: center;">Statut</th>
            </tr>
        </thead>
        <tbody>
            ${clientDebtsList.length === 0 ? `
                <tr><td colspan="7" style="text-align: center; color: #6b7280; padding: 15px;">Aucune facture à terme enregistrée pour ce compte.</td></tr>
            ` : clientDebtsList.map(d => {
                const rest = Math.max(0, (d.totalAmount || 0) - (d.paidAmount || 0));
                return `
                    <tr>
                        <td>${new Date(d.date).toLocaleDateString('fr-FR')}</td>
                        <td>FAC-${d.id}</td>
                        <td><strong>${d.siteName || 'Comptoir'}</strong></td>
                        <td style="text-align: right; font-weight: 700;">${formatPrice(d.totalAmount)}</td>
                        <td style="text-align: right; color: #15803d;">${formatPrice(d.paidAmount)}</td>
                        <td style="text-align: right; font-weight: 800; color: ${rest > 0 ? '#b91c1c' : '#15803d'};">${formatPrice(rest)}</td>
                        <td style="text-align: center;">
                            <span style="font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 3px; background: ${rest > 0 ? '#fee2e2; color: #991b1b' : '#dcfce7; color: #166534'};">
                                ${rest > 0 ? (d.paidAmount > 0 ? 'PARTIEL' : 'IMPAYÉ') : 'RÉGLÉ'}
                            </span>
                        </td>
                    </tr>
                `;
            }).join('')}
        </tbody>
    </table>

    <div style="font-size: 11px; color: #4b5563; font-style: italic; margin-top: 15px;">
        Arrêté le présent relevé de situation à la somme de : <strong>${formatPrice(remainingBalance)}</strong>.
    </div>

    <div class="signatures">
        <div class="sig-block">
            <div class="sig-line"></div>
            <div class="sig-title">Pour la Quincaillerie (Direction / Caisse)</div>
        </div>
        <div class="sig-block">
            <div class="sig-line"></div>
            <div class="sig-title">Bon pour accord du Client (Signature)</div>
        </div>
    </div>

    <script>
        window.onload = function() { window.print(); };
    </script>
</body>
</html>
            `;

            printWindow.document.write(html);
            printWindow.document.close();
        });
    };

    // Export CSV Clients List ou Historique des Opérations
    const handleExportCSV = () => {
        if (currentView === 'operations') {
            if (filteredOperations.length === 0) {
                T.warning("Aucune opération à exporter.");
                return;
            }
            triggerActionLoading("Génération de l'export CSV de l'historique...", () => {
                const headers = ['Date', 'Type Opération', 'Référence', 'Client', 'Chantier', 'Montant (FCFA)', 'Impact Solde', 'Statut', 'Auteur / Caisse', 'Notes & Motif'];
                const rows = filteredOperations.map(o => [
                    new Date(o.date).toLocaleString('fr-FR'),
                    o.typeLabel,
                    o.refCode,
                    o.clientName,
                    o.siteName || 'Comptoir',
                    o.amount || 0,
                    o.impactType === 'credit_advance' ? '+Avance Client' : (o.impactType === 'debt_increase' ? '+Dette' : (o.impactType === 'debt_decrease' ? '-Dette (Règlement)' : 'Info')),
                    o.status,
                    o.cashier,
                    (o.notes || '').replace(/"/g, '""')
                ]);

                const csvContent = [
                    headers.join(','),
                    ...rows.map(r => r.map(cell => `"${cell}"`).join(','))
                ].join('\n');

                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `historique_operations_clients_${new Date().toISOString().slice(0, 10)}.csv`;
                link.click();
                T.export("Export CSV de l'historique réussi !");
            });
            return;
        }

        if (enrichedClients.length === 0) {
            T.warning("Aucun client à exporter.");
            return;
        }

        triggerActionLoading("Génération de l'export CSV des clients...", () => {
            const headers = ['Nom Client', 'Type', 'Téléphone', 'Email', 'Adresse', 'NIF', 'Plafond Crédit (FCFA)', 'Dette Active (FCFA)', 'Chantiers Actifs', 'Barème'];
            const rows = enrichedClients.map(c => [
                c.name,
                c.type || 'particulier',
                c.phone || '',
                c.email || '',
                c.address || '',
                c.nif || '',
                c.creditLimit || 0,
                c.totalDebt || 0,
                c.activeSitesCount || 0,
                c.pricingTier || 'normal'
            ]);

            const csvContent = [
                headers.join(','),
                ...rows.map(r => r.map(cell => `"${cell}"`).join(','))
            ].join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `fichier_clients_${new Date().toISOString().slice(0, 10)}.csv`;
            link.click();
            T.export("Export CSV des clients réussi !");
        });
    };

    // ── Gestion de la sélection par checkbox & Bulk Check ──
    const handleSelectAllClients = (e) => {
        if (e.target.checked) {
            setSelectedClientIds(filteredClients.map(c => c.id));
        } else {
            setSelectedClientIds([]);
        }
    };

    const handleSelectClient = (id) => {
        setSelectedClientIds(prev => {
            if (prev.includes(id)) {
                return prev.filter(cId => cId !== id);
            } else {
                return [...prev, id];
            }
        });
    };

    const handleBulkExportSelectedCSV = () => {
        const target = enrichedClients.filter(c => selectedClientIds.includes(c.id));
        if (target.length === 0) return;
        triggerActionLoading("Export CSV des clients sélectionnés...", () => {
            const headers = ['Nom Client', 'Type', 'Téléphone', 'Email', 'Adresse', 'NIF', 'Plafond Crédit (FCFA)', 'Dette Active (FCFA)', 'Chantiers Actifs', 'Barème'];
            const rows = target.map(c => [
                c.name,
                c.type || 'particulier',
                c.phone || '',
                c.email || '',
                c.address || '',
                c.nif || '',
                c.creditLimit || 0,
                c.totalDebt || 0,
                c.activeSitesCount || 0,
                c.pricingTier || 'normal'
            ]);
            const csvContent = [headers.join(','), ...rows.map(r => r.map(cell => `"${cell}"`).join(','))].join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `clients_selectionnes_${new Date().toISOString().slice(0, 10)}.csv`;
            link.click();
            T.export(`${target.length} client(s) sélectionné(s) exporté(s) en CSV`);
        });
    };

    const handleBulkDeleteSelected = () => {
        const selectedList = enrichedClients.filter(c => selectedClientIds.includes(c.id));
        const withDebts = selectedList.filter(c => c.totalDebt > 0);
        if (withDebts.length > 0) {
            T.error(`Impossible de supprimer : ${withDebts.length} client(s) ont un solde débiteur actif (${withDebts.map(c => c.name).join(', ')}).`);
            return;
        }
        if (!window.confirm(`Confirmez-vous la suppression définitive de ces ${selectedList.length} client(s) sans dette active ?`)) return;
        triggerActionLoading("Suppression des clients sélectionnés...", () => {
            selectedList.forEach(c => deleteClient(c.id));
            T.deleted(`${selectedList.length} client(s) supprimé(s) avec succès`);
            setSelectedClientIds([]);
        });
    };

    // ── Gestion de la sélection par checkbox & Bulk Check pour l'Historique des opérations ──
    const handleSelectAllOperations = (e) => {
        if (e.target.checked) {
            setSelectedOperationIds(paginatedOperations.map(op => op.id));
        } else {
            setSelectedOperationIds([]);
        }
    };

    const handleSelectOperation = (id) => {
        setSelectedOperationIds(prev => {
            if (prev.includes(id)) {
                return prev.filter(opId => opId !== id);
            } else {
                return [...prev, id];
            }
        });
    };

    const handleBulkExportOperationsCSV = () => {
        const target = allOperationsList.filter(op => selectedOperationIds.includes(op.id));
        if (target.length === 0) return;
        triggerActionLoading("Export CSV des opérations sélectionnées...", () => {
            const headers = ['Date', 'Heure', 'Opération', 'Référence', 'Client', 'Chantier', 'Montant (FCFA)', 'Solde Restant (FCFA)', 'Statut', 'Auteur / Caissier', 'Notes'];
            const rows = target.map(op => {
                const dateObj = new Date(op.date);
                const dStr = !isNaN(dateObj.getTime()) ? dateObj.toLocaleDateString('fr-FR') : '';
                const tStr = !isNaN(dateObj.getTime()) ? dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
                return [
                    dStr,
                    tStr,
                    op.typeLabel || '',
                    op.refCode || '',
                    op.clientName || '',
                    op.siteName || 'Comptoir',
                    op.amount || 0,
                    op.remainingAmount || 0,
                    op.status || 'OK',
                    op.cashier || '',
                    op.notes || ''
                ];
            });
            const csvContent = [headers.join(','), ...rows.map(r => r.map(cell => `"${cell}"`).join(','))].join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `operations_selectionnees_${new Date().toISOString().slice(0, 10)}.csv`;
            link.click();
            T.export(`${target.length} opération(s) sélectionnée(s) exportée(s) en CSV`);
        });
    };

    // Quick Debt Payment Action inside 360°
    const handleExecuteDebtPayment = (e) => {
        e.preventDefault();
        const amt = parseFloat(paymentAmount);
        if (!amt || amt <= 0 || isNaN(amt)) {
            T.warning("Veuillez saisir un montant de versement valide.");
            return;
        }
        if (!paymentDebtTarget) return;

        const isGlobal = paymentDebtTarget.id === 'ALL';
        const maxPayable = isGlobal 
            ? (active360Client?.totalDebt || 0)
            : Math.max(0, paymentDebtTarget.totalAmount - paymentDebtTarget.paidAmount);

        if (amt > maxPayable) {
            T.warning(`Le versement ne peut pas excéder le reste dû de ${formatPrice(maxPayable)}.`);
            return;
        }

        if (debtPaymentMethod === 'avoir') {
            if (!active360Client || (active360Client.totalAvoir || 0) <= 0) {
                T.error("Ce client ne possède aucune avance ou bon d'avoir disponible.");
                return;
            }
            if (amt > active360Client.totalAvoir) {
                T.warning(`Le montant (${formatPrice(amt)}) excède l'avance disponible (${formatPrice(active360Client.totalAvoir)}).`);
                return;
            }
            // Déduire progressivement sur les avoirs actifs du client
            let remainingToDeduct = amt;
            for (const cn of (active360Client.activeAvoirs || [])) {
                if (remainingToDeduct <= 0) break;
                const deduct = Math.min(cn.remainingAmount, remainingToDeduct);
                useCreditNote(cn.code, deduct);
                remainingToDeduct -= deduct;
            }
        }

        triggerActionLoading("Enregistrement du règlement...", () => {
            if (isGlobal) {
                let rem = amt;
                const pendingDebts = (active360Client.allDebts || [])
                    .filter(d => d.status === 'pending')
                    .sort((a, b) => new Date(a.date) - new Date(b.date));

                for (const d of pendingDebts) {
                    if (rem <= 0) break;
                    const due = Math.max(0, (d.totalAmount || 0) - (d.paidAmount || 0));
                    if (due > 0) {
                        const pay = Math.min(due, rem);
                        addDebtPayment(d.id, pay, debtPaymentMethod, debtPaymentNote);
                        rem -= pay;
                    }
                }
            } else {
                addDebtPayment(paymentDebtTarget.id, amt, debtPaymentMethod, debtPaymentNote);
            }

            const remainingDebtAfter = Math.max(0, (active360Client.totalDebt || 0) - amt);

            setLastDebtPaymentReceipt({
                clientName: active360Client.name,
                clientPhone: active360Client.phone,
                amountPaid: amt,
                debtTarget: paymentDebtTarget,
                paymentMethod: debtPaymentMethod,
                note: debtPaymentNote,
                date: new Date().toISOString(),
                remainingDebt: remainingDebtAfter,
                isGlobal
            });

            T.success(debtPaymentMethod === 'avoir'
                ? `Avance de ${formatPrice(amt)} imputée avec succès sur le compte !`
                : `Règlement de ${formatPrice(amt)} encaissé avec succès !`
            );
            setPaymentDebtTarget(null);
            setPaymentAmount('');
            setDebtPaymentNote('');
            setDebtPaymentMethod('cash');
        });
    };

    // Add New Site to 360° Client
    const handleCreateSite = (e) => {
        e.preventDefault();
        if (!newSiteData.name.trim()) {
            T.warning("Le nom du chantier est obligatoire.");
            return;
        }
        if (!active360Client) return;

        triggerActionLoading("Création du chantier...", () => {
            addSite(active360Client.id, newSiteData);
            setNewSiteData({ name: '', location: '', status: 'active', notes: '' });
            setIsAddingSite(false);
            T.success(`Chantier "${newSiteData.name}" rattaché avec succès !`);
        });
    };

    return (
        <div className="space-y-3 font-sans pb-10">

            {/* ── EN-TÊTE PRINCIPAL OFFICIEL KABLLIX ERP (IDENTIQUE RÉAPPROVISIONNEMENT) ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-[4px] border-2 border-gray-300 shadow-sm">
                <div>
                    <h1 className="text-base sm:text-lg font-bold text-[#001d35] tracking-tight flex items-center gap-2">
                        <Users className="w-5 h-5 text-[#001d35]" />
                        <span>Fichier Clients, Chantiers & Crédit 360°</span>
                    </h1>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handleExportCSV}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-[4px] border-2 border-gray-300 bg-white hover:bg-gray-50 text-[#001d35] transition-all cursor-pointer shadow-sm active:scale-95"
                        title={currentView === 'operations' ? "Exporter l'historique des opérations au format CSV" : "Exporter le fichier clients au format CSV"}
                    >
                        <Download className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{currentView === 'operations' ? 'Exporter Historique (CSV)' : 'Exporter CSV'}</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => handleOpenModal()}
                        className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold uppercase tracking-wider rounded-[4px] bg-[#001d35] hover:bg-[#00284a] text-white transition-all cursor-pointer shadow-sm active:scale-95"
                    >
                        <Plus className="w-3.5 h-3.5 text-[#f77500]" />
                        <span>Nouveau Client</span>
                    </button>
                </div>
            </div>

            {/* ── STATCARDS KPI HARMONISÉES AVEC RÉAPPROVISIONNEMENT ET DASHBOARD ── */}
            {currentView === 'clients' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 animate-in fade-in duration-150">
                    {/* 1. Total Comptes Clients */}
                    <div className="bg-white p-3.5 rounded-[4px] border-2 border-gray-300 shadow-sm relative group hover:shadow-md transition-shadow overflow-hidden min-h-[120px] flex flex-col justify-center">
                        {filterLoading ? (
                            <div className="flex flex-col items-center justify-center py-4">
                                <div className="relative h-8 w-8">
                                    <div className="absolute inset-0 animate-spin rounded-full border-2 border-t-transparent border-[#001d35]"></div>
                                    <div className="absolute inset-1 animate-spin-reverse rounded-full border-2 border-b-transparent border-[#f77500]"></div>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="flex justify-between items-start relative z-10">
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-[#001d35]">
                                            Total Comptes Clients
                                        </p>
                                        <div className="flex items-baseline mt-2 font-semibold" style={{ color: '#001d35' }}>
                                            <h3 className="text-xl sm:text-2xl font-semibold text-[#001d35]">{metrics.totalClients}</h3>
                                        </div>
                                        <p className="text-xs text-gray-600 mt-2 font-medium">Particuliers, artisans & entreprises</p>
                                    </div>
                                </div>
                                <img
                                    src="/icons8/fluency_240_group.png"
                                    alt=""
                                    className="absolute bottom-2 right-2 w-16 h-16 opacity-80 group-hover:opacity-100 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-700 pointer-events-none"
                                />
                            </>
                        )}
                    </div>

                    {/* 2. Clients Débiteurs */}
                    <div className="bg-white p-3.5 rounded-[4px] border-2 border-gray-300 shadow-sm relative group hover:shadow-md transition-shadow overflow-hidden min-h-[120px] flex flex-col justify-center">
                        {filterLoading ? (
                            <div className="flex flex-col items-center justify-center py-4">
                                <div className="relative h-8 w-8">
                                    <div className="absolute inset-0 animate-spin rounded-full border-2 border-t-transparent border-[#001d35]"></div>
                                    <div className="absolute inset-1 animate-spin-reverse rounded-full border-2 border-b-transparent border-[#f77500]"></div>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="flex justify-between items-start relative z-10">
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-rose-700">
                                            Clients Débiteurs
                                        </p>
                                        <div className="flex items-baseline mt-2 font-semibold" style={{ color: '#e11d48' }}>
                                            <h3 className="text-xl sm:text-2xl font-semibold text-rose-600">{metrics.debtorsCount}</h3>
                                        </div>
                                        <p className="text-xs text-gray-600 mt-2 font-medium">Avec factures en attente de règlement</p>
                                    </div>
                                </div>
                                <img
                                    src="/icons8/fluency_240_debt.png"
                                    alt=""
                                    className="absolute bottom-2 right-2 w-16 h-16 opacity-80 group-hover:opacity-100 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-700 pointer-events-none"
                                />
                            </>
                        )}
                    </div>

                    {/* 3. Créances Totales (En-cours) */}
                    <div className="bg-white p-3.5 rounded-[4px] border-2 border-gray-300 shadow-sm relative group hover:shadow-md transition-shadow overflow-hidden min-h-[120px] flex flex-col justify-center">
                        {filterLoading ? (
                            <div className="flex flex-col items-center justify-center py-4">
                                <div className="relative h-8 w-8">
                                    <div className="absolute inset-0 animate-spin rounded-full border-2 border-t-transparent border-[#001d35]"></div>
                                    <div className="absolute inset-1 animate-spin-reverse rounded-full border-2 border-b-transparent border-[#f77500]"></div>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="flex justify-between items-start relative z-10">
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-amber-700">
                                            Créances Totales (En-cours)
                                        </p>
                                        <div className="flex items-baseline mt-2 font-semibold" style={{ color: '#b45309' }}>
                                            <h3 className="text-xl sm:text-2xl font-semibold text-amber-600">{formatPrice(metrics.totalOutstandingDebt)}</h3>
                                        </div>
                                        <p className="text-xs text-gray-600 mt-2 font-medium">À recouvrer sur le terrain</p>
                                    </div>
                                </div>
                                <img
                                    src="/icons8/fluency_240_banknotes.png"
                                    alt=""
                                    className="absolute bottom-2 right-2 w-16 h-16 opacity-80 group-hover:opacity-100 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-700 pointer-events-none"
                                />
                            </>
                        )}
                    </div>

                    {/* 4. Chantiers Actifs Suivis */}
                    <div className="bg-white p-3.5 rounded-[4px] border-2 border-gray-300 shadow-sm relative group hover:shadow-md transition-shadow overflow-hidden min-h-[120px] flex flex-col justify-center">
                        {filterLoading ? (
                            <div className="flex flex-col items-center justify-center py-4">
                                <div className="relative h-8 w-8">
                                    <div className="absolute inset-0 animate-spin rounded-full border-2 border-t-transparent border-[#001d35]"></div>
                                    <div className="absolute inset-1 animate-spin-reverse rounded-full border-2 border-b-transparent border-[#f77500]"></div>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="flex justify-between items-start relative z-10">
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-[#001d35]">
                                            Chantiers Actifs Suivis
                                        </p>
                                        <div className="flex items-baseline mt-2 font-semibold" style={{ color: '#001d35' }}>
                                            <h3 className="text-xl sm:text-2xl font-semibold text-[#001d35]">{metrics.totalActiveSites}</h3>
                                        </div>
                                        <p className="text-xs text-gray-600 mt-2 font-medium">Villas, immeubles & chantiers ouverts</p>
                                    </div>
                                </div>
                                <img
                                    src="/icons8/fluency_240_box.png"
                                    alt=""
                                    className="absolute bottom-2 right-2 w-16 h-16 opacity-80 group-hover:opacity-100 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-700 pointer-events-none"
                                />
                            </>
                        )}
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 animate-in fade-in duration-150">
                    {/* 1. Total Opérations Auditées */}
                    <div className="bg-white p-3.5 rounded-[4px] border-2 border-gray-300 shadow-sm relative group hover:shadow-md transition-shadow overflow-hidden min-h-[120px] flex flex-col justify-center">
                        {filterLoading ? (
                            <div className="flex flex-col items-center justify-center py-4">
                                <div className="relative h-8 w-8">
                                    <div className="absolute inset-0 animate-spin rounded-full border-2 border-t-transparent border-[#001d35]"></div>
                                    <div className="absolute inset-1 animate-spin-reverse rounded-full border-2 border-b-transparent border-[#f77500]"></div>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="flex justify-between items-start relative z-10">
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-[#001d35]">
                                            Opérations Auditées
                                        </p>
                                        <div className="flex items-baseline mt-2 font-semibold" style={{ color: '#001d35' }}>
                                            <h3 className="text-xl sm:text-2xl font-semibold text-[#001d35]">{operationMetrics.totalOps}</h3>
                                        </div>
                                        <p className="text-xs text-gray-600 mt-2 font-medium">Traçabilité & audit en temps réel</p>
                                    </div>
                                </div>
                                <img
                                    src="/icons8/fluency_240_group.png"
                                    alt=""
                                    className="absolute bottom-2 right-2 w-16 h-16 opacity-80 group-hover:opacity-100 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-700 pointer-events-none"
                                />
                            </>
                        )}
                    </div>

                    {/* 2. Avances Reliquats Enregistrées */}
                    <div className="bg-white p-3.5 rounded-[4px] border-2 border-gray-300 shadow-sm relative group hover:shadow-md transition-shadow overflow-hidden min-h-[120px] flex flex-col justify-center">
                        {filterLoading ? (
                            <div className="flex flex-col items-center justify-center py-4">
                                <div className="relative h-8 w-8">
                                    <div className="absolute inset-0 animate-spin rounded-full border-2 border-t-transparent border-[#001d35]"></div>
                                    <div className="absolute inset-1 animate-spin-reverse rounded-full border-2 border-b-transparent border-[#f77500]"></div>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="flex justify-between items-start relative z-10">
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-emerald-700">
                                            Avances Reliquats Créditées
                                        </p>
                                        <div className="flex items-baseline mt-2 font-semibold" style={{ color: '#047857' }}>
                                            <h3 className="text-xl sm:text-2xl font-semibold text-emerald-600">{formatPrice(operationMetrics.totalReliquatAmount)}</h3>
                                        </div>
                                        <p className="text-xs text-gray-600 mt-2 font-medium">{operationMetrics.reliquatCount} avance{operationMetrics.reliquatCount > 1 ? 's' : ''} affectée{operationMetrics.reliquatCount > 1 ? 's' : ''} aux clients</p>
                                    </div>
                                </div>
                                <img
                                    src="/icons8/fluency_240_banknotes.png"
                                    alt=""
                                    className="absolute bottom-2 right-2 w-16 h-16 opacity-80 group-hover:opacity-100 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-700 pointer-events-none"
                                />
                            </>
                        )}
                    </div>

                    {/* 3. Comptes Créés via Reliquat */}
                    <div className="bg-white p-3.5 rounded-[4px] border-2 border-gray-300 shadow-sm relative group hover:shadow-md transition-shadow overflow-hidden min-h-[120px] flex flex-col justify-center">
                        {filterLoading ? (
                            <div className="flex flex-col items-center justify-center py-4">
                                <div className="relative h-8 w-8">
                                    <div className="absolute inset-0 animate-spin rounded-full border-2 border-t-transparent border-[#001d35]"></div>
                                    <div className="absolute inset-1 animate-spin-reverse rounded-full border-2 border-b-transparent border-[#f77500]"></div>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="flex justify-between items-start relative z-10">
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-blue-700">
                                            Comptes Créés via Reliquat
                                        </p>
                                        <div className="flex items-baseline mt-2 font-semibold" style={{ color: '#1d4ed8' }}>
                                            <h3 className="text-xl sm:text-2xl font-semibold text-blue-600">{operationMetrics.autoClientCount}</h3>
                                        </div>
                                        <p className="text-xs text-gray-600 mt-2 font-medium">Générés automatiquement en caisse</p>
                                    </div>
                                </div>
                                <img
                                    src="/icons8/fluency_240_debt.png"
                                    alt=""
                                    className="absolute bottom-2 right-2 w-16 h-16 opacity-80 group-hover:opacity-100 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-700 pointer-events-none"
                                />
                            </>
                        )}
                    </div>

                    {/* 4. Total Règlements Reçus */}
                    <div className="bg-white p-3.5 rounded-[4px] border-2 border-gray-300 shadow-sm relative group hover:shadow-md transition-shadow overflow-hidden min-h-[120px] flex flex-col justify-center">
                        {filterLoading ? (
                            <div className="flex flex-col items-center justify-center py-4">
                                <div className="relative h-8 w-8">
                                    <div className="absolute inset-0 animate-spin rounded-full border-2 border-t-transparent border-[#001d35]"></div>
                                    <div className="absolute inset-1 animate-spin-reverse rounded-full border-2 border-b-transparent border-[#f77500]"></div>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="flex justify-between items-start relative z-10">
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-amber-700">
                                            Règlements & Recouvrements
                                        </p>
                                        <div className="flex items-baseline mt-2 font-semibold" style={{ color: '#b45309' }}>
                                            <h3 className="text-xl sm:text-2xl font-semibold text-amber-600">{formatPrice(operationMetrics.totalPaymentsAmount)}</h3>
                                        </div>
                                        <p className="text-xs text-gray-600 mt-2 font-medium">{operationMetrics.paymentCount} versement{operationMetrics.paymentCount > 1 ? 's' : ''} comptabilisé{operationMetrics.paymentCount > 1 ? 's' : ''}</p>
                                    </div>
                                </div>
                                <img
                                    src="/icons8/fluency_240_box.png"
                                    alt=""
                                    className="absolute bottom-2 right-2 w-16 h-16 opacity-80 group-hover:opacity-100 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-700 pointer-events-none"
                                />
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* ── BARRE D'ONGLETS PRINCIPAUX & RECHERCHE (STYLE OFFICIEL KABLLIX ERP - RETOURS & AVOIRS) ── */}
            <div className="bg-white p-2 sm:p-2.5 rounded-[4px] border-2 border-gray-300 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
                {/* Onglets de sélection principale : Fichier Clients / Historique des opérations */}
                <div className="flex items-center gap-1 bg-gray-100/90 p-1 rounded-[4px] border-2 border-gray-300 flex-wrap">
                    <button
                        type="button"
                        onClick={() => handleFilterChange(() => {
                            setCurrentView('clients');
                            setSearchTerm('');
                        })}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-[4px] transition-all cursor-pointer flex items-center gap-2 ${
                            currentView === 'clients'
                                ? 'bg-[#001d35] text-white shadow-xs'
                                : 'text-gray-700 hover:text-[#001d35] hover:bg-gray-200/60'
                        }`}
                    >
                        <Users className={`w-3.5 h-3.5 ${currentView === 'clients' ? 'text-[#f77500]' : 'text-gray-500'}`} />
                        <span>Fichier Clients</span>
                        <span className={`min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center flex-shrink-0 shadow-xs ${
                            currentView === 'clients' ? 'bg-[#f77500] text-white' : 'bg-gray-200 text-gray-800'
                        }`}>
                            {clients.length}
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={() => handleFilterChange(() => {
                            setCurrentView('operations');
                            setSearchTerm('');
                        })}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-[4px] transition-all cursor-pointer flex items-center gap-2 ${
                            currentView === 'operations'
                                ? 'bg-[#001d35] text-white shadow-xs'
                                : 'text-gray-700 hover:text-[#001d35] hover:bg-gray-200/60'
                        }`}
                    >
                        <Clock className={`w-3.5 h-3.5 ${currentView === 'operations' ? 'text-[#f77500]' : 'text-gray-500'}`} />
                        <span>Historique des opérations</span>
                        {allOperationsList.length > 0 && (
                            <span className={`min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center flex-shrink-0 shadow-xs ${
                                currentView === 'operations' ? 'bg-[#f77500] text-white' : 'bg-amber-100 text-amber-900 border border-amber-300'
                            }`}>
                                {allOperationsList.length}
                            </span>
                        )}
                    </button>
                </div>

                {/* Recherche à droite */}
                <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder={currentView === 'operations' ? "Chercher par nom de client, réf..." : "Rechercher un client (nom, tél)..."}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-8 pr-7 py-1.5 text-xs bg-gray-50 border-2 border-gray-300 focus:border-[#001d35] rounded-[4px] font-medium text-gray-800 focus:outline-none"
                    />
                    {searchTerm && (
                        <button
                            type="button"
                            onClick={() => handleFilterChange(setSearchTerm, '')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                            title="Effacer la recherche"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* ── BARRE D'OUTILS EN BAS DÉDIÉE (STYLE OFFICIEL RETOURS D'ARTICLES & BONS D'AVOIR) ── */}
            {currentView === 'clients' ? (
                <div className="bg-white p-2.5 rounded-[4px] border-2 border-gray-300 shadow-sm flex flex-col gap-2.5 animate-in fade-in duration-150">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        {/* 1. Sélecteur de Catégorie de client (Compact avec label & icône) */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <label htmlFor="client-category-select" className="text-xs font-semibold text-[#001d35] uppercase tracking-wider flex items-center gap-1.5 shrink-0">
                                <Filter className="w-3.5 h-3.5 text-[#f77500]" />
                                <span>Catégorie :</span>
                            </label>
                            <select
                                id="client-category-select"
                                value={typeFilter}
                                onChange={(e) => handleFilterChange(setTypeFilter, e.target.value)}
                                className="px-3 py-1.5 text-xs font-semibold border-2 border-gray-300 rounded-[4px] focus:outline-none focus:ring-1 focus:ring-[#001d35] bg-white text-[#001d35] cursor-pointer shadow-2xs"
                            >
                                <option value="all">Toutes les catégories ({clients.length})</option>
                                <option value="debtor">🔴 Débiteurs ({metrics.debtorsCount})</option>
                                <option value="particulier">👤 Particuliers</option>
                                <option value="artisan">🔨 Artisans</option>
                                <option value="entreprise">🏢 Entreprises</option>
                            </select>
                        </div>

                        {/* 2. Sélecteur de Statut Crédit & Encours */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <label htmlFor="client-credit-status-select" className="text-xs font-semibold text-[#001d35] uppercase tracking-wider flex items-center gap-1.5 shrink-0">
                                <CreditCard className="w-3.5 h-3.5 text-[#f77500]" />
                                <span>Statut Crédit :</span>
                            </label>
                            <select
                                id="client-credit-status-select"
                                value={creditStatusFilter}
                                onChange={(e) => handleFilterChange(setCreditStatusFilter, e.target.value)}
                                className="px-3 py-1.5 text-xs font-semibold border-2 border-gray-300 rounded-[4px] focus:outline-none focus:ring-1 focus:ring-[#001d35] bg-white text-[#001d35] cursor-pointer shadow-2xs max-w-[210px]"
                            >
                                <option value="all">Tous les statuts</option>
                                <option value="debtor">🔴 Débiteurs (Solde dû)</option>
                                <option value="exceeded">⚠️ Plafond Dépassé</option>
                                <option value="avance">🟢 Avances Reliquats</option>
                                <option value="avoir">🎟️ Avoirs Disponibles</option>
                                <option value="up_to_date">✅ À jour (Sans dette)</option>
                            </select>
                        </div>

                        {/* 3. Filtres par date (Aujourd'hui, 7 jours, Ce mois, Tout, Période...) */}
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#001d35] uppercase tracking-wider hidden lg:flex">
                                <Calendar className="w-3.5 h-3.5 text-[#f77500]" />
                                <span>Période :</span>
                            </div>
                            <div className="flex items-center gap-1 bg-gray-100/80 p-1 rounded-[4px] border-2 border-gray-300">
                                {[
                                    { key: 'today', label: "Aujourd'hui" },
                                    { key: '7days', label: '7 jours' },
                                    { key: 'month', label: 'Ce mois' },
                                    { key: 'all', label: 'Tout' },
                                    { key: 'custom', label: 'Période...' }
                                ].map(opt => (
                                    <button
                                        key={opt.key}
                                        type="button"
                                        onClick={() => handleFilterChange(setClientPeriod, opt.key)}
                                        className={`px-2.5 py-1 rounded-[4px] text-xs font-semibold transition-all cursor-pointer ${
                                            clientPeriod === opt.key
                                                ? 'bg-[#001d35] text-white shadow-xs'
                                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>

                            {clientPeriod === 'custom' && (
                                <div className="flex items-center gap-1.5 text-xs">
                                    <input
                                        type="date"
                                        value={clientCustomStartDate}
                                        onChange={e => handleFilterChange(setClientCustomStartDate, e.target.value)}
                                        className="px-2 py-1 text-xs border border-gray-300 rounded-[4px] font-medium text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-[#001d35]"
                                    />
                                    <span className="text-gray-400 text-xs font-medium">à</span>
                                    <input
                                        type="date"
                                        value={clientCustomEndDate}
                                        onChange={e => handleFilterChange(setClientCustomEndDate, e.target.value)}
                                        className="px-2 py-1 text-xs border border-gray-300 rounded-[4px] font-medium text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-[#001d35]"
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Actions groupées / Bulk actions lorsque des cases sont cochées */}
                    {selectedClientIds.length > 0 && (
                        <div className="flex items-center justify-between gap-2 flex-wrap bg-blue-50/90 px-3 py-1.5 rounded-[4px] border-2 border-blue-400 animate-in fade-in duration-150">
                            <span className="text-xs font-bold text-[#001d35] flex items-center gap-1.5">
                                <CheckSquare className="w-4 h-4 text-[#001d35]" />
                                <span>{selectedClientIds.length} client(s) sélectionné(s)</span>
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleBulkExportSelectedCSV}
                                    className="px-2.5 py-1 bg-white hover:bg-gray-100 text-[#001d35] border border-gray-300 rounded-[4px] text-xs font-semibold uppercase tracking-wider flex items-center gap-1 cursor-pointer shadow-2xs transition-all active:scale-95"
                                    title="Exporter les clients cochés au format CSV"
                                >
                                    <Download className="w-3.5 h-3.5 text-[#f77500]" />
                                    <span>Exporter ({selectedClientIds.length})</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleBulkDeleteSelected}
                                    className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-[4px] text-xs font-semibold uppercase tracking-wider flex items-center gap-1 cursor-pointer shadow-2xs transition-all active:scale-95"
                                    title="Supprimer les clients cochés (s'ils n'ont aucune dette active)"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Supprimer ({selectedClientIds.length})</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedClientIds([])}
                                    className="p-1 text-gray-500 hover:text-gray-800 cursor-pointer ml-1"
                                    title="Désélectionner tout"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Ligne informative : Filtre actif(s) pour la vue Fichier Clients */}
                    {(typeFilter !== 'all' || creditStatusFilter !== 'all' || clientPeriod !== 'all' || searchTerm) && (
                        <div className="pt-2 border-t border-gray-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                            <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-[1px] bg-[#f77500] animate-pulse"></span>
                                    <span>Filtre actif(s) :</span>
                                </span>

                                {typeFilter !== 'all' && (
                                    <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-[4px] text-[10px] font-semibold uppercase tracking-wider">
                                        <span>
                                            {typeFilter === 'debtor' && '🔴 Débiteurs'}
                                            {typeFilter === 'particulier' && '👤 Particuliers'}
                                            {typeFilter === 'artisan' && '🔨 Artisans'}
                                            {typeFilter === 'entreprise' && '🏢 Entreprises'}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => handleFilterChange(setTypeFilter, 'all')}
                                            className="hover:text-rose-600 cursor-pointer ml-0.5"
                                            title="Retirer ce filtre"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </span>
                                )}

                                {creditStatusFilter !== 'all' && (
                                    <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-900 border border-blue-300 px-2 py-0.5 rounded-[4px] text-[10px] font-semibold uppercase tracking-wider">
                                        <span>
                                            {creditStatusFilter === 'debtor' && '🔴 Débiteurs (Solde dû)'}
                                            {creditStatusFilter === 'exceeded' && '⚠️ Plafond Dépassé'}
                                            {creditStatusFilter === 'avance' && '🟢 Avances Reliquats'}
                                            {creditStatusFilter === 'avoir' && '🎟️ Avoirs Disponibles'}
                                            {creditStatusFilter === 'up_to_date' && '✅ À jour'}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => handleFilterChange(setCreditStatusFilter, 'all')}
                                            className="hover:text-rose-600 cursor-pointer ml-0.5"
                                            title="Retirer ce filtre de statut crédit"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </span>
                                )}

                                {clientPeriod !== 'all' && (
                                    <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-900 border border-blue-300 px-2 py-0.5 rounded-[4px] text-[10px] font-semibold uppercase tracking-wider">
                                        <span>
                                            📅 {clientPeriod === 'today' && "Aujourd'hui"}
                                            {clientPeriod === '7days' && '7 derniers jours'}
                                            {clientPeriod === 'month' && 'Ce mois'}
                                            {clientPeriod === 'custom' && `Du ${clientCustomStartDate || '...'} au ${clientCustomEndDate || '...'}`}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => handleFilterChange(() => {
                                                setClientPeriod('all');
                                                setClientCustomStartDate('');
                                                setClientCustomEndDate('');
                                            })}
                                            className="hover:text-rose-600 cursor-pointer ml-0.5"
                                            title="Retirer le filtre de période"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </span>
                                )}

                                {searchTerm && (
                                    <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-800 border border-gray-300 px-2 py-0.5 rounded-[4px] text-[10px] font-semibold uppercase tracking-wider">
                                        <span>Recherche : "{searchTerm}"</span>
                                        <button
                                            type="button"
                                            onClick={() => handleFilterChange(setSearchTerm, '')}
                                            className="hover:text-rose-600 cursor-pointer ml-0.5"
                                            title="Effacer la recherche"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </span>
                                )}
                            </div>

                            <button
                                type="button"
                                onClick={() => handleFilterChange(() => {
                                    setTypeFilter('all');
                                    setCreditStatusFilter('all');
                                    setClientPeriod('today');
                                    setClientCustomStartDate('');
                                    setClientCustomEndDate('');
                                    setSearchTerm('');
                                })}
                                className="text-[10px] font-semibold uppercase tracking-wider text-rose-600 hover:text-rose-800 hover:underline cursor-pointer"
                            >
                                Effacer tous les filtres
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="bg-white p-2.5 rounded-[4px] border-2 border-gray-300 shadow-sm flex flex-col gap-2.5 animate-in fade-in duration-150">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        {/* Sélecteur de type d'opération */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <label htmlFor="operation-type-select" className="text-xs font-semibold text-[#001d35] uppercase tracking-wider flex items-center gap-1.5 shrink-0">
                                <Filter className="w-3.5 h-3.5 text-[#f77500]" />
                                <span>Opération :</span>
                            </label>
                            <select
                                id="operation-type-select"
                                value={operationFilter}
                                onChange={(e) => handleFilterChange(setOperationFilter, e.target.value)}
                                className="px-3 py-1.5 text-xs font-semibold border-2 border-gray-300 rounded-[4px] focus:outline-none focus:ring-1 focus:ring-[#001d35] bg-white text-[#001d35] cursor-pointer shadow-2xs"
                            >
                                <option value="none">Aucun</option>
                                <option value="all">Toutes les opérations</option>
                                <option value="reliquat_credit">🟢 Avances Reliquats</option>
                                <option value="auto_client">✨ Créations Auto</option>
                                <option value="debt_payment">💵 Règlements</option>
                                <option value="credit_sale">🔴 Ventes Crédit</option>
                                <option value="site">🏗️ Chantiers</option>
                            </select>
                        </div>

                        {/* Sélecteur de Client (filtrer par nom de client) */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <label htmlFor="operation-client-select" className="text-xs font-semibold text-[#001d35] uppercase tracking-wider flex items-center gap-1.5 shrink-0">
                                <User className="w-3.5 h-3.5 text-[#f77500]" />
                                <span>Client :</span>
                            </label>
                            <select
                                id="operation-client-select"
                                value={operationClientFilter}
                                onChange={(e) => handleFilterChange(setOperationClientFilter, e.target.value)}
                                className="px-3 py-1.5 text-xs font-semibold border-2 border-gray-300 rounded-[4px] focus:outline-none focus:ring-1 focus:ring-[#001d35] bg-white text-[#001d35] cursor-pointer shadow-2xs max-w-[210px]"
                            >
                                <option value="all">Tous les clients</option>
                                {[...clients].sort((a, b) => a.name.localeCompare(b.name)).map(c => (
                                    <option key={c.id} value={c.name}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Filtres par date (Aujourd'hui, 7 jours, Ce mois, Tout, Période...) */}
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#001d35] uppercase tracking-wider hidden lg:flex">
                                <Calendar className="w-3.5 h-3.5 text-[#f77500]" />
                                <span>Période :</span>
                            </div>
                            <div className="flex items-center gap-1 bg-gray-100/80 p-1 rounded-[4px] border-2 border-gray-300">
                                {[
                                    { key: 'today', label: "Aujourd'hui" },
                                    { key: '7days', label: '7 jours' },
                                    { key: 'month', label: 'Ce mois' },
                                    { key: 'all', label: 'Tout' },
                                    { key: 'custom', label: 'Période...' }
                                ].map(opt => (
                                    <button
                                        key={opt.key}
                                        type="button"
                                        onClick={() => handleFilterChange(setOperationPeriod, opt.key)}
                                        className={`px-2.5 py-1 rounded-[4px] text-xs font-semibold transition-all cursor-pointer ${
                                            operationPeriod === opt.key
                                                ? 'bg-[#001d35] text-white shadow-xs'
                                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>

                            {operationPeriod === 'custom' && (
                                <div className="flex items-center gap-1.5 text-xs">
                                    <input
                                        type="date"
                                        value={operationCustomStartDate}
                                        onChange={e => handleFilterChange(setOperationCustomStartDate, e.target.value)}
                                        className="px-2 py-1 text-xs border border-gray-300 rounded-[4px] font-medium text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-[#001d35]"
                                    />
                                    <span className="text-gray-400 text-xs font-medium">à</span>
                                    <input
                                        type="date"
                                        value={operationCustomEndDate}
                                        onChange={e => handleFilterChange(setOperationCustomEndDate, e.target.value)}
                                        className="px-2 py-1 text-xs border border-gray-300 rounded-[4px] font-medium text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-[#001d35]"
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Actions groupées / Bulk actions lorsque des opérations sont cochées */}
                    {selectedOperationIds.length > 0 && (
                        <div className="flex items-center justify-between gap-2 flex-wrap bg-blue-50/90 px-3 py-1.5 rounded-[4px] border-2 border-blue-400 animate-in fade-in duration-150">
                            <span className="text-xs font-bold text-[#001d35] flex items-center gap-1.5">
                                <CheckSquare className="w-4 h-4 text-[#001d35]" />
                                <span>{selectedOperationIds.length} opération(s) sélectionnée(s)</span>
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleBulkExportOperationsCSV}
                                    className="px-2.5 py-1 bg-white hover:bg-gray-100 text-[#001d35] border border-gray-300 rounded-[4px] text-xs font-semibold uppercase tracking-wider flex items-center gap-1 cursor-pointer shadow-2xs transition-all active:scale-95"
                                    title="Exporter les opérations cochées au format CSV"
                                >
                                    <Download className="w-3.5 h-3.5 text-[#f77500]" />
                                    <span>Exporter ({selectedOperationIds.length})</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedOperationIds([])}
                                    className="p-1 text-gray-500 hover:text-gray-800 cursor-pointer ml-1"
                                    title="Désélectionner tout"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Ligne informative : Filtre actif(s) pour Historique des opérations */}
                    {(operationFilter !== 'none' || operationClientFilter !== 'all' || operationPeriod !== 'all' || searchTerm) && (
                        <div className="pt-2 border-t border-gray-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                            <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-[1px] bg-[#f77500] animate-pulse"></span>
                                    <span>Filtre actif(s) :</span>
                                </span>

                                {operationFilter !== 'none' && (
                                    <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-[4px] text-[10px] font-semibold uppercase tracking-wider">
                                        <span>
                                            {operationFilter === 'all' && '📋 Toutes les opérations'}
                                            {operationFilter === 'reliquat_credit' && '🟢 Avances Reliquats'}
                                            {operationFilter === 'auto_client' && '✨ Créations Auto'}
                                            {operationFilter === 'debt_payment' && '💵 Règlements'}
                                            {operationFilter === 'credit_sale' && '🔴 Ventes Crédit'}
                                            {operationFilter === 'site' && '🏗️ Chantiers'}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => handleFilterChange(setOperationFilter, 'none')}
                                            className="hover:text-rose-600 cursor-pointer ml-0.5"
                                            title="Retirer le filtre d'opération"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </span>
                                )}

                                {operationClientFilter !== 'all' && (
                                    <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-900 border border-blue-300 px-2 py-0.5 rounded-[4px] text-[10px] font-semibold uppercase tracking-wider">
                                        <span>👤 Client : {operationClientFilter}</span>
                                        <button
                                            type="button"
                                            onClick={() => handleFilterChange(setOperationClientFilter, 'all')}
                                            className="hover:text-rose-600 cursor-pointer ml-0.5"
                                            title="Retirer le filtre client"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </span>
                                )}

                                {operationPeriod !== 'all' && (
                                    <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-900 border border-blue-300 px-2 py-0.5 rounded-[4px] text-[10px] font-semibold uppercase tracking-wider">
                                        <span>
                                            📅 {operationPeriod === 'today' && "Aujourd'hui"}
                                            {operationPeriod === '7days' && '7 derniers jours'}
                                            {operationPeriod === 'month' && 'Ce mois'}
                                            {operationPeriod === 'custom' && `Du ${operationCustomStartDate || '...'} au ${operationCustomEndDate || '...'}`}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => handleFilterChange(() => {
                                                setOperationPeriod('all');
                                                setOperationCustomStartDate('');
                                                setOperationCustomEndDate('');
                                            })}
                                            className="hover:text-rose-600 cursor-pointer ml-0.5"
                                            title="Retirer le filtre de période"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </span>
                                )}

                                {searchTerm && (
                                    <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-800 border border-gray-300 px-2 py-0.5 rounded-[4px] text-[10px] font-semibold uppercase tracking-wider">
                                        <span>Recherche : "{searchTerm}"</span>
                                        <button
                                            type="button"
                                            onClick={() => handleFilterChange(setSearchTerm, '')}
                                            className="hover:text-rose-600 cursor-pointer ml-0.5"
                                            title="Effacer la recherche"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </span>
                                )}
                            </div>

                            <button
                                type="button"
                                onClick={() => handleFilterChange(() => {
                                    setOperationFilter('none');
                                    setOperationClientFilter('all');
                                    setOperationPeriod('today');
                                    setOperationCustomStartDate('');
                                    setOperationCustomEndDate('');
                                    setSearchTerm('');
                                })}
                                className="text-[10px] font-semibold uppercase tracking-wider text-rose-600 hover:text-rose-800 hover:underline cursor-pointer"
                            >
                                Effacer tous les filtres
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* ── CONTENU PRINCIPAL CONDITIONNEL : FICHIER CLIENTS OU JOURNAL D'AUDIT DES OPÉRATIONS ── */}
            {currentView === 'clients' ? (
                <div className="bg-white border-2 border-gray-300 rounded-[4px] shadow-sm overflow-hidden min-h-[350px] flex flex-col justify-start">
                {filterLoading ? (
                    <div className="p-16 flex flex-col items-center justify-center bg-white animate-in fade-in duration-150 min-h-[350px] my-auto">
                        <div className="relative h-10 w-10">
                            <div className="absolute inset-0 animate-spin rounded-full border-4 border-gray-200 border-t-[#001d35]"></div>
                            <div className="absolute inset-1.5 animate-spin-reverse rounded-full border-2 border-transparent border-b-[#f77500]"></div>
                        </div>
                        <p className="text-xs font-semibold text-[#001d35] mt-3 uppercase tracking-wider">
                            Filtrage du fichier clients...
                        </p>
                        <p className="text-[11px] text-gray-500 mt-0.5 font-medium">
                            Interrogation des comptes et calcul des encours...
                        </p>
                    </div>
                ) : filteredClients.length === 0 ? (
                    <div className="p-12 text-center text-gray-500 my-auto">
                        <Users className="w-12 h-12 mx-auto text-gray-400 mb-2 opacity-60" />
                        <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Aucun client ne correspond aux critères
                        </h3>
                        <p className="text-[11px] text-gray-500 mt-1 max-w-md mx-auto font-normal">
                            {searchTerm 
                                ? `Aucun résultat pour "${searchTerm}". Vérifiez l'orthographe ou réinitialisez les filtres.` 
                                : `Enregistrez votre premier client pour débuter le suivi individualisé et le carnet de crédit.`}
                        </p>
                        <button
                            type="button"
                            onClick={() => handleOpenModal()}
                            className="mt-4 px-3.5 py-2 bg-[#001d35] hover:bg-[#00284a] text-white text-xs font-semibold uppercase tracking-wider rounded-[4px] inline-flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 transition-all"
                        >
                            <Plus className="w-3.5 h-3.5 text-[#f77500]" />
                            <span>Nouveau Client</span>
                        </button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-[#001d35] text-white font-semibold uppercase tracking-wider text-[10px] divide-x divide-white/20 sticky top-0">
                                    <th style={{ width: '42px', minWidth: '42px' }} className="px-1 py-2 text-center border-r-2 border-white/20">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 rounded-sm border-white/20 accent-[#001d35] cursor-pointer"
                                            checked={filteredClients.length > 0 && selectedClientIds.length === filteredClients.length}
                                            onChange={handleSelectAllClients}
                                            title="Tout cocher / Tout décocher"
                                        />
                                    </th>
                                    <th className="py-2.5 px-3 w-64">Client & Type</th>
                                    <th className="py-2.5 px-3 w-48">Contact & Barème</th>
                                    <th className="py-2.5 px-3 w-44">Chantiers Déclarés</th>
                                    <th className="py-2.5 px-3">Encours & Plafond Crédit</th>
                                    <th className="py-2.5 px-3 w-44">Avoirs & Reliquats</th>
                                    <th className="py-2.5 px-2 text-center w-56">Actions 360°</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredClients.map((client, idx) => {
                                    const isSelected = selectedClientIds.includes(client.id);
                                    return (
                                        <tr 
                                            key={client.id} 
                                            className={`transition-colors border-b border-gray-200 select-none ${
                                                isSelected 
                                                    ? 'bg-blue-50' 
                                                    : idx % 2 === 0 ? 'bg-white hover:bg-blue-50/40' : 'bg-slate-50/70 hover:bg-blue-50/40'
                                            }`}
                                        >
                                            {/* Case à cocher par ligne (Style Catalogue Produits) */}
                                            <td className="px-1 py-2 text-center w-10">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 rounded-sm border-gray-300 accent-[#001d35] cursor-pointer"
                                                    checked={isSelected}
                                                    onChange={() => handleSelectClient(client.id)}
                                                />
                                            </td>

                                            {/* 1. Client & Type */}
                                            <td className="py-2.5 px-3">
                                            <div className="flex items-start gap-2.5">
                                                <div className="w-7 h-7 rounded-[4px] bg-blue-50 border border-blue-200 text-[#001d35] flex items-center justify-center text-xs shrink-0 mt-0.5 shadow-2xs">
                                                    {client.type === 'entreprise' ? '🏢' : (client.type === 'artisan' ? '🔨' : '👤')}
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-gray-900 text-xs leading-tight flex flex-wrap items-center gap-1.5">
                                                        <span>{client.name}</span>
                                                        {client.isExceeded && (
                                                            <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-semibold px-1.5 py-0.5 rounded-[4px] uppercase tracking-wider">
                                                                Plafond Dépassé
                                                            </span>
                                                        )}
                                                        {client.totalAvance > 0 && (
                                                            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-[4px] border border-blue-300 bg-blue-50 text-blue-900">
                                                                <span className="w-1.5 h-1.5 rounded-[4px] bg-blue-600 animate-pulse"></span>
                                                                <span>Avance : {formatPrice(client.totalAvance)}</span>
                                                            </span>
                                                        )}
                                                        {client.totalReliquatVoucher > 0 && (
                                                            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-[4px] border border-amber-300 bg-amber-50 text-amber-900">
                                                                <span className="w-1.5 h-1.5 rounded-[4px] bg-amber-600 animate-pulse"></span>
                                                                <span>Reliquat : {formatPrice(client.totalReliquatVoucher)}</span>
                                                            </span>
                                                        )}
                                                        {client.totalAvoirStandard > 0 && (
                                                            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-[4px] border border-emerald-300 bg-emerald-50 text-emerald-900">
                                                                <span className="w-1.5 h-1.5 rounded-[4px] bg-emerald-600 animate-pulse"></span>
                                                                <span>Avoir : {formatPrice(client.totalAvoirStandard)}</span>
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-0.5">
                                                        <span className="capitalize font-medium">{client.type || 'Particulier'}</span>
                                                        {client.address && (
                                                            <span>• <MapPin className="w-2.5 h-2.5 inline text-gray-400" /> {client.address}</span>
                                                        )}
                                                        {client.nif && (
                                                            <span className="text-gray-400">NIF: {client.nif}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>

                                        {/* 2. Contact & Barème */}
                                        <td className="py-2.5 px-3">
                                            <div className="font-semibold text-gray-800 text-xs">{client.phone || 'Non renseigné'}</div>
                                            <div className="mt-1">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[10px] font-semibold uppercase tracking-wider border ${
                                                    client.pricingTier === 'wholesale'
                                                        ? 'bg-purple-50 text-purple-800 border-purple-200'
                                                        : client.pricingTier === 'artisan'
                                                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                                                        : 'bg-gray-100 text-gray-700 border-gray-200'
                                                }`}>
                                                    <Tag className="w-2.5 h-2.5" />
                                                    {client.pricingTier === 'wholesale' ? 'Grossiste (-10%)' : (client.pricingTier === 'artisan' ? 'Artisan (-5%)' : 'Tarif Normal')}
                                                </span>
                                            </div>
                                        </td>

                                        {/* 3. Chantiers Actifs */}
                                        <td className="py-2.5 px-3">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSelectedClient360(client);
                                                    setActiveTab360('chantiers');
                                                }}
                                                className="group flex flex-col items-start hover:opacity-80 transition-opacity text-left cursor-pointer"
                                            >
                                                <div className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 px-2 py-0.5 rounded-[4px] font-semibold text-xs">
                                                    <Building2 className="w-3.5 h-3.5 text-blue-700" />
                                                    <span>{client.totalSitesCount} chantier{client.totalSitesCount > 1 ? 's' : ''}</span>
                                                    <ChevronRight className="w-3 h-3 text-blue-500 group-hover:translate-x-0.5 transition-transform" />
                                                </div>
                                                {client.sites && client.sites.length > 0 && (
                                                    <p className="text-[10px] text-gray-500 font-medium mt-1 truncate max-w-[170px]">
                                                        Dernier : {client.sites[client.sites.length - 1]?.name}
                                                    </p>
                                                )}
                                            </button>
                                        </td>

                                        {/* 4. Solde Débiteur & Plafond */}
                                        <td className="py-2.5 px-3">
                                            <div>
                                                <div className="flex items-baseline justify-between gap-2">
                                                    <span className={`text-xs font-semibold ${client.totalDebt > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                                                        {formatPrice(client.totalDebt)}
                                                    </span>
                                                    <span className="text-[10px] text-gray-500 font-medium">
                                                        Plafond : {client.creditLimit > 0 ? formatPrice(client.creditLimit) : 'Sans plafond'}
                                                    </span>
                                                </div>

                                                {/* Credit Utilization Bar */}
                                                {client.creditLimit > 0 ? (
                                                    <div className="mt-1 space-y-0.5">
                                                        <div className="w-full bg-gray-200 rounded-[1px] h-1.5 overflow-hidden">
                                                            <div 
                                                                className={`h-full rounded-[1px] transition-all duration-300 ${
                                                                    client.isExceeded 
                                                                        ? 'bg-rose-600' 
                                                                        : client.utilizationRate > 75 
                                                                        ? 'bg-amber-500' 
                                                                        : 'bg-emerald-600'
                                                                }`}
                                                                style={{ width: `${Math.min(100, client.utilizationRate)}%` }}
                                                            ></div>
                                                        </div>
                                                        <div className="flex justify-between text-[10px] font-medium text-gray-500">
                                                            <span>{client.utilizationRate}% utilisé</span>
                                                            {client.isExceeded && (
                                                                <span className="text-rose-600 font-semibold">
                                                                    +{formatPrice(client.totalDebt - client.creditLimit)}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="text-[10px] text-gray-400 font-medium mt-0.5">Pas de plafond de crédit</div>
                                                )}
                                            </div>
                                        </td>

                                        {/* 5. Avoirs & Reliquats */}
                                        <td className="py-2.5 px-3">
                                            {client.totalAvoir > 0 ? (
                                                <div className="space-y-1">
                                                    {client.activeAvoirs.filter(cn => cn.type === 'change_reliquat').map(cn => (
                                                        <div key={cn.id} className="flex items-center gap-1.5">
                                                            <span className={`inline-flex items-center gap-1.5 font-semibold px-2 py-0.5 rounded-[4px] text-[10px] uppercase tracking-wider border ${
                                                                cn.reliquatMode === 'client_credit'
                                                                    ? 'bg-blue-50 text-blue-900 border-blue-300'
                                                                    : 'bg-amber-50 text-amber-900 border-amber-300'
                                                            }`}>
                                                                <span className={`w-1.5 h-1.5 rounded-[4px] animate-pulse ${cn.reliquatMode === 'client_credit' ? 'bg-blue-600' : 'bg-amber-600'}`}></span>
                                                                <span>{cn.reliquatMode === 'client_credit' ? 'Avance' : 'Reliquat'}</span>
                                                            </span>
                                                            <span className={`text-xs font-semibold ${cn.reliquatMode === 'client_credit' ? 'text-blue-900' : 'text-amber-900'}`}>
                                                                {formatPrice(cn.remainingAmount)}
                                                            </span>
                                                        </div>
                                                    ))}
                                                    {client.activeAvoirs.some(cn => cn.type !== 'change_reliquat') && (
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-900 border border-emerald-300 font-semibold px-2 py-0.5 rounded-[4px] text-[10px] uppercase tracking-wider">
                                                                <span className="w-1.5 h-1.5 rounded-[4px] bg-emerald-600 animate-pulse"></span>
                                                                <span>Avoir</span>
                                                            </span>
                                                            <span className="text-xs font-semibold text-emerald-700">
                                                                {formatPrice(client.activeAvoirs.filter(cn => cn.type !== 'change_reliquat').reduce((s, cn) => s + cn.remainingAmount, 0))}
                                                            </span>
                                                        </div>
                                                    )}
                                                    <p className="text-[10px] text-gray-500 font-medium">
                                                        {client.activeAvoirs.length} bon{client.activeAvoirs.length > 1 ? 's' : ''} actif{client.activeAvoirs.length > 1 ? 's' : ''} • Total : <strong className="text-[#001d35] font-semibold">{formatPrice(client.totalAvoir)}</strong>
                                                    </p>
                                                </div>
                                            ) : (
                                                <span className="text-[10px] text-gray-400 font-medium">Aucun avoir</span>
                                            )}
                                        </td>

                                        {/* 6. Actions */}
                                        <td className="py-2.5 px-2 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                {/* 360° Profile Button */}
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedClient360(client)}
                                                    className="flex items-center gap-1 bg-[#001d35] hover:bg-[#00284a] text-white px-2.5 py-1 rounded-[4px] text-xs font-semibold uppercase tracking-wider transition-all shadow-xs cursor-pointer active:scale-95"
                                                    title="Ouvrir la Fiche Client 360°"
                                                >
                                                    <Eye className="w-3.5 h-3.5 text-[#f77500]" />
                                                    <span>Fiche 360°</span>
                                                </button>

                                                {/* WhatsApp Reminder */}
                                                <button
                                                    type="button"
                                                    onClick={() => handleWhatsAppReminder(client)}
                                                    className="p-1.5 text-emerald-700 hover:text-white hover:bg-emerald-600 rounded-[4px] border border-emerald-300 transition-colors cursor-pointer"
                                                    title="Relancer sur WhatsApp (1-clic)"
                                                >
                                                    <MessageSquare className="w-3.5 h-3.5" />
                                                </button>

                                                {/* Print Statement */}
                                                <button
                                                    type="button"
                                                    onClick={() => handlePrintAccountStatement(client)}
                                                    className="p-1.5 text-gray-600 hover:text-[#001d35] hover:bg-blue-50 rounded-[4px] border border-gray-300 transition-colors cursor-pointer"
                                                    title="Imprimer Relevé A4"
                                                >
                                                    <Printer className="w-3.5 h-3.5" />
                                                </button>

                                                {/* Edit */}
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenModal(client)}
                                                    className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-[4px] transition-colors cursor-pointer"
                                                    title="Modifier informations"
                                                >
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                </button>

                                                {/* Delete */}
                                                <button
                                                    type="button"
                                                    onClick={() => handleDelete(client.id, client.name, client.totalDebt)}
                                                    disabled={client.id === 'client_divers' || client.totalDebt > 0}
                                                    className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-[4px] transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400 cursor-pointer"
                                                    title={client.totalDebt > 0 ? "Suppression bloquée : dette active" : "Supprimer"}
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            ) : (
                /* ── JOURNAL D'AUDIT & HISTORIQUE DES OPÉRATIONS CLIENTS ── */
                <div className="bg-white border-2 border-gray-300 rounded-[4px] shadow-sm overflow-hidden min-h-[350px] flex flex-col justify-start animate-in fade-in duration-150">
                    {filterLoading ? (
                        <div className="p-16 flex flex-col items-center justify-center bg-white animate-in fade-in duration-150 min-h-[350px] my-auto">
                            <div className="relative h-10 w-10">
                                <div className="absolute inset-0 animate-spin rounded-full border-4 border-gray-200 border-t-[#001d35]"></div>
                                <div className="absolute inset-1.5 animate-spin-reverse rounded-full border-2 border-transparent border-b-[#f77500]"></div>
                            </div>
                            <p className="text-xs font-semibold text-[#001d35] mt-3 uppercase tracking-wider">
                                Filtrage de l'historique des opérations...
                            </p>
                            <p className="text-[11px] text-gray-500 mt-0.5 font-medium">
                                Interrogation des opérations et application des critères...
                            </p>
                        </div>
                    ) : filteredOperations.length === 0 ? (
                        <div className="p-12 text-center text-gray-500 my-auto">
                            <History className="w-12 h-12 mx-auto text-gray-400 mb-2 opacity-60" />
                            <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                Aucune opération trouvée dans le journal d'audit
                            </h3>
                            <p className="text-[11px] text-gray-500 mt-1 max-w-md mx-auto font-normal">
                                {searchTerm || operationFilter !== 'none' || operationClientFilter !== 'all' || operationPeriod !== 'all'
                                    ? "Aucun enregistrement ne correspond à vos filtres de recherche. Essayez de réinitialiser la recherche."
                                    : "Les avances sur compte issues des reliquats de caisse, créations de comptes et règlements apparaîtront ici automatiquement."}
                            </p>
                            {(searchTerm || operationFilter !== 'none' || operationClientFilter !== 'all' || operationPeriod !== 'all') && (
                                <button
                                    type="button"
                                    onClick={() => handleFilterChange(() => {
                                        setSearchTerm('');
                                        setOperationFilter('none');
                                        setOperationClientFilter('all');
                                        setOperationPeriod('today');
                                        setOperationCustomStartDate('');
                                        setOperationCustomEndDate('');
                                    })}
                                    className="mt-4 px-3.5 py-1.5 bg-[#001d35] hover:bg-[#00284a] text-white text-xs font-semibold uppercase tracking-wider rounded-[4px] inline-flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 transition-all"
                                >
                                    <span>Réinitialiser les filtres</span>
                                </button>
                            )}
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-[#001d35] text-white font-semibold uppercase tracking-wider text-[10px] divide-x divide-white/20 sticky top-0">
                                            <th style={{ width: '42px', minWidth: '42px' }} className="px-1 py-2 text-center border-r-2 border-white/20">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 rounded-sm border-white/20 accent-[#001d35] cursor-pointer"
                                                    checked={paginatedOperations.length > 0 && paginatedOperations.every(op => selectedOperationIds.includes(op.id))}
                                                    onChange={handleSelectAllOperations}
                                                    title="Tout cocher / Tout décocher"
                                                />
                                            </th>
                                            <th className="py-2.5 px-3 w-40">Date & Heure</th>
                                            <th className="py-2.5 px-3 w-56">Opération & Référence</th>
                                            <th className="py-2.5 px-3 w-52">Client & Compte</th>
                                            <th className="py-2.5 px-3 w-40">Chantier</th>
                                            <th className="py-2.5 px-3 text-right w-44">Montant & Impact</th>
                                            <th className="py-2.5 px-3 text-center w-28">Statut</th>
                                            <th className="py-2.5 px-3">Auteur, Caisse & Notes d'Audit</th>
                                            <th className="py-2.5 px-2 text-center w-28">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {paginatedOperations.map((op, idx) => {
                                            const isSelected = selectedOperationIds.includes(op.id);
                                            const opDate = new Date(op.date);
                                            const dateStr = !isNaN(opDate.getTime()) ? opDate.toLocaleDateString('fr-FR') : 'Date N/A';
                                            const timeStr = !isNaN(opDate.getTime()) ? opDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
                                            
                                            return (
                                                <tr 
                                                    key={op.id || idx}
                                                    className={`transition-colors border-b border-gray-200 select-none ${
                                                        isSelected 
                                                            ? 'bg-blue-50' 
                                                            : idx % 2 === 0 ? 'bg-white hover:bg-blue-50/40' : 'bg-slate-50/70 hover:bg-blue-50/40'
                                                    }`}
                                                >
                                                    {/* Case à cocher par ligne (Style Catalogue Produits) */}
                                                    <td className="px-1 py-2 text-center w-10">
                                                        <input
                                                            type="checkbox"
                                                            className="w-4 h-4 rounded-sm border-gray-300 accent-[#001d35] cursor-pointer"
                                                            checked={isSelected}
                                                            onChange={() => handleSelectOperation(op.id)}
                                                        />
                                                    </td>

                                                    {/* 1. Date & Heure */}
                                                    <td className="py-2.5 px-3 whitespace-nowrap">
                                                        <div className="flex items-center gap-1.5 font-semibold text-gray-900 text-xs">
                                                            <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                                            <span>{dateStr}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1 text-[10px] text-gray-500 font-mono pl-5">
                                                            <Clock className="w-2.5 h-2.5" />
                                                            <span>{timeStr}</span>
                                                        </div>
                                                    </td>

                                                    {/* 2. Opération & Référence */}
                                                    <td className="py-2.5 px-3">
                                                        <div className="flex flex-col items-start gap-1">
                                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[10px] font-semibold border uppercase tracking-wider ${op.badgeColor}`}>
                                                                {op.category === 'reliquat_credit' && <Coins className="w-3 h-3 text-emerald-700" />}
                                                                {op.category === 'auto_client' && <UserPlus className="w-3 h-3 text-blue-700" />}
                                                                {op.category === 'debt_payment' && <CheckCircle2 className="w-3 h-3 text-emerald-700" />}
                                                                {op.category === 'credit_sale' && <FileText className="w-3 h-3 text-rose-700" />}
                                                                {op.category === 'site' && <Building2 className="w-3 h-3 text-cyan-700" />}
                                                                <span>{op.typeLabel}</span>
                                                            </span>
                                                            <span className="font-mono text-[10px] text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded-[4px] border border-gray-200">
                                                                {op.refCode}
                                                            </span>
                                                        </div>
                                                    </td>

                                                    {/* 3. Client & Compte */}
                                                    <td className="py-2.5 px-3">
                                                        <div className="font-bold text-[#001d35] text-xs">
                                                            {op.clientName}
                                                        </div>
                                                        {op.category === 'auto_client' && (
                                                            <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-[4px] border border-blue-200 mt-0.5">
                                                                <UserCheck className="w-2.5 h-2.5" /> Créé via caisse
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* 4. Chantier */}
                                                    <td className="py-2.5 px-3">
                                                        {op.siteName ? (
                                                            <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-900 border border-blue-200 px-2 py-0.5 rounded-[4px] font-semibold text-[11px]">
                                                                <Building2 className="w-3 h-3 text-blue-600 shrink-0" />
                                                                <span className="truncate max-w-[130px]">{op.siteName}</span>
                                                            </span>
                                                        ) : (
                                                            <span className="text-[11px] text-gray-400 font-medium italic">
                                                                Comptoir / Général
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* 5. Montant & Impact */}
                                                    <td className="py-2.5 px-3 text-right">
                                                        {op.category === 'reliquat_credit' ? (
                                                            <div>
                                                                <div className="text-xs font-bold text-emerald-700">
                                                                    +{formatPrice(op.amount)}
                                                                </div>
                                                                <div className="text-[10px] text-gray-500 font-medium">
                                                                    Reste : <strong className="text-emerald-900 font-semibold">{formatPrice(op.remainingAmount)}</strong>
                                                                </div>
                                                            </div>
                                                        ) : op.category === 'debt_payment' ? (
                                                            <div>
                                                                <div className="text-xs font-bold text-emerald-700">
                                                                    -{formatPrice(op.amount)}
                                                                </div>
                                                                <div className="text-[10px] text-gray-500 font-medium">
                                                                    Règlement dette
                                                                </div>
                                                            </div>
                                                        ) : op.category === 'credit_sale' ? (
                                                            <div>
                                                                <div className="text-xs font-bold text-rose-700">
                                                                    +{formatPrice(op.amount)}
                                                                </div>
                                                                <div className="text-[10px] text-gray-500 font-medium">
                                                                    Créance accordée
                                                                </div>
                                                            </div>
                                                        ) : op.category === 'auto_client' ? (
                                                            <div>
                                                                <div className="text-xs font-bold text-blue-700">
                                                                    {op.amount > 0 ? `Plafond : ${formatPrice(op.amount)}` : 'Compte Ouvert'}
                                                                </div>
                                                                <div className="text-[10px] text-gray-500 font-medium">
                                                                    Crédité en caisse
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-400 text-xs font-medium">-</span>
                                                        )}
                                                    </td>

                                                    {/* 6. Statut */}
                                                    <td className="py-2.5 px-3 text-center">
                                                        <span className={`inline-block px-2 py-0.5 text-[10px] font-semibold rounded-[4px] uppercase tracking-wider border ${
                                                            op.status === 'active' || op.status === 'completed' || op.status === 'Disponible' || op.status === 'paid'
                                                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                                                : (op.status === 'pending' || op.status === 'En-cours'
                                                                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                                                                    : 'bg-gray-100 text-gray-700 border-gray-300')
                                                        }`}>
                                                            {op.status === 'active' ? 'Disponible' : (op.status === 'completed' ? 'Validé' : (op.status === 'pending' ? 'En attente' : (op.status || 'OK')))}
                                                        </span>
                                                    </td>

                                                    {/* 7. Auteur & Notes d'Audit */}
                                                    <td className="py-2.5 px-3">
                                                        <div className="flex items-center gap-1.5 text-xs text-gray-800 font-medium">
                                                            <span className="font-semibold text-[#001d35]">{op.cashier}</span>
                                                        </div>
                                                        <p className="text-[11px] text-gray-500 font-normal mt-0.5 line-clamp-2" title={op.notes}>
                                                            {op.notes}
                                                        </p>
                                                    </td>

                                                    {/* 8. Action */}
                                                    <td className="py-2.5 px-2 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const target = enrichedClients.find(c => 
                                                                    (op.clientId && c.id === op.clientId) || 
                                                                    (c.name && op.clientName && c.name.toLowerCase().trim() === op.clientName.toLowerCase().trim())
                                                                );
                                                                if (target) {
                                                                    setSelectedClient360(target);
                                                                } else {
                                                                    T.info(`Fiche de "${op.clientName}" non disponible.`);
                                                                }
                                                            }}
                                                            className="inline-flex items-center gap-1 bg-[#001d35] hover:bg-[#00284a] text-white px-2 py-1 rounded-[4px] text-[11px] font-semibold transition-all shadow-xs cursor-pointer active:scale-95"
                                                            title="Consulter la Fiche 360° de ce client"
                                                        >
                                                            <Eye className="w-3 h-3 text-[#f77500]" />
                                                            <span>Fiche 360°</span>
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* ── Barre de pagination (10 opérations par page par défaut) ── */}
                            <div className="bg-gray-50 px-3 py-2 border-t-2 border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs select-none">
                                <div className="flex items-center gap-2 text-gray-600">
                                    <span>Affichage de <strong className="text-[#001d35] font-semibold">{filteredOperations.length === 0 ? 0 : (opsPage - 1) * opsPerPage + 1}</strong> à <strong className="text-[#001d35] font-semibold">{Math.min(opsPage * opsPerPage, filteredOperations.length)}</strong> sur <strong className="text-[#001d35] font-semibold">{filteredOperations.length}</strong> opération(s)</span>
                                    <span className="text-gray-300">|</span>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[11px] text-gray-500 font-medium">Lignes :</span>
                                        <select
                                            value={opsPerPage}
                                            onChange={(e) => {
                                                setOpsPerPage(Number(e.target.value));
                                                setOpsPage(1);
                                            }}
                                            className="px-2 py-0.5 text-xs font-semibold border border-gray-300 rounded-[4px] bg-white text-[#001d35] focus:outline-none focus:ring-1 focus:ring-[#001d35] cursor-pointer"
                                        >
                                            <option value={10}>10</option>
                                            <option value={25}>25</option>
                                            <option value={50}>50</option>
                                            <option value={100}>100</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => setOpsPage(p => Math.max(1, p - 1))}
                                        disabled={opsPage === 1}
                                        className="px-2.5 py-1 rounded-[4px] border border-gray-300 bg-white hover:bg-gray-100 text-gray-700 font-semibold disabled:opacity-40 disabled:hover:bg-white cursor-pointer disabled:cursor-not-allowed flex items-center gap-1 transition-all active:scale-95"
                                    >
                                        <ChevronLeft className="w-3.5 h-3.5" />
                                        <span className="hidden sm:inline">Précédent</span>
                                    </button>

                                    <div className="flex items-center gap-1 px-1">
                                        {Array.from({ length: totalOpsPages }, (_, i) => i + 1)
                                            .filter(p => p === 1 || p === totalOpsPages || Math.abs(p - opsPage) <= 1)
                                            .map((p, pIdx, arr) => {
                                                const prevP = arr[pIdx - 1];
                                                const showEllipsis = prevP && p - prevP > 1;
                                                return (
                                                    <React.Fragment key={p}>
                                                        {showEllipsis && <span className="px-1 text-gray-400 font-bold">...</span>}
                                                        <button
                                                            type="button"
                                                            onClick={() => setOpsPage(p)}
                                                            className={`w-7 h-7 text-xs font-bold rounded-[4px] transition-all cursor-pointer ${
                                                                opsPage === p
                                                                    ? 'bg-[#001d35] text-white shadow-xs'
                                                                    : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
                                                            }`}
                                                        >
                                                            {p}
                                                        </button>
                                                    </React.Fragment>
                                                );
                                            })}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => setOpsPage(p => Math.min(totalOpsPages, p + 1))}
                                        disabled={opsPage === totalOpsPages}
                                        className="px-2.5 py-1 rounded-[4px] border border-gray-300 bg-white hover:bg-gray-100 text-gray-700 font-semibold disabled:opacity-40 disabled:hover:bg-white cursor-pointer disabled:cursor-not-allowed flex items-center gap-1 transition-all active:scale-95"
                                    >
                                        <span className="hidden sm:inline">Suivant</span>
                                        <ChevronRight className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ======================================================== */}
            {/* COMPREHENSIVE FICHE CLIENT 360° MODAL                    */}
            {/* ======================================================== */}
            {active360Client && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
                    <div className="bg-white w-full max-w-4xl rounded-[4px] shadow-2xl border-2 border-[#001d35] overflow-hidden animate-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col">
                        {/* Header modale 360 */}
                        <div className="bg-[#001d35] text-white px-4 py-3 flex justify-between items-center border-b-2 border-[#f77500] shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-[4px] bg-white/10 flex items-center justify-center text-base shrink-0">
                                    {active360Client.type === 'entreprise' ? '🏢' : (active360Client.type === 'artisan' ? '🔨' : '👤')}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-xs font-semibold uppercase tracking-wider text-white">
                                            {active360Client.name}
                                        </h3>
                                        <span className={`px-2 py-0.5 rounded-[4px] text-[10px] font-semibold uppercase tracking-wider ${
                                            active360Client.pricingTier === 'wholesale'
                                                ? 'bg-purple-100 text-purple-900'
                                                : active360Client.pricingTier === 'artisan'
                                                ? 'bg-amber-100 text-amber-900'
                                                : 'bg-blue-100 text-blue-900'
                                        }`}>
                                            {active360Client.pricingTier === 'wholesale' ? '👑 Grossiste (-10%)' : (active360Client.pricingTier === 'artisan' ? '⭐ Artisan (-5%)' : 'Comptoir')}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-300 mt-0.5 font-normal">
                                        {active360Client.phone && (
                                            <span className="flex items-center gap-1 font-medium text-white">
                                                <Phone className="w-3 h-3 text-emerald-400" />
                                                <span>{active360Client.phone}</span>
                                            </span>
                                        )}
                                        {active360Client.address && (
                                            <span className="flex items-center gap-1 text-gray-300">
                                                <MapPin className="w-3 h-3 text-gray-400" />
                                                <span>{active360Client.address}</span>
                                            </span>
                                        )}
                                        {active360Client.nif && (
                                            <span className="text-gray-300">NIF : <strong className="text-white font-medium">{active360Client.nif}</strong></span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Close & Action Buttons */}
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleWhatsAppReminder(active360Client)}
                                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-[4px] font-semibold text-xs uppercase tracking-wider shadow-xs transition-all cursor-pointer"
                                >
                                    <MessageSquare className="w-3.5 h-3.5" />
                                    <span>WhatsApp</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handlePrintAccountStatement(active360Client)}
                                    className="flex items-center gap-1.5 bg-white hover:bg-gray-50 text-[#001d35] border border-gray-300 px-3 py-1.5 rounded-[4px] font-semibold text-xs uppercase tracking-wider transition-all cursor-pointer"
                                >
                                    <Printer className="w-3.5 h-3.5" />
                                    <span>Relevé A4</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedClient360(null)}
                                    className="text-gray-300 hover:text-white p-1 rounded-[4px] transition-colors cursor-pointer ml-1"
                                    title="Fermer"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Credit Solvency Gauge Banner */}
                        <div className={`px-4 py-3 border-b flex flex-col sm:flex-row justify-between items-center gap-4 ${
                            active360Client.isExceeded
                                ? 'bg-rose-50 border-rose-200'
                                : active360Client.totalDebt > 0
                                ? 'bg-amber-50/70 border-amber-200'
                                : 'bg-emerald-50/70 border-emerald-200'
                        }`}>
                            <div className="flex items-center gap-3 w-full sm:w-auto">
                                <div className={`p-2 rounded-[4px] ${
                                    active360Client.isExceeded
                                        ? 'bg-rose-600 text-white'
                                        : active360Client.totalDebt > 0
                                        ? 'bg-amber-600 text-white'
                                        : 'bg-emerald-600 text-white'
                                }`}>
                                    {active360Client.isExceeded ? <ShieldAlert className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold uppercase tracking-wider text-gray-700">Solvabilité & Crédit</span>
                                        {active360Client.isExceeded && (
                                            <span className="text-[10px] font-semibold uppercase tracking-wider text-rose-700 bg-rose-100 px-2 py-0.5 rounded-[4px] border border-rose-300">
                                                Dépassement de {formatPrice(active360Client.totalDebt - active360Client.creditLimit)}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-baseline gap-4 mt-0.5">
                                        <span className="text-xs text-gray-600 font-medium">
                                            Dette en cours : <strong className={`text-xs font-semibold ${active360Client.totalDebt > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{formatPrice(active360Client.totalDebt)}</strong>
                                        </span>
                                        <span className="text-xs text-gray-600 font-medium">
                                            Plafond : <strong className="font-semibold text-gray-800">{active360Client.creditLimit > 0 ? formatPrice(active360Client.creditLimit) : 'Sans plafond'}</strong>
                                        </span>
                                        {active360Client.creditLimit > 0 && !active360Client.isExceeded && (
                                            <span className="text-xs text-emerald-700 font-medium">
                                                Disponible : <strong className="font-semibold text-emerald-700">{formatPrice(active360Client.creditLimit - active360Client.totalDebt)}</strong>
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {active360Client.creditLimit > 0 && (
                                 <div className="w-full sm:w-48 text-right">
                                     <div className="w-full bg-gray-200 rounded-[1px] h-2 overflow-hidden">
                                         <div
                                             className={`h-full rounded-[1px] ${
                                                 active360Client.isExceeded ? 'bg-rose-600' : active360Client.utilizationRate > 75 ? 'bg-amber-500' : 'bg-emerald-600'
                                             }`}
                                             style={{ width: `${Math.min(100, active360Client.utilizationRate)}%` }}
                                         ></div>
                                     </div>
                                     <p className="text-[11px] font-medium text-gray-600 mt-1">{active360Client.utilizationRate}% du plafond engagé</p>
                                 </div>
                            )}
                        </div>

                        {/* Alerte Avoir / Reliquat dans la fiche 360° */}
                        {/* Alerte Avoir / Reliquat / Avance dans la fiche 360° */}
                        {active360Client.totalAvoir > 0 && (
                            <div className={`px-4 py-2.5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                active360Client.hasAvance
                                    ? 'bg-gradient-to-r from-blue-50 via-sky-50 to-indigo-50 border-blue-300'
                                    : active360Client.hasReliquat
                                    ? 'bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border-amber-300'
                                    : 'bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200'
                            }`}>
                                <div className="flex items-center gap-2.5">
                                    <div className={`p-1.5 rounded-[4px] text-white shrink-0 ${
                                        active360Client.hasAvance 
                                            ? 'bg-blue-600 animate-pulse'
                                            : active360Client.hasReliquat ? 'bg-amber-600 animate-pulse' : 'bg-emerald-600'
                                    }`}>
                                        <Ticket className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            {active360Client.hasAvance && (
                                                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-[4px] text-white bg-blue-700">
                                                    <span className="w-1.5 h-1.5 rounded-[4px] bg-white animate-pulse"></span>
                                                    <span>AVANCE COMPTE CLIENT : {formatPrice(active360Client.totalAvance)}</span>
                                                </span>
                                            )}
                                            {active360Client.hasReliquat && (
                                                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-[4px] text-white bg-amber-600">
                                                    <span className="w-1.5 h-1.5 rounded-[4px] bg-white animate-pulse"></span>
                                                    <span>RELIQUAT MONNAIE : {formatPrice(active360Client.totalReliquatVoucher)}</span>
                                                </span>
                                            )}
                                            {active360Client.totalAvoirStandard > 0 && (
                                                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-[4px] text-white bg-emerald-700">
                                                    <span className="w-1.5 h-1.5 rounded-[4px] bg-white animate-pulse"></span>
                                                    <span>AVOIR RETOUR : {formatPrice(active360Client.totalAvoirStandard)}</span>
                                                </span>
                                            )}
                                            <span className="text-[10px] text-gray-600 font-semibold">
                                                (Total disponible : <strong>{formatPrice(active360Client.totalAvoir)}</strong> sur {active360Client.activeAvoirs.length} bon{active360Client.activeAvoirs.length > 1 ? 's' : ''})
                                            </span>
                                        </div>
                                        {active360Client.hasAvance && (
                                            <p className="text-[11px] text-blue-900 font-medium mt-0.5">
                                                <strong>{formatPrice(active360Client.totalAvance)}</strong> d'avance créditée sur sa fiche suite à un reliquat de vente — déductible au prochain passage.
                                            </p>
                                        )}
                                        {active360Client.hasReliquat && !active360Client.hasAvance && (
                                            <p className="text-[11px] text-amber-800 font-medium mt-0.5">
                                                <strong>{formatPrice(active360Client.totalReliquatVoucher)}</strong> de reliquat de monnaie imprimé sous forme de bon d'avoir.
                                            </p>
                                        )}
                                        <div className="flex flex-wrap gap-1.5 mt-1">
                                            {active360Client.activeAvoirs.map(cn => (
                                                <span key={cn.id} className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-[4px] border ${
                                                    cn.reliquatMode === 'client_credit'
                                                        ? 'bg-blue-100 text-blue-900 border-blue-300'
                                                        : cn.type === 'change_reliquat'
                                                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                                                        : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                                }`}>
                                                    {cn.reliquatMode === 'client_credit' ? '👤 Avance' : (cn.type === 'change_reliquat' ? '🎟️ Reliquat' : '📦 Avoir')} {cn.code} — {formatPrice(cn.remainingAmount)}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Interactive Tabs Header */}
                        <div className="flex border-b border-gray-200 bg-gray-100/90 px-4 pt-2 overflow-x-auto">
                            <button
                                type="button"
                                onClick={() => setActiveTab360('chantiers')}
                                className={`flex items-center gap-2 px-3.5 py-2.5 font-semibold text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                                    activeTab360 === 'chantiers'
                                        ? 'border-[#001d35] text-[#001d35] bg-white rounded-t-[4px] shadow-xs'
                                        : 'border-transparent text-gray-500 hover:text-gray-900'
                                }`}
                            >
                                <Building2 className="w-3.5 h-3.5 text-[#f77500]" />
                                <span>1. Chantiers & Projets ({active360Client.sites?.length || 0})</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveTab360('dettes')}
                                className={`flex items-center gap-2 px-3.5 py-2.5 font-semibold text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                                    activeTab360 === 'dettes'
                                        ? 'border-[#001d35] text-[#001d35] bg-white rounded-t-[4px] shadow-xs'
                                        : 'border-transparent text-gray-500 hover:text-gray-900'
                                }`}
                            >
                                <CreditCard className="w-3.5 h-3.5 text-[#f77500]" />
                                <span>2. Factures Impayées & Règlements</span>
                                {active360Client.totalDebt > 0 && (
                                    <span className="bg-rose-600 text-white text-[10px] font-semibold px-1.5 py-0.2 rounded-[4px]">
                                        !
                                    </span>
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveTab360('achats')}
                                className={`flex items-center gap-2 px-3.5 py-2.5 font-semibold text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                                    activeTab360 === 'achats'
                                        ? 'border-[#001d35] text-[#001d35] bg-white rounded-t-[4px] shadow-xs'
                                        : 'border-transparent text-gray-500 hover:text-gray-900'
                                }`}
                            >
                                <FileText className="w-3.5 h-3.5 text-[#f77500]" />
                                <span>3. Historique Global des Achats</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveTab360('avoirs')}
                                className={`flex items-center gap-2 px-3.5 py-2.5 font-semibold text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                                    activeTab360 === 'avoirs'
                                        ? 'border-[#001d35] text-[#001d35] bg-white rounded-t-[4px] shadow-xs'
                                        : 'border-transparent text-gray-500 hover:text-gray-900'
                                }`}
                            >
                                <Ticket className="w-3.5 h-3.5 text-[#f77500]" />
                                <span>4. Avoirs & Avances ({active360Client.activeAvoirs?.length || 0})</span>
                                {active360Client.totalAvoir > 0 && (
                                    <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-[4px] text-white ${
                                        active360Client.hasAvance ? 'bg-blue-600' : 'bg-[#f77500]'
                                    }`}>
                                        {formatPrice(active360Client.totalAvoir)}
                                    </span>
                                )}
                            </button>
                        </div>

                        {/* Tabs Content */}
                        <div className="p-4 overflow-y-auto flex-1 space-y-4">
                            {/* ======================================================== */}
                            {/* TAB 1: CHANTIERS & PROJETS                               */}
                            {/* ======================================================== */}
                            {activeTab360 === 'chantiers' && (
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <h4 className="text-xs font-semibold text-[#001d35] uppercase tracking-wider mb-0.5">Chantiers Déclarés</h4>
                                            <p className="text-xs text-gray-500 font-medium">Chaque chantier permet de ventiler les achats, livraisons dépôt et créances</p>
                                        </div>
                                        {!isAddingSite && (
                                            <button
                                                type="button"
                                                onClick={() => setIsAddingSite(true)}
                                                className="flex items-center gap-1.5 bg-[#001d35] hover:bg-[#00284a] text-white px-3 py-1.5 rounded-[4px] text-xs font-semibold uppercase tracking-wider transition-all shadow-sm cursor-pointer"
                                            >
                                                <Plus className="w-3.5 h-3.5 text-[#f77500]" />
                                                <span>Ajouter un Chantier</span>
                                            </button>
                                        )}
                                    </div>

                                    {/* Add Site Inline Form */}
                                    {isAddingSite && (
                                        <form onSubmit={handleCreateSite} className="bg-slate-50 border border-gray-300 rounded-[4px] p-3.5 space-y-3">
                                            <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                                                <span className="font-semibold text-xs text-[#001d35] uppercase tracking-wider">
                                                    Nouveau Chantier pour {active360Client.name}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => setIsAddingSite(false)}
                                                    className="p-1 hover:bg-slate-200 rounded-[4px] text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-[11px] font-semibold text-gray-700 uppercase tracking-wider mb-1">
                                                        Nom du Chantier <span className="text-rose-500">*</span>
                                                    </label>
                                                    <input
                                                        type="text"
                                                        required
                                                        value={newSiteData.name}
                                                        onChange={(e) => setNewSiteData({ ...newSiteData, name: e.target.value })}
                                                        placeholder="Ex: Villa Agoè Logopé, Immeuble Port R+2..."
                                                        className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-[4px] focus:outline-none focus:ring-1 focus:ring-[#001d35] bg-white font-semibold text-gray-800"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-[11px] font-semibold text-gray-700 uppercase tracking-wider mb-1">
                                                        Localisation / Quartier
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={newSiteData.location}
                                                        onChange={(e) => setNewSiteData({ ...newSiteData, location: e.target.value })}
                                                        placeholder="Ex: Agoè, Baguida, Hedzranawoé..."
                                                        className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-[4px] focus:outline-none focus:ring-1 focus:ring-[#001d35] bg-white text-gray-800 font-medium"
                                                    />
                                                </div>

                                                <div className="sm:col-span-2">
                                                    <label className="block text-[11px] font-semibold text-gray-700 uppercase tracking-wider mb-1">
                                                        Notes / Spécificités (Quantités prévues, contact chef chantier)
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={newSiteData.notes}
                                                        onChange={(e) => setNewSiteData({ ...newSiteData, notes: e.target.value })}
                                                        placeholder="Ex: 400 sacs ciment prévus, livraison par tricycle acceptée"
                                                        className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-[4px] focus:outline-none focus:ring-1 focus:ring-[#001d35] bg-white text-gray-800 font-medium"
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
                                                <button
                                                    type="button"
                                                    onClick={() => setIsAddingSite(false)}
                                                    className="py-1.5 px-3 border border-gray-300 text-gray-700 font-semibold uppercase tracking-wider text-xs hover:bg-gray-100 rounded-[4px] cursor-pointer transition-colors"
                                                >
                                                    Annuler
                                                </button>
                                                <button
                                                    type="submit"
                                                    className="py-1.5 px-4 bg-[#001d35] hover:bg-[#00284a] text-white font-semibold uppercase tracking-wider text-xs rounded-[4px] cursor-pointer transition-colors shadow-sm"
                                                >
                                                    Enregistrer le Chantier
                                                </button>
                                            </div>
                                        </form>
                                    )}

                                    {/* Sites Grid */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {(!active360Client.sites || active360Client.sites.length === 0) ? (
                                            <div className="sm:col-span-2 p-8 text-center bg-gray-50 border-2 border-dashed border-gray-300 rounded-[4px]">
                                                <Building2 className="w-10 h-10 text-gray-400 mx-auto mb-2 opacity-60" />
                                                <p className="font-semibold text-gray-700 text-xs uppercase tracking-wider">Aucun chantier spécifique enregistré</p>
                                                <p className="text-[11px] text-gray-500 font-medium mt-0.5">Ajoutez un chantier pour suivre précisément les retraits de matériaux et les dettes par projet.</p>
                                            </div>
                                        ) : (
                                            active360Client.sites.map(site => {
                                                const siteDebts = (active360Client.allDebts || []).filter(d => d.siteName?.toLowerCase().trim() === site.name.toLowerCase().trim());
                                                const siteDebtRemaining = siteDebts.filter(d => d.status === 'pending').reduce((sum, d) => sum + (d.totalAmount - d.paidAmount), 0);
                                                
                                                return (
                                                    <div key={site.id} className="bg-white border-2 border-gray-200 hover:border-gray-300 rounded-[4px] p-3 space-y-2 shadow-2xs transition-all">
                                                        <div className="flex justify-between items-start">
                                                            <div>
                                                                <h5 className="font-semibold text-xs text-[#001d35] flex items-center gap-1.5">
                                                                    <span>🏗️ {site.name}</span>
                                                                </h5>
                                                                {site.location && (
                                                                    <p className="text-[11px] text-gray-500 font-medium flex items-center gap-1 mt-0.5">
                                                                        <MapPin className="w-3 h-3 text-gray-400" />
                                                                        <span>{site.location}</span>
                                                                    </p>
                                                                )}
                                                            </div>
                                                            <span className={`px-2 py-0.5 rounded-[4px] text-[10px] font-semibold uppercase tracking-wider ${
                                                                site.status === 'completed'
                                                                    ? 'bg-gray-100 text-gray-600 border border-gray-300'
                                                                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                                            }`}>
                                                                {site.status === 'completed' ? 'Achevé' : 'En Cours'}
                                                            </span>
                                                        </div>

                                                        {site.notes && (
                                                            <p className="text-[11px] text-gray-600 font-medium bg-gray-50 p-2 rounded-[4px] border border-gray-100 italic">
                                                                "{site.notes}"
                                                            </p>
                                                        )}

                                                        <div className="flex justify-between items-center pt-2 border-t border-gray-100 text-xs">
                                                            <div>
                                                                <span className="text-gray-500 text-[11px] font-medium">Dette chantier : </span>
                                                                <strong className={`font-semibold ${siteDebtRemaining > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                                                                    {formatPrice(siteDebtRemaining)}
                                                                </strong>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => updateSite(active360Client.id, site.id, {
                                                                        status: site.status === 'completed' ? 'active' : 'completed'
                                                                    })}
                                                                    className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 hover:underline cursor-pointer"
                                                                >
                                                                    {site.status === 'completed' ? 'Rouvrir' : 'Clôturer'}
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        if (window.confirm(`Supprimer le chantier "${site.name}" ?`)) {
                                                                            deleteSite(active360Client.id, site.id);
                                                                        }
                                                                    }}
                                                                    className="text-[10px] font-semibold uppercase tracking-wider text-rose-500 hover:text-rose-700 ml-1 cursor-pointer"
                                                                >
                                                                    Supprimer
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* ======================================================== */}
                            {/* TAB 2: FACTURES IMPAYÉES & RÈGLEMENTS                    */}
                            {/* ======================================================== */}
                            {activeTab360 === 'dettes' && (
                                <div className="space-y-3.5">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-[4px] border-2 border-gray-300 shadow-2xs">
                                        <div>
                                            <h4 className="text-xs font-semibold text-[#001d35] uppercase tracking-wider mb-0.5">
                                                Carnet de Dettes & Règlements
                                            </h4>
                                            <p className="text-xs text-gray-500 font-medium">
                                                Saisie directe d'acomptes, règlements espèces / mobile money et imputation d'avances
                                            </p>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2">
                                            {(active360Client.totalDebt || 0) > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setPaymentDebtTarget({ id: 'ALL', isGlobal: true, totalAmount: active360Client.totalDebt, paidAmount: 0 });
                                                        setPaymentAmount(active360Client.totalDebt.toString());
                                                        setDebtPaymentMethod('cash');
                                                        setDebtPaymentNote('');
                                                    }}
                                                    className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-[4px] bg-[#001d35] hover:bg-[#00284a] text-white transition-all cursor-pointer shadow-sm active:scale-95"
                                                >
                                                    <DollarSign className="w-3.5 h-3.5 text-[#f77500]" />
                                                    <span>Règlement Global</span>
                                                </button>
                                            )}

                                            {(active360Client.totalDebt || 0) > 0 && (active360Client.totalAvoir || 0) > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setPaymentDebtTarget({ id: 'ALL', isGlobal: true, totalAmount: active360Client.totalDebt, paidAmount: 0 });
                                                        const amtToPay = Math.min(active360Client.totalAvoir, active360Client.totalDebt);
                                                        setPaymentAmount(amtToPay.toString());
                                                        setDebtPaymentMethod('avoir');
                                                        setDebtPaymentNote(`Imputation solde avance disponible (${formatPrice(active360Client.totalAvoir)})`);
                                                    }}
                                                    className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-[4px] bg-amber-600 hover:bg-amber-700 text-white transition-all cursor-pointer shadow-sm active:scale-95"
                                                >
                                                    <Ticket className="w-3.5 h-3.5" />
                                                    <span>Imputer Avance ({formatPrice(Math.min(active360Client.totalAvoir, active360Client.totalDebt))})</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Mini KPI banner */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="bg-rose-50/70 border border-rose-200 rounded-[4px] p-3 flex justify-between items-center">
                                            <div>
                                                <span className="text-[10px] font-semibold text-rose-800 uppercase tracking-wider block">
                                                    Solde Débiteur Total (Créances dues)
                                                </span>
                                                <span className="text-base sm:text-lg font-bold text-rose-700 mt-0.5 block">
                                                    {formatPrice(active360Client.totalDebt || 0)}
                                                </span>
                                            </div>
                                            <div className="text-right text-[11px] text-rose-600 font-medium">
                                                {(active360Client.allDebts || []).filter(d => d.status === 'pending').length} facture(s) impayée(s)
                                            </div>
                                        </div>

                                        <div className="bg-emerald-50/70 border border-emerald-200 rounded-[4px] p-3 flex justify-between items-center">
                                            <div>
                                                <span className="text-[10px] font-semibold text-emerald-800 uppercase tracking-wider block">
                                                    Avances & Avoirs Disponibles (Crédit client)
                                                </span>
                                                <span className="text-base sm:text-lg font-bold text-emerald-700 mt-0.5 block">
                                                    {formatPrice(active360Client.totalAvoir || 0)}
                                                </span>
                                            </div>
                                            <div className="text-right text-[11px] text-emerald-600 font-medium">
                                                {(active360Client.activeAvoirs || []).length} avance(s) / bon(s) actif(s)
                                            </div>
                                        </div>
                                    </div>

                                    {/* Quick Payment Form inside 360° */}
                                    {paymentDebtTarget && (
                                        <form onSubmit={handleExecuteDebtPayment} className="bg-slate-50/80 border-2 border-gray-300 rounded-[4px] p-3.5 space-y-3.5 animate-in fade-in duration-150 shadow-xs">
                                            <div className="flex justify-between items-center border-b-2 border-gray-200 pb-2">
                                                <div className="flex items-center gap-2 text-[#001d35] font-semibold text-xs uppercase tracking-wider">
                                                    <DollarSign className="w-4 h-4 text-emerald-600" />
                                                    <span>
                                                        {paymentDebtTarget.id === 'ALL'
                                                            ? `Règlement Global — Solde total dû : ${formatPrice(active360Client.totalDebt)}`
                                                            : `Encaisser un versement sur la facture #${paymentDebtTarget.id}`}
                                                    </span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setPaymentDebtTarget(null)}
                                                    className="p-1 hover:bg-slate-200 rounded-[4px] text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>

                                            {/* Mode de règlement selector */}
                                            <div>
                                                <label className="block text-[11px] font-semibold text-[#001d35] uppercase tracking-wide mb-1.5">
                                                    Mode de Règlement
                                                </label>
                                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setDebtPaymentMethod('cash')}
                                                        className={`px-3 py-2 rounded-[4px] text-xs font-semibold uppercase tracking-wider border text-center transition-all cursor-pointer ${
                                                            debtPaymentMethod === 'cash'
                                                                ? 'bg-[#001d35] text-white border-[#001d35] shadow-xs'
                                                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                                        }`}
                                                    >
                                                        💵 Espèces
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={(active360Client.totalAvoir || 0) <= 0}
                                                        onClick={() => {
                                                            setDebtPaymentMethod('avoir');
                                                            const maxPay = paymentDebtTarget.id === 'ALL'
                                                                ? active360Client.totalDebt
                                                                : Math.max(0, paymentDebtTarget.totalAmount - paymentDebtTarget.paidAmount);
                                                            setPaymentAmount(Math.min(active360Client.totalAvoir, maxPay).toString());
                                                        }}
                                                        className={`px-3 py-2 rounded-[4px] text-xs font-semibold uppercase tracking-wider border text-center transition-all cursor-pointer ${
                                                            debtPaymentMethod === 'avoir'
                                                                ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                                                                : (active360Client.totalAvoir || 0) > 0
                                                                ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                                                                : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-60'
                                                        }`}
                                                    >
                                                        <span>🎫 Avoir / Avance</span>
                                                        {(active360Client.totalAvoir || 0) > 0 && (
                                                            <span className="block text-[9px] font-semibold opacity-90">
                                                                {formatPrice(active360Client.totalAvoir)}
                                                            </span>
                                                        )}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setDebtPaymentMethod('wave_om')}
                                                        className={`px-3 py-2 rounded-[4px] text-xs font-semibold uppercase tracking-wider border text-center transition-all cursor-pointer ${
                                                            debtPaymentMethod === 'wave_om'
                                                                ? 'bg-[#001d35] text-white border-[#001d35] shadow-xs'
                                                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                                        }`}
                                                    >
                                                        📱 Mobile Money
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setDebtPaymentMethod('check')}
                                                        className={`px-3 py-2 rounded-[4px] text-xs font-semibold uppercase tracking-wider border text-center transition-all cursor-pointer ${
                                                            debtPaymentMethod === 'check'
                                                                ? 'bg-[#001d35] text-white border-[#001d35] shadow-xs'
                                                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                                        }`}
                                                    >
                                                        📝 Chèque
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setDebtPaymentMethod('bank')}
                                                        className={`px-3 py-2 rounded-[4px] text-xs font-semibold uppercase tracking-wider border text-center transition-all cursor-pointer ${
                                                            debtPaymentMethod === 'bank'
                                                                ? 'bg-[#001d35] text-white border-[#001d35] shadow-xs'
                                                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                                        }`}
                                                    >
                                                        🏦 Virement
                                                    </button>
                                                </div>
                                            </div>

                                            {debtPaymentMethod === 'avoir' && (
                                                <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-[4px] text-xs text-amber-900 flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <Ticket className="w-4 h-4 text-amber-600 shrink-0" />
                                                        <span>
                                                            <strong>Imputation automatique :</strong> Le versement sera déduit de l'avance disponible de <strong>{formatPrice(active360Client.totalAvoir)}</strong>.
                                                        </span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const maxPay = paymentDebtTarget.id === 'ALL'
                                                                ? active360Client.totalDebt
                                                                : Math.max(0, paymentDebtTarget.totalAmount - paymentDebtTarget.paidAmount);
                                                            setPaymentAmount(Math.min(active360Client.totalAvoir, maxPay).toString());
                                                        }}
                                                        className="text-[11px] font-semibold text-amber-800 underline hover:text-amber-900 cursor-pointer ml-2 shrink-0"
                                                    >
                                                        Appliquer max ({formatPrice(Math.min(active360Client.totalAvoir, paymentDebtTarget.id === 'ALL' ? active360Client.totalDebt : Math.max(0, paymentDebtTarget.totalAmount - paymentDebtTarget.paidAmount)))})
                                                    </button>
                                                </div>
                                            )}

                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                                                <div>
                                                    <span className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1">
                                                        {paymentDebtTarget.id === 'ALL' ? 'Portée :' : 'Chantier :'}
                                                    </span>
                                                    <span className="font-semibold text-xs text-[#001d35]">
                                                        {paymentDebtTarget.id === 'ALL' ? 'Toutes créances (Tri chronologique)' : (paymentDebtTarget.siteName || 'Comptoir / Général')}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1">Reste à solder :</span>
                                                    <span className="font-semibold text-sm text-rose-600">
                                                        {formatPrice(
                                                            paymentDebtTarget.id === 'ALL'
                                                                ? active360Client.totalDebt
                                                                : Math.max(0, paymentDebtTarget.totalAmount - paymentDebtTarget.paidAmount)
                                                        )}
                                                    </span>
                                                </div>
                                                <div>
                                                    <div className="flex justify-between items-center mb-1">
                                                        <label className="text-[11px] font-semibold text-gray-700 uppercase tracking-wide">
                                                            Montant Versé (FCFA)
                                                        </label>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const maxPay = paymentDebtTarget.id === 'ALL'
                                                                    ? active360Client.totalDebt
                                                                    : Math.max(0, paymentDebtTarget.totalAmount - paymentDebtTarget.paidAmount);
                                                                if (debtPaymentMethod === 'avoir') {
                                                                    setPaymentAmount(Math.min(active360Client.totalAvoir, maxPay).toString());
                                                                } else {
                                                                    setPaymentAmount(maxPay.toString());
                                                                }
                                                            }}
                                                            className="text-[10px] font-semibold text-blue-600 hover:underline cursor-pointer"
                                                        >
                                                            Tout solder
                                                        </button>
                                                    </div>
                                                    <input
                                                        type="number"
                                                        autoFocus
                                                        value={paymentAmount}
                                                        onChange={(e) => setPaymentAmount(e.target.value)}
                                                        placeholder="Ex: 50000"
                                                        className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-[4px] focus:outline-none focus:ring-1 focus:ring-[#001d35] font-semibold text-gray-800 bg-white"
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-[11px] font-semibold text-gray-700 uppercase tracking-wide mb-1">
                                                    Note ou Référence du Versement (Optionnel)
                                                </label>
                                                <input
                                                    type="text"
                                                    value={debtPaymentNote}
                                                    onChange={(e) => setDebtPaymentNote(e.target.value)}
                                                    placeholder="Ex: Reçu N° 4589 / Virement ref 8274 / Remis par le client"
                                                    className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-[4px] focus:outline-none focus:ring-1 focus:ring-[#001d35] text-slate-800 bg-white"
                                                />
                                            </div>

                                            <div className="flex justify-end gap-2 pt-2 border-t-2 border-gray-200">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setPaymentDebtTarget(null);
                                                        setPaymentAmount('');
                                                        setDebtPaymentNote('');
                                                    }}
                                                    className="px-3.5 py-1.5 border border-gray-300 text-gray-700 font-semibold uppercase tracking-wider text-xs hover:bg-gray-100 rounded-[4px] cursor-pointer transition-colors"
                                                >
                                                    Annuler
                                                </button>
                                                <button
                                                    type="submit"
                                                    className="flex items-center gap-1.5 px-4 py-1.5 bg-[#001d35] hover:bg-[#00284a] text-white font-semibold uppercase tracking-wider text-xs rounded-[4px] cursor-pointer transition-colors shadow-sm active:scale-95"
                                                >
                                                    <Check className="w-3.5 h-3.5 text-[#f77500]" />
                                                    <span>Valider l'Encaissement ({formatPrice(parseFloat(paymentAmount) || 0)})</span>
                                                </button>
                                            </div>
                                        </form>
                                    )}

                                    {/* Debts Table */}
                                    <div className="border border-gray-200 rounded-[4px] overflow-hidden">
                                        <table className="w-full text-left text-xs border-collapse">
                                            <thead className="bg-[#001d35] text-white font-semibold uppercase tracking-wider text-[10px] divide-x divide-white/20">
                                                <tr>
                                                    <th className="px-3 py-2">Date</th>
                                                    <th className="px-3 py-2">Réf Facture</th>
                                                    <th className="px-3 py-2">Chantier Concerné</th>
                                                    <th className="px-3 py-2 text-right">Total Facture</th>
                                                    <th className="px-3 py-2 text-right">Déjà Versé</th>
                                                    <th className="px-3 py-2 text-right">Reste Dû</th>
                                                    <th className="px-3 py-2 text-center">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {(!active360Client.allDebts || active360Client.allDebts.length === 0) ? (
                                                    <tr>
                                                        <td colSpan="7" className="px-4 py-8 text-center text-gray-500 font-semibold">
                                                            Aucune dette en cours ni impayé enregistré pour ce client.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    active360Client.allDebts.map(debt => {
                                                        const remaining = Math.max(0, (debt.totalAmount || 0) - (debt.paidAmount || 0));
                                                        return (
                                                            <tr key={debt.id} className="hover:bg-blue-50/40">
                                                                <td className="px-3 py-2 font-medium text-gray-600">
                                                                    {new Date(debt.date).toLocaleDateString('fr-FR')}
                                                                </td>
                                                                <td className="px-3 py-2 font-semibold text-[#001d35]">
                                                                    #{debt.id}
                                                                </td>
                                                                <td className="px-3 py-2 font-semibold text-gray-800">
                                                                    🏗️ {debt.siteName || 'Comptoir'}
                                                                </td>
                                                                <td className="px-3 py-2 text-right font-semibold text-gray-900">
                                                                    {formatPrice(debt.totalAmount)}
                                                                </td>
                                                                <td className="px-3 py-2 text-right text-emerald-700 font-semibold">
                                                                    {formatPrice(debt.paidAmount)}
                                                                </td>
                                                                <td className="px-3 py-2 text-right font-semibold text-rose-600">
                                                                    {formatPrice(remaining)}
                                                                </td>
                                                                <td className="px-3 py-2 text-center">
                                                                    {remaining > 0 ? (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setPaymentDebtTarget(debt);
                                                                                setPaymentAmount(remaining.toString());
                                                                            }}
                                                                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-[4px] font-semibold text-[10px] uppercase tracking-wider shadow-2xs transition-all active:scale-95 cursor-pointer"
                                                                        >
                                                                            Encaisser
                                                                        </button>
                                                                    ) : (
                                                                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-[4px] border border-emerald-200">
                                                                            Solder
                                                                        </span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* ======================================================== */}
                            {/* TAB 3: HISTORIQUE GLOBAL DES ACHATS                      */}
                            {/* ======================================================== */}
                            {activeTab360 === 'achats' && (
                                <div className="space-y-3">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <div>
                                            <h4 className="text-xs font-semibold text-[#001d35] uppercase tracking-wider mb-0.5">Historique des Achats & Bons</h4>
                                            <p className="text-xs text-gray-500 font-medium">Toutes les transactions caisse & bons à enlever rattachés à ce client</p>
                                        </div>

                                        {/* Filter by site */}
                                        {active360Client.sites && active360Client.sites.length > 0 && (
                                            <select
                                                value={siteFilterForPurchases}
                                                onChange={(e) => setSiteFilterForPurchases(e.target.value)}
                                                className="px-3 py-1.5 text-xs font-semibold border border-gray-300 rounded-[4px] focus:outline-none focus:ring-1 focus:ring-[#001d35] bg-white text-[#001d35]"
                                            >
                                                <option value="all">Tous les chantiers</option>
                                                {active360Client.sites.map(s => (
                                                    <option key={s.id} value={s.name}>🏗️ {s.name}</option>
                                                ))}
                                            </select>
                                        )}
                                    </div>

                                    {/* Transactions List */}
                                    {(() => {
                                        const clientTx = transactions.filter(t => {
                                            const matchClient = (t.clientId && t.clientId === active360Client.id) || 
                                                (t.customerName && t.customerName.toLowerCase().trim() === active360Client.name.toLowerCase().trim());
                                            if (!matchClient) return false;
                                            if (siteFilterForPurchases !== 'all') {
                                                return t.siteName?.toLowerCase().trim() === siteFilterForPurchases.toLowerCase().trim();
                                            }
                                            return true;
                                        });

                                        if (clientTx.length === 0) {
                                            return (
                                                <div className="p-8 text-center bg-gray-50 border-2 border-dashed border-gray-300 rounded-[4px]">
                                                    <FileText className="w-10 h-10 text-gray-400 mx-auto mb-2 opacity-60" />
                                                    <p className="font-semibold text-gray-700 text-xs uppercase tracking-wider">Aucun historique d'achat trouvé</p>
                                                    <p className="text-[11px] text-gray-500 font-medium mt-0.5">Les nouvelles ventes au comptoir ou avec Bon à Enlever apparaîtront ici.</p>
                                                </div>
                                            );
                                        }

                                        return (
                                            <div className="space-y-2">
                                                {clientTx.map(tx => (
                                                    <div key={tx.id} className="bg-white border border-gray-200 rounded-[4px] p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-gray-300 shadow-2xs">
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-semibold text-xs text-[#001d35]">Vente #{tx.id}</span>
                                                                <span className="text-gray-400 text-xs">•</span>
                                                                <span className="text-xs text-gray-600 font-medium">
                                                                    {new Date(tx.date).toLocaleDateString('fr-FR')} {new Date(tx.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                                {tx.siteName && (
                                                                    <span className="bg-blue-50 text-blue-900 border border-blue-200 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-[4px]">
                                                                        🏗️ {tx.siteName}
                                                                    </span>
                                                                )}
                                                                {tx.deliveryMode === 'warehouse' && (
                                                                    <span className="bg-amber-100 text-amber-900 font-semibold uppercase tracking-wider text-[10px] px-2 py-0.5 rounded-[4px]">
                                                                        🚚 Dépôt {tx.deliveryNoteReference ? `(${tx.deliveryNoteReference})` : ''}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="text-xs text-gray-500 font-medium mt-1">
                                                                {(tx.items || []).map(i => `${i.name || 'Article'} (x${i.inputQuantity || i.quantity || 1})`).join(', ')}
                                                            </div>
                                                        </div>

                                                        <div className="text-right shrink-0">
                                                            <div className="font-bold text-sm text-[#001d35]">{formatPrice(tx.total)}</div>
                                                            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                                                                {tx.paymentMethod === 'credit' ? 'À Crédit' : (tx.paymentMethod === 'card' ? 'T-Money/Moov' : 'Espèces')}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}

                            {/* ======================================================== */}
                            {/* TAB 4: AVOIRS, RELIQUATS & AVANCES CRÉDITÉES              */}
                            {/* ======================================================== */}
                            {activeTab360 === 'avoirs' && (
                                <div className="space-y-3.5">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <h4 className="text-xs font-semibold text-[#001d35] uppercase tracking-wider mb-0.5">
                                                Avoirs, Avances & Reliquats Déductibles
                                            </h4>
                                            <p className="text-xs text-gray-500 font-medium">
                                                Crédits disponibles, reliquats de monnaie retenus et bons utilisables lors des prochains encaissements
                                            </p>
                                        </div>
                                    </div>

                                    {/* Mini KPI Cards for Client Credits */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                        <div className="bg-blue-50/70 border border-blue-200 rounded-[4px] p-2.5">
                                            <span className="text-[10px] font-semibold text-blue-900 uppercase tracking-wider block">
                                                👤 Avances Créditées (Compte)
                                            </span>
                                            <span className="text-base font-bold text-blue-900 mt-1 block">
                                                {formatPrice(active360Client.totalAvance || 0)}
                                            </span>
                                            <span className="text-[10px] text-blue-700 font-medium">
                                                {(active360Client.clientAdvances || []).length} avance(s) enregistrée(s)
                                            </span>
                                        </div>

                                        <div className="bg-amber-50/70 border border-amber-200 rounded-[4px] p-2.5">
                                            <span className="text-[10px] font-semibold text-amber-900 uppercase tracking-wider block">
                                                🎟️ Reliquats Monnaie (Bons)
                                            </span>
                                            <span className="text-base font-bold text-amber-900 mt-1 block">
                                                {formatPrice(active360Client.totalReliquatVoucher || 0)}
                                            </span>
                                            <span className="text-[10px] text-amber-700 font-medium">
                                                {(active360Client.voucherReliquats || []).length} bon(s) imprimé(s)
                                            </span>
                                        </div>

                                        <div className="bg-[#001d35] text-white rounded-[4px] p-2.5">
                                            <span className="text-[10px] font-semibold text-gray-300 uppercase tracking-wider block">
                                                💰 Total Déductible Disponible
                                            </span>
                                            <span className="text-base font-bold text-[#f77500] mt-1 block">
                                                {formatPrice(active360Client.totalAvoir || 0)}
                                            </span>
                                            <span className="text-[10px] text-gray-400 font-medium">
                                                À déduire automatiquement en caisse
                                            </span>
                                        </div>
                                    </div>

                                    {/* List of Avoirs / Reliquats */}
                                    {(!active360Client.activeAvoirs || active360Client.activeAvoirs.length === 0) ? (
                                        <div className="p-8 text-center bg-gray-50 border-2 border-dashed border-gray-300 rounded-[4px]">
                                            <Ticket className="w-10 h-10 text-gray-400 mx-auto mb-2 opacity-60" />
                                            <p className="font-semibold text-gray-700 text-xs uppercase tracking-wider">
                                                Aucun avoir ou avance active pour ce client
                                            </p>
                                            <p className="text-[11px] text-gray-500 mt-0.5 max-w-md mx-auto font-medium">
                                                Lorsqu'une vente génère un manque de monnaie et que vous choisissez « Compte Client » ou « Bon de Reliquat », l'avance apparaîtra instantanément ici.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {active360Client.activeAvoirs.map(cn => {
                                                const isAdvance = cn.reliquatMode === 'client_credit';
                                                const isVoucherReliquat = cn.type === 'change_reliquat' && !isAdvance;
                                                const isStandardAvoir = cn.type !== 'change_reliquat';

                                                return (
                                                    <div 
                                                        key={cn.id} 
                                                        className={`border rounded-[4px] p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs transition-all ${
                                                            isAdvance
                                                                ? 'bg-blue-50/40 border-blue-300 hover:border-blue-400'
                                                                : isVoucherReliquat
                                                                ? 'bg-amber-50/40 border-amber-300 hover:border-amber-400'
                                                                : 'bg-emerald-50/40 border-emerald-300 hover:border-emerald-400'
                                                        }`}
                                                    >
                                                        <div className="space-y-1">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-[4px] border ${
                                                                    isAdvance
                                                                        ? 'bg-blue-600 text-white border-blue-700'
                                                                        : isVoucherReliquat
                                                                        ? 'bg-amber-600 text-white border-amber-700'
                                                                        : 'bg-emerald-700 text-white border-emerald-800'
                                                                }`}>
                                                                    {isAdvance ? '👤 AVANCE COMPTE CLIENT' : (isVoucherReliquat ? '🎟️ BON RELIQUAT MONNAIE' : '📦 AVOIR RETOUR MARCHANDISE')}
                                                                </span>

                                                                <span className="font-mono font-semibold text-xs text-[#001d35] bg-white px-2 py-0.5 rounded-[4px] border border-gray-300">
                                                                    CODE : {cn.code}
                                                                </span>

                                                                <span className="text-[11px] text-gray-500 font-medium">
                                                                    Émis le {new Date(cn.createdAt).toLocaleDateString('fr-FR')} à {new Date(cn.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                            </div>

                                                            {cn.notes && (
                                                                <p className="text-xs text-gray-700 font-normal italic pt-0.5">
                                                                    "{cn.notes}"
                                                                </p>
                                                            )}

                                                            <div className="flex flex-wrap items-center gap-3 text-[10px] text-gray-500 font-medium pt-0.5">
                                                                {cn.cashierName && (
                                                                    <span>Opérateur : <strong className="text-gray-700 font-semibold">{cn.cashierName}</strong></span>
                                                                )}
                                                                <span>Expire le : <strong className="text-gray-700 font-semibold">{new Date(cn.expiresAt).toLocaleDateString('fr-FR')}</strong></span>
                                                                {cn.initialAmount !== cn.remainingAmount && (
                                                                    <span>Montant initial : <strong className="font-semibold">{formatPrice(cn.initialAmount)}</strong></span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div className="text-right shrink-0">
                                                            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                                                                Solde Restant
                                                            </div>
                                                            <div className={`text-base font-bold ${
                                                                isAdvance ? 'text-blue-900' : (isVoucherReliquat ? 'text-amber-900' : 'text-emerald-800')
                                                            }`}>
                                                                {formatPrice(cn.remainingAmount)}
                                                            </div>
                                                            <div className="mt-1">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        navigator.clipboard.writeText(cn.code);
                                                                        T.success(`Code ${cn.code} copié !`);
                                                                    }}
                                                                    className="text-[10px] font-semibold text-blue-700 hover:text-blue-900 underline cursor-pointer"
                                                                >
                                                                    Copier le code
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ======================================================== */}
            {/* CREATE / EDIT CLIENT MODAL                               */}
            {/* ======================================================== */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
                    <div className="bg-white w-full max-w-xl rounded-[4px] shadow-2xl border-2 border-[#001d35] overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col">
                        <div className="bg-[#001d35] text-white px-4 py-3 flex justify-between items-center border-b-2 border-[#f77500] shrink-0">
                            <div>
                                <h3 className="text-xs font-semibold uppercase tracking-wider text-white">
                                    {editingClient ? 'Modifier la Fiche Client' : 'Nouveau Compte Client'}
                                </h3>
                                <p className="text-gray-300 text-[10px] mt-0.5 font-normal">
                                    Coordonnées, statut professionnel, barème et encours de crédit
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleCloseModal}
                                className="text-gray-300 hover:text-white p-1 rounded-[4px] transition-colors cursor-pointer"
                                title="Fermer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        
                        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                            <div className="p-4 space-y-3.5 max-h-[75vh] overflow-y-auto flex-1">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="col-span-2">
                                        <label className="block text-[11px] font-semibold text-[#001d35] uppercase mb-1">
                                            Nom Complet du Client / Raison Sociale <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="name"
                                            required
                                            value={formData.name}
                                            onChange={handleChange}
                                            className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-[4px] focus:outline-none focus:ring-1 focus:ring-[#001d35] text-xs font-semibold text-gray-800"
                                            placeholder="Ex: Entreprise BTP Plus SARL / M. Koffi"
                                        />
                                    </div>
                                    
                                    <div className="col-span-2 sm:col-span-1">
                                        <label className="block text-[11px] font-semibold text-[#001d35] uppercase mb-1">
                                            Téléphone (WhatsApp)
                                        </label>
                                        <input
                                            type="text"
                                            name="phone"
                                            value={formData.phone}
                                            onChange={handleChange}
                                            className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-[4px] focus:outline-none focus:ring-1 focus:ring-[#001d35] text-xs text-gray-800"
                                            placeholder="Ex: +228 90 12 34 56"
                                        />
                                    </div>

                                    <div className="col-span-2 sm:col-span-1">
                                        <label className="block text-[11px] font-semibold text-[#001d35] uppercase mb-1">
                                            Email
                                        </label>
                                        <input
                                            type="email"
                                            name="email"
                                            value={formData.email}
                                            onChange={handleChange}
                                            className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-[4px] focus:outline-none focus:ring-1 focus:ring-[#001d35] text-xs text-gray-800"
                                            placeholder="client@domaine.tg"
                                        />
                                    </div>

                                    <div className="col-span-2">
                                        <label className="block text-[11px] font-semibold text-[#001d35] uppercase mb-1">
                                            Type de Client
                                        </label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {[
                                                { id: 'particulier', label: 'Particulier', icon: '👤' },
                                                { id: 'artisan', label: 'Artisan / Maçon', icon: '🔨' },
                                                { id: 'entreprise', label: 'Entreprise BTP', icon: '🏢' }
                                            ].map(t => (
                                                <button
                                                    key={t.id}
                                                    type="button"
                                                    onClick={() => setFormData(prev => ({ ...prev, type: t.id }))}
                                                    className={`flex items-center justify-center gap-1.5 p-2 border rounded-[4px] text-xs font-semibold transition-all cursor-pointer ${
                                                        formData.type === t.id
                                                            ? 'border-[#001d35] bg-blue-50 text-[#001d35] shadow-2xs'
                                                            : 'border-gray-200 hover:border-gray-300 text-gray-600 bg-white'
                                                    }`}
                                                >
                                                    <span>{t.icon}</span>
                                                    <span className="uppercase text-[11px]">{t.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {formData.type === 'entreprise' && (
                                        <div className="col-span-2">
                                            <label className="block text-[11px] font-semibold text-[#001d35] uppercase mb-1">
                                                NIF / RCCM
                                            </label>
                                            <input
                                                type="text"
                                                name="nif"
                                                value={formData.nif}
                                                onChange={handleChange}
                                                className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-[4px] focus:outline-none focus:ring-1 focus:ring-[#001d35] text-xs text-gray-800"
                                                placeholder="Numéro Fiscal de l'Entreprise"
                                            />
                                        </div>
                                    )}

                                    {/* Plafond de Crédit Autorisé */}
                                    <div className="col-span-2 sm:col-span-1 bg-amber-50/60 p-3 rounded-[4px] border border-amber-200">
                                        <label className="block text-[11px] font-semibold text-amber-900 uppercase tracking-wide mb-1">
                                            Plafond de Crédit (FCFA)
                                        </label>
                                        <input
                                            type="number"
                                            name="creditLimit"
                                            value={formData.creditLimit}
                                            onChange={handleChange}
                                            className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-[4px] focus:outline-none focus:ring-1 focus:ring-amber-600 font-semibold text-xs text-amber-950"
                                            placeholder="Ex: 500000"
                                        />
                                        <p className="text-[10px] text-amber-700 mt-1 font-medium">
                                            Limite d'encours. Bloquant en caisse si dépassée. (0 = pas de crédit).
                                        </p>
                                    </div>

                                    {/* Barème Tarifaire par Défaut */}
                                    <div className="col-span-2 sm:col-span-1 bg-blue-50/60 p-3 rounded-[4px] border border-blue-200">
                                        <label className="block text-[11px] font-semibold text-blue-900 uppercase tracking-wide mb-1">
                                            Grille Tarifaire
                                        </label>
                                        <select
                                            name="pricingTier"
                                            value={formData.pricingTier}
                                            onChange={handleChange}
                                            className="w-full px-3 py-1.5 bg-white border border-blue-300 rounded-[4px] focus:outline-none focus:ring-1 focus:ring-blue-600 font-semibold text-xs text-blue-950"
                                        >
                                            <option value="normal">Tarif Normal / Comptoir</option>
                                            <option value="artisan">⭐ Tarif Artisan (-5%)</option>
                                            <option value="wholesale">👑 Tarif Grossiste (-10%)</option>
                                        </select>
                                        <p className="text-[10px] text-blue-700 mt-1 font-medium">
                                            Appliqué automatiquement lors des ventes au guichet POS.
                                        </p>
                                    </div>

                                    <div className="col-span-2">
                                        <label className="block text-[11px] font-semibold text-[#001d35] uppercase mb-1">
                                            Adresse Complète / Ville / Quartier
                                        </label>
                                        <textarea
                                            name="address"
                                            value={formData.address}
                                            onChange={handleChange}
                                            rows="2"
                                            className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-[4px] focus:outline-none focus:ring-1 focus:ring-[#001d35] text-xs text-gray-800 resize-none"
                                            placeholder="Ex: Lomé, Baguida face plage..."
                                        ></textarea>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="p-3 bg-gray-50 border-t border-gray-200 flex justify-end gap-2 shrink-0">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="px-3.5 py-1.5 border border-gray-300 text-gray-700 font-semibold uppercase tracking-wider text-xs hover:bg-gray-100 rounded-[4px] cursor-pointer transition-colors"
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    className="flex items-center gap-1.5 px-4 py-1.5 bg-[#001d35] hover:bg-[#00284a] text-white font-semibold uppercase tracking-wider text-xs rounded-[4px] cursor-pointer transition-colors shadow-sm"
                                >
                                    <Check className="w-3.5 h-3.5 text-[#f77500]" />
                                    <span>{editingClient ? 'Mettre à jour' : 'Créer le Compte Client'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── OVERLAY LOADER D'ACTION MÉTIER (1,5s au minimum pour chaque action) ── */}
            {actionLoading && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[200] p-4 animate-in fade-in duration-150">
                    <div className="bg-white rounded-[4px] p-6 shadow-2xl border-2 border-[#001d35] flex flex-col items-center max-w-sm text-center">
                        <div className="relative h-12 w-12 mb-3">
                            <div className="absolute inset-0 animate-spin rounded-full border-4 border-gray-200 border-t-[#001d35]"></div>
                            <div className="absolute inset-2 animate-spin-reverse rounded-full border-2 border-transparent border-b-[#f77500]"></div>
                        </div>
                        <h4 className="text-sm font-semibold text-[#001d35] uppercase tracking-wider">
                            Traitement en cours...
                        </h4>
                        <p className="text-xs text-gray-600 mt-1 font-medium">
                            {actionLoading}
                        </p>
                    </div>
                </div>
            )}

            {/* ── OVERLAY LOADER D'ENTRÉE DE PAGE (1,5s au montage + scroll top) ── */}
            {isPageLoading && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[300] p-4 animate-in fade-in duration-150">
                    <div className="bg-white rounded-[4px] p-6 shadow-2xl border-2 border-[#001d35] flex flex-col items-center max-w-sm text-center">
                        <div className="relative h-12 w-12 mb-3">
                            <div className="absolute inset-0 animate-spin rounded-full border-4 border-gray-200 border-t-[#001d35]"></div>
                            <div className="absolute inset-2 animate-spin-reverse rounded-full border-2 border-transparent border-b-[#f77500]"></div>
                        </div>
                        <h4 className="text-sm font-semibold text-[#001d35] uppercase tracking-wider">
                            Chargement en cours...
                        </h4>
                        <p className="text-xs text-gray-600 mt-1 font-medium">
                            Fichier Clients, Chantiers & Crédit 360°
                        </p>
                    </div>
                </div>
            )}

            {/* ── QUITTANCE / REÇU D'ENCAISSEMENT OFFICIEL KABLLIX ERP ── */}
            {lastDebtPaymentReceipt && (
                <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
                    <div className="bg-white w-full max-w-md rounded-[4px] shadow-2xl border-2 border-[#001d35] overflow-hidden transform animate-in zoom-in-95 duration-150">
                        <div className="p-3.5 sm:p-4 border-b-2 border-gray-300 flex justify-between items-center bg-white">
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                <div>
                                    <h3 className="text-sm font-bold text-[#001d35] uppercase tracking-wide">
                                        Quittance de Règlement de Dette
                                    </h3>
                                    <p className="text-[10px] text-gray-500 font-normal">Paiement validé avec succès</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setLastDebtPaymentReceipt(null)}
                                className="text-gray-400 hover:text-gray-600 p-1 rounded-[4px] hover:bg-gray-100 transition-colors cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-4 space-y-3 text-xs font-sans">
                            <div className="bg-emerald-50/70 border border-emerald-200 rounded-[4px] p-3 text-center">
                                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                                    Montant Total Encaissé
                                </span>
                                <span className="text-2xl font-black text-emerald-700 mt-0.5 block">
                                    {formatPrice(lastDebtPaymentReceipt.amountPaid)}
                                </span>
                                <span className="text-[10px] font-semibold text-emerald-800 uppercase tracking-wider mt-1 inline-block bg-emerald-100 px-2 py-0.5 rounded-[4px]">
                                    Mode : {
                                        lastDebtPaymentReceipt.paymentMethod === 'avoir' ? '🎫 Avoir / Avance Imputée' :
                                        lastDebtPaymentReceipt.paymentMethod === 'wave_om' ? '📱 Mobile Money' :
                                        lastDebtPaymentReceipt.paymentMethod === 'check' ? '📝 Chèque' :
                                        lastDebtPaymentReceipt.paymentMethod === 'bank' ? '🏦 Virement' : '💵 Espèces'
                                    }
                                </span>
                            </div>

                            <div className="space-y-2 border-t border-b border-gray-200 py-3 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-gray-500 font-medium">Client Débiteur :</span>
                                    <strong className="text-[#001d35]">{lastDebtPaymentReceipt.clientName}</strong>
                                </div>
                                {lastDebtPaymentReceipt.clientPhone && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-500 font-medium">Téléphone :</span>
                                        <span className="text-gray-700 font-semibold">{lastDebtPaymentReceipt.clientPhone}</span>
                                    </div>
                                )}
                                <div className="flex justify-between">
                                    <span className="text-gray-500 font-medium">Portée du règlement :</span>
                                    <span className="font-semibold text-gray-800">
                                        {lastDebtPaymentReceipt.isGlobal ? 'Règlement Global (Toutes créances)' : `Facture #${lastDebtPaymentReceipt.debtTarget?.id}`}
                                    </span>
                                </div>
                                {lastDebtPaymentReceipt.note && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-500 font-medium">Référence / Note :</span>
                                        <span className="text-gray-700 font-semibold italic">{lastDebtPaymentReceipt.note}</span>
                                    </div>
                                )}
                                <div className="flex justify-between pt-1 border-t border-gray-100">
                                    <span className="text-gray-500 font-medium">Date & Heure :</span>
                                    <span className="text-gray-700 font-medium">{new Date(lastDebtPaymentReceipt.date).toLocaleString('fr-FR')}</span>
                                </div>
                                <div className="flex justify-between pt-1.5 border-t border-gray-200">
                                    <span className="text-gray-700 font-bold uppercase tracking-wider text-[11px]">Nouveau Solde Restant Dû :</span>
                                    <strong className={`text-sm ${lastDebtPaymentReceipt.remainingDebt > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                                        {formatPrice(lastDebtPaymentReceipt.remainingDebt)}
                                    </strong>
                                </div>
                            </div>
                        </div>

                        <div className="p-3.5 bg-slate-50 border-t-2 border-gray-200 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => window.print()}
                                className="px-3.5 py-1.5 border border-gray-300 text-gray-700 font-semibold uppercase tracking-wider text-xs hover:bg-white rounded-[4px] cursor-pointer transition-colors flex items-center gap-1.5"
                            >
                                <Printer className="w-3.5 h-3.5" />
                                <span>Imprimer Quittance</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setLastDebtPaymentReceipt(null)}
                                className="px-4 py-1.5 bg-[#001d35] hover:bg-[#00284a] text-white font-semibold uppercase tracking-wider text-xs rounded-[4px] cursor-pointer transition-colors shadow-sm"
                            >
                                Terminer
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default Clients;
