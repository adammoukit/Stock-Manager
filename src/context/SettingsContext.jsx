import React, { createContext, useContext, useState } from 'react';

const SettingsContext = createContext();

export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider = ({ children }) => {
    // 1. Informations de l'entreprise
    const [company, setCompany] = useState({
        name: 'Quincaillerie La Prospérité',
        nif: '000123456789',
        phone: '+225 01 02 03 04 05',
        email: 'contact@prosperite-quincaillerie.com',
        address: 'Boulevard de la République, Abidjan',
        receiptMessage: 'Les marchandises vendues ne sont ni reprises ni échangées. Merci de votre visite !',
        logo: null
    });

    // 2. Gestion de l'abonnement et des boutiques
    const [subscription, setSubscription] = useState({
        planName: 'Basic',
        price: 8000,
        maxStores: 1, // 8000 = 1, 15000 = 2, 20000 = 3, 40000 = Infini
        status: 'Active',
        expiryDate: '2026-12-31'
    });

    const [stores, setStores] = useState([]);
    const [currentStoreId, setCurrentStoreId] = useState(localStorage.getItem('kabllix_currentStoreId'));

    const refreshStores = async () => {
        const token = localStorage.getItem('kabllix_token');
        if (!token) return;

        try {
            const response = await fetch('http://localhost:8080/api/stores', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.ok) {
                const data = await response.json();
                setStores(data);
                // Si aucune boutique n'est sélectionnée ou si la boutique actuelle n'est pas dans la liste
                if (!currentStoreId || !data.find(s => s.id === currentStoreId)) {
                    if (data.length > 0) {
                        setCurrentStoreId(data[0].id);
                        localStorage.setItem('kabllix_currentStoreId', data[0].id);
                    }
                }
            }
        } catch (error) {
            console.error("Erreur lors du chargement des boutiques:", error);
        }
    };

    React.useEffect(() => {
        refreshStores();
    }, []);

    // 3. Gestion des Rôles et Permissions
    const [roles, setRoles] = useState([
        {
            id: 'admin',
            name: 'Gérant / Propriétaire',
            color: 'bg-purple-100 text-purple-700 border-purple-200',
            permissions: {
                sales: { pos: true, discount: true, cancel: true, debt: true },
                stock: { viewCost: true, adjust: true, transfer: true },
                finance: { viewBalance: true, expenses: true },
                reports: { viewAll: true },
                settings: { access: true }
            }
        },
        {
            id: 'cashier',
            name: 'Caissier',
            color: 'bg-blue-100 text-blue-700 border-blue-200',
            permissions: {
                sales: { pos: true, discount: false, cancel: false, debt: true },
                stock: { viewCost: false, adjust: false, transfer: false },
                finance: { viewBalance: false, expenses: false },
                reports: { viewAll: false },
                settings: { access: false }
            }
        },
        {
            id: 'storekeeper',
            name: 'Magasinier',
            color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
            permissions: {
                sales: { pos: false, discount: false, cancel: false, debt: false },
                stock: { viewCost: false, adjust: true, transfer: true },
                finance: { viewBalance: false, expenses: false },
                reports: { viewAll: false },
                settings: { access: false }
            }
        }
    ]);

    // 4. Gestion des Utilisateurs
    const [users, setUsers] = useState([
        {
            id: 1,
            name: 'Jean Dupont',
            roleId: 'admin',
            storeId: 1,
            pinCode: '123456', // Simulation de PIN à 6/8 chiffres
            status: 'Actif',
            lastLogin: '2026-04-29T08:00:00'
        },
        {
            id: 2,
            name: 'Alice Koffi',
            roleId: 'cashier',
            storeId: 1,
            pinCode: '000000',
            status: 'Actif',
            lastLogin: '2026-04-29T07:30:00'
        }
    ]);

    const changeStore = (id) => {
        setCurrentStoreId(id);
        localStorage.setItem('kabllix_currentStoreId', id);
    };

    const value = {
        company, setCompany,
        subscription, setSubscription,
        stores, setStores,
        roles, setRoles,
        users, setUsers,
        currentStoreId, 
        setCurrentStoreId: changeStore,
        refreshStores
    };

    return (
        <SettingsContext.Provider value={value}>
            {children}
        </SettingsContext.Provider>
    );
};
