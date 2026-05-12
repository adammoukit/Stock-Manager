import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { Menu, Search, Bell, AlertTriangle, TrendingUp, Lock, Unlock } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { useSales } from '../context/SalesContext';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { useSession } from '../context/SessionContext';
import { formatPrice } from '../utils/currency';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const DashboardLayout = () => {
    const [showNotifications, setShowNotifications] = useState(false);
    const { getLowStockProducts } = useInventory();
    const { transactions, expenses } = useSales();
    const { company, currentStoreId, setCurrentStoreId, stores } = useSettings();
    const { user } = useAuth();
    const { activeSession } = useSession();
    const navigate = useNavigate();
    const [isSwitching, setIsSwitching] = useState(false);
    const switchingTimeout = useRef(null);

    const handleStoreSwitch = (newStoreId) => {
        if (newStoreId === currentStoreId) return;
        setIsSwitching(true);
        // Laisser le loader apparaître une fraction de seconde avant de changer les données
        setTimeout(() => {
            setCurrentStoreId(newStoreId);
        }, 100);
        // Masquer le loader après que React a re-rendu avec les nouvelles données
        if (switchingTimeout.current) clearTimeout(switchingTimeout.current);
        switchingTimeout.current = setTimeout(() => {
            setIsSwitching(false);
        }, 1500);
    };

    // Nettoyage au démontage
    useEffect(() => () => { if (switchingTimeout.current) clearTimeout(switchingTimeout.current); }, []);

    // Calculate alerts
    const lowStockCount = getLowStockProducts().length;

    // Synchroniser le calcul de la marge avec Dashboard.jsx pour éviter les écarts
    const { products } = useInventory();
    const estimatedMargin = transactions.reduce((sum, t) => {
        const transactionMargin = t.items.reduce((itemSum, item) => {
            const product = products.find(p => p.id === item.id);
            const salePriceTotal = item.isBulk ? item.bulkPrice * item.inputQuantity : (item.price || 0) * (item.inputQuantity || item.quantity || 0);
            const deductedQty = item.stockDeduction || item.quantity || 1;
            
            const basicUnitPurchasePrice = product && product.purchasePrice 
                ? product.purchasePrice 
                : (salePriceTotal / Math.max(1, deductedQty)) * 0.8;
                
            const costTotal = basicUnitPurchasePrice * deductedQty;
            return itemSum + (salePriceTotal - costTotal);
        }, 0);
        return sum + transactionMargin;
    }, 0);

    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const netProfit = estimatedMargin - totalExpenses;

    const totalNotifications = (lowStockCount > 0 ? 1 : 0) + (netProfit < 0 ? 1 : 0);

    return (
        <div className="min-h-screen bg-[#e8eef4]">
            <Sidebar />

            <div className="md:ml-64 transition-all duration-300">
                {/* Header */}
                <header className="sticky top-0 z-20 px-6 py-4 flex items-center justify-between bg-[#1c398e] shadow-md">
                    <div className="flex items-center gap-4">
                        <button className="md:hidden p-2 hover:bg-white/10 rounded-sm text-white transition-colors">
                            <Menu className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Session de Caisse Status */}
                        {activeSession ? (
                            <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-sm px-3 py-1.5 backdrop-blur-sm">
                                <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse flex-shrink-0 shadow-[0_0_8px_rgba(52,211,153,0.6)]"></span>
                                <div className="hidden sm:block">
                                    <p className="text-white/60 font-medium text-[9px] uppercase tracking-wider leading-none">État de la caisse</p>
                                    <p className="text-white font-bold text-[11px] mt-0.5">{activeSession.cashierName} &bull; depuis {format(new Date(activeSession.startTime), 'HH:mm', { locale: fr })}</p>
                                </div>
                                <Unlock size={14} className="text-emerald-300" />
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-sm px-3 py-1.5">
                                <span className="w-3 h-3 rounded-full bg-red-400 flex-shrink-0"></span>
                                <div className="hidden sm:block">
                                    <p className="text-white/60 font-medium text-[9px] uppercase tracking-wider leading-none">État de la caisse</p>
                                    <p className="text-white/80 font-bold text-[11px] mt-0.5">Caisse Fermée</p>
                                </div>
                                <Lock size={14} className="text-red-300" />
                            </div>
                        )}
                        <div className="relative">
                            <button
                                onClick={() => setShowNotifications(!showNotifications)}
                                className="p-2 hover:bg-white/10 rounded-full relative text-white cursor-pointer transition-colors"
                            >
                                <Bell className="w-5 h-5" />
                                {totalNotifications > 0 && (
                                    <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center font-bold">
                                        {totalNotifications}
                                    </span>
                                )}
                            </button>

                            {/* Notifications Dropdown */}
                            {showNotifications && (
                                <div className="absolute right-0 mt-2 w-96 bg-white rounded-sm border border-gray-200 shadow-lg z-50">
                                    <div className="p-4 border-b border-gray-200">
                                        <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                            <AlertTriangle className="w-5 h-5 text-orange-500" />
                                            Notifications ({totalNotifications})
                                        </h3>
                                    </div>
                                    <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
                                        {totalNotifications === 0 ? (
                                            <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-sm">
                                                <TrendingUp className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                                                <div className="flex-1">
                                                    <p className="font-semibold text-green-900">Tout va bien !</p>
                                                    <p className="text-sm text-green-700">
                                                        Aucune alerte pour le moment.
                                                    </p>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                {/* Low Stock Alert */}
                                                {lowStockCount > 0 && (
                                                    <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-sm">
                                                        <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                                        <div className="flex-1">
                                                            <p className="font-semibold text-red-900">Stock Faible</p>
                                                            <p className="text-sm text-red-700">
                                                                {lowStockCount} produit(s) nécessitent un réapprovisionnement.
                                                            </p>
                                                        </div>
                                                        <button
                                                            onClick={() => {
                                                                navigate('/inventory?filter=low_stock');
                                                                setShowNotifications(false);
                                                            }}
                                                            className="text-sm font-medium text-red-600 hover:text-red-700 underline"
                                                        >
                                                            Voir
                                                        </button>
                                                    </div>
                                                )}

                                                {/* Negative Profit Alert */}
                                                {netProfit < 0 && (
                                                    <div className="flex items-start gap-3 p-3 bg-orange-50 border border-orange-200 rounded-sm">
                                                        <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                                                        <div className="flex-1">
                                                            <p className="font-semibold text-orange-900">Bénéfice Négatif</p>
                                                            <p className="text-sm text-orange-700">
                                                                Vos dépenses ({formatPrice(totalExpenses)}) dépassent votre marge.
                                                            </p>
                                                        </div>
                                                        <button
                                                            onClick={() => {
                                                                navigate('/expenses');
                                                                setShowNotifications(false);
                                                            }}
                                                            className="text-sm font-medium text-orange-600 hover:text-orange-700 underline"
                                                        >
                                                            Gérer
                                                        </button>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Store Selector */}
                        <div className="flex items-center gap-2 pl-4 border-l border-white/20">
                            <select 
                                value={currentStoreId}
                                onChange={(e) => handleStoreSwitch(e.target.value)}
                                className="bg-[#152c70] border border-white/20 text-white font-medium text-sm rounded-sm px-3 py-2 outline-none hover:bg-[#0f2052] transition-colors focus:ring-2 focus:ring-white/50 cursor-pointer"
                            >
                                {stores.map(store => (
                                    <option key={store.id} value={store.id} className="text-gray-900 bg-white font-medium">
                                        {store.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="flex items-center gap-3 pl-4 border-l border-white/20">
                            <div className="text-right hidden sm:block">
                                <p className="text-sm font-medium text-white">
                                    {user ? `${user.firstName} ${user.lastName}` : (company.name || 'Admin User')}
                                </p>
                                <p className="text-xs text-gray-200 uppercase tracking-wider font-semibold">
                                    {user?.role || 'Gérant'}
                                </p>
                            </div>
                            <div className="w-10 h-10 bg-white/10 border border-white/20 rounded-full flex items-center justify-center text-white font-bold shadow-sm backdrop-blur-sm">
                                {user ? user.firstName.substring(0, 1) + user.lastName.substring(0, 1) : 'AU'}
                            </div>
                        </div>
                    </div>
                </header>

                {/* Main Content */}
                <main className="p-4">
                    <Outlet />
                </main>
            </div>

            {/* Click outside to close notifications */}
            {showNotifications && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowNotifications(false)}
                />
            )}

            {/* Store Switching Loader */}
            {isSwitching && (
                <div className="fixed inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-[200] animate-in fade-in duration-150">
                    <div className="flex flex-col items-center gap-5 bg-white px-10 py-8 rounded-sm shadow-2xl border border-gray-100">
                        <div className="w-14 h-14 border-4 border-[#1c398e]/20 border-t-[#1c398e] rounded-full animate-spin"></div>
                        <div className="text-center">
                            <p className="text-gray-900 font-bold text-base">
                                Chargement de la boutique...
                            </p>
                            <p className="text-gray-500 text-sm mt-1">
                                {stores.find(s => s.id === currentStoreId)?.name}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>

    );
};

export default DashboardLayout;
