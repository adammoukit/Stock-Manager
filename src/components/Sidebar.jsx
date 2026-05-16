import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
    ChevronDown,
    ChevronRight,
    Folder,
    FileText,
    LogOut,
    Lock
} from 'lucide-react';
import { clsx } from 'clsx';
import { usePurchase } from '../context/PurchaseContext';
import { useInventory } from '../context/InventoryContext';
import { useSales } from '../context/SalesContext';
import { useAuth } from '../context/AuthContext';

const Sidebar = () => {
    const { orders, suppliers } = usePurchase();
    const { products } = useInventory();
    const { quotes } = useSales();
    const { logout } = useAuth();
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [showFolderTree, setShowFolderTree] = useState(true);

    const activeOrdersCount = orders.filter(o => o.status !== 'Completed').length;
    const suppliersWithDebtCount = suppliers.filter(s => s.balance > 0).length;
    const lowStockCount = products.filter(p => p.stock <= p.minStock).length;
    const pendingQuotesCount = quotes.filter(q => q.status === 'Draft' || q.status === 'En attente').length;

    // Pour auto-déplier le menu selon la route actuelle
    const location = useLocation();

    const [openMenus, setOpenMenus] = useState({
        'Vente & Caisse': location.pathname.includes('/pos') || location.pathname.includes('/quotes'),
        'Stock & Magasin': true,   // Toujours ouvert par défaut
        'Achats & Dépenses': location.pathname.includes('/replenishment') || location.pathname.includes('/suppliers') || location.pathname.includes('/expenses'),
        'Clients & Créances': location.pathname.includes('/debtbook') || location.pathname.includes('/clients') || location.pathname.includes('/deliveries'),
        'Configuration': location.pathname.includes('/settings')
    });

    const toggleMenu = (label) => {
        setOpenMenus(prev => {
            // Si le menu cliqué est déjà ouvert, on le ferme. Sinon on ouvre UNIQUEMENT celui-ci.
            return prev[label] ? {} : { [label]: true };
        });
    };

    const navItems = [
        { icon: 'apps', label: 'Tableau de bord', path: '/' },
        {
            icon: 'shopping-cart', label: 'Vente & Caisse', badge: pendingQuotesCount,
            subItems: [
                { label: 'Point de Vente (POS)', path: '/pos' },
                { label: 'Sessions de Caisse', path: '/sessions' },
                { label: 'Devis & Proformas', path: '/quotes', badge: pendingQuotesCount }
            ]
        },
        {
            icon: 'users-alt', label: 'Clients & Créances',
            subItems: [
                { label: 'Répertoire Clients', path: '/clients' },
                { label: 'Carnet de Crédit', path: '/debtbook' },
                { label: 'Bons de Livraison', path: '/deliveries' }
            ]
        },
        {
            icon: 'package', label: 'Stock & Magasin', badge: lowStockCount,
            subItems: [
                { label: 'Catalogue Produits', path: '/inventory', badge: lowStockCount },
                { label: 'Mouvements & Ajust.', path: '/inventory/movements' },
                { label: 'Inventaire Physique', path: '/inventory/check' }
            ]
        },
        {
            icon: 'truck', label: 'Achats & Dépenses', badge: activeOrdersCount + suppliersWithDebtCount,
            subItems: [
                { label: 'Mes Fournisseurs', path: '/suppliers', badge: suppliersWithDebtCount },
                { label: 'Réapprovisionnement', path: '/replenishment', badge: activeOrdersCount },
                { label: 'Dépenses d\'Exploitation', path: '/expenses' }
            ]
        },
        { icon: 'chart-growth', label: 'Direction & Rapports', path: '/reports' },
        {
            icon: 'setting', label: 'Configuration',
            subItems: [
                { label: 'Mon Entreprise', path: '/settings/company' },
                { label: 'Utilisateurs & Équipe', path: '/settings/users' },
                { label: 'Rôles & Accès', path: '/settings/roles' }
            ]
        },
    ];

    const buildRouteTree = (items) => {
        const root = {};

        items.forEach((item) => {
            const targets = item.subItems?.length ? item.subItems : [item];
            targets.forEach((target) => {
                if (!target.path) return;
                const parts = target.path.split('/').filter(Boolean);
                let current = root;
                parts.forEach((part, idx) => {
                    if (!current[part]) {
                        current[part] = { __children: {}, __leaf: false };
                    }
                    if (idx === parts.length - 1) {
                        current[part].__leaf = true;
                    }
                    current = current[part].__children;
                });
            });
        });

        return root;
    };

    const routeTree = buildRouteTree(navItems);

    const renderTree = (node, depth = 0, basePath = '') =>
        Object.keys(node).sort().map((segment) => {
            const currentPath = `${basePath}/${segment}`;
            const hasChildren = Object.keys(node[segment].__children).length > 0;
            const isActive = location.pathname === currentPath || location.pathname.startsWith(`${currentPath}/`);

            return (
                <div key={currentPath}>
                    <div
                        className={clsx(
                            'flex items-center gap-2 py-1 rounded-sm',
                            isActive ? 'text-white font-semibold' : 'text-gray-200'
                        )}
                        style={{ paddingLeft: `${depth * 14}px` }}
                    >
                        {hasChildren ? <Folder className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                        <span className="text-[11px] uppercase tracking-wide">{segment}</span>
                    </div>
                    {hasChildren && renderTree(node[segment].__children, depth + 1, currentPath)}
                </div>
            );
        });

    return (
        <aside className={clsx(
            "w-64 hidden md:flex flex-col h-screen fixed left-0 top-0 bg-[#1c398e] shadow-xl transition-all duration-300",
            showLogoutConfirm ? "z-[200]" : "z-10"
        )}>
            <div className="p-5 bg-white border-b border-gray-200 flex items-center justify-center gap-3 shadow-sm z-20">
                <img src="/kabllix-logo-primary.svg" alt="Kabllix Icon" className="h-9 w-9 drop-shadow-sm" />
                <img src="/kabllix-logo.svg" alt="Kabllix Text" className="h-6" />
            </div>

            <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
                {navItems.map((item) => {
                    const hasSub = item.subItems && item.subItems.length > 0;
                    const isOpen = openMenus[item.label];

                    // Determine if a parent is active based on children
                    const isActiveParent = hasSub && item.subItems.some(sub => location.pathname === sub.path || (sub.path !== '/' && location.pathname.startsWith(sub.path)));

                    return (
                        <div key={item.label} className="flex flex-col">
                            {hasSub ? (
                                <button
                                    onClick={() => toggleMenu(item.label)}
                                    className={clsx(
                                        'flex items-center w-full relative justify-between px-4 py-3 rounded-sm transition-all duration-200 group text-left border',
                                        isActiveParent
                                            ? 'bg-white text-[#1c398e] font-semibold shadow-sm border-transparent'
                                            : 'bg-white/5 border-white/10 text-gray-100 hover:bg-white/10 hover:border-white/20 hover:text-white'
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <i className={clsx(`uil uil-${item.icon} text-xl`, isActiveParent ? 'text-[#1c398e]' : 'text-gray-300 group-hover:text-white')}></i>
                                        <span className="font-semibold tracking-wide uppercase text-[11px]">{item.label}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {item.badge > 0 && (
                                            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-sm">
                                                {item.badge}
                                            </span>
                                        )}
                                        {isOpen ? <ChevronDown className={clsx("w-4 h-4", isActiveParent ? "text-[#1c398e]" : "text-gray-300")} strokeWidth={3} /> : <ChevronRight className={clsx("w-4 h-4", isActiveParent ? "text-[#1c398e]" : "text-gray-300")} strokeWidth={3} />}
                                    </div>
                                </button>
                            ) : (
                                <NavLink
                                    to={item.path}
                                    end={item.path === '/'}
                                    className={({ isActive }) =>
                                        clsx(
                                            'flex items-center relative justify-between px-4 py-3 rounded-sm transition-all duration-200 group origin-left border',
                                            isActive
                                                ? 'bg-white text-[#1c398e] font-semibold shadow-sm border-transparent'
                                                : 'bg-white/5 border-white/10 text-gray-100 hover:bg-white/10 hover:border-white/20 hover:text-white'
                                        )
                                    }
                                >
                                    <div className="flex items-center gap-3">
                                        <i className={`uil uil-${item.icon} text-xl text-current opacity-90`}></i>
                                        <span className="font-semibold tracking-wide uppercase text-[11px]">{item.label}</span>
                                    </div>
                                    {item.badge > 0 && (
                                        <span className="bg-red-500 absolute -top-2 right-0 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-sm">
                                            {item.badge}
                                        </span>
                                    )}
                                </NavLink>
                            )}

                            {/* Menu Déroulant (SubItems) */}
                            {hasSub && isOpen && (
                                <div className="mt-1 ml-4 border-l-2 border-white/20 pl-2 flex flex-col gap-1 overflow-hidden">
                                    {item.subItems.map(sub => (
                                        <NavLink
                                            key={sub.path}
                                            to={sub.path}
                                            end={sub.path === '/inventory'}
                                            className={({ isActive }) =>
                                                clsx(
                                                    'flex items-center justify-between px-4 py-2.5 text-sm rounded-sm transition-all',
                                                    isActive
                                                        ? 'text-white font-bold bg-white/20'
                                                        : 'text-gray-200 hover:bg-white/10 hover:text-white'
                                                )
                                            }
                                        >
                                            <div className="flex items-center">
                                                <div className="w-1.5 h-1.5 rounded-full bg-current mr-3 opacity-60" />
                                                <span className="font-semibold tracking-wide uppercase text-[11px]">{sub.label}</span>
                                            </div>
                                            {sub.badge > 0 && (
                                                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                                    {sub.badge}
                                                </span>
                                            )}
                                        </NavLink>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}

                <div className="mt-5 pt-4 border-t border-white/20">
                    <button
                        onClick={() => setShowFolderTree(prev => !prev)}
                        className="w-full flex items-center justify-between px-2 py-2 text-gray-100 hover:bg-white/10 rounded-sm transition-colors"
                    >
                        <span className="font-semibold tracking-wide uppercase text-[11px]">Arborescence du dossier</span>
                        {showFolderTree ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>

                    {showFolderTree && (
                        <div className="mt-2 px-2 py-2 bg-white/5 rounded-sm border border-white/10">
                            {renderTree(routeTree)}
                        </div>
                    )}
                </div>
            </nav>

            <div className="p-4 border-t border-white/20">
                <button
                    onClick={() => setShowLogoutConfirm(true)}
                    className="flex items-center gap-3 px-4 py-3 w-full text-left text-white hover:bg-red-500 hover:text-white rounded-sm transition-colors group"
                >
                    <i className="uil uil-signout text-xl"></i>
                    <span className="font-semibold tracking-wide uppercase text-[11px]">Déconnexion</span>
                </button>
            </div>

            {/* Modal de Confirmation de Déconnexion */}
            {showLogoutConfirm && (
                <div className="fixed inset-0 bg-blue-900/40 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-sm rounded-sm border-2 border-blue-800 shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden transform animate-in zoom-in-95 duration-200">
                        {/* En-tête */}
                        <div className="bg-[#1c398e] p-4 flex items-center gap-3 border-b-2 border-blue-800">
                            <div className="bg-white/20 p-2 rounded-sm border border-white/30 backdrop-blur-sm">
                                <LogOut className="w-6 h-6 text-white" />
                            </div>
                            <h3 className="text-white font-black uppercase tracking-[0.15em] text-sm">Sécurité de session</h3>
                        </div>

                        {/* Corps */}
                        <div className="p-8 text-center space-y-6">
                            <div className="flex justify-center">
                                <div className="relative">
                                    <div className="absolute inset-0 bg-red-100 rounded-full blur-xl opacity-50 animate-pulse"></div>
                                    <Lock className="w-20 h-20 relative z-10 text-red-500 drop-shadow-lg" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h4 className="text-gray-900 font-black text-xl uppercase tracking-tight">Fin de session ?</h4>
                                <p className="text-gray-500 text-sm font-medium leading-relaxed">
                                    Vous êtes sur le point de fermer votre session. Vos données sont automatiquement sauvegardées, mais tout panier de caisse (POS) non validé sera réinitialisé.
                                </p>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="p-5 bg-gray-50 flex gap-3 border-t border-gray-100">
                            <button
                                onClick={() => setShowLogoutConfirm(false)}
                                className="flex-1 px-4 py-3 rounded-sm border-2 border-gray-300 text-gray-700 font-black uppercase text-xs tracking-widest hover:bg-white hover:border-[#1c398e] hover:text-[#1c398e] transition-all active:scale-95"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={() => {
                                    setShowLogoutConfirm(false);
                                    logout();
                                }}
                                className="flex-1 px-4 py-3 rounded-sm bg-red-600 border-2 border-red-800 text-white font-black uppercase text-xs tracking-widest shadow-[0_4px_0_rgb(153,27,27)] hover:shadow-none hover:translate-y-1 transition-all active:scale-95"
                            >
                                Déconnexion
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </aside>
    );
};

export default Sidebar;
