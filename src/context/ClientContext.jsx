import React, { createContext, useContext, useState, useEffect } from 'react';

const ClientContext = createContext();

export const useClients = () => {
    return useContext(ClientContext);
};

export const ClientProvider = ({ children }) => {
    // Load from local storage for persistence
    const [clients, setClients] = useState(() => {
        const saved = localStorage.getItem('kblx_clients');
        return saved ? JSON.parse(saved) : [
            {
                id: '1',
                name: 'Client Divers',
                phone: '',
                email: '',
                address: '',
                type: 'particulier',
                nif: '',
                createdAt: new Date().toISOString()
            }
        ];
    });

    useEffect(() => {
        localStorage.setItem('kblx_clients', JSON.stringify(clients));
    }, [clients]);

    const addClient = (clientData) => {
        const newClient = {
            ...clientData,
            id: Date.now().toString(),
            createdAt: new Date().toISOString()
        };
        setClients(prev => [...prev, newClient]);
        return newClient;
    };

    const updateClient = (id, updatedData) => {
        setClients(prev => prev.map(c => c.id === id ? { ...c, ...updatedData } : c));
    };

    const deleteClient = (id) => {
        setClients(prev => prev.filter(c => c.id !== id));
    };

    return (
        <ClientContext.Provider value={{ clients, addClient, updateClient, deleteClient }}>
            {children}
        </ClientContext.Provider>
    );
};
