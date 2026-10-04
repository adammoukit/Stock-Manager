import { useMemo } from 'react';
import { useSession } from '../context/SessionContext';
import { useInventory } from '../context/InventoryContext';
import { useSales } from '../context/SalesContext';
import { useClients } from '../context/ClientContext';
import { useDeliveries } from '../context/DeliveryContext';
import { useSettings } from '../context/SettingsContext';
import { formatPrice } from '../utils/currency';

/**
 * useAnomalies.js
 * Cerveau Intelligent & Moteur de Détection d'Anomalies Opérationnelles 360°
 * 
 * Analyse en continu l'ensemble des données du système afin de repérer les risques
 * et anomalies invisibles à l'œil nu :
 * 1. Caisse & Sessions (écarts de caisse / coulages, surplus suspects, sessions oubliées)
 * 2. Stocks Bas (ruptures totales, seuils de sécurité franchis, stocks négatifs)
 * 3. Excédents & Stocks Dormants (articles sans rotation > 45j, surstockage immobilisant la trésorerie)
 * 4. Créances Clients (dépassements de plafonds autorisés, factures en souffrance > 30j)
 * 5. Marges & Ventes (ventes à perte / marge brute négative, remises disproportionnées)
 * 6. Expéditions & Livraisons (bons en attente > 48h non expédiés)
 */
