import React, { createContext, useContext, useState, useEffect } from 'react';
import { useSettings } from './SettingsContext';
import T from '../utils/toast';

const ClientContext = createContext();

export const useClients = () => useContext(ClientContext);

const defaultClients = [
    {
        id: 'client_btp_plus',
        name: 'Entreprise BTP Plus SARL',
        phone: '+228 90 23 45 67',
        email: 'contact@btpplus-togo.com',
        address: 'Baguida Plage, Lomé',
        type: 'entreprise',
        nif: '100234589TG',
        creditLimit: 5000000,
        pricingTier: 'wholesale',
        sites: [
            { id: 'site_btp_1', name: 'Immeuble R+3 Baguida', location: 'Baguida Face Mer', status: 'active', notes: 'Gros œuvre en cours - 500 sacs ciment prévus', createdAt: '2026-03-01T10:00:00Z' },
            { id: 'site_btp_2', name: 'Résidence Cité OUA', location: 'Cité OUA, Lomé', status: 'active', notes: 'Second œuvre et plomberie sanitaire', createdAt: '2026-03-10T14:30:00Z' }
        ],
        createdAt: new Date().toISOString()
    },
    {
        id: 'client_koffi',
        name: 'M. Koffi Mensah (Maçon Chef)',
        phone: '+228 91 88 77 66',
        email: '',
        address: 'Agoè Assiyéyé, Lomé',
        type: 'artisan',
        nif: '',
        creditLimit: 1500000,
        pricingTier: 'artisan',
        sites: [
            { id: 'site_koffi_1', name: 'Villa Agoè-Nyivé', location: 'Agoè Logopé', status: 'active', notes: 'Dalle et ferraillage terrasse', createdAt: '2026-03-05T08:00:00Z' },
            { id: 'site_koffi_2', name: 'Chantier Hedzranawoé', location: 'Marché Hedzranawoé', status: 'completed', notes: 'Chantier livré et réceptionné', createdAt: '2026-02-15T11:00:00Z' }
        ],
        createdAt: new Date().toISOString()
    },
    {
        id: 'client_amivi',
        name: 'Mme Amivi Lawson',
        phone: '+228 99 12 34 50',
        email: 'amivi.lawson@gmail.com',
        address: 'Adidogomé Douane, Lomé',
        type: 'particulier',
        nif: '',
        creditLimit: 500000,
        pricingTier: 'normal',
        sites: [
            { id: 'site_amivi_1', name: 'Maison Adidogomé', location: 'Adidogomé Rond-Point', status: 'active', notes: 'Rénovation toiture et peinture façade', createdAt: '2026-03-12T09:15:00Z' }
        ],
        createdAt: new Date().toISOString()
    },
    {
        id: 'client_divers',
        name: 'Client Divers / Comptoir',
        phone: '',
        email: '',
        address: '',
        type: 'particulier',
        nif: '',
        creditLimit: 0,
        pricingTier: 'normal',
        sites: [],
        createdAt: new Date().toISOString()
    }
];

