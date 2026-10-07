import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
    ChevronDown,
    ChevronRight,
    LogOut,
    Lock,
    X,
    PanelLeftClose,
    PanelLeftOpen,
    Plus,
    LayoutDashboard,
    ShoppingCart,
    Calculator,
    History,
    FileText,
    TrendingUp,
    Users,
    Contact,
    BookOpen,
    FileCheck,
    Package,
    PackagePlus,
    Boxes,
    Tags,
    ArrowLeftRight,
    ClipboardCheck,
    Truck,
    Building2,
    ArrowDownToLine,
    ReceiptText,
    BarChart3,
    Settings,
    Building,
    UserCog,
    Key,
    RotateCcw,
    Receipt
} from 'lucide-react';
import { clsx } from 'clsx';
import { usePurchase } from '../context/PurchaseContext';
import { useInventory } from '../context/InventoryContext';
import { useSales } from '../context/SalesContext';
import { useAuth } from '../context/AuthContext';
import { useSession } from '../context/SessionContext';
import { useDeliveries } from '../context/DeliveryContext';
import { useAnomalies } from '../hooks/useAnomalies';
import Logo from './Logo';
import Icon360 from './Icon360';

const Sidebar = ({ collapsed, onToggle }) => {
    const { orders, suppliers } = usePurchase();
    const { products, getLowStockProducts, openCreateProductModal } = useInventory();
    const { quotes, cart, creditNotes, returns } = useSales();
    const { logout } = useAuth();
    const { activeSession, isOverdue, masterSessions } = useSession();
    const { deliveryNotes } = useDeliveries();
    const { totalCount: anomaliesCount, criticalCount: anomaliesCriticalCount } = useAnomalies();
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

    // Suivi des retours non vus : on persiste le dernier count vu dans localStorage
    const [lastSeenReturnsCount, setLastSeenReturnsCount] = useState(() => {
        try { return parseInt(localStorage.getItem('kblx_sidebar_seen_returns') || '0', 10); }
        catch { return 0; }
    });

    const pendingAuditAlerts = (masterSessions || []).filter(s => {
        const isOpen = s.status === 'open' || !s.endTime;
        const isAlreadyArbitrated = Boolean(s.auditedAt || (s.auditStatus && s.auditStatus !== 'pending_review' && s.auditStatus !== 'pending' && s.auditStatus !== 'in_progress'));
        const hasDiscrepancy = Math.abs(s.difference || 0) > 0;
        return !isOpen && !isAlreadyArbitrated && hasDiscrepancy && (!s.auditStatus || s.auditStatus === 'pending_review' || s.auditStatus === 'pending');
    }).length;
    const activeCreditNotesCount = (creditNotes || []).filter(c => c.status === 'active' || c.status === 'partial').length;
    const totalReturnsCount = (returns || []).length;
    const newReturnsCount = Math.max(0, totalReturnsCount - lastSeenReturnsCount);
    // Badge total Retours & Avoirs = avoirs actifs + nouveaux retours non vus
    const returnsAvoirsBadge = activeCreditNotesCount + newReturnsCount;

    const cartCount = (cart || []).reduce((sum, item) => sum + (item.inputQuantity || item.quantity || 1), 0);
    const activeOrdersCount = orders.filter(o => o.status !== 'Completed').length;
    const suppliersWithDebtCount = suppliers.filter(s => s.balance > 0).length;
    const lowStockCount = getLowStockProducts ? getLowStockProducts().length : products.filter(p => p.stock <= p.minStock).length;
    const pendingQuotesCount = quotes.filter(q => q.status === 'Draft' || q.status === 'En attente').length;
    const pendingDeliveriesCount = (deliveryNotes || []).filter(d => d.status === 'pending' || d.status === 'partial').length;

    // Pour auto-déplier le menu selon la route actuelle
    const location = useLocation();

    const [openMenus, setOpenMenus] = useState({
        'Vente & Caisse': location.pathname.includes('/pos') || location.pathname.includes('/quotes') || location.pathname.includes('/sessions') || location.pathname.includes('/sales'),
        'Stock & Magasin': true,   // Toujours ouvert par défaut
        'Achats & Dépenses': location.pathname.includes('/replenishment') || location.pathname.includes('/suppliers') || location.pathname.includes('/expenses'),
        'Clients & Créances': location.pathname.includes('/debtbook') || location.pathname.includes('/clients') || location.pathname.includes('/deliveries'),
        'Configuration': location.pathname.includes('/settings')
    });

    const [hoveredItem, setHoveredItem] = useState(null);
    const hoverTimeoutRef = useRef(null);

    // Fermer le flyout lors du changement de route
    useEffect(() => {
        setHoveredItem(null);
    }, [location.pathname]);

    // Nettoyer les timeouts
    useEffect(() => {
        return () => {
            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        };
    }, []);

    const handleMouseEnterItem = (item, event) => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        // Au survol, on n'affiche le flyout QUE lorsque la sidebar est repliée (mode icônes)
        // En mode déplié, on n'ouvre plus rien au survol : l'utilisateur doit cliquer.
        if (collapsed) {
            const rect = event.currentTarget.getBoundingClientRect();
            const estimatedHeight = item.subItems ? (item.subItems.length * 42 + 55) : 50;
            let topPos = rect.top;
            if (topPos + estimatedHeight > window.innerHeight - 20) {
                topPos = Math.max(10, window.innerHeight - estimatedHeight - 20);
            }
            setHoveredItem({ item, top: topPos });
        }
    };

    const handleMouseLeaveItem = () => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = setTimeout(() => {
            setHoveredItem(null);
        }, 120);
    };

    const handleFlyoutEnter = () => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };

    const handleFlyoutLeave = () => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = setTimeout(() => {
            setHoveredItem(null);
        }, 100);
    };

    const toggleMenu = (label) => {
        setOpenMenus(prev => ({
            ...prev,
            [label]: !prev[label]
        }));
    };

    const navItems = [
        { icon: LayoutDashboard, label: 'Tableau de bord', path: '/' },
        {
            icon: ShoppingCart, label: 'Vente & Caisse',
            hasCartItems: cartCount > 0,
            cartCount: cartCount,
            subItems: [
                { 
                    label: 'Point de Vente (POS)', 
                    path: '/pos', 
                    icon: Calculator,
                    badge: cartCount,
                    isCartBadge: cartCount > 0 
                },
                { 
                    label: 'Sessions & Audit Caisse', 
                    path: '/sessions', 
                    icon: History,
                    badge: pendingAuditAlerts > 0 ? pendingAuditAlerts : undefined
                },
                { 
                    label: 'Retours & Avoirs', 
                    path: '/sales/returns', 
                    icon: RotateCcw,
                    badge: returnsAvoirsBadge > 0 ? returnsAvoirsBadge : undefined,
                    onNavigate: () => {
                        // Marquer tous les retours actuels comme vus
                        setLastSeenReturnsCount(totalReturnsCount);
                        try { localStorage.setItem('kblx_sidebar_seen_returns', String(totalReturnsCount)); } catch {}
                    }
                },
                { label: 'Devis & Proformas', path: '/quotes', icon: FileText, badge: pendingQuotesCount > 0 ? pendingQuotesCount : undefined },
                { label: 'Facturation Officielle', path: '/invoices', icon: FileCheck },
                { label: 'Performances des Ventes', path: '/sales/analytics', icon: TrendingUp }
            ]
        },
        {
            icon: Users, label: 'Clients & Créances',
            subItems: [
                { label: 'Répertoire Clients', path: '/clients', icon: Contact },
                { label: 'Carnet de Crédit', path: '/debtbook', icon: BookOpen },
                { label: 'Bons d\'Enlèvement (Dépôt)', path: '/deliveries', icon: Truck, badge: pendingDeliveriesCount > 0 ? pendingDeliveriesCount : undefined }
            ]
        },
        {
            icon: Package, label: 'Stock & Magasin',
            hasLowStockWarning: lowStockCount > 0,
            subItems: [
                { 
                    label: 'Nouveau Produit', 
                    isAction: true,
                    icon: PackagePlus,
                    onClick: openCreateProductModal
                },
                { 
                    label: 'Catalogue Produits', 
                    path: '/inventory', 
                    icon: Boxes,
                    isLowStockBadge: lowStockCount > 0,
                    badge: lowStockCount > 0 ? lowStockCount : undefined
                },
                { label: 'Gestion des Catégories', path: '/inventory/categories', icon: Tags },
                { label: 'Mouvements & Ajust.', path: '/inventory/movements', icon: ArrowLeftRight },
                { label: 'Inventaire Physique', path: '/inventory/check', icon: ClipboardCheck }
            ]
        },
        {
            icon: Truck, label: 'Achats & Dépenses',
            subItems: [
                { label: 'Mes Fournisseurs', path: '/suppliers', icon: Building2, badge: suppliersWithDebtCount > 0 ? suppliersWithDebtCount : undefined },
                { label: 'Bons de Commande', path: '/purchase-orders', icon: Receipt, badge: activeOrdersCount > 0 ? activeOrdersCount : undefined },
                { label: 'Réapprovisionnement', path: '/replenishment', icon: ArrowDownToLine },
                { label: 'Dépenses d\'Exploitation', path: '/expenses', icon: ReceiptText }
            ]
        },
        { 
            icon: Icon360, 
            label: 'Direction & Rapports', 
            path: '/reports',
            badge: anomaliesCount,
            criticalCount: anomaliesCriticalCount,
            is360Brain: true
        },
        {
            icon: Settings, label: 'Configuration',
            subItems: [
                { label: 'Mon Entreprise', path: '/settings/company', icon: Building },
                { label: 'Utilisateurs & Équipe', path: '/settings/users', icon: UserCog },
                { label: 'Rôles & Accès', path: '/settings/roles', icon: Key }
            ]
        },
    ];

    // ── Calcul dynamique du badge parent = somme des badges sous-menus ──
    const getParentBadge = (item) => {
        if (!item.subItems) return item.badge || 0;
        return item.subItems.reduce((sum, sub) => sum + (sub.badge || 0), 0);
    };

    const getParentAlertCount = (item) => {
        if (!item.subItems) return item.badge || 0;
        return item.subItems.reduce((sum, sub) => sum + (!sub.isCartBadge && sub.badge ? sub.badge : 0), 0);
    };

    return (
        <>
            <aside className={clsx(
                "hidden md:flex flex-col h-screen fixed left-0 top-0 bg-[#001d35] shadow-xl transition-all duration-300 print:hidden overflow-hidden",
                collapsed ? "w-16" : "w-64",
                showLogoutConfirm ? "z-[200]" : "z-10"
            )}>
            {/* Logo + Toggle */}
            <div className="p-4 bg-[#001d35] border-b border-white/10 flex items-center gap-3 shadow-sm z-20 flex-shrink-0">
                <img src="/kabllix-logo-white.svg" alt="Kabllix Icon" className="h-8 w-8 drop-shadow-sm flex-shrink-0" />
                {!collapsed && <Logo className="h-6 text-white flex-1 min-w-0" />}
                <button
                    onClick={onToggle}
                    title={collapsed ? 'Agrandir la sidebar' : 'Réduire la sidebar'}
                    className="ml-auto p-1.5 rounded-sm text-white/50 hover:text-white hover:bg-white/10 transition-all cursor-pointer flex-shrink-0"
                >
                    {collapsed
                        ? <PanelLeftOpen className="w-4 h-4" />
                        : <PanelLeftClose className="w-4 h-4" />}
                </button>
            </div>

            <nav className={clsx("flex-1 space-y-1.5 overflow-y-auto", collapsed ? "p-2" : "p-4")}>
                {navItems.map((item) => {
                    const hasSub = item.subItems && item.subItems.length > 0;
                    const isOpen = openMenus[item.label];

                    // Determine if a parent is active based on children
                    const isActiveParent = hasSub && item.subItems.some(sub => location.pathname === sub.path || (sub.path !== '/' && location.pathname.startsWith(sub.path)));

                    return (
                        <div
                            key={item.label}
                            className="flex flex-col relative"
                            onMouseEnter={(e) => handleMouseEnterItem(item, e)}
                            onMouseLeave={handleMouseLeaveItem}
                        >
                            {hasSub ? (
                                <button
                                    onClick={() => !collapsed && toggleMenu(item.label)}
                                    title={collapsed ? item.label : undefined}
                                    className={clsx(
                                        'flex items-center w-full relative transition-all duration-200 group text-left border rounded-sm',
                                        collapsed ? 'justify-center px-2 py-3' : 'justify-between px-4 py-3',
                                        isActiveParent
                                            ? 'bg-white text-[#001d35] font-semibold shadow-sm border-transparent'
                                            : 'bg-white/5 border-white/10 text-gray-100 hover:bg-white/10 hover:border-white/20 hover:text-white'
                                    )}
                                >
                                    <div className={clsx("flex items-center", collapsed ? '' : 'gap-3')}>
                                        <div className="relative">
                                            <item.icon className={clsx("w-5 h-5 flex-shrink-0", isActiveParent ? 'text-[#001d35]' : 'text-gray-300 group-hover:text-white')} />
                                            {collapsed && (
                                                (item.hasLowStockWarning || item.hasOverdueSession || getParentAlertCount(item) > 0) ? (
                                                    <span 
                                                        title={`${getParentAlertCount(item) || lowStockCount} alerte(s)`}
                                                        className="absolute -top-1.5 -right-2 w-4 h-4 rounded-full bg-red-600 border border-red-700 flex items-center justify-center flex-shrink-0 shadow-xs animate-pulse"
                                                    >
                                                        <span className="text-white font-black text-[10px] leading-none select-none">!</span>
                                                    </span>
                                                ) : item.hasCartItems ? (
                                                    <span 
                                                        title={`${item.cartCount} produit(s) en panier`}
                                                        className="absolute -top-1.5 -right-1.5 w-2.5 h-2.5 rounded-full bg-amber-500 border border-[#001d35] animate-pulse"
                                                    ></span>
                                                ) : null
                                            )}
                                        </div>
                                        {!collapsed && <span className="font-semibold tracking-wide uppercase text-[11px]">{item.label}</span>}
                                    </div>
                                    {!collapsed && (
                                        <div className="flex items-center gap-2">
                                            {item.hasCartItems && (
                                                <span className="bg-amber-500 text-white text-xs font-black px-2 py-0.5 rounded-full shadow-sm animate-pulse flex items-center justify-center border border-amber-400" title="Panier en cours de vente">
                                                    {item.cartCount}
                                                </span>
                                            )}
                                            {(item.hasLowStockWarning || item.hasOverdueSession || getParentAlertCount(item) > 0) && (
                                                <span 
                                                    className="w-5 h-5 rounded-full bg-red-600 border border-red-700 flex items-center justify-center flex-shrink-0 shadow-xs animate-pulse" 
                                                    title={`Alertes (${getParentAlertCount(item) || lowStockCount} élément(s))`}>
                                                    <span className="text-white font-black text-xs leading-none select-none">!</span>
                                                </span>
                                            )}
                                            {isOpen ? <ChevronDown className={clsx("w-4 h-4", isActiveParent ? "text-[#001d35]" : "text-gray-300")} strokeWidth={3} /> : <ChevronRight className={clsx("w-4 h-4", isActiveParent ? "text-[#001d35]" : "text-gray-300")} strokeWidth={3} />}
                                        </div>
                                    )}
                                </button>
                            ) : (
                                <NavLink
                                    to={item.path}
                                    end={item.path === '/'}
                                    title={collapsed ? item.label : undefined}
                                    className={({ isActive }) =>
                                        clsx(
                                            'flex items-center relative transition-all duration-200 group origin-left border rounded-sm',
                                            collapsed ? 'justify-center px-2 py-3' : 'justify-between px-4 py-3',
                                            isActive
                                                ? 'bg-white text-[#001d35] font-semibold shadow-sm border-transparent'
                                                : 'bg-white/5 border-white/10 text-gray-100 hover:bg-white/10 hover:border-white/20 hover:text-white'
                                        )
                                    }
                                >
                                    <div className={clsx("flex items-center", collapsed ? '' : 'gap-3')}>
                                        <div className="relative flex-shrink-0">
                                            <item.icon className={clsx(
                                                "flex-shrink-0 transition-transform",
                                                item.icon === Icon360 ? "w-12 h-7" : "w-5 h-5 text-current opacity-90"
                                            )} />
                                            {collapsed && item.badge > 0 && (
                                                <span 
                                                    title={`${item.badge} anomalie(s) détectée(s)`}
                                                    className="absolute -top-1.5 -right-2 w-4 h-4 rounded-full bg-red-600 border border-red-700 flex items-center justify-center flex-shrink-0 shadow-xs animate-pulse"
                                                >
                                                    <span className="text-white font-black text-[10px] leading-none select-none">!</span>
                                                </span>
                                            )}
                                        </div>
                                        {!collapsed && <span className="font-semibold tracking-wide uppercase text-[11px]">{item.label}</span>}
                                    </div>
                                    {!collapsed && item.path === '/' && (
                                        <span
                                            role="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                onToggle();
                                            }}
                                            title="Réduire la barre latérale"
                                            className="opacity-40 hover:opacity-100 transition-opacity p-1 hover:bg-black/10 rounded cursor-pointer ml-auto"
                                        >
                                            <PanelLeftClose className="w-3.5 h-3.5" />
                                        </span>
                                    )}
                                    {!collapsed && item.badge > 0 && (
                                        <span 
                                            className="w-5 h-5 rounded-full bg-red-600 border border-red-700 flex items-center justify-center flex-shrink-0 shadow-xs animate-pulse" 
                                            title={`${item.badge} anomalie(s) détectée(s)`}
                                        >
                                            <span className="text-white font-black text-xs leading-none select-none">!</span>
                                        </span>
                                    )}
                                </NavLink>
                            )}

                            {/* Menu Déroulant (SubItems) — masqué en mode réduit */}
                            {hasSub && isOpen && !collapsed && (
                                <div className="mt-1 ml-4 border-l-2 border-white/20 pl-2 flex flex-col gap-1 overflow-hidden">
                                    {item.subItems.map(sub => (
                                        <React.Fragment key={sub.path || sub.label}>
                                            {sub.isAction ? (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        sub.onClick();
                                                    }}
                                                    className="w-full flex items-center justify-between px-3 py-2 text-sm rounded-sm transition-all text-gray-200 hover:bg-white/10 hover:text-white cursor-pointer group text-left"
                                                    title="Créer un nouveau produit"
                                                >
                                                    <div className="flex items-center">
                                                        {sub.icon ? (
                                                            <sub.icon className="w-4 h-4 mr-2 text-sky-400 group-hover:scale-110 transition-transform stroke-[2.2] flex-shrink-0" />
                                                        ) : (
                                                            <Plus className="w-3.5 h-3.5 mr-2 text-sky-400 group-hover:scale-110 transition-transform stroke-[2.5]" />
                                                        )}
                                                        <span className="font-semibold tracking-wide text-[11px]">{sub.label}</span>
                                                    </div>
                                                </button>
                                            ) : (
                                                <div className="flex items-center gap-1">
                                                    <NavLink
                                                        to={sub.path}
                                                        end={sub.path === '/inventory'}
                                                        onClick={() => { if (sub.onNavigate) sub.onNavigate(); }}
                                                        className={({ isActive }) =>
                                                            clsx(
                                                                'flex-1 flex items-center justify-between px-3 py-2 text-sm rounded-sm transition-all group',
                                                                isActive
                                                                    ? 'text-white font-bold bg-white/20'
                                                                    : 'text-gray-200 hover:bg-white/10 hover:text-white'
                                                            )
                                                        }
                                                    >
                                                        <div className="flex items-center">
                                                            {sub.icon ? (
                                                                <sub.icon className="w-4 h-4 mr-2.5 opacity-70 group-hover:opacity-100 flex-shrink-0 transition-opacity" />
                                                            ) : (
                                                                <div className="w-1.5 h-1.5 rounded-full bg-current mr-2.5 opacity-60" />
                                                            )}
                                                            <span className="font-semibold tracking-wide text-[11px]">{sub.label}</span>
                                                        </div>
                                                        {sub.isCartBadge ? (
                                                            <span className="bg-amber-500 text-white text-xs font-black px-2 py-0.5 rounded-full shadow-sm animate-pulse flex items-center justify-center min-w-[20px] border border-amber-400" title="Articles dans le panier">
                                                                {sub.badge}
                                                            </span>
                                                        ) : (sub.badge > 0 || sub.isLowStockBadge || sub.isOverdueBadge) && (
                                                            <span 
                                                                className="w-5 h-5 rounded-full bg-red-600 border border-red-700 flex items-center justify-center flex-shrink-0 shadow-xs animate-pulse" 
                                                                title={`${sub.label} (${sub.badge || lowStockCount})`}>
                                                                <span className="text-white font-black text-xs leading-none select-none">!</span>
                                                            </span>
                                                        )}
                                                    </NavLink>
                                                </div>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}


            </nav>

            <div className="p-4 border-t border-white/20 flex-shrink-0">
                <button
                    onClick={() => setShowLogoutConfirm(true)}
                    title={collapsed ? 'Déconnexion' : undefined}
                    className={clsx(
                        "flex items-center py-3 w-full text-white hover:bg-red-500 hover:text-white rounded-sm transition-colors group",
                        collapsed ? 'justify-center px-2' : 'gap-3 px-4 text-left'
                    )}
                >
                    <LogOut className="w-5 h-5 flex-shrink-0 text-gray-300 group-hover:text-white" />
                    {!collapsed && <span className="font-semibold tracking-wide uppercase text-[11px]">Déconnexion</span>}
                </button>
            </div>

            {/* Modal de Confirmation de Déconnexion */}
            {showLogoutConfirm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className={clsx("bg-white w-full max-w-sm rounded-sm shadow-2xl border-t-4 overflow-hidden transform animate-in zoom-in-95 duration-200", activeSession ? "border-amber-500" : "border-[#001d35]")}>
                        {/* En-tête */}
                        <div className="p-5 border-b border-gray-200 flex justify-between items-start bg-white flex-shrink-0">
                            <div>
                                <h3 className="text-sm sm:text-base font-bold text-[#001d35] uppercase tracking-wide">
                                    {activeSession ? "Session Caisse Ouverte" : "Déconnexion"}
                                </h3>
                                <p className="text-gray-500 text-xs mt-0.5 font-normal">
                                    Confirmation de fermeture de session
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowLogoutConfirm(false)}
                                className="text-gray-400 hover:text-gray-600 p-1 rounded transition-colors cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Corps */}
                        <div className="p-5 text-center space-y-3">
                            <div className="flex justify-center">
                                {activeSession ? (
                                    <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 font-bold text-xl flex items-center justify-center border border-amber-300">
                                        !
                                    </div>
                                ) : (
                                    <div className="w-12 h-12 rounded-full bg-blue-50 text-[#001d35] flex items-center justify-center border border-blue-100">
                                        <LogOut className="w-6 h-6" />
                                    </div>
                                )}
                            </div>

                            <h4 className="text-gray-900 font-bold text-sm uppercase tracking-wide">
                                {activeSession ? "Votre caisse n'est pas clôturée" : "Voulez-vous vous déconnecter ?"}
                            </h4>
                            <p className={clsx("text-xs leading-relaxed font-normal", activeSession ? "text-amber-800 bg-amber-50 p-2.5 rounded-sm border border-amber-200" : "text-gray-500")}>
                                {activeSession
                                    ? "Votre session de caisse est toujours en cours. Il est fortement recommandé de la clôturer avant de quitter le poste."
                                    : "Vos données sont sauvegardées. Les paniers de caisse (POS) non finalisés seront réinitialisés."}
                            </p>
                        </div>

                        {/* Actions */}
                        <div className="p-4 bg-white border-t border-gray-200 flex justify-end gap-3 flex-shrink-0">
                            <button
                                type="button"
                                onClick={() => setShowLogoutConfirm(false)}
                                className="px-5 py-2.5 border-2 border-gray-200 text-gray-700 font-bold uppercase tracking-wider text-xs hover:bg-gray-50 rounded-sm cursor-pointer transition-colors text-center"
                            >
                                Annuler
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowLogoutConfirm(false);
                                    logout();
                                }}
                                className="px-5 py-2.5 bg-[#001d35] hover:bg-[#002d52] text-white font-bold uppercase tracking-wider text-xs rounded-sm cursor-pointer transition-colors shadow-sm text-center"
                            >
                                Se Déconnecter
                            </button>
                        </div>
                    </div>
                </div>
            )}
            </aside>

            {/* Flyout Submenu flottant au survol en mode réduit */}
            {collapsed && hoveredItem && (
                <div
                    onMouseEnter={handleFlyoutEnter}
                    onMouseLeave={handleFlyoutLeave}
                    style={{ top: `${hoveredItem.top}px` }}
                    className="fixed left-16 z-[160] pl-1 animate-in fade-in zoom-in-95 duration-150 print:hidden hidden md:block"
                >
                    <div className="w-64 bg-[#001424] border border-white/20 rounded-r-md shadow-2xl overflow-hidden py-1.5 backdrop-blur-md">
                        {/* En-tête du flyout */}
                        <div className="px-4 py-2.5 border-b border-white/10 flex items-center justify-between bg-white/5">
                            <div className="flex items-center gap-2.5">
                                <hoveredItem.item.icon className="w-5 h-5 text-sky-400 flex-shrink-0" />
                                <span className="font-bold text-white text-xs uppercase tracking-wider">
                                    {hoveredItem.item.label}
                                </span>
                            </div>
                            {hoveredItem.item.hasCartItems && (
                                <span className="bg-amber-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                                    {hoveredItem.item.cartCount} en panier
                                </span>
                            )}
                            {(hoveredItem.item.hasLowStockWarning || hoveredItem.item.hasOverdueSession || getParentAlertCount(hoveredItem.item) > 0) && (
                                <span 
                                    className="w-5 h-5 rounded-full bg-red-600 border border-red-700 flex items-center justify-center flex-shrink-0 shadow-xs animate-pulse"
                                    title={`Alertes détectées (${getParentAlertCount(hoveredItem.item) || lowStockCount} élément(s))`}>
                                    <span className="text-white font-black text-xs leading-none select-none">!</span>
                                </span>
                            )}
                        </div>

                        {/* Liens du sous-menu ou lien direct */}
                        <div className="flex flex-col py-1">
                            {hoveredItem.item.subItems ? (
                                hoveredItem.item.subItems.map((sub) => {
                                    if (sub.isAction) {
                                        return (
                                            <button
                                                key={sub.label}
                                                type="button"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    setHoveredItem(null);
                                                    sub.onClick();
                                                }}
                                                className="flex items-center gap-2.5 px-4 py-2.5 transition-colors cursor-pointer text-gray-200 hover:bg-white/10 hover:text-white text-left w-full group"
                                            >
                                                {sub.icon ? (
                                                    <sub.icon className="w-4 h-4 text-sky-400 group-hover:scale-110 transition-transform stroke-[2.2] flex-shrink-0" />
                                                ) : (
                                                    <Plus className="w-3.5 h-3.5 text-sky-400 group-hover:scale-110 transition-transform stroke-[2.5]" />
                                                )}
                                                <span className="text-[13px] font-medium tracking-wide">{sub.label}</span>
                                            </button>
                                        );
                                    }
                                    const isSubActive = location.pathname === sub.path;
                                    return (
                                        <NavLink
                                            key={sub.path}
                                            to={sub.path}
                                            end={sub.path === '/inventory'}
                                            onClick={() => { setHoveredItem(null); if (sub.onNavigate) sub.onNavigate(); }}
                                            className={clsx(
                                                "flex items-center justify-between px-4 py-2.5 transition-colors cursor-pointer group",
                                                isSubActive
                                                    ? "bg-white text-[#001d35] font-bold"
                                                    : "text-gray-200 hover:bg-white/10 hover:text-white"
                                            )}
                                        >
                                            <div className="flex items-center gap-2.5">
                                                {sub.icon ? (
                                                    <sub.icon className="w-4 h-4 opacity-70 group-hover:opacity-100 flex-shrink-0 transition-opacity" />
                                                ) : (
                                                    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                                                )}
                                                <span className="text-[13px] font-medium tracking-wide">{sub.label}</span>
                                            </div>
                                            {sub.isCartBadge ? (
                                                <span className="bg-amber-500 text-white text-[11px] font-black px-2 py-0.5 rounded-full animate-pulse">
                                                    {sub.badge}
                                                </span>
                                            ) : (sub.badge > 0 || sub.isLowStockBadge || sub.isOverdueBadge) && (
                                                <span 
                                                    className="w-5 h-5 rounded-full bg-red-600 border border-red-700 flex items-center justify-center flex-shrink-0 shadow-xs animate-pulse" 
                                                    title={`${sub.label} (${sub.badge || lowStockCount})`}>
                                                    <span className="text-white font-black text-xs leading-none select-none">!</span>
                                                </span>
                                            )}
                                        </NavLink>
                                    );
                                })
                            ) : (
                                <NavLink
                                    to={hoveredItem.item.path}
                                    end={hoveredItem.item.path === '/'}
                                    onClick={() => setHoveredItem(null)}
                                    className={clsx(
                                        "flex items-center gap-2.5 px-4 py-2.5 transition-colors cursor-pointer",
                                        location.pathname === hoveredItem.item.path
                                            ? "bg-white text-[#001d35] font-bold"
                                            : "text-gray-200 hover:bg-white/10 hover:text-white"
                                    )}
                                >
                                    <hoveredItem.item.icon className="w-4 h-4 opacity-70 flex-shrink-0" />
                                    <span className="text-[13px] font-medium tracking-wide">Ouvrir {hoveredItem.item.label}</span>
                                </NavLink>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default Sidebar;
