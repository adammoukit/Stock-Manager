/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useInventory } from './InventoryContext';
import { useSettings } from './SettingsContext';
import { salesApi } from '../services/apiClient';

import { getUnitModel } from '../config/unitModels';
import { formatPrice } from '../utils/currency';

const SalesContext = createContext();

export const useSales = () => useContext(SalesContext);

export const SalesProvider = ({ children }) => {
    const { recordSale, recordReturn, refreshProducts } = useInventory();
    const { currentStoreId } = useSettings();
    const storeKey = currentStoreId ? String(currentStoreId) : 'store_default';
    
    const [cart, setCart] = useState([]);
    const [allTransactions, setAllTransactions] = useState([]);
    
    // ── Devis cloisonnés par boutique ──
    const loadQuotes = (key) => {
        const saved = localStorage.getItem(`kblx_quotes_${key}`);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) return parsed.filter(q => q.storeId && String(q.storeId) === key);
            } catch (e) {
                console.error("Erreur lecture quotes", e);
            }
        }
        return [];
    };
    const [allQuotes, setAllQuotes] = useState(() => loadQuotes(storeKey));

    // ── Dépenses/Sorties de caisse cloisonnées par boutique ──
    const loadExpenses = (key) => {
        const saved = localStorage.getItem(`kblx_expenses_${key}`);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) return parsed.filter(e => e.storeId && String(e.storeId) === key);
            } catch (e) {
                console.error("Erreur lecture expenses", e);
            }
        }
        return [];
    };
    const [allExpenses, setAllExpenses] = useState(() => loadExpenses(storeKey));

    // ── Dettes / Créances cloisonnées par boutique ──
    const loadDebts = (key) => {
        const saved = localStorage.getItem(`kblx_debts_${key}`);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) return parsed.filter(d => d.storeId && String(d.storeId) === key);
            } catch (e) {
                console.error("Erreur lecture kblx_debts", e);
            }
        }
        return [];
    };
    const [allDebts, setAllDebts] = useState(() => loadDebts(storeKey));

    // ── Retours d'articles cloisonnés par boutique ──
    const loadReturns = (key) => {
        const saved = localStorage.getItem(`kblx_returns_${key}`);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) return parsed.filter(r => r.storeId && String(r.storeId) === key);
            } catch (e) {
                console.error("Erreur lecture returns", e);
            }
        }
        return [];
    };
    const [allReturns, setAllReturns] = useState(() => loadReturns(storeKey));

    // ── Bons d'Avoir cloisonnés par boutique ──
    const loadCreditNotes = (key) => {
        const saved = localStorage.getItem(`kblx_credit_notes_${key}`);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) return parsed.filter(c => c.storeId && String(c.storeId) === key);
            } catch (e) {
                console.error("Erreur lecture credit_notes", e);
            }
        }
        return [];
    };
    const [allCreditNotes, setAllCreditNotes] = useState(() => loadCreditNotes(storeKey));
    const [isLoadingSales, setIsLoadingSales] = useState(true);

    // ── Rechargement et isolation stricte lors du changement de boutique ──
    useEffect(() => {
        setCart([]); // Vider le panier lors du changement de boutique pour éviter tout mélange d'articles
        setAllQuotes(loadQuotes(storeKey));
        setAllExpenses(loadExpenses(storeKey));
        setAllDebts(loadDebts(storeKey));
        setAllReturns(loadReturns(storeKey));
        setAllCreditNotes(loadCreditNotes(storeKey));
    }, [storeKey]);

    // Persistance isolée
    useEffect(() => {
        const isolatedDebts = allDebts.filter(d => d.storeId && String(d.storeId) === storeKey);
        localStorage.setItem(`kblx_debts_${storeKey}`, JSON.stringify(isolatedDebts));
    }, [allDebts, storeKey]);

    useEffect(() => {
        const isolatedExpenses = allExpenses.filter(e => e.storeId && String(e.storeId) === storeKey);
        localStorage.setItem(`kblx_expenses_${storeKey}`, JSON.stringify(isolatedExpenses));
    }, [allExpenses, storeKey]);

    useEffect(() => {
        const isolatedQuotes = allQuotes.filter(q => q.storeId && String(q.storeId) === storeKey);
        localStorage.setItem(`kblx_quotes_${storeKey}`, JSON.stringify(isolatedQuotes));
    }, [allQuotes, storeKey]);

    useEffect(() => {
        const isolatedReturns = allReturns.filter(r => r.storeId && String(r.storeId) === storeKey);
        localStorage.setItem(`kblx_returns_${storeKey}`, JSON.stringify(isolatedReturns));
    }, [allReturns, storeKey]);

    useEffect(() => {
        const isolatedCreditNotes = allCreditNotes.filter(c => c.storeId && String(c.storeId) === storeKey);
        localStorage.setItem(`kblx_credit_notes_${storeKey}`, JSON.stringify(isolatedCreditNotes));
    }, [allCreditNotes, storeKey]);

    // Clear legacy localStorage data to prevent leaks
    useEffect(() => {
        localStorage.removeItem("transactions");
        localStorage.removeItem("quotes");
        localStorage.removeItem("expenses");
        localStorage.removeItem("debts");
        localStorage.removeItem("quincaillerie_sales_migration_v3");
        localStorage.removeItem("kblx_debts_v2");
    }, []);

    // Fetch real sales data from backend
    useEffect(() => {
        const fetchTransactions = async () => {
            if (!currentStoreId) return;
            try {
                setIsLoadingSales(true);
                const response = await salesApi.getByStore(currentStoreId);
                const transactionsList = Array.isArray(response) ? response : (response?.data || []);
                
                const backendTx = transactionsList.map(tx => ({
                    id: tx.id,
                    storeId: tx.storeId,
                    date: tx.transactionDate,
                    total: tx.totalAmount,
                    paymentMethod: tx.paymentMethod,
                    amountGiven: tx.amountGiven,
                    change: tx.changeAmount,
                    cashier: tx.cashierName || tx.cashier || (tx.user ? `${tx.user.firstName || ''} ${tx.user.lastName || ''}`.trim() : null),
                    cashierName: tx.cashierName || tx.cashier || (tx.user ? `${tx.user.firstName || ''} ${tx.user.lastName || ''}`.trim() : null),
                    status: tx.status,
                    items: (tx.items || []).map(item => ({
                        id: item.productId,
                        name: item.productName,
                        unit: item.productUnit,
                        inputQuantity: item.quantity,
                        stockDeduction: item.baseStockDeduction != null ? Number(item.baseStockDeduction) : undefined,
                        price: item.unitPrice,
                        totalPrice: item.totalPrice,
                        type: item.saleType,
                        label: item.saleType === 'lot' ? 'Lot' : (item.saleType === 'piece' ? 'Pièce' : (item.saleType === 'packaging' ? 'Fract.' : item.productUnit))
                    }))
                }));
                setAllTransactions(backendTx);
            } catch (error) {
                console.error("Failed to fetch transactions", error);
            } finally {
                setIsLoadingSales(false);
            }
        };

        fetchTransactions();
    }, [currentStoreId]);

    // Derived states based strictly on current store
    const transactions = allTransactions.filter(t => t.storeId != null && String(t.storeId) === storeKey);
    const quotes = allQuotes.filter(q => q.storeId != null && String(q.storeId) === storeKey);
    const expenses = allExpenses.filter(e => e.storeId != null && String(e.storeId) === storeKey);
    const debts = allDebts.filter(d => d.storeId != null && String(d.storeId) === storeKey);
    const returns = allReturns.filter(r => r.storeId != null && String(r.storeId) === storeKey);
    const creditNotes = allCreditNotes.filter(c => c.storeId != null && String(c.storeId) === storeKey);

    const addToCart = (product, options = null) => {
        setCart(prev => {
            let type = options?.type || (options?.modelId ? 'packaging' : 'base');
            const packagingId = options?.modelId || options?.id;
            const cartKey = type === 'base' ? `${product.id}_base` : type === 'lot' ? `${product.id}_lot` : type === 'piece' ? `${product.id}_piece` : `${product.id}_${packagingId}`;
            const existing = prev.find(item => item.cartKey === cartKey);

            const cf = parseFloat(product.conversionFactor) || 1;
            const isContainer = (product.unitArchetype === 'BOX' || product.unitArchetype === 'BULK') && cf > 1;

            if (existing) {
                const newInputQty = existing.inputQuantity + 1;
                return prev.map(item => item.cartKey === cartKey
                    ? { ...item, inputQuantity: newInputQty, stockDeduction: newInputQty * existing.baseDeduction }
                    : item
                );
            }

            let newCartItem = { ...product, cartKey, inputQuantity: 1, type };

            if (type === 'packaging') {
                // deductionRatio is a fraction of the base container unit
                newCartItem.baseDeduction = parseFloat(options.deductionRatio) || 0;
                newCartItem.packaging = { ...options };
                newCartItem.label = options.name || "Fragment";
                newCartItem.price = parseFloat(options.price);
            } else if (type === 'piece') {
                // container products: deduct 1/cf (fraction of container)
                // simple unit products: deduct 1 directly
                newCartItem.baseDeduction = isContainer ? (1 / cf) : 1;
                newCartItem.label = `À la pièce (${getUnitModel(product.unit).subUnit || 'Pièce'})`;
                newCartItem.price = parseFloat(product.piecePrice);
            } else if (type === 'lot') {
                const lotQty = parseFloat(options?.targetQty) || parseFloat(product.retailStepQuantity) || 10;
                // container products: deduct lotQty/cf (fraction of container)
                // simple unit products: deduct lotQty directly
                newCartItem.baseDeduction = isContainer ? (lotQty / cf) : lotQty;
                newCartItem.label = options?.name || `Lot de ${lotQty} ${product.bulkUnit || getUnitModel(product.unit).subUnit || 'Pièces'}`;
                newCartItem.price = parseFloat(options?.price != null ? options.price : product.lotPrice);
            } else {
                // Selling 1 unit = always deduct 1 from stock (1 container or 1 piece)
                newCartItem.baseDeduction = 1;
                newCartItem.label = product.unit || 'Unité';
                newCartItem.price = parseFloat(product.price);
            }

            newCartItem.stockDeduction = newCartItem.baseDeduction;
            return [...prev, newCartItem];
        });
    };

    const removeFromCart = (cartKey) => {
        setCart(prev => prev.filter(item => item.cartKey !== cartKey));
    };

    const updateCartItem = (cartKey, updates) => {
        setCart(prev => prev.map(item => {
            if (item.cartKey === cartKey) {
                const merged = { ...item, ...updates };
                const parsedQty = parseFloat(merged.inputQuantity) || 0;
                merged.stockDeduction = parsedQty * (merged.baseDeduction || 1);
                return merged;
            }
            return item;
        }));
    };

    const clearCart = () => setCart([]);

    const getItemPrice = (item) => {
        return parseFloat(item.price) || 0;
    };

    const completeSale = async (paymentInfo) => {
        const total = cart.reduce((sum, item) => sum + (getItemPrice(item) * item.inputQuantity), 0);
        
        try {
            const saleRequest = {
                storeId: currentStoreId,
                paymentMethod: paymentInfo?.method || 'cash',
                amountGiven: paymentInfo?.amountGiven || total,
                changeAmount: paymentInfo?.change || 0,
                items: cart.map(item => ({
                    productId: item.id,
                    quantity: item.inputQuantity,
                    type: item.type, // 'base', 'lot', 'packaging'
                    unitPrice: getItemPrice(item),
                    packagingName: item.type === 'packaging' ? item.label : null
                }))
            };

            const savedTransaction = await salesApi.create(saleRequest);
            
            // Re-create the local transaction object for the UI (Receipt)
            // matching exactly what it used to look like, but with the real DB ID
            const uiTransaction = {
                id: savedTransaction.data?.id || savedTransaction.id || Date.now(),
                storeId: currentStoreId || storeKey,
                date: savedTransaction.data?.transactionDate || savedTransaction.transactionDate || new Date().toISOString(),
                items: [...cart],
                total,
                paymentMethod: saleRequest.paymentMethod,
                amountGiven: saleRequest.amountGiven,
                change: saleRequest.changeAmount,
                cashier: paymentInfo?.cashier || paymentInfo?.cashierName || null,
                cashierName: paymentInfo?.cashier || paymentInfo?.cashierName || null,
                customerName: paymentInfo?.customerName || null,
                clientId: paymentInfo?.clientId || null,
                siteName: paymentInfo?.siteName || null,
                status: 'completed'
            };
            
            // Refresh inventory from backend to get the ultra-precise stock deduction
            await refreshProducts();

            if (saleRequest.paymentMethod === 'credit') {
                const newDebt = {
                    id: Date.now(),
                    storeId: currentStoreId || storeKey,
                    transactionId: uiTransaction.id,
                    date: new Date().toISOString(),
                    customerName: paymentInfo.customerName || 'Client Inconnu',
                    clientId: paymentInfo.clientId || null,
                    siteName: paymentInfo.siteName || null,
                    totalAmount: total,
                    paidAmount: paymentInfo.amountGiven || 0,
                    status: 'pending'
                };
                setAllDebts(prev => [newDebt, ...prev]);
            }

            // Gestion automatique du reliquat de monnaie non rendue (Avoir de Monnaie)
            if (paymentInfo?.changeReliquat && paymentInfo.changeReliquat.amount > 0) {
                const reliquat = paymentInfo.changeReliquat;
                const now = new Date();
                const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
                const rand = Math.floor(1000 + Math.random() * 9000);
                const voucherCode = reliquat.voucherCode || `AVR-${dateStr.slice(2, 6)}-${rand}`;

                const newCreditNote = {
                    id: `cn_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                    code: voucherCode,
                    type: 'change_reliquat',
                    reliquatMode: reliquat.type || 'voucher', // 'voucher' | 'client_credit'
                    storeId: currentStoreId || storeKey,
                    customerName: paymentInfo.customerName || reliquat.customerName || 'Client Comptoir',
                    clientId: paymentInfo.clientId || reliquat.clientId || null,
                    siteName: paymentInfo.siteName || null,
                    initialAmount: parseFloat(reliquat.amount) || 0,
                    remainingAmount: parseFloat(reliquat.amount) || 0,
                    status: 'active',
                    createdAt: new Date().toISOString(),
                    expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
                    notes: reliquat.type === 'client_credit'
                        ? `Avance compte client — reliquat monnaie vente ticket #${uiTransaction.id} (Règlement ${formatPrice(paymentInfo?.amountGiven || total)})`
                        : `Reliquat monnaie vente ticket #${uiTransaction.id} (Règlement ${formatPrice(paymentInfo?.amountGiven || total)})`,
                    cashierName: paymentInfo?.cashier || paymentInfo?.cashierName || 'Caissier'
                };

                setAllCreditNotes(prev => [newCreditNote, ...prev]);
                uiTransaction.changeReliquat = {
                    ...reliquat,
                    voucherCode: newCreditNote.code
                };
                uiTransaction.creditNote = newCreditNote;
            }

            uiTransaction.changeDue = paymentInfo?.changeDue !== undefined ? paymentInfo.changeDue : Math.max(0, (parseFloat(paymentInfo?.amountGiven) || total) - total);
            if (paymentInfo?.changeReliquat) {
                uiTransaction.change = paymentInfo.change; // Montant réellement sorti de la caisse
            }

            setAllTransactions([uiTransaction, ...allTransactions]);
            clearCart();
            return uiTransaction;
        } catch (error) {
            console.error("Erreur lors de la vente:", error);
            throw error;
        }
    };

    // Debt Management
    const addDebtPayment = (debtId, amount, paymentMethod = 'cash', note = '') => {
        let updatedDebtInfo = null;
        setAllDebts(prevDebts => prevDebts.map(debt => {
            if (debt.id === debtId) {
                const newPaid = (debt.paidAmount || 0) + amount;
                const updated = {
                    ...debt,
                    paidAmount: newPaid,
                    status: newPaid >= debt.totalAmount ? 'paid' : 'pending',
                    payments: [
                        ...(debt.payments || []),
                        {
                            id: Date.now() + Math.random(),
                            date: new Date().toISOString(),
                            amount,
                            paymentMethod: paymentMethod || 'cash',
                            note: note || ''
                        }
                    ]
                };
                updatedDebtInfo = updated;
                return updated;
            }
            return debt;
        }));
        
        // Add a complete transaction for the debt payment
        const debtTransaction = {
            id: Date.now(),
            storeId: currentStoreId || storeKey,
            date: new Date().toISOString(),
            items: [
                {
                    name: `Règlement Créance #${debtId}${updatedDebtInfo?.customerName ? ' (' + updatedDebtInfo.customerName + ')' : ''}`,
                    price: amount,
                    quantity: 1,
                    total: amount
                }
            ],
            total: amount,
            paymentMethod: paymentMethod || 'cash',
            amountGiven: amount,
            change: 0,
            status: 'debt_payment',
            debtId: debtId,
            customerName: updatedDebtInfo?.customerName || undefined,
            clientId: updatedDebtInfo?.clientId || undefined,
            siteName: updatedDebtInfo?.siteName || undefined,
            note: note || `Règlement dette facture #${debtId} via ${paymentMethod}`
        };
        setAllTransactions(prev => [debtTransaction, ...prev]);
        return debtTransaction;
    };

    // Quote Management
    const addQuote = (customerName) => {
        const total = cart.reduce((sum, item) => sum + (getItemPrice(item) * item.inputQuantity), 0);
        const quote = {
            id: Date.now(),
            storeId: currentStoreId || storeKey,
            date: new Date().toISOString(),
            items: [...cart],
            total,
            customerName: customerName || 'Client',
            status: 'pending'
        };
        setAllQuotes([quote, ...allQuotes]);
        clearCart();
        return quote;
    };

    const addQuoteWithItems = (customerName, items) => {
        const total = items.reduce((sum, item) => sum + (getItemPrice(item) * (item.quantity || item.inputQuantity || 1)), 0);
        const quote = {
            id: Date.now(),
            storeId: currentStoreId || storeKey,
            date: new Date().toISOString(),
            items: [...items],
            total,
            customerName: customerName || 'Client',
            status: 'pending'
        };
        setAllQuotes([quote, ...allQuotes]);
        return quote;
    };

    const deleteQuote = (id) => {
        setAllQuotes(allQuotes.filter(q => q.id !== id));
    };

    const convertQuoteToSale = (quote) => {
        const transaction = {
            id: Date.now(),
            storeId: currentStoreId || storeKey,
            date: new Date().toISOString(),
            items: [...quote.items],
            total: quote.total,
            paymentMethod: 'cash',
            amountGiven: quote.total,
            change: 0,
            status: 'completed'
        };

        recordSale(quote.items);
        setAllTransactions([transaction, ...allTransactions]);
        deleteQuote(quote.id);
        return transaction;
    };

    const cancelTransaction = (id) => {
        setAllTransactions(prev => prev.map(t => {
            if (t.id === id && t.status !== 'canceled') {
                return { ...t, status: 'canceled' };
            }
            return t;
        }));
    };

    // Expense Management
    const addExpense = (expenseData) => {
        const expense = {
            id: Date.now(),
            storeId: currentStoreId || storeKey,
            ...expenseData,
            date: expenseData.date || new Date().toISOString()
        };
        setAllExpenses([expense, ...allExpenses]);
        return expense;
    };

    const deleteExpense = (id) => {
        setAllExpenses(allExpenses.filter(e => e.id !== id));
    };

    // ── Gestion des Retours d'Articles & Bons d'Avoir ──
    const createReturn = ({
        saleId = null,
        transactionNumber = null,
        customerName = 'Client Comptoir',
        clientId = null,
        siteName = null,
        items = [],
        refundMethod = 'avoir', // 'avoir' | 'cash' | 'debt_deduction'
        reason = 'Surplus de chantier',
        cashierName = 'Caissier',
        notes = ''
    }) => {
        const returnId = `ret_${Date.now()}`;
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
        const rand = Math.floor(1000 + Math.random() * 9000);
        const returnNumber = `RET-${dateStr}-${rand}`;

        // Calcul du montant total remboursé
        const totalAmount = items.reduce((sum, item) => {
            const qty = parseFloat(item.quantityReturned) || parseFloat(item.quantity) || 0;
            const price = parseFloat(item.unitPrice) || parseFloat(item.price) || 0;
            return sum + (qty * price);
        }, 0);

        let createdCreditNote = null;
        let createdExpense = null;

        // 1. Traitement financier
        if (refundMethod === 'cash') {
            // Remboursement Espèces : Sortie de caisse automatique dans la session active
            createdExpense = {
                id: Date.now(),
                storeId: currentStoreId || storeKey,
                date: new Date().toISOString(),
                category: 'Remboursement Retour Client',
                amount: totalAmount,
                motif: `Remboursement retour ${returnNumber} - ${customerName} (${items.length} art.)`,
                cashier: cashierName,
                returnNumber,
                returnId
            };
            setAllExpenses(prev => [createdExpense, ...prev]);
        } else if (refundMethod === 'avoir') {
            // Émission d'un Bon d'Avoir officiel
            const voucherCode = `AVR-${dateStr.slice(2, 6)}-${rand}`;
            createdCreditNote = {
                id: `cn_${Date.now()}`,
                code: voucherCode,
                returnId,
                returnNumber,
                storeId: currentStoreId || storeKey,
                customerName: customerName || 'Client Comptoir',
                clientId: clientId || null,
                siteName: siteName || null,
                initialAmount: totalAmount,
                remainingAmount: totalAmount,
                status: 'active', // 'active' | 'used' | 'partial' | 'cancelled'
                createdAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 jours
                notes: notes || reason || 'Avoir sur retour marchandise',
                cashierName
            };
            setAllCreditNotes(prev => [createdCreditNote, ...prev]);
        } else if (refundMethod === 'debt_deduction') {
            // Déduction directe sur la dette / créance du client si existante
            if (clientId || customerName) {
                setAllDebts(prevDebts => {
                    let remainingToDeduct = totalAmount;
                    return prevDebts.map(debt => {
                        const isMatch = (debt.clientId && debt.clientId === clientId) ||
                            (debt.customerName && customerName && debt.customerName.toLowerCase().trim() === customerName.toLowerCase().trim());
                        if (!isMatch || debt.status === 'paid' || remainingToDeduct <= 0) return debt;

                        const unpaid = Math.max(0, (debt.totalAmount || 0) - (debt.paidAmount || 0));
                        const deduction = Math.min(unpaid, remainingToDeduct);
                        remainingToDeduct -= deduction;

                        const newPaid = (debt.paidAmount || 0) + deduction;
                        return {
                            ...debt,
                            paidAmount: newPaid,
                            status: newPaid >= debt.totalAmount ? 'paid' : 'pending'
                        };
                    });
                });
            }
        }

        // 2. Réintégration des stocks dans InventoryContext
        if (recordReturn) {
            recordReturn(items, returnNumber);
        }

        // 3. Création du registre de retour
        const returnRecord = {
            id: returnId,
            returnNumber,
            storeId: currentStoreId || storeKey,
            date: new Date().toISOString(),
            saleId,
            transactionNumber,
            customerName,
            clientId,
            siteName,
            items: items.map(item => ({
                id: item.id || item.productId,
                productId: item.productId || item.id,
                name: item.name,
                unit: item.unit,
                quantityReturned: parseFloat(item.quantityReturned) || parseFloat(item.quantity) || 0,
                unitPrice: parseFloat(item.unitPrice) || parseFloat(item.price) || 0,
                totalRefund: (parseFloat(item.quantityReturned) || parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || parseFloat(item.price) || 0),
                condition: item.condition || 'intact', // 'intact' | 'damaged'
                reintegrated: item.condition === 'intact' || item.reintegrate !== false
            })),
            totalAmount,
            refundMethod,
            voucherCode: createdCreditNote ? createdCreditNote.code : null,
            expenseId: createdExpense ? createdExpense.id : null,
            reason,
            cashierName,
            notes,
            status: 'completed'
        };

        setAllReturns(prev => [returnRecord, ...prev]);

        return { returnRecord, creditNote: createdCreditNote, expense: createdExpense };
    };

    const getCreditNote = (code) => {
        if (!code) return null;
        const normalized = code.trim().toUpperCase();
        return creditNotes.find(c => c.code.toUpperCase() === normalized && c.status !== 'cancelled');
    };

    const useCreditNote = (code, amountToDeduct) => {
        const normalized = (code || '').trim().toUpperCase();
        const note = creditNotes.find(c => c.code.toUpperCase() === normalized);

        if (!note) {
            return { success: false, message: "Bon d'avoir introuvable ou invalide." };
        }

        if (note.status === 'used' || note.remainingAmount <= 0) {
            return { success: false, message: "Ce bon d'avoir a déjà été entièrement utilisé." };
        }

        if (new Date(note.expiresAt).getTime() < Date.now()) {
            return { success: false, message: "Ce bon d'avoir est expiré (délai de 60 jours dépassé)." };
        }

        const deduct = Math.min(note.remainingAmount, parseFloat(amountToDeduct) || 0);
        const newRemaining = Math.max(0, note.remainingAmount - deduct);
        const newStatus = newRemaining === 0 ? 'used' : 'partial';

        setAllCreditNotes(prev => prev.map(c => {
            if (c.id === note.id) {
                return {
                    ...c,
                    remainingAmount: newRemaining,
                    status: newStatus,
                    lastUsedAt: new Date().toISOString()
                };
            }
            return c;
        }));

        return {
            success: true,
            appliedAmount: deduct,
            remainingBalance: newRemaining,
            creditNote: { ...note, remainingAmount: newRemaining, status: newStatus }
        };
    };

    const createCreditNote = ({
        amount,
        customerName = 'Client Comptoir',
        clientId = null,
        siteName = null,
        reason = 'Reliquat de monnaie non rendue',
        notes = '',
        cashierName = 'Caissier',
        customCode = null
    }) => {
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
        const rand = Math.floor(1000 + Math.random() * 9000);
        const voucherCode = customCode || `AVR-${dateStr.slice(2, 6)}-${rand}`;

        const newCreditNote = {
            id: `cn_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            code: voucherCode,
            type: 'change_reliquat',
            storeId: currentStoreId || storeKey,
            customerName: customerName || 'Client Comptoir',
            clientId: clientId || null,
            siteName: siteName || null,
            initialAmount: parseFloat(amount) || 0,
            remainingAmount: parseFloat(amount) || 0,
            status: 'active',
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
            notes: notes || reason,
            cashierName: cashierName || 'Caissier'
        };

        setAllCreditNotes(prev => [newCreditNote, ...prev]);
        return newCreditNote;
    };

    const cancelCreditNote = (id, reason = '') => {
        setAllCreditNotes(prev => prev.map(c => {
            if (c.id === id) {
                return { ...c, status: 'cancelled', cancelReason: reason, cancelledAt: new Date().toISOString() };
            }
            return c;
        }));
    };

    const cartTotal = cart.reduce((sum, item) => sum + (getItemPrice(item) * item.inputQuantity), 0);

    return (
        <SalesContext.Provider value={{
            cart,
            addToCart,
            removeFromCart,
            updateCartItem,
            clearCart,
            completeSale,
            cartTotal,
            transactions,
            quotes,
            addQuote,
            addQuoteWithItems,
            deleteQuote,
            convertQuoteToSale,
            cancelTransaction,
            expenses,
            addExpense,
            deleteExpense,
            debts,
            addDebtPayment,
            returns,
            creditNotes,
            createReturn,
            createCreditNote,
            getCreditNote,
            useCreditNote,
            cancelCreditNote,
            isLoadingSales
        }}>
            {children}
        </SalesContext.Provider>
    );
};
