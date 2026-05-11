import React, { createContext, useContext, useState, useEffect } from 'react';
import { useInventory } from './InventoryContext';
import { useSettings } from './SettingsContext';
import { salesApi } from '../services/apiClient';

import { getUnitModel } from '../config/unitModels';

const SalesContext = createContext();

export const useSales = () => useContext(SalesContext);

export const SalesProvider = ({ children }) => {
    const { products, recordSale, refreshProducts } = useInventory();
    const { currentStoreId } = useSettings();
    
    const [cart, setCart] = useState([]);
    const [allTransactions, setAllTransactions] = useState([]);
    const [allQuotes, setAllQuotes] = useState([]);
    const [allExpenses, setAllExpenses] = useState([]);
    const [allDebts, setAllDebts] = useState([]);
    const [isLoadingSales, setIsLoadingSales] = useState(true);

    // Clear old localStorage data to prevent leaks
    useEffect(() => {
        localStorage.removeItem("transactions");
        localStorage.removeItem("quotes");
        localStorage.removeItem("expenses");
        localStorage.removeItem("debts");
        localStorage.removeItem("quincaillerie_sales_migration_v3");
    }, []);

    // Fetch real sales data from backend
    useEffect(() => {
        const fetchTransactions = async () => {
            if (!currentStoreId) return;
            try {
                setIsLoadingSales(true);
                const response = await salesApi.getByStore(currentStoreId);
                // apiClient returns response.data directly, so 'response' is already the array
                const transactionsList = Array.isArray(response) ? response : (response?.data || []);
                
                const backendTx = transactionsList.map(tx => ({
                    id: tx.id,
                    storeId: tx.storeId,
                    date: tx.transactionDate,
                    total: tx.totalAmount,
                    paymentMethod: tx.paymentMethod,
                    amountGiven: tx.amountGiven,
                    change: tx.changeAmount,
                    status: tx.status,
                    items: (tx.items || []).map(item => ({
                        id: item.productId,
                        name: item.productName,
                        unit: item.productUnit,
                        inputQuantity: item.quantity,
                        price: item.unitPrice,
                        totalPrice: item.totalPrice,
                        type: item.saleType,
                        label: item.saleType === 'lot' ? 'Lot' : (item.saleType === 'packaging' ? 'Fract.' : item.productUnit)
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

    // Derived states based on current store
    const transactions = allTransactions.filter(t => t.storeId === currentStoreId);
    const quotes = allQuotes.filter(q => q.storeId === currentStoreId);
    const expenses = allExpenses.filter(e => e.storeId === currentStoreId);
    const debts = allDebts.filter(d => d.storeId === currentStoreId);

    const addToCart = (product, options = null) => {
        setCart(prev => {
            let type = options?.type || (options?.modelId ? 'packaging' : 'base');
            const packagingId = options?.modelId || options?.id;
            const cartKey = type === 'base' ? `${product.id}_base` : type === 'lot' ? `${product.id}_lot` : `${product.id}_${packagingId}`;
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
            } else if (type === 'lot') {
                const lotQty = parseFloat(product.retailStepQuantity) || 10;
                // container products: deduct lotQty/cf (fraction of container)
                // simple unit products: deduct lotQty directly
                newCartItem.baseDeduction = isContainer ? (lotQty / cf) : lotQty;
                newCartItem.label = `Lot de ${lotQty} ${getUnitModel(product.unit).subUnit || 'Pièces'}`;
                newCartItem.price = parseFloat(product.lotPrice);
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
                storeId: currentStoreId,
                date: savedTransaction.data?.transactionDate || savedTransaction.transactionDate || new Date().toISOString(),
                items: [...cart],
                total,
                paymentMethod: saleRequest.paymentMethod,
                amountGiven: saleRequest.amountGiven,
                change: saleRequest.changeAmount,
                status: 'completed'
            };
            
            // Refresh inventory from backend to get the ultra-precise stock deduction
            await refreshProducts();

            if (saleRequest.paymentMethod === 'credit') {
                const newDebt = {
                    id: Date.now(),
                    storeId: currentStoreId,
                    transactionId: uiTransaction.id,
                    date: new Date().toISOString(),
                    customerName: paymentInfo.customerName || 'Client Inconnu',
                    totalAmount: total,
                    paidAmount: paymentInfo.amountGiven || 0,
                    status: 'pending'
                };
                setAllDebts([newDebt, ...allDebts]);
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
    const addDebtPayment = (debtId, amount) => {
        setAllDebts(prevDebts => prevDebts.map(debt => {
            if (debt.id === debtId) {
                const newPaid = debt.paidAmount + amount;
                return {
                    ...debt,
                    paidAmount: newPaid,
                    status: newPaid >= debt.totalAmount ? 'paid' : 'pending'
                };
            }
            return debt;
        }));
        
        // Add a mock transaction for the debt payment
        const fakeTransaction = {
            id: Date.now(),
            storeId: currentStoreId,
            date: new Date().toISOString(),
            items: [],
            total: amount,
            paymentMethod: 'cash',
            amountGiven: amount,
            change: 0,
            status: 'debt_payment'
        };
        setAllTransactions(prev => [fakeTransaction, ...prev]);
    };

    // Quote Management
    const addQuote = (customerName) => {
        const total = cart.reduce((sum, item) => sum + (getItemPrice(item) * item.inputQuantity), 0);
        const quote = {
            id: Date.now(),
            storeId: currentStoreId,
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
        const total = items.reduce((sum, item) => sum + (getItemPrice(item) * item.inputQuantity), 0);
        const quote = {
            id: Date.now(),
            storeId: currentStoreId,
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
            storeId: currentStoreId,
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
            storeId: currentStoreId,
            ...expenseData,
            date: expenseData.date || new Date().toISOString()
        };
        setAllExpenses([expense, ...allExpenses]);
        return expense;
    };

    const deleteExpense = (id) => {
        setAllExpenses(allExpenses.filter(e => e.id !== id));
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
            isLoadingSales
        }}>
            {children}
        </SalesContext.Provider>
    );
};
