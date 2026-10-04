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
