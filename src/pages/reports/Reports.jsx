import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSales } from '../../context/SalesContext';
import { useInventory } from '../../context/InventoryContext';
import { useSession } from '../../context/SessionContext';
import { useClients } from '../../context/ClientContext';
import { useDeliveries } from '../../context/DeliveryContext';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';
import { 
    FileText, Download, Printer, Search, ShieldAlert, 
    TrendingUp, DollarSign, Package, ShoppingCart, 
    AlertTriangle, CheckCircle2, Clock, Truck, Eye, EyeOff,
    X, Filter, Calendar, Layers, Barcode, ChevronRight,
    MessageSquare, ArrowUpRight, Award, Zap, RotateCcw,
    Check, Play, ArrowRight, ShieldCheck, ChevronDown, Users, User,
    LayoutGrid, FileSpreadsheet, Calculator, Ghost, Lock, Unlock, HelpCircle
} from 'lucide-react';
import { formatPrice } from '../../utils/currency';
import FinancialInput from '../../components/FinancialInput';
import { exportToExcel } from '../../utils/excelExport';
import T from '../../utils/toast';
import Icon360 from '../../components/Icon360';
import { useAnomalies } from '../../hooks/useAnomalies';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

/**
 * Reports.jsx
 * Cockpit Unifié & Centre de Contrôle 360° de l'ensemble des rapports du logiciel.
 * 
 * Machine d'état à 3 phases :
 * 1. 'setup'     : Écran d'accueil explicatif & sélection de la période d'analyse 360° (Aujourd'hui ou dates personnalisées).
 * 2. 'analyzing' : Scanner 360° en direct avec rotation infinie de l'icône 360°, étapes séquentielles et barre verte jusqu'à 100%.
 * 3. 'ready'     : Restitution complète du cockpit avec KPIs et rapports filtrés sur la période choisie.
 */
