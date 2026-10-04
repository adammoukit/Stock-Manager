import { getUnitModel, computeContainerStock, formatContainerStock } from '../config/unitModels';

/**
 * Détermine avec certitude l'archétype de conditionnement d'un produit :
 * - 'BOX'  : Boîte, Carton, Paquet, Sachet (contenant des pièces/sous-unités discrètes)
 * - 'BULK' : Vrac, Sacs au poids (Kg), Contenants liquides (Litre), Linéaire (Mètre)
 * - 'UNIT' : Unité simple (outillage, pelle, brouette...)
 */
export const getProductArchetype = (product) => {
    if (!product) return 'UNIT';

    if (product.unitArchetype === 'BOX' || product.unitArchetype === 'BULK' || product.unitArchetype === 'UNIT') {
        return product.unitArchetype;
    }

    const unitLower = (product.unit || '').toLowerCase().trim();
    const bulkUnitLower = (product.bulkUnit || '').toLowerCase().trim();

    // Vérification via getUnitModel
    const model = getUnitModel(product.unit, product.bulkUnit);
    if (model && model.archetype && model.archetype !== 'UNIT') {
        return model.archetype;
    }

    // Détection par mots-clés Boîtes / Cartons
    if (
        unitLower.includes('carton') ||
        unitLower.includes('boîte') ||
        unitLower.includes('boite') ||
        unitLower.includes('paquet') ||
        unitLower.includes('packet') ||
        unitLower.includes('sachet') ||
        unitLower.includes('colis') ||
        product.hasPiece ||
        (Array.isArray(product.packagings) && product.packagings.length > 0)
    ) {
        return 'BOX';
    }

    // Détection par mots-clés Vrac / Poids / Volume / Linéaire
    if (
        unitLower.includes('sac') ||
        unitLower.includes('rouleau') ||
        unitLower.includes('barre') ||
        unitLower.includes('tuyau') ||
        unitLower.includes('fer') ||
        unitLower.includes('bobine') ||
        unitLower.includes('bidon') ||
        unitLower.includes('seau') ||
        unitLower.includes('fût') ||
        unitLower.includes('fut') ||
        unitLower.includes('kg') ||
        unitLower.includes('kilo') ||
        unitLower.includes('litre') ||
        unitLower.includes('mètre') ||
        unitLower.includes('metre') ||
        bulkUnitLower.length > 0
    ) {
        return 'BULK';
    }

    return 'UNIT';
};

/**
 * Moteur de calcul du Réapprovisionnement Super-Intelligent Kabllix
 * Prend en compte la configuration exacte :
 * 1. Unique (pièce simple)
 * 2. Boîte / Carton / Paquet (arrondi au carton supérieur pour respecter le conditionnement fournisseur)
 * 3. Vrac (Sacs pleins, Rouleaux entiers, Bidons sans fractionnement d'achat)
 */
export const calculateSmartReplenishment = (product, customContainers = null, customPrice = null) => {
    if (!product) return null;

    const archetype = getProductArchetype(product);
    const stock = Math.max(0, parseFloat(product.stock) || 0);
    const minStock = Math.max(0, parseFloat(product.minStock) || 0);

    // Facteur de conversion (nombre de sous-unités par contenant)
    let factor = parseFloat(product.conversionFactor) || 1;
    if (factor <= 0) factor = 1;

    // Détermination du stock cible optimal (Target Stock)
    // Sécurise au moins le double du seuil min, ou au minimum 5 unités
    const targetStock = minStock > 0 ? Math.max(minStock * 2, minStock + 2) : 5;
    const deficitContainers = Math.max(0, targetStock - stock);

    // Recommandation en contenants pleins
    let recommendedContainers = 0;
    if (customContainers !== null && customContainers !== undefined && !isNaN(customContainers)) {
        recommendedContainers = Math.max(1, parseInt(customContainers, 10));
    } else {
        recommendedContainers = Math.max(1, Math.ceil(deficitContainers));
    }

    let containerLabel = product.unit || 'Unité';
    let subUnitLabel = null;
    let totalSubUnits = recommendedContainers;
    let packagingDescription = '';

    if (archetype === 'BOX') {
        containerLabel = product.unit || 'Carton';
        subUnitLabel = 'Pièce';
        totalSubUnits = recommendedContainers * factor;
        packagingDescription = factor > 1 ? `${factor} pièces / ${containerLabel}` : `Vendu par ${containerLabel}`;
    } else if (archetype === 'BULK') {
        containerLabel = product.unit || 'Sac';
        subUnitLabel = product.bulkUnit || (containerLabel.toLowerCase().includes('sac') ? 'Kg' : containerLabel.toLowerCase().includes('rouleau') ? 'Mètre' : 'Litre');
        totalSubUnits = recommendedContainers * factor;
        packagingDescription = factor > 1 ? `${factor} ${subUnitLabel} / ${containerLabel}` : `Vendu au ${subUnitLabel}`;
    } else {
        containerLabel = product.unit || 'Unité';
        subUnitLabel = null;
        totalSubUnits = recommendedContainers;
        packagingDescription = 'Unité simple';
    }

    // Prix d'achat unitaire par contenant : prix catalogue par défaut ou prix fournisseur négocié/modifié
    const originalPurchasePrice = parseFloat(product.purchasePrice) || 0;
    let purchasePricePerContainer = originalPurchasePrice;
    if (customPrice !== null && customPrice !== undefined && !isNaN(customPrice)) {
        purchasePricePerContainer = Math.max(0, parseFloat(customPrice));
    }
    const isPriceModified = Math.abs(purchasePricePerContainer - originalPurchasePrice) > 0.001;
    const estimatedTotalCost = recommendedContainers * purchasePricePerContainer;

    // Détermination de l'urgence
    let urgency = 'NORMAL'; // 'CRITICAL' (rupture) | 'HIGH' (sous seuil) | 'NORMAL' (préventif ou manuel)
    if (stock <= 0) {
        urgency = 'CRITICAL';
    } else if (stock <= minStock) {
        urgency = 'HIGH';
    }

    return {
        productId: product.id,
        name: product.name || 'Produit sans nom',
        barcode: product.barcode || '',
        category: product.category || 'Général',
        supplier: product.supplier || 'Fournisseur à désigner',
        archetype, // 'UNIT' | 'BOX' | 'BULK'
        currentStock: stock,
        minStock,
        targetStock,
        factor,
        recommendedContainers,
        totalSubUnits,
        containerLabel,
        subUnitLabel,
        packagingDescription,
        purchasePricePerContainer,
        originalPurchasePrice,
        isPriceModified,
        estimatedTotalCost,
        urgency,
        formattedStock: formatContainerStock(stock, factor, containerLabel, subUnitLabel)
    };
};
