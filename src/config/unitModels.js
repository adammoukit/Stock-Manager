export const UNIT_MODELS = [
    {
        id: 'BAG_WEIGHT',
        name: 'Sac / Botte (Poids)',
        baseUnits: ['Sac de ciment', 'Sac', 'Botte'], 
        subUnit: 'Kilo',
        archetype: 'BULK', // Requires subUnit computation
        containerLabel: 'Nombre de Sac(s) / Botte(s)',
        contentLabel: 'Poids net unitaire (Kg)',
        description: 'Produit conditionné au poids (ciment, plâtre, colle carreau, chaux)'
    },
    {
        id: 'LIQUID_VOLUME',
        name: 'Contenant Liquide/Pâte (Volume/Poids)',
        baseUnits: ['Pot', 'Seau', 'Bidon', 'Fût', 'Cartouche', 'Bouteille'],
        subUnit: 'Litre', 
        archetype: 'BULK',
        containerLabel: 'Nombre de contenant(s)',
        contentLabel: 'Contenance unitaire (L, ml ou Kg)',
        description: 'Produit liquide ou pâteux conditionné (peinture, diluant, huile, silicone)'
    },
    {
        id: 'BOX_PIECES',
        name: 'Boîte/Carton/Sachet (Pièces)',
        baseUnits: ['Boîte', 'Carton', 'Packet', 'Paquet', 'Sachet'],
        subUnit: 'Pièce', 
        archetype: 'BOX',
        containerLabel: 'Nombre de Boîtes/Cartons/Sachets',
        contentLabel: 'Pièces par contenant',
        description: 'Produit contenant de multiples pièces individuelles (vis, clous, chevilles)'
    },
    {
        id: 'LINEAR_LENGTH',
        name: 'Linéaire (Rouleau/Barre/Tuyau/Fer)',
        baseUnits: ['Bobine', 'Barre', 'Couronne', 'Rouleau', 'Tuyau', 'Fer'],
        subUnit: 'Mètre', 
        archetype: 'BULK',
        containerLabel: 'Nombre d\'unité(s)',
        contentLabel: 'Longueur unitaire (mètre)',
        description: 'Produit filaire, tubulaire ou linéaire (câble électrique, fer à béton, tuyau PVC)'
    },
    {
        id: 'SIMPLE_UNIT',
        name: 'Unité Simple',
        baseUnits: ['Kg', 'Litre', 'Mètre', 'Pièce', 'Gramme', 'Tonne', 'Unité', 'Centimètre', 'Millimètre'],
        subUnit: null, // No internal subunit
        archetype: 'UNIT',
        containerLabel: 'Quantité Totale',
        contentLabel: null,
        description: 'Produit vendu directement à l\'unité finale (outils, brouette, pelle)'
    }
];

export const BULK_MEASUREMENT_UNITS = {
    'Sac de ciment': ['Kilo', 'Gramme', 'Tonne'],
    'Sac': ['Kilo', 'Gramme', 'Tonne'],
    'Botte': ['Kilo', 'Mètre', 'Pièce'],
    'Seau': ['Litre', 'Kilo', 'Millilitre'],
    'Bidon': ['Litre', 'Millilitre', 'Centilitre'],
    'Cartouche': ['Millilitre', 'Gramme', 'Litre'],
    'Bouteille': ['Litre', 'Centilitre', 'Millilitre'],
    'Barre': ['Mètre', 'Centimètre', 'Millimètre'],
    'Fer': ['Mètre', 'Centimètre', 'Millimètre'],
    'Rouleau': ['Mètre', 'Centimètre', 'Millimètre'],
    'Bobine': ['Mètre', 'Centimètre', 'Millimètre'],
    'Couronne': ['Mètre', 'Centimètre', 'Millimètre'],
    'Tuyau': ['Mètre', 'Centimètre', 'Millimètre'],
    'Fût': ['Litre', 'Kilo'],
    'Pot': ['Litre', 'Kilo', 'Millilitre']
};

export const getAvailableMeasurementUnits = (baseUnit) => {
    if (!baseUnit) return ['Kilo', 'Litre', 'Mètre', 'Gramme', 'Millilitre', 'Centimètre'];
    const unitLower = baseUnit.trim().toLowerCase();
    const found = Object.entries(BULK_MEASUREMENT_UNITS).find(([key]) => 
        unitLower === key.toLowerCase() || unitLower.includes(key.toLowerCase()) || key.toLowerCase().includes(unitLower)
    );
    return found ? found[1] : ['Kilo', 'Litre', 'Mètre', 'Gramme', 'Millilitre', 'Centimètre'];
};

/**
 * Returns the corresponding unit model based on the given unit name.
 * Falls back to "SIMPLE_UNIT" or creates a dynamic BULK model if forcedArchetype is 'BULK'.
 * Accepts an optional customSubUnit (e.g. user selected bulkUnit) to override the default.
 */
