// Currency configuration for the application
export const CURRENCY = {
    code: 'XOF',
    symbol: 'F CFA',
    name: 'Franc CFA',
    position: 'after' // 'before' or 'after' the amount
};

// Format simple sans le symbole (utilisé dans les tableaux)
export const formatRowPrice = (amount) => {
    const cleanAmount = Math.round(Number(amount || 0));
    return cleanAmount.toLocaleString('fr-FR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).replace(/\u202f/g, ' '); // Remplace l'espace fin par un espace standard plus lisible
};

// Format complet avec le symbole FCFA
export const formatPrice = (amount) => {
    const formatted = formatRowPrice(amount);
    return CURRENCY.position === 'after'
        ? `${formatted} ${CURRENCY.symbol}` 
        : `${CURRENCY.symbol} ${formatted}`;
};


// Parse price from string
export const parsePrice = (priceString) => {
    return parseFloat(String(priceString || '').replace(/[^\d.-]/g, ''));
};

/**
 * Formate un nombre ou une chaîne avec des espaces comme séparateurs de milliers
 * Ex: 10000 -> "10 000", 1000000 -> "1 000 000"
 */
export const formatFinancialNumber = (val, allowDecimals = false) => {
    if (val === null || val === undefined || val === '') return '';
    const str = String(val).trim();
    if (!str) return '';

    if (allowDecimals) {
        const normalized = str.replace(',', '.');
        const clean = normalized.replace(/[^\d.]/g, '');
        if (!clean) return '';
        const parts = clean.split('.');
        let intPart = parts[0] || '0';
        if (intPart.length > 1 && /^0\d/.test(intPart)) {
            intPart = intPart.replace(/^0+/, '') || '0';
        }
        const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
        if (parts.length > 1) {
            return `${formattedInt}.${parts.slice(1).join('')}`;
        }
        return formattedInt;
    } else {
        const clean = str.replace(/\D/g, '');
        if (!clean) return '';
        let intPart = clean;
        if (intPart.length > 1 && /^0\d/.test(intPart)) {
            intPart = intPart.replace(/^0+/, '') || '0';
        }
        return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    }
};

/**
 * Extrait la valeur numérique brute sans espaces pour le stockage ou les calculs
 * Ex: "10 000" -> "10000", "1 000 000" -> "1000000"
 */
export const unformatFinancialNumber = (str, allowDecimals = false) => {
    if (str === null || str === undefined || str === '') return '';
    const s = String(str).trim();
    if (!s) return '';
    if (allowDecimals) {
        const normalized = s.replace(',', '.');
        const clean = normalized.replace(/[^\d.]/g, '');
        const parts = clean.split('.');
        if (parts.length > 1) {
            return `${parts[0]}.${parts.slice(1).join('')}`;
        }
        return parts[0] || '';
    } else {
        return s.replace(/\D/g, '');
    }
};

