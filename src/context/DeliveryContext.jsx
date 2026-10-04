import React, { createContext, useContext, useState, useEffect } from 'react';
import { useSettings } from './SettingsContext';
import T from '../utils/toast';

const DeliveryContext = createContext();

export const useDeliveries = () => useContext(DeliveryContext);

export const DeliveryProvider = ({ children }) => {
    const { currentStoreId } = useSettings();
    const storeKey = currentStoreId ? String(currentStoreId) : 'store_default';

    // ── Bons à Enlever cloisonnés strictement par boutique ──
    const loadDeliveryNotes = (key) => {
        const saved = localStorage.getItem(`kabllix_delivery_notes_${key}`);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    return parsed.filter(n => n.storeId && String(n.storeId) === key);
                }
            } catch (e) {
                console.error("Erreur lecture kabllix_delivery_notes", e);
            }
        }
        return [];
    };

    const [allDeliveryNotes, setAllDeliveryNotes] = useState(() => loadDeliveryNotes(storeKey));

    // Rechargement immédiat lors du changement de boutique
    useEffect(() => {
        setAllDeliveryNotes(loadDeliveryNotes(storeKey));
    }, [storeKey]);

    // Persistance isolée
    useEffect(() => {
        const isolatedNotes = allDeliveryNotes.filter(n => n.storeId && String(n.storeId) === storeKey);
        localStorage.setItem(`kabllix_delivery_notes_${storeKey}`, JSON.stringify(isolatedNotes));
    }, [allDeliveryNotes, storeKey]);

    // Nettoyage clé legacy
    useEffect(() => {
        localStorage.removeItem('kabllix_delivery_notes');
    }, []);

    // Filtrer strictement par boutique courante
    const deliveryNotes = allDeliveryNotes.filter(n => n.storeId != null && String(n.storeId) === storeKey);

    /**
     * Génère un numéro de Bon séquentiel et propre (ex: BAE-2026-0001)
     */
    const generateBaeNumber = () => {
        const year = new Date().getFullYear();
        const thisYearNotes = deliveryNotes.filter(n => n.reference?.startsWith(`BAE-${year}`));
        const nextSeq = thisYearNotes.length + 1;
        return `BAE-${year}-${String(nextSeq).padStart(4, '0')}`;
    };

    /**
     * Crée un Bon à Enlever suite à une vente au comptoir
     */
    const createDeliveryNote = (transaction, deliveryInfo = {}) => {
        const reference = generateBaeNumber();

        const items = (transaction.items || []).map(item => {
            const qty = parseFloat(item.inputQuantity || item.quantity || 1);
            return {
                id: item.id || item.productId,
                productId: item.id || item.productId,
                name: item.name,
                unit: item.unit || item.label || 'U',
                purchasedQty: qty,
                deliveredQty: 0,
                remainingQty: qty,
                price: item.price || item.unitPrice || 0
            };
        });

        const newNote = {
            id: `bae_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            reference,
            transactionId: transaction.id,
            storeId: currentStoreId || storeKey,
            createdAt: new Date().toISOString(),
            customerName: deliveryInfo.customerName || transaction.customerName || 'Client Comptoir',
            customerPhone: deliveryInfo.customerPhone || '',
            siteName: deliveryInfo.siteName || '', // Nom du chantier
            driverName: deliveryInfo.driverName || '',
            vehicleNumber: deliveryInfo.vehicleNumber || '',
            notes: deliveryInfo.notes || '',
            status: 'pending', // 'pending' (En attente), 'partial' (Retrait partiel), 'completed' (Soldé)
            items,
            withdrawals: [] // Historique de chaque enlèvement
        };

        setAllDeliveryNotes(prev => [newNote, ...prev]);
        T.success(`Bon à Enlever ${reference} créé avec succès !`);
        return newNote;
    };

    /**
     * Enregistre une décharge (enlèvement partiel ou total) par le magasinier
     */
    const recordWithdrawal = (noteId, withdrawalData) => {
        const {
            withdrawnItems, // Array of { productId, qty }
            receiverName,
            driverName,
            vehicleNumber,
            warehousemanName,
            notes
        } = withdrawalData;

        let updatedNote = null;

        setAllDeliveryNotes(prev => prev.map(note => {
            if (note.id !== noteId) return note;

            // Mettre à jour les articles
            let allCompleted = true;
            let hasAnyDelivery = false;

            const updatedItems = note.items.map(item => {
                const withdrawItem = (withdrawnItems || []).find(w => w.productId === item.productId || w.id === item.productId);
                const addQty = withdrawItem ? (parseFloat(withdrawItem.qty) || 0) : 0;
                
                const newDelivered = Math.min(item.purchasedQty, item.deliveredQty + addQty);
                const newRemaining = Math.max(0, item.purchasedQty - newDelivered);

                if (newRemaining > 0) allCompleted = false;
                if (newDelivered > 0) hasAnyDelivery = true;

                return {
                    ...item,
                    deliveredQty: newDelivered,
                    remainingQty: newRemaining
                };
            });

            // Créer l'entrée de retrait
            const withdrawalEntry = {
                id: `retrait_${Date.now()}`,
                date: new Date().toISOString(),
                receiverName: receiverName || note.customerName,
                driverName: driverName || note.driverName || '',
                vehicleNumber: vehicleNumber || note.vehicleNumber || '',
                warehousemanName: warehousemanName || 'Magasinier',
                notes: notes || '',
                items: (withdrawnItems || []).filter(w => (parseFloat(w.qty) || 0) > 0)
            };

            const newStatus = allCompleted ? 'completed' : (hasAnyDelivery ? 'partial' : 'pending');

            updatedNote = {
                ...note,
                status: newStatus,
                items: updatedItems,
                withdrawals: [withdrawalEntry, ...note.withdrawals]
            };

            return updatedNote;
        }));

        if (updatedNote?.status === 'completed') {
            T.success(`Bon ${updatedNote.reference} entièrement soldé et livré !`);
        } else {
            T.success(`Enlèvement partiel enregistré pour ${updatedNote?.reference}`);
        }

        return updatedNote;
    };

    /**
     * Annule ou supprime un bon à enlever
     */
    const deleteDeliveryNote = (noteId) => {
        setAllDeliveryNotes(prev => prev.filter(n => n.id !== noteId));
        T.info("Bon à enlever supprimé.");
    };

    /**
     * Calcule le stock réservé (marchandises payées en attente de retrait) pour un produit
     */
    const getReservedStock = (productId) => {
        if (!productId) return 0;
        return deliveryNotes
            .filter(n => n.status === 'pending' || n.status === 'partial')
            .reduce((sum, note) => {
                const item = note.items.find(i => i.productId === productId || i.id === productId);
                return sum + (item ? item.remainingQty : 0);
            }, 0);
    };

    /**
     * Récupère le dictionnaire de tous les stocks réservés par productId
     */
    const getReservedStockMap = () => {
        const map = {};
        deliveryNotes
            .filter(n => n.status === 'pending' || n.status === 'partial')
            .forEach(note => {
                note.items.forEach(item => {
                    const id = item.productId || item.id;
                    if (id) {
                        map[id] = (map[id] || 0) + item.remainingQty;
                    }
                });
            });
        return map;
    };

    return (
        <DeliveryContext.Provider value={{
            deliveryNotes,
            createDeliveryNote,
            recordWithdrawal,
            deleteDeliveryNote,
            getReservedStock,
            getReservedStockMap
        }}>
            {children}
        </DeliveryContext.Provider>
    );
};