export const getUnitModel = (unitName, customSubUnit = null, forcedArchetype = null) => {
    if (!unitName) {
        const m = UNIT_MODELS.find(m => m.id === 'SIMPLE_UNIT');
        return customSubUnit ? { ...m, subUnit: customSubUnit } : m;
    }
    
    // Convert to lowercase to ensure case-insensitive matching
    const unitLower = unitName.toLowerCase().trim();
    
    // Find the first model that has a matching baseUnit
    const matchedModel = UNIT_MODELS.find(model => 
        model.baseUnits.some(bu => bu.toLowerCase() === unitLower)
    );

    let result = matchedModel;
    if (!result) {
        const fuzzyMatched = UNIT_MODELS.find(model => 
            model.baseUnits.some(bu => unitLower.includes(bu.toLowerCase()) || bu.toLowerCase().includes(unitLower))
        );
        result = fuzzyMatched;
    }

    // Si on a explicitement forcé l'archétype BULK et que le modèle trouvé est UNIT ou inexistant
    if (forcedArchetype === 'BULK' && (!result || result.archetype === 'UNIT')) {
        result = {
            id: 'CUSTOM_BULK',
            name: `${unitName} (Vrac)`,
            baseUnits: [unitName],
            subUnit: customSubUnit || 'Kilo',
            archetype: 'BULK',
            containerLabel: `Nombre de ${unitName}(s)`,
            contentLabel: `Contenance par ${unitName}`,
            description: `Produit en vrac conditionné en ${unitName}`
        };
    }

    if (!result) {
        result = UNIT_MODELS.find(m => m.id === 'SIMPLE_UNIT');
    }

    if (customSubUnit) {
        return { ...result, subUnit: customSubUnit };
    }
    return result;
};

/**
 * Calcule avec une précision millimétrique la décomposition du stock d'un produit conteneur (Vrac / Boîte).
 * Élimine tous les artefacts et dérives de virgule flottante JavaScript (IEEE 754).
 * Gère les entiers, les décimales réelles et les nombres négatifs.
 */
export const computeContainerStock = (stockQty, conversionFactor) => {
    const rawQty = parseFloat(stockQty);
    if (isNaN(rawQty) || rawQty === 0) {
        return {
            wholeUnits: 0,
            subUnitsCount: 0,
            hasFraction: false,
            exactTotalSubUnits: 0,
            isNegative: false
        };
    }

    const isNegative = rawQty < 0;
    const absQty = Math.abs(rawQty);
    const cf = parseFloat(conversionFactor) || 1;

    if (cf <= 1) {
        const rounded = Math.round(absQty * 1000) / 1000;
        return {
            wholeUnits: isNegative ? -rounded : rounded,
            subUnitsCount: 0,
            hasFraction: false,
            exactTotalSubUnits: isNegative ? -rounded : rounded,
            isNegative
        };
    }

    // Total sub-units calculé à 6 décimales pour éliminer les dérives float
    const exactTotalSubUnits = Math.round(absQty * cf * 1000000) / 1000000;

    let wholeUnits = Math.floor(exactTotalSubUnits / cf);
    // Reste de sous-unités dans le conteneur entamé
    let remainingSubUnits = exactTotalSubUnits - (wholeUnits * cf);

    // Arrondi millimétrique (max 3 décimales pour les fractions de sous-unité ex: 2.5 m ou 0.75 L)
    remainingSubUnits = Math.round(remainingSubUnits * 1000) / 1000;

    // Report si le reste atteint la contenance complète par arrondi
    if (remainingSubUnits >= cf - 0.0001) {
        wholeUnits += 1;
        remainingSubUnits = 0;
    }

    // Seuil de détection de fraction réelle (évite les résidus 0.000001)
    const hasFraction = remainingSubUnits > 0.0001;

    return {
        wholeUnits: isNegative ? -wholeUnits : wholeUnits,
        subUnitsCount: remainingSubUnits,
        hasFraction,
        exactTotalSubUnits: isNegative ? -exactTotalSubUnits : exactTotalSubUnits,
        isNegative
    };
};

/**
 * Formate le stock de manière lisible, professionnelle et ultra-précise.
 * Ex: "5 Sacs" ou "4 Sacs + 25 Kilos" ou "12,5 Mètres" ou "0 Kilo"
 */
export const formatContainerStock = (stockQty, conversionFactor, baseUnit = 'Unité', subUnit = null) => {
    const rawQty = parseFloat(stockQty);
    if (isNaN(rawQty) || rawQty === 0) {
        return `0 ${baseUnit}`;
    }

    const cf = parseFloat(conversionFactor) || 1;
    if (cf <= 1) {
        const clean = Number((Math.round(rawQty * 1000) / 1000).toFixed(2)).toLocaleString('fr-FR');
        return `${clean} ${baseUnit}`;
    }

    const { wholeUnits, subUnitsCount, hasFraction, isNegative } = computeContainerStock(rawQty, cf);
    const subLabel = subUnit || 'unités';

    if (!hasFraction) {
        const sSuffix = Math.abs(wholeUnits) > 1 && !baseUnit.endsWith('s') && !baseUnit.endsWith('x') ? 's' : '';
        return `${wholeUnits.toLocaleString('fr-FR')} ${baseUnit}${sSuffix}`;
    }

    // S'il reste une fraction
    const cleanSub = Number(subUnitsCount.toFixed(2)).toLocaleString('fr-FR');
    if (Math.abs(wholeUnits) === 0) {
        return `${isNegative ? '-' : ''}${cleanSub} ${subLabel}`;
    }

    return `${wholeUnits.toLocaleString('fr-FR')} ${baseUnit} + ${cleanSub} ${subLabel}`;
};
