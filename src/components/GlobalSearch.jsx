import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { 
    Search, X, ArrowRight, CornerDownLeft, Sparkles, 
    Package, Users, Building2, Calculator, RotateCcw, 
    FileText, DollarSign, ShieldAlert, History, BookOpen, 
    Truck, ReceiptText, Tags, ArrowLeftRight, ClipboardCheck, 
    Settings, PlusCircle, AlertTriangle, Layers
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { useSales } from '../context/SalesContext';
import { useClients } from '../context/ClientContext';
import { usePurchase } from '../context/PurchaseContext';
import { useSettings } from '../context/SettingsContext';
import { useSession } from '../context/SessionContext';
import { formatPrice } from '../utils/currency';

/**
 * GlobalSearch.jsx
 * Barre de recherche universelle intégrée dans le Header
 * Avec menu déroulant de suggestions en temps réel.
 * 
 * Raccourci clavier universel : Ctrl + K ou ⌘ + K
 */
const GlobalSearch = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);

    const inputRef = useRef(null);
    const containerRef = useRef(null);
    const listRef = useRef(null);

    const navigate = useNavigate();
    const { products = [], openCreateProductModal } = useInventory();
    const { quotes = [], returns = [], creditNotes = [] } = useSales();
    const { clients = [] } = useClients();
    const { suppliers = [] } = usePurchase();
    const { currentStoreId } = useSettings();
    const { activeSession } = useSession();

    // ── Raccourci Clavier Global (Ctrl + K ou ⌘ + K ou '/') ──
    useEffect(() => {
        const handleKeyDown = (e) => {
            const isTypingInField = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
            
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setIsOpen(true);
                setTimeout(() => inputRef.current?.focus(), 50);
            } else if (e.key === '/' && !isTypingInField) {
                e.preventDefault();
                setIsOpen(true);
                setTimeout(() => inputRef.current?.focus(), 50);
            } else if (e.key === 'Escape' && isOpen) {
                e.preventDefault();
                handleClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    // ── Clic en dehors pour fermer ──
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // ── Modules & Pages du Système ──
    const systemPages = useMemo(() => [
        {
            id: 'page_pos',
            title: 'Point de Vente (POS)',
            category: 'pages',
            description: 'Encaisser des ventes au comptoir, paniers et facturation rapide',
            path: '/pos',
            icon: Calculator,
            color: 'bg-emerald-500 text-white',
            keywords: ['caisse', 'pos', 'vendre', 'vente', 'ticket', 'encaissement', 'comptoir']
        },
        {
            id: 'page_sessions',
            title: 'Sessions & Audit Caisse',
            category: 'pages',
            description: 'Clôtures en aveugle, contrôle des écarts de caisse et arrêtés Z',
            path: '/sessions',
            icon: History,
            color: 'bg-blue-600 text-white',
            keywords: ['session', 'cloture', 'audit', 'ecart', 'billetage', 'coulage', 'argent']
        },
        {
            id: 'page_returns',
            title: 'Retours & Bons d\'Avoir',
            category: 'pages',
            description: 'Gestion des retours de marchandises, réintégrations et avoirs clients',
            path: '/sales/returns',
            icon: RotateCcw,
            color: 'bg-amber-600 text-white',
            keywords: ['retour', 'avoir', 'bon', 'remboursement', 'casse', 'avarie', 'echange']
        },
        {
            id: 'page_quotes',
            title: 'Devis & Proformas',
            category: 'pages',
            description: 'Édition de devis professionnels, proformas pour chantiers et relances',
            path: '/quotes',
            icon: FileText,
            color: 'bg-indigo-600 text-white',
            keywords: ['devis', 'proforma', 'estimation', 'chantier', 'chiffrage']
        },
        {
            id: 'page_analytics',
            title: 'Performances des Ventes',
            category: 'pages',
            description: 'Statistiques du chiffre d\'affaires, marges et articles les plus vendus',
            path: '/sales/analytics',
            icon: DollarSign,
            color: 'bg-teal-600 text-white',
            keywords: ['performance', 'vente', 'statistique', 'chiffre', 'ca', 'top']
        },
        {
            id: 'page_inventory',
            title: 'Catalogue Produits & Stock',
            category: 'pages',
            description: 'Consulter et modifier l\'ensemble des articles, prix et niveaux de stock',
            path: '/inventory',
            icon: Package,
            color: 'bg-orange-500 text-white',
            keywords: ['stock', 'produit', 'article', 'catalogue', 'marchandise', 'prix', 'rayon']
        },
        {
            id: 'page_categories',
            title: 'Gestion des Catégories',
            category: 'pages',
            description: 'Organiser les rayons : Cimenterie, Plomberie, Ferraillage, Électricité...',
            path: '/inventory/categories',
            icon: Tags,
            color: 'bg-amber-700 text-white',
            keywords: ['categorie', 'rayon', 'famille', 'classement']
        },
        {
            id: 'page_movements',
            title: 'Mouvements & Ajustements',
            category: 'pages',
            description: 'Historique des entrées/sorties et ajustements manuels de stock',
            path: '/inventory/movements',
            icon: ArrowLeftRight,
            color: 'bg-slate-700 text-white',
            keywords: ['mouvement', 'ajustement', 'perte', 'entree', 'sortie', 'transfert']
        },
        {
            id: 'page_check',
            title: 'Inventaire Physique',
            category: 'pages',
            description: 'Comptage physique des rayons et rapprochement théorique vs réel',
            path: '/inventory/check',
            icon: ClipboardCheck,
            color: 'bg-purple-600 text-white',
            keywords: ['inventaire', 'comptage', 'physique', 'ecart stock']
        },
        {
            id: 'page_clients',
            title: 'Répertoire des Clients',
            category: 'pages',
            description: 'Fiches clients, artisans, entreprises BTP, coordonnées et chantiers',
            path: '/clients',
            icon: Users,
            color: 'bg-cyan-600 text-white',
            keywords: ['client', 'repertoire', 'artisan', 'macon', 'btp', 'contact']
        },
        {
            id: 'page_debtbook',
            title: 'Carnet de Crédit & Dettes Clients',
            category: 'pages',
            description: 'Suivi des créances en souffrance, relances et remboursements de crédit',
            path: '/debtbook',
            icon: BookOpen,
            color: 'bg-rose-600 text-white',
            keywords: ['dette', 'credit', 'creance', 'carnet', 'impaye', 'recouvrement']
        },
        {
            id: 'page_deliveries',
            title: 'Bons d\'Enlèvement & Expéditions',
            category: 'pages',
            description: 'Gestion des livraisons chantiers, sorties de dépôt et transporteurs',
            path: '/deliveries',
            icon: Truck,
            color: 'bg-slate-800 text-white',
            keywords: ['bl', 'livraison', 'expedition', 'enlevement', 'depot', 'chauffeur']
        },
        {
            id: 'page_suppliers',
            title: 'Mes Fournisseurs',
            category: 'pages',
            description: 'Répertoire des fabricants, grossistes de fer, cimenteries et usines',
            path: '/suppliers',
            icon: Building2,
            color: 'bg-blue-800 text-white',
            keywords: ['fournisseur', 'grossiste', 'usine', 'cimtogo', 'fabricant']
        },
        {
            id: 'page_replenishment',
            title: 'Réapprovisionnement Fournisseurs',
            category: 'pages',
            description: 'Créer et suivre les bons de commande d\'achat et réceptions stock',
            path: '/replenishment',
            icon: Layers,
            color: 'bg-sky-700 text-white',
            keywords: ['reappro', 'commande', 'achat', 'reception', 'bon de commande']
        },
        {
            id: 'page_expenses',
            title: 'Dépenses d\'Exploitation',
            category: 'pages',
            description: 'Enregistrer les charges, carburant, salaires, manutention et loyers',
            path: '/expenses',
            icon: ReceiptText,
            color: 'bg-red-700 text-white',
            keywords: ['depense', 'charge', 'frais', 'loyer', 'carburant', 'manutention']
        },
        {
            id: 'page_reports',
            title: 'Direction & Rapports 360°',
            category: 'pages',
            description: 'Cockpit exécutif, diagnostic du magasin, radar d\'anomalies et Ticket Z',
            path: '/reports',
            icon: ShieldAlert,
            color: 'bg-[#001d35] text-amber-400',
            keywords: ['rapport', '360', 'direction', 'cockpit', 'radar', 'patron', 'anomalie', 'audit']
        },
        {
            id: 'page_company',
            title: 'Configuration Entreprise',
            category: 'pages',
            description: 'Paramètres légaux, boutiques, logo, TVA, devises et coordonnées',
            path: '/settings/company',
            icon: Settings,
            color: 'bg-gray-700 text-white',
            keywords: ['parametre', 'entreprise', 'configuration', 'societe', 'boutique']
        }
    ], []);

    // ── Actions Rapides Instantanées ──
    const quickActions = useMemo(() => [
        {
            id: 'action_new_product',
            title: 'Nouveau Produit',
            subtitle: 'Ouvrir la fiche de création d\'un article',
            category: 'actions',
            icon: PlusCircle,
            badge: 'Création',
            color: 'bg-orange-500 text-white',
            action: () => {
                if (openCreateProductModal) openCreateProductModal();
                else navigate('/inventory');
            },
            keywords: ['nouveau produit', 'creer produit', 'ajouter article', 'nouvel article']
        },
        {
            id: 'action_open_pos',
            title: 'Ouvrir la Caisse POS',
            subtitle: 'Accéder directement à l\'écran de vente comptoir',
            category: 'actions',
            icon: Calculator,
            badge: 'Vente',
            color: 'bg-emerald-600 text-white',
            action: () => navigate('/pos'),
            keywords: ['ouvrir caisse', 'vendre', 'pos', 'nouvelle vente']
        },
        {
            id: 'action_new_return',
            title: 'Enregistrer un Retour Marchandise',
            subtitle: 'Créer un bon d\'avoir ou remboursement client',
            category: 'actions',
            icon: RotateCcw,
            badge: 'SAV',
            color: 'bg-amber-600 text-white',
            action: () => navigate('/sales/returns'),
            keywords: ['nouveau retour', 'creer avoir', 'retourner article', 'rembourser']
        },
        {
            id: 'action_new_quote',
            title: 'Créer un Nouveau Devis',
            subtitle: 'Rédiger une offre de prix ou facture proforma',
            category: 'actions',
            icon: FileText,
            badge: 'Devis',
            color: 'bg-indigo-600 text-white',
            action: () => navigate('/quotes'),
            keywords: ['nouveau devis', 'creer devis', 'proforma']
        },
        {
            id: 'action_new_expense',
            title: 'Déclarer une Dépense',
            subtitle: 'Saisir une sortie d\'espèces ou charge immédiate',
            category: 'actions',
            icon: ReceiptText,
            badge: 'Finance',
            color: 'bg-red-600 text-white',
            action: () => navigate('/expenses'),
            keywords: ['nouvelle depense', 'declarer charge', 'sortie caisse']
        },
        {
            id: 'action_session_audit',
            title: 'Vérifier la Session de Caisse',
            subtitle: activeSession ? `Session ouverte par ${activeSession.cashierName || 'Caissier'}` : 'Caisse fermée — Effectuer l\'ouverture',
            category: 'actions',
            icon: History,
            badge: 'Caisse',
            color: 'bg-blue-600 text-white',
            action: () => navigate('/sessions'),
            keywords: ['verifier caisse', 'cloturer caisse', 'ouvrir session']
        }
    ], [openCreateProductModal, navigate, activeSession]);

    // ── Moteur de Recherche Multi-Entités ──
    const results = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();
        
        // Si aucun terme saisi : proposer actions rapides et modules
        if (!query) {
            return [
                {
                    groupTitle: '⚡ Actions Rapides Fréquentes',
                    items: quickActions.slice(0, 4)
                },
                {
                    groupTitle: '🧭 Modules Principaux',
                    items: systemPages.slice(0, 5)
                }
            ];
        }

        const groups = [];

        // 1. Actions Rapides
        const matchedActions = quickActions.filter(act => 
            act.title.toLowerCase().includes(query) ||
            act.subtitle.toLowerCase().includes(query) ||
            act.keywords?.some(k => k.includes(query))
        );
        if (matchedActions.length > 0) {
            groups.push({
                groupTitle: '⚡ Actions Rapides',
                items: matchedActions
            });
        }

        // 2. Pages & Modules
        const matchedPages = systemPages.filter(p => 
            p.title.toLowerCase().includes(query) ||
            p.description.toLowerCase().includes(query) ||
            p.keywords?.some(k => k.includes(query))
        );
        if (matchedPages.length > 0) {
            groups.push({
                groupTitle: '🧭 Modules & Outils',
                items: matchedPages
            });
        }

        // 3. Produits en Stock
        const matchedProducts = products.filter(p => {
            const nameMatch = (p.name || '').toLowerCase().includes(query);
            const refMatch = (p.reference || p.sku || p.code || '').toLowerCase().includes(query);
            const barcodeMatch = (p.barcode || '').toLowerCase().includes(query);
            const catMatch = (p.category || '').toLowerCase().includes(query);
            return nameMatch || refMatch || barcodeMatch || catMatch;
        }).slice(0, 6).map(p => {
            const currentStock = p.stockLevels?.[currentStoreId] ?? p.stock ?? 0;
            const minStock = p.minStockLevels?.[currentStoreId] ?? p.minStock ?? 0;
            const isLow = currentStock <= minStock;
            return {
                id: `prod_${p.id}`,
                title: p.name,
                subtitle: `Réf: ${p.reference || p.code || 'N/A'} • Cat: ${p.category || 'Général'}`,
                category: 'products',
                icon: Package,
                color: isLow ? 'bg-rose-500 text-white' : 'bg-emerald-600 text-white',
                extra: (
                    <div className="text-right">
                        <div className="font-mono font-bold text-xs text-[#001d35]">
                            {formatPrice(p.price || 0)}
                        </div>
                        <div className={`text-[10px] font-bold ${isLow ? 'text-rose-600' : 'text-slate-500'}`}>
                            {isLow ? `⚠️ ${currentStock} ${p.unit || 'unités'}` : `${currentStock} ${p.unit || 'unités'}`}
                        </div>
                    </div>
                ),
                action: () => navigate(`/inventory?search=${encodeURIComponent(p.name)}`)
            };
        });

        if (matchedProducts.length > 0) {
            groups.push({
                groupTitle: '📦 Produits & Articles en Stock',
                items: matchedProducts
            });
        }

        // 4. Clients & Débiteurs
        const matchedClients = clients.filter(c => {
            const nameMatch = (c.name || '').toLowerCase().includes(query);
            const phoneMatch = (c.phone || '').toLowerCase().includes(query);
            const typeMatch = (c.type || '').toLowerCase().includes(query);
            return nameMatch || phoneMatch || typeMatch;
        }).slice(0, 4).map(c => {
            const debt = parseFloat(c.totalDebt) || 0;
            return {
                id: `client_${c.id}`,
                title: c.name,
                subtitle: `${c.phone || 'Pas de numéro'} • Type : ${c.type || 'Particulier'}`,
                category: 'clients',
                icon: Users,
                color: debt > 0 ? 'bg-rose-600 text-white' : 'bg-cyan-600 text-white',
                extra: (
                    <div className="text-right">
                        {debt > 0 ? (
                            <span className="inline-block px-1.5 py-0.5 rounded-sm bg-rose-100 text-rose-800 font-bold font-mono text-[10px]">
                                Dette: {formatPrice(debt)}
                            </span>
                        ) : (
                            <span className="text-[10px] font-semibold text-emerald-600">
                                Solde à jour
                            </span>
                        )}
                    </div>
                ),
                action: () => navigate(debt > 0 ? '/debtbook' : '/clients')
            };
        });

        if (matchedClients.length > 0) {
            groups.push({
                groupTitle: '👥 Clients & Carnet de Dettes',
                items: matchedClients
            });
        }

        // 5. Fournisseurs
        const matchedSuppliers = suppliers.filter(s => {
            const nameMatch = (s.name || '').toLowerCase().includes(query);
            const phoneMatch = (s.phone || '').toLowerCase().includes(query);
            const contactMatch = (s.contactName || '').toLowerCase().includes(query);
            return nameMatch || phoneMatch || contactMatch;
        }).slice(0, 3).map(s => ({
            id: `supp_${s.id}`,
            title: s.name,
            subtitle: `Contact: ${s.contactName || s.phone || 'Non renseigné'}`,
            category: 'suppliers',
            icon: Building2,
            color: 'bg-blue-800 text-white',
            action: () => navigate('/suppliers')
        }));

        if (matchedSuppliers.length > 0) {
            groups.push({
                groupTitle: '🏢 Fournisseurs',
                items: matchedSuppliers
            });
        }

        // 6. Retours & Bons d'Avoir
        const matchedReturns = (returns || []).filter(r => {
            const numMatch = (r.returnNumber || '').toLowerCase().includes(query);
            const custMatch = (r.customerName || '').toLowerCase().includes(query);
            return numMatch || custMatch;
        }).slice(0, 3).map(r => ({
            id: `ret_${r.id}`,
            title: `Retour ${r.returnNumber}`,
            subtitle: `Client : ${r.customerName || 'Comptoir'} • Montant : ${formatPrice(r.totalAmount || 0)}`,
            category: 'returns',
            icon: RotateCcw,
            color: 'bg-amber-600 text-white',
            action: () => navigate('/sales/returns')
        }));

        if (matchedReturns.length > 0) {
            groups.push({
                groupTitle: '🔄 Retours & SAV',
                items: matchedReturns
            });
        }

        return groups;
    }, [searchTerm, quickActions, systemPages, products, clients, suppliers, returns, currentStoreId, navigate]);

    // Aplatir les éléments pour la navigation au clavier
    const flatItems = useMemo(() => {
        return results.flatMap(g => g.items);
    }, [results]);

    // Réinitialiser la sélection lors d'une nouvelle frappe
    useEffect(() => {
        setSelectedIndex(0);
    }, [searchTerm]);

    const handleSelect = (item) => {
        if (!item) return;
        if (item.action) {
            item.action();
        } else if (item.path) {
            navigate(item.path);
        }
        handleClose();
    };

    const handleClose = () => {
        setIsOpen(false);
        setSearchTerm('');
        inputRef.current?.blur();
    };

    // Gestion de la navigation flèche haut / bas / entrée
    const handleKeyDownInput = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (flatItems.length > 0) {
                setSelectedIndex(prev => (prev + 1) % flatItems.length);
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (flatItems.length > 0) {
                setSelectedIndex(prev => (prev - 1 + flatItems.length) % flatItems.length);
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (flatItems[selectedIndex]) {
                handleSelect(flatItems[selectedIndex]);
            }
        }
    };

    let runningIndex = 0;

    return (
        <>
            {/* Arrière-plan subtilement flouté lorsque le champ est actif */}
            {isOpen && createPortal(
                <div 
                    className="fixed inset-0 z-30 bg-slate-950/25 backdrop-blur-[2px] transition-all duration-200"
                    onClick={handleClose}
                />,
                document.body
            )}

            <div ref={containerRef} className="relative flex-1 max-w-xl min-w-[200px]">
            {/* ── Champ de recherche Header ── */}
            <div 
                className={`flex items-center gap-2 px-3 py-1.5 rounded-sm border transition-all duration-200 ${
                    isOpen 
                        ? 'bg-white border-[#f77500] ring-2 ring-[#f77500]/30 shadow-lg text-gray-900' 
                        : 'bg-white/10 hover:bg-white/15 border-white/20 text-white placeholder-white/50 focus-within:bg-white focus-within:border-[#f77500] focus-within:text-gray-900'
                }`}
            >
                <Search className={`w-4 h-4 flex-shrink-0 transition-colors ${isOpen ? 'text-[#001d35]' : 'text-white/60'}`} />
                
                <input
                    ref={inputRef}
                    type="text"
                    value={searchTerm}
                    onChange={(e) => {
                        setSearchTerm(e.target.value);
                        if (!isOpen) setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    onKeyDown={handleKeyDownInput}
                    placeholder="Rechercher un produit, client, module, action... (Ctrl+K)"
                    className="w-full bg-transparent text-xs font-medium focus:outline-none placeholder:text-inherit placeholder:opacity-60 truncate"
                />

                {searchTerm ? (
                    <button
                        type="button"
                        onClick={() => {
                            setSearchTerm('');
                            inputRef.current?.focus();
                        }}
                        className="p-0.5 rounded-sm hover:bg-black/10 text-gray-500 transition-colors cursor-pointer"
                        title="Effacer la recherche"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                ) : (
                    <kbd className={`hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono font-bold rounded-sm select-none pointer-events-none transition-colors ${
                        isOpen ? 'bg-gray-100 text-gray-600 border border-gray-300' : 'bg-white/15 text-white/70 border border-white/20'
                    }`}>
                        <span>Ctrl</span><span>K</span>
                    </kbd>
                )}
            </div>

            {/* ── Menu déroulant des suggestions & résultats ── */}
            {isOpen && (
                <div 
                    ref={listRef}
                    className="absolute left-0 top-full mt-2 w-full sm:w-[580px] bg-white rounded-sm border-2 border-gray-300 shadow-2xl z-[150] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                >
                    {/* Bannière supérieure de contexte */}
                    <div className="bg-slate-100 px-3 py-1.5 border-b border-gray-200 flex items-center justify-between text-[11px] text-gray-600">
                        <span className="font-bold uppercase tracking-wider text-[#001d35] flex items-center gap-1.5">
                            <Sparkles className="w-3 h-3 text-[#f77500]" />
                            {searchTerm ? `Résultats pour « ${searchTerm} »` : 'Suggestions Rapides'}
                        </span>
                        <span className="text-[10px] text-gray-400">
                            {flatItems.length} suggestion(s)
                        </span>
                    </div>

                    {/* Liste groupée des résultats */}
                    <div className="max-h-[380px] overflow-y-auto divide-y divide-gray-100 p-1.5 space-y-2">
                        {results.length === 0 || flatItems.length === 0 ? (
                            <div className="py-8 px-4 text-center space-y-2">
                                <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
                                <p className="font-bold text-xs uppercase tracking-wide text-[#001d35]">
                                    Aucun élément trouvé pour « {searchTerm} »
                                </p>
                                <p className="text-[11px] text-gray-500 max-w-sm mx-auto">
                                    Vérifiez l'orthographe ou essayez un nom d'article (ex: <em>Ciment</em>, <em>Tuyau</em>), un nom de client, un code-barres ou une page.
                                </p>
                            </div>
                        ) : (
                            results.map((group, groupIdx) => (
                                <div key={groupIdx} className="space-y-1">
                                    <div className="px-2 pt-1.5 pb-0.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                                        {group.groupTitle}
                                    </div>
                                    <div className="space-y-0.5">
                                        {group.items.map((item) => {
                                            const itemIndex = runningIndex++;
                                            const isSelected = itemIndex === selectedIndex;
                                            const IconComp = item.icon || Package;

                                            return (
                                                <button
                                                    key={item.id}
                                                    type="button"
                                                    onClick={() => handleSelect(item)}
                                                    onMouseEnter={() => setSelectedIndex(itemIndex)}
                                                    className={`w-full px-2.5 py-2 rounded-sm text-left flex items-center justify-between gap-3 transition-colors cursor-pointer border ${
                                                        isSelected
                                                            ? 'bg-blue-50/80 border-[#f77500] text-[#001d35] shadow-2xs'
                                                            : 'bg-white hover:bg-gray-50 border-transparent text-gray-800'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                        <div className={`p-1.5 rounded-sm flex-shrink-0 ${item.color || 'bg-slate-700 text-white'}`}>
                                                            <IconComp className="w-4 h-4" />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <h4 className="font-bold text-xs truncate text-[#001d35]">
                                                                    {item.title}
                                                                </h4>
                                                                {item.badge && (
                                                                    <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded-sm bg-gray-100 text-gray-700 border border-gray-300">
                                                                        {item.badge}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-[11px] text-gray-500 truncate">
                                                                {item.subtitle || item.description}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* Élément additionnel à droite (Prix, dette, ou flèche Entrée) */}
                                                    <div className="flex items-center gap-2 flex-shrink-0">
                                                        {item.extra}
                                                        {isSelected ? (
                                                            <span className="p-1 rounded bg-[#001d35] text-white flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider shadow-2xs">
                                                                <span>Ouvrir</span>
                                                                <CornerDownLeft className="w-3 h-3 text-[#f77500]" />
                                                            </span>
                                                        ) : (
                                                            <ArrowRight className="w-3.5 h-3.5 text-gray-300" />
                                                        )}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* ── Pied de page avec raccourcis de navigation ── */}
                    <div className="bg-slate-50 px-3 py-2 border-t border-gray-200 flex items-center justify-between text-[10px] text-gray-500 select-none">
                        <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1">
                                <kbd className="px-1 py-0.5 bg-white border border-gray-300 rounded text-gray-700 font-mono">↑↓</kbd> Naviguer
                            </span>
                            <span className="flex items-center gap-1">
                                <kbd className="px-1 py-0.5 bg-white border border-gray-300 rounded text-gray-700 font-mono">↵</kbd> Ouvrir
                            </span>
                            <span className="flex items-center gap-1">
                                <kbd className="px-1 py-0.5 bg-white border border-gray-300 rounded text-gray-700 font-mono">Échap</kbd> Fermer
                            </span>
                        </div>
                        <span className="font-bold text-[#001d35] uppercase tracking-wider">
                            Kabllix Quick Search
                        </span>
                    </div>
                </div>
            )}
        </div>
        </>
    );
};

export default GlobalSearch;