const Reports = () => {
    const { transactions, debts, expenses, quotes, cancelTransaction, returns, creditNotes } = useSales();
    const { products, categories: categoriesList } = useInventory();
    const { masterSessions, pastSessions, activeSession, closeSession, reviewSessionAudit } = useSession();
    const { clients } = useClients();
    const { deliveries } = useDeliveries();
    const { currentStoreId, company, stores } = useSettings();
    const { user } = useAuth();

    const storeKey = currentStoreId ? String(currentStoreId) : 'store_default';
    const currentStoreName = stores?.find(s => String(s.id) === storeKey)?.name || 'Boutique Principale';

    const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

    // ── Machine d'état de l'Analyse 360° ──
    const [analysisState, setAnalysisState]       = useState('setup'); // 'setup', 'analyzing', 'post_loader', 'success', 'ready'
    const [analysisProgress, setAnalysisProgress] = useState(0);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const timersRef = useRef([]);

    useEffect(() => {
        return () => {
            timersRef.current.forEach(t => clearTimeout(t));
        };
    }, []);

    // ── Sélection de Période ──
    const [periodType, setPeriodType]             = useState('today'); // 'today', 'yesterday', 'week', 'month', 'year', 'all', 'custom'
    const [customStartDate, setCustomStartDate]   = useState(todayStr);
    const [customEndDate, setCustomEndDate]       = useState(todayStr);

    // ── Navigation & Filtres du Cockpit ──
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [searchTerm, setSearchTerm]             = useState('');

    // ── Modale de Consultation du Rapport ──
    const [activeReportId, setActiveReportId]     = useState(null);
    const [modalLoading, setModalLoading]         = useState(false);
    const [modalFilterRange, setModalFilterRange] = useState('all'); // 'today', 'month', 'all'

    // ── Journal d'Audit Anti-Coulage (Patron & Direction) ──
    const [cashAuditFilter, setCashAuditFilter]               = useState('all'); // 'all', 'discrepancies', 'pending', 'conform'
    const [cashAuditSearchTerm, setCashAuditSearchTerm]       = useState('');
    const [cashAuditCashierFilter, setCashAuditCashierFilter] = useState('all');
    const [cashAuditScope, setCashAuditScope]                 = useState('all'); // 'all', 'period'
    const [arbitrationModalSession, setArbitrationModalSession] = useState(null);
    const [arbitrationStatus, setArbitrationStatus]           = useState('approved');
    const [arbitrationNote, setArbitrationNote]               = useState('');

    // ── Cerveau Intelligent 360° & Détecteur d'Anomalies ──
    const anomaliesData = useAnomalies();
    const [anomalyCategoryFilter, setAnomalyCategoryFilter] = useState('all');
    const [isRadarOpen, setIsRadarOpen]                     = useState(true);
    const [cockpitViewMode, setCockpitViewMode]             = useState('none'); // 'none' (par défaut pour ne pas encombrer), 'anomalies', 'reports', 'all'

    // ── Modale de Détail des Anomalies Groupées ──
    const [selectedAnomalyGroup, setSelectedAnomalyGroup]   = useState(null);
    const [groupSearchTerm, setGroupSearchTerm]             = useState('');

    // ── Modale de Clôture Administrative de Session (Cockpit 360°) ──
    const [showCloseSessionModal, setShowCloseSessionModal] = useState(false);
    const [sessionToClose, setSessionToClose]               = useState(null);
    const [closeBlindStep, setCloseBlindStep]               = useState(1);
    const [closeCountedCash, setCloseCountedCash]           = useState('');
    const [closeCashierComment, setCloseCashierComment]     = useState('');
    const [closeClosureReason, setCloseClosureReason]       = useState('Oubli de clôture du caissier (> 24h)');
    const [closeJustification, setCloseJustification]       = useState('');
    const [closeMobileAmount, setCloseMobileAmount]         = useState('');
    const [closeChequeAmount, setCloseChequeAmount]         = useState('');
    const [isClosingCockpitSession, setIsClosingCockpitSession] = useState(false);

    const filteredAnomalies = useMemo(() => {
        if (anomalyCategoryFilter === 'all') return anomaliesData.anomalies;
        return anomaliesData.anomalies.filter(a => a.category === anomalyCategoryFilter);
    }, [anomaliesData.anomalies, anomalyCategoryFilter]);

    // ── Regroupement Intelligent des Anomalies du même type en Carte Commune ──
    const groupedAnomalies = useMemo(() => {
        const groupsMap = new Map();

        (filteredAnomalies || []).forEach(ano => {
            const key = ano.type;
            if (!groupsMap.has(key)) {
                groupsMap.set(key, []);
            }
            groupsMap.get(key).push(ano);
        });

        const result = [];
        groupsMap.forEach((items, typeKey) => {
            if (items.length === 1) {
                // 1 seule anomalie : carte individuelle directe
                result.push({
                    isGroup: false,
                    ...items[0],
                    originalData: items[0]
                });
            } else {
                // 2 ou plusieurs anomalies du même type : Carte Commune Groupée !
                const first = items[0];
                const totalFinancialImpact = items.reduce((sum, item) => sum + (item.financialImpact || 0), 0);
                const isCrit = items.some(item => item.severity === 'critical');

                let groupTitle = '';
                let groupDesc = '';

                if (typeKey === 'stock_low') {
                    groupTitle = `Stocks Critiques (${items.length} produits concernés)`;
                    groupDesc = `${items.length} articles approchent ou ont franchi leur seuil d'alerte en réserve.`;
                } else if (typeKey === 'stock_out') {
                    groupTitle = `Ruptures Sèches Totales (${items.length} produits)`;
                    groupDesc = `${items.length} articles sont en rupture intégrale de stock (0 unité). Ventes compromises.`;
                } else if (typeKey === 'stock_negative') {
                    groupTitle = `Stocks Négatifs Anormaux (${items.length} produits)`;
                    groupDesc = `${items.length} articles affichent un stock négatif sous zéro. Erreur d'inventaire ou vente sans stock.`;
                } else if (typeKey === 'stock_dormant') {
                    groupTitle = `Stocks Dormants > 45j (${items.length} produits)`;
                    groupDesc = `${items.length} articles sans rotation depuis plus de 45 jours. Trésorerie immobilisée.`;
                } else if (typeKey === 'stock_excess') {
                    groupTitle = `Surstockage Dépassant les Plafonds (${items.length} produits)`;
                    groupDesc = `${items.length} articles dépassent les capacités ou plafonds de stock recommandés.`;
                } else if (typeKey === 'debt_overlimit') {
                    groupTitle = `Plafonds de Crédit Dépassés (${items.length} clients)`;
                    groupDesc = `${items.length} clients dépassent leur plafond de crédit contractuel autorisé.`;
                } else if (typeKey === 'debt_aged') {
                    groupTitle = `Créances Anciennes Impayées > 30j (${items.length} dettes)`;
                    groupDesc = `${items.length} créances clients restent non soldées depuis plus d'un mois.`;
                } else if (typeKey === 'margin_loss') {
                    groupTitle = `Ventes à Perte Détectées (${items.length} transactions)`;
                    groupDesc = `${items.length} ventes conclues à un prix inférieur au coût d'achat (marge brute négative).`;
                } else if (typeKey === 'delivery_stalled') {
                    groupTitle = `Bons de Livraison en Souffrance (${items.length} chantiers)`;
                    groupDesc = `${items.length} bons de livraison restent bloqués en attente depuis plus de 48 heures.`;
                } else if (typeKey === 'cash_deficit') {
                    groupTitle = `Déficits de Caisse / Coulages (${items.length} sessions)`;
                    groupDesc = `${items.length} clôtures aveugles révèlent un déficit d'espèces entre théorique et compté.`;
                } else if (typeKey === 'cash_surplus') {
                    groupTitle = `Surplus de Caisse Inexpliqués (${items.length} sessions)`;
                    groupDesc = `${items.length} clôtures de caisse présentent un excédent physique inexpliqué.`;
                } else {
                    groupTitle = `${first.categoryLabel} (${items.length} éléments concernés)`;
                    groupDesc = `${items.length} anomalies de type "${first.categoryLabel}" identifiées par le système.`;
                }

                result.push({
                    isGroup: true,
                    id: `group_${typeKey}`,
                    type: typeKey,
                    category: first.category,
                    categoryLabel: first.categoryLabel,
                    severity: isCrit ? 'critical' : first.severity,
                    title: groupTitle,
                    description: groupDesc,
                    financialImpact: totalFinancialImpact,
                    date: first.date,
                    actionLabel: `Consulter (${items.length} détails)`,
                    actionReportId: first.actionReportId,
                    items: items,
                    count: items.length
                });
            }
        });

        return result;
    }, [filteredAnomalies]);

    // ── Logique de Clôture Administrative de Session depuis le Cockpit ──
    const handleOpenCloseSessionModal = (session) => {
        const target = session || activeSession;
        setSessionToClose(target);
        setCloseBlindStep(1);
        setCloseCountedCash('');
        setCloseCashierComment('');
        setCloseClosureReason('Oubli de clôture du caissier (> 24h)');
        setCloseJustification('');
        setCloseMobileAmount('');
        setCloseChequeAmount('');
        setShowCloseSessionModal(true);
    };

    const targetSessionStats = useMemo(() => {
        const s = sessionToClose || activeSession;
        if (!s) return { expectedAmount: 0, totalSalesCash: 0, totalExpensesCash: 0, totalSalesCard: 0, totalSalesCheque: 0 };
        const startTime = new Date(s.startTime || s.openedAt).getTime();
        const sessionTx = (transactions || []).filter(t => {
            const matchStore = t.storeId && String(t.storeId) === storeKey;
            const tTime = new Date(t.date || t.transactionDate).getTime();
            return matchStore && tTime >= startTime;
        });

        const totalSalesCash = sessionTx
            .filter(t => t.paymentMethod === 'cash')
            .reduce((sum, t) => sum + (parseFloat(t.amountGiven) || 0) - (parseFloat(t.change) || parseFloat(t.changeAmount) || 0) || parseFloat(t.total) || parseFloat(t.totalAmount) || 0, 0);

        const totalSalesCard = sessionTx
            .filter(t => ['card', 'mobile', 'wave', 'om', 'momo'].includes(t.paymentMethod))
            .reduce((sum, t) => sum + (parseFloat(t.total) || parseFloat(t.totalAmount) || 0), 0);

        const totalSalesCheque = sessionTx
            .filter(t => ['cheque', 'check', 'virement'].includes(t.paymentMethod))
            .reduce((sum, t) => sum + (parseFloat(t.total) || parseFloat(t.totalAmount) || 0), 0);

        const sessionExpenses = (expenses || []).filter(e => {
            const matchStore = e.storeId && String(e.storeId) === storeKey;
            return matchStore && new Date(e.date).getTime() >= startTime;
        });
        const totalExpensesCash = sessionExpenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);

        const expectedAmount = (parseFloat(s.initialAmount) || 0) + totalSalesCash - totalExpensesCash;
        return { expectedAmount, totalSalesCash, totalSalesCard, totalSalesCheque, totalExpensesCash };
    }, [sessionToClose, activeSession, transactions, expenses, storeKey]);

    const effectiveCockpitCash = useMemo(() => {
        return parseFloat(String(closeCountedCash).replace(/\s+/g, '')) || 0;
    }, [closeCountedCash]);

    const calculatedCockpitEcart = useMemo(() => {
        return effectiveCockpitCash - targetSessionStats.expectedAmount;
    }, [effectiveCockpitCash, targetSessionStats.expectedAmount]);

    const handleConfirmCockpitBlindCount = () => {
        const rawVal = closeCountedCash ? String(closeCountedCash).replace(/\s+/g, '') : '';
        if (!rawVal && rawVal !== '0') {
            T.error("Veuillez renseigner le montant physique réel en espèces compté dans le tiroir.");
            return;
        }

        const cashVal = parseFloat(rawVal) || 0;
        if (cashVal <= 0) {
            if (!window.confirm("Le montant en espèces compté est de 0 FCFA. Confirmez-vous ce montant pour cet arrêté de caisse exceptionnel ?")) {
                return;
            }
        }

        const isConfirmed = window.confirm(
            "Attention : Vous réalisez une clôture administrative exceptionnelle à la place du caissier. Cette opération est définitive. Confirmez-vous ?"
        );
        if (!isConfirmed) return;

        setCloseBlindStep(2);
    };

    const handleExecuteCockpitCloseSession = (e) => {
        e.preventDefault();
        const hasEcart = Math.abs(calculatedCockpitEcart) > 0;
        if (hasEcart && !closeJustification.trim() && !closeCashierComment.trim()) {
            T.warning("Une justification obligatoire est requise pour tout écart constaté lors de la clôture.");
            return;
        }

        setIsClosingCockpitSession(true);
        setTimeout(() => {
            const closed = closeSession(
                effectiveCockpitCash,
                targetSessionStats.expectedAmount,
                targetSessionStats.totalSalesCash,
                targetSessionStats.totalExpensesCash,
                {
                    isBlind: true,
                    breakdown: {
                        method: 'administrative_cockpit',
                        cashAmount: effectiveCockpitCash,
                        mobileAmount: parseFloat(closeMobileAmount) || 0,
                        chequeAmount: parseFloat(closeChequeAmount) || 0,
                        closureReason: closeClosureReason,
                        managerComment: closeCashierComment.trim()
                    },
                    expectedBreakdown: {
                        expectedCash: targetSessionStats.expectedAmount,
                        expectedMobile: targetSessionStats.totalSalesCard,
                        expectedCheque: targetSessionStats.totalSalesCheque
                    },
                    justification: `[Clôture Administrative Direction • Motif : ${closeClosureReason}] ${closeJustification.trim() || closeCashierComment.trim() || 'Arrêté forcé par le gérant'}`,
                    cashierComment: `Clôture exceptionnelle Cockpit 360° par ${user?.firstName || 'la Direction'} (Motif : ${closeClosureReason})`,
                    auditStatus: Math.abs(calculatedCockpitEcart) === 0 ? 'approved' : 'pending_review',
                    auditNote: `Clôture administrative exceptionnelle effectuée depuis le Cockpit 360° par ${user?.firstName || 'le Manager'}`
                }
            );

            setShowCloseSessionModal(false);
            setIsClosingCockpitSession(false);
            T.success("Session clôturée avec succès et scellée au journal d'audit !");
            if (closed) {
                handlePrintZReport(closed);
            }
        }, 1800);
    };



    // Calcul de l'intervalle de date effectif
    const activeDateRange = useMemo(() => {
        const now = new Date();
        let start = null;
        let end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        let label = "Toutes les dates";

        if (periodType === 'today') {
            start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
            label = `Aujourd'hui (${now.toLocaleDateString('fr-FR')})`;
        } else if (periodType === 'yesterday') {
            const yest = new Date(now);
            yest.setDate(yest.getDate() - 1);
            start = new Date(yest.getFullYear(), yest.getMonth(), yest.getDate(), 0, 0, 0, 0);
            end = new Date(yest.getFullYear(), yest.getMonth(), yest.getDate(), 23, 59, 59, 999);
            label = `Hier (${yest.toLocaleDateString('fr-FR')})`;
        } else if (periodType === 'week') {
            const weekAgo = new Date(now);
            weekAgo.setDate(weekAgo.getDate() - 7);
            start = new Date(weekAgo.getFullYear(), weekAgo.getMonth(), weekAgo.getDate(), 0, 0, 0, 0);
            label = "7 derniers jours";
        } else if (periodType === 'month') {
            start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
            label = `Ce mois-ci (${now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })})`;
        } else if (periodType === 'year') {
            start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
            label = `Année en cours (${now.getFullYear()})`;
        } else if (periodType === 'custom') {
            if (customStartDate) {
                const [sy, sm, sd] = customStartDate.split('-').map(Number);
                start = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
            }
            if (customEndDate) {
                const [ey, em, ed] = customEndDate.split('-').map(Number);
                end = new Date(ey, em - 1, ed, 23, 59, 59, 999);
            }
            label = `Du ${new Date(start).toLocaleDateString('fr-FR')} au ${new Date(end).toLocaleDateString('fr-FR')}`;
        }

        return { start, end, label };
    }, [periodType, customStartDate, customEndDate]);

    // Lancement de l'Analyse 360° avec scanner immersif haute fidélité
    const handleStartAnalysis = () => {
        // Nettoyage d'éventuels timers précédents
        timersRef.current.forEach(t => clearTimeout(t));
        timersRef.current = [];

        setAnalysisState('analyzing');
        setAnalysisProgress(0);
        setCurrentStepIndex(0);

        const totalDuration = 7600; // 7.6 secondes pour un diagnostic réaliste et approfondi
        const intervalTime = 40; // rafraîchissement fluide toutes les 40ms
        const totalSteps = totalDuration / intervalTime;
        let stepCount = 0;

        const intervalTimer = setInterval(() => {
            stepCount++;
            const pct = Math.min(100, Math.round((stepCount / totalSteps) * 100));
            setAnalysisProgress(pct);

            const dynamicIndex = Math.min(
                ANALYSIS_STEPS.length - 1,
                Math.floor((pct / 100) * ANALYSIS_STEPS.length)
            );
            setCurrentStepIndex(dynamicIndex);

            if (stepCount >= totalSteps) {
                clearInterval(intervalTimer);

                // 1. Passage à notre Loader officiel pendant exactement 3 secondes
                const t1 = setTimeout(() => {
                    setAnalysisState('post_loader');

                    // 2. Après 3 secondes de Loader, affichage du message de réussite avec check mark
                    const t2 = setTimeout(() => {
                        setAnalysisState('success');

                        // 3. Après le message de réussite, transition fluide vers le cockpit de résultat
                        const t3 = setTimeout(() => {
                            setAnalysisState('ready');
                        }, 1500);
                        timersRef.current.push(t3);
                    }, 3000); // Exactement 3 secondes (3000ms)
                    timersRef.current.push(t2);
                }, 300);
                timersRef.current.push(t1);
            }
        }, intervalTime);
    };

    // Ouverture Modale avec Loader obligatoire de 1.5s sans texte
    const handleOpenReportModal = (reportId) => {
        setActiveReportId(reportId);
        setModalLoading(true);
        setTimeout(() => {
            setModalLoading(false);
        }, 1500);
    };

    const handleCloseReportModal = () => {
        setActiveReportId(null);
    };

    // ── Données filtrées selon la boutique et la période sélectionnée ──
    const storeTransactions = useMemo(() => {
        return transactions.filter(t => !t.storeId || String(t.storeId) === storeKey);
    }, [transactions, storeKey]);

    const periodTransactions = useMemo(() => {
        if (!activeDateRange.start) return storeTransactions;
        return storeTransactions.filter(t => {
            const d = new Date(t.date);
            return d >= activeDateRange.start && d <= activeDateRange.end;
        });
    }, [storeTransactions, activeDateRange]);

    const storeMasterSessions = useMemo(() => {
        const pool = [];
        const seen = new Set();
        [...(masterSessions || []), ...(pastSessions || [])].forEach(s => {
            if (s && s.id && !seen.has(s.id)) {
                seen.add(s.id);
                if (!s.storeId || String(s.storeId) === storeKey) {
                    // Pour le contrôle des écarts et l'audit anti-coulage, seules les sessions clôturées sont auditées
                    if (s.status === 'closed' || s.endTime || s.closedAt) {
                        pool.push(s);
                    }
                }
            }
        });
        return pool;
    }, [masterSessions, pastSessions, storeKey]);

    const periodMasterSessions = useMemo(() => {
        if (!activeDateRange.start) return storeMasterSessions;
        return storeMasterSessions.filter(s => {
            // Priorité absolue à la date de déclaration / ouverture de caisse (date métier d'exploitation)
            // Une caisse déclarée le 23 et fermée le 24 appartient à la journée du 23
            const rawDate = s.startTime || s.openedAt || s.date || s.createdAt || s.endTime || s.closedAt;
            if (!rawDate) return true;
            const d = new Date(rawDate);
            return d >= activeDateRange.start && d <= activeDateRange.end;
        });
    }, [storeMasterSessions, activeDateRange]);

    // ── Pool & KPIs du Journal d'Audit Anti-Coulage (Patron) ──
    const currentAuditPool = useMemo(() => {
        return cashAuditScope === 'period' ? periodMasterSessions : storeMasterSessions;
    }, [cashAuditScope, periodMasterSessions, storeMasterSessions]);

    const auditKPIs = useMemo(() => {
        const totalSessions = currentAuditPool.length;
        const totalLosses = currentAuditPool
            .map(s => s.difference !== undefined && s.difference !== null 
                ? (parseFloat(s.difference) || 0) 
                : ((parseFloat(s.actualAmount ?? s.totalRealDeclared) || 0) - (parseFloat(s.expectedAmount ?? s.totalTheoreticalCalculated) || 0))
            )
            .filter(diff => diff < 0)
            .reduce((sum, diff) => sum + Math.abs(diff), 0);

        const totalSurplus = currentAuditPool
            .map(s => s.difference !== undefined && s.difference !== null 
                ? (parseFloat(s.difference) || 0) 
                : ((parseFloat(s.actualAmount ?? s.totalRealDeclared) || 0) - (parseFloat(s.expectedAmount ?? s.totalTheoreticalCalculated) || 0))
            )
            .filter(diff => diff > 0)
            .reduce((sum, diff) => sum + diff, 0);

        const conformCount = currentAuditPool.filter(s => {
            const diff = s.difference !== undefined && s.difference !== null 
                ? (parseFloat(s.difference) || 0) 
                : ((parseFloat(s.actualAmount ?? s.totalRealDeclared) || 0) - (parseFloat(s.expectedAmount ?? s.totalTheoreticalCalculated) || 0));
            return Math.abs(diff) === 0;
        }).length;

        const complianceRate = totalSessions > 0 ? Math.round((conformCount / totalSessions) * 100) : 100;

        const pendingReviews = currentAuditPool.filter(s => {
            const diff = s.difference !== undefined && s.difference !== null 
                ? (parseFloat(s.difference) || 0) 
                : ((parseFloat(s.actualAmount ?? s.totalRealDeclared) || 0) - (parseFloat(s.expectedAmount ?? s.totalTheoreticalCalculated) || 0));
            return Math.abs(diff) > 0 && (!s.auditStatus || s.auditStatus === 'pending_review');
        }).length;

        return {
            totalSessions,
            totalLosses,
            totalSurplus,
            complianceRate,
            pendingReviews
        };
    }, [currentAuditPool]);

    const filteredAuditSessions = useMemo(() => {
        return currentAuditPool.filter(s => {
            const searchLower = cashAuditSearchTerm.toLowerCase();
            const matchSearch = !cashAuditSearchTerm.trim() ||
                (s.cashierName && s.cashierName.toLowerCase().includes(searchLower)) ||
                (s.userId && s.userId.toLowerCase().includes(searchLower)) ||
                (s.justification && s.justification.toLowerCase().includes(searchLower)) ||
                (s.id && s.id.toLowerCase().includes(searchLower));

            if (!matchSearch) return false;

            if (cashAuditCashierFilter !== 'all' && (s.cashierName !== cashAuditCashierFilter && s.userId !== cashAuditCashierFilter)) {
                return false;
            }

            const diff = s.difference !== undefined && s.difference !== null 
                ? (parseFloat(s.difference) || 0) 
                : ((parseFloat(s.actualAmount ?? s.totalRealDeclared) || 0) - (parseFloat(s.expectedAmount ?? s.totalTheoreticalCalculated) || 0));

            if (cashAuditFilter === 'discrepancies') return Math.abs(diff) > 0;
            if (cashAuditFilter === 'pending') return Math.abs(diff) > 0 && (!s.auditStatus || s.auditStatus === 'pending_review');
            if (cashAuditFilter === 'conform') return Math.abs(diff) === 0;

            return true;
        });
    }, [currentAuditPool, cashAuditSearchTerm, cashAuditCashierFilter, cashAuditFilter]);

    const cashierOptions = useMemo(() => {
        const set = new Set();
        currentAuditPool.forEach(s => {
            if (s.cashierName) set.add(s.cashierName);
            else if (s.userId) set.add(s.userId);
        });
        return Array.from(set);
    }, [currentAuditPool]);

    // ── Métriques Période ──
    const totalRevenue = useMemo(() => {
        return periodTransactions
            .filter(t => t.status === 'completed')
            .reduce((sum, t) => sum + (parseFloat(t.total) || 0), 0);
    }, [periodTransactions]);

    const totalProfit = useMemo(() => {
        let profit = 0;
        periodTransactions.filter(t => t.status === 'completed').forEach(t => {
            (t.items || []).forEach(item => {
                const prod = products.find(p => p.id === (item.id || item.productId));
                const buy = prod ? parseFloat(prod.purchasePrice) || 0 : 0;
                const sell = parseFloat(item.price || item.unitPrice || 0) || 0;
                const qty = parseFloat(item.quantity || 1) || 0;
                profit += (sell - buy) * qty;
            });
        });
        return Math.max(0, profit);
    }, [periodTransactions, products]);

    const marginPercent = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    // Stock & Produits Dormants
    const totalStockPurchaseValue = useMemo(() => {
        return products.reduce((sum, p) => {
            const qty = p.stockLevels?.[currentStoreId] || 0;
            return sum + (qty * (parseFloat(p.purchasePrice) || 0));
        }, 0);
    }, [products, currentStoreId]);

    const totalStockSellingValue = useMemo(() => {
        return products.reduce((sum, p) => {
            const qty = p.stockLevels?.[currentStoreId] || 0;
            return sum + (qty * (parseFloat(p.price) || 0));
        }, 0);
    }, [products, currentStoreId]);

    const lowStockCount = useMemo(() => {
        return products.filter(p => {
            const qty = p.stockLevels?.[currentStoreId] || 0;
            const min = p.minStockLevels?.[currentStoreId] || p.minStock || 0;
            return qty <= min;
        }).length;
    }, [products, currentStoreId]);

    // Produits dormants (> 45 jours sans vente)
    const dormantProducts = useMemo(() => {
        const now = new Date();
        return products.filter(p => {
            const qty = p.stockLevels?.[currentStoreId] || 0;
            if (qty <= 0) return false;

            let lastDate = null;
            storeTransactions.forEach(t => {
                if (t.status === 'completed' && t.items?.some(i => (i.id || i.productId) === p.id)) {
                    const tDate = new Date(t.date);
                    if (!lastDate || tDate > lastDate) lastDate = tDate;
                }
            });

            if (!lastDate) {
                const createdDate = p.createdAt ? new Date(p.createdAt) : null;
                if (!createdDate) return true;
                const daysSinceCreation = Math.floor((now - createdDate) / (1000 * 60 * 60 * 24));
                return daysSinceCreation >= 45;
            }

            const daysSinceLastSale = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));
            return daysSinceLastSale >= 45;
        });
    }, [products, storeTransactions, currentStoreId]);

    const dormantTotalValue = useMemo(() => {
        return dormantProducts.reduce((sum, p) => {
            const qty = p.stockLevels?.[currentStoreId] || 0;
            return sum + (qty * (parseFloat(p.purchasePrice) || 0));
        }, 0);
    }, [dormantProducts, currentStoreId]);

    // Créances & Dettes Clients
    const totalClientDebt = useMemo(() => {
        return (clients || []).reduce((sum, c) => sum + (parseFloat(c.totalDebt) || 0), 0);
    }, [clients]);

    const debtorsCount = useMemo(() => {
        return (clients || []).filter(c => (parseFloat(c.totalDebt) || 0) > 0).length;
    }, [clients]);

    // Sessions & Écarts Caisse (Calcul direct sur arrêtés réels de caisse)
    const totalCashDiscrepancy = useMemo(() => {
        return periodMasterSessions.reduce((sum, s) => {
            const diff = s.difference !== undefined && s.difference !== null
                ? (parseFloat(s.difference) || 0)
                : ((parseFloat(s.actualAmount ?? s.totalRealDeclared) || 0) - (parseFloat(s.expectedAmount ?? s.totalTheoreticalCalculated) || 0));
            return sum + diff;
        }, 0);
    }, [periodMasterSessions]);

    // ── Étapes Séquentielles d'Audit 360° avec Métriques Temps Réel ──
    const ANALYSIS_STEPS = useMemo(() => [
        { 
            id: 'anomalies_radar',
            title: "Cerveau 360° & Radar d'Anomalies Opérationnelles", 
            desc: `Contrôle algorithmique continu : recherche d'écarts de caisse, ruptures de stock, excédents dormants et créances à risque...`, 
            metricBadge: `${anomaliesData.totalCount} anomalie(s) détectée(s)`,
            icon: AlertTriangle 
        },
        { 
            id: 'cash_audit',
            title: "Audit de Caisse & Sécurisation Anti-Coulage", 
            desc: `Rapprochement de ${storeMasterSessions.length} session(s) scellée(s), contrôle aveugle des déclarations et analyse des écarts de caisse...`, 
            metricBadge: `${storeMasterSessions.length} session(s) examinée(s)`,
            icon: ShieldAlert 
        },
        { 
            id: 'sales_volume',
            title: "Activité Commerciale & Chiffre d'Affaires", 
            desc: `Recoupement chronologique de ${periodTransactions.length} vente(s), calcul du panier moyen et ventilation des paiements...`, 
            metricBadge: `${periodTransactions.length} transaction(s) analysée(s)`,
            icon: TrendingUp 
        },
        { 
            id: 'profitability',
            title: "Rentabilité Commerciale & Marges Réelles", 
            desc: `Confrontation directe prix d'achat vs vente sur ${products.length} référence(s), calcul de la marge brute et ratio de rentabilité...`, 
            metricBadge: `Taux marge : ${marginPercent.toFixed(1)}%`,
            icon: DollarSign 
        },
        { 
            id: 'inventory_health',
            title: "Bilan Patrimonial du Stock & Excédents Dormants", 
            desc: `Scan de ${products.length} articles en stock et détection des références inactives depuis plus de 45 jours...`, 
            metricBadge: `${dormantProducts.length} référence(s) dormante(s)`,
            icon: Package 
        },
        { 
            id: 'credit_debts',
            title: "Carnet de Dettes & Solvabilité Clients", 
            desc: `Examen de ${clients.length} compte(s) client(s), analyse des dépassements de plafonds autorisés et risques d'impayés...`, 
            metricBadge: `${debtorsCount} débiteur(s) audité(s)`,
            icon: Award 
        },
        { 
            id: 'logistics_bl',
            title: "Audit Logistique des Expéditions & Consolidation 360°", 
            desc: `Vérification des ${(deliveries || []).length} bon(s) de livraison, validation des réceptions chantiers et synthèse décisionnelle...`, 
            metricBadge: `${(deliveries || []).length} BL contrôlé(s)`,
            icon: Zap 
        }
    ], [anomaliesData.totalCount, storeMasterSessions, periodTransactions, products, marginPercent, dormantProducts, clients, debtorsCount, deliveries]);

    // ── Définition des 8 Grands Rapports ──
    const reportsCatalog = useMemo(() => [
        {
            id: 'cash_audit',
            title: "Rapport d'Audit Anti-Coulage & Contrôle des Écarts de Caisse",
            shortTitle: "Audit Caisse & Anti-Coulage",
            category: 'cash',
            icon: ShieldAlert,
            badge: `${periodMasterSessions.length} session(s) d'audit`,
            badgeColor: 'emerald',
            summary: "Synthèse scellée des clôtures en aveugle, analyse des manquants/excédents et arbitrages patron.",
            metricLabel: "Écart cumulé",
            metricValue: formatPrice(totalCashDiscrepancy),
            metricHighlight: totalCashDiscrepancy < 0 ? 'text-rose-600' : 'text-emerald-700',
            frequency: "À chaque clôture de session"
        },
        {
            id: 'daily_cash',
            title: "Rapport Quotidien du Journal de Caisse & Mouvements",
            shortTitle: "Journal de Caisse Quotidien",
            category: 'cash',
            icon: DollarSign,
            badge: `${periodTransactions.length} vente(s) enregistrée(s)`,
            badgeColor: 'blue',
            summary: "Flux journaliers : fond de caisse initial, encaissements comptant, dépenses, entrées et clôtures SMS/WhatsApp.",
            metricLabel: "Espèces du jour",
            metricValue: formatPrice(
                periodTransactions
                    .filter(t => t.paymentMethod === 'cash' && t.status === 'completed')
                    .reduce((sum, t) => sum + (parseFloat(t.total) || 0), 0)
            ),
            metricHighlight: 'text-[#001d35]',
            frequency: "Journalier (Fin de journée)"
        },
        {
            id: 'sales_activity',
            title: "Rapport d'Activité Commerciale & Chiffre d'Affaires",
            shortTitle: "Activité & Ventes Globales",
            category: 'sales',
            icon: TrendingUp,
            badge: `${periodTransactions.length} transaction(s)`,
            badgeColor: 'blue',
            summary: "Historique intégral des ventes, paniers moyens, ventilation des paiements (Espèces, Wave, Mobile, Chèque).",
            metricLabel: "CA Réalisé",
            metricValue: formatPrice(totalRevenue),
            metricHighlight: 'text-emerald-700',
            frequency: "Temps réel & Mensuel"
        },
        {
            id: 'profitability',
            title: "Rapport de Rentabilité Commerciale & Marges Brutes",
            shortTitle: "Rentabilité & Marges Nettes",
            category: 'sales',
            icon: Award,
            badge: `Taux Marge : ${marginPercent.toFixed(1)}%`,
            badgeColor: 'emerald',
            summary: "Analyse de la marge commerciale brute par référence, bénéfice net d'exploitation et ratios de rentabilité.",
            metricLabel: "Bénéfice estimé",
            metricValue: formatPrice(totalProfit),
            metricHighlight: 'text-emerald-600',
            frequency: "Hebdomadaire / Mensuel"
        },
        {
            id: 'inventory_valuation',
            title: "Rapport de Valorisation Globale & Bilan du Stock",
            shortTitle: "Valorisation & Bilan Stock",
            category: 'inventory',
            icon: Package,
            badge: `${products.length} articles`,
            badgeColor: 'indigo',
            summary: "Bilan patrimonial : capital immobilisé au prix d'achat vs potentiel de vente au détail par rayon.",
            metricLabel: "Capital immobilisé",
            metricValue: formatPrice(totalStockPurchaseValue),
            metricHighlight: 'text-[#001d35]',
            frequency: "Inventaire périodique"
        },
        {
            id: 'stock_alerts',
            title: "Rapport des Alertes de Stock & Produits Dormants",
            shortTitle: "Alertes & Stocks Dormants",
            category: 'inventory',
            icon: AlertTriangle,
            badge: `${lowStockCount} alerte(s) rupture`,
            badgeColor: 'rose',
            summary: "Détection des ruptures imminentes et des capitaux piégés sur les articles inactifs sans vente (stock mort).",
            metricLabel: "Capital dormant (> 45j)",
            metricValue: formatPrice(dormantTotalValue),
            metricHighlight: dormantTotalValue > 0 ? 'text-amber-600' : 'text-slate-700',
            frequency: "Audit hebdomadaire"
        },
        {
            id: 'client_debts',
            title: "Rapport du Carnet de Dettes & Créances Clients",
            shortTitle: "Créances & Balance Âgée",
            category: 'debts',
            icon: Users,
            badge: `${debtorsCount} créance(s) en cours`,
            badgeColor: 'amber',
            summary: "Balance âgée des créances, relances clients, dépassements d'encours autorisés et suivi du recouvrement.",
            metricLabel: "Total à recouvrer",
            metricValue: formatPrice(totalClientDebt),
            metricHighlight: totalClientDebt > 0 ? 'text-rose-600' : 'text-emerald-700',
            frequency: "Suivi quotidien du crédit"
        },
        {
            id: 'deliveries',
            title: "Rapport des Expéditions & Bons de Livraison (BL)",
            shortTitle: "Expéditions & Bons de Livraison",
            category: 'logistics',
            icon: Truck,
            badge: `${(deliveries || []).length} BL émis`,
            badgeColor: 'slate',
            summary: "Audit logistique : contrôle des chargements, bons livrés sur chantiers, retours et chauffeurs assignés.",
            metricLabel: "BL en attente",
            metricValue: `${(deliveries || []).filter(d => d.status !== 'delivered').length} en transit`,
            metricHighlight: 'text-[#001d35]',
            frequency: "Opérationnel quotidien"
        },
        {
            id: 'returns',
            title: "Rapport des Retours de Marchandises & Portefeuille des Avoirs",
            shortTitle: "Retours & Bons d'Avoir",
            category: 'sales',
            icon: RotateCcw,
            badge: `${(returns || []).length} retour(s) · ${(creditNotes || []).filter(c => c.status === 'active' || c.status === 'partial').length} avoir(s) actif(s)`,
            badgeColor: 'amber',
            summary: "Contrôle des réintégrations en stock, traçabilité des compensations (Avoirs, Espèces, Dettes) et audit des avaries.",
            metricLabel: "Avoirs en circulation",
            metricValue: formatPrice(
                (creditNotes || [])
                    .filter(c => c.status === 'active' || c.status === 'partial')
                    .reduce((sum, c) => sum + (c.remainingAmount || 0), 0)
            ),
            metricHighlight: 'text-[#b45309]',
            frequency: "Permanent (Service Après-Vente)"
        }
    ], [
        periodMasterSessions, totalCashDiscrepancy, periodTransactions, 
        totalRevenue, marginPercent, totalProfit, products, 
        totalStockPurchaseValue, lowStockCount, dormantTotalValue, 
        debtorsCount, totalClientDebt, deliveries, returns, creditNotes
    ]);

    // Filtrage du catalogue de rapports
    const filteredReports = useMemo(() => {
        return reportsCatalog.filter(r => {
            const matchesCat = selectedCategory === 'all' || r.category === selectedCategory;
            const matchesSearch = !searchTerm.trim() || 
                r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                r.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
                r.shortTitle.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesCat && matchesSearch;
        });
    }, [reportsCatalog, selectedCategory, searchTerm]);

    // Clôture Rapide WhatsApp
    const handleSMSReport = () => {
        const dateStr = new Date().toLocaleDateString('fr-FR');
        const msg = `*KABLLIX - CLÔTURE CAISSE 360°*\n` +
            `📅 Date : ${dateStr}\n` +
            `🏪 Boutique : ${currentStoreName}\n` +
            `------------------------\n` +
            `💰 Chiffre d'Affaires : ${formatPrice(totalRevenue)}\n` +
            `📈 Marge Estimée : ${formatPrice(totalProfit)} (${marginPercent.toFixed(1)}%)\n` +
            `🧾 Ventes : ${periodTransactions.length}\n` +
            `👥 Créances Totales : ${formatPrice(totalClientDebt)}\n` +
            `📦 Capital Stock : ${formatPrice(totalStockPurchaseValue)}\n` +
            `⚠️ Alertes Ruptures : ${lowStockCount}\n` +
            `🛡️ Écart Caisse : ${formatPrice(totalCashDiscrepancy)}\n` +
            `------------------------\n` +
            `Kabllix ERP - Diagnostic Certifié`;

        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
        T.success("Rapport synthétique prêt pour WhatsApp !");
    };

    // Export Excel Général
    const handleGlobalExcelExport = () => {
        const rows = periodTransactions.map(t => ({
            'ID Transaction': t.id,
            'Type': 'Vente',
            'Date': new Date(t.date).toLocaleString('fr-FR'),
            'Description': `Vente ${t.items?.length || 0} article(s)`,
            'Montant': t.total || 0,
            'Mode de Paiement': t.paymentMethod || 'Espèces',
            'Statut': t.status
        }));
        const filename = `Kabllix_Analyse_360_${todayStr}`;
        exportToExcel(rows, filename, 'Transactions 360');
        T.export(`${rows.length} transaction(s) exportée(s) au format Excel (.xlsx)`);
    };

    // ── Arbitrage Patron ──
    const handleOpenArbitration = (session) => {
        const isAlreadyArbitrated = Boolean(session.auditedAt || (session.auditStatus && session.auditStatus !== 'pending_review'));
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

        const diff = session.difference !== undefined && session.difference !== null
            ? (parseFloat(session.difference) || 0)
            : ((parseFloat(session.actualAmount ?? session.totalRealDeclared) || 0) - (parseFloat(session.expectedAmount ?? session.totalTheoreticalCalculated) || 0));

        const isDiscrepant = Math.abs(diff) > 0;
        const diffText = diff > 0 ? `+${formatPrice(diff)} (EXCÉDENT)` :
                         diff < 0 ? `-${formatPrice(Math.abs(diff))} (MANQUANT)` :
                         '0 FCFA (PARFAITEMENT CONFORME)';

        const rawStart = session.startTime || session.date || session.openedAt || new Date().toISOString();
        const rawEnd = session.endTime || session.closedAt;

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
        .dashboard-toolbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #ffffff;
            padding: 8px 14px;
            border: 2px solid #d1d5db;
            border-radius: 4px;
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
        .badge-store { background: #f1f5f9; color: #001d35; border: 1px solid #cbd5e1; }
        .badge-confidential { background: #991b1b; color: #ffffff; }
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

    <div class="title-banner">
        <div class="title-eyebrow">Rapport d'Audit Anti-Coulage & Contrôle des Écarts de Caisse</div>
        <h1 class="title-main">Procès-Verbal de Clôture Définitive (Ticket Z)</h1>
        <div class="title-sub">Arrêté légal des comptes, scellement physique en aveugle et visa hiérarchique.</div>
    </div>

    <div class="verdict-bar">
        <div>
            <div style="font-size: 10.5px; font-weight: 700; text-transform: uppercase; color: #4b5563;">Résultat du Contrôle de Caisse :</div>
            <div style="font-size: 12px; font-weight: 700; color: #001d35; margin-top: 2px;">
                ${isDiscrepant ? (diff < 0 ? '⚠️ Manquant constaté dans le tiroir' : '⚠️ Excédent inexpliqué constaté') : '✓ Caisse parfaitement conforme'}
            </div>
        </div>
        <div class="verdict-pill ${diff < 0 ? 'neg' : diff > 0 ? 'pos' : 'zero'}">
            ${diffText}
        </div>
    </div>

    <div class="grid-2">
        <div class="dashboard-box">
            <div class="box-title">1. Informations de la Session</div>
            <div class="row"><span>ID Session :</span><strong style="font-size: 10px;">${session.id}</strong></div>
            <div class="row"><span>Caissier(e) :</span><strong>${session.cashierName || session.userId || 'Non renseigné'}</strong></div>
            <div class="row"><span>Boutique :</span><span>${currentStoreName}</span></div>
            <div class="row"><span>Ouverture :</span><span>${new Date(rawStart).toLocaleString('fr-FR')}</span></div>
            <div class="row"><span>Clôture :</span><span>${rawEnd ? new Date(rawEnd).toLocaleString('fr-FR') : 'En cours'}</span></div>
            <div class="row"><span>Mécanisme :</span><strong style="color: #001d35;">CLÔTURE EN AVEUGLE</strong></div>
        </div>

        <div class="dashboard-box">
            <div class="box-title">2. Synthèse Financière Système</div>
            <div class="row"><span>Fond de Caisse Initial :</span><span class="mono">${formatPrice(session.initialAmount || session.initialCash || 0)}</span></div>
            <div class="row"><span>Ventes Espèces :</span><span class="mono" style="color: #059669;">+${formatPrice(session.totalSales || 0)}</span></div>
            <div class="row"><span>Dépenses / Sorties :</span><span class="mono" style="color: #dc2626;">−${formatPrice(session.totalExpenses || 0)}</span></div>
            <div class="row total"><span>Solde Théorique Attendu :</span><strong class="mono" style="color: #001d35;">${formatPrice(session.expectedAmount || session.totalTheoreticalCalculated || 0)}</strong></div>
        </div>
    </div>

    <div class="dashboard-box" style="margin-bottom: 14px;">
        <div class="box-title">3. Déclaration Physique du Caissier (Saisie Scellée)</div>
        <div class="row" style="font-size: 13px; padding: 4px 0;">
            <span style="font-weight: 700; color: #001d35;">Espèces Physiquement Comptées :</span>
            <strong class="mono" style="font-size: 15px; color: #001d35;">${formatPrice(session.actualAmount || session.totalRealDeclared || 0)}</strong>
        </div>
        <div class="row" style="border-top: 1px dashed #e2e8f0; padding-top: 6px; margin-top: 4px;">
            <span style="font-weight: 700;">Écart Net Réel (Compté − Attendu) :</span>
            <strong class="mono" style="font-size: 13px; color: ${diff < 0 ? '#b91c1c' : diff > 0 ? '#b45309' : '#15803d'}">${diffText}</strong>
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
                    Visé par <strong>${session.auditedBy}</strong> le ${new Date(session.auditedAt || Date.now()).toLocaleString('fr-FR')}
                </div>
            ` : ''}
        </div>
    ` : ''}

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
        setTimeout(() => printWindow.print(), 300);
    };

    // ── Impression du Rapport Global Anti-Coulage A4 pour le Patron ──
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
        .dashboard-toolbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #ffffff;
            padding: 8px 14px;
            border: 2px solid #d1d5db;
            border-radius: 4px;
            box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
            font-size: 11.5px;
            font-weight: 600;
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
            border-radius: 4px;
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.03em;
        }
        .badge-store { background: #f1f5f9; color: #001d35; border: 1px solid #cbd5e1; }
        .badge-confidential { background: #991b1b; color: #ffffff; }
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
        .dashboard-filter-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #ffffff;
            padding: 8px 12px;
            border: 2px solid #d1d5db;
            border-radius: 4px;
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
        .filter-meta strong { color: #001d35; }
        .kpi-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            margin-bottom: 14px;
        }
        .dashboard-statcard {
            background: #ffffff;
            border: 2px solid #d1d5db;
            border-radius: 4px;
            padding: 12px 14px;
            box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
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
            font-weight: 600;
            letter-spacing: 0.025em;
            text-transform: uppercase;
            color: rgba(37, 99, 235, 0.75);
        }
        .statcard-badge {
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
            padding: 2px 6px;
            border-radius: 4px;
        }
        .statcard-val {
            font-family: 'JetBrains Mono', monospace;
            font-size: 21px;
            font-weight: 600;
            letter-spacing: -0.01em;
            line-height: 1.2;
            margin: 4px 0 2px 0;
            opacity: 0.88;
        }
        .statcard-sub {
            font-size: 11px;
            color: #9ca3af;
            font-weight: 500;
            margin-top: 4px;
        }
        .table-container {
            background: #ffffff;
            border: 2px solid #d1d5db;
            border-radius: 4px;
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
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.025em;
            color: rgba(37, 99, 235, 0.75);
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
        thead { background: #001d35; }
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
        tbody tr { border-bottom: 1px solid #e5e7eb; }
        tbody tr:nth-child(even) { background: #f9fafb; }
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
            border-radius: 4px;
        }
        .diff-pill.neg { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
        .diff-pill.pos { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
        .diff-pill.zero { background: #d1fae5; color: #065f46; border: 1px solid #86efac; }
        .status-pill {
            display: inline-block;
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            padding: 2.5px 7px;
            border-radius: 4px;
        }
        .status-pill.approved { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
        .status-pill.payroll { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
        .status-pill.investigating { background: #fffbeb; color: #92400e; border: 1px solid #fde68a; }
        .status-pill.pending { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }
        .signatures-container {
            background: #ffffff;
            border: 2px solid #d1d5db;
            border-radius: 4px;
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

    <div class="title-banner">
        <div class="title-eyebrow">
            <span>Direction Générale · Contrôle Financier des Tiroirs de Caisse</span>
        </div>
        <h1 class="title-main">Rapport d'Audit Anti-Coulage & Contrôle des Écarts de Caisse</h1>
        <div class="title-sub">
            Grand livre officiel des clôtures physiques à l'aveugle, détection des anomalies de caisse et traçabilité des arbitrages patronaux.
        </div>
    </div>

    <div class="dashboard-filter-bar">
        <div class="filter-tab-group">
            <span class="filter-tab active">Sessions Auditées (${currentAuditPool.length})</span>
            <span class="filter-tab" style="color: #6b7280;">${currentStoreName}</span>
        </div>
        <div class="filter-meta">
            Édité le <strong>${dateFormatted}</strong> &nbsp;·&nbsp; Registre : <strong>${currentAuditPool.length} session(s) auditée(s)</strong>
        </div>
    </div>

    <div class="kpi-grid">
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

    <div class="table-container">
        <div class="table-top-bar">
            <span class="table-top-title">Grand Livre des Écarts & Arbitrages Patronaux</span>
            <span class="table-count-badge">${currentAuditPool.length} session(s) répertoriée(s)</span>
        </div>
        <table>
            <thead>
                <tr>
                    <th>Date & Heure</th>
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
                ${currentAuditPool.length === 0 ? `
                    <tr>
                        <td colspan="8" style="padding: 30px; text-align: center; color: #94a3b8; font-weight: 500;">
                            Aucune session de caisse clôturée enregistrée pour cette sélection.
                        </td>
                    </tr>
                ` : currentAuditPool.map(s => {
                    const diff = s.difference !== undefined && s.difference !== null 
                        ? (parseFloat(s.difference) || 0) 
                        : ((parseFloat(s.actualAmount ?? s.totalRealDeclared) || 0) - (parseFloat(s.expectedAmount ?? s.totalTheoreticalCalculated) || 0));
                    const isNeg = diff < 0;
                    const isPos = diff > 0;
                    const isConform = Math.abs(diff) === 0;
                    const sStart = s.startTime || s.date || s.openedAt || new Date().toISOString();

                    return `
                    <tr>
                        <td style="white-space: nowrap;">
                            <div style="font-weight: 700; color: #0f172a;">
                                ${new Date(sStart).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </div>
                            <div style="font-size: 10px; color: #64748b; font-family: 'JetBrains Mono', monospace;">
                                ${new Date(sStart).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} ➔ ${s.endTime || s.closedAt ? new Date(s.endTime || s.closedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}
                            </div>
                        </td>
                        <td>
                            <div style="font-weight: 700; color: #001d35;">${s.cashierName || s.userId || 'Caissier'}</div>
                            <div style="font-size: 9.5px; color: #94a3b8; font-family: 'JetBrains Mono', monospace;">ID: ${s.id.slice(0, 14)}...</div>
                        </td>
                        <td class="text-right mono" style="color: #475569;">
                            ${formatPrice(s.initialAmount || s.initialCash || 0)}
                        </td>
                        <td class="text-right mono" style="font-weight: 700; color: #0f172a;">
                            ${formatPrice(s.expectedAmount || s.totalTheoreticalCalculated || 0)}
                        </td>
                        <td class="text-right mono" style="font-weight: 700; color: #001d35;">
                            ${formatPrice(s.actualAmount || s.totalRealDeclared || 0)}
                        </td>
                        <td class="text-right">
                            <span class="diff-pill ${isConform ? 'zero' : isNeg ? 'neg' : 'pos'}">
                                ${isPos ? '+' : ''}${formatPrice(diff)}
                            </span>
                            <div style="font-size: 8.5px; font-weight: 700; text-transform: uppercase; margin-top: 2px; color: ${isNeg ? '#b91c1c' : isPos ? '#b45309' : '#15803d'};">
                                ${isConform ? '✓ Caisse Juste' : isNeg ? '⚠️ Manquant' : '⚠️ Excédent'}
                            </div>
                        </td>
                        <td style="max-width: 220px;">
                            ${s.justification ? `
                                <div style="font-size: 10.5px; color: #334155; font-style: italic; background: #ffffff; padding: 4px 6px; border: 1px solid #e2e8f0; border-radius: 4px;">
                                    « ${s.justification} »
                                </div>
                            ` : `<span style="color: #94a3b8; font-style: italic; font-size: 10.5px;">Aucune anomalie déclarée</span>`}
                        </td>
                        <td class="text-center">
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
                            ${s.auditedBy ? `<div style="font-size: 9px; color: #94a3b8; margin-top: 2px;">Par ${s.auditedBy}</div>` : ''}
                        </td>
                    </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    </div>

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

    // Moteur d'impression A4 Officiel
    const handlePrintReport = (report) => {
        if (report.id === 'cash_audit') {
            handlePrintAuditSummaryReport();
            return;
        }

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            T.error("Veuillez autoriser les fenêtres pop-up pour imprimer.");
            return;
        }

        const dateStr = new Date().toLocaleDateString('fr-FR', {
            year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>${report.title} - Kabllix ERP</title>
    <style>
        @page { size: A4 portrait; margin: 12mm 15mm; }
        body { font-family: 'Inter', -apple-system, sans-serif; color: #1e293b; margin: 0; padding: 0; font-size: 11px; }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #001d35; padding-bottom: 12px; margin-bottom: 16px; }
        .company-name { font-size: 18px; font-weight: 900; color: #001d35; text-transform: uppercase; }
        .report-title { font-size: 15px; font-weight: 800; color: #001d35; margin-top: 4px; text-transform: uppercase; }
        .meta-box { background: #f8fafc; border: 1px solid #cbd5e1; padding: 10px; margin-bottom: 16px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .meta-item { display: flex; flex-direction: column; }
        .meta-label { font-size: 9px; font-weight: bold; color: #64748b; text-transform: uppercase; }
        .meta-value { font-size: 13px; font-weight: 800; color: #001d35; margin-top: 2px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10px; }
        th { background: #001d35; color: white; text-align: left; padding: 6px 8px; font-size: 9px; text-transform: uppercase; }
        td { border-bottom: 1px solid #e2e8f0; padding: 6px 8px; }
        tr:nth-child(even) { background: #f8fafc; }
        .footer { margin-top: 30px; display: flex; justify-content: space-between; border-top: 1px dashed #94a3b8; padding-top: 15px; }
        .sign-box { width: 200px; text-align: center; border-top: 1px solid #001d35; padding-top: 6px; font-weight: bold; }
    </style>
</head>
<body>
    <div class="header">
        <div>
            <div class="company-name">${company?.name || 'QUINKAILLERIE KABLLIX'}</div>
            <div style="font-size: 10px; color: #64748b;">${company?.address || 'Lomé, Togo'} • Tel: ${company?.phone || '+228 90 00 00 00'}</div>
            <div class="report-title">${report.title}</div>
            <div style="font-size: 10px; color: #f77500; font-weight: bold; margin-top: 2px;">Période : ${activeDateRange.label}</div>
        </div>
        <div style="text-align: right;">
            <div style="font-size: 11px; font-weight: bold; color: #001d35;">BOUTIQUE : ${currentStoreName}</div>
            <div style="font-size: 9px; color: #64748b; margin-top: 2px;">Émis le : ${dateStr}</div>
            <div style="font-size: 9px; color: #64748b;">Opérateur : ${user?.name || user?.username || 'Direction'}</div>
        </div>
    </div>

    <div class="meta-box">
        <div class="meta-item">
            <span class="meta-label">${report.metricLabel}</span>
            <span class="meta-value">${report.metricValue}</span>
        </div>
        <div class="meta-item">
            <span class="meta-label">Période Analysée</span>
            <span class="meta-value" style="font-size: 11px;">${activeDateRange.label}</span>
        </div>
        <div class="meta-item">
            <span class="meta-label">Transactions Analysées</span>
            <span class="meta-value">${periodTransactions.length}</span>
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th>Réf. / Date</th>
                <th>Détails & Nature</th>
                <th>Moyen Règlement</th>
                <th style="text-align: right;">Montant Total</th>
                <th style="text-align: center;">Statut</th>
            </tr>
        </thead>
        <tbody>
            ${periodTransactions.slice(0, 50).map(t => `
                <tr>
                    <td><strong>#${t.id}</strong><br><span style="color:#64748b;">${new Date(t.date).toLocaleDateString('fr-FR')}</span></td>
                    <td>${(t.items || []).map(i => `${i.name} (x${i.quantity})`).join(', ') || 'Vente comptoir'}</td>
                    <td style="text-transform: uppercase; font-weight: bold;">${t.paymentMethod || 'Espèces'}</td>
                    <td style="text-align: right; font-weight: bold; font-family: monospace;">${formatPrice(t.total)}</td>
                    <td style="text-align: center;">${t.status === 'completed' ? 'Validé' : 'Annulé'}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>

    <div class="footer">
        <div style="font-size: 9px; color: #64748b;">
            Kabllix Reporting Engine • Document officiel généré pour audit et archivage légal.
        </div>
        <div class="sign-box">
            Visa Direction & Signature
        </div>
    </div>

    <script>
        window.onload = function() { window.print(); }
    </script>
</body>
</html>
        `;

        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
    };

    const activeReportObj = reportsCatalog.find(r => r.id === activeReportId);

    // =========================================================================
    // ── VUE 1 : ÉCRAN D'ACCUEIL & CONFIGURATION DE L'ANALYSE 360° ──
    // =========================================================================
    if (analysisState === 'setup') {
        return (
            <div className="max-w-4xl mx-auto space-y-6 py-4 animate-in fade-in duration-200">
                {/* Carte de Présentation Haute Visibilité */}
                <div className="bg-white border-2 border-[#001d35] rounded-sm p-6 sm:p-8 shadow-xl relative overflow-hidden">
                    {/* Accent décoratif orange Kabllix */}
                    <div className="absolute -top-12 -right-12 w-48 h-48 bg-orange-500/10 rounded-full blur-2xl pointer-events-none"></div>

                    {/* Logo & Icône 360° Grand Format */}
                    <div className="text-center space-y-3">
                        <div className="inline-flex p-3 bg-slate-50 border-2 border-slate-300 rounded-sm shadow-sm">
                            <Icon360 className="w-20 h-12 text-[#001d35]" />
                        </div>
                        <p className="text-[11px] font-bold text-blue-600/80 uppercase tracking-widest">
                            Intelligence & Diagnostic Décisionnel Kabllix
                        </p>
                        <h1 className="text-2xl sm:text-3xl font-black text-[#001d35] tracking-tight uppercase">
                            Centre d'Analyse 360° de votre Entreprise
                        </h1>
                        <p className="text-sm text-slate-600 max-w-2xl mx-auto leading-relaxed">
                            L'analyse 360° offre au dirigeant une vision intégrale et sans concession de la santé de son commerce.
                            Elle croise en temps réel vos flux de <strong>caisse en aveugle</strong> (détection des écarts et coulages), 
                            la <strong>rentabilité brute</strong> de vos ventes, le <strong>bilan patrimonial des stocks</strong> (détection des articles dormants immobilisant la trésorerie), 
                            la solvabilité des <strong>créances clients</strong> et le suivi des <strong>expéditions chantiers</strong>.
                        </p>

                        {/* ── Bannière Live du Cerveau Intelligent 360° ── */}
                        {anomaliesData.totalCount > 0 && (
                            <div className="mt-4 p-3.5 bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-400 rounded-[4px] text-left flex items-start sm:items-center justify-between gap-3 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-[#001d35] text-[#f77500] rounded-sm flex-shrink-0 shadow-sm">
                                        <AlertTriangle className="w-5 h-5 animate-pulse" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-bold text-xs text-[#001d35] uppercase tracking-wider">
                                                Cerveau Intelligent 360° Connecté
                                            </span>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase tracking-wide text-white shadow-xs ${
                                                anomaliesData.criticalCount > 0 ? 'bg-rose-600 animate-pulse' : 'bg-[#f77500]'
                                            }`}>
                                                {anomaliesData.totalCount} anomalie(s) active(s)
                                            </span>
                                            {anomaliesData.criticalCount > 0 && (
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase bg-red-950/90 text-rose-300 border border-red-700/80">
                                                    {anomaliesData.criticalCount} critique(s)
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-600 mt-1 font-medium leading-relaxed">
                                            {anomaliesData.criticalCount > 0 
                                                ? `Attention : ${anomaliesData.criticalCount} anomalie(s) critique(s) nécessitent votre arbitrage (écarts de caisse, ruptures ou créances dépassées).`
                                                : `Des signaux opérationnels ont été détectés en continu (stocks bas, excédents dormants ou retards).`}
                                        </p>
                                    </div>
                                </div>
                                {anomaliesData.totalFinancialRisk > 0 && (
                                    <div className="text-right flex-shrink-0 hidden sm:block">
                                        <span className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">Risque estimé</span>
                                        <span className="text-xs font-bold text-rose-700 bg-white px-2.5 py-1 border-2 border-rose-300 rounded-sm shadow-xs inline-block mt-0.5 tracking-tight">
                                            {formatPrice(anomaliesData.totalFinancialRisk)}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ── Sélecteur d'Intervalle de Date ── */}
                    <div className="mt-8 pt-6 border-t-2 border-gray-200 space-y-4">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <span className="text-xs font-bold text-[#001d35] uppercase tracking-wider flex items-center gap-1.5">
                                <Calendar className="w-4 h-4 text-[#f77500]" />
                                Choisissez la période d'analyse :
                            </span>
                            <span className="text-[11px] font-semibold text-gray-500">
                                Période sélectionnée : <strong className="text-[#001d35]">{activeDateRange.label}</strong>
                            </span>
                        </div>

                        {/* Grand Bouton Rapide : AUJOURD'HUI */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <button
                                type="button"
                                onClick={() => setPeriodType('today')}
                                className={`sm:col-span-3 p-4 border-2 rounded-sm transition-all flex items-center justify-between cursor-pointer shadow-sm ${
                                    periodType === 'today'
                                        ? 'bg-[#001d35] text-white border-[#001d35] ring-2 ring-orange-500/40'
                                        : 'bg-white hover:bg-gray-50 text-gray-800 border-gray-300'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-sm ${periodType === 'today' ? 'bg-[#f77500] text-white' : 'bg-gray-100 text-[#001d35]'}`}>
                                        <Zap className="w-5 h-5" />
                                    </div>
                                    <div className="text-left">
                                        <p className="font-bold text-sm uppercase tracking-wide">
                                            Aujourd'hui ({new Date().toLocaleDateString('fr-FR')})
                                        </p>
                                        <p className={`text-xs ${periodType === 'today' ? 'text-white/80' : 'text-gray-500'}`}>
                                            Audit instantané en direct de la journée en cours
                                        </p>
                                    </div>
                                </div>
                                <span className={`text-xs font-bold px-3 py-1 uppercase rounded-sm ${
                                    periodType === 'today' ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-600'
                                }`}>
                                    Recommandé
                                </span>
                            </button>

                            {/* Autres Périodes Prédéfinies */}
                            <button
                                type="button"
                                onClick={() => setPeriodType('yesterday')}
                                className={`p-3 border-2 rounded-sm font-bold text-xs uppercase tracking-wider cursor-pointer transition-all ${
                                    periodType === 'yesterday'
                                        ? 'bg-[#001d35] text-white border-[#001d35]'
                                        : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300'
                                }`}
                            >
                                Hier
                            </button>

                            <button
                                type="button"
                                onClick={() => setPeriodType('week')}
                                className={`p-3 border-2 rounded-sm font-bold text-xs uppercase tracking-wider cursor-pointer transition-all ${
                                    periodType === 'week'
                                        ? 'bg-[#001d35] text-white border-[#001d35]'
                                        : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300'
                                }`}
                            >
                                7 Derniers Jours
                            </button>

                            <button
                                type="button"
                                onClick={() => setPeriodType('month')}
                                className={`p-3 border-2 rounded-sm font-bold text-xs uppercase tracking-wider cursor-pointer transition-all ${
                                    periodType === 'month'
                                        ? 'bg-[#001d35] text-white border-[#001d35]'
                                        : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300'
                                }`}
                            >
                                Ce Mois-ci
                            </button>

                            <button
                                type="button"
                                onClick={() => setPeriodType('year')}
                                className={`p-3 border-2 rounded-sm font-bold text-xs uppercase tracking-wider cursor-pointer transition-all ${
                                    periodType === 'year'
                                        ? 'bg-[#001d35] text-white border-[#001d35]'
                                        : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300'
                                }`}
                            >
                                Année en cours
                            </button>

                            <button
                                type="button"
                                onClick={() => setPeriodType('all')}
                                className={`p-3 border-2 rounded-sm font-bold text-xs uppercase tracking-wider cursor-pointer transition-all ${
                                    periodType === 'all'
                                        ? 'bg-[#001d35] text-white border-[#001d35]'
                                        : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300'
                                }`}
                            >
                                Tout l'Historique
                            </button>

                            <button
                                type="button"
                                onClick={() => setPeriodType('custom')}
                                className={`p-3 border-2 rounded-sm font-bold text-xs uppercase tracking-wider cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
                                    periodType === 'custom'
                                        ? 'bg-[#001d35] text-white border-[#001d35]'
                                        : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300'
                                }`}
                            >
                                <Filter className="w-3.5 h-3.5 text-[#f77500]" />
                                Personnalisé
                            </button>
                        </div>

                        {/* Saisie Dates Personnalisées */}
                        {periodType === 'custom' && (
                            <div className="p-4 bg-gray-50/70 border-2 border-gray-300 rounded-sm grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in duration-150">
                                <div>
                                    <label className="block text-[11px] font-bold text-[#001d35] uppercase tracking-wider mb-1">
                                        Date de Début
                                    </label>
                                    <input
                                        type="date"
                                        value={customStartDate}
                                        onChange={(e) => setCustomStartDate(e.target.value)}
                                        className="w-full px-3 py-2 bg-white border-2 border-gray-300 rounded-sm text-xs font-semibold focus:border-[#001d35] outline-none shadow-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-[#001d35] uppercase tracking-wider mb-1">
                                        Date de Fin
                                    </label>
                                    <input
                                        type="date"
                                        value={customEndDate}
                                        onChange={(e) => setCustomEndDate(e.target.value)}
                                        className="w-full px-3 py-2 bg-white border-2 border-gray-300 rounded-sm text-xs font-semibold focus:border-[#001d35] outline-none shadow-sm"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── Bouton d'Action Phare : LANCER L'ANALYSE 360° ── */}
                    <div className="mt-8">
                        <button
                            type="button"
                            onClick={handleStartAnalysis}
                            className="w-full py-4 bg-[#001d35] hover:bg-blue-900 text-white rounded-sm font-bold text-base uppercase tracking-wider flex items-center justify-center gap-3 transition-all cursor-pointer shadow-lg active:scale-[0.99] border-2 border-[#001d35] group"
                        >
                            <Icon360 className="w-10 h-6 text-white group-hover:scale-105 transition-transform" />
                            <span>Lancer l'Analyse 360°</span>
                            <ChevronRight className="w-5 h-5 text-[#f77500] group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>
                </div>

                {/* 4 Piliers Fondamentaux de l'Analyse 360° */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="bg-white p-4 border-2 border-gray-300 rounded-[4px] shadow-sm hover:shadow-md hover:border-[#001d35] transition-all space-y-1.5">
                        <div className="w-8 h-8 rounded-sm bg-blue-50 text-blue-700 flex items-center justify-center mb-2">
                            <ShieldAlert className="w-4 h-4" />
                        </div>
                        <h3 className="font-bold text-xs uppercase text-[#001d35]">Audit Anti-Coulage</h3>
                        <p className="text-[11px] text-gray-500 leading-relaxed font-normal">
                            Contrôle rigoureux des caisses, déclarations aveugles et neutralisation immédiate des écarts.
                        </p>
                    </div>

                    <div className="bg-white p-4 border-2 border-gray-300 rounded-[4px] shadow-sm hover:shadow-md hover:border-[#001d35] transition-all space-y-1.5">
                        <div className="w-8 h-8 rounded-sm bg-emerald-50 text-emerald-700 flex items-center justify-center mb-2">
                            <TrendingUp className="w-4 h-4" />
                        </div>
                        <h3 className="font-bold text-xs uppercase text-[#001d35]">Marges & Rentabilité</h3>
                        <p className="text-[11px] text-gray-500 leading-relaxed font-normal">
                            Calcul automatique de la rentabilité réelle par produit et ventilation par mode de règlement.
                        </p>
                    </div>

                    <div className="bg-white p-4 border-2 border-gray-300 rounded-[4px] shadow-sm hover:shadow-md hover:border-[#001d35] transition-all space-y-1.5">
                        <div className="w-8 h-8 rounded-sm bg-amber-50 text-amber-700 flex items-center justify-center mb-2">
                            <Package className="w-4 h-4" />
                        </div>
                        <h3 className="font-bold text-xs uppercase text-[#001d35]">Stocks Dormants</h3>
                        <p className="text-[11px] text-gray-500 leading-relaxed font-normal">
                            Identification chirurgicale des articles sans rotation depuis plus de 45 jours et valorisation.
                        </p>
                    </div>

                    <div className="bg-white p-4 border-2 border-gray-300 rounded-[4px] shadow-sm hover:shadow-md hover:border-[#001d35] transition-all space-y-1.5">
                        <div className="w-8 h-8 rounded-sm bg-purple-50 text-purple-700 flex items-center justify-center mb-2">
                            <Truck className="w-4 h-4" />
                        </div>
                        <h3 className="font-bold text-xs uppercase text-[#001d35]">Dettes & Expéditions</h3>
                        <p className="text-[11px] text-gray-500 leading-relaxed font-normal">
                            Suivi du carnet des débiteurs, relances directes et statut des bons de livraison sur chantiers.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // =========================================================================
    // ── VUE 2 : EXPÉRIENCE DE SCANNER & CHARGEMENT ANIMÉ 360° ──
    // =========================================================================
    if (analysisState === 'analyzing') {
        const activeStep = ANALYSIS_STEPS[currentStepIndex] || ANALYSIS_STEPS[0];
        const StepIcon = activeStep.icon;

        return (
            <div className="max-w-2xl mx-auto py-12 px-4 animate-in fade-in duration-150">
                <div className="bg-white border-2 border-gray-300 rounded-[4px] p-8 shadow-2xl space-y-8 text-center relative overflow-hidden">
                    {/* Icône 360° animée en rotation infinie */}
                    <div className="space-y-3">
                        <div className="inline-flex p-4 bg-gray-50 border-2 border-gray-300 rounded-sm shadow-md">
                            <Icon360 
                                className="w-24 h-14 text-[#001d35]" 
                                animateArrows={true} 
                            />
                        </div>
                        <h2 className="text-xl sm:text-2xl font-bold text-[#001d35] uppercase tracking-wide">
                            Analyse 360° en Cours...
                        </h2>
                        <p className="text-xs font-semibold text-gray-500">
                            Période : <span className="text-[#001d35] font-bold">{activeDateRange.label}</span>
                        </p>
                    </div>

                    {/* ── Jauge de Progression Verte (0% à 100%) ── */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-gray-500 uppercase tracking-wider text-[10px]">
                                Progression du Diagnostic
                            </span>
                            <span className="font-bold text-emerald-600 text-lg tracking-tight">
                                {analysisProgress}%
                            </span>
                        </div>
                        <div className="w-full bg-gray-100 h-4 rounded-full p-0.5 border-2 border-gray-300 shadow-inner overflow-hidden">
                            <div 
                                className="h-full bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-600 rounded-full transition-all duration-75 shadow-sm"
                                style={{ width: `${analysisProgress}%` }}
                            ></div>
                        </div>
                    </div>

                    {/* ── Données Séquentielles en Cours d'Analyse ── */}
                    <div className="bg-gray-50 border-2 border-emerald-500/40 p-4 rounded-sm shadow-sm text-left flex items-start gap-3 transition-all duration-200">
                        <div className="p-3 bg-emerald-100 text-emerald-800 rounded-sm flex-shrink-0 animate-pulse">
                            <StepIcon className="w-6 h-6" />
                        </div>
                        <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-sm uppercase tracking-wider">
                                    Étape {currentStepIndex + 1} sur {ANALYSIS_STEPS.length}
                                </span>
                                <span className="text-[11px] font-bold text-[#f77500] uppercase bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-sm">
                                    {activeStep.metricBadge}
                                </span>
                            </div>
                            <h4 className="text-sm font-bold text-[#001d35] uppercase truncate">
                                {activeStep.title}
                            </h4>
                            <p className="text-xs text-gray-600 font-normal leading-relaxed">
                                {activeStep.desc}
                            </p>
                        </div>
                    </div>

                    {/* État de Finalisation à 100% ou Mini-étapes indicatives */}
                    {analysisProgress >= 100 ? (
                        <div className="p-3 bg-emerald-600 text-white font-bold text-xs uppercase tracking-wider rounded-sm shadow-md animate-in zoom-in-95 duration-150 flex items-center justify-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-white" />
                            <span>Audit 360° Certifié Conforme • Chargement du Cockpit...</span>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 text-left">
                            {ANALYSIS_STEPS.map((step, idx) => {
                                const isCompleted = idx < currentStepIndex;
                                const isCurrent = idx === currentStepIndex;

                                return (
                                    <div 
                                        key={step.id} 
                                        className={`p-2 border rounded-sm text-[11px] font-semibold flex items-center gap-2 transition-all ${
                                            isCompleted 
                                                ? 'bg-emerald-50 border-emerald-300 text-emerald-800' 
                                                : isCurrent 
                                                    ? 'bg-white border-[#001d35] text-[#001d35] shadow-xs ring-1 ring-[#001d35]'
                                                    : 'bg-gray-50 border-gray-200 text-gray-400'
                                        }`}
                                    >
                                        {isCompleted ? (
                                            <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                                        ) : (
                                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isCurrent ? 'bg-[#f77500] animate-ping' : 'bg-gray-300'}`}></span>
                                        )}
                                        <span className="truncate">{step.title.split('&')[0]}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // =========================================================================
    // ── VUE 2b : NOTRE LOADER OFFICIEL KABLLIX (EXACTEMENT 3 SECONDES) ──
    // =========================================================================
    if (analysisState === 'post_loader') {
        return (
            <div className="min-h-[520px] flex items-center justify-center py-12 px-4 animate-in fade-in duration-200">
                <div className="flex flex-col items-center gap-5 bg-white px-12 py-10 rounded-sm shadow-2xl border-2 border-gray-300 max-w-md w-full text-center">
                    {/* Notre Loader officiel Kabllix (spinner simple #001d35, pas le double spinner inversé) */}
                    <div className="w-14 h-14 border-4 border-[#001d35]/20 border-t-[#001d35] rounded-full animate-spin"></div>
                    <div className="text-center space-y-1">
                        <p className="text-[#001d35] font-bold text-base uppercase tracking-wide">
                            Génération du Cockpit 360°...
                        </p>
                        <p className="text-gray-500 text-xs">
                            Consolidation des données et calcul des indicateurs
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // =========================================================================
    // ── VUE 2c : MESSAGE DE RÉUSSITE AVEC CHECK MARK & PRÉPARATION RÉSULTAT ──
    // =========================================================================
    if (analysisState === 'success') {
        return (
            <div className="min-h-[520px] flex items-center justify-center py-12 px-4 animate-in fade-in duration-200">
                <div className="flex flex-col items-center gap-5 bg-white px-12 py-10 rounded-sm shadow-2xl border-2 border-emerald-500/40 max-w-md w-full text-center animate-in zoom-in-95 duration-250">
                    {/* Check Mark Vert Élégant et Grand Format */}
                    <div className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-500 flex items-center justify-center text-emerald-600 shadow-md">
                        <Check className="w-9 h-9 stroke-[3]" />
                    </div>
                    <div className="space-y-1.5">
                        <h3 className="text-xl font-bold text-[#001d35] uppercase tracking-wide">
                            Analyse 360° Réussie !
                        </h3>
                        <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
                            Audit certifié conforme • Données consolidées
                        </p>
                        <p className="text-xs text-gray-500 pt-1">
                            Ouverture de votre cockpit décisionnel...
                        </p>
                    </div>
                    {/* Barre de pulsation pour transition fluide */}
                    <div className="w-24 h-1 bg-emerald-500 rounded-full mt-1 animate-pulse"></div>
                </div>
            </div>
        );
    }

    // =========================================================================
    // ── VUE 3 : COCKPIT 360° FINALISÉ AVEC DONNÉES FILTRÉES ──
    // =========================================================================
    return (
        <div className="space-y-4 animate-in fade-in duration-500">

            {/* ── En-tête Principal : Cockpit 360° des Rapports ── */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-white p-3.5 sm:p-4 rounded-sm border-2 border-gray-300 shadow-sm">
                <div>
                    <div className="flex items-center gap-2">
                        <Icon360 className="w-9 h-5 text-[#001d35]" />
                        <h2 className="text-xl sm:text-2xl font-bold text-[#001d35] tracking-tight uppercase">
                            Cockpit & Centre des Rapports 360°
                        </h2>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-sm uppercase tracking-wide">
                            Période : {activeDateRange.label}
                        </span>
                        <span className="text-xs text-gray-500 font-medium hidden sm:inline">
                            • {periodTransactions.length} ventes analysées
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {/* Bouton pour changer de période */}
                    <button
                        onClick={() => setAnalysisState('setup')}
                        className="px-3 py-2 bg-white hover:bg-gray-50 text-[#001d35] border-2 border-gray-300 hover:border-[#001d35] rounded-sm font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm cursor-pointer active:scale-95"
                        title="Modifier l'intervalle de date ou relancer l'analyse 360°"
                    >
                        <RotateCcw className="w-3.5 h-3.5 text-[#f77500]" />
                        <span>Changer de Période</span>
                    </button>

                    <button
                        onClick={handleSMSReport}
                        className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-sm font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm cursor-pointer active:scale-95"
                        title="Envoyer la clôture du jour par WhatsApp ou SMS"
                    >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Clôture WhatsApp</span>
                    </button>

                    <button
                        onClick={handleGlobalExcelExport}
                        className="px-3 py-2 bg-white hover:bg-gray-50 text-gray-700 border-2 border-gray-300 hover:border-[#001d35] rounded-sm font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm cursor-pointer active:scale-95"
                        title="Exporter l'ensemble des données brutes au format Excel (.xlsx)"
                    >
                        <Download className="w-3.5 h-3.5 text-[#001d35]" />
                        <span>Export Excel</span>
                    </button>
                </div>
            </div>

            {/* ── Barre de Synthèse Supérieure : 5 KPIs Clés avec Anomalies (Harmonisés avec le Dashboard) ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                {/* KPI 1 : Rapports Disponibles */}
                <div 
                    onClick={() => setCockpitViewMode('reports')}
                    className="bg-white p-3 rounded-[4px] border-2 border-gray-300 shadow-sm relative group hover:shadow-md hover:border-[#001d35] transition-all overflow-hidden min-h-[120px] flex flex-col justify-center cursor-pointer"
                    title="Cliquer pour afficher les rapports"
                >
                    <div className="flex justify-between items-start relative z-10">
                        <div className="flex-1">
                            <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-blue-600/70">Rapports Actifs</p>
                            <div className="flex items-baseline mt-2 font-semibold opacity-85" style={{ color: '#001d35', opacity: 0.85 }}>
                                <h3 className="text-xl sm:text-2xl font-semibold">
                                    {reportsCatalog.length}
                                </h3>
                            </div>
                            <p className="text-xs text-gray-400 mt-2 font-medium">
                                Centralisés sur le magasin
                            </p>
                        </div>
                    </div>
                    <img
                        src="/icons8/fluency_240_tags.png"
                        alt=""
                        crossOrigin="anonymous"
                        className="absolute bottom-2 right-2 w-16 h-16 opacity-30 group-hover:opacity-50 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-700 pointer-events-none"
                    />
                </div>

                {/* KPI 2 : Chiffre d'Affaires de la Période */}
                <div className="bg-white p-3 rounded-[4px] border-2 border-gray-300 shadow-sm relative group hover:shadow-md hover:border-[#001d35] transition-all overflow-hidden min-h-[120px] flex flex-col justify-center">
                    <div className="flex justify-between items-start relative z-10">
                        <div className="flex-1">
                            <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-blue-600/70">Volume Commercial</p>
                            <div className="flex items-baseline mt-2 font-semibold opacity-85" style={{ color: '#001d35', opacity: 0.85 }}>
                                <h3 className="text-xl sm:text-2xl font-semibold">
                                    {formatPrice(totalRevenue)}
                                </h3>
                            </div>
                            <p className="text-xs text-gray-400 mt-2 font-medium">
                                {periodTransactions.length} ventes sur la période
                            </p>
                        </div>
                    </div>
                    <img
                        src="/icons8/fluency_240_banknotes.png"
                        alt=""
                        crossOrigin="anonymous"
                        className="absolute bottom-2 right-2 w-16 h-16 opacity-30 group-hover:opacity-50 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-700 pointer-events-none"
                    />
                </div>

                {/* KPI 3 : Capital Stock & Sommeil */}
                <div className="bg-white p-3 rounded-[4px] border-2 border-gray-300 shadow-sm relative group hover:shadow-md hover:border-[#001d35] transition-all overflow-hidden min-h-[120px] flex flex-col justify-center">
                    <div className="flex justify-between items-start relative z-10">
                        <div className="flex-1">
                            <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-blue-600/70">Capital en Stock</p>
                            <div className="flex items-baseline mt-2 font-semibold opacity-85" style={{ color: '#001d35', opacity: 0.85 }}>
                                <h3 className="text-xl sm:text-2xl font-semibold">
                                    {formatPrice(totalStockPurchaseValue)}
                                </h3>
                            </div>
                            <p className="text-xs text-gray-400 mt-2 font-medium">
                                {products.length} articles ({dormantProducts.length} dormants)
                            </p>
                        </div>
                    </div>
                    <img
                        src="/icons8/fluency_240_box.png"
                        alt=""
                        crossOrigin="anonymous"
                        className="absolute bottom-2 right-2 w-16 h-16 opacity-30 group-hover:opacity-50 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-700 pointer-events-none"
                    />
                </div>

                {/* KPI 4 : Créances Clients */}
                <div className="bg-white p-3 rounded-[4px] border-2 border-gray-300 shadow-sm relative group hover:shadow-md hover:border-[#001d35] transition-all overflow-hidden min-h-[120px] flex flex-col justify-center">
                    <div className="flex justify-between items-start relative z-10">
                        <div className="flex-1">
                            <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-rose-600/80">Créances Dehors</p>
                            <div className="flex items-baseline mt-2 font-semibold opacity-85" style={{ color: '#e11d48', opacity: 0.85 }}>
                                <h3 className="text-xl sm:text-2xl font-semibold text-rose-700">
                                    {formatPrice(totalClientDebt)}
                                </h3>
                            </div>
                            <p className="text-xs text-gray-400 mt-2 font-medium">
                                {debtorsCount} débiteurs en attente
                            </p>
                        </div>
                    </div>
                    <img
                        src="/icons8/fluency_240_cash-in-hand.png"
                        alt=""
                        crossOrigin="anonymous"
                        className="absolute bottom-2 right-2 w-16 h-16 opacity-30 group-hover:opacity-50 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-700 pointer-events-none"
                    />
                </div>

                {/* KPI 5 : Anomalies Détectées (Harmonisé StatCard avec Dashboard) */}
                <div 
                    onClick={() => {
                        setCockpitViewMode('anomalies');
                        setIsRadarOpen(true);
                        document.getElementById('radar-anomalies-section')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className={`bg-white p-3 rounded-[4px] border-2 shadow-sm relative group hover:shadow-md transition-all overflow-hidden min-h-[120px] flex flex-col justify-center cursor-pointer ${
                        anomaliesData.criticalCount > 0 
                            ? 'border-rose-300 hover:border-rose-600' 
                            : anomaliesData.totalCount > 0 
                                ? 'border-amber-300 hover:border-amber-600' 
                                : 'border-gray-300 hover:border-[#001d35]'
                    }`}
                    title="Cliquer pour afficher les anomalies"
                >
                    <div className="flex justify-between items-start relative z-10">
                        <div className="flex-1">
                            <div className="flex items-center gap-1.5">
                                <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-blue-600/70">
                                    Anomalies 360°
                                </p>
                                {anomaliesData.criticalCount > 0 ? (
                                    <span className="w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] font-black flex items-center justify-center animate-pulse flex-shrink-0 shadow-sm" title="Anomalie critique détectée !">
                                        !
                                    </span>
                                ) : anomaliesData.totalCount > 0 ? (
                                    <span className="w-4 h-4 rounded-full bg-[#f77500] text-white text-[10px] font-black flex items-center justify-center flex-shrink-0 shadow-sm">
                                        !
                                    </span>
                                ) : null}
                            </div>
                            <div className="flex items-baseline mt-2 font-semibold opacity-85" style={{ color: anomaliesData.criticalCount > 0 ? '#e11d48' : '#001d35', opacity: 0.85 }}>
                                <h3 className="text-xl sm:text-2xl font-semibold">
                                    {anomaliesData.totalCount}
                                </h3>
                            </div>
                            <p className="text-xs text-gray-400 mt-2 font-medium">
                                {anomaliesData.criticalCount > 0 
                                    ? `${anomaliesData.criticalCount} critique(s) · Action requise` 
                                    : anomaliesData.totalCount > 0 
                                        ? `${anomaliesData.totalCount} point(s) de vigilance`
                                        : 'Flux 100% conformes'}
                            </p>
                        </div>
                    </div>
                    <img
                        src="/icons8/fluency_240_high-priority.png"
                        alt=""
                        crossOrigin="anonymous"
                        className="absolute bottom-2 right-2 w-16 h-16 opacity-30 group-hover:opacity-50 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-700 pointer-events-none"
                    />
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* ── BARRE HORIZONTALE DE NAVIGATION : ANOMALIES & RAPPORTS ──── */}
            {/* ══════════════════════════════════════════════════════════════ */}
            <div className="bg-white p-2 sm:p-2.5 rounded-[4px] border-2 border-gray-300 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                        type="button"
                        onClick={() => setCockpitViewMode('none')}
                        className={`px-3.5 py-2 rounded-sm text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                            cockpitViewMode === 'none'
                                ? 'bg-[#001d35] text-white shadow-sm ring-2 ring-[#001d35]/60'
                                : 'bg-gray-100 hover:bg-gray-200/80 text-gray-700'
                        }`}
                        title="Masquer les sections pour ne pas encombrer l'écran"
                    >
                        <EyeOff className={`w-4 h-4 ${cockpitViewMode === 'none' ? 'text-[#f77500]' : 'text-gray-500'}`} />
                        <span>Aucun</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setCockpitViewMode('anomalies')}
                        className={`px-3.5 py-2 rounded-sm text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                            cockpitViewMode === 'anomalies'
                                ? 'bg-[#001d35] text-white shadow-sm ring-2 ring-[#f77500]/60'
                                : 'bg-gray-100 hover:bg-gray-200/80 text-gray-700'
                        }`}
                    >
                        <ShieldAlert className={`w-4 h-4 ${anomaliesData.criticalCount > 0 ? 'text-rose-500 animate-pulse' : 'text-[#f77500]'}`} />
                        <span>Anomalies</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wider ${
                            anomaliesData.criticalCount > 0 
                                ? 'bg-rose-600 text-white animate-pulse' 
                                : cockpitViewMode === 'anomalies' 
                                    ? 'bg-[#f77500] text-white' 
                                    : 'bg-gray-200 text-gray-700'
                        }`}>
                            {anomaliesData.totalCount}
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setCockpitViewMode('reports')}
                        className={`px-3.5 py-2 rounded-sm text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                            cockpitViewMode === 'reports'
                                ? 'bg-[#001d35] text-white shadow-sm ring-2 ring-[#001d35]/60'
                                : 'bg-gray-100 hover:bg-gray-200/80 text-gray-700'
                        }`}
                    >
                        <FileSpreadsheet className="w-4 h-4 text-blue-400" />
                        <span>Rapports</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wider ${
                            cockpitViewMode === 'reports' ? 'bg-[#001d35] text-white' : 'bg-gray-200 text-gray-700'
                        }`}>
                            {reportsCatalog.length}
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setCockpitViewMode('all')}
                        className={`px-3.5 py-2 rounded-sm text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                            cockpitViewMode === 'all'
                                ? 'bg-[#001d35] text-white shadow-sm ring-2 ring-emerald-500/60'
                                : 'bg-gray-100 hover:bg-gray-200/80 text-gray-700'
                        }`}
                    >
                        <LayoutGrid className="w-4 h-4 text-emerald-500" />
                        <span>Vue d'ensemble 360°</span>
                    </button>
                </div>

                {/* Indicateur d'état actif */}
                <div className="flex items-center gap-2 text-xs font-medium px-2">
                    {cockpitViewMode === 'none' && (
                        <span className="text-gray-500 font-medium hidden sm:inline flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-gray-400" />
                            Affichage épuré : écran dégagé dès l'entrée
                        </span>
                    )}
                    {cockpitViewMode === 'anomalies' && (
                        <span className="text-amber-800 font-bold flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-[#f77500] animate-ping" />
                            Section active : Anomalies & Arbitrage ({anomaliesData.totalCount} détectée{anomaliesData.totalCount > 1 ? 's' : ''})
                        </span>
                    )}
                    {cockpitViewMode === 'reports' && (
                        <span className="text-[#001d35] font-bold flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-blue-600" />
                            Section active : Catalogue des {reportsCatalog.length} rapports
                        </span>
                    )}
                    {cockpitViewMode === 'all' && (
                        <span className="text-gray-500 font-medium hidden sm:inline flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            Sections actives : Anomalies ({anomaliesData.totalCount}) & Rapports ({reportsCatalog.length})
                        </span>
                    )}
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* ── MODE ÉPURÉ : VUE PAR DÉFAUT "AUCUN" ─────────────────────── */}
            {/* ══════════════════════════════════════════════════════════════ */}
            {cockpitViewMode === 'none' && (
                <div className="bg-white border-2 border-dashed border-gray-300 rounded-[4px] p-6 text-center shadow-xs">
                    <div className="max-w-md mx-auto flex flex-col items-center">
                        <div className="w-12 h-12 rounded-[4px] bg-gray-50 flex items-center justify-center text-gray-400 mb-3 border border-gray-200">
                            <EyeOff className="w-6 h-6 text-gray-400" />
                        </div>
                        <h3 className="text-sm font-bold text-[#001d35] uppercase tracking-wider mb-1">
                            Affichage épuré actif
                        </h3>
                        <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                            L'écran d'accueil reste dégagé dès l'entrée. Consultez vos indicateurs clés synthétiques ci-dessus, ou déployez le module de votre choix ci-dessous.
                        </p>
                        <div className="flex items-center gap-2 flex-wrap justify-center">
                            <button
                                type="button"
                                onClick={() => setCockpitViewMode('anomalies')}
                                className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-[#001d35] border border-amber-300 rounded-[4px] text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                            >
                                <ShieldAlert className="w-3.5 h-3.5 text-[#f77500]" />
                                <span>Voir les Anomalies ({anomaliesData.totalCount})</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setCockpitViewMode('reports')}
                                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#001d35] border border-blue-200 rounded-[4px] text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                            >
                                <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
                                <span>Catalogue des Rapports ({reportsCatalog.length})</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setCockpitViewMode('all')}
                                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-[#001d35] border border-emerald-300 rounded-[4px] text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                            >
                                <LayoutGrid className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Vue d'ensemble 360°</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* ── SECTION ANOMALIES (RADAR & DÉTECTEUR INTELLIGENT) ───────── */}
            {/* ══════════════════════════════════════════════════════════════ */}
            {(cockpitViewMode === 'all' || cockpitViewMode === 'anomalies') && (
            <div id="radar-anomalies-section" className="bg-white border-2 border-gray-300 rounded-[4px] shadow-sm overflow-hidden scroll-mt-6">
                {/* En-tête du Radar Intelligent */}
                <div className="bg-[#001d35] text-white p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#f77500] text-white rounded-sm shadow-sm flex items-center justify-center flex-shrink-0 animate-pulse">
                            <ShieldAlert className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-bold text-sm sm:text-base uppercase tracking-wider text-white flex items-center gap-2">
                                    Cerveau Intelligent 360° • Radar d'Anomalies Opérationnelles
                                </h3>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase tracking-wide shadow-xs ${
                                    anomaliesData.criticalCount > 0 ? 'bg-rose-600 text-white animate-pulse' : 'bg-[#f77500] text-white'
                                }`}>
                                    {anomaliesData.totalCount} anomalie(s)
                                </span>
                                {anomaliesData.criticalCount > 0 && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase bg-red-950/90 text-rose-300 border border-red-700/80">
                                        {anomaliesData.criticalCount} critique(s)
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-blue-100/70 mt-0.5 font-medium">
                                Surveillance continue : écarts de caisse, stocks critiques, excédents dormants, créances impayées et marges.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                        {anomaliesData.totalFinancialRisk > 0 && (
                            <div className="bg-white/10 border-2 border-white/20 rounded-sm px-3 py-1 text-right">
                                <span className="block text-[9px] font-bold text-orange-300 uppercase tracking-widest">
                                    Risque financier estimé
                                </span>
                                <span className="font-bold text-sm text-white tracking-tight">
                                    {formatPrice(anomaliesData.totalFinancialRisk)}
                                </span>
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={() => setIsRadarOpen(!isRadarOpen)}
                            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-sm text-xs font-bold transition-all cursor-pointer border-2 border-white/20 uppercase tracking-wider shadow-sm active:scale-95 flex items-center gap-1.5"
                            title={isRadarOpen ? "Masquer le détail du radar" : "Afficher le détail du radar"}
                        >
                            <span>{isRadarOpen ? "Réduire" : "Déployer"}</span>
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isRadarOpen ? 'rotate-180' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* Contenu Déployé du Radar */}
                {isRadarOpen && (
                    <div className="p-3.5 sm:p-4 bg-gray-50/50 space-y-3.5 border-t-2 border-gray-200">
                        {/* Filtres par Famille d'Anomalie (Format exact Dashboard) */}
                        <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-2 rounded-sm border-2 border-gray-300 shadow-sm">
                            <div className="flex flex-wrap items-center gap-1 overflow-x-auto">
                                <span className="text-sm font-semibold tracking-wide uppercase text-[11px] text-blue-600/70 px-2 flex items-center gap-1 flex-shrink-0">
                                    <Filter className="w-3.5 h-3.5 text-[#f77500]" /> Filtrer par type :
                                </span>
                                {[
                                    { key: 'all', label: 'Toutes', count: anomaliesData.totalCount },
                                    { key: 'caisse', label: 'Caisse & Écarts', count: anomaliesData.categoryCounts.caisse },
                                    { key: 'stock', label: 'Stocks Bas & Ruptures', count: anomaliesData.categoryCounts.stock },
                                    { key: 'excedent', label: 'Excédents & Dormants', count: anomaliesData.categoryCounts.excedent },
                                    { key: 'creance', label: 'Créances Débiteurs', count: anomaliesData.categoryCounts.creance },
                                    { key: 'rentabilite', label: 'Marges & Ventes', count: anomaliesData.categoryCounts.rentabilite },
                                    { key: 'livraison', label: 'Expéditions Chantiers', count: anomaliesData.categoryCounts.livraison },
                                ].map(tab => (
                                    <button
                                        key={tab.key}
                                        type="button"
                                        onClick={() => setAnomalyCategoryFilter(tab.key)}
                                        className={`px-2.5 py-1 text-xs font-bold rounded-sm transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                                            anomalyCategoryFilter === tab.key
                                                ? 'bg-[#001d35] text-white shadow-sm'
                                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                                        }`}
                                    >
                                        <span>{tab.label}</span>
                                        <span className={`text-[10px] px-1.5 py-0.2 rounded-sm font-bold ${
                                            anomalyCategoryFilter === tab.key ? 'bg-[#f77500] text-white' : 'bg-gray-200 text-gray-700'
                                        }`}>
                                            {tab.count}
                                        </span>
                                    </button>
                                ))}
                            </div>

                            <div className="text-[11px] font-semibold text-gray-500 px-2 flex items-center gap-1">
                                <span>Affichage :</span>
                                <strong className="text-[#001d35]">{filteredAnomalies.length} anomalie(s) ({groupedAnomalies.length} carte(s))</strong>
                            </div>
                        </div>

                        {/* Liste des Cartes d'Anomalies (Avec Regroupement Intelligent par Type) */}
                        {groupedAnomalies.length === 0 ? (
                            <div className="bg-white p-6 border-2 border-emerald-300 text-center rounded-[4px] shadow-sm space-y-1.5">
                                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                                <h4 className="font-bold text-sm uppercase text-[#001d35] tracking-wide">
                                    Aucune anomalie détectée dans cette catégorie
                                </h4>
                                <p className="text-xs text-gray-500 font-medium">
                                    Vos flux opérationnels sont parfaitement conformes et équilibrés.
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[500px] overflow-y-auto pr-1">
                                {groupedAnomalies.map(ano => {
                                    const isCrit = ano.severity === 'critical';
                                    const categoryIconMap = {
                                        caisse: '/icons8/fluency_240_banknotes.png',
                                        stock: '/icons8/fluency_240_high-priority.png',
                                        excedent: '/icons8/fluency_240_box.png',
                                        creance: '/icons8/fluency_240_tags.png',
                                        rentabilite: '/icons8/fluency_240_tags.png',
                                        livraison: '/icons8/fluency_240_product.png',
                                    };
                                    const iconUrl = categoryIconMap[ano.category] || '/icons8/fluency_240_high-priority.png';

                                    // ── CAS 1 : CARTE COMMUNE GROUPÉE (2 ou plusieurs produits/éléments) ──
                                    if (ano.isGroup) {
                                        return (
                                            <div 
                                                key={ano.id}
                                                onClick={() => {
                                                    setSelectedAnomalyGroup(ano);
                                                    setGroupSearchTerm('');
                                                }}
                                                className={`p-3.5 bg-white border-2 rounded-[4px] shadow-sm flex flex-col justify-between transition-all hover:shadow-md group relative overflow-hidden min-h-[195px] cursor-pointer ${
                                                    isCrit 
                                                        ? 'border-rose-300 hover:border-rose-600 bg-gradient-to-b from-rose-50/20 to-white' 
                                                        : 'border-amber-300 hover:border-amber-600 bg-gradient-to-b from-amber-50/20 to-white'
                                                }`}
                                                title="Cliquer pour afficher les détails et les articles concernés"
                                            >
                                                <div className="space-y-2 relative z-10">
                                                    <div className="flex items-center justify-between gap-1.5 flex-wrap">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-[4px] uppercase tracking-wide inline-flex items-center gap-1 shadow-2xs ${
                                                                isCrit 
                                                                    ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                                                                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                                                            }`}>
                                                                <span className={`w-1.5 h-1.5 rounded-full ${isCrit ? 'bg-rose-600 animate-pulse' : 'bg-amber-500'}`}></span>
                                                                <span>{isCrit ? 'Critique' : 'Attention'} • {ano.categoryLabel}</span>
                                                            </span>
                                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-[4px] uppercase tracking-wide bg-blue-50 text-[#001d35] border border-blue-200 shadow-2xs">
                                                                {ano.count} éléments regroupés
                                                            </span>
                                                        </div>
                                                        {ano.financialImpact > 0 && (
                                                            <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 border border-rose-200 rounded-[4px]">
                                                                {formatPrice(ano.financialImpact)}
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div>
                                                        <h4 className="font-bold text-sm text-[#001d35] leading-snug group-hover:text-blue-900 transition-colors flex items-center gap-1.5">
                                                            <span>{ano.title}</span>
                                                        </h4>
                                                        <p className="text-xs text-gray-500 leading-relaxed font-medium mt-1 line-clamp-2">
                                                            {ano.description}
                                                        </p>
                                                    </div>

                                                    {/* Aperçu rapide des premiers produits / articles concernés */}
                                                    <div className="flex flex-wrap gap-1 pt-0.5">
                                                        {ano.items.slice(0, 3).map((item, idx) => {
                                                            const itemName = item.meta?.name || item.title.replace(/^[^:]+:\s*/, '');
                                                            return (
                                                                <span key={idx} className="text-[10px] font-semibold bg-gray-100/90 text-gray-700 px-2 py-0.5 rounded-[4px] border border-gray-200 truncate max-w-[130px]">
                                                                    {itemName}
                                                                </span>
                                                            );
                                                        })}
                                                        {ano.items.length > 3 && (
                                                            <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-[4px] border border-gray-200">
                                                                +{ano.items.length - 3} autres
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="pt-2.5 mt-2.5 border-t-2 border-gray-100 space-y-2 relative z-10">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
                                                            {new Date(ano.date).toLocaleDateString('fr-FR')}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedAnomalyGroup(ano);
                                                                setGroupSearchTerm('');
                                                            }}
                                                            className="px-3 py-1.5 bg-[#001d35] hover:bg-blue-900 text-white font-bold text-xs uppercase tracking-wider rounded-[4px] flex items-center gap-1.5 cursor-pointer transition-all shadow-sm active:scale-95"
                                                        >
                                                            <span>Détails & Produits ({ano.count})</span>
                                                            <ArrowRight className="w-3.5 h-3.5 text-[#f77500]" />
                                                        </button>
                                                    </div>

                                                    {/* ── Période d'Analyse Sélectionnée (Footer de la carte d'anomalie) ── */}
                                                    <div className="pt-1.5 border-t border-gray-100 flex items-center gap-1.5 text-xs font-medium min-w-0">
                                                        <Calendar className="w-3.5 h-3.5 text-[#f77500] flex-shrink-0" />
                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                                            Période :
                                                        </span>
                                                        <span className="text-xs font-bold text-[#001d35] truncate" title={activeDateRange.label}>
                                                            {activeDateRange.label}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Filigrane 3D Fluency discret */}
                                                <img
                                                    src={iconUrl}
                                                    alt=""
                                                    crossOrigin="anonymous"
                                                    className="absolute -bottom-3 -right-3 w-16 h-16 opacity-15 group-hover:opacity-30 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-700 pointer-events-none"
                                                />
                                            </div>
                                        );
                                    }

                                    // ── CAS 2 : CARTE INDIVIDUELLE (1 seul produit / élément ou session) ──
                                    const isOverdueSession = ano.type === 'cash_overdue';

                                    return (
                                        <div 
                                            key={ano.id}
                                            onClick={() => {
                                                if (isOverdueSession) {
                                                    handleOpenCloseSessionModal(ano.meta);
                                                } else {
                                                    setSelectedAnomalyGroup({
                                                        ...ano,
                                                        isGroup: true,
                                                        count: 1,
                                                        items: [ano]
                                                    });
                                                }
                                            }}
                                            className={`p-3.5 bg-white border-2 rounded-[4px] shadow-sm flex flex-col justify-between transition-all hover:shadow-md group relative overflow-hidden min-h-[185px] cursor-pointer ${
                                                isCrit 
                                                    ? 'border-rose-300 hover:border-rose-600' 
                                                    : 'border-amber-300 hover:border-amber-600'
                                            }`}
                                        >
                                            <div className="space-y-2 relative z-10">
                                                <div className="flex items-center justify-between gap-1.5 flex-wrap">
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-[4px] uppercase tracking-wide inline-flex items-center gap-1 shadow-2xs ${
                                                        isCrit 
                                                            ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                                                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                                                    }`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${isCrit ? 'bg-rose-600 animate-pulse' : 'bg-amber-500'}`}></span>
                                                        <span>{isCrit ? 'Critique' : 'Attention'} • {ano.categoryLabel}</span>
                                                    </span>
                                                    {ano.financialImpact > 0 && (
                                                        <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 border border-rose-200 rounded-[4px]">
                                                            {formatPrice(ano.financialImpact)}
                                                        </span>
                                                    )}
                                                </div>

                                                <div>
                                                    <h4 className="font-bold text-sm text-[#001d35] leading-snug group-hover:text-blue-900 transition-colors">
                                                        {ano.title}
                                                    </h4>
                                                    <p className="text-xs text-gray-500 leading-relaxed font-medium mt-1 line-clamp-2">
                                                        {ano.description}
                                                    </p>
                                                </div>

                                                {ano.details && (
                                                    <div className="bg-gray-50 p-2 rounded-[4px] border-2 border-gray-200">
                                                        <p className="text-[11px] text-gray-600 font-medium leading-snug">
                                                            {ano.details}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="pt-2.5 mt-2.5 border-t-2 border-gray-100 space-y-2 relative z-10">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
                                                        {new Date(ano.date).toLocaleDateString('fr-FR')}
                                                    </span>
                                                    {isOverdueSession ? (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleOpenCloseSessionModal(ano.meta);
                                                            }}
                                                            className="px-3 py-1.5 bg-[#001d35] hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider rounded-[4px] flex items-center gap-1.5 cursor-pointer transition-all shadow-sm active:scale-95"
                                                            title="Clôturer cette session de caisse en aveugle"
                                                        >
                                                            <Lock className="w-3.5 h-3.5 text-[#f77500]" />
                                                            <span>Clôturer la Session</span>
                                                        </button>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleOpenReportModal(ano.actionReportId);
                                                            }}
                                                            className="px-3 py-1.5 bg-[#001d35] hover:bg-blue-900 text-white font-bold text-xs uppercase tracking-wider rounded-[4px] flex items-center gap-1.5 cursor-pointer transition-all shadow-sm active:scale-95"
                                                        >
                                                            <span>{ano.actionLabel}</span>
                                                            <ArrowRight className="w-3.5 h-3.5 text-[#f77500]" />
                                                        </button>
                                                    )}
                                                </div>

                                                {/* ── Période d'Analyse Sélectionnée (Footer de la carte d'anomalie) ── */}
                                                <div className="pt-1.5 border-t border-gray-100 flex items-center gap-1.5 text-xs font-medium min-w-0">
                                                    <Calendar className="w-3.5 h-3.5 text-[#f77500] flex-shrink-0" />
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                                        Période :
                                                    </span>
                                                    <span className="text-xs font-bold text-[#001d35] truncate" title={activeDateRange.label}>
                                                        {activeDateRange.label}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Filigrane 3D Fluency discret */}
                                            <img
                                                src={iconUrl}
                                                alt=""
                                                crossOrigin="anonymous"
                                                className="absolute -bottom-3 -right-3 w-16 h-16 opacity-15 group-hover:opacity-30 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-700 pointer-events-none"
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>
            )}

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* ── SECTION RAPPORTS (FILTRES, RECHERCHE & CATALOGUE) ───────── */}
            {/* ══════════════════════════════════════════════════════════════ */}
            {(cockpitViewMode === 'all' || cockpitViewMode === 'reports') && (
            <div className="space-y-3.5">
                {/* Entête de Section Rapports si en vue globale */}
                {cockpitViewMode === 'all' && (
                    <div className="bg-[#001d35] text-white px-4 py-2.5 rounded-[4px] border-2 border-gray-300 flex items-center justify-between shadow-sm">
                        <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 bg-blue-600 text-white rounded-sm flex items-center justify-center flex-shrink-0">
                                <FileSpreadsheet className="w-4 h-4" />
                            </div>
                            <h3 className="font-bold text-xs sm:text-sm uppercase tracking-wider text-white">
                                Catalogue Officiel des Rapports d'Activité ({reportsCatalog.length})
                            </h3>
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-200 hidden sm:inline">
                            Filtres & Éditions A4 Certifiées
                        </span>
                    </div>
                )}

            {/* ── Filtres de Catégories & Recherche Rapide (Style Barres Onglets Dashboard) ── */}
            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-white p-2.5 rounded-sm border-2 border-gray-300 shadow-sm">
                {/* Catégories de rapports */}
                <div className="flex flex-wrap items-center gap-1 bg-gray-100/80 p-1 rounded-sm border-2 border-gray-300 overflow-x-auto">
                    {[
                        { id: 'all', label: 'Tous les Rapports', count: reportsCatalog.length },
                        { id: 'cash', label: 'Caisse & Audit', count: reportsCatalog.filter(r => r.category === 'cash').length },
                        { id: 'sales', label: 'Ventes & Marge', count: reportsCatalog.filter(r => r.category === 'sales').length },
                        { id: 'inventory', label: 'Stocks & Inventaire', count: reportsCatalog.filter(r => r.category === 'inventory').length },
                        { id: 'debts', label: 'Créances Clients', count: reportsCatalog.filter(r => r.category === 'debts').length },
                        { id: 'logistics', label: 'Logistique & BL', count: reportsCatalog.filter(r => r.category === 'logistics').length },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setSelectedCategory(tab.id)}
                            className={`px-3 py-1.5 text-xs font-bold rounded-sm transition-all cursor-pointer whitespace-nowrap ${
                                selectedCategory === tab.id
                                    ? 'bg-[#001d35] text-white shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                            }`}
                        >
                            {tab.label} ({tab.count})
                        </button>
                    ))}
                </div>

                {/* Recherche textuelle */}
                <div className="relative min-w-[240px]">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Rechercher un rapport..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 bg-white border-2 border-gray-300 rounded-sm text-xs font-medium focus:border-[#001d35] outline-none shadow-sm"
                    />
                </div>
            </div>

            {/* ── Catalogue des 8 Grands Rapports Officiels (Grille à 3 colonnes avec entêtes contrastées) ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {filteredReports.map(report => {
                    const IconComp = report.icon;

                    return (
                        <div
                            key={report.id}
                            className="bg-white border-2 border-gray-300 rounded-[4px] shadow-sm hover:shadow-md hover:border-[#001d35] transition-all flex flex-col justify-between group overflow-hidden"
                        >
                            <div>
                                {/* Entête contrastée de la carte de rapport */}
                                <div className="bg-slate-100/90 border-b-2 border-gray-200 p-3 sm:p-3.5 flex items-start justify-between gap-2.5">
                                    <div className="flex items-start gap-2.5 min-w-0">
                                        <div className="p-2 bg-[#001d35] text-white group-hover:bg-[#f77500] transition-colors rounded-[4px] shadow-xs flex-shrink-0 mt-0.5">
                                            <IconComp className="w-5 h-5 text-white" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                                <span className="text-[10px] font-black uppercase tracking-wider text-blue-900 bg-blue-100/90 px-2 py-0.5 rounded-[4px] border border-blue-300 inline-block">
                                                    {report.shortTitle}
                                                </span>
                                            </div>
                                            <h3 className="font-extrabold text-sm text-[#001d35] leading-snug group-hover:text-blue-950 transition-colors">
                                                {report.title}
                                            </h3>
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-[4px] uppercase tracking-wide whitespace-nowrap bg-emerald-100 text-emerald-950 border border-emerald-300 shadow-2xs flex-shrink-0">
                                        {report.badge}
                                    </span>
                                </div>

                                {/* Résumé exécutif */}
                                <div className="p-3 sm:p-3.5">
                                    <p className="text-xs text-gray-700 leading-relaxed font-normal">
                                        {report.summary}
                                    </p>
                                </div>
                            </div>

                            {/* Métrique, Actions & Période d'Analyse (Footer de la carte) */}
                            <div className="p-3 sm:p-3.5 pt-0 mt-auto">
                                <div className="pt-3 border-t-2 border-gray-200 space-y-2.5">
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                        <div>
                                            <span className="text-[11px] text-gray-600 font-bold uppercase tracking-wider block">
                                                {report.metricLabel}
                                            </span>
                                            <span className={`text-xl sm:text-2xl font-bold ${report.metricHighlight}`}>
                                                {report.metricValue}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleOpenReportModal(report.id)}
                                                className="px-3 py-1.5 bg-[#001d35] hover:bg-blue-900 text-white rounded-[4px] font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
                                                title="Consulter le rapport détaillé"
                                            >
                                                <Eye className="w-3.5 h-3.5 text-[#f77500]" />
                                                <span>Visualiser</span>
                                            </button>

                                            <button
                                                onClick={() => handlePrintReport(report)}
                                                className="px-2.5 py-1.5 bg-white hover:bg-gray-50 text-gray-800 border-2 border-gray-300 hover:border-[#001d35] rounded-[4px] font-bold text-xs uppercase tracking-wider flex items-center gap-1 transition-all shadow-xs cursor-pointer active:scale-95"
                                                title="Imprimer au format A4 certifié"
                                            >
                                                <Printer className="w-3.5 h-3.5 text-gray-700" />
                                                <span>PDF</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* ── Période d'Analyse Sélectionnée (Footer de la carte) ── */}
                                    <div className="pt-2 border-t border-gray-200 flex items-center gap-1.5 text-xs font-semibold text-gray-700 min-w-0">
                                        <Calendar className="w-3.5 h-3.5 text-[#f77500] flex-shrink-0" />
                                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                            Période :
                                        </span>
                                        <span className="text-xs font-bold text-[#001d35] truncate" title={activeDateRange.label}>
                                            {activeDateRange.label}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
            </div>
            )}

            {/* ── MODALE DE CONSULTATION DU RAPPORT (Style Conditionnement Panier) ── */}
            {activeReportId && activeReportObj && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-[200] animate-in fade-in duration-150">
                    <div className={`border-2 border-[#001d35] rounded-sm bg-slate-50 overflow-hidden shadow-2xl w-full ${activeReportId === 'cash_audit' ? 'max-w-6xl xl:max-w-7xl' : 'max-w-4xl'} max-h-[90vh] flex flex-col`}>
                        
                        {/* Entête Modal Corporate (#001d35) */}
                        <div className="bg-[#001d35] px-4 py-3 flex items-center justify-between flex-shrink-0">
                            <div className="flex items-center gap-2 min-w-0">
                                <activeReportObj.icon className="w-4 h-4 text-[#f77500] flex-shrink-0" />
                                <h3 className="text-white font-bold uppercase tracking-wider text-xs truncate">
                                    {activeReportObj.title}
                                </h3>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase bg-white/10 text-white border border-white/20">
                                    {activeDateRange.label}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                <button
                                    onClick={() => handlePrintReport(activeReportObj)}
                                    className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded-sm font-bold text-xs uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer"
                                    title="Imprimer le rapport en A4"
                                >
                                    <Printer className="w-3 h-3 text-[#f77500]" />
                                    <span className="hidden sm:inline">Imprimer A4</span>
                                </button>
                                <button
                                    onClick={handleCloseReportModal}
                                    className="text-white/80 hover:text-white p-1 rounded-sm hover:bg-white/10 transition-colors cursor-pointer"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Notre Loader officiel Kabllix (Sans Aucun Texte) */}
                        {modalLoading ? (
                            <div className="p-16 flex items-center justify-center flex-1 bg-slate-50">
                                <div className="w-14 h-14 border-4 border-[#001d35]/20 border-t-[#001d35] rounded-full animate-spin"></div>
                            </div>
                        ) : activeReportId === 'cash_audit' ? (
                            /* ========================================================================= */
                            /* ── JOURNAL D'AUDIT ANTI-COULAGE OFFICIEL (Identique à Sessions.jsx)    ── */
                            /* ========================================================================= */
                            <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1 bg-slate-50">
                                {/* 4 StatCards Métier Anti-Pertes Patron */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                    {/* Pertes Cumulées */}
                                    <div className="bg-white p-3 rounded-sm border-2 border-gray-300 shadow-sm relative group hover:shadow-md transition-shadow overflow-hidden flex flex-col justify-center min-h-[110px]">
                                        <div className="flex justify-between items-start relative z-10">
                                            <div className="flex-1">
                                                <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-rose-600/80">Pertes Cumulées (Manquants)</p>
                                                <div className="flex items-baseline mt-2 font-semibold opacity-85" style={{ color: '#e11d48', opacity: 0.85 }}>
                                                    <h3 className="text-xl sm:text-2xl font-bold tracking-tight">{formatPrice(auditKPIs.totalLosses)}</h3>
                                                </div>
                                                <p className="text-xs text-gray-400 mt-1.5 font-medium">Argent manquant dans les tiroirs</p>
                                            </div>
                                        </div>
                                        <AlertTriangle className="absolute bottom-2 right-2 w-14 h-14 text-rose-500/10 group-hover:scale-105 transition-all pointer-events-none" />
                                    </div>

                                    {/* Excédents Inexpliqués */}
                                    <div className="bg-white p-3 rounded-sm border-2 border-gray-300 shadow-sm relative group hover:shadow-md transition-shadow overflow-hidden flex flex-col justify-center min-h-[110px]">
                                        <div className="flex justify-between items-start relative z-10">
                                            <div className="flex-1">
                                                <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-amber-600/80">Excédents Inexpliqués</p>
                                                <div className="flex items-baseline mt-2 font-semibold opacity-85" style={{ color: '#b45309', opacity: 0.85 }}>
                                                    <h3 className="text-xl sm:text-2xl font-bold tracking-tight">{formatPrice(auditKPIs.totalSurplus)}</h3>
                                                </div>
                                                <p className="text-xs text-gray-400 mt-1.5 font-medium">Surplus / Risque de vente oubliée</p>
                                            </div>
                                        </div>
                                        <DollarSign className="absolute bottom-2 right-2 w-14 h-14 text-amber-500/10 group-hover:scale-105 transition-all pointer-events-none" />
                                    </div>

                                    {/* Taux de Conformité */}
                                    <div className="bg-white p-3 rounded-sm border-2 border-gray-300 shadow-sm relative group hover:shadow-md transition-shadow overflow-hidden flex flex-col justify-center min-h-[110px]">
                                        <div className="flex justify-between items-start relative z-10">
                                            <div className="flex-1">
                                                <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-emerald-600/80">Taux de Fiabilité Caisse</p>
                                                <div className="flex items-baseline mt-2 font-semibold opacity-85" style={{ color: '#059669', opacity: 0.85 }}>
                                                    <h3 className="text-xl sm:text-2xl font-bold tracking-tight">{auditKPIs.complianceRate}%</h3>
                                                </div>
                                                <p className="text-xs text-gray-400 mt-1.5 font-medium">Sessions parfaitement équilibrées</p>
                                            </div>
                                        </div>
                                        <CheckCircle2 className="absolute bottom-2 right-2 w-14 h-14 text-emerald-500/10 group-hover:scale-105 transition-all pointer-events-none" />
                                    </div>

                                    {/* Alertes à Régulariser */}
                                    <div className="bg-white p-3 rounded-sm border-2 border-gray-300 shadow-sm relative group hover:shadow-md transition-shadow overflow-hidden flex flex-col justify-center min-h-[110px]">
                                        <div className="flex justify-between items-start relative z-10">
                                            <div className="flex-1">
                                                <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-blue-600/70">Alertes à Arbitrer</p>
                                                <div className="flex items-baseline mt-2 font-semibold opacity-85" style={{ color: '#001d35', opacity: 0.85 }}>
                                                    <h3 className="text-xl sm:text-2xl font-bold tracking-tight">{auditKPIs.pendingReviews}</h3>
                                                </div>
                                                <p className="text-xs text-gray-400 mt-1.5 font-medium">Écarts en attente de visa patronal</p>
                                            </div>
                                        </div>
                                        <ShieldAlert className="absolute bottom-2 right-2 w-14 h-14 text-blue-900/10 group-hover:scale-105 transition-all pointer-events-none" />
                                    </div>
                                </div>

                                {/* Barre de Filtres et Outils d'Audit */}
                                <div className="bg-white border-2 border-gray-300 rounded-sm shadow-sm p-3.5 space-y-3">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                                        <div className="flex-1 relative max-w-md">
                                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                            <input
                                                type="text"
                                                placeholder="Rechercher par caissier, motif, référence..."
                                                value={cashAuditSearchTerm}
                                                onChange={(e) => setCashAuditSearchTerm(e.target.value)}
                                                className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-sm focus:outline-none focus:border-[#001d35] text-xs text-gray-800"
                                            />
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2">
                                            {/* Sélecteur caissier */}
                                            {cashierOptions.length > 0 && (
                                                <select
                                                    value={cashAuditCashierFilter}
                                                    onChange={(e) => setCashAuditCashierFilter(e.target.value)}
                                                    className="px-2.5 py-1.5 border border-gray-300 rounded-sm text-xs font-semibold text-gray-700 bg-white"
                                                >
                                                    <option value="all">Tous les caissiers</option>
                                                    {cashierOptions.map(name => (
                                                        <option key={name} value={name}>{name}</option>
                                                    ))}
                                                </select>
                                            )}

                                            {/* Scope toggle: Période 360° vs Tout le Magasin */}
                                            <div className="inline-flex rounded-sm border border-gray-300 overflow-hidden text-xs">
                                                <button
                                                    type="button"
                                                    onClick={() => setCashAuditScope('period')}
                                                    className={`px-2.5 py-1.5 font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                                                        cashAuditScope === 'period' ? 'bg-[#001d35] text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
                                                    }`}
                                                >
                                                    Période ({periodMasterSessions.length})
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setCashAuditScope('all')}
                                                    className={`px-2.5 py-1.5 font-bold uppercase tracking-wider transition-colors border-l border-gray-300 cursor-pointer ${
                                                        cashAuditScope === 'all' ? 'bg-[#001d35] text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
                                                    }`}
                                                >
                                                    Tout ({storeMasterSessions.length})
                                                </button>
                                            </div>

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

                                    {/* Onglets Filtres rapides */}
                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                        {[
                                            { id: 'all', label: `Toutes les sessions (${currentAuditPool.length})` },
                                            { id: 'discrepancies', label: `⚠️ Écarts Uniquement (${currentAuditPool.filter(s => {
                                                const d = s.difference !== undefined && s.difference !== null 
                                                    ? parseFloat(s.difference) 
                                                    : ((parseFloat(s.actualAmount ?? s.totalRealDeclared) || 0) - (parseFloat(s.expectedAmount ?? s.totalTheoreticalCalculated) || 0));
                                                return Math.abs(d || 0) > 0;
                                            }).length})` },
                                            { id: 'pending', label: `À Arbitrer par le Patron (${auditKPIs.pendingReviews})` },
                                            { id: 'conform', label: 'Conformes (0 FCFA)' }
                                        ].map((f) => (
                                            <button
                                                key={f.id}
                                                type="button"
                                                onClick={() => setCashAuditFilter(f.id)}
                                                className={`px-3 py-1 rounded-sm text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                                                    cashAuditFilter === f.id
                                                        ? 'bg-[#001d35] text-white shadow-xs'
                                                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                                }`}
                                            >
                                                {f.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Grand Livre d'Audit Anti-Coulage (Tableau officiel à 9 colonnes) */}
                                <div className="bg-white border-2 border-gray-300 rounded-sm shadow-sm overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs border-collapse">
                                            <thead className="bg-[#001d35] text-white font-bold uppercase text-[10px] tracking-wider">
                                                <tr className="divide-x divide-white/10">
                                                    <th className="px-3 py-2.5">Date & Heures</th>
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
                                                        <td colSpan="9" className="px-4 py-10 text-center text-gray-400 font-medium">
                                                            Aucune session ne correspond aux critères d'audit sélectionnés.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    filteredAuditSessions.map((session) => {
                                                        const diff = session.difference !== undefined && session.difference !== null
                                                            ? (parseFloat(session.difference) || 0)
                                                            : ((parseFloat(session.actualAmount ?? session.totalRealDeclared) || 0) - (parseFloat(session.expectedAmount ?? session.totalTheoreticalCalculated) || 0));
                                                        const theo = parseFloat(session.expectedAmount ?? session.totalTheoreticalCalculated) || 0;
                                                        const actual = parseFloat(session.actualAmount ?? session.totalRealDeclared) || 0;
                                                        const initial = parseFloat(session.initialAmount ?? session.initialCash) || 0;

                                                        const isNeg = diff < 0;
                                                        const isPos = diff > 0;
                                                        const isConform = Math.abs(diff) === 0;

                                                        const rawStartTime = session.startTime || session.date || session.openedAt || session.endTime || session.closedAt || new Date().toISOString();
                                                        let dateStr = '—';
                                                        let timeStr = '—';
                                                        try {
                                                            const sDate = new Date(rawStartTime);
                                                            if (!isNaN(sDate.getTime())) {
                                                                dateStr = format(sDate, 'dd MMM yyyy', { locale: fr });
                                                                timeStr = format(sDate, 'HH:mm');
                                                            }
                                                        } catch (e) {}

                                                        let endTimeStr = '—';
                                                        if (session.endTime || session.closedAt) {
                                                            try {
                                                                const eDate = new Date(session.endTime || session.closedAt);
                                                                if (!isNaN(eDate.getTime())) {
                                                                    endTimeStr = format(eDate, 'HH:mm');
                                                                }
                                                            } catch (e) {}
                                                        }

                                                        const isPendingArbitration = (!session.auditStatus || session.auditStatus === 'pending_review') && Math.abs(diff) > 0;
                                                        const isAlreadyArbitrated = Boolean(session.auditedAt || (session.auditStatus && session.auditStatus !== 'pending_review'));

                                                        return (
                                                            <tr 
                                                                key={session.id} 
                                                                className={`transition-colors ${
                                                                    isPendingArbitration 
                                                                        ? 'bg-rose-50/40 hover:bg-rose-50/70 border-l-4 border-l-red-600' 
                                                                        : isAlreadyArbitrated
                                                                            ? 'bg-blue-50/25 hover:bg-blue-50/60 border-l-4 border-l-blue-600'
                                                                            : 'hover:bg-blue-50/40 odd:bg-gray-50/50'
                                                                }`}
                                                            >
                                                                {/* 1. Date & Heures */}
                                                                <td className="px-3 py-2.5 whitespace-nowrap">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="font-bold text-gray-800">
                                                                            {dateStr}
                                                                        </div>
                                                                        {isPendingArbitration && (
                                                                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] text-[9px] font-black uppercase tracking-wider bg-red-600 text-white shadow-2xs animate-pulse">
                                                                                <span className="w-3.5 h-3.5 rounded-full bg-white text-red-700 font-black text-[9px] flex items-center justify-center flex-shrink-0">1</span>
                                                                                <span>Action Requise</span>
                                                                            </span>
                                                                        )}
                                                                        {isAlreadyArbitrated && (
                                                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] text-[9px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-300">
                                                                                <ShieldCheck className="w-3 h-3 text-blue-600" />
                                                                                <span>Audité</span>
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div className="text-[10px] text-gray-400">
                                                                        {timeStr} ➔ {endTimeStr}
                                                                    </div>
                                                                </td>

                                                                {/* 2. Caissier */}
                                                                <td className="px-3 py-2.5">
                                                                    <div className="font-bold text-[#001d35] flex items-center gap-1.5">
                                                                        <User className="w-3.5 h-3.5 text-gray-400" />
                                                                        <span>{session.cashierName || session.userId || 'Caissier'}</span>
                                                                    </div>
                                                                    <div className="text-[10px] text-gray-400 font-medium">ID: {session.id.slice(0, 15)}...</div>
                                                                </td>

                                                                {/* 3. Fond initial */}
                                                                <td className="px-3 py-2.5 text-right font-medium text-gray-600">
                                                                    {formatPrice(initial)}
                                                                </td>

                                                                {/* 4. Théorique Système */}
                                                                <td className="px-3 py-2.5 text-right font-semibold text-gray-800">
                                                                    {formatPrice(theo)}
                                                                </td>

                                                                {/* 5. Déclaré en Aveugle */}
                                                                <td className="px-3 py-2.5 text-right font-bold text-[#001d35]">
                                                                    {formatPrice(actual)}
                                                                    {session.breakdown?.method === 'billetage' && (
                                                                        <span className="block text-[9px] text-blue-600 font-sans font-normal">Billetage FCFA</span>
                                                                    )}
                                                                </td>

                                                                {/* 6. Écart Net */}
                                                                <td className="px-3 py-2.5 text-right">
                                                                    <span className={`inline-block px-2 py-0.5 rounded-sm text-[11px] font-bold ${
                                                                        isConform ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                                                                        isNeg ? 'bg-red-100 text-red-800 border border-red-300 animate-pulse' :
                                                                        'bg-amber-100 text-amber-800 border border-amber-300'
                                                                    }`}>
                                                                        {isPos ? '+' : ''}{formatPrice(diff)}
                                                                    </span>
                                                                    <div className="text-[9px] font-semibold mt-0.5" style={{ color: isNeg ? '#b91c1c' : isPos ? '#b45309' : '#15803d' }}>
                                                                        {isConform ? '✓ Caisse Juste' : isNeg ? '⚠️ Manquant' : '⚠️ Excédent'}
                                                                    </div>
                                                                </td>

                                                                {/* 7. Justification Caissier */}
                                                                <td className="px-3 py-2.5 max-w-[200px]">
                                                                    {session.justification ? (
                                                                        <div className="text-[11px] text-gray-700 bg-white p-1.5 rounded-sm border border-gray-200 line-clamp-2">
                                                                            « {session.justification} »
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-gray-400 italic text-[11px]">Aucune justification requise</span>
                                                                    )}
                                                                </td>

                                                                {/* 8. Visa & Statut Patron */}
                                                                <td className="px-3 py-2.5 text-center">
                                                                    {isPendingArbitration ? (
                                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] text-[10px] font-black uppercase tracking-wider bg-red-50 text-red-900 border-2 border-red-500 shadow-2xs animate-pulse">
                                                                            <span className="w-4 h-4 rounded-full bg-red-600 text-white font-black text-[10px] flex items-center justify-center flex-shrink-0 shadow-xs">
                                                                                1
                                                                            </span>
                                                                            <span>À Arbitrer</span>
                                                                        </span>
                                                                    ) : isAlreadyArbitrated ? (
                                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] text-[10px] font-bold uppercase tracking-wider border-2 border-blue-600 bg-blue-50 text-blue-900 shadow-2xs">
                                                                            <ShieldCheck className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                                                                            <span>
                                                                                {session.auditStatus === 'approved' ? '✓ Arbitré : Validé' :
                                                                                 session.auditStatus === 'payroll_deduction' ? '✓ Arbitré : Retenue' :
                                                                                 session.auditStatus === 'investigating' ? '✓ Arbitré : Enquête' :
                                                                                 session.auditStatus === 'regularized' ? '✓ Arbitré : Régularisé' :
                                                                                 '✓ Audité & Scellé'}
                                                                            </span>
                                                                        </span>
                                                                    ) : (
                                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-[4px] text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200">
                                                                            {session.auditStatus === 'approved' ? '✓ Validé' : '✓ Conforme'}
                                                                        </span>
                                                                    )}
                                                                    {session.auditedBy && (
                                                                        <div className="text-[9px] text-gray-500 font-medium mt-0.5">Par {session.auditedBy}</div>
                                                                    )}
                                                                </td>

                                                                {/* 9. Actions */}
                                                                <td className="px-3 py-2.5 text-center">
                                                                    <div className="flex items-center justify-center gap-1.5">
                                                                        {isAlreadyArbitrated ? (
                                                                            <button
                                                                                type="button"
                                                                                disabled
                                                                                className="px-2.5 py-1 rounded-[4px] text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-300 cursor-not-allowed flex items-center gap-1 shadow-2xs opacity-85"
                                                                                title="Session déjà auditée et arbitrée — Décision scellée non modifiable"
                                                                            >
                                                                                <Lock className="w-3 h-3 text-blue-600" />
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
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handlePrintZReport(session)}
                                                                            className="p-1 text-gray-500 hover:text-[#001d35] hover:bg-gray-100 rounded-sm transition-colors cursor-pointer"
                                                                            title="Imprimer PV Z"
                                                                        >
                                                                            <Printer className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    </div>
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
                        ) : (
                            /* Contenu des autres Rapports Déployés */
                            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 bg-gray-50/60">
                                
                                {/* Synthèse Clé */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div className="bg-white p-3 rounded-sm border-2 border-gray-300 shadow-sm relative group hover:shadow-md transition-shadow overflow-hidden flex flex-col justify-center min-h-[90px]">
                                        <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-blue-600/70">Indicateur Central</p>
                                        <div className="flex items-baseline mt-1 font-semibold opacity-85" style={{ color: '#001d35', opacity: 0.85 }}>
                                            <h4 className="text-xl sm:text-2xl font-semibold">{activeReportObj.metricValue}</h4>
                                        </div>
                                        <span className="text-xs text-gray-400 mt-1 font-medium">{activeReportObj.metricLabel}</span>
                                    </div>
                                    <div className="bg-white p-3 rounded-sm border-2 border-gray-300 shadow-sm relative group hover:shadow-md transition-shadow overflow-hidden flex flex-col justify-center min-h-[90px]">
                                        <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-blue-600/70">Fréquence de Contrôle</p>
                                        <div className="flex items-baseline mt-1 font-semibold opacity-85" style={{ color: '#001d35', opacity: 0.85 }}>
                                            <h4 className="text-base sm:text-lg font-semibold">{activeReportObj.frequency}</h4>
                                        </div>
                                        <span className="text-xs text-gray-400 mt-1 font-medium">Recommandation audit</span>
                                    </div>
                                    <div className="bg-white p-3 rounded-sm border-2 border-gray-300 shadow-sm relative group hover:shadow-md transition-shadow overflow-hidden flex flex-col justify-center min-h-[90px]">
                                        <p className="text-sm font-semibold tracking-wide uppercase text-[11px] text-blue-600/70">Volume de Données</p>
                                        <div className="flex items-baseline mt-1 font-semibold opacity-85" style={{ color: '#001d35', opacity: 0.85 }}>
                                            <h4 className="text-xl sm:text-2xl font-semibold">{periodTransactions.length}</h4>
                                        </div>
                                        <span className="text-xs text-gray-400 mt-1 font-medium">Transactions analysées</span>
                                    </div>
                                </div>

                                {activeReportId === 'stock_alerts' && (
                                    <div className="bg-white border-2 border-gray-300 rounded-sm p-4 shadow-sm space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h4 className="font-bold text-xs uppercase text-[#001d35]">
                                                Articles Inactifs &amp; Trésorerie Piégée (&gt; 45 jours)
                                            </h4>
                                            <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-sm">
                                                {dormantProducts.length} référence(s) dormante(s)
                                            </span>
                                        </div>
                                        <div className="overflow-x-auto max-h-80">
                                            <table className="w-full text-left text-xs">
                                                <thead className="bg-[#001d35] text-white font-bold uppercase tracking-wider text-[10px] sticky top-0">
                                                    <tr>
                                                        <th className="px-3 py-2">Désignation</th>
                                                        <th className="px-3 py-2">Catégorie</th>
                                                        <th className="px-3 py-2">Quantité en Stock</th>
                                                        <th className="px-3 py-2">Prix d'Achat</th>
                                                        <th className="px-3 py-2">Capital Immobilisé</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-200">
                                                    {dormantProducts.length === 0 ? (
                                                        <tr><td colSpan="5" className="text-center py-6 text-gray-400">Aucun produit dormant détecté. Votre stock tourne à plein régime !</td></tr>
                                                    ) : (
                                                        dormantProducts.map(p => {
                                                            const qty = p.stockLevels?.[currentStoreId] || 0;
                                                            const cost = (parseFloat(p.purchasePrice) || 0) * qty;
                                                            return (
                                                                <tr key={p.id} className="hover:bg-gray-50">
                                                                    <td className="px-3 py-2 font-bold text-[#001d35]">{p.name}</td>
                                                                    <td className="px-3 py-2 text-gray-500">{p.category || 'Général'}</td>
                                                                    <td className="px-3 py-2 font-bold text-amber-700">{qty} {p.unit || 'unités'}</td>
                                                                    <td className="px-3 py-2 font-medium">{formatPrice(p.purchasePrice)}</td>
                                                                    <td className="px-3 py-2 font-bold text-rose-600">{formatPrice(cost)}</td>
                                                                </tr>
                                                            );
                                                        })
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {activeReportId === 'client_debts' && (
                                    <div className="bg-white border-2 border-gray-300 rounded-sm p-4 shadow-sm space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h4 className="font-bold text-xs uppercase text-[#001d35]">
                                                Carnet des Créances & Débiteurs
                                            </h4>
                                            <span className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-sm">
                                                Total Dû : {formatPrice(totalClientDebt)}
                                            </span>
                                        </div>
                                        <div className="overflow-x-auto max-h-80">
                                            <table className="w-full text-left text-xs">
                                                <thead className="bg-[#001d35] text-white font-bold uppercase tracking-wider text-[10px] sticky top-0">
                                                    <tr>
                                                        <th className="px-3 py-2">Nom du Client</th>
                                                        <th className="px-3 py-2">Téléphone</th>
                                                        <th className="px-3 py-2">Limite Accordée</th>
                                                        <th className="px-3 py-2">Montant Dû</th>
                                                        <th className="px-3 py-2">Statut Risque</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-200">
                                                    {(clients || []).filter(c => (parseFloat(c.totalDebt) || 0) > 0).length === 0 ? (
                                                        <tr><td colSpan="5" className="text-center py-6 text-gray-400">Aucun client débiteur enregistré.</td></tr>
                                                    ) : (
                                                        (clients || []).filter(c => (parseFloat(c.totalDebt) || 0) > 0).map(c => (
                                                            <tr key={c.id} className="hover:bg-gray-50">
                                                                <td className="px-3 py-2 font-bold text-[#001d35]">{c.name}</td>
                                                                <td className="px-3 py-2 text-gray-600">{c.phone || 'Non renseigné'}</td>
                                                                <td className="px-3 py-2 font-medium">{formatPrice(c.creditLimit || 0)}</td>
                                                                <td className="px-3 py-2 font-bold text-rose-600">{formatPrice(c.totalDebt)}</td>
                                                                <td className="px-3 py-2">
                                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase ${
                                                                        c.totalDebt > (c.creditLimit || 0) ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                                                                    }`}>
                                                                        {c.totalDebt > (c.creditLimit || 0) ? 'Dépassement' : 'Encours Actif'}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {activeReportId === 'returns' && (
                                    <div className="bg-white border-2 border-gray-300 rounded-sm p-4 shadow-sm space-y-4">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b-2 border-gray-200">
                                            <div>
                                                <h4 className="font-bold text-xs uppercase tracking-wide text-[#001d35]">
                                                    Grand Livre des Retours Marchandises & Portefeuille des Avoirs
                                                </h4>
                                                <p className="text-[11px] text-gray-500 mt-0.5">
                                                    Registre certifié des retours, réintégrations en stock et compensation financière
                                                </p>
                                            </div>
                                            <a
                                                href="/sales/returns"
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#001d35] hover:bg-[#00284a] text-white font-bold text-xs uppercase tracking-wider rounded-sm shadow-sm transition-colors"
                                            >
                                                <span>Ouvrir Gestion des Retours</span>
                                                <ArrowRight className="w-3.5 h-3.5 text-[#f77500]" />
                                            </a>
                                        </div>

                                        <div className="overflow-x-auto max-h-80">
                                            <table className="w-full text-left text-xs">
                                                <thead className="bg-[#001d35] text-white font-bold uppercase tracking-wider text-[10px] sticky top-0">
                                                    <tr>
                                                        <th className="px-3 py-2">N° Retour / Date</th>
                                                        <th className="px-3 py-2">Client & Chantier</th>
                                                        <th className="px-3 py-2">Articles & Traitement</th>
                                                        <th className="px-3 py-2 text-right">Montant Remboursé</th>
                                                        <th className="px-3 py-2 text-center">Mode de Compensation</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-200">
                                                    {(returns || []).length === 0 ? (
                                                        <tr><td colSpan="5" className="text-center py-6 text-gray-400">Aucun retour de marchandise enregistré.</td></tr>
                                                    ) : (
                                                        (returns || []).map(r => (
                                                            <tr key={r.id} className="hover:bg-gray-50">
                                                                <td className="px-3 py-2">
                                                                    <span className="font-bold text-[#001d35]">{r.returnNumber}</span>
                                                                    <p className="text-[10px] text-gray-500">{new Date(r.date).toLocaleDateString('fr-FR')}</p>
                                                                </td>
                                                                <td className="px-3 py-2">
                                                                    <p className="font-bold text-gray-900">{r.customerName || 'Client Comptoir'}</p>
                                                                    {r.siteName && <p className="text-[10px] text-gray-500 font-medium">Chantier : {r.siteName}</p>}
                                                                </td>
                                                                <td className="px-3 py-2">
                                                                    <div className="flex flex-wrap gap-1">
                                                                        {(r.items || []).map((it, idx) => (
                                                                            <span key={idx} className="bg-gray-100 text-gray-800 text-[10px] font-medium px-1.5 py-0.5 rounded-sm">
                                                                                {it.name} <strong>x{it.quantityReturned || it.quantity}</strong>
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                </td>
                                                                <td className="px-3 py-2 text-right font-bold text-[#001d35]">
                                                                    {formatPrice(r.totalAmount)}
                                                                </td>
                                                                <td className="px-3 py-2 text-center">
                                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-800 border border-blue-200">
                                                                        {r.refundMethod === 'avoir' ? "Bon d'Avoir" : r.refundMethod === 'cash' ? "Espèces" : "Dette Déduite"}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Vue par défaut pour les rapports de ventes / logistique */}
                                {['sales_activity', 'profitability', 'daily_cash', 'deliveries'].includes(activeReportId) && (
                                    <div className="bg-white border-2 border-gray-300 rounded-sm overflow-x-auto shadow-sm max-h-96">
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-[#001d35] text-white font-bold uppercase tracking-wider text-[10px] sticky top-0">
                                                <tr>
                                                    <th className="px-3 py-2.5">ID Transaction</th>
                                                    <th className="px-3 py-2.5">Date & Heure</th>
                                                    <th className="px-3 py-2.5">Paiement</th>
                                                    <th className="px-3 py-2.5">Détail Articles</th>
                                                    <th className="px-3 py-2.5">Total TTC</th>
                                                    <th className="px-3 py-2.5">Statut</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200">
                                                {periodTransactions.length === 0 ? (
                                                    <tr><td colSpan="6" className="text-center py-8 text-gray-400">Aucune transaction enregistrée sur cette période.</td></tr>
                                                ) : (
                                                    periodTransactions.slice(0, 100).map(t => (
                                                        <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                                                            <td className="px-3 py-2 font-bold text-gray-700">#{t.id}</td>
                                                            <td className="px-3 py-2">{new Date(t.date).toLocaleString('fr-FR')}</td>
                                                            <td className="px-3 py-2 font-bold text-gray-700 uppercase">{t.paymentMethod || 'Espèces'}</td>
                                                            <td className="px-3 py-2 text-gray-600">
                                                                {(t.items || []).map(i => `${i.name} (x${i.quantity})`).join(', ')}
                                                            </td>
                                                            <td className="px-3 py-2 font-bold text-[#001d35]">{formatPrice(t.total)}</td>
                                                            <td className="px-3 py-2">
                                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase ${
                                                                    t.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                                                }`}>
                                                                    {t.status === 'completed' ? 'Validé' : 'Annulé'}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                            </div>
                        )}

                        {/* Pied de Page Modal */}
                        <div className="px-4 py-2.5 bg-gray-100 border-t-2 border-gray-200 flex items-center justify-between flex-shrink-0">
                            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                                Kabllix Enterprise Reporting Engine • {activeReportObj.shortTitle}
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleCloseReportModal}
                                    className="px-4 py-1.5 bg-[#001d35] hover:bg-blue-800 text-white rounded-sm font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-sm active:scale-95"
                                >
                                    Fermer
                                </button>
                            </div>
                        </div>

                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* ── MODALE ARBITRAGE & VISA PATRONAL SUR SESSION D'AUDIT ────────────────── */}
            {/* ========================================================================= */}
            {arbitrationModalSession && (
                <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-md rounded-[4px] shadow-2xl border-2 border-[#001d35] overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* En-tête */}
                        <div className="p-4 border-b-2 border-gray-200 flex justify-between items-start bg-white flex-shrink-0">
                            <div>
                                <h3 className="text-sm sm:text-base font-bold text-[#001d35] uppercase tracking-wide flex items-center gap-2">
                                    <ShieldCheck className="w-5 h-5 text-[#001d35]" />
                                    Arbitrage & Visa Patronal
                                </h3>
                                <p className="text-gray-500 text-xs mt-0.5 font-medium">
                                    Contrôle hiérarchique de l'écart de caisse
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setArbitrationModalSession(null)}
                                className="text-gray-400 hover:text-gray-600 p-1 rounded-sm transition-colors cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Corps formulaire */}
                        <form onSubmit={handleSaveArbitration}>
                            <div className="p-4 space-y-3.5">
                                {/* Synthèse session */}
                                <div className="bg-gray-50 p-3.5 rounded-sm border-2 border-gray-200 space-y-1.5 text-xs">
                                    <div className="flex justify-between">
                                        <span className="text-gray-500 font-medium">Caissier responsable :</span>
                                        <strong className="text-[#001d35]">{arbitrationModalSession.cashierName || arbitrationModalSession.userId || 'Caissier'}</strong>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500 font-medium">Attendu Système :</span>
                                        <span className="font-bold text-gray-700">{formatPrice(arbitrationModalSession.expectedAmount || arbitrationModalSession.totalTheoreticalCalculated || 0)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500 font-medium">Compté en Aveugle :</span>
                                        <span className="font-bold text-gray-700">{formatPrice(arbitrationModalSession.actualAmount || arbitrationModalSession.totalRealDeclared || 0)}</span>
                                    </div>
                                    <div className="flex justify-between pt-1 border-t-2 border-gray-200 font-bold">
                                        <span className="text-gray-700 uppercase tracking-wide text-[11px]">Écart Net :</span>
                                        <span className={`${((arbitrationModalSession.difference !== undefined && arbitrationModalSession.difference !== null ? parseFloat(arbitrationModalSession.difference) : ((parseFloat(arbitrationModalSession.actualAmount ?? arbitrationModalSession.totalRealDeclared) || 0) - (parseFloat(arbitrationModalSession.expectedAmount ?? arbitrationModalSession.totalTheoreticalCalculated) || 0))) || 0) < 0 ? 'text-rose-600' : 'text-amber-600'}`}>
                                            {((arbitrationModalSession.difference !== undefined && arbitrationModalSession.difference !== null ? parseFloat(arbitrationModalSession.difference) : ((parseFloat(arbitrationModalSession.actualAmount ?? arbitrationModalSession.totalRealDeclared) || 0) - (parseFloat(arbitrationModalSession.expectedAmount ?? arbitrationModalSession.totalTheoreticalCalculated) || 0))) || 0) > 0 ? '+' : ''}
                                            {formatPrice((arbitrationModalSession.difference !== undefined && arbitrationModalSession.difference !== null ? parseFloat(arbitrationModalSession.difference) : ((parseFloat(arbitrationModalSession.actualAmount ?? arbitrationModalSession.totalRealDeclared) || 0) - (parseFloat(arbitrationModalSession.expectedAmount ?? arbitrationModalSession.totalTheoreticalCalculated) || 0))) || 0)}
                                        </span>
                                    </div>
                                    {arbitrationModalSession.justification && (
                                        <div className="pt-1.5 text-[11px] text-gray-600 border-t-2 border-gray-200">
                                            <strong className="text-gray-700">Justification du Caissier :</strong><br/>
                                            <em className="text-gray-500">« {arbitrationModalSession.justification} »</em>
                                        </div>
                                    )}
                                </div>

                                {/* Choix Décision Patron */}
                                <div>
                                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wide mb-1.5">
                                        Décision de la Direction (Patron)
                                    </label>
                                    <select
                                        value={arbitrationStatus}
                                        onChange={(e) => setArbitrationStatus(e.target.value)}
                                        className="w-full px-3 py-2 bg-white border-2 border-gray-300 rounded-sm text-xs font-bold text-[#001d35] focus:outline-none focus:border-[#001d35] shadow-xs"
                                    >
                                        <option value="approved">✓ Validé — Écart toléré / Sans suite</option>
                                        <option value="payroll_deduction">⚠ Retenue sur salaire du caissier (Déficit)</option>
                                        <option value="investigating">🔍 Enquête interne requise (Suspicion coulage)</option>
                                        <option value="regularized">🔄 Régularisé en comptabilité</option>
                                    </select>
                                </div>

                                {/* Note Patronale */}
                                <div>
                                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wide mb-1.5">
                                        Note Interne de la Direction
                                    </label>
                                    <textarea
                                        rows="2"
                                        value={arbitrationNote}
                                        onChange={(e) => setArbitrationNote(e.target.value)}
                                        className="w-full px-3 py-2 bg-white border-2 border-gray-300 rounded-sm text-xs font-medium text-gray-800 focus:outline-none focus:border-[#001d35] shadow-xs"
                                        placeholder="Ex: Explication acceptée, le caissier s'est engagé à régulariser..."
                                    ></textarea>
                                </div>
                            </div>

                            {/* Actions footer */}
                            <div className="p-3.5 bg-gray-50 border-t-2 border-gray-200 flex justify-end gap-2.5 flex-shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setArbitrationModalSession(null)}
                                    className="px-4 py-2 border-2 border-gray-300 text-gray-700 font-bold uppercase tracking-wider text-xs hover:bg-gray-100 rounded-sm cursor-pointer transition-all shadow-sm active:scale-95 text-center"
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-[#001d35] hover:bg-blue-900 text-white font-bold uppercase tracking-wider text-xs rounded-sm cursor-pointer transition-all shadow-sm active:scale-95 text-center"
                                >
                                    Enregistrer l'Arbitrage
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* ========================================================================= */}
            {/* ── MODALE DE DÉTAIL D'UN GROUPE D'ANOMALIES (ex: Stocks & Ruptures) ──── */}
            {/* ========================================================================= */}
            {selectedAnomalyGroup && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-[220] animate-in fade-in duration-150">
                    <div className="border-2 border-[#001d35] rounded-[4px] bg-slate-50 overflow-hidden shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-150">
                        
                        {/* Entête Modal Corporate (#001d35) */}
                        <div className="bg-[#001d35] px-4 py-3 flex items-center justify-between flex-shrink-0">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 rounded-[4px] bg-[#f77500] text-white flex items-center justify-center flex-shrink-0 font-bold shadow-sm">
                                    <ShieldAlert className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-white font-bold uppercase tracking-wider text-xs sm:text-sm truncate">
                                        {selectedAnomalyGroup.title}
                                    </h3>
                                    <p className="text-[11px] text-blue-200/80 font-medium">
                                        {selectedAnomalyGroup.items?.length || 1} élément(s) analysé(s) sous la surveillance 360°
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                {selectedAnomalyGroup.financialImpact > 0 && (
                                    <span className="text-xs font-bold text-rose-300 bg-red-950/80 border border-red-700 px-2.5 py-1 rounded-[4px] tracking-tight">
                                        Risque : {formatPrice(selectedAnomalyGroup.financialImpact)}
                                    </span>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setSelectedAnomalyGroup(null)}
                                    className="text-white/80 hover:text-white p-1 rounded-[4px] hover:bg-white/10 transition-colors cursor-pointer"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Barre d'Outils & Recherche au sein du Groupe */}
                        <div className="bg-white p-3 border-b-2 border-gray-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 flex-shrink-0">
                            <div className="relative flex-1">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Filtrer un produit, client ou référence dans cette liste..."
                                    value={groupSearchTerm}
                                    onChange={(e) => setGroupSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border-2 border-gray-300 rounded-[4px] text-xs font-medium text-gray-800 focus:bg-white focus:border-[#001d35] outline-none transition-all shadow-xs"
                                    autoFocus
                                />
                            </div>
                            {selectedAnomalyGroup.actionReportId && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        const reportId = selectedAnomalyGroup.actionReportId;
                                        setSelectedAnomalyGroup(null);
                                        handleOpenReportModal(reportId);
                                    }}
                                    className="px-3 py-1.5 bg-[#001d35] hover:bg-blue-900 text-white font-bold text-xs uppercase tracking-wider rounded-[4px] flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-sm active:scale-95 flex-shrink-0"
                                >
                                    <span>Ouvrir le Rapport Global Associé</span>
                                    <ArrowRight className="w-3.5 h-3.5 text-[#f77500]" />
                                </button>
                            )}
                        </div>

                        {/* Liste Scrollable des Articles / Éléments concernés */}
                        <div className="p-4 overflow-y-auto flex-1 space-y-2.5 bg-slate-50">
                            {(() => {
                                const items = (selectedAnomalyGroup.items || []).filter(item => {
                                    if (!groupSearchTerm.trim()) return true;
                                    const term = groupSearchTerm.toLowerCase();
                                    const title = (item.title || '').toLowerCase();
                                    const desc = (item.description || '').toLowerCase();
                                    const details = (item.details || '').toLowerCase();
                                    const name = (item.meta?.name || '').toLowerCase();
                                    return title.includes(term) || desc.includes(term) || details.includes(term) || name.includes(term);
                                });

                                if (items.length === 0) {
                                    return (
                                        <div className="bg-white p-8 border-2 border-gray-300 text-center rounded-[4px] text-gray-400">
                                            <Search className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                                            <p className="text-xs font-bold uppercase tracking-wider">Aucun élément ne correspond à votre recherche.</p>
                                        </div>
                                    );
                                }

                                return items.map((item, idx) => {
                                    const isCrit = item.severity === 'critical';

                                    return (
                                        <div 
                                            key={item.id || idx}
                                            className="p-3.5 bg-white border-2 border-gray-300 hover:border-[#001d35] rounded-[4px] shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3 transition-all group"
                                        >
                                            <div className="flex items-start gap-3 min-w-0 flex-1">
                                                <div className={`w-8 h-8 rounded-[4px] flex items-center justify-center flex-shrink-0 font-bold text-xs ${
                                                    isCrit ? 'bg-rose-100 text-rose-700 border border-rose-300' : 'bg-amber-100 text-amber-800 border border-amber-300'
                                                }`}>
                                                    {idx + 1}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <h4 className="font-bold text-xs sm:text-sm text-[#001d35] leading-tight">
                                                            {item.title}
                                                        </h4>
                                                        <span className={`text-[10px] font-bold px-2 py-0.2 rounded-[4px] uppercase tracking-wider ${
                                                            isCrit ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-amber-50 text-amber-800 border border-amber-200'
                                                        }`}>
                                                            {isCrit ? 'Critique' : 'Vigilance'}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-gray-600 font-medium mt-1 leading-snug">
                                                        {item.description}
                                                    </p>
                                                    {item.details && (
                                                        <div className="mt-1.5 text-[11px] font-semibold text-gray-500 bg-gray-50 px-2 py-1 rounded-[4px] border border-gray-200 inline-block">
                                                            {item.details}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Métriques spécifiques & Actions individuelles */}
                                            <div className="flex md:flex-col items-end justify-between md:justify-center gap-1.5 flex-shrink-0 w-full md:w-auto border-t md:border-t-0 pt-2 md:pt-0 border-gray-100">
                                                {item.financialImpact > 0 && (
                                                    <div className="text-right">
                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Impact</span>
                                                        <span className="text-xs sm:text-sm font-bold text-rose-700 bg-rose-50 px-2 py-0.5 border border-rose-200 rounded-[4px] inline-block">
                                                            {formatPrice(item.financialImpact)}
                                                        </span>
                                                    </div>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const reportId = item.actionReportId || selectedAnomalyGroup.actionReportId;
                                                        setSelectedAnomalyGroup(null);
                                                        handleOpenReportModal(reportId);
                                                    }}
                                                    className="px-2.5 py-1 bg-white hover:bg-gray-50 border-2 border-gray-300 hover:border-[#001d35] text-[#001d35] font-bold text-[11px] uppercase tracking-wider rounded-[4px] flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                                                >
                                                    <span>{item.actionLabel || 'Consulter'}</span>
                                                    <ChevronRight className="w-3 h-3 text-[#f77500]" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
                        </div>

                        {/* Pied de Modale */}
                        <div className="p-3 bg-white border-t-2 border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-2.5 flex-shrink-0">
                            <div className="text-xs font-semibold text-gray-500">
                                Total cumulé du risque : <strong className="text-[#001d35] text-sm">{formatPrice(selectedAnomalyGroup.financialImpact)}</strong>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedAnomalyGroup(null)}
                                className="w-full sm:w-auto px-5 py-2 bg-[#001d35] hover:bg-blue-900 text-white font-bold text-xs uppercase tracking-wider rounded-[4px] cursor-pointer transition-all shadow-sm active:scale-95"
                            >
                                Fermer la vue groupée
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* ── MODALE CLÔTURE ADMINISTRATIVE DE CAISSE EN AVEUGLE (Cockpit 360°)   ── */}
            {/* ========================================================================= */}
            {showCloseSessionModal && (sessionToClose || activeSession) && (
                <div className="fixed inset-0 z-[220] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-lg rounded-[4px] shadow-2xl border-t-4 border-[#001d35] overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh] relative">
                        
                        {/* Overlay d'animation lors de la fermeture : Grand Ghost avec Loader tournant */}
                        {isClosingCockpitSession && (
                            <div className="absolute inset-0 bg-white/95 backdrop-blur-md z-50 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
                                <div className="relative flex items-center justify-center mb-6">
                                    <div className="w-28 h-28 rounded-full border-4 border-slate-200 border-t-[#001d35] border-r-[#001d35] animate-spin"></div>
                                    <div className="absolute inset-0 rounded-full bg-slate-100/70 animate-ping opacity-30"></div>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Ghost className="w-14 h-14 text-[#001d35] animate-pulse drop-shadow-sm" />
                                    </div>
                                </div>

                                <h4 className="text-base font-black text-[#001d35] uppercase tracking-wider mb-1">
                                    Clôture Administrative en cours...
                                </h4>
                                <p className="text-xs text-gray-500 font-medium max-w-xs leading-relaxed">
                                    Scellement officiel de l'arrêté de caisse, traçabilité patronale et génération du Procès-Verbal Z.
                                </p>
                            </div>
                        )}

                        {/* En-tête modale épuré */}
                        <div className="p-4 sm:p-5 border-b-2 border-gray-200 flex justify-between items-start bg-white flex-shrink-0">
                            <div>
                                <h3 className="text-sm sm:text-base font-bold text-[#001d35] uppercase tracking-wide flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-[4px] bg-[#001d35] text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                                        <Lock className="w-4 h-4 text-[#f77500]" />
                                    </div>
                                    <span>{closeBlindStep === 1 ? 'Clôture Administrative de Session' : 'Bilan & Scellement de l\'Arrêté'}</span>
                                </h3>
                                <p className="text-gray-500 text-xs mt-1 font-medium">
                                    {closeBlindStep === 1
                                        ? 'Intervention de la Direction : Arrêté physique du tiroir sans consultation préalable du solde'
                                        : 'Contrôle des écarts et justification de l\'arbitrage avant scellement officiel'}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowCloseSessionModal(false)}
                                className="text-gray-400 hover:text-gray-600 p-1 rounded-[4px] transition-colors cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Corps du formulaire */}
                        <form onSubmit={handleExecuteCockpitCloseSession} className="flex flex-col flex-1 overflow-hidden">
                            {/* ÉTAPE 1 : Saisie physique à l'aveugle */}
                            {closeBlindStep === 1 && (
                                <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
                                    {/* Bannière d'avertissement Clôture Administrative */}
                                    <div className="bg-amber-50 border-2 border-amber-300 p-3 rounded-[4px] text-xs text-amber-900 flex items-start gap-2.5">
                                        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                        <div className="space-y-1">
                                            <span className="font-bold uppercase tracking-wider block">
                                                Action Réservée à la Direction (Responsabilité engagée)
                                            </span>
                                            <p className="leading-relaxed">
                                                Vous clôturez la session #{String((sessionToClose || activeSession)?.id || '').slice(0, 15)} ouverte par <strong>{(sessionToClose || activeSession)?.cashierName || 'le caissier'}</strong>. Cette clôture exceptionnelle sera enregistrée au grand livre d'audit avec votre identité.
                                            </p>
                                        </div>
                                    </div>

                                    {/* Motif de l'intervention de Direction */}
                                    <div>
                                        <label className="block text-xs font-bold text-[#001d35] uppercase tracking-wide mb-1.5">
                                            Motif de la Clôture par la Direction *
                                        </label>
                                        <select
                                            value={closeClosureReason}
                                            onChange={(e) => setCloseClosureReason(e.target.value)}
                                            className="w-full px-3 py-2 bg-white border-2 border-gray-300 rounded-[4px] text-xs font-semibold text-gray-800 focus:outline-none focus:border-[#001d35] shadow-xs"
                                        >
                                            <option value="Oubli de clôture du caissier (> 24h)">Oubli de clôture du caissier (&gt; 24h sans arrêté)</option>
                                            <option value="Caissier absent / Urgence ou arrêt maladie">Caissier absent / Urgence ou arrêt maladie</option>
                                            <option value="Changement d'équipe / Passation de caisse">Changement d'équipe / Passation de caisse</option>
                                            <option value="Arrêté exceptionnel de fin de période">Arrêté exceptionnel de fin de période / inventaire</option>
                                        </select>
                                    </div>

                                    {/* Saisie Directe Espèces Physiques */}
                                    <div className="bg-slate-50/80 p-3.5 rounded-[4px] border-2 border-slate-200">
                                        <label className="block text-xs font-bold text-[#001d35] uppercase tracking-wide mb-1.5 flex items-center justify-between">
                                            <span>Espèces Physiques Réelles dans le Tiroir (FCFA) *</span>
                                            <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-[4px] border border-blue-200 uppercase">
                                                Comptage réel
                                            </span>
                                        </label>
                                        <div className="relative">
                                            <Calculator className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <FinancialInput
                                                value={closeCountedCash}
                                                onChange={(e) => setCloseCountedCash(e.target.value)}
                                                className="w-full pl-9 pr-14 py-2 bg-white border-2 border-gray-300 rounded-[4px] focus:border-[#001d35] focus:outline-none font-bold text-base sm:text-lg text-[#001d35]"
                                                placeholder="Ex: 50 000"
                                                required
                                                min="0"
                                                autoFocus
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-xs">FCFA</span>
                                        </div>
                                        <p className="text-[11px] text-gray-500 mt-1.5">
                                            Saisissez la valeur exacte des billets et pièces inventoriés physiquement dans la caisse.
                                        </p>
                                    </div>

                                    {/* Contrôle terminaux facultatifs */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                        <div>
                                            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                                                Mobile Money Reçu (FCFA)
                                            </label>
                                            <FinancialInput
                                                value={closeMobileAmount}
                                                onChange={(e) => setCloseMobileAmount(e.target.value)}
                                                className="w-full px-3 py-1.5 bg-gray-50/50 border border-gray-300 rounded-[4px] text-xs font-semibold text-gray-800"
                                                placeholder="0"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                                                Chèques / Virements (FCFA)
                                            </label>
                                            <FinancialInput
                                                value={closeChequeAmount}
                                                onChange={(e) => setCloseChequeAmount(e.target.value)}
                                                className="w-full px-3 py-1.5 bg-gray-50/50 border border-gray-300 rounded-[4px] text-xs font-semibold text-gray-800"
                                                placeholder="0"
                                            />
                                        </div>
                                    </div>

                                    {/* Observations Direction */}
                                    <div>
                                        <label className="block text-[11px] font-bold text-[#001d35] uppercase tracking-wide mb-1.5">
                                            Observations de la Direction (Optionnel)
                                        </label>
                                        <textarea
                                            rows="2"
                                            value={closeCashierComment}
                                            onChange={(e) => setCloseCashierComment(e.target.value)}
                                            className="w-full px-3 py-2 bg-gray-50/50 border border-gray-300 rounded-[4px] focus:bg-white focus:outline-none focus:border-[#001d35] text-xs text-gray-800 placeholder-gray-400 leading-relaxed shadow-xs"
                                            placeholder="Précisez tout élément utile : remise de clé, vérification conjointe avec un témoin, etc."
                                        ></textarea>
                                    </div>
                                </div>
                            )}

                            {/* ÉTAPE 2 : Bilan, Comparaison & Révélation de l'Écart */}
                            {closeBlindStep === 2 && (
                                <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
                                    <div className="border-2 border-gray-200 rounded-[4px] divide-y divide-gray-100 text-xs overflow-hidden bg-white shadow-xs">
                                        <div className="flex justify-between px-3.5 py-2.5 bg-gray-50/70">
                                            <span className="text-gray-500 font-medium">Espèces Comptées par la Direction</span>
                                            <span className="font-bold text-[#001d35]">{formatPrice(effectiveCockpitCash)}</span>
                                        </div>
                                        <div className="flex justify-between px-3.5 py-2.5 bg-gray-50/70">
                                            <span className="text-gray-500 font-medium">Solde Théorique Attendu (Système)</span>
                                            <span className="font-semibold text-gray-700">{formatPrice(targetSessionStats.expectedAmount)}</span>
                                        </div>
                                        <div className={`flex justify-between px-3.5 py-3 font-semibold text-sm ${
                                            calculatedCockpitEcart === 0
                                                ? 'bg-emerald-50 text-emerald-800'
                                                : calculatedCockpitEcart > 0 ? 'bg-amber-50 text-amber-800' : 'bg-rose-50 text-rose-800'
                                        }`}>
                                            <span className="flex items-center gap-1.5 font-bold uppercase text-xs">
                                                {calculatedCockpitEcart === 0 ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                                                Écart Constaté :
                                            </span>
                                            <span className="font-bold">
                                                {calculatedCockpitEcart > 0 ? '+' : ''}{formatPrice(calculatedCockpitEcart)}
                                                {' '}
                                                {calculatedCockpitEcart < 0 ? '(MANQUANT)' : calculatedCockpitEcart > 0 ? '(EXCÉDENT)' : '✓ JUSTE'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Statut & Justification */}
                                    {calculatedCockpitEcart === 0 ? (
                                        <div className="p-3 bg-emerald-50 text-emerald-800 rounded-[4px] border-2 border-emerald-200 text-xs flex items-center gap-2">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                                            <span><strong>Caisse Conforme :</strong> Les montants physiques correspondent au centime près aux calculs système.</span>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <div className={`p-3 rounded-[4px] border-2 text-xs space-y-1 ${
                                                calculatedCockpitEcart < 0 ? 'bg-rose-50 text-rose-800 border-rose-200' : 'bg-amber-50 text-amber-800 border-amber-200'
                                            }`}>
                                                <div className="flex items-center gap-2 font-bold uppercase tracking-wide">
                                                    <AlertTriangle className="w-4 h-4" />
                                                    {calculatedCockpitEcart < 0 ? 'Déficit de caisse constaté' : 'Excédent physique inexpliqué'}
                                                </div>
                                                <p className="font-normal leading-relaxed">
                                                    Cet écart fera l'objet d'un rapport automatique et sera consigné dans le registre des contrôles anti-coulage.
                                                </p>
                                            </div>

                                            <div>
                                                <label className="block text-[11px] font-bold text-rose-700 uppercase tracking-wide mb-1.5">
                                                    ⚠ Justification Obligatoire de la Direction *
                                                </label>
                                                <textarea
                                                    rows="3"
                                                    value={closeJustification}
                                                    onChange={(e) => setCloseJustification(e.target.value)}
                                                    className="w-full px-3 py-2 bg-white border-2 border-rose-300 rounded-[4px] focus:outline-none focus:border-rose-600 text-xs text-gray-800 leading-relaxed shadow-xs"
                                                    placeholder="Ex: Écart constaté lors de la relève administrative, vérification des tickets en cours..."
                                                    required
                                                    autoFocus
                                                ></textarea>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Footer modale */}
                            <div className="p-4 bg-white border-t-2 border-gray-200 flex justify-end gap-2.5 flex-shrink-0">
                                {closeBlindStep === 1 ? (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => setShowCloseSessionModal(false)}
                                            className="px-4 py-2 border-2 border-gray-300 text-gray-700 font-bold uppercase tracking-wider text-xs hover:bg-gray-100 rounded-[4px] cursor-pointer transition-all shadow-sm active:scale-95"
                                        >
                                            Annuler
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleConfirmCockpitBlindCount}
                                            className="px-4 py-2 bg-[#001d35] hover:bg-blue-900 text-white font-bold uppercase tracking-wider text-xs rounded-[4px] cursor-pointer transition-all shadow-sm active:scale-95 flex items-center gap-1.5"
                                        >
                                            <ShieldCheck className="w-4 h-4 text-[#f77500]" />
                                            <span>Vérifier l'Écart</span>
                                            <ChevronRight className="w-3.5 h-3.5" />
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => setCloseBlindStep(1)}
                                            className="px-4 py-2 border-2 border-gray-300 text-gray-700 font-bold uppercase tracking-wider text-xs hover:bg-gray-100 rounded-[4px] cursor-pointer transition-all shadow-sm active:scale-95"
                                        >
                                            Retour au comptage
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={isClosingCockpitSession}
                                            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase tracking-wider text-xs rounded-[4px] cursor-pointer transition-all shadow-sm active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
                                        >
                                            <CheckCircle2 className="w-4 h-4" />
                                            <span>Confirmer & Sceller l'Arrêté</span>
                                        </button>
                                    </>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
};

export default Reports;
