export const UNIT_MODELS = [
    {
        id: 'BAG_WEIGHT',
        name: 'Sac de ciment (Poids)',
        baseUnits: ['Sac de ciment'], 
        subUnit: 'Kilo',
        archetype: 'BULK', // Requires subUnit computation
        containerLabel: 'Nombre de Sac(s) de ciment',
        contentLabel: 'Poids par Sac de ciment (Kg)',
        description: 'Produit conditionné en sac (ciment, riz, enduit)'
    },
    {
        id: 'LIQUID_VOLUME',
        name: 'Contenant Liquide/Pâte (Volume/Poids)',
        baseUnits: ['Pot', 'Seau', 'Bidon', 'Fût', 'Cartouche'],
        subUnit: 'L/Kg', 
        archetype: 'BULK',
        containerLabel: 'Nombre de contenant(s)',
        contentLabel: 'Contenance unitaire (L ou Kg)',
        description: 'Produit liquide ou pâteux conditionné (peinture, diluant)'
    },
    {
        id: 'BOX_PIECES',
        name: 'Boîte/Carton (Pièces)',
        baseUnits: ['Boîte', 'Carton', 'Packet', 'Sachet'],
        subUnit: 'Pièce', 
        archetype: 'BOX',
        containerLabel: 'Nombre de Boîtes/Cartons',
        contentLabel: 'Pièces par contenant',
        description: 'Produit contenant de multiples pièces individuelles (vis, clous)'
    },
    {
        id: 'LINEAR_LENGTH',
        name: 'Linéaire (Rouleau/Barre)',
        baseUnits: ['Bobine', 'Barre', 'Couronne', 'Rouleau', 'Tuyau'],
        subUnit: 'Mètre', 
        archetype: 'BULK',
        containerLabel: 'Nombre d\'unité(s)',
        contentLabel: 'Longueur par unité (m)',
        description: 'Produit filaire ou linéaire (câble, fer)'
    },
    {
        id: 'SIMPLE_UNIT',
        name: 'Unité Simple',
        baseUnits: ['Kg', 'Litre', 'Mètre', 'Pièce', 'Gramme', 'Tonne', 'Unité'],
        subUnit: null, // No internal subunit
        archetype: 'UNIT',
        containerLabel: 'Quantité Totale',
        contentLabel: null,
        description: 'Produit vendu directement à l\'unité de base finale'
    }
];

/**
 * Returns the corresponding unit model based on the given unit name.
 * Falls back to "SIMPLE_UNIT" if not found or empty.
 */
export const getUnitModel = (unitName) => {
    if (!unitName) {
        return UNIT_MODELS.find(m => m.id === 'SIMPLE_UNIT');
    }
    
    // Convert to lowercase to ensure case-insensitive matching
    const unitLower = unitName.toLowerCase();
    
    // Find the first model that has a matching baseUnit
    const matchedModel = UNIT_MODELS.find(model => 
        model.baseUnits.some(bu => bu.toLowerCase() === unitLower)
    );

    // Some fuzzy matching just in case (e.g. if someone types "sacs" instead of "sac")
    if (!matchedModel) {
        const fuzzyMatched = UNIT_MODELS.find(model => 
            model.baseUnits.some(bu => unitLower.includes(bu.toLowerCase()))
        );
        return fuzzyMatched || UNIT_MODELS.find(m => m.id === 'SIMPLE_UNIT');
    }

    return matchedModel;
};
