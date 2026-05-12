import React, { useState } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { Shield, Save, Check, X, Info } from 'lucide-react';
import toast from 'react-hot-toast';

const permissionDefinitions = {
    sales: {
        label: "Ventes & Caisse",
        items: {
            pos: "Accès au Point de Vente (Faire une vente)",
            discount: "Autoriser à accorder des remises",
            cancel: "Autoriser l'annulation d'une facture payée",
            debt: "Autoriser les ventes à crédit"
        }
    },
    stock: {
        label: "Stock & Inventaire",
        items: {
            viewCost: "Voir le prix d'achat et la marge (Très sensible)",
            adjust: "Faire des ajustements de stock (Casse, Perte)",
            transfer: "Transférer du stock entre boutiques"
        }
    },
    finance: {
        label: "Finances & Dépenses",
        items: {
            viewBalance: "Voir le solde réel de la caisse",
            expenses: "Effectuer des sorties de caisse (Dépenses)"
        }
    },
    reports: {
        label: "Direction & Rapports",
        items: {
            viewAll: "Accès total aux rapports financiers et bénéfices"
        }
    },
    settings: {
        label: "Configuration",
        items: {
            access: "Accès au module de configuration (Droits administrateur)"
        }
    }
};

const RolesPermissions = () => {
    const { roles, setRoles } = useSettings();
    const [selectedRoleId, setSelectedRoleId] = useState(roles[0]?.id || 'cashier');
    const [isLoading, setIsLoading] = useState(false);

    // Create a local copy of permissions for the selected role to edit before saving
    const [localPermissions, setLocalPermissions] = useState(
        JSON.parse(JSON.stringify(roles.find(r => r.id === selectedRoleId)?.permissions || {}))
    );

    // Update local permissions when changing tabs
    const handleRoleChange = (roleId) => {
        const role = roles.find(r => r.id === roleId);
        if (role) {
            setSelectedRoleId(roleId);
            setLocalPermissions(JSON.parse(JSON.stringify(role.permissions)));
        }
    };

    const togglePermission = (category, key) => {
        if (selectedRoleId === 'admin') {
            toast.error("Le rôle Administrateur/Gérant doit avoir tous les droits.");
            return;
        }
        setLocalPermissions(prev => ({
            ...prev,
            [category]: {
                ...prev[category],
                [key]: !prev[category][key]
            }
        }));
    };

    const handleSave = () => {
        setIsLoading(true);
        setTimeout(() => {
            setRoles(prev => prev.map(r =>
                r.id === selectedRoleId ? { ...r, permissions: localPermissions } : r
            ));
            toast.success("Permissions mises à jour avec succès !");
            setIsLoading(false);
        }, 3000);
    };

    const selectedRole = roles.find(r => r.id === selectedRoleId);

    return (
        <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-[#1c398e] tracking-tight">Rôles & Droits d'Accès</h2>
                    <p className="text-gray-500 text-sm mt-1 font-medium">Définissez très précisément ce que chaque employé a le droit de voir ou de faire.</p>
                </div>
                <button
                    onClick={handleSave}
                    className={`flex items-center gap-2 px-4 py-2 rounded-sm transition-colors shadow-md font-medium ${selectedRoleId === 'admin'
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-[#1c398e] text-white hover:bg-blue-700'
                        }`}
                    disabled={selectedRoleId === 'admin'}
                >
                    <Save className="w-5 h-5" />
                    Enregistrer les droits
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* Liste des rôles (Sidebar) */}
                <div className="md:col-span-1 space-y-2">
                    <div className="bg-white p-3 rounded-sm border-2 border-gray-300 shadow-sm mb-4">
                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                            <Info className="w-4 h-4 text-[#1c398e]" />
                            <span>Sélectionnez un rôle pour voir ou modifier ses permissions.</span>
                        </div>
                    </div>

                    {roles.map(role => (
                        <button
                            key={role.id}
                            onClick={() => handleRoleChange(role.id)}
                            className={`w-full text-left p-4 rounded-sm border-2 transition-all flex items-center justify-between ${selectedRoleId === role.id
                                ? 'border-[#1c398e] bg-blue-50'
                                : 'border-transparent bg-white hover:border-gray-200'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${role.color}`}>
                                    <Shield className="w-4 h-4" />
                                </div>
                                <span className={`font-bold ${selectedRoleId === role.id ? 'text-[#1c398e]' : 'text-gray-700'}`}>
                                    {role.name}
                                </span>
                            </div>
                        </button>
                    ))}
                </div>

                {/* Matrice des permissions */}
                <div className="md:col-span-3">
                    <div className="bg-white rounded-sm shadow-sm border-2 border-gray-300 overflow-hidden">
                        <div className={`p-6 border-b border-gray-100 flex items-center gap-4 ${selectedRole?.color.replace('border-', 'border-b-4 border-')}`}>
                            <div className="p-3 bg-white/50 rounded-sm">
                                <Shield className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold">Permissions : {selectedRole?.name}</h2>
                                {selectedRoleId === 'admin' && (
                                    <p className="text-sm mt-1 opacity-80">L'administrateur possède tous les droits par défaut. Vous ne pouvez pas les révoquer.</p>
                                )}
                            </div>
                        </div>

                        <div className="p-6 space-y-8">
                            {Object.entries(permissionDefinitions).map(([categoryKey, category]) => (
                                <div key={categoryKey} className="space-y-4">
                                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider border-b pb-2">
                                        {category.label}
                                    </h3>

                                    <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
                                        {Object.entries(category.items).map(([permKey, permLabel]) => {
                                            const isGranted = localPermissions[categoryKey]?.[permKey];
                                            const isSensitive = permKey === 'viewCost' || permKey === 'discount' || permKey === 'cancel';

                                            return (
                                                <div
                                                    key={permKey}
                                                    onClick={() => togglePermission(categoryKey, permKey)}
                                                    className={`p-4 rounded-sm border-2 flex items-start justify-between cursor-pointer transition-all ${isGranted
                                                        ? isSensitive ? 'bg-orange-50 border-orange-200' : 'bg-blue-50 border-blue-200'
                                                        : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                                                        } ${selectedRoleId === 'admin' ? 'cursor-not-allowed opacity-80' : ''}`}
                                                >
                                                    <div className="flex-1 pr-4">
                                                        <div className={`font-medium text-sm mb-1 ${isGranted ? (isSensitive ? 'text-orange-800' : 'text-blue-800') : 'text-gray-600'}`}>
                                                            {permLabel}
                                                        </div>
                                                        {isSensitive && (
                                                            <div className="text-[10px] uppercase font-bold text-red-500">Action Sensible</div>
                                                        )}
                                                    </div>

                                                    {/* Toggle Switch UI */}
                                                    <div className={`relative inline-flex h-7 w-[50px] items-center rounded-full transition-colors flex-shrink-0 ${isGranted ? 'bg-[#1c398e]' : 'bg-red-400'}`}>
                                                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${isGranted ? 'translate-x-[26px]' : 'translate-x-1'}`} />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Full-screen Loader */}
            {isLoading && (
                <div className="fixed inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center z-[100] animate-in fade-in duration-200">
                    <div className="flex flex-col items-center gap-4 bg-white p-8 rounded-sm shadow-xl">
                        <div className="w-12 h-12 border-4 border-[#1c398e]/20 border-t-[#1c398e] rounded-full animate-spin"></div>
                        <p className="text-gray-700 font-medium animate-pulse">Mise à jour des accès en cours...</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RolesPermissions;