export const useAnomalies = () => {
    const { masterSessions, pastSessions, activeSession, isOverdue } = useSession();
    const { products } = useInventory();
    const { transactions, debts, returns, creditNotes } = useSales();
    const { clients } = useClients();
    const { deliveryNotes } = useDeliveries();
    const { currentStoreId } = useSettings();

    const storeKey = currentStoreId ? String(currentStoreId) : 'store_default';

    const result = useMemo(() => {
        const detected = [];

        // ══════════════════════════════════════════════════════════════════════
        // 1. ÉCARTS DE CAISSE & AUDIT SESSIONS (Coulages & Surplus)
        // ══════════════════════════════════════════════════════════════════════
        const sessionsPool = [];
        const seenSessionIds = new Set();
        [...(masterSessions || []), ...(pastSessions || [])].forEach(s => {
            if (s && s.id && !seenSessionIds.has(s.id)) {
                seenSessionIds.add(s.id);
                if (!s.storeId || String(s.storeId) === storeKey) {
                    // Seules les sessions clôturées avec arrêté aveugle peuvent présenter un déficit ou un surplus
                    if (s.status === 'closed' || s.endTime || s.closedAt) {
                        sessionsPool.push(s);
                    }
                }
            }
        });

        sessionsPool.forEach(session => {
            // Calcul universel et tolérant de l'écart :
            // 1. session.difference (propriété officielle issue de closeSession)
            // 2. session.actualAmount - session.expectedAmount
            // 3. session.totalRealDeclared - session.totalTheoreticalCalculated
            let diff = 0;
            if (session.difference !== undefined && session.difference !== null) {
                diff = parseFloat(session.difference) || 0;
            } else if (session.actualAmount !== undefined && session.expectedAmount !== undefined) {
                diff = (parseFloat(session.actualAmount) || 0) - (parseFloat(session.expectedAmount) || 0);
            } else if (session.totalRealDeclared !== undefined || session.totalTheoreticalCalculated !== undefined) {
                diff = (parseFloat(session.totalRealDeclared) || 0) - (parseFloat(session.totalTheoreticalCalculated) || 0);
            }

            const theo = parseFloat(session.expectedAmount ?? session.totalTheoreticalCalculated) || 0;
            const decl = parseFloat(session.actualAmount ?? session.totalRealDeclared) || 0;
            const sessionDate = session.startTime || session.openedAt || session.date || session.endTime || session.closedAt || new Date().toISOString();
            const dateFormatted = new Date(sessionDate).toLocaleDateString('fr-FR');
            const timeFormatted = new Date(sessionDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

            // Déficit constaté = Perte financière / Risque de coulage (ex: -3 900 F CFA)
            if (diff < 0) {
                detected.push({
                    id: `cash_deficit_${session.id}`,
                    type: 'cash_deficit',
                    category: 'caisse',
                    categoryLabel: 'Caisse & Écarts',
                    severity: 'critical',
                    title: `Déficit de Caisse Constaté (Coulage : ${formatPrice(diff)})`,
                    description: `Écart négatif de ${Math.abs(diff).toLocaleString('fr-FR')} FCFA sur la clôture aveugle de la session #${session.id.slice(0, 15)} (Théorique : ${formatPrice(theo)} • Compté : ${formatPrice(decl)}).`,
                    details: `Opérateur : ${session.cashierName || session.userId || 'Caissier'} • Clôturée le ${dateFormatted} à ${timeFormatted} • Statut visa : ${session.auditStatus === 'approved' ? 'Validé' : 'À arbitrer'}`,
                    financialImpact: Math.abs(diff),
                    date: sessionDate,
                    actionLabel: 'Auditer la Caisse',
                    actionReportId: 'cash_audit',
                    meta: session
                });
            } else if (diff > 0) {
                // Surplus inexpliqué = Erreur d'encaissement ou vente non déclarée
                detected.push({
                    id: `cash_surplus_${session.id}`,
                    type: 'cash_surplus',
                    category: 'caisse',
                    categoryLabel: 'Caisse & Écarts',
                    severity: 'warning',
                    title: `Surplus de Caisse Inexpliqué (+${formatPrice(diff)})`,
                    description: `Excédent physique de +${diff.toLocaleString('fr-FR')} FCFA par rapport au théorique calculé sur la session #${session.id.slice(0, 15)} (Théorique : ${formatPrice(theo)} • Compté : ${formatPrice(decl)}).`,
                    details: `Risque d'oubli de saisie d'une vente ou d'erreur de rendu monnaie.`,
                    financialImpact: diff,
                    date: sessionDate,
                    actionLabel: 'Rapprocher la Caisse',
                    actionReportId: 'cash_audit',
                    meta: session
                });
            }
        });

        // Session active non clôturée depuis plus de 24h
        const openTime = activeSession?.startTime || activeSession?.openedAt;
        if (activeSession && (isOverdue || (openTime && (Date.now() - new Date(openTime).getTime() > 24 * 3600 * 1000)))) {
            detected.push({
                id: `cash_overdue_${activeSession.id || 'active'}`,
                type: 'cash_overdue',
                category: 'caisse',
                categoryLabel: 'Caisse & Écarts',
                severity: 'warning',
                title: 'Session de Caisse Oubliée (> 24h sans clôture)',
                description: `La session actuelle #${activeSession.id?.slice(0, 15)} reste ouverte depuis plus de 24 heures sans arrêté de caisse aveugle.`,
                details: `Risque de mélange des encaissements d'une journée sur l'autre.`,
                financialImpact: 0,
                date: openTime || new Date().toISOString(),
                actionLabel: 'Clôturer la Session',
                actionReportId: 'cash_audit',
                meta: activeSession
            });
        }

        // ══════════════════════════════════════════════════════════════════════
        // 2. STOCKS BAS & RUPTURES CRITIQUES
        // ══════════════════════════════════════════════════════════════════════
        (products || []).forEach(product => {
            const stock = product.stockLevels?.[storeKey] ?? product.stock ?? 0;
            const minStock = parseFloat(product.minStock) || 5;
            const purchasePrice = parseFloat(product.purchasePrice) || 0;

            if (stock < 0) {
                detected.push({
                    id: `stock_negative_${product.id}`,
                    type: 'stock_negative',
                    category: 'stock',
                    categoryLabel: 'Stocks & Ruptures',
                    severity: 'critical',
                    title: `Stock Négatif Anormal : ${product.name}`,
                    description: `Stock enregistré à ${stock} ${product.unit || 'unités'} (vente sans stock préalable ou erreur d'inventaire).`,
                    details: `Rayon : ${product.category || 'Général'} • Nécessite un ajustement de stock immédiat.`,
                    financialImpact: Math.abs(stock) * purchasePrice,
                    date: new Date().toISOString(),
                    actionLabel: 'Ajuster le Stock',
                    actionReportId: 'low_stock',
                    meta: product
                });
            } else if (stock === 0) {
                detected.push({
                    id: `stock_out_${product.id}`,
                    type: 'stock_out',
                    category: 'stock',
                    categoryLabel: 'Stocks & Ruptures',
                    severity: 'critical',
                    title: `Rupture Totale : ${product.name}`,
                    description: `Rupture sèche (0 ${product.unit || 'unités'}). Les ventes sur cet article sont bloquées.`,
                    details: `Seuil d'alerte configuré à ${minStock} ${product.unit || 'unités'}.`,
                    financialImpact: minStock * purchasePrice,
                    date: new Date().toISOString(),
                    actionLabel: 'Réapprovisionner',
                    actionReportId: 'low_stock',
                    meta: product
                });
            } else if (stock <= minStock) {
                detected.push({
                    id: `stock_low_${product.id}`,
                    type: 'stock_low',
                    category: 'stock',
                    categoryLabel: 'Stocks & Ruptures',
                    severity: 'warning',
                    title: `Stock Critique : ${product.name}`,
                    description: `Plus que ${stock} ${product.unit || 'unités'} en réserve (seuil minimum d'alerte : ${minStock}).`,
                    details: `Risque d'indisponibilité sous peu si une commande chantier est passée.`,
                    financialImpact: (minStock - stock) * purchasePrice,
                    date: new Date().toISOString(),
                    actionLabel: 'Commander Stock',
                    actionReportId: 'low_stock',
                    meta: product
                });
            }
        });

        // ══════════════════════════════════════════════════════════════════════
        // 3. EXCÉDENTS, SURSTOCKAGE & STOCKS DORMANTS
        // ══════════════════════════════════════════════════════════════════════
        const fortyFiveDaysAgo = new Date();
        fortyFiveDaysAgo.setDate(fortyFiveDaysAgo.getDate() - 45);

        // Index des dates de dernière vente par produit
        const productLastSaleMap = {};
        (transactions || []).forEach(tx => {
            if (tx.status === 'completed' && tx.items) {
                const txDate = new Date(tx.date);
                tx.items.forEach(item => {
                    const existing = productLastSaleMap[item.id];
                    if (!existing || txDate > existing) {
                        productLastSaleMap[item.id] = txDate;
                    }
                });
            }
        });

        (products || []).forEach(product => {
            const stock = product.stockLevels?.[storeKey] ?? product.stock ?? 0;
            const minStock = parseFloat(product.minStock) || 5;
            const maxStock = parseFloat(product.maxStock) || 0;
            const purchasePrice = parseFloat(product.purchasePrice) || 0;

            // Surstockage dépassant le plafond défini
            if (maxStock > 0 && stock > maxStock) {
                const excessQty = stock - maxStock;
                const tiedCash = excessQty * purchasePrice;
                detected.push({
                    id: `stock_excess_${product.id}`,
                    type: 'stock_excess',
                    category: 'excedent',
                    categoryLabel: 'Excédents & Surstock',
                    severity: 'warning',
                    title: `Surstockage Détecté : ${product.name}`,
                    description: `Quantité en magasin (${stock}) supérieure au plafond maximal conseillé (${maxStock}).`,
                    details: `Excédent de ${excessQty} ${product.unit || 'unités'} immobilisant environ ${tiedCash.toLocaleString('fr-FR')} FCFA.`,
                    financialImpact: tiedCash,
                    date: new Date().toISOString(),
                    actionLabel: 'Voir le Surstock',
                    actionReportId: 'dormant_stock',
                    meta: product
                });
            }

            // Stocks Dormants : Stock en rayon mais aucune vente depuis plus de 45 jours
            if (stock > 0) {
                const lastSaleDate = productLastSaleMap[product.id];
                const isDormant = !lastSaleDate || lastSaleDate < fortyFiveDaysAgo;
                const tiedValue = stock * purchasePrice;

                // On ne signale comme anomalie que si la valeur immobilisée est significative (> 25 000 FCFA)
                if (isDormant && tiedValue >= 25000) {
                    detected.push({
                        id: `stock_dormant_${product.id}`,
                        type: 'stock_dormant',
                        category: 'excedent',
                        categoryLabel: 'Excédents & Surstock',
                        severity: 'warning',
                        title: `Stock Dormant (> 45j) : ${product.name}`,
                        description: `Aucune vente enregistrée depuis plus de 45 jours alors que ${stock} ${product.unit || 'unités'} sont stockées.`,
                        details: `Trésorerie gelée : ${tiedValue.toLocaleString('fr-FR')} FCFA sans retour sur investissement.`,
                        financialImpact: tiedValue,
                        date: lastSaleDate ? lastSaleDate.toISOString() : new Date().toISOString(),
                        actionLabel: 'Déstocker / Promouvoir',
                        actionReportId: 'dormant_stock',
                        meta: product
                    });
                }
            }
        });

        // ══════════════════════════════════════════════════════════════════════
        // 4. CRÉANCES CLIENTS & RISQUE DE RECOUVREMENT
        // ══════════════════════════════════════════════════════════════════════
        (clients || []).forEach(client => {
            const debt = (parseFloat(client.totalDebt) || 0) || (debts || [])
                .filter(d => (d.clientId === client.id || d.customerName === client.name) && d.status !== 'paid')
                .reduce((sum, d) => sum + (parseFloat(d.remainingAmount ?? d.amount) || 0), 0);
            const limit = parseFloat(client.creditLimit) || 0;

            // Dépassement de plafond de crédit autorisé
            if (limit > 0 && debt > limit) {
                const overLimit = debt - limit;
                detected.push({
                    id: `debt_overlimit_${client.id}`,
                    type: 'debt_overlimit',
                    category: 'creance',
                    categoryLabel: 'Créances & Débiteurs',
                    severity: 'critical',
                    title: `Plafond de Crédit Dépassé : ${client.name}`,
                    description: `Ce client doit ${debt.toLocaleString('fr-FR')} FCFA pour un plafond contractuel fixé à ${limit.toLocaleString('fr-FR')} FCFA.`,
                    details: `Dépassement de +${overLimit.toLocaleString('fr-FR')} FCFA. Bloquer toute nouvelle vente à crédit !`,
                    financialImpact: overLimit,
                    date: new Date().toISOString(),
                    actionLabel: 'Relancer le Client',
                    actionReportId: 'client_debts',
                    meta: client
                });
            } else if (debt > 100000 && limit === 0) {
                // Client avec dette importante sans aucun plafond contractuel défini
                detected.push({
                    id: `debt_nolimit_${client.id}`,
                    type: 'debt_nolimit',
                    category: 'creance',
                    categoryLabel: 'Créances & Débiteurs',
                    severity: 'warning',
                    title: `Dette Non Cadrée : ${client.name}`,
                    description: `Ce client a accumulé ${debt.toLocaleString('fr-FR')} FCFA d'arriérés sans limite de crédit préalablement définie.`,
                    details: `Risque d'insolvabilité en l'absence de contrat cadre.`,
                    financialImpact: debt,
                    date: new Date().toISOString(),
                    actionLabel: 'Régulariser Crédit',
                    actionReportId: 'client_debts',
                    meta: client
                });
            }
        });

        // Vérification des créances anciennes dans la table des dettes
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        (debts || []).forEach(debt => {
            const remaining = parseFloat(debt.remainingAmount ?? debt.amount) || 0;
            if (remaining > 0 && debt.status !== 'paid') {
                const createdAt = new Date(debt.createdAt || debt.date || 0);
                if (createdAt < thirtyDaysAgo) {
                    detected.push({
                        id: `debt_aged_${debt.id}`,
                        type: 'debt_aged',
                        category: 'creance',
                        categoryLabel: 'Créances & Débiteurs',
                        severity: 'warning',
                        title: `Créance Ancienne Impayée (> 30j)`,
                        description: `Dette de ${remaining.toLocaleString('fr-FR')} FCFA pour "${debt.customerName || 'Client'}" non soldée depuis plus de 30 jours.`,
                        details: `Réf : #${debt.id} • Émise le ${createdAt.toLocaleDateString('fr-FR')}.`,
                        financialImpact: remaining,
                        date: createdAt.toISOString(),
                        actionLabel: 'Recouvrer la Dette',
                        actionReportId: 'client_debts',
                        meta: debt
                    });
                }
            }
        });

        // ══════════════════════════════════════════════════════════════════════
        // 5. MARGES NÉGATIVES & ANOMALIES DE VENTE
        // ══════════════════════════════════════════════════════════════════════
        (transactions || []).forEach(tx => {
            if (tx.status === 'completed' && Array.isArray(tx.items)) {
                tx.items.forEach(item => {
                    const unitPrice = parseFloat(item.unitPrice ?? item.price) || 0;
                    const purchasePrice = parseFloat(item.purchasePrice) || 0;
                    const qty = item.quantity || 1;

                    // Vente à perte (prix de vente inférieur au prix d'achat)
                    if (purchasePrice > 0 && unitPrice < purchasePrice) {
                        const loss = (purchasePrice - unitPrice) * qty;
                        detected.push({
                            id: `loss_sale_${tx.id}_${item.id}`,
                            type: 'margin_loss',
                            category: 'rentabilite',
                            categoryLabel: 'Marges & Rentabilité',
                            severity: 'critical',
                            title: `Vente à Perte Détectée : ${item.name}`,
                            description: `Vendu à ${unitPrice.toLocaleString('fr-FR')} FCFA alors que le coût d'achat est de ${purchasePrice.toLocaleString('fr-FR')} FCFA.`,
                            details: `Perte sèche de -${loss.toLocaleString('fr-FR')} FCFA sur la facture #${tx.id} (${new Date(tx.date).toLocaleDateString('fr-FR')}).`,
                            financialImpact: loss,
                            date: tx.date || new Date().toISOString(),
                            actionLabel: 'Vérifier la Marge',
                            actionReportId: 'profitability',
                            meta: { tx, item }
                        });
                    }
                });
            }
        });

        // ══════════════════════════════════════════════════════════════════════
        // 6. EXPÉDITIONS & LIVRAISONS EN SOUFFRANCE
        // ══════════════════════════════════════════════════════════════════════
        const twoDaysAgo = new Date();
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

        (deliveryNotes || []).forEach(note => {
            if (note.status === 'pending' || note.status === 'partial') {
                const noteDate = new Date(note.createdAt || note.date || 0);
                if (noteDate < twoDaysAgo) {
                    detected.push({
                        id: `delivery_stalled_${note.id}`,
                        type: 'delivery_stalled',
                        category: 'livraison',
                        categoryLabel: 'Expéditions & Chantiers',
                        severity: 'warning',
                        title: `Bon de Livraison Bloqué (> 48h)`,
                        description: `Le bon ${note.reference || note.id} pour ${note.clientName || 'Client'} est resté en statut "${note.status === 'partial' ? 'Partiel' : 'En attente'}".`,
                        details: `Articles sortis de caisse mais non attestés réceptionnés sur le chantier.`,
                        financialImpact: 0,
                        date: noteDate.toISOString(),
                        actionLabel: 'Suivre la Livraison',
                        actionReportId: 'deliveries',
                        meta: note
                    });
                }
            }
        });

        // ══════════════════════════════════════════════════════════════════════
        // 7. BONS D'AVOIR, RETOURS & PERTES SUR AVARIES
        // ══════════════════════════════════════════════════════════════════════
        const nowMs = Date.now();
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

        (creditNotes || []).forEach(cn => {
            if (cn.status === 'active' || cn.status === 'partial') {
                const expiresAtMs = new Date(cn.expiresAt).getTime();
                const createdAtMs = new Date(cn.createdAt).getTime();

                // 1. Avoir approchant de la péremption (<= 7 jours)
                if (expiresAtMs > nowMs && (expiresAtMs - nowMs) <= sevenDaysMs) {
                    detected.push({
                        id: `cn_expiring_${cn.id}`,
                        type: 'credit_note_expiring',
                        category: 'caisse',
                        categoryLabel: 'Avoirs & Caisse',
                        severity: 'warning',
                        title: `Bon d'Avoir Bientôt Expiré : ${cn.code}`,
                        description: `L'avoir de ${cn.customerName || 'Client'} d'un solde de ${(cn.remainingAmount || 0).toLocaleString('fr-FR')} FCFA expire dans moins de 7 jours.`,
                        details: `Délai de validité de 60 jours presque atteint. Relancer le client pour consommation immédiate au comptoir.`,
                        financialImpact: cn.remainingAmount || 0,
                        date: cn.createdAt,
                        actionLabel: 'Gérer les Avoirs',
                        actionReportId: 'returns',
                        meta: cn
                    });
                }

                // 2. Avoir dormant (> 30 jours sans rachat)
                if ((nowMs - createdAtMs) > thirtyDaysMs && cn.status === 'active') {
                    detected.push({
                        id: `cn_dormant_${cn.id}`,
                        type: 'credit_note_dormant',
                        category: 'caisse',
                        categoryLabel: 'Avoirs & Caisse',
                        severity: 'info',
                        title: `Bon d'Avoir Dormant (> 30j) : ${cn.code}`,
                        description: `Avoir de ${(cn.remainingAmount || 0).toLocaleString('fr-FR')} FCFA émis il y a plus d'un mois pour "${cn.customerName || 'Client'}" non réclamé.`,
                        details: `Dette différée restant au passif du magasin. Risque d'oubli par le client.`,
                        financialImpact: cn.remainingAmount || 0,
                        date: cn.createdAt,
                        actionLabel: 'Consulter l\'Avoir',
                        actionReportId: 'returns',
                        meta: cn
                    });
                }
            }
        });

        // 3. Détection des pertes de stock sur articles retournés avariés / cassés
        (returns || []).forEach(r => {
            const damaged = (r.items || []).filter(item => item.condition === 'damaged' && !item.reintegrated);
            if (damaged.length > 0) {
                const totalLoss = damaged.reduce((sum, item) => {
                    const qty = item.quantityReturned || item.quantity || 1;
                    const price = item.unitPrice || item.price || 0;
                    return sum + (qty * price);
                }, 0);

                if (totalLoss > 0) {
                    detected.push({
                        id: `return_damaged_${r.id || r.returnNumber}`,
                        type: 'return_damaged_scrap',
                        category: 'stock',
                        categoryLabel: 'Stocks & Rebuts',
                        severity: 'warning',
                        title: `Marchandises Avariées au Retour : ${r.returnNumber}`,
                        description: `${damaged.length} article(s) retourné(s) non réintégrable(s) en stock (rebut / casse évalué à ${totalLoss.toLocaleString('fr-FR')} FCFA).`,
                        details: `Client : ${r.customerName || 'Client Comptoir'} • Motif : ${r.reason || 'Surplus'} • Date : ${new Date(r.date).toLocaleDateString('fr-FR')}`,
                        financialImpact: totalLoss,
                        date: r.date,
                        actionLabel: 'Voir le Retour',
                        actionReportId: 'returns',
                        meta: r
                    });
                }
            }
        });

        // Tri intelligent : D'abord les Critiques, puis les Warnings, et ensuite par impact financier décroissant
        const severityWeight = { critical: 3, warning: 2, info: 1 };
        detected.sort((a, b) => {
            const weightDiff = (severityWeight[b.severity] || 0) - (severityWeight[a.severity] || 0);
            if (weightDiff !== 0) return weightDiff;
            return (b.financialImpact || 0) - (a.financialImpact || 0);
        });

        // Calculs des compteurs et métriques de synthèse
        const criticalCount = detected.filter(a => a.severity === 'critical').length;
        const warningCount = detected.filter(a => a.severity === 'warning').length;
        const infoCount = detected.filter(a => a.severity === 'info').length;
        const totalFinancialRisk = detected.reduce((sum, a) => sum + (a.financialImpact || 0), 0);

        const categoryCounts = {
            all: detected.length,
            caisse: detected.filter(a => a.category === 'caisse').length,
            stock: detected.filter(a => a.category === 'stock').length,
            excedent: detected.filter(a => a.category === 'excedent').length,
            creance: detected.filter(a => a.category === 'creance').length,
            rentabilite: detected.filter(a => a.category === 'rentabilite').length,
            livraison: detected.filter(a => a.category === 'livraison').length,
        };

        return {
            anomalies: detected,
            totalCount: detected.length,
            criticalCount,
            warningCount,
            infoCount,
            totalFinancialRisk,
            categoryCounts
        };
    }, [masterSessions, activeSession, isOverdue, products, transactions, debts, returns, creditNotes, clients, deliveryNotes, storeKey]);

    return result;
};

export default useAnomalies;
