import React from 'react';

/**
 * barcodeGenerator.js — Utilitaires de génération et de rendu de codes-barres
 * 
 * Supporte :
 * 1. La génération de codes EAN-13 internes standardisés (Préfixe 200 réservé magasin).
 * 2. Le calcul et la validation de la clé de contrôle EAN-13 modulo 10.
 * 3. Moteur vectoriel SVG haute fidélité :
 *    - Rendu standard GS1 EAN-13 avec barres élancées, barres de garde allongées et typographie aérée.
 *    - Rendu Code 39 raffiné pour codes alphanumériques avec traits fins et équilibrés.
 */

/**
 * Calcule la clé de contrôle pour un code EAN (12 chiffres -> 13e chiffre)
 * Formule EAN-13 :
 * - Chiffres positions impaires (1, 3, 5, 7, 9, 11) * 1
 * - Chiffres positions paires (2, 4, 6, 8, 10, 12) * 3
 * - Clé = (10 - (somme % 10)) % 10
 */
export const calculateEan13Checksum = (first12Digits) => {
    if (!/^\d{12}$/.test(first12Digits)) {
        throw new Error("L'entrée doit contenir exactement 12 chiffres");
    }

    let sum = 0;
    for (let i = 0; i < 12; i++) {
        const digit = parseInt(first12Digits[i], 10);
        sum += (i % 2 === 0) ? digit : digit * 3;
    }

    const remainder = sum % 10;
    return remainder === 0 ? 0 : 10 - remainder;
};

/**
 * Génère un code EAN-13 interne unique pour le magasin.
 * Format : 200 + 9 chiffres aléatoires / horodatage + 1 clé de contrôle = 13 chiffres
 */
export const generateInternalBarcode = () => {
    const prefix = '200'; // Norme internationale GS1 pour usage interne restreint au magasin
    const randomPart = Math.floor(100000000 + Math.random() * 900000000).toString();
    const first12 = (prefix + randomPart).substring(0, 12);
    const checksum = calculateEan13Checksum(first12);
    return `${first12}${checksum}`;
};

/**
 * Valide si une chaîne est un code EAN-13 correct
 */
export const isValidEAN13 = (code) => {
    if (!code || typeof code !== 'string') return false;
    const clean = code.trim();
    if (!/^\d{13}$/.test(clean)) return false;

    const first12 = clean.substring(0, 12);
    const expectedChecksum = calculateEan13Checksum(first12);
    return parseInt(clean[12], 10) === expectedChecksum;
};

// =========================================================================
// Moteur de rendu GS1 EAN-13 (Standard International)
// Barres fines, élancées, barres de garde débordantes et chiffres calés
// =========================================================================

const EAN13_PARITIES = [
    'LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG',
    'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'
];

const EAN13_L_CODES = {
    '0': '0001101', '1': '0011001', '2': '0010011', '3': '0111101', '4': '0100011',
    '5': '0110001', '6': '0101111', '7': '0111011', '8': '0110111', '9': '0001011'
};

const EAN13_G_CODES = {
    '0': '0100111', '1': '0110011', '2': '0011011', '3': '0100001', '4': '0011101',
    '5': '0111001', '6': '0000101', '7': '0010001', '8': '0001001', '9': '0010111'
};

const EAN13_R_CODES = {
    '0': '1110010', '1': '1100110', '2': '1101100', '3': '1000010', '4': '1011100',
    '5': '1001110', '6': '1010000', '7': '1000100', '8': '1001000', '9': '1110100'
};

