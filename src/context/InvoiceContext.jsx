import React, { createContext, useContext, useState, useEffect } from 'react';
import { useSettings } from './SettingsContext';

const InvoiceContext = createContext();
export const useInvoices = () => useContext(InvoiceContext);

export const InvoiceProvider = ({ children }) => {
    const { currentStoreId } = useSettings();
    const storeKey = currentStoreId ? String(currentStoreId) : 'store_default';

    const loadInvoices = (key) => {
        const saved = localStorage.getItem(`kblx_invoices_${key}`);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) return parsed.filter(i => i.storeId && String(i.storeId) === key);
            } catch (e) { console.error('Erreur lecture invoices', e); }
        }
        return [];
    };

    const [allInvoices, setAllInvoices] = useState(() => loadInvoices(storeKey));

    useEffect(() => {
        setAllInvoices(loadInvoices(storeKey));
    }, [storeKey]);

    useEffect(() => {
        const isolated = allInvoices.filter(i => i.storeId && String(i.storeId) === storeKey);
        localStorage.setItem(`kblx_invoices_${storeKey}`, JSON.stringify(isolated));
    }, [allInvoices, storeKey]);

    const invoices = allInvoices.filter(i => i.storeId != null && String(i.storeId) === storeKey);

    // Generate sequential invoice number: FAC-2024-0001
    const generateInvoiceNumber = () => {
        const year = new Date().getFullYear();
        const storeInvoices = invoices.filter(i => {
            const num = i.invoiceNumber || '';
            return num.includes(`FAC-${year}`);
        });
        const next = storeInvoices.length + 1;
        return `FAC-${year}-${String(next).padStart(4, '0')}`;
    };

    // Create invoice from a transaction or manually
    const createInvoice = ({ client, items, totalAmount, paymentMethod, transactionId = null, notes = '', dueDate = null }) => {
        const newInvoice = {
            id: Date.now(),
            storeId: currentStoreId || storeKey,
            invoiceNumber: generateInvoiceNumber(),
            createdAt: new Date().toISOString(),
            dueDate: dueDate || null,
            status: 'Brouillon', // Brouillon | Envoyée | Payée | Annulée
            client: client || { name: 'Client comptoir', phone: '', address: '' },
            items: items.map(item => ({
                name: item.name || item.label || 'Article',
                quantity: item.inputQuantity || item.quantity || 1,
                unitPrice: item.price || 0,
                unit: item.unit || 'Unité',
                total: (item.price || 0) * (item.inputQuantity || item.quantity || 1),
            })),
            totalHT: totalAmount,
            tva: 0, // TVA optionnelle
            totalTTC: totalAmount,
            paymentMethod: paymentMethod || 'Espèces',
            transactionId,
            notes,
        };
        setAllInvoices(prev => [newInvoice, ...prev]);
        return newInvoice;
    };

    const updateInvoiceStatus = (invoiceId, status) => {
        setAllInvoices(prev => prev.map(inv =>
            inv.id === invoiceId ? { ...inv, status, updatedAt: new Date().toISOString() } : inv
        ));
    };

    const updateInvoice = (invoiceId, updates) => {
        setAllInvoices(prev => prev.map(inv =>
            inv.id === invoiceId ? { ...inv, ...updates, updatedAt: new Date().toISOString() } : inv
        ));
    };

    const deleteInvoice = (invoiceId) => {
        setAllInvoices(prev => prev.filter(inv => inv.id !== invoiceId));
    };

    // Stats
    const invoiceStats = {
        total: invoices.length,
        draft: invoices.filter(i => i.status === 'Brouillon').length,
        sent: invoices.filter(i => i.status === 'Envoyée').length,
        paid: invoices.filter(i => i.status === 'Payée').length,
        cancelled: invoices.filter(i => i.status === 'Annulée').length,
        totalRevenue: invoices.filter(i => i.status === 'Payée').reduce((s, i) => s + (i.totalTTC || 0), 0),
        pendingAmount: invoices.filter(i => i.status === 'Envoyée').reduce((s, i) => s + (i.totalTTC || 0), 0),
    };

    return (
        <InvoiceContext.Provider value={{
            invoices,
            createInvoice,
            updateInvoice,
            updateInvoiceStatus,
            deleteInvoice,
            generateInvoiceNumber,
            invoiceStats,
        }}>
            {children}
        </InvoiceContext.Provider>
    );
};