export const ClientProvider = ({ children }) => {
    const { currentStoreId } = useSettings();
    const storeKey = currentStoreId ? String(currentStoreId) : 'store_default';

    const loadStoreClients = () => {
        const saved = localStorage.getItem(`kblx_clients_${storeKey}`);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed
                        .filter(c => c.storeId && String(c.storeId) === storeKey)
                        .map(c => ({
                            ...c,
                            creditLimit: parseFloat(c.creditLimit) || 0,
                            pricingTier: c.pricingTier || 'normal',
                            sites: Array.isArray(c.sites) ? c.sites : []
                        }));
                }
            } catch (e) {
                console.error("Erreur lecture kblx_clients", e);
            }
        }
        
        // Initialisation pour boutique par défaut ou nouvelle boutique
        if (storeKey === 'store_default') {
            return defaultClients.map(c => ({ ...c, storeId: currentStoreId || storeKey }));
        }

        // Nouvelle boutique : démarrer avec un Client Comptoir dédié
        return [
            {
                id: `client_divers_${storeKey}`,
                storeId: currentStoreId || storeKey,
                name: 'Client Divers / Comptoir',
                phone: '',
                email: '',
                address: '',
                type: 'particulier',
                nif: '',
                creditLimit: 0,
                pricingTier: 'normal',
                sites: [],
                createdAt: new Date().toISOString()
            }
        ];
    };

    const [clients, setClients] = useState(loadStoreClients);

    // Rechargement réactif lors d'un changement de boutique
    useEffect(() => {
        setClients(loadStoreClients());
    }, [storeKey]);

    // Persistance dans le namespace isolé de la boutique
    useEffect(() => {
        const isolatedClients = clients.filter(c => c.storeId && String(c.storeId) === storeKey);
        localStorage.setItem(`kblx_clients_${storeKey}`, JSON.stringify(isolatedClients));
    }, [clients, storeKey]);

    // Nettoyage clé legacy globale
    useEffect(() => {
        localStorage.removeItem('kblx_clients');
    }, []);

    const addClient = (clientData) => {
        const newClient = {
            ...clientData,
            storeId: currentStoreId || storeKey,
            id: `client_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            creditLimit: parseFloat(clientData.creditLimit) || 0,
            pricingTier: clientData.pricingTier || 'normal',
            sites: Array.isArray(clientData.sites) ? clientData.sites : [],
            createdAt: new Date().toISOString()
        };
        setClients(prev => [...prev, newClient]);
        return newClient;
    };

    const updateClient = (id, updatedData) => {
        setClients(prev => prev.map(c => {
            if (c.id === id) {
                return {
                    ...c,
                    ...updatedData,
                    creditLimit: updatedData.creditLimit !== undefined ? (parseFloat(updatedData.creditLimit) || 0) : c.creditLimit,
                    pricingTier: updatedData.pricingTier || c.pricingTier,
                    sites: Array.isArray(updatedData.sites) ? updatedData.sites : c.sites
                };
            }
            return c;
        }));
    };

    const deleteClient = (id) => {
        setClients(prev => prev.filter(c => c.id !== id));
    };

    // Gestion des Chantiers d'un client
    const addSite = (clientId, siteData) => {
        const newSite = {
            id: `site_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            name: siteData.name.trim(),
            location: siteData.location?.trim() || '',
            status: siteData.status || 'active', // 'active' ou 'completed'
            notes: siteData.notes?.trim() || '',
            createdAt: new Date().toISOString()
        };

        setClients(prev => prev.map(c => {
            if (c.id === clientId) {
                return {
                    ...c,
                    sites: [...(c.sites || []), newSite]
                };
            }
            return c;
        }));

        T.success(`Chantier "${newSite.name}" ajouté avec succès !`);
        return newSite;
    };

    const updateSite = (clientId, siteId, updates) => {
        setClients(prev => prev.map(c => {
            if (c.id === clientId) {
                return {
                    ...c,
                    sites: (c.sites || []).map(s => s.id === siteId ? { ...s, ...updates } : s)
                };
            }
            return c;
        }));
        T.success("Chantier mis à jour.");
    };

    const deleteSite = (clientId, siteId) => {
        setClients(prev => prev.map(c => {
            if (c.id === clientId) {
                return {
                    ...c,
                    sites: (c.sites || []).filter(s => s.id !== siteId)
                };
            }
            return c;
        }));
        T.info("Chantier supprimé.");
    };

    const getClientById = (id) => clients.find(c => c.id === id);

    const getClientByName = (name) => {
        if (!name) return null;
        return clients.find(c => c.name.toLowerCase().trim() === name.toLowerCase().trim());
    };

    return (
        <ClientContext.Provider value={{
            clients,
            addClient,
            updateClient,
            deleteClient,
            addSite,
            updateSite,
            deleteSite,
            getClientById,
            getClientByName
        }}>
            {children}
        </ClientContext.Provider>
    );
};