const renderEan13Svg = (code13, options = {}) => {
    const width = options.width || 180;
    const height = options.height ? Math.max(options.height, 12) : 54;
    const showText = options.showText !== false;
    const lineColor = options.lineColor || '#1e293b'; // Teinte ardoise élégante, contrastée et scannable sans être agressivement grasse

    const firstDigit = parseInt(code13[0], 10);
    const parity = EAN13_PARITIES[firstDigit] || 'LLLLLL';

    const MODULE_WIDTH = 1.0;
    const QUIET_LEFT = 11.0;
    const QUIET_RIGHT = 8.0;

    const normalBarHeight = showText ? Math.max(height - 13, 8) : height;
    const guardBarHeight = showText ? Math.max(height - 4, 10) : height;

    let rects = '';
    let currentX = QUIET_LEFT;

    const appendBits = (bitString, isGuard = false) => {
        const barH = isGuard ? guardBarHeight : normalBarHeight;
        for (let i = 0; i < bitString.length; i++) {
            if (bitString[i] === '1') {
                rects += `<rect x="${currentX.toFixed(2)}" y="0" width="${MODULE_WIDTH.toFixed(2)}" height="${barH}" fill="${lineColor}" />`;
            }
            currentX += MODULE_WIDTH;
        }
    };

    // 1. Guard start '101'
    appendBits('101', true);

    // 2. Chiffres 1 à 6 (Gauche)
    for (let i = 1; i <= 6; i++) {
        const d = code13[i];
        const isL = parity[i - 1] === 'L';
        const bits = isL ? EAN13_L_CODES[d] : EAN13_G_CODES[d];
        appendBits(bits, false);
    }

    // 3. Guard central '01010'
    appendBits('01010', true);

    // 4. Chiffres 7 à 12 (Droite)
    for (let i = 7; i <= 12; i++) {
        const d = code13[i];
        const bits = EAN13_R_CODES[d];
        appendBits(bits, false);
    }

    // 5. Guard fin '101'
    appendBits('101', true);

    const totalWidth = currentX + QUIET_RIGHT;

    // Chiffres positionnés élégamment avec typographie fine
    const textSvg = showText ? `
        <text x="4" y="${height - 1}" font-family="'Inter', -apple-system, sans-serif, monospace" font-size="9" font-weight="600" fill="${lineColor}">
            ${code13[0]}
        </text>
        <text x="${QUIET_LEFT + 3 + 21}" y="${height - 1}" text-anchor="middle" font-family="'Inter', -apple-system, sans-serif, monospace" font-size="9.5" font-weight="600" letter-spacing="1.5" fill="${lineColor}">
            ${code13.substring(1, 7)}
        </text>
        <text x="${QUIET_LEFT + 3 + 42 + 5 + 21}" y="${height - 1}" text-anchor="middle" font-family="'Inter', -apple-system, sans-serif, monospace" font-size="9.5" font-weight="600" letter-spacing="1.5" fill="${lineColor}">
            ${code13.substring(7, 13)}
        </text>
        <text x="${totalWidth - 3}" y="${height - 2}" text-anchor="end" font-family="monospace" font-size="8" font-weight="600" fill="${lineColor}">
            &gt;
        </text>
    ` : '';

    return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth.toFixed(2)} ${height}" width="${width}" height="${height}" style="display:block;margin:0 auto;max-width:100%;">
            ${rects}
            ${textSvg}
        </svg>
    `.trim();
};

// =========================================================================
// Moteur de rendu Code 39 affiné (Alphanumérique)
// Barres fines équilibrées (ratio 1.9 au lieu de 2.5) pour éviter l'effet gras
// =========================================================================

const CODE39_ENCODING = {
    '0': '000110100', '1': '100100001', '2': '001100001', '3': '101100000',
    '4': '000110001', '5': '100110000', '6': '001110000', '7': '000100101',
    '8': '100100100', '9': '001100100', 'A': '100001001', 'B': '001001001',
    'C': '101001000', 'D': '000011001', 'E': '100011000', 'F': '001011000',
    'G': '000001101', 'H': '100001100', 'I': '001001100', 'J': '000011100',
    'K': '100000011', 'L': '001000011', 'M': '101000010', 'N': '000010011',
    'O': '100010010', 'P': '001010010', 'Q': '000000111', 'R': '100000110',
    'S': '001000110', 'T': '000010110', 'U': '110000001', 'V': '011000001',
    'W': '111000000', 'X': '010010001', 'Y': '110010000', 'Z': '011010000',
    '-': '010000101', '.': '110000100', ' ': '011000100', '$': '010101000',
    '/': '010100010', '+': '010001010', '%': '000101010', '*': '010010100'
};

const renderCode39Svg = (code, options = {}) => {
    const cleanCode = String(code).trim().toUpperCase();
    const width = options.width || 180;
    const height = options.height ? Math.max(options.height, 12) : 52;
    const showText = options.showText !== false;
    const lineColor = options.lineColor || '#1e293b';

    const safeChars = cleanCode.split('').filter(char => CODE39_ENCODING[char] !== undefined);
    if (safeChars.length === 0) return '';

    const encodedChars = ['*', ...safeChars, '*'];

    const WIDE = 1.85; // Équilibré et fin, sans épaisseur disproportionnée
    const NARROW = 0.85;
    const GAP = 0.85;
    const QUIET_ZONE = 8.0;

    const charWidth = (3 * WIDE) + (6 * NARROW);
    const totalUnits = (encodedChars.length * charWidth) + ((encodedChars.length - 1) * GAP) + (QUIET_ZONE * 2);
    const barHeight = showText ? Math.max(height - 14, 8) : height;

    let rects = '';
    let currentX = QUIET_ZONE;

    for (let c = 0; c < encodedChars.length; c++) {
        const pattern = CODE39_ENCODING[encodedChars[c]];
        if (!pattern) continue;

        for (let i = 0; i < 9; i++) {
            const isBar = (i % 2 === 0);
            const isWide = (pattern[i] === '1');
            const unitWidth = isWide ? WIDE : NARROW;

            if (isBar) {
                rects += `<rect x="${currentX.toFixed(2)}" y="0" width="${unitWidth.toFixed(2)}" height="${barHeight}" fill="${lineColor}" />`;
            }
            currentX += unitWidth;
        }

        if (c < encodedChars.length - 1) {
            currentX += GAP;
        }
    }

    const textSvg = showText ? `
        <text x="${(totalUnits / 2).toFixed(2)}" y="${height - 2}" text-anchor="middle" font-family="'Inter', -apple-system, monospace" font-size="10" font-weight="600" letter-spacing="1.5" fill="${lineColor}">
            ${cleanCode}
        </text>
    ` : '';

    return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalUnits.toFixed(2)} ${height}" width="${width}" height="${height}" style="display:block;margin:0 auto;max-width:100%;">
            ${rects}
            ${textSvg}
        </svg>
    `.trim();
};

/**
 * Point d'entrée principal pour générer un code-barres SVG
 * Détecte intelligemment les codes à 13 chiffres pour utiliser le moteur haute fidélité GS1 EAN-13,
 * ou Code 39 affiné pour les codes alphanumériques.
 */
export const renderBarcodeSvg = (code, options = {}) => {
    if (!code) return '';
    const cleanCode = String(code).trim();
    if (/^\d{13}$/.test(cleanCode)) {
        return renderEan13Svg(cleanCode, options);
    }
    return renderCode39Svg(cleanCode, options);
};

/**
 * Composant React direct pour afficher un code-barres propre et élancé
 */
export const Barcode = ({ code, width = 180, height = 52, showText = true, lineColor = '#1e293b', className = '' }) => {
    const svgHtml = renderBarcodeSvg(code, { width, height, showText, lineColor });
    if (!svgHtml) return null;

    return React.createElement('div', {
        className,
        dangerouslySetInnerHTML: { __html: svgHtml }
    });
};
