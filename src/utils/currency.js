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
    return parseFloat(priceString.replace(/[^\d.-]/g, ''));
};
