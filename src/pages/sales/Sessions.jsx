import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useSession } from '../../context/SessionContext';
import { useSales } from '../../context/SalesContext';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';
import { formatPrice } from '../../utils/currency';
import FinancialInput from '../../components/FinancialInput';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
    Lock, Unlock, Calculator, Clock,
    X, AlertTriangle, CheckCircle2, DollarSign,
    Wallet, History, Printer, ArrowDownCircle, ArrowUpCircle,
    ShieldCheck, ShieldAlert, FileText, Search, User, Filter,
    Coins, Check, Eye, HelpCircle, ChevronRight, Ghost
} from 'lucide-react';
import T from '../../utils/toast';

const Sessions = () => {
    const { activeSession, pastSessions, masterSessions, openSession, closeSession, reviewSessionAudit, isOverdue } = useSession();
    const { transactions, expenses, addExpense } = useSales();
    const { currentStoreId, stores } = useSettings();
    const { user } = useAuth();

    const storeKey = currentStoreId ? String(currentStoreId) : 'store_default';
    const currentStoreName = stores.find(s => String(s.id) === storeKey)?.name || 'Boutique Principale';

    // ── Navigation principale : 'pos' (Poste de Caisse) | 'audit' (Journal Anti-Coulage Patron) ──
    const [currentMainTab, setCurrentMainTab] = useState('pos');

    // ── Loader de 1 seconde lors du clic sur les filtres et onglets ──
    const [filterLoading, setFilterLoading] = useState(false);
    const filterTimerRef = useRef(null);

    const handleFilterChange = (setter, value) => {
        setFilterLoading(true);
        setter(value);
        if (filterTimerRef.current) clearTimeout(filterTimerRef.current);
        filterTimerRef.current = setTimeout(() => {
            setFilterLoading(false);
        }, 1000);
    };

    useEffect(() => {
        return () => {
            if (filterTimerRef.current) clearTimeout(filterTimerRef.current);
        };
    }, []);

    // ── Form states Caisse ──
    const [initialAmountInput, setInitialAmountInput] = useState('');
    const [currentTime, setCurrentTime]               = useState(new Date());
    const [showCloseModal, setShowCloseModal]         = useState(false);
    const [isOpeningSession, setIsOpeningSession]     = useState(false);
    const [isClosingSession, setIsClosingSession]     = useState(false);
    const [movementFilter, setMovementFilter]         = useState('all'); // 'all' | 'operations' | 'sales'

    // ── Modal Clôture en Aveugle ──
    const [closingMethod, setClosingMethod]           = useState('quick'); // 'quick' (Saisie Directe uniquement)
    const [blindStep, setBlindStep]                   = useState(1); // 1 = Saisie à l'aveugle, 2 = Bilan & Justification
    const [countedAmountInput, setCountedAmountInput] = useState('');
    const [cashierComment, setCashierComment]         = useState(''); // Espace commentaire libre caissier
    const [justification, setJustification]           = useState('');
    const [mobileCountedInput, setMobileCountedInput] = useState('');
    const [chequesCountedInput, setChequesCountedInput] = useState('');

    // Grille de Billetage FCFA
    const [billsCount, setBillsCount] = useState({
        10000: '',
        5000: '',
        2000: '',
        1000: '',
        500: ''
    });

    const [coinsCount, setCoinsCount] = useState({
        500: '',
        250: '',
        200: '',
        100: '',
        50: '',
        25: ''
    });

    // ── Modal : 'withdrawal' | 'entry' | 'skimming' | null ──
    const [activeModal, setActiveModal] = useState(null);
    const [modalAmount, setModalAmount] = useState('');
    const [modalLabel,  setModalLabel]  = useState('');

    // ── Journal d'Audit Patron States ──
    const [auditFilter, setAuditFilter]               = useState('open'); // 'open' | 'pending' | 'all' | 'arbitrated' | 'conform' | 'discrepancies'
    const [auditSearchTerm, setAuditSearchTerm]       = useState('');
    const [auditCashierFilter, setAuditCashierFilter] = useState('all');
    const [arbitrationModalSession, setArbitrationModalSession] = useState(null);
    const [arbitrationStatus, setArbitrationStatus]   = useState('approved');
    const [arbitrationNote, setArbitrationNote]       = useState('');
    const [pastSessionFilter, setPastSessionFilter]   = useState('all'); // 'all' | 'arbitrated' | 'pending' | 'conform'

    // ── Cash entries (entrées en cours de session, hors ventes) ──
    const ENTRIES_KEY = activeSession ? `cash_entries_${storeKey}_${activeSession.id}` : null;
    const [cashEntries, setCashEntries] = useState(() => {
        if (!activeSession) return [];
        const saved = localStorage.getItem(`cash_entries_${storeKey}_${activeSession.id}`);
        return saved ? JSON.parse(saved) : [];
    });

    useEffect(() => {
        if (ENTRIES_KEY) localStorage.setItem(ENTRIES_KEY, JSON.stringify(cashEntries));
    }, [cashEntries, ENTRIES_KEY]);

    useEffect(() => {
        if (activeSession && activeSession.storeId && String(activeSession.storeId) === storeKey) {
            const saved = localStorage.getItem(`cash_entries_${storeKey}_${activeSession.id}`);
            setCashEntries(saved ? JSON.parse(saved) : []);
        } else {
            setCashEntries([]);
        }
    }, [activeSession?.id, activeSession?.storeId, storeKey]);

    // ── Horloge ──
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // ── Calcul des totaux Billetage FCFA ──
    const totalBills = useMemo(() => {
        return (
            (parseInt(billsCount[10000]) || 0) * 10000 +
            (parseInt(billsCount[5000])  || 0) * 5000  +
            (parseInt(billsCount[2000])  || 0) * 2000  +
            (parseInt(billsCount[1000])  || 0) * 1000  +
            (parseInt(billsCount[500])   || 0) * 500
        );
    }, [billsCount]);

    const totalCoins = useMemo(() => {
        return (
            (parseInt(coinsCount[500]) || 0) * 500 +
            (parseInt(coinsCount[250]) || 0) * 250 +
            (parseInt(coinsCount[200]) || 0) * 200 +
            (parseInt(coinsCount[100]) || 0) * 100 +
            (parseInt(coinsCount[50])  || 0) * 50  +
            (parseInt(coinsCount[25])  || 0) * 25
        );
    }, [coinsCount]);

    const effectiveCountedCash = useMemo(() => {
        return parseFloat(countedAmountInput) || 0;
    }, [countedAmountInput]);

    // ── Stats de la session active (en temps réel) ──
    const sessionStats = useMemo(() => {
        if (!activeSession) return {
            totalSalesCash: 0, totalSalesCard: 0, totalSalesCheque: 0,
            totalExpensesCash: 0, totalEntries: 0, expectedAmount: 0
        };

        // Sécurité Multi-Tenant : s'assurer que la session active appartient bien et exclusivement à la boutique courante
        if (!activeSession.storeId || String(activeSession.storeId) !== storeKey) {
            return {
                totalSalesCash: 0, totalSalesCard: 0, totalSalesCheque: 0,
                totalExpensesCash: 0, totalEntries: 0, expectedAmount: 0
            };
        }

        const startTime = new Date(activeSession.startTime).getTime();

        const sessionTx = transactions.filter(t => {
            const matchStore = t.storeId && String(t.storeId) === storeKey;
            const tTime = new Date(t.date || t.transactionDate).getTime();
            return matchStore && tTime >= startTime;
        });

        const totalSalesCash = sessionTx
            .filter(t => t.paymentMethod === 'cash')
            .reduce((s, t) =>
                s + (parseFloat(t.amountGiven) || 0) - (parseFloat(t.change) || parseFloat(t.changeAmount) || 0), 0);

        const totalSalesCard = sessionTx
            .filter(t => ['card', 'mobile', 'wave', 'om', 'momo'].includes(t.paymentMethod))
            .reduce((s, t) => s + (parseFloat(t.total) || parseFloat(t.totalAmount) || 0), 0);

        const totalSalesCheque = sessionTx
            .filter(t => ['cheque', 'check', 'virement'].includes(t.paymentMethod))
            .reduce((s, t) => s + (parseFloat(t.total) || parseFloat(t.totalAmount) || 0), 0);

        const sessionExpenses = expenses.filter(e => {
            const matchStore = e.storeId && String(e.storeId) === storeKey;
            return matchStore && new Date(e.date).getTime() >= startTime;
        });
        const totalExpensesCash = sessionExpenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0);

        const totalEntries = cashEntries.reduce((s, e) => s + parseFloat(e.amount || 0), 0);

        const expectedAmount = activeSession.initialAmount + totalSalesCash + totalEntries - totalExpensesCash;

        return { totalSalesCash, totalSalesCard, totalSalesCheque, totalExpensesCash, totalEntries, expectedAmount };
    }, [activeSession, transactions, expenses, cashEntries, storeKey]);

    // ── Mouvements (flux) de la session ──
    const sessionMovements = useMemo(() => {
        if (!activeSession) return [];
        if (!activeSession.storeId || String(activeSession.storeId) !== storeKey) return [];

        const startTime = new Date(activeSession.startTime).getTime();

        const movements = [{
            time: new Date(activeSession.startTime),
            type: 'Entrée',
            category: 'initial',
            motif: 'Fond de caisse initial',
            amount: activeSession.initialAmount
        }];

        transactions
            .filter(t => {
                const matchStore = t.storeId && String(t.storeId) === storeKey;
                const tTime = new Date(t.date || t.transactionDate).getTime();
                return matchStore && tTime >= startTime && t.paymentMethod === 'cash';
            })
            .forEach(t => {
                const netCash = (parseFloat(t.amountGiven) || 0) - (parseFloat(t.change) || parseFloat(t.changeAmount) || 0) || parseFloat(t.total) || parseFloat(t.totalAmount) || 0;
                if (netCash > 0) {
                    const ticketId = t.id ? (String(t.id).startsWith('#') ? t.id : `#${t.id}`) : '';
                    const client = t.customerName || t.customer?.name || t.client;
                    const desc = ticketId ? `Vente ${ticketId}${client ? ` · ${client}` : ''}` : 'Vente comptoir';
                    movements.push({
                        time: new Date(t.date || t.transactionDate),
                        type: 'Vente',
                        category: 'sale',
                        motif: desc,
                        amount: netCash
                    });
                }
            });

        expenses
            .filter(e => {
                const matchStore = e.storeId && String(e.storeId) === storeKey;
                return matchStore && new Date(e.date).getTime() >= startTime;
            })
            .forEach(e => movements.push({
                time: new Date(e.date),
                type: 'Sortie',
                category: 'expense',
                motif: e.label || e.description || e.category || 'Sortie de caisse',
                amount: parseFloat(e.amount)
            }));

        cashEntries.forEach(e => movements.push({
            time: new Date(e.date),
            type: 'Entrée',
            category: 'entry',
            motif: e.label,
            amount: parseFloat(e.amount)
        }));

        return movements.sort((a, b) => a.time - b.time);
    }, [activeSession, transactions, expenses, cashEntries, storeKey]);

    // Filtrage des flux de la caisse
    const filteredMovements = useMemo(() => {
        if (movementFilter === 'operations') {
            return sessionMovements.filter(m => m.category !== 'sale');
        }
        if (movementFilter === 'sales') {
            return sessionMovements.filter(m => m.category === 'sale');
        }
        return sessionMovements;
    }, [sessionMovements, movementFilter]);

    // ── Écart calculé en arrière-plan lors de l'étape 2 de la clôture ──
    const calculatedEcart = useMemo(() => {
        return effectiveCountedCash - sessionStats.expectedAmount;
    }, [effectiveCountedCash, sessionStats.expectedAmount]);

    const hasEcart = Math.abs(calculatedEcart) > 0;

    // ── Isolation Multi-Tenant : Grand Livre d'Audit strictement cloisonné par boutique ──
    const storeMasterSessions = useMemo(() => {
        return masterSessions.filter(s => s.storeId && String(s.storeId) === storeKey);
    }, [masterSessions, storeKey]);

    // ── Grand Livre d'Audit complet unifiant la session active (en cours) et les sessions clôturées ──
    const storeAllAuditSessions = useMemo(() => {
        const list = [];
        // Si une session est active pour cette boutique, on l'inclut en tête de liste avec son état "open"
        if (activeSession && activeSession.storeId && String(activeSession.storeId) === storeKey) {
            list.push({
                ...activeSession,
                status: 'open',
                expectedAmount: sessionStats.expectedAmount,
                actualAmount: null,
                difference: null,
                auditStatus: 'in_progress',
                justification: 'Session de caisse active au comptoir (en cours)'
            });
        }
        // Ajouter les sessions clôturées de la boutique
        storeMasterSessions.forEach(s => {
            if (!activeSession || s.id !== activeSession.id) {
                list.push({
                    ...s,
                    status: s.status || 'closed'
                });
            }
        });
        return list;
    }, [activeSession, sessionStats.expectedAmount, storeMasterSessions, storeKey]);

    // ── Statistiques du Journal d'Audit Anti-Coulage prenant en compte l'État des sessions ──
    const auditKPIs = useMemo(() => {
        const totalSessions = storeAllAuditSessions.length;
        const openCount = (activeSession && activeSession.storeId && String(activeSession.storeId) === storeKey) ? 1 : 0;
        const closedSessions = storeMasterSessions.filter(s => s.status !== 'open');

        const totalLosses = closedSessions
            .filter(s => s.difference < 0)
            .reduce((sum, s) => sum + Math.abs(s.difference), 0);

        const totalSurplus = closedSessions
            .filter(s => s.difference > 0)
            .reduce((sum, s) => sum + s.difference, 0);

        const conformCount = closedSessions.filter(s => Math.abs(s.difference || 0) === 0).length;
        const complianceRate = closedSessions.length > 0 ? Math.round((conformCount / closedSessions.length) * 100) : 100;

        const pendingReviews = closedSessions.filter(s => {
            const isAlreadyArbitrated = Boolean(s.auditedAt || (s.auditStatus && s.auditStatus !== 'pending_review' && s.auditStatus !== 'pending' && s.auditStatus !== 'in_progress'));
            return !isAlreadyArbitrated && Math.abs(s.difference || 0) > 0 && (!s.auditStatus || s.auditStatus === 'pending_review' || s.auditStatus === 'pending');
        }).length;

        const arbitratedCount = closedSessions.filter(s =>
            Boolean(s.auditedAt || (s.auditStatus && s.auditStatus !== 'pending_review' && s.auditStatus !== 'pending' && s.auditStatus !== 'in_progress'))
        ).length;

        const discrepanciesCount = closedSessions.filter(s => Math.abs(s.difference || 0) > 0).length;

        return {
            totalSessions,
            closedCount: closedSessions.length,
            openCount,
            totalLosses,
            totalSurplus,
            complianceRate,
            pendingReviews,
            arbitratedCount,
            conformCount,
            discrepanciesCount
        };
    }, [storeAllAuditSessions.length, activeSession, storeKey, storeMasterSessions]);

    // ── Liste filtrée du Journal d'Audit selon l'État et la recherche ──
    const filteredAuditSessions = useMemo(() => {
        return storeAllAuditSessions.filter(s => {
            const matchSearch =
                (s.cashierName && s.cashierName.toLowerCase().includes(auditSearchTerm.toLowerCase())) ||
                (s.justification && s.justification.toLowerCase().includes(auditSearchTerm.toLowerCase())) ||
                (s.id && s.id.toLowerCase().includes(auditSearchTerm.toLowerCase()));

            if (!matchSearch) return false;

            if (auditCashierFilter !== 'all' && s.cashierName !== auditCashierFilter) return false;

            const isOpen = s.status === 'open';
            const isAlreadyArbitrated = !isOpen && Boolean(s.auditedAt || (s.auditStatus && s.auditStatus !== 'pending_review' && s.auditStatus !== 'pending' && s.auditStatus !== 'in_progress'));
            const isPendingArbitration = !isOpen && !isAlreadyArbitrated && Math.abs(s.difference || 0) > 0 && (!s.auditStatus || s.auditStatus === 'pending_review' || s.auditStatus === 'pending');
            const isConform = !isOpen && Math.abs(s.difference || 0) === 0;
            const hasDiscrepancy = !isOpen && Math.abs(s.difference || 0) > 0;

            if (auditFilter === 'open') return isOpen;
            if (auditFilter === 'closed') return !isOpen;
            if (auditFilter === 'pending') return isPendingArbitration;
            if (auditFilter === 'arbitrated') return isAlreadyArbitrated;
            if (auditFilter === 'conform') return isConform;
            if (auditFilter === 'discrepancies') return hasDiscrepancy;

            return true;
        });
    }, [storeAllAuditSessions, auditSearchTerm, auditCashierFilter, auditFilter]);

    // ── Liste filtrée de l'historique caissier selon l'État ──
    const filteredPastSessions = useMemo(() => {
        return pastSessions.filter(s => {
            const isAlreadyArbitrated = Boolean(s.auditedAt || (s.auditStatus && s.auditStatus !== 'pending_review' && s.auditStatus !== 'pending'));
            const isPendingArbitration = !isAlreadyArbitrated && Math.abs(s.difference || 0) > 0 && (!s.auditStatus || s.auditStatus === 'pending_review' || s.auditStatus === 'pending');
            const isConform = Math.abs(s.difference || 0) === 0;

            if (pastSessionFilter === 'arbitrated') return isAlreadyArbitrated;
            if (pastSessionFilter === 'pending') return isPendingArbitration;
            if (pastSessionFilter === 'conform') return isConform;
            return true;
        });
    }, [pastSessions, pastSessionFilter]);

    // Liste unique des caissiers pour le filtre
    const cashierOptions = useMemo(() => {
        const set = new Set();
        storeAllAuditSessions.forEach(s => {
            if (s.cashierName) set.add(s.cashierName);
        });
        return Array.from(set);
    }, [storeAllAuditSessions]);

    // ── Handlers ──
    const handleOpenSession = (e) => {
        e.preventDefault();
        const amount = parseFloat(initialAmountInput);
        if (isNaN(amount) || amount < 0) { T.error('Veuillez entrer un montant valide'); return; }
        setIsOpeningSession(true);
        setTimeout(() => {
            openSession(amount);
            setInitialAmountInput('');
            setIsOpeningSession(false);
            T.success('Session de caisse ouverte avec succès !');
        }, 1200);
    };

    const handleStartClosing = () => {
        setBlindStep(1);
        setClosingMethod('quick');
        setCountedAmountInput('');
        setCashierComment('');
        setJustification('');
        setBillsCount({ 10000: '', 5000: '', 2000: '', 1000: '', 500: '' });
        setCoinsCount({ 500: '', 250: '', 200: '', 100: '', 50: '', 25: '' });
        setMobileCountedInput('');
        setChequesCountedInput('');
        setShowCloseModal(true);
    };

    const handleConfirmBlindCount = () => {
        const rawVal = countedAmountInput ? String(countedAmountInput).replace(/\s+/g, '') : '';
        if (!rawVal && rawVal !== '0') {
            T.error("Veuillez saisir le montant total des espèces physiques présentes dans le tiroir.");
            return;
        }

        const cashVal = parseFloat(rawVal) || 0;
        if (cashVal <= 0) {
            if (!window.confirm("Le montant en espèces compté est de 0 FCFA. Confirmez-vous ce comptage ?")) {
                return;
            }
        }

        const isConfirmed = window.confirm(
            "Cette opération est irrévocable, voulez-vous vraiment continuer ?"
        );
        if (!isConfirmed) {
            return;
        }

        setBlindStep(2);
    };

    const handleCloseSession = (e) => {
        e.preventDefault();

        const combinedJustification = [
            cashierComment.trim() ? `[Note caissier] : ${cashierComment.trim()}` : '',
            justification.trim() ? `[Justification écart] : ${justification.trim()}` : ''
        ].filter(Boolean).join('\n') || cashierComment.trim() || justification.trim();

        if (hasEcart && !justification.trim() && !cashierComment.trim()) {
            T.warning("Une justification obligatoire est requise pour tout écart de caisse constaté.");
            return;
        }

        setIsClosingSession(true);
        setTimeout(() => {
            const closed = closeSession(
                effectiveCountedCash,
                sessionStats.expectedAmount,
                sessionStats.totalSalesCash,
                sessionStats.totalExpensesCash,
                {
                    isBlind: true,
                    breakdown: {
                        method: 'quick',
                        cashAmount: effectiveCountedCash,
                        mobileAmount: parseFloat(mobileCountedInput) || 0,
                        chequeAmount: parseFloat(chequesCountedInput) || 0,
                        cashierComment: cashierComment.trim()
                    },
                    expectedBreakdown: {
                        expectedCash: sessionStats.expectedAmount,
                        expectedMobile: sessionStats.totalSalesCard,
                        expectedCheque: sessionStats.totalSalesCheque
                    },
                    justification: combinedJustification,
                    cashierComment: cashierComment.trim(),
                    movementsSnapshot: sessionMovements
                }
            );

            setShowCloseModal(false);
            setIsClosingSession(false);
            T.success("Session clôturée avec succès et scellée au journal d'audit !");
            
            if (closed) {
                handlePrintZReport(closed);
            }
        }, 2200);
    };

    const handleModalSubmit = (e) => {
        e.preventDefault();
        const amount = parseFloat(modalAmount);
        if (isNaN(amount) || amount <= 0) { T.error('Montant invalide'); return; }

        if (activeModal === 'withdrawal') {
            if (!modalLabel.trim()) { T.warning('Motif obligatoire'); return; }
            addExpense({ amount, label: modalLabel.trim(), category: 'Sortie de caisse', paymentMethod: 'cash' });
            T.success(`Sortie de ${formatPrice(amount)} enregistrée.`);
        } else if (activeModal === 'entry') {
            if (!modalLabel.trim()) { T.warning('Motif obligatoire'); return; }
            setCashEntries(prev => [...prev, {
                id: Date.now(), amount, label: modalLabel.trim(), date: new Date().toISOString()
            }]);
            T.success(`Entrée de ${formatPrice(amount)} enregistrée.`);
        } else if (activeModal === 'skimming') {
            addExpense({ amount, label: 'Écrémage vers Coffre', category: 'Écrémage (Coffre)', paymentMethod: 'cash' });
            T.success(`Écrémage de ${formatPrice(amount)} enregistré.`);
        }

        setModalAmount('');
        setModalLabel('');
        setActiveModal(null);
    };

    // ── Arbitrage Patron ──
    const handleOpenArbitration = (session) => {
        if (session.status === 'open') {
            T.warning("Cette session est en cours d'activité. L'arbitrage patronal n'est possible qu'après la clôture physique de la caisse.");
            return;
        }
        const isAlreadyArbitrated = Boolean(session.auditedAt || (session.auditStatus && session.auditStatus !== 'pending_review' && session.auditStatus !== 'pending'));
        if (isAlreadyArbitrated) {
            T.warning("Cette session a déjà été auditée et arbitrée. Elle est scellée et ne peut plus être modifiée.");
            return;
        }
        setArbitrationModalSession(session);
        setArbitrationStatus(session.auditStatus || 'approved');
        setArbitrationNote(session.auditNote || '');
    };

    const handleSaveArbitration = (e) => {
        e.preventDefault();
        if (!arbitrationModalSession) return;

        reviewSessionAudit(arbitrationModalSession.id, {
            status: arbitrationStatus,
            note: arbitrationNote.trim(),
            reviewerName: user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Direction Quincaillerie'
        });

        T.saved("Décision d'arbitrage enregistrée dans le journal anti-coulage.");
        setArbitrationModalSession(null);
    };

    // ── Impression Ticket Z / PV de Clôture Officiel ──
    const handlePrintZReport = (session) => {
        const printWindow = window.open('', '_blank', 'width=850,height=800');
        if (!printWindow) {
            T.error("Veuillez autoriser les fenêtres pop-up pour imprimer le Ticket Z.");
            return;
        }

        const isDiscrepant = Math.abs(session.difference || 0) > 0;
        const diffText = session.difference > 0 ? `+${formatPrice(session.difference)} (EXCÉDENT)` :
                         session.difference < 0 ? `-${formatPrice(Math.abs(session.difference))} (MANQUANT)` :
                         '0 FCFA (PARFAITEMENT CONFORME)';

        const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Ticket Z - Clôture & Audit #${session.id}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;600;700;800&display=swap" rel="stylesheet">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            margin: 0;
            padding: 24px;
            color: #0f172a;
            background: #f8fafc;
            font-size: 12px;
            line-height: 1.45;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }

        /* ── Toolbar Dashboard ── */
        .dashboard-toolbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #ffffff;
            padding: 8px 14px;
            border: 2px solid #d1d5db; /* border-2 border-gray-300 */
            border-radius: 4px;        /* rounded-[4px] */
            box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
            font-size: 11.5px;
            font-weight: 600;
            margin-bottom: 12px;
        }
        .pulse-dot {
            width: 9px;
            height: 9px;
            border-radius: 50%;
            background: #10b981;
            display: inline-block;
            margin-right: 6px;
            box-shadow: 0 0 6px rgba(16, 185, 129, 0.6);
        }
        .badge-pill {
            display: inline-flex;
            align-items: center;
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
        }
        .badge-store {
            background: #f1f5f9;
            color: #001d35;
            border: 1px solid #cbd5e1;
        }
        .badge-confidential {
            background: #991b1b;
            color: #ffffff;
        }

        /* ── Titre Principal ── */
        .title-banner {
            background: linear-gradient(135deg, #001426 0%, #001d35 60%, #082b4a 100%);
            border: 2px solid #001d35;
            border-left: 6px solid #f59e0b;
            border-radius: 4px;
            padding: 16px 20px;
            color: #ffffff;
            margin-bottom: 14px;
            box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
        }
        .title-eyebrow {
            font-size: 10px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.12em;
            color: #f59e0b;
            margin-bottom: 4px;
        }
        .title-main {
            font-size: 18px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: -0.01em;
            color: #ffffff;
            margin: 0 0 4px 0;
            line-height: 1.25;
        }
        .title-sub {
            font-size: 11.5px;
            color: #cbd5e1;
            font-weight: 500;
        }

        /* ── Verdict Bar ── */
        .verdict-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 14px;
            border: 2px solid #d1d5db;
            border-radius: 4px;
            background: #ffffff;
            box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
            margin-bottom: 14px;
        }
        .verdict-pill {
            font-family: 'JetBrains Mono', monospace;
            font-size: 13px;
            font-weight: 700;
            padding: 4px 10px;
            border-radius: 4px;
        }
        .verdict-pill.neg { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
        .verdict-pill.pos { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
        .verdict-pill.zero { background: #d1fae5; color: #065f46; border: 1px solid #86efac; }

        /* ── Grille 2 Colonnes Dashboard ── */
        .grid-2 {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin-bottom: 14px;
        }
        .dashboard-box {
            background: #ffffff;
            border: 2px solid #d1d5db;
            border-radius: 4px;
            padding: 12px 14px;
            box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
        }
        .box-title {
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 0.025em;
            text-transform: uppercase;
            color: rgba(37, 99, 235, 0.75);
            margin-bottom: 10px;
            border-bottom: 1px solid #e5e7eb;
            padding-bottom: 5px;
        }
        .row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 6px;
            font-size: 11.5px;
        }
        .row span { color: #6b7280; font-weight: 500; }
        .row strong, .row .mono { color: #0f172a; font-weight: 700; font-family: 'JetBrains Mono', monospace; }
        .row.total {
            font-weight: 700;
            border-top: 1.5px dashed #94a3b8;
            padding-top: 6px;
            margin-top: 8px;
            font-size: 12px;
        }

        /* ── Zone Signatures ── */
        .signatures-container {
            background: #ffffff;
            border: 2px solid #d1d5db;
            border-radius: 4px;
            padding: 14px 18px;
            box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 24px;
            margin-top: 14px;
        }
        .sig-box {
            border: 1px dashed #cbd5e1;
            border-radius: 4px;
            padding: 12px;
            text-align: center;
            min-height: 80px;
            background: #fafafa;
        }
        .sig-title {
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            color: #001d35;
            display: block;
            margin-bottom: 2px;
        }
        .sig-sub {
            font-size: 9px;
            color: #9ca3af;
            font-style: italic;
        }

        @media print {
            body { padding: 12px; background: #ffffff; }
            .signatures-container { page-break-inside: avoid; }
        }
    </style>
</head>
<body>
    <!-- 1. Toolbar -->
    <div class="dashboard-toolbar">
        <div>
            <span class="pulse-dot"></span>
            <span>Protocole Anti-Coulage Actif · Clôture en Aveugle</span>
        </div>
        <div>
            <span class="badge-pill badge-store">${currentStoreName}</span>
            <span class="badge-pill badge-confidential">Ticket Z Officiel</span>
        </div>
    </div>

    <!-- 2. Titre -->
    <div class="title-banner">
        <div class="title-eyebrow">Rapport d'Audit Anti-Coulage & Contrôle des Écarts de Caisse</div>
        <h1 class="title-main">Procès-Verbal de Clôture Définitive (Ticket Z)</h1>
        <div class="title-sub">Arrêté légal des comptes, scellement physique en aveugle et visa hiérarchique.</div>
    </div>

    <!-- 3. Verdict -->
    <div class="verdict-bar">
        <div>
            <div style="font-size: 10.5px; font-weight: 700; text-transform: uppercase; color: #4b5563;">Résultat du Contrôle de Caisse :</div>
            <div style="font-size: 12px; font-weight: 700; color: #001d35; margin-top: 2px;">
                ${isDiscrepant ? (session.difference < 0 ? '⚠️ Manquant constaté dans le tiroir' : '⚠️ Excédent inexpliqué constaté') : '✓ Caisse parfaitement conforme'}
            </div>
        </div>
        <div class="verdict-pill ${session.difference < 0 ? 'neg' : session.difference > 0 ? 'pos' : 'zero'}">
            ${diffText}
        </div>
    </div>

    <!-- 4. Grille 2 Colonnes -->
    <div class="grid-2">
        <div class="dashboard-box">
            <div class="box-title">1. Informations de la Session</div>
            <div class="row"><span>ID Session :</span><strong style="font-size: 10px;">${session.id}</strong></div>
            <div class="row"><span>Caissier(e) :</span><strong>${session.cashierName || 'Non renseigné'}</strong></div>
            <div class="row"><span>Boutique :</span><span>${currentStoreName}</span></div>
            <div class="row"><span>Ouverture :</span><span>${new Date(session.startTime).toLocaleString('fr-FR')}</span></div>
            <div class="row"><span>Clôture :</span><span>${session.endTime ? new Date(session.endTime).toLocaleString('fr-FR') : 'En cours'}</span></div>
            <div class="row"><span>Mécanisme :</span><strong style="color: #001d35;">CLÔTURE EN AVEUGLE</strong></div>
        </div>

        <div class="dashboard-box">
            <div class="box-title">2. Synthèse Financière Système</div>
            <div class="row"><span>Fond de Caisse Initial :</span><span class="mono">${formatPrice(session.initialAmount)}</span></div>
            <div class="row"><span>Ventes Espèces :</span><span class="mono" style="color: #059669;">+${formatPrice(session.totalSales || 0)}</span></div>
            <div class="row"><span>Dépenses / Sorties :</span><span class="mono" style="color: #dc2626;">−${formatPrice(session.totalExpenses || 0)}</span></div>
            <div class="row total"><span>Solde Théorique Attendu :</span><strong class="mono" style="color: #001d35;">${formatPrice(session.expectedAmount || 0)}</strong></div>
        </div>
    </div>

    <!-- 5. Déclaration Physique -->
    <div class="dashboard-box" style="margin-bottom: 14px;">
        <div class="box-title">3. Déclaration Physique du Caissier (Saisie Scellée)</div>
        <div class="row" style="font-size: 13px; padding: 4px 0;">
            <span style="font-weight: 700; color: #001d35;">Espèces Physiquement Comptées :</span>
            <strong class="mono" style="font-size: 15px; color: #001d35;">${formatPrice(session.actualAmount || 0)}</strong>
        </div>
        <div class="row" style="border-top: 1px dashed #e2e8f0; padding-top: 6px; margin-top: 4px;">
            <span style="font-weight: 700;">Écart Net Réel (Compté − Attendu) :</span>
            <strong class="mono" style="font-size: 13px; color: ${session.difference < 0 ? '#b91c1c' : session.difference > 0 ? '#b45309' : '#15803d'}">${diffText}</strong>
        </div>
        ${session.justification ? `
            <div style="margin-top: 10px; padding: 8px 12px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 4px; font-size: 11px;">
                <strong style="color: #991b1b; text-transform: uppercase; font-size: 9.5px; display: block; margin-bottom: 2px;">
                    Justification déclarée par le Caissier :
                </strong>
                <em style="color: #334155;">« ${session.justification} »</em>
            </div>
        ` : ''}
    </div>

    <!-- 6. Arbitrage Patron si existant -->
    ${session.auditNote || session.auditStatus ? `
        <div class="dashboard-box" style="margin-bottom: 14px; border-left: 4px solid #001d35;">
            <div class="box-title">4. Arbitrage & Visa de la Direction (Patron)</div>
            <div class="row">
                <span>Décision Patronale :</span>
                <strong style="text-transform: uppercase; color: #001d35;">
                    ${session.auditStatus === 'approved' ? '✓ Validé Sans Pénalité' :
                      session.auditStatus === 'payroll_deduction' ? 'Retenue sur Salaire' :
                      session.auditStatus === 'investigating' ? 'Enquête Interne Approfondie' :
                      session.auditStatus === 'regularized' ? 'Régularisé en Comptabilité' :
                      session.auditStatus || 'En attente'}
                </strong>
            </div>
            ${session.auditNote ? `
                <div style="margin-top: 6px; font-size: 11px; color: #334155;">
                    <strong>Observation de la Direction :</strong> ${session.auditNote}
                </div>
            ` : ''}
            ${session.auditedBy ? `
                <div style="margin-top: 4px; font-size: 10px; color: #64748b;">
                    Visé par <strong>${session.auditedBy}</strong> le ${new Date(session.auditedAt).toLocaleString('fr-FR')}
                </div>
            ` : ''}
        </div>
    ` : ''}

    <!-- 7. Signatures -->
    <div class="signatures-container">
        <div class="sig-box">
            <span class="sig-title">Le Caissier Responsable</span>
            <span class="sig-sub">Certifie sur l'honneur l'exactitude du comptage physique</span>
            <div style="border-top: 1px dashed #cbd5e1; height: 50px; margin-top: 35px;"></div>
        </div>
        <div class="sig-box">
            <span class="sig-title">Pour la Direction & Audit Interne</span>
            <span class="sig-sub">Visa hiérarchique, contrôle anti-coulage & arrêté de caisse</span>
            <div style="border-top: 1px dashed #cbd5e1; height: 50px; margin-top: 35px;"></div>
        </div>
    </div>
</body>
</html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
        }, 300);
    };

    // ── Impression du Rapport Global Anti-Coulage A4 pour le Patron (Style Dashboard Fidèle) ──
    const handlePrintAuditSummaryReport = () => {
        const printWindow = window.open('', '_blank', 'width=1050,height=900');
        if (!printWindow) {
            T.error("Veuillez autoriser les fenêtres pop-up pour éditer le rapport.");
            return;
        }

        const dateFormatted = new Date().toLocaleDateString('fr-FR', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>RAPPORT D'AUDIT ANTI-COULAGE & CONTRÔLE DES ÉCARTS DE CAISSE — ${currentStoreName}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;600;700;800&display=swap" rel="stylesheet">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            margin: 0;
            padding: 24px;
            color: #0f172a;
            background: #f8fafc;
            font-size: 12px;
            line-height: 1.45;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }

        /* ── Barre d'outils supérieure style Dashboard ── */
        .dashboard-toolbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #ffffff;
            padding: 8px 14px;
            border: 2px solid #d1d5db; /* border-2 border-gray-300 */
            border-radius: 4px;        /* rounded-[4px] */
            box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); /* shadow-sm */
            font-size: 11.5px;
            font-weight: 600;          /* font-semibold */
            margin-bottom: 12px;
        }
        .toolbar-left {
            display: flex;
            align-items: center;
            gap: 8px;
            color: #4b5563;
        }
        .pulse-dot {
            width: 9px;
            height: 9px;
            border-radius: 50%;
            background: #10b981;
            display: inline-block;
            box-shadow: 0 0 6px rgba(16, 185, 129, 0.6);
        }
        .toolbar-right {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .badge-pill {
            display: inline-flex;
            align-items: center;
            padding: 3px 8px;
            border-radius: 4px; /* rounded-[4px] */
            font-size: 10px;
            font-weight: 700;   /* font-bold */
            text-transform: uppercase;
            letter-spacing: 0.03em;
        }
        .badge-store {
            background: #f1f5f9;
            color: #001d35;
            border: 1px solid #cbd5e1;
        }
        .badge-confidential {
            background: #991b1b;
            color: #ffffff;
        }

        /* ── Bannière de Titre Officielle ── */
        .title-banner {
            background: linear-gradient(135deg, #001426 0%, #001d35 60%, #082b4a 100%);
            border: 2px solid #001d35;
            border-left: 6px solid #f59e0b;
            border-radius: 4px; /* rounded-[4px] */
            padding: 16px 20px;
            color: #ffffff;
            margin-bottom: 14px;
            box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
        }
        .title-eyebrow {
            font-size: 10px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.12em;
            color: #f59e0b;
            margin-bottom: 4px;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .title-main {
            font-size: 18px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: -0.01em;
            color: #ffffff;
            margin: 0 0 4px 0;
            line-height: 1.25;
        }
        .title-sub {
            font-size: 11.5px;
            color: #cbd5e1;
            font-weight: 500;
            line-height: 1.4;
        }

        /* ── Barre Période & Filtres Identique au Dashboard ── */
        .dashboard-filter-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #ffffff;
            padding: 8px 12px;
            border: 2px solid #d1d5db; /* border-2 border-gray-300 */
            border-radius: 4px;        /* rounded-[4px] */
            box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
            margin-bottom: 14px;
        }
        .filter-tab-group {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            background: rgba(243, 244, 246, 0.8);
            padding: 3px;
            border: 2px solid #d1d5db;
            border-radius: 4px;
        }
        .filter-tab {
            padding: 4px 10px;
            font-size: 11px;
            font-weight: 700;
            border-radius: 4px;
            text-transform: uppercase;
            letter-spacing: 0.02em;
        }
        .filter-tab.active {
            background: #001d35;
            color: #ffffff;
            box-shadow: 0 1px 2px rgba(0,0,0,0.1);
        }
        .filter-meta {
            font-size: 11px;
            font-weight: 600;
            color: #4b5563;
        }
        .filter-meta strong {
            color: #001d35;
        }

        /* ── Grille des 4 StatCards Dashboard ── */
        .kpi-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            margin-bottom: 14px;
        }
        .dashboard-statcard {
            background: #ffffff;
            border: 2px solid #d1d5db; /* exact border-2 border-gray-300 */
            border-radius: 4px;        /* exact rounded-[4px] */
            padding: 12px 14px;
            box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); /* shadow-sm */
            min-height: 105px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            position: relative;
        }
        .statcard-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 4px;
        }
        .statcard-title {
            font-size: 11px;
            font-weight: 600; /* font-semibold */
            letter-spacing: 0.025em; /* tracking-wide */
            text-transform: uppercase;
            color: rgba(37, 99, 235, 0.75); /* text-blue-600/70 */
        }
        .statcard-badge {
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
            padding: 2px 6px;
            border-radius: 4px; /* rounded-[4px] */
        }
        .statcard-val {
            font-family: 'JetBrains Mono', monospace;
            font-size: 21px; /* text-2xl */
            font-weight: 600; /* font-semibold */
            letter-spacing: -0.01em;
            line-height: 1.2;
            margin: 4px 0 2px 0;
            opacity: 0.88;
        }
        .statcard-sub {
            font-size: 11px; /* text-xs */
            color: #9ca3af; /* text-gray-400 */
            font-weight: 500; /* font-medium */
            margin-top: 4px;
        }

        /* ── Grand Livre d'Audit Anti-Coulage (Tableau) ── */
        .table-container {
            background: #ffffff;
            border: 2px solid #d1d5db; /* border-2 border-gray-300 */
            border-radius: 4px;        /* rounded-[4px] */
            overflow: hidden;
            box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
            margin-bottom: 16px;
        }
        .table-top-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 9px 14px;
            background: #ffffff;
            border-bottom: 1px solid #e5e7eb;
        }
        .table-top-title {
            font-size: 11px;
            font-weight: 600; /* font-semibold */
            text-transform: uppercase;
            letter-spacing: 0.025em; /* tracking-wide */
            color: rgba(37, 99, 235, 0.75); /* text-blue-600/70 */
        }
        .table-count-badge {
            font-size: 10px;
            font-weight: 700;
            color: #6b7280;
            background: #f3f4f6;
            padding: 2px 8px;
            border-radius: 4px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
        }
        thead {
            background: #001d35;
        }
        th {
            color: #ffffff;
            font-weight: 700;
            font-size: 9.5px;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            padding: 8px 10px;
            text-align: left;
            border: none;
        }
        th.text-right, td.text-right { text-align: right; }
        th.text-center, td.text-center { text-align: center; }
        tbody tr {
            border-bottom: 1px solid #e5e7eb;
        }
        tbody tr:nth-child(even) {
            background: #f9fafb;
        }
        td {
            padding: 8px 10px;
            color: #1f2937;
            vertical-align: middle;
        }
        .mono {
            font-family: 'JetBrains Mono', monospace;
            font-weight: 600;
        }
        .diff-pill {
            display: inline-block;
            font-family: 'JetBrains Mono', monospace;
            font-weight: 700;
            font-size: 10.5px;
            padding: 2.5px 7px;
            border-radius: 4px; /* rounded-[4px] */
        }
        .diff-pill.neg {
            background: #fee2e2;
            color: #991b1b;
            border: 1px solid #fca5a5;
        }
        .diff-pill.pos {
            background: #fef3c7;
            color: #92400e;
            border: 1px solid #fde68a;
        }
        .diff-pill.zero {
            background: #d1fae5;
            color: #065f46;
            border: 1px solid #86efac;
        }
        .status-pill {
            display: inline-block;
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            padding: 2.5px 7px;
            border-radius: 4px; /* rounded-[4px] */
        }
        .status-pill.approved {
            background: #ecfdf5;
            color: #065f46;
            border: 1px solid #a7f3d0;
        }
        .status-pill.payroll {
            background: #fef2f2;
            color: #991b1b;
            border: 1px solid #fecaca;
        }
        .status-pill.investigating {
            background: #fffbeb;
            color: #92400e;
            border: 1px solid #fde68a;
        }
        .status-pill.pending {
            background: #f1f5f9;
            color: #475569;
            border: 1px solid #cbd5e1;
        }

        /* ── Zone des Signatures ── */
        .signatures-container {
            background: #ffffff;
            border: 2px solid #d1d5db; /* border-2 border-gray-300 */
            border-radius: 4px;        /* rounded-[4px] */
            padding: 14px 18px;
            box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 24px;
        }
        .sig-box {
            border: 1px dashed #cbd5e1;
            border-radius: 4px;
            padding: 12px;
            text-align: center;
            min-height: 80px;
            background: #fafafa;
        }
        .sig-title {
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            color: #001d35;
            display: block;
            margin-bottom: 2px;
        }
        .sig-sub {
            font-size: 9px;
            color: #9ca3af;
            font-style: italic;
        }

        @media print {
            body { padding: 12px; background: #ffffff; }
            .signatures-container { page-break-inside: avoid; }
            .table-container { page-break-inside: auto; }
            tr { page-break-inside: avoid; page-break-after: auto; }
        }
    </style>
</head>
<body>
    <!-- 1. Barre Supérieure Dashboard -->
    <div class="dashboard-toolbar">
        <div class="toolbar-left">
            <span class="pulse-dot"></span>
            <span>Protocole Anti-Coulage Actif · Direction & Audit Interne</span>
        </div>
        <div class="toolbar-right">
            <span class="badge-pill badge-store">${currentStoreName}</span>
            <span class="badge-pill badge-confidential">Strictement Confidentiel</span>
        </div>
    </div>

    <!-- 2. Bannière Titre Principale -->
    <div class="title-banner">
        <div class="title-eyebrow">
            <span>Direction Générale · Contrôle Financier des Tiroirs de Caisse</span>
        </div>
        <h1 class="title-main">Rapport d'Audit Anti-Coulage & Contrôle des Écarts de Caisse</h1>
        <div class="title-sub">
            Grand livre officiel des clôtures physiques à l'aveugle, détection des anomalies de caisse et traçabilité des arbitrages patronaux.
        </div>
    </div>

    <!-- 3. Barre Période & Filtres Dashboard -->
    <div class="dashboard-filter-bar">
        <div class="filter-tab-group">
            <span class="filter-tab active">Toutes les Sessions Clôturées</span>
            <span class="filter-tab" style="color: #6b7280;">Boutique Principale</span>
        </div>
        <div class="filter-meta">
            Édité le <strong>${dateFormatted}</strong> &nbsp;·&nbsp; Registre : <strong>${storeMasterSessions.length} session(s) auditée(s)</strong>
        </div>
    </div>

    <!-- 4. Grille des 4 StatCards Style Dashboard -->
    <div class="kpi-grid">
        <!-- Pertes Cumulées -->
        <div class="dashboard-statcard" style="border-left: 4px solid #e11d48;">
            <div class="statcard-header">
                <span class="statcard-title">Pertes Cumulées</span>
                <span class="statcard-badge" style="background: #fee2e2; color: #991b1b;">Manquants</span>
            </div>
            <div class="statcard-val" style="color: #e11d48;">
                ${formatPrice(auditKPIs.totalLosses)}
            </div>
            <div class="statcard-sub">Argent manquant dans les tiroirs</div>
        </div>

        <!-- Excédents Inexpliqués -->
        <div class="dashboard-statcard" style="border-left: 4px solid #b45309;">
            <div class="statcard-header">
                <span class="statcard-title">Excédents Constatés</span>
                <span class="statcard-badge" style="background: #fef3c7; color: #92400e;">Surplus</span>
            </div>
            <div class="statcard-val" style="color: #b45309;">
                ${formatPrice(auditKPIs.totalSurplus)}
            </div>
            <div class="statcard-sub">Surplus / Risque d'oubli de saisie</div>
        </div>

        <!-- Taux de Conformité -->
        <div class="dashboard-statcard" style="border-left: 4px solid #059669;">
            <div class="statcard-header">
                <span class="statcard-title">Taux de Fiabilité</span>
                <span class="statcard-badge" style="background: #d1fae5; color: #065f46;">Conforme</span>
            </div>
            <div class="statcard-val" style="color: #059669;">
                ${auditKPIs.complianceRate}%
            </div>
            <div class="statcard-sub">Sessions parfaitement équilibrées</div>
        </div>

        <!-- Alertes à Régulariser -->
        <div class="dashboard-statcard" style="border-left: 4px solid #001d35;">
            <div class="statcard-header">
                <span class="statcard-title">Alertes à Arbitrer</span>
                <span class="statcard-badge" style="background: #e2e8f0; color: #001d35;">À statuer</span>
            </div>
            <div class="statcard-val" style="color: #001d35;">
                ${auditKPIs.pendingReviews}
            </div>
            <div class="statcard-sub">Écarts en attente de visa patronal</div>
        </div>
    </div>

    <!-- 5. Grand Livre d'Audit Anti-Coulage (Tableau Format Dashboard) -->
    <div class="table-container">
        <div class="table-top-bar">
            <span class="table-top-title">Grand Livre des Écarts & Arbitrages Patronaux</span>
            <span class="table-count-badge">${storeAllAuditSessions.length} session(s) répertoriée(s)</span>
        </div>
        <table>
            <thead>
                <tr>
                    <th>Date & Heure</th>
                    <th>État</th>
                    <th>Caissier Audité</th>
                    <th class="text-right">Fond Initial</th>
                    <th class="text-right">Attendu Système</th>
                    <th class="text-right">Compté en Aveugle</th>
                    <th class="text-right">Écart Net</th>
                    <th>Justification Caissier</th>
                    <th class="text-center">Visa & Statut Patron</th>
                </tr>
            </thead>
            <tbody>
                ${storeAllAuditSessions.length === 0 ? `
                    <tr>
                        <td colspan="9" style="padding: 30px; text-align: center; color: #94a3b8; font-weight: 500;">
                            Aucune session de caisse enregistrée pour cette boutique.
                        </td>
                    </tr>
                ` : storeAllAuditSessions.map(s => {
                    const isOpen = s.status === 'open';
                    const isNeg = !isOpen && s.difference < 0;
                    const isPos = !isOpen && s.difference > 0;
                    const isConform = !isOpen && Math.abs(s.difference || 0) === 0;
                    const isAlreadyArbitrated = !isOpen && Boolean(s.auditedAt || (s.auditStatus && s.auditStatus !== 'pending_review' && s.auditStatus !== 'pending' && s.auditStatus !== 'in_progress'));
                    const isPendingArbitration = !isOpen && !isAlreadyArbitrated && Math.abs(s.difference || 0) > 0 && (!s.auditStatus || s.auditStatus === 'pending_review' || s.auditStatus === 'pending');

                    return `
                    <tr style="${isAlreadyArbitrated ? 'background: #f0fdf4; border-left: 4px solid #059669;' : isPendingArbitration ? 'background: #fff1f2; border-left: 4px solid #e11d48;' : isOpen ? 'background: #eff6ff; border-left: 4px solid #2563eb;' : ''}">
                        <td style="white-space: nowrap;">
                            <div style="font-weight: 700; color: #0f172a;">
                                ${new Date(s.startTime).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </div>
                            <div style="font-size: 10px; color: #64748b; font-family: 'JetBrains Mono', monospace;">
                                ${new Date(s.startTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} ➔ ${s.endTime ? new Date(s.endTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}
                            </div>
                        </td>
                        <td style="white-space: nowrap;">
                            ${isOpen ? `<span style="background: #dbeafe; color: #1e40af; font-weight: 700; padding: 2px 6px; border-radius: 4px; font-size: 9.5px; text-transform: uppercase;">En cours</span>` :
                              isAlreadyArbitrated ? `<span style="background: #d1fae5; color: #065f46; font-weight: 700; padding: 2px 6px; border-radius: 4px; font-size: 9.5px; text-transform: uppercase; border: 1px solid #a7f3d0;">✓ Arbitré</span>` :
                              isPendingArbitration ? `<span style="background: #fee2e2; color: #991b1b; font-weight: 700; padding: 2px 6px; border-radius: 4px; font-size: 9.5px; text-transform: uppercase;">À Arbitrer</span>` :
                              `<span style="background: #f1f5f9; color: #475569; font-weight: 700; padding: 2px 6px; border-radius: 4px; font-size: 9.5px; text-transform: uppercase;">Conforme</span>`}
                        </td>
                        <td>
                            <div style="font-weight: 700; color: #001d35;">${s.cashierName || 'Caissier'}</div>
                            <div style="font-size: 9.5px; color: #94a3b8; font-family: 'JetBrains Mono', monospace;">ID: ${s.id.slice(0, 14)}...</div>
                        </td>
                        <td class="text-right mono" style="color: #475569;">
                            ${formatPrice(s.initialAmount || 0)}
                        </td>
                        <td class="text-right mono" style="font-weight: 700; color: #0f172a;">
                            ${formatPrice(s.expectedAmount || 0)}
                        </td>
                        <td class="text-right mono" style="font-weight: 700; color: #001d35;">
                            ${isOpen ? '<span style="color: #94a3b8; font-style: italic; font-weight: normal;">En activité</span>' : formatPrice(s.actualAmount || 0)}
                        </td>
                        <td class="text-right">
                            ${isOpen ? '<span style="color: #2563eb; font-weight: 600; font-size: 11px;">Calcul à clôture</span>' : `
                                <span class="diff-pill ${isConform ? 'zero' : isNeg ? 'neg' : 'pos'}">
                                    ${isPos ? '+' : ''}${formatPrice(s.difference || 0)}
                                </span>
                                <div style="font-size: 8.5px; font-weight: 700; text-transform: uppercase; margin-top: 2px; color: ${isNeg ? '#b91c1c' : isPos ? '#b45309' : '#15803d'};">
                                    ${isConform ? '✓ Caisse Juste' : isNeg ? '⚠️ Manquant' : '⚠️ Excédent'}
                                </div>
                            `}
                        </td>
                        <td style="max-width: 220px;">
                            ${isOpen ? '<span style="color: #2563eb; font-style: italic; font-size: 10.5px;">Session en cours</span>' : s.justification ? `
                                <div style="font-size: 10.5px; color: #334155; font-style: italic; background: #ffffff; padding: 4px 6px; border: 1px solid #e2e8f0; border-radius: 4px;">
                                    « ${s.justification} »
                                </div>
                            ` : `<span style="color: #94a3b8; font-style: italic; font-size: 10.5px;">Aucune anomalie déclarée</span>`}
                        </td>
                        <td class="text-center">
                            ${isOpen ? '<span style="background: #dbeafe; color: #1e40af; font-weight: 700; padding: 3px 8px; border-radius: 4px; font-size: 10px;">En Direct</span>' : isAlreadyArbitrated ? `
                                <span style="background: #d1fae5; color: #065f46; font-weight: 700; padding: 3px 8px; border-radius: 4px; font-size: 10px; border: 1px solid #a7f3d0;">
                                    ${s.auditStatus === 'approved' ? '✓ Arbitré : Validé' :
                                      s.auditStatus === 'payroll_deduction' ? '✓ Arbitré : Retenue' :
                                      s.auditStatus === 'investigating' ? '✓ Arbitré : Enquête' :
                                      s.auditStatus === 'regularized' ? '✓ Arbitré : Régularisé' :
                                      '✓ Arbitré'}
                                </span>
                            ` : `
                                <span class="status-pill ${
                                    s.auditStatus === 'approved' ? 'approved' :
                                    s.auditStatus === 'payroll_deduction' ? 'payroll' :
                                    s.auditStatus === 'investigating' ? 'investigating' : 'pending'
                                }">
                                    ${
                                        s.auditStatus === 'approved' ? '✓ Validé' :
                                        s.auditStatus === 'payroll_deduction' ? 'Retenue Salaire' :
                                        s.auditStatus === 'investigating' ? 'Enquête' :
                                        s.auditStatus === 'regularized' ? 'Régularisé' : 'À Arbitrer'
                                    }
                                </span>
                            `}
                            ${s.auditedBy ? `<div style="font-size: 9px; color: #94a3b8; margin-top: 2px;">Par ${s.auditedBy}</div>` : ''}
                        </td>
                    </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    </div>

    <!-- 6. Cartouche des Signatures Officielles (Style Dashboard) -->
    <div class="signatures-container">
        <div class="sig-box">
            <span class="sig-title">Le Responsable de Caisse</span>
            <span class="sig-sub">Certifie sur l'honneur l'exactitude des comptages physiques scellés</span>
            <div style="border-top: 1px dashed #cbd5e1; height: 50px; margin-top: 35px;"></div>
        </div>
        <div class="sig-box">
            <span class="sig-title">Pour la Direction & Audit Interne</span>
            <span class="sig-sub">Visa hiérarchique, arrêté de compte & contrôle anti-coulage</span>
            <div style="border-top: 1px dashed #cbd5e1; height: 50px; margin-top: 35px;"></div>
        </div>
    </div>
</body>
</html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 300);
    };

    return (
        <div className="space-y-3 font-sans">

            {/* ── BARRE D'ONGLETS PRINCIPAUX (Style Dashboard & Retours avec arrière-plan et état actif distinct) ── */}
            <div className="bg-white p-2 sm:p-2.5 rounded-[4px] border-2 border-gray-300 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 flex-wrap" aria-label="Onglets de session">
                    {/* Onglet 1 : Poste de Caisse & Flux */}
                    <button
                        type="button"
                        onClick={() => handleFilterChange(setCurrentMainTab, 'pos')}
                        className={`px-3.5 py-2 rounded-[4px] text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                            currentMainTab === 'pos'
                                ? 'bg-[#001d35] text-white shadow-sm'
                                : 'bg-gray-100 hover:bg-gray-200/80 text-gray-700 font-semibold'
                        }`}
                    >
                        <Wallet className={`w-4 h-4 ${
                            currentMainTab === 'pos' ? 'text-[#f77500]' : 'text-gray-500'
                        }`} />
                        <span>Poste de Caisse & Flux</span>

                        {activeSession && (
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] text-[10px] font-bold uppercase tracking-wider ${
                                currentMainTab === 'pos'
                                    ? isOverdue
                                        ? 'bg-amber-500 text-white'
                                        : 'bg-emerald-500 text-white'
                                    : isOverdue
                                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${
                                    currentMainTab === 'pos' ? 'bg-white' : (isOverdue ? 'bg-amber-600' : 'bg-emerald-600')
                                }`}></span>
                                {isOverdue ? 'À régulariser' : 'En direct'}
                            </span>
                        )}
                    </button>

                    {/* Onglet 2 : Journal d'Audit Anti-Coulage (Patron) */}
                    <button
                        type="button"
                        onClick={() => handleFilterChange(setCurrentMainTab, 'audit')}
                        className={`px-3.5 py-2 rounded-[4px] text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                            currentMainTab === 'audit'
                                ? 'bg-[#001d35] text-white shadow-sm'
                                : 'bg-gray-100 hover:bg-gray-200/80 text-gray-700 font-semibold'
                        }`}
                    >
                        <ShieldCheck className={`w-4 h-4 ${
                            currentMainTab === 'audit' ? 'text-[#f77500]' : 'text-gray-500'
                        }`} />
                        <span>Journal d'Audit Anti-Coulage</span>

                        <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-[4px] ${
                            currentMainTab === 'audit' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
                        }`}>
                            Patron
                        </span>

                        {auditKPIs.pendingReviews > 0 && (
                            <span 
                                className="w-5 h-5 rounded-full bg-red-600 text-white text-[11px] font-extrabold flex items-center justify-center flex-shrink-0 shadow-xs animate-pulse" 
                                title={`${auditKPIs.pendingReviews} session(s) à arbitrer`}
                            >
                                {auditKPIs.pendingReviews}
                            </span>
                        )}
                    </button>
                </div>

                {/* Horloge à droite */}
                <div className="flex items-center gap-2 text-xs text-gray-600 font-semibold px-2.5 py-1 bg-gray-50 rounded-[4px] border border-gray-200">
                    <Clock className="w-3.5 h-3.5 text-[#001d35]" />
                    <span>{format(currentTime, 'dd MMMM yyyy — HH:mm:ss', { locale: fr })}</span>
                </div>
            </div>

            {/* ========================================================================= */}
            {/* 1. ONGLET POSTE DE CAISSE & FLUX (Opérations caissier)                     */}
            {/* ========================================================================= */}
            {currentMainTab === 'pos' && (
                <div className="space-y-3">
                    {/* Bannière état session */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white px-3.5 py-2.5 border-2 border-gray-300 rounded-sm shadow-sm gap-3">
                        <div className="flex items-center gap-3">
                            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                                activeSession
                                    ? isOverdue
                                        ? 'bg-amber-500 animate-pulse'
                                        : 'bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                                    : 'bg-rose-500'
                            }`} />
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-xs font-bold text-[#001d35] tracking-wide uppercase">
                                        {activeSession
                                            ? isOverdue ? 'Session non clôturée' : 'Caisse N°1 — Comptoir Principal'
                                            : 'Caisse Fermée'}
                                    </h2>
                                    <span className="px-2 py-0.5 rounded-sm text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                        {currentStoreName}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-wider ${
                                        activeSession
                                            ? isOverdue
                                                ? 'bg-amber-50 text-amber-700 border border-amber-300'
                                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                                    }`}>
                                        {activeSession ? (isOverdue ? 'À régulariser' : 'Ouverte') : 'Fermée'}
                                    </span>
                                </div>
                                {activeSession && (
                                    <p className="text-gray-500 text-xs mt-0.5 font-medium">
                                        Caissier : <strong className="text-gray-800">{activeSession.cashierName}</strong>
                                        &nbsp;·&nbsp;Ouverte à {format(new Date(activeSession.startTime), 'HH:mm', { locale: fr })}
                                    </p>
                                )}
                            </div>
                        </div>

                        {activeSession && (
                            <button
                                type="button"
                                onClick={handleStartClosing}
                                className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold uppercase tracking-wider text-xs rounded-sm cursor-pointer transition-colors shadow-sm flex items-center gap-2.5"
                            >
                                <Ghost className="w-5 h-5 flex-shrink-0" />
                                <span>Clôture de Caisse en Aveugle</span>
                            </button>
                        )}
                    </div>

                    {/* Alerte Session Expirée */}
                    {activeSession && isOverdue && (
                        <div className="bg-amber-50 border-2 border-amber-300 rounded-sm p-3 flex items-start gap-3 shadow-sm">
                            <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center animate-pulse flex-shrink-0 shadow-sm">!</span>
                            <div>
                                <h4 className="font-bold text-amber-900 text-xs uppercase tracking-wide">Session non clôturée (Jour précédent)</h4>
                                <p className="text-xs text-amber-700 mt-0.5">
                                    Ouverte le <strong>{format(new Date(activeSession.startTime), 'dd MMMM yyyy', { locale: fr })}</strong> par <strong>{activeSession.cashierName}</strong>.
                                    Veuillez procéder à la clôture en aveugle pour arrêter les comptes.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Session Active : 4 Cartes KPI */}
                    {activeSession ? (
                        <div className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                {/* Fond Initial */}
                                <div className="bg-white p-3 rounded-sm border-2 border-gray-300 shadow-sm relative group hover:shadow-md transition-shadow overflow-hidden flex flex-col justify-center min-h-[120px]">
                                    {filterLoading ? (
                                        <div className="flex flex-col items-center justify-center py-4">
                                            <div className="relative h-8 w-8">
                                                <div className="absolute inset-0 animate-spin rounded-full border-2 border-t-transparent border-[#001d35]"></div>
                                                <div className="absolute inset-1 animate-spin-reverse rounded-full border-2 border-b-transparent border-[#f77500] opacity-60"></div>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex justify-between items-start relative z-10">
                                                <div className="flex-1">
                                                    <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-blue-600/70">Fond Initial</p>
                                                    <div className="flex items-baseline mt-2 font-semibold opacity-85" style={{ color: '#001d35', opacity: 0.85 }}>
                                                        <h3 className="text-xl sm:text-2xl font-semibold">{formatPrice(activeSession.initialAmount)}</h3>
                                                    </div>
                                                    <p className="text-xs text-gray-400 mt-1.5 font-medium">Montant d'ouverture en tiroir</p>
                                                </div>
                                            </div>
                                            <img src="/icons8/fluency_240_box.png" alt="" className="absolute bottom-2 right-2 w-16 h-16 opacity-25 group-hover:opacity-40 group-hover:scale-105 transition-all pointer-events-none" />
                                        </>
                                    )}
                                </div>

                                {/* Solde Théorique Actuel */}
                                <div className="bg-white p-3 rounded-sm border-2 border-gray-300 shadow-sm relative group hover:shadow-md transition-shadow overflow-hidden flex flex-col justify-center min-h-[120px]">
                                    {filterLoading ? (
                                        <div className="flex flex-col items-center justify-center py-4">
                                            <div className="relative h-8 w-8">
                                                <div className="absolute inset-0 animate-spin rounded-full border-2 border-t-transparent border-[#001d35]"></div>
                                                <div className="absolute inset-1 animate-spin-reverse rounded-full border-2 border-b-transparent border-[#f77500] opacity-60"></div>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex justify-between items-start relative z-10">
                                                <div className="flex-1">
                                                    <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-blue-600/70">Solde Théorique Actuel</p>
                                                    <div className="flex items-baseline mt-2 font-semibold opacity-85" style={{ color: '#001d35', opacity: 0.85 }}>
                                                        <h3 className="text-xl sm:text-2xl font-semibold">{formatPrice(sessionStats.expectedAmount)}</h3>
                                                    </div>
                                                    <p className="text-xs text-gray-400 mt-1.5 font-medium">
                                                        Fond + espèces {sessionStats.totalEntries > 0 ? '+ entrées ' : ''}− sorties
                                                    </p>
                                                </div>
                                            </div>
                                            <img src="/icons8/fluency_240_banknotes.png" alt="" className="absolute bottom-2 right-2 w-16 h-16 opacity-25 group-hover:opacity-40 group-hover:scale-105 transition-all pointer-events-none" />
                                        </>
                                    )}
                                </div>

                                {/* En Espèces (Ventes) */}
                                <div className="bg-white p-3 rounded-sm border-2 border-gray-300 shadow-sm relative group hover:shadow-md transition-shadow overflow-hidden flex flex-col justify-center min-h-[120px]">
                                    {filterLoading ? (
                                        <div className="flex flex-col items-center justify-center py-4">
                                            <div className="relative h-8 w-8">
                                                <div className="absolute inset-0 animate-spin rounded-full border-2 border-t-transparent border-[#001d35]"></div>
                                                <div className="absolute inset-1 animate-spin-reverse rounded-full border-2 border-b-transparent border-[#f77500] opacity-60"></div>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex justify-between items-start relative z-10">
                                                <div className="flex-1">
                                                    <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-emerald-600/80">En Espèces (Ventes)</p>
                                                    <div className="flex items-baseline mt-2 font-semibold opacity-85" style={{ color: '#059669', opacity: 0.85 }}>
                                                        <h3 className="text-xl sm:text-2xl font-semibold">{formatPrice(sessionStats.totalSalesCash)}</h3>
                                                    </div>
                                                    <p className="text-xs text-gray-400 mt-1.5 font-medium">Ventes cash de la session</p>
                                                </div>
                                            </div>
                                            <img src="/icons8/fluency_240_cash-in-hand.png" alt="" className="absolute bottom-2 right-2 w-16 h-16 opacity-25 group-hover:opacity-40 group-hover:scale-105 transition-all pointer-events-none" />
                                        </>
                                    )}
                                </div>

                                {/* Autres Encaissements */}
                                <div className="bg-white p-3 rounded-sm border-2 border-gray-300 shadow-sm relative group hover:shadow-md transition-shadow overflow-hidden flex flex-col justify-center min-h-[120px]">
                                    {filterLoading ? (
                                        <div className="flex flex-col items-center justify-center py-4">
                                            <div className="relative h-8 w-8">
                                                <div className="absolute inset-0 animate-spin rounded-full border-2 border-t-transparent border-[#001d35]"></div>
                                                <div className="absolute inset-1 animate-spin-reverse rounded-full border-2 border-b-transparent border-[#f77500] opacity-60"></div>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex justify-between items-start relative z-10">
                                                <div className="flex-1">
                                                    <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-blue-600/70">Autres Encaissements</p>
                                                    <div className="flex items-baseline mt-2 font-semibold opacity-85" style={{ color: '#0284c7', opacity: 0.85 }}>
                                                        <h3 className="text-xl sm:text-2xl font-semibold">{formatPrice(sessionStats.totalSalesCard + sessionStats.totalSalesCheque)}</h3>
                                                    </div>
                                                    <p className="text-xs text-gray-400 mt-1.5 font-medium">
                                                        Mobile : {formatPrice(sessionStats.totalSalesCard)} {sessionStats.totalSalesCheque > 0 ? `· Chq : ${formatPrice(sessionStats.totalSalesCheque)}` : ''}
                                                    </p>
                                                </div>
                                            </div>
                                            <img src="/icons8/fluency_240_ledger.png" alt="" className="absolute bottom-2 right-2 w-16 h-16 opacity-25 group-hover:opacity-40 group-hover:scale-105 transition-all pointer-events-none" />
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Mouvements & Actions : Actions de Caisse à GAUCHE, Flux à DROITE */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                                {/* Colonne Actions rapides & Arrêté (À GAUCHE - 1 colonne) */}
                                <div className="space-y-3">
                                    <div className="bg-white p-3 rounded-sm border-2 border-gray-300 shadow-sm space-y-2">
                                        <h3 className="text-sm font-semibold tracking-wide uppercase text-[11px] text-blue-600/70">
                                            Actions de Caisse
                                        </h3>
                                        <div className="grid grid-cols-1 gap-2 pt-1">
                                            <button
                                                type="button"
                                                onClick={() => { setActiveModal('withdrawal'); setModalAmount(''); setModalLabel(''); }}
                                                className="w-full py-2.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-sm font-bold text-xs uppercase tracking-wider transition-colors flex items-center justify-between cursor-pointer"
                                            >
                                                <span className="flex items-center gap-2"><ArrowDownCircle className="w-4 h-4 text-rose-600" /> Sortie de caisse</span>
                                                <span className="text-[10px] font-normal text-rose-600">Dépense</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => { setActiveModal('entry'); setModalAmount(''); setModalLabel(''); }}
                                                className="w-full py-2.5 px-3 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 rounded-sm font-bold text-xs uppercase tracking-wider transition-colors flex items-center justify-between cursor-pointer"
                                            >
                                                <span className="flex items-center gap-2"><ArrowUpCircle className="w-4 h-4 text-sky-600" /> Entrée de caisse</span>
                                                <span className="text-[10px] font-normal text-sky-600">Apport</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => { setActiveModal('skimming'); setModalAmount(''); setModalLabel('Écrémage vers coffre'); }}
                                                className="w-full py-2.5 px-3 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-sm font-bold text-xs uppercase tracking-wider transition-colors flex items-center justify-between cursor-pointer"
                                            >
                                                <span className="flex items-center gap-2"><DollarSign className="w-4 h-4 text-amber-600" /> Écrémage (Coffre)</span>
                                                <span className="text-[10px] font-normal text-amber-600">Sécurité</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Récapitulatif solde */}
                                    <div className="bg-white p-3.5 rounded-sm border-2 border-gray-300 shadow-sm space-y-2">
                                        <h3 className="text-sm font-semibold tracking-wide uppercase text-[11px] text-blue-600/70">
                                            Arrêté des Comptes
                                        </h3>
                                        <div className="space-y-1.5 text-xs">
                                            <div className="flex justify-between items-center text-gray-600">
                                                <span className="font-medium">Fond de départ</span>
                                                <span className="font-semibold text-gray-800">{formatPrice(activeSession.initialAmount)}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-gray-600">
                                                <span className="font-medium">Ventes Espèces</span>
                                                <span className="font-bold text-emerald-600">+{formatPrice(sessionStats.totalSalesCash)}</span>
                                            </div>
                                            {sessionStats.totalEntries > 0 && (
                                                <div className="flex justify-between items-center text-gray-600">
                                                    <span className="font-medium">Entrées manuelles</span>
                                                    <span className="font-bold text-sky-600">+{formatPrice(sessionStats.totalEntries)}</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between items-center text-gray-600">
                                                <span className="font-medium">Sorties / Décaissements</span>
                                                <span className="font-bold text-rose-600">−{formatPrice(sessionStats.totalExpensesCash)}</span>
                                            </div>
                                            <div className="border-t border-gray-200 pt-2 flex justify-between items-center">
                                                <span className="font-bold text-[#001d35]">Solde Théorique</span>
                                                <span className="font-bold text-[#001d35] text-sm">{formatPrice(sessionStats.expectedAmount)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Colonne flux (À DROITE - 2 colonnes) */}
                                <div className="lg:col-span-2 bg-white p-3 rounded-sm border-2 border-gray-300 shadow-sm overflow-hidden flex flex-col">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-gray-200 mb-2 gap-2">
                                        <div>
                                            <h3 className="text-sm font-semibold tracking-wide uppercase text-[11px] text-blue-600/70">Mouvements de la Session (Flux)</h3>
                                            <p className="text-xs text-gray-500 mt-0.5">Détail chronologique des entrées, ventes et sorties</p>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <div className="flex items-center gap-1 bg-gray-100/80 p-0.5 rounded-sm border border-gray-300">
                                                {[
                                                    { key: 'all', label: 'Tous' },
                                                    { key: 'operations', label: 'Opérations caisse' },
                                                    { key: 'sales', label: 'Ventes' }
                                                ].map(opt => (
                                                    <button
                                                        key={opt.key}
                                                        type="button"
                                                        onClick={() => handleFilterChange(setMovementFilter, opt.key)}
                                                        className={`px-2 py-1 text-[11px] font-semibold rounded-sm transition-all cursor-pointer ${
                                                            movementFilter === opt.key
                                                                ? 'bg-[#001d35] text-white shadow-xs'
                                                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                                                        }`}
                                                    >
                                                        {opt.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="overflow-x-auto min-h-[180px] flex flex-col justify-center">
                                        {filterLoading ? (
                                            <div className="p-10 flex flex-col items-center justify-center bg-white">
                                                <div className="relative h-8 w-8">
                                                    <div className="absolute inset-0 animate-spin rounded-full border-2 border-t-transparent border-[#001d35]"></div>
                                                    <div className="absolute inset-1 animate-spin-reverse rounded-full border-2 border-b-transparent border-[#f77500] opacity-60"></div>
                                                </div>
                                                <p className="text-xs font-bold text-[#001d35] mt-2.5 uppercase tracking-wider">
                                                    Actualisation des flux...
                                                </p>
                                            </div>
                                        ) : (
                                            <table className="w-full text-left text-xs">
                                                <thead>
                                                    <tr className="border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                                                        <th className="py-2 px-2.5">Heure</th>
                                                        <th className="py-2 px-2.5">Type</th>
                                                        <th className="py-2 px-2.5">Motif / Référence</th>
                                                        <th className="py-2 px-2.5 text-right">Montant</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {filteredMovements.length === 0 ? (
                                                        <tr>
                                                            <td colSpan="4" className="py-8 text-center text-gray-400 text-xs font-medium">
                                                                Aucun mouvement enregistré pour ce filtre
                                                            </td>
                                                        </tr>
                                                    ) : filteredMovements.map((mv, i) => (
                                                        <tr key={i} className="hover:bg-gray-50 transition-colors">
                                                            <td className="py-2 px-2.5 text-gray-400 font-medium">
                                                                {format(mv.time, 'HH:mm:ss')}
                                                            </td>
                                                            <td className="py-2 px-2.5">
                                                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-wider ${
                                                                    mv.type === 'Vente' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                                                    mv.type === 'Entrée' ? 'bg-sky-50 text-sky-700 border border-sky-200' :
                                                                    'bg-rose-50 text-rose-700 border border-rose-200'
                                                                }`}>
                                                                    {mv.type}
                                                                </span>
                                                            </td>
                                                            <td className="py-2 px-2.5 font-medium text-gray-800">{mv.motif}</td>
                                                            <td className={`py-2 px-2.5 text-right font-bold text-xs ${
                                                                mv.type === 'Sortie' ? 'text-rose-600' : 'text-emerald-600'
                                                            }`}>
                                                                {mv.type === 'Sortie' ? '−' : '+'}{formatPrice(mv.amount)}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Formulaire d'Ouverture de caisse */
                        <div className="bg-white rounded-sm border-2 border-gray-300 shadow-sm overflow-hidden max-w-lg relative p-4">
                            <div className="flex items-center gap-2 pb-3 border-b border-gray-200 mb-4">
                                <Unlock className="w-4 h-4 text-[#001d35]" />
                                <div>
                                    <h3 className="text-xs font-bold text-[#001d35] uppercase tracking-wider">Ouvrir la Caisse</h3>
                                    <p className="text-gray-500 text-xs mt-0.5">Démarrez une nouvelle session de caisse</p>
                                </div>
                            </div>
                            <form onSubmit={handleOpenSession} className="space-y-4">
                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-700 uppercase tracking-wide mb-1.5">
                                        Fond de Caisse Initial (FCFA)
                                    </label>
                                    <div className="relative">
                                        <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <FinancialInput
                                            value={initialAmountInput}
                                            onChange={(e) => setInitialAmountInput(e.target.value)}
                                            disabled={isOpeningSession}
                                            className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-sm focus:outline-none focus:border-[#001d35] focus:bg-white font-semibold text-lg text-slate-800 transition-all"
                                            placeholder="Ex: 20 000"
                                            required
                                            min="0"
                                            autoFocus
                                        />
                                    </div>
                                    <p className="text-[11px] text-gray-400 mt-1 font-medium">
                                        Montant en espèces physiquement présent dans le tiroir avant le premier client.
                                    </p>
                                </div>
                                <button
                                    type="submit"
                                    disabled={isOpeningSession}
                                    className="w-full py-2.5 bg-[#001d35] hover:bg-[#002d52] disabled:opacity-70 text-white font-bold rounded-sm transition-colors uppercase tracking-wider text-xs flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                                >
                                    <Unlock className="w-3.5 h-3.5" />
                                    Démarrer la session de caisse
                                </button>
                            </form>
                        </div>
                    )}

                    {/* Historique personnel des sessions clôturées du caissier */}
                    <div className="bg-white p-3 rounded-sm border-2 border-gray-300 shadow-sm w-full min-w-0 overflow-hidden">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-gray-200 mb-2 gap-2">
                            <div>
                                <h3 className="text-sm font-semibold tracking-wide uppercase text-[11px] text-blue-600/70 flex items-center gap-1.5">
                                    <History className="w-3.5 h-3.5" />
                                    Mes Dernières Sessions Clôturées
                                </h3>
                                <p className="text-xs text-gray-500 mt-0.5">Historique de vos clôtures en aveugle</p>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <div className="flex items-center gap-1 bg-gray-100/80 p-0.5 rounded-sm border border-gray-300">
                                    {[
                                        { id: 'all', label: `Toutes (${pastSessions.length})` },
                                        { id: 'arbitrated', label: 'Arbitrées' },
                                        { id: 'pending', label: 'À arbitrer' },
                                        { id: 'conform', label: 'Conformes' }
                                    ].map(f => (
                                        <button
                                            key={f.id}
                                            type="button"
                                            onClick={() => handleFilterChange(setPastSessionFilter, f.id)}
                                            className={`px-2 py-1 text-[11px] font-semibold rounded-sm transition-all cursor-pointer ${
                                                pastSessionFilter === f.id
                                                    ? 'bg-[#001d35] text-white shadow-xs'
                                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                                            }`}
                                        >
                                            {f.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="w-full min-w-0 overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                                        <th className="py-2 px-2.5">Date / Heure</th>
                                        <th className="py-2 px-2.5">État</th>
                                        <th className="py-2 px-2.5">Caissier</th>
                                        <th className="py-2 px-2.5 text-right">Attendu</th>
                                        <th className="py-2 px-2.5 text-right">Compté</th>
                                        <th className="py-2 px-2.5 text-right">Écart</th>
                                        <th className="py-2 px-2.5 text-center">Ticket Z</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredPastSessions.length === 0 ? (
                                        <tr>
                                            <td colSpan="7" className="py-8 text-center text-gray-400 text-xs font-medium">
                                                Aucune clôture ne correspond aux critères d'état sélectionnés.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredPastSessions.map(session => {
                                            const isAlreadyArbitrated = Boolean(session.auditedAt || (session.auditStatus && session.auditStatus !== 'pending_review' && session.auditStatus !== 'pending'));
                                            const isPendingArbitration = !isAlreadyArbitrated && Math.abs(session.difference || 0) > 0 && (!session.auditStatus || session.auditStatus === 'pending_review' || session.auditStatus === 'pending');

                                            return (
                                                <tr key={session.id} className="hover:bg-gray-50 transition-colors">
                                                    <td className="py-2 px-2.5">
                                                        <p className="font-semibold text-gray-800 text-xs">
                                                            {format(new Date(session.startTime), 'dd MMM yyyy', { locale: fr })}
                                                        </p>
                                                        <p className="text-gray-400 text-[11px]">
                                                            {format(new Date(session.startTime), 'HH:mm')} ➔ {session.endTime ? format(new Date(session.endTime), 'HH:mm') : '—'}
                                                        </p>
                                                    </td>
                                                    <td className="py-2 px-2.5 whitespace-nowrap">
                                                        {isPendingArbitration ? (
                                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[3px] text-[9px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-300">
                                                                <AlertTriangle className="w-2.5 h-2.5 text-rose-600" />
                                                                À arbitrer
                                                            </span>
                                                        ) : isAlreadyArbitrated ? (
                                                            <span className="text-gray-600 text-xs font-medium flex items-center gap-1">
                                                                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                                                Arbitré
                                                            </span>
                                                        ) : (
                                                            <span className="text-gray-500 text-xs font-medium flex items-center gap-1">
                                                                <Check className="w-3 h-3 text-emerald-600" />
                                                                Conforme
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-2 px-2.5 font-semibold text-gray-800">{session.cashierName || 'Caissier'}</td>
                                                    <td className="py-2 px-2.5 text-right text-gray-700 font-medium">{formatPrice(session.expectedAmount)}</td>
                                                    <td className="py-2 px-2.5 text-right font-bold text-[#001d35]">{formatPrice(session.actualAmount)}</td>
                                                    <td className="py-2 px-2.5 text-right">
                                                        <span className={`inline-block px-1.5 py-0.5 rounded-sm text-[10px] font-bold ${
                                                            session.difference === 0
                                                                ? 'bg-emerald-100 text-emerald-800'
                                                                : session.difference > 0
                                                                    ? 'bg-amber-100 text-amber-800'
                                                                    : 'bg-rose-100 text-rose-800'
                                                        }`}>
                                                            {session.difference > 0 ? '+' : ''}{formatPrice(session.difference)}
                                                        </span>
                                                    </td>
                                                    <td className="py-2 px-2.5 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => handlePrintZReport(session)}
                                                            className="p-1 text-gray-500 hover:text-[#001d35] hover:bg-gray-100 rounded-sm transition-colors cursor-pointer"
                                                            title="Imprimer le Ticket Z"
                                                        >
                                                            <Printer className="w-3.5 h-3.5" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* 2. ONGLET JOURNAL D'AUDIT ANTI-COULAGE (Espace Patron & Direction)         */}
            {/* ========================================================================= */}
            {currentMainTab === 'audit' && (
                <div className="space-y-3">
                    {/* 4 StatCards Métier Anti-Pertes Patron */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {/* Pertes Cumulées */}
                        <div className="bg-white p-3 rounded-sm border-2 border-gray-300 shadow-sm relative group hover:shadow-md transition-shadow overflow-hidden flex flex-col justify-center min-h-[120px]">
                            {filterLoading ? (
                                <div className="flex flex-col items-center justify-center py-4">
                                    <div className="relative h-8 w-8">
                                        <div className="absolute inset-0 animate-spin rounded-full border-2 border-t-transparent border-[#001d35]"></div>
                                        <div className="absolute inset-1 animate-spin-reverse rounded-full border-2 border-b-transparent border-[#f77500] opacity-60"></div>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="flex justify-between items-start relative z-10">
                                        <div className="flex-1">
                                            <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-rose-600/80">Pertes Cumulées (Manquants)</p>
                                            <div className="flex items-baseline mt-2 font-semibold opacity-85" style={{ color: '#e11d48', opacity: 0.85 }}>
                                                <h3 className="text-xl sm:text-2xl font-semibold">{formatPrice(auditKPIs.totalLosses)}</h3>
                                            </div>
                                            <p className="text-xs text-gray-400 mt-1.5 font-medium">Argent manquant dans les tiroirs</p>
                                        </div>
                                    </div>
                                    <AlertTriangle className="absolute bottom-2 right-2 w-14 h-14 text-rose-500/10 group-hover:scale-105 transition-all pointer-events-none" />
                                </>
                            )}
                        </div>

                        {/* Excédents Inexpliqués */}
                        <div className="bg-white p-3 rounded-sm border-2 border-gray-300 shadow-sm relative group hover:shadow-md transition-shadow overflow-hidden flex flex-col justify-center min-h-[120px]">
                            {filterLoading ? (
                                <div className="flex flex-col items-center justify-center py-4">
                                    <div className="relative h-8 w-8">
                                        <div className="absolute inset-0 animate-spin rounded-full border-2 border-t-transparent border-[#001d35]"></div>
                                        <div className="absolute inset-1 animate-spin-reverse rounded-full border-2 border-b-transparent border-[#f77500] opacity-60"></div>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="flex justify-between items-start relative z-10">
                                        <div className="flex-1">
                                            <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-amber-600/80">Excédents Inexpliqués</p>
                                            <div className="flex items-baseline mt-2 font-semibold opacity-85" style={{ color: '#b45309', opacity: 0.85 }}>
                                                <h3 className="text-xl sm:text-2xl font-semibold">{formatPrice(auditKPIs.totalSurplus)}</h3>
                                            </div>
                                            <p className="text-xs text-gray-400 mt-1.5 font-medium">Surplus / Risque de vente oubliée</p>
                                        </div>
                                    </div>
                                    <DollarSign className="absolute bottom-2 right-2 w-14 h-14 text-amber-500/10 group-hover:scale-105 transition-all pointer-events-none" />
                                </>
                            )}
                        </div>

                        {/* Taux de Conformité */}
                        <div className="bg-white p-3 rounded-sm border-2 border-gray-300 shadow-sm relative group hover:shadow-md transition-shadow overflow-hidden flex flex-col justify-center min-h-[120px]">
                            {filterLoading ? (
                                <div className="flex flex-col items-center justify-center py-4">
                                    <div className="relative h-8 w-8">
                                        <div className="absolute inset-0 animate-spin rounded-full border-2 border-t-transparent border-[#001d35]"></div>
                                        <div className="absolute inset-1 animate-spin-reverse rounded-full border-2 border-b-transparent border-[#f77500] opacity-60"></div>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="flex justify-between items-start relative z-10">
                                        <div className="flex-1">
                                            <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-emerald-600/80">Taux de Fiabilité Caisse</p>
                                            <div className="flex items-baseline mt-2 font-semibold opacity-85" style={{ color: '#059669', opacity: 0.85 }}>
                                                <h3 className="text-xl sm:text-2xl font-semibold">{auditKPIs.complianceRate}%</h3>
                                            </div>
                                            <p className="text-xs text-gray-400 mt-1.5 font-medium">Sessions parfaitement équilibrées</p>
                                        </div>
                                    </div>
                                    <CheckCircle2 className="absolute bottom-2 right-2 w-14 h-14 text-emerald-500/10 group-hover:scale-105 transition-all pointer-events-none" />
                                </>
                            )}
                        </div>

                        {/* Alertes à Régulariser */}
                        <div className="bg-white p-3 rounded-sm border-2 border-gray-300 shadow-sm relative group hover:shadow-md transition-shadow overflow-hidden flex flex-col justify-center min-h-[120px]">
                            {filterLoading ? (
                                <div className="flex flex-col items-center justify-center py-4">
                                    <div className="relative h-8 w-8">
                                        <div className="absolute inset-0 animate-spin rounded-full border-2 border-t-transparent border-[#001d35]"></div>
                                        <div className="absolute inset-1 animate-spin-reverse rounded-full border-2 border-b-transparent border-[#f77500] opacity-60"></div>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="flex justify-between items-start relative z-10">
                                        <div className="flex-1">
                                            <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-blue-600/70">Alertes à Arbitrer</p>
                                            <div className="flex items-baseline mt-2 font-semibold opacity-85" style={{ color: '#001d35', opacity: 0.85 }}>
                                                <h3 className="text-xl sm:text-2xl font-semibold">{auditKPIs.pendingReviews}</h3>
                                                {auditKPIs.arbitratedCount > 0 && (
                                                    <span className="ml-2 text-xs font-medium text-gray-400">
                                                        ({auditKPIs.arbitratedCount} arbitrée{auditKPIs.arbitratedCount > 1 ? 's' : ''})
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-400 mt-1.5 font-medium">
                                                {auditKPIs.pendingReviews > 0 ? 'Écarts en attente de visa patronal' : 'Tous les écarts ont été arbitrés'}
                                            </p>
                                        </div>
                                    </div>
                                    <ShieldAlert className="absolute bottom-2 right-2 w-14 h-14 text-blue-900/10 group-hover:scale-105 transition-all pointer-events-none" />
                                </>
                            )}
                        </div>
                    </div>

                    {/* Barre de Filtres et Outils d'Audit */}
                    <div className="bg-white border-2 border-gray-300 rounded-sm shadow-sm p-3.5">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                            <div className="flex-1 relative max-w-md">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Rechercher par caissier, motif, référence..."
                                    value={auditSearchTerm}
                                    onChange={(e) => setAuditSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-sm focus:outline-none focus:border-[#001d35] text-xs text-gray-800"
                                />
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                {/* Sélecteur État de Session */}
                                <select
                                    value={auditFilter}
                                    onChange={(e) => handleFilterChange(setAuditFilter, e.target.value)}
                                    className="px-2.5 py-1.5 border border-gray-300 rounded-sm text-xs font-semibold text-gray-700 bg-white"
                                >
                                    <option value="open">🟢 Session en cours</option>
                                    <option value="pending">🔴 À Arbitrer par le Patron ({auditKPIs.pendingReviews})</option>
                                    <option value="all">Toutes les sessions</option>
                                    <option value="arbitrated">🟢 Arbitrée & Scellée</option>
                                    <option value="conform">✓ Conforme</option>
                                    <option value="discrepancies">⚠️ Avec écart</option>
                                </select>

                                {/* Filtre rapide avec badge : À Arbitrer par le Patron */}
                                {auditKPIs.pendingReviews > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => handleFilterChange(setAuditFilter, 'pending')}
                                        className={`px-3 py-1.5 rounded-sm text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                            auditFilter === 'pending'
                                                ? 'bg-rose-700 text-white shadow-xs'
                                                : 'bg-rose-50 text-rose-800 border-2 border-rose-300 hover:bg-rose-100 shadow-2xs'
                                        }`}
                                        title="Filtrer les sessions en attente d'arbitrage patronal"
                                    >
                                        <span>🔴 À Arbitrer par le Patron</span>
                                        <span className="w-5 h-5 rounded-full text-[11px] font-extrabold flex items-center justify-center flex-shrink-0 bg-red-600 text-white">
                                            {auditKPIs.pendingReviews}
                                        </span>
                                    </button>
                                )}

                                {/* Sélecteur caissier */}
                                {cashierOptions.length > 0 && (
                                    <select
                                        value={auditCashierFilter}
                                        onChange={(e) => handleFilterChange(setAuditCashierFilter, e.target.value)}
                                        className="px-2.5 py-1.5 border border-gray-300 rounded-sm text-xs font-semibold text-gray-700 bg-white"
                                    >
                                        <option value="all">Tous les caissiers</option>
                                        {cashierOptions.map(name => (
                                            <option key={name} value={name}>{name}</option>
                                        ))}
                                    </select>
                                )}

                                {/* Bouton impression rapport patron */}
                                <button
                                    type="button"
                                    onClick={handlePrintAuditSummaryReport}
                                    className="px-3.5 py-1.5 bg-[#001d35] hover:bg-[#002d52] text-white font-bold uppercase tracking-wider text-xs rounded-sm cursor-pointer transition-colors shadow-sm flex items-center gap-1.5"
                                >
                                    <Printer className="w-3.5 h-3.5" />
                                    <span>Imprimer le Rapport A4 (Patron)</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Grand Livre d'Audit Anti-Coulage */}
                    <div className="bg-white border-2 border-gray-300 rounded-sm shadow-sm overflow-hidden">
                        {filterLoading ? (
                            <div className="p-16 min-h-[300px] flex flex-col items-center justify-center bg-white animate-in fade-in duration-150">
                                <div className="relative h-10 w-10">
                                    <div className="absolute inset-0 animate-spin rounded-full border-4 border-gray-200 border-t-[#001d35]"></div>
                                    <div className="absolute inset-1.5 animate-spin-reverse rounded-full border-2 border-transparent border-b-[#f77500]"></div>
                                </div>
                                <p className="text-xs font-bold text-[#001d35] mt-3 uppercase tracking-wider">
                                    Synchronisation en cours...
                                </p>
                                <p className="text-[11px] text-gray-400 mt-0.5 font-medium">
                                    Actualisation des sessions d'audit
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead className="bg-[#001d35] text-white font-bold uppercase text-[10px] tracking-wider">
                                    <tr className="divide-x divide-white/10">
                                        <th className="px-3 py-2.5">Date & Heures</th>
                                        <th className="px-3 py-2.5">État de Session</th>
                                        <th className="px-3 py-2.5">Caissier Audité</th>
                                        <th className="px-3 py-2.5 text-right">Fond Initial</th>
                                        <th className="px-3 py-2.5 text-right">Théorique Système</th>
                                        <th className="px-3 py-2.5 text-right">Compté en Aveugle</th>
                                        <th className="px-3 py-2.5 text-right">Écart Net</th>
                                        <th className="px-3 py-2.5">Justification Caissier</th>
                                        <th className="px-3 py-2.5 text-center">Visa & Statut Patron</th>
                                        <th className="px-3 py-2.5 text-center w-36">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {filteredAuditSessions.length === 0 ? (
                                        <tr>
                                            <td colSpan="10" className="px-4 py-10 text-center text-gray-400 font-medium">
                                                Aucune session ne correspond aux critères d'audit et d'état sélectionnés.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredAuditSessions.map((session) => {
                                            const isOpen = session.status === 'open';
                                            const isNeg = !isOpen && session.difference < 0;
                                            const isPos = !isOpen && session.difference > 0;
                                            const isConform = !isOpen && Math.abs(session.difference || 0) === 0;
                                            const isAlreadyArbitrated = !isOpen && Boolean(session.auditedAt || (session.auditStatus && session.auditStatus !== 'pending_review' && session.auditStatus !== 'pending' && session.auditStatus !== 'in_progress'));
                                            const isPendingArbitration = !isOpen && !isAlreadyArbitrated && Math.abs(session.difference || 0) > 0 && (!session.auditStatus || session.auditStatus === 'pending_review' || session.auditStatus === 'pending');

                                            return (
                                                <tr 
                                                    key={session.id} 
                                                    className={`transition-colors ${
                                                        isPendingArbitration 
                                                            ? 'bg-rose-50/50 hover:bg-rose-50/80 border-l-4 border-l-red-600' 
                                                            : 'hover:bg-gray-50/80'
                                                    }`}
                                                >
                                                    {/* Date & Heures */}
                                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                                        <div className="font-bold text-gray-800">
                                                            {format(new Date(session.startTime), 'dd MMM yyyy', { locale: fr })}
                                                        </div>
                                                        <div className="text-[10px] text-gray-400">
                                                            {format(new Date(session.startTime), 'HH:mm')} ➔ {session.endTime ? format(new Date(session.endTime), 'HH:mm') : '—'}
                                                        </div>
                                                    </td>

                                                    {/* État de Session */}
                                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                                        {isPendingArbitration ? (
                                                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] text-[9px] font-black uppercase tracking-wider bg-red-600 text-white shadow-2xs animate-pulse">
                                                                <span className="w-3.5 h-3.5 rounded-full bg-white text-red-700 font-black text-[9px] flex items-center justify-center flex-shrink-0">!</span>
                                                                <span>À Arbitrer</span>
                                                            </span>
                                                        ) : isOpen ? (
                                                            <span className="text-gray-700 font-medium text-xs flex items-center gap-1.5">
                                                                <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                                                                <span>En cours</span>
                                                            </span>
                                                        ) : isAlreadyArbitrated ? (
                                                            <span className="text-gray-600 font-medium text-xs flex items-center gap-1">
                                                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                                                <span>Arbitrée</span>
                                                            </span>
                                                        ) : (
                                                            <span className="text-gray-600 font-medium text-xs flex items-center gap-1">
                                                                <Check className="w-3.5 h-3.5 text-gray-400" />
                                                                <span>Conforme</span>
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* Caissier */}
                                                    <td className="px-3 py-2.5">
                                                        <div className="font-bold text-[#001d35] flex items-center gap-1.5">
                                                            <User className="w-3.5 h-3.5 text-gray-400" />
                                                            <span>{session.cashierName || 'Caissier'}</span>
                                                        </div>
                                                        <div className="text-[10px] text-gray-400">ID: {session.id.slice(0, 15)}...</div>
                                                    </td>

                                                    {/* Fond initial */}
                                                    <td className="px-3 py-2.5 text-right font-medium text-gray-600">
                                                        {formatPrice(session.initialAmount || 0)}
                                                    </td>

                                                    {/* Théorique Système */}
                                                    <td className="px-3 py-2.5 text-right font-semibold text-gray-800">
                                                        {formatPrice(session.expectedAmount || 0)}
                                                    </td>

                                                    {/* Déclaré en Aveugle */}
                                                    <td className="px-3 py-2.5 text-right font-bold text-[#001d35]">
                                                        {isOpen ? (
                                                            <span className="text-gray-400 italic text-[11px] font-normal">En activité</span>
                                                        ) : (
                                                            <>
                                                                {formatPrice(session.actualAmount || 0)}
                                                                {session.breakdown?.method === 'billetage' && (
                                                                     <span className="block text-[9px] text-blue-600 font-normal">Billetage FCFA</span>
                                                                )}
                                                            </>
                                                        )}
                                                    </td>

                                                    {/* Écart Net */}
                                                    <td className="px-3 py-2.5 text-right">
                                                        {isOpen ? (
                                                            <div className="text-[11px] text-blue-600 font-semibold italic">Calcul à la clôture</div>
                                                        ) : (
                                                            <>
                                                                <span className={`inline-block px-2 py-0.5 rounded-sm text-[11px] font-bold ${
                                                                    isConform ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                                                                    isNeg ? 'bg-red-100 text-red-800 border border-red-300 animate-pulse' :
                                                                    'bg-amber-100 text-amber-800 border border-amber-300'
                                                                }`}>
                                                                    {isPos ? '+' : ''}{formatPrice(session.difference || 0)}
                                                                </span>
                                                                <div className="text-[9px] font-semibold mt-0.5" style={{ color: isNeg ? '#b91c1c' : isPos ? '#b45309' : '#15803d' }}>
                                                                    {isConform ? '✓ Caisse Juste' : isNeg ? '⚠️ Manquant' : '⚠️ Excédent'}
                                                                </div>
                                                            </>
                                                        )}
                                                    </td>

                                                    {/* Justification Caissier */}
                                                    <td className="px-3 py-2.5 max-w-[200px]">
                                                        {isOpen ? (
                                                            <span className="text-blue-500 italic text-[11px]">Session ouverte au comptoir</span>
                                                        ) : session.justification ? (
                                                            <div className="text-[11px] text-gray-700 bg-white p-1.5 rounded-sm border border-gray-200 line-clamp-2">
                                                                « {session.justification} »
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-400 italic text-[11px]">Aucune justification requise</span>
                                                        )}
                                                    </td>

                                                    {/* Visa & Statut Patron */}
                                                    <td className="px-3 py-2.5 text-center">
                                                        {isPendingArbitration ? (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] text-[10px] font-black uppercase tracking-wider bg-red-50 text-red-900 border-2 border-red-500 shadow-2xs animate-pulse">
                                                                <span className="w-4 h-4 rounded-full bg-red-600 text-white font-black text-[10px] flex items-center justify-center flex-shrink-0 shadow-xs">
                                                                    1
                                                                </span>
                                                                <span>À Arbitrer</span>
                                                            </span>
                                                        ) : isOpen ? (
                                                            <span className="text-gray-400 text-xs font-medium">En direct</span>
                                                        ) : isAlreadyArbitrated ? (
                                                            <span className="text-emerald-700 text-xs font-semibold flex items-center justify-center gap-1">
                                                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                                                                <span>
                                                                    {session.auditStatus === 'approved' ? 'Arbitré (Validé)' :
                                                                     session.auditStatus === 'payroll_deduction' ? 'Arbitré (Retenue)' :
                                                                     session.auditStatus === 'investigating' ? 'Arbitré (Enquête)' :
                                                                     session.auditStatus === 'regularized' ? 'Arbitré (Régularisé)' :
                                                                     'Arbitré'}
                                                                </span>
                                                            </span>
                                                        ) : (
                                                            <span className="text-gray-500 text-xs font-medium">
                                                                {session.auditStatus === 'approved' ? 'Validé' : 'Conforme'}
                                                            </span>
                                                        )}
                                                        {session.auditedBy && (
                                                            <div className="text-[9px] text-gray-400 font-medium mt-0.5">Par {session.auditedBy}</div>
                                                        )}
                                                    </td>

                                                    {/* Actions */}
                                                    <td className="px-3 py-2.5 text-center">
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            {isOpen ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleFilterChange(setCurrentMainTab, 'pos')}
                                                                    className="px-2.5 py-1 rounded-[4px] text-[10px] font-bold uppercase tracking-wider bg-[#001d35] hover:bg-[#f77500] text-white flex items-center justify-center gap-1 transition-all cursor-pointer shadow-2xs"
                                                                    title="Accéder au poste de caisse pour cette session"
                                                                >
                                                                    <Eye className="w-3 h-3 text-[#f77500]" />
                                                                    <span>Gérer</span>
                                                                </button>
                                                            ) : isAlreadyArbitrated ? (
                                                                <button
                                                                    type="button"
                                                                    disabled
                                                                    className="px-2.5 py-1 rounded-[4px] text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-300 cursor-not-allowed flex items-center gap-1 shadow-2xs opacity-90"
                                                                    title="Session déjà auditée et arbitrée — Décision scellée non modifiable"
                                                                >
                                                                    <Lock className="w-3 h-3 text-emerald-600" />
                                                                    <span>Arbitré</span>
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleOpenArbitration(session)}
                                                                    className={`px-2.5 py-1 rounded-[4px] text-[10px] font-extrabold uppercase tracking-wider cursor-pointer shadow-2xs transition-all flex items-center gap-1 ${
                                                                        isPendingArbitration
                                                                            ? 'bg-[#001d35] hover:bg-[#f77500] text-white ring-2 ring-red-500'
                                                                            : 'bg-white hover:bg-gray-100 border border-gray-300 text-[#001d35]'
                                                                    }`}
                                                                    title="Arbitrer la décision patronale"
                                                                >
                                                                    <ShieldAlert className={`w-3 h-3 ${isPendingArbitration ? 'text-[#f77500]' : 'text-gray-400'}`} />
                                                                    <span>Arbitrer</span>
                                                                </button>
                                                            )}
                                                            {!isOpen && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handlePrintZReport(session)}
                                                                    className="p-1 text-gray-500 hover:text-[#001d35] hover:bg-gray-100 rounded-sm transition-colors cursor-pointer"
                                                                    title="Imprimer PV Z"
                                                                >
                                                                    <Printer className="w-3.5 h-3.5" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* 3. MODALE CLÔTURE DE CAISSE EN AVEUGLE (BLIND CLOSING PROTOCOL)            */}
            {/* ========================================================================= */}
            {activeSession && showCloseModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-lg rounded-sm shadow-2xl border-t-4 border-[#001d35] overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh] relative">
                        {/* Overlay d'animation lors de la fermeture : Grand Ghost avec Loader tournant autour */}
                        {isClosingSession && (
                            <div className="absolute inset-0 bg-white/95 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
                                <div className="relative flex items-center justify-center mb-6">
                                    {/* Loader circulaire qui tourne autour de l'icône Ghost */}
                                    <div className="w-28 h-28 rounded-full border-4 border-slate-200 border-t-[#001d35] border-r-[#001d35] animate-spin"></div>
                                    
                                    {/* Pulsation en arrière-plan */}
                                    <div className="absolute inset-0 rounded-full bg-slate-100/70 animate-ping opacity-30"></div>
                                    
                                    {/* Icône Ghost en grand format au centre du loader */}
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Ghost className="w-14 h-14 text-[#001d35] animate-pulse drop-shadow-sm" />
                                    </div>
                                </div>

                                <h4 className="text-base font-black text-[#001d35] uppercase tracking-wider mb-1">
                                    Clôture de Caisse en cours...
                                </h4>
                                <p className="text-xs text-gray-500 font-medium max-w-xs leading-relaxed">
                                    Scellement du comptage physique, contrôle anti-coulage et génération du Procès-Verbal Z.
                                </p>
                            </div>
                        )}

                        {/* En-tête modale épuré avec icône Ghost agrandie */}
                        <div className="p-5 border-b border-gray-200 flex justify-between items-start bg-white flex-shrink-0">
                            <div>
                                <h3 className="text-sm sm:text-base font-bold text-[#001d35] uppercase tracking-wide flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 flex-shrink-0">
                                        <Ghost className="w-5 h-5 text-[#001d35]" />
                                    </div>
                                    <span>{blindStep === 1 ? 'Clôture de Caisse en Aveugle' : 'Bilan de Clôture & Arrêté'}</span>
                                </h3>
                                <p className="text-gray-500 text-xs mt-1 font-normal">
                                    {blindStep === 1
                                        ? 'Comptage physique strict du tiroir sans affichage du solde théorique'
                                        : 'Contrôle des écarts et justification obligatoire avant scellement'}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowCloseModal(false)}
                                className="text-gray-400 hover:text-gray-600 p-1 rounded transition-colors cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Corps modale */}
                        <form onSubmit={handleCloseSession} className="flex flex-col flex-1 overflow-hidden">
                            {/* ÉTAPE 1 : Saisie physique à l'aveugle */}
                            {blindStep === 1 && (
                                <div className="p-5 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
                                    {/* Saisie Directe Espèces (Uniquement) */}
                                    <div className="bg-slate-50/70 p-4 rounded-sm border border-slate-200">
                                        <label className="block text-xs font-bold text-[#001d35] uppercase tracking-wide mb-1.5 flex items-center justify-between">
                                            <span>Total Espèces Physiques dans le tiroir (FCFA) *</span>
                                            <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-sm border border-blue-200 uppercase">Saisie directe</span>
                                        </label>
                                        <div className="relative">
                                            <Calculator className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <FinancialInput
                                                value={countedAmountInput}
                                                onChange={(e) => setCountedAmountInput(e.target.value)}
                                                className="w-full pl-9 pr-14 py-2.5 bg-white border-2 border-gray-300 rounded-sm focus:border-[#001d35] focus:outline-none font-bold text-lg text-[#001d35]"
                                                placeholder="Ex: 50 000"
                                                required
                                                min="0"
                                                autoFocus
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-xs">FCFA</span>
                                        </div>
                                        <p className="text-[11px] text-gray-500 mt-1.5">
                                            Comptez et saisissez le montant total physique réel (billets et pièces) présent dans la caisse.
                                        </p>
                                    </div>

                                    {/* Espace Commentaires & Observations du Caissier */}
                                    <div>
                                        <label className="block text-[11px] font-bold text-[#001d35] uppercase tracking-wide mb-1.5 flex items-center justify-between">
                                            <span>Commentaires & Observations du Caissier</span>
                                            <span className="text-[10px] text-gray-400 font-normal lowercase">(libre / mentionner tout détail utile)</span>
                                        </label>
                                        <textarea
                                            rows="3"
                                            value={cashierComment}
                                            onChange={(e) => setCashierComment(e.target.value)}
                                            className="w-full px-3 py-2 bg-gray-50/50 border border-gray-300 rounded-sm focus:bg-white focus:outline-none focus:border-[#001d35] text-xs text-gray-800 placeholder-gray-400 leading-relaxed"
                                            placeholder="Mentionnez ici tout ce qui peut être utile : incidents rencontrés pendant le service, retours de monnaie particuliers, anomalies de paiement, coupures usées..."
                                        ></textarea>
                                    </div>

                                    {/* Pointage Mobile Money & Chèques (Facultatif mais utile) */}
                                    <div className="pt-2 border-t border-gray-200">
                                        <div className="text-[11px] font-bold text-gray-700 uppercase tracking-wide mb-2">
                                            Autres Modes Reçus (Contrôle terminal)
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                                                    Solde Mobile (T-Money / Moov)
                                                </label>
                                                <FinancialInput
                                                    value={mobileCountedInput}
                                                    onChange={(e) => setMobileCountedInput(e.target.value)}
                                                    className="w-full px-3 py-1.5 bg-gray-50/50 border border-gray-300 rounded-sm text-xs font-semibold text-gray-800"
                                                    placeholder="0"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                                                    Chèques / Virements
                                                </label>
                                                <FinancialInput
                                                    value={chequesCountedInput}
                                                    onChange={(e) => setChequesCountedInput(e.target.value)}
                                                    className="w-full px-3 py-1.5 bg-gray-50/50 border border-gray-300 rounded-sm text-xs font-semibold text-gray-800"
                                                    placeholder="0"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Avertissement Clôture en Aveugle */}
                                    <div className="bg-amber-50/80 p-2.5 rounded-sm border border-amber-200 flex items-start gap-2 text-xs text-amber-800">
                                        <HelpCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
                                        <span>
                                            <strong>Protocole strict :</strong> Aucun solde théorique n'est affiché. Votre déclaration physique sera comparée au système lors de la validation.
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* ÉTAPE 2 : Révélation de l'Écart & Justification Obligatoire */}
                            {blindStep === 2 && (
                                <div className="p-5 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
                                    {/* Résultat comparaison */}
                                    <div className="border border-gray-200 rounded-sm divide-y divide-gray-100 text-xs overflow-hidden">
                                        <div className="flex justify-between px-3.5 py-2.5 bg-gray-50/70">
                                            <span className="text-gray-500 font-medium">Espèces Comptées Déclarées</span>
                                            <span className="font-bold text-[#001d35]">{formatPrice(effectiveCountedCash)}</span>
                                        </div>
                                        <div className="flex justify-between px-3.5 py-2.5 bg-gray-50/70">
                                            <span className="text-gray-500 font-medium">Solde Théorique Attendu</span>
                                            <span className="font-semibold text-gray-700">{formatPrice(sessionStats.expectedAmount)}</span>
                                        </div>
                                        <div className={`flex justify-between px-3.5 py-3 font-semibold text-sm ${
                                            calculatedEcart === 0
                                                ? 'bg-emerald-50 text-emerald-800'
                                                : calculatedEcart > 0 ? 'bg-amber-50 text-amber-800' : 'bg-rose-50 text-rose-800'
                                        }`}>
                                            <span className="flex items-center gap-1.5 font-bold uppercase text-xs">
                                                {calculatedEcart === 0 ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                                                Écart de Caisse :
                                            </span>
                                            <span className="font-bold">
                                                {calculatedEcart > 0 ? '+' : ''}{formatPrice(calculatedEcart)}
                                                {' '}
                                                {calculatedEcart < 0 ? '(MANQUANT)' : calculatedEcart > 0 ? '(EXCÉDENT)' : '✓ JUSTE'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Message d'état */}
                                    {calculatedEcart === 0 ? (
                                        <div className="p-3 bg-emerald-50 text-emerald-800 rounded-sm border border-emerald-200 text-xs flex items-center gap-2">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                                            <span><strong>Félicitations !</strong> Votre caisse est parfaitement équilibrée. Aucun écart détecté.</span>
                                        </div>
                                    ) : (
                                        <div className={`p-3 rounded-sm border text-xs space-y-2 ${
                                            calculatedEcart < 0 ? 'bg-rose-50 text-rose-800 border-rose-200' : 'bg-amber-50 text-amber-800 border-amber-200'
                                        }`}>
                                            <div className="flex items-center gap-2 font-bold uppercase tracking-wide">
                                                <AlertTriangle className="w-4 h-4" />
                                                {calculatedEcart < 0 ? 'Manquant constaté dans le tiroir' : 'Excédent constaté dans le tiroir'}
                                            </div>
                                            <p className="font-normal">
                                                Cet écart sera enregistré dans le Journal d'Audit Anti-Coulage et soumis à l'arbitrage du patron.
                                            </p>
                                        </div>
                                    )}

                                    {/* Champ de justification obligatoire en cas d'écart */}
                                    {hasEcart && (
                                        <div>
                                            <label className="block text-[11px] font-bold text-rose-700 uppercase tracking-wide mb-1.5">
                                                ⚠ Justification Obligatoire de l'Écart (Pour le Patron) *
                                            </label>
                                            <textarea
                                                rows="3"
                                                value={justification}
                                                onChange={(e) => setJustification(e.target.value)}
                                                className="w-full px-3 py-2 bg-white border-2 border-rose-300 rounded-sm focus:outline-none focus:border-rose-600 text-xs text-gray-800"
                                                placeholder="Ex: Erreur rendu de monnaie sur facture comptoir #1042, client pressé..."
                                                required
                                                autoFocus
                                            ></textarea>
                                        </div>
                                    )}

                                    {/* Affichage des remarques du caissier saisies à l'étape 1 */}
                                    {cashierComment.trim() && (
                                        <div className="p-3 bg-gray-50 border border-gray-200 rounded-sm text-xs">
                                            <span className="font-bold text-gray-700 block mb-1">Commentaires / Observations du caissier :</span>
                                            <p className="text-gray-600 italic">"{cashierComment}"</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Footer modale */}
                            <div className="p-4 bg-white border-t border-gray-200 flex justify-end gap-3 flex-shrink-0">
                                {blindStep === 1 ? (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => setShowCloseModal(false)}
                                            className="px-5 py-2.5 border-2 border-gray-200 text-gray-700 font-bold uppercase tracking-wider text-xs hover:bg-gray-50 rounded-sm cursor-pointer transition-colors"
                                        >
                                            Annuler
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleConfirmBlindCount}
                                            className="px-5 py-2.5 bg-[#001d35] hover:bg-[#002d52] text-white font-bold uppercase tracking-wider text-xs rounded-sm cursor-pointer transition-colors shadow-sm flex items-center gap-2"
                                        >
                                            <ShieldAlert className="w-4 h-4 text-amber-400" />
                                            <span>Sceller le Comptage Physique</span>
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => setShowCloseModal(false)}
                                            className="px-5 py-2.5 border-2 border-gray-200 text-gray-700 font-bold uppercase tracking-wider text-xs hover:bg-gray-50 rounded-sm cursor-pointer transition-colors"
                                        >
                                            Annuler la clôture
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={isClosingSession}
                                            className="px-5 py-2.5 bg-[#001d35] hover:bg-[#002d52] disabled:opacity-70 text-white font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-2 rounded-sm cursor-pointer transition-colors shadow-sm"
                                        >
                                            <Printer className="w-4 h-4" />
                                            <span>{isClosingSession ? 'Clôture en cours...' : 'Imprimer le Z & Clôturer'}</span>
                                        </button>
                                    </>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* 4. MODALE D'ARBITRAGE PATRONAL (Visa & Retenue / Enquête Anti-Coulage)    */}
            {/* ========================================================================= */}
            {arbitrationModalSession && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-md rounded-sm shadow-2xl border-t-4 border-[#001d35] overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* En-tête */}
                        <div className="p-5 border-b border-gray-200 flex justify-between items-start bg-white flex-shrink-0">
                            <div>
                                <h3 className="text-sm sm:text-base font-bold text-[#001d35] uppercase tracking-wide flex items-center gap-2">
                                    <ShieldCheck className="w-4 h-4 text-blue-900" />
                                    Arbitrage & Visa Patronal
                                </h3>
                                <p className="text-gray-500 text-xs mt-0.5 font-normal">
                                    Contrôle hiérarchique de l'écart de caisse
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setArbitrationModalSession(null)}
                                className="text-gray-400 hover:text-gray-600 p-1 rounded transition-colors cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Corps formulaire */}
                        <form onSubmit={handleSaveArbitration}>
                            <div className="p-5 space-y-4">
                                {/* Synthèse session */}
                                <div className="bg-gray-50/80 p-3 rounded-sm border border-gray-200 space-y-1.5 text-xs">
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Caissier responsable :</span>
                                        <strong>{arbitrationModalSession.cashierName}</strong>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Attendu Système :</span>
                                        <span>{formatPrice(arbitrationModalSession.expectedAmount || 0)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Compté en Aveugle :</span>
                                        <span>{formatPrice(arbitrationModalSession.actualAmount || 0)}</span>
                                    </div>
                                    <div className="flex justify-between pt-1 border-t border-gray-200 font-bold">
                                        <span className="text-gray-700">Écart Net :</span>
                                        <span className={arbitrationModalSession.difference < 0 ? 'text-red-600' : 'text-amber-600'}>
                                            {arbitrationModalSession.difference > 0 ? '+' : ''}{formatPrice(arbitrationModalSession.difference || 0)}
                                        </span>
                                    </div>
                                    {arbitrationModalSession.justification && (
                                        <div className="pt-1.5 text-[11px] text-gray-600 border-t border-gray-200">
                                            <strong>Justification du Caissier :</strong><br/>
                                            <em>« {arbitrationModalSession.justification} »</em>
                                        </div>
                                    )}
                                </div>

                                {/* Choix Décision Patron */}
                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-700 uppercase tracking-wide mb-1.5">
                                        Décision de la Direction (Patron)
                                    </label>
                                    <select
                                        value={arbitrationStatus}
                                        onChange={(e) => setArbitrationStatus(e.target.value)}
                                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-sm text-xs font-bold text-[#001d35] focus:outline-none focus:border-[#001d35]"
                                    >
                                        <option value="approved">✓ Validé — Écart toléré / Sans suite</option>
                                        <option value="payroll_deduction">⚠ Retenue sur salaire du caissier (Déficit)</option>
                                        <option value="investigating">🔍 Enquête interne requise (Suspicion coulage)</option>
                                        <option value="regularized">🔄 Régularisé en comptabilité</option>
                                    </select>
                                </div>

                                {/* Note Patronale */}
                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-700 uppercase tracking-wide mb-1.5">
                                        Note Interne de la Direction
                                    </label>
                                    <textarea
                                        rows="2"
                                        value={arbitrationNote}
                                        onChange={(e) => setArbitrationNote(e.target.value)}
                                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-sm text-xs text-gray-800 focus:outline-none focus:border-[#001d35]"
                                        placeholder="Ex: Explication acceptée, le caissier s'est engagé à régulariser..."
                                    ></textarea>
                                </div>
                            </div>

                            {/* Actions footer */}
                            <div className="p-4 bg-white border-t border-gray-200 flex justify-end gap-3 flex-shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setArbitrationModalSession(null)}
                                    className="px-5 py-2.5 border-2 border-gray-200 text-gray-700 font-bold uppercase tracking-wider text-xs hover:bg-gray-50 rounded-sm cursor-pointer transition-colors text-center"
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2.5 bg-[#001d35] hover:bg-[#002d52] text-white font-bold uppercase tracking-wider text-xs rounded-sm cursor-pointer transition-colors shadow-sm text-center"
                                >
                                    Enregistrer l'Arbitrage
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* 5. MODALE ACTIONS DE CAISSE (Sortie / Entrée / Écrémage)                   */}
            {/* ========================================================================= */}
            {activeModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-md rounded-sm shadow-2xl border-t-4 border-[#001d35] overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Header modale */}
                        <div className="p-5 border-b border-gray-200 flex justify-between items-start bg-white flex-shrink-0">
                            <div>
                                <h3 className="text-sm sm:text-base font-bold text-[#001d35] uppercase tracking-wide">
                                    {activeModal === 'withdrawal' ? 'Sortie de Caisse' :
                                     activeModal === 'entry'     ? 'Entrée de Caisse' :
                                                                   'Écrémage vers Coffre'}
                                </h3>
                                <p className="text-gray-500 text-xs mt-0.5 font-normal">
                                    {activeModal === 'withdrawal' ? 'Enregistrement d\'une dépense en espèces' :
                                     activeModal === 'entry'     ? 'Ajout de fonds dans le tiroir de caisse' :
                                                                   'Retrait d\'espèces vers le coffre-fort'}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setActiveModal(null)}
                                className="text-gray-400 hover:text-gray-600 p-1 rounded transition-colors cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Corps modale */}
                        <form onSubmit={handleModalSubmit} className="flex flex-col">
                            <div className="p-5 space-y-4">
                                {activeModal !== 'skimming' && (
                                    <div>
                                        <label className="block text-[11px] font-semibold text-gray-700 uppercase tracking-wide mb-1.5">
                                            Motif
                                        </label>
                                        <input
                                            type="text"
                                            value={modalLabel}
                                            onChange={(e) => setModalLabel(e.target.value)}
                                            className="w-full px-3 py-2.5 bg-gray-50/50 border border-gray-300 rounded-sm focus:bg-white focus:outline-none focus:border-[#001d35] text-xs text-gray-800"
                                            placeholder={activeModal === 'entry' ? 'Ex: Approvisionnement caisse...' : 'Ex: Achat fournitures...'}
                                            required
                                        />
                                    </div>
                                )}

                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-700 uppercase tracking-wide mb-1.5">
                                        Montant (FCFA)
                                    </label>
                                    <FinancialInput
                                        value={modalAmount}
                                        onChange={(e) => setModalAmount(e.target.value)}
                                        className="w-full px-3 py-2.5 bg-gray-50/50 border border-gray-300 rounded-sm focus:bg-white focus:outline-none focus:border-[#001d35] font-semibold text-lg text-[#001d35]"
                                        placeholder="Ex: 5 000"
                                        required
                                        min="1"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100">
                                    <button
                                        type="button"
                                        onClick={() => setActiveModal(null)}
                                        className="w-full py-2.5 border-2 border-gray-200 hover:bg-gray-50 text-gray-700 font-bold uppercase tracking-wider text-xs rounded-sm cursor-pointer transition-colors text-center"
                                    >
                                        Annuler
                                    </button>
                                    <button
                                        type="submit"
                                        className="w-full py-2.5 bg-[#001d35] hover:bg-[#002d52] text-white font-bold uppercase tracking-wider text-xs rounded-sm cursor-pointer transition-colors shadow-sm text-center"
                                    >
                                        Valider
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Loader full-screen */}
            {(isOpeningSession || isClosingSession) && (
                <div className="fixed inset-0 bg-[#001d35]/70 backdrop-blur-md flex items-center justify-center z-[200] animate-in fade-in duration-150">
                    <div className="flex flex-col items-center gap-5 bg-white px-10 py-8 rounded-sm shadow-2xl border border-gray-100 max-w-sm w-full mx-4 animate-in zoom-in-95 duration-150">
                        <div className="w-14 h-14 border-4 border-[#001d35]/20 border-t-[#001d35] rounded-full animate-spin"></div>
                        <div className="text-center">
                            <p className="text-gray-900 font-bold text-base">
                                {isOpeningSession ? 'Ouverture de la caisse...' : 'Clôture en aveugle...'}
                            </p>
                            <p className="text-gray-500 text-xs mt-1 font-medium">
                                {isOpeningSession
                                    ? 'Initialisation du fond de caisse et de la session...'
                                    : 'Contrôle du tiroir, scellement et archivage au journal d\'audit...'}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Sessions;
