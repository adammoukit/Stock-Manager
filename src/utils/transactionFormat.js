/**
 * transactionFormat.js — Utilitaires de formatage des numéros de transactions
 * et reçus de caisse pour quincaillerie.
 * 
 * Remplace l'UUID brut par une référence commerciale propre, courte et professionnelle.
 * Ex: REC-20260919-4F82, FAC-20260919-4F82, BL-20260919-4F82
 */

/**
 * Formate un identifiant de transaction (UUID, timestamp ou identifiant numérique)
 * en une référence commerciale lisible et normalisée.
 * 
 * @param {object|string} transaction L'objet transaction ou son identifiant brut
 * @param {string} prefix Préfixe ('REC' pour Reçu, 'FAC' pour Facture, 'BL' pour Bon de Livraison, 'VTE' pour Vente)
 * @returns {string} Numéro formaté (ex: REC-20260919-4F82)
 */
export const formatTransactionNumber = (transaction, prefix = 'REC') => {
    if (!transaction) return '';

    // Si la transaction a déjà un numéro de transaction personnalisé
    if (typeof transaction === 'object' && transaction.transactionNumber) {
        return transaction.transactionNumber;
    }

    const rawId = typeof transaction === 'object'
        ? (transaction.id || transaction.transactionId || '')
        : transaction;

    const rawDate = (typeof transaction === 'object' && (transaction.date || transaction.transactionDate))
        ? new Date(transaction.date || transaction.transactionDate)
        : new Date();

    const d = isNaN(rawDate.getTime()) ? new Date() : rawDate;

    // Date YYYYMMDD
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${y}${m}${day}`;

    // Extraction d'un suffixe unique de 4 caractères
    let suffix = '0001';
    const rawIdStr = String(rawId || '').trim();

    if (rawIdStr.includes('-')) {
        // UUID : extraire les 4 derniers caractères hexadécimaux
        const clean = rawIdStr.replace(/[^a-zA-Z0-9]/g, '');
        suffix = clean.slice(-4).toUpperCase();
    } else if (/^\d+$/.test(rawIdStr)) {
        // Séquentiel ou timestamp
        suffix = rawIdStr.slice(-4).padStart(4, '0');
    } else if (rawIdStr.length > 0) {
        const clean = rawIdStr.replace(/[^a-zA-Z0-9]/g, '');
        suffix = (clean.slice(-4) || '0001').toUpperCase();
    }

    return `${prefix}-${dateStr}-${suffix}`;
};

/**
 * Formate un identifiant ou numéro de commande d'approvisionnement en une référence
 * de Bon de Commande officielle et normalisée (ex: BC-2026-0001).
 * 
 * @param {string|number} orderNumber Le numéro de commande existant ou brut
 * @param {string|number} fallbackId Identifiant de secours si orderNumber est absent
 * @param {string} fallbackDate Date de la commande pour l'année
 * @returns {string} Numéro normalisé officiel (ex: BC-2026-0001)
 */
export const formatOrderNumber = (orderNumber, fallbackId, fallbackDate) => {
    if (!orderNumber && !fallbackId) return 'BC-0001';

    const numStr = String(orderNumber || '').trim();

    // Si déjà au format BC-YYYY-XXXX ou BCF-YYYY-XXXX
    if (/^BCF?-\d{4}-\d+/i.test(numStr)) {
        return numStr.toUpperCase();
    }

    // Si c'est l'ancien format anglophone PO-YYYY-XXXX ou PO-XXXX
    if (/^PO-/i.test(numStr)) {
        return numStr.replace(/^PO-/i, 'BC-').toUpperCase();
    }

    // Si c'est une date pour l'année
    const d = fallbackDate ? new Date(fallbackDate) : new Date();
    const year = isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear();

    // Si c'est un identifiant numérique ou un timestamp
    if (/^\d+$/.test(numStr)) {
        const suffix = numStr.slice(-4).padStart(4, '0');
        return `BC-${year}-${suffix}`;
    }

    if (!numStr && fallbackId) {
        const idStr = String(fallbackId);
        const suffix = idStr.slice(-4).padStart(4, '0');
        return `BC-${year}-${suffix}`;
    }

    if (numStr.startsWith('BC-')) return numStr.toUpperCase();

    return `BC-${numStr}`;
};

