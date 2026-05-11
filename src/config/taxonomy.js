import { 
    PenTool, 
    Zap, 
    Droplet, 
    Wrench, 
    PaintBucket, 
    HardHat, 
    Package 
} from 'lucide-react';

export const TAXONOMY = {
    // 1. Quincaillerie & Visserie
    "Fixations et Visserie": {
        icon: Package,
        color: "bg-stone-100 text-stone-700",
        description: "Les indispensables pour tout assemblage",
        subCategories: [
            {
                id: "visserie_base",
                name: "Vis, Clous & Boulons",
                examples: "Vis à bois, à placo, boulons d'ancrage, clous acier",
                defaults: {
                    unit: "Pièce",
                    retailMode: "lot",
                    retailStepQuantity: 10,
                    bulkUnit: "Boîte",
                    hasSubUnit: false
                }
            },
            {
                id: "fixations_lourdes",
                name: "Chevilles et Fixations",
                examples: "Chevilles nylon, Molly, chevilles chimiques",
                defaults: {
                    unit: "Pièce",
                    retailMode: "lot",
                    retailStepQuantity: 10,
                    bulkUnit: "Boîte",
                    hasSubUnit: false
                }
            }
        ]
    },

    // 2. Outillage
    "Outillage": {
        icon: Wrench,
        color: "bg-red-100 text-red-700",
        description: "De l'outil à main à l'électroportatif",
        subCategories: [
            {
                id: "outil_main",
                name: "Outillage à main",
                examples: "Marteaux, tournevis, pinces, clés, scies",
                defaults: {
                    unit: "Unité",
                    retailMode: "unit",
                    bulkUnit: "",
                    hasSubUnit: false
                }
            },
            {
                id: "outil_electro",
                name: "Outillage électroportatif",
                examples: "Perceuses, meuleuses, scies circulaires",
                defaults: {
                    unit: "Unité",
                    retailMode: "unit",
                    bulkUnit: "",
                    hasSubUnit: false
                }
            },
            {
                id: "outil_accessoire",
                name: "Accessoires, forets & lames",
                examples: "Lames de scie, mèches, disques abrasifs",
                defaults: {
                    unit: "Pièce",
                    retailMode: "unit",
                    bulkUnit: "Boîte",
                    hasSubUnit: false
                }
            },
            {
                id: "outil_mesure",
                name: "Mesure et Précision",
                examples: "Niveaux, mètres laser, détecteurs",
                defaults: {
                    unit: "Unité",
                    retailMode: "unit",
                    bulkUnit: "",
                    hasSubUnit: false
                }
            }
        ]
    },

    // 3. Batiment & Menuiserie
    "Bâtiment & Menuiserie": {
        icon: PenTool,
        color: "bg-amber-100 text-amber-700",
        description: "Portes, fenêtres, meubles et maconnerie",
        subCategories: [
            {
                id: "bat_gros_oeuvre",
                name: "Gros œuvre & Maçonnerie",
                examples: "Ciment, plâtre, sable, gravier",
                defaults: {
                    unit: "Sac de ciment",
                    retailMode: "detail",
                    subUnitName: "Kg",
                    subUnitConversion: 50,
                    bulkUnit: "Tonne",
                    hasSubUnit: true
                }
            },
            {
                id: "bat_charnieres",
                name: "Charnières et Ferrures",
                examples: "Charnières, glissières, pentures",
                defaults: {
                    unit: "Pièce",
                    retailMode: "unit",
                    bulkUnit: "Boîte",
                    hasSubUnit: false
                }
            },
            {
                id: "bat_serrurerie",
                name: "Serrurerie & Sécurité",
                examples: "Serrures, cylindres, verrous, poignées",
                defaults: {
                    unit: "Pièce",
                    retailMode: "unit",
                    bulkUnit: "",
                    hasSubUnit: false
                }
            }
        ]
    },

    // 4. Electricite
    "Électricité et Domotique": {
        icon: Zap,
        color: "bg-yellow-100 text-yellow-700",
        description: "Tableaux, câbles, éclairage et domotique",
        subCategories: [
            {
                id: "elec_tableau",
                name: "Tableau et modules",
                examples: "Disjoncteurs, interrupteurs différentiels",
                defaults: {
                    unit: "Pièce",
                    retailMode: "unit",
                    bulkUnit: "Carton",
                    hasSubUnit: false
                }
            },
            {
                id: "elec_cablage",
                name: "Conduits et câblage",
                examples: "Fils, câbles, gaines ICTA, moulures",
                defaults: {
                    unit: "Bobine",
                    retailMode: "detail",
                    subUnitName: "Mètre",
                    subUnitConversion: 100, // Souvent 100m pour une couronne de gaine/cable
                    bulkUnit: "",
                    hasSubUnit: true
                }
            },
            {
                id: "elec_appareillage",
                name: "Appareillage électrique",
                examples: "Interrupteurs, prises de courant",
                defaults: {
                    unit: "Pièce",
                    retailMode: "unit",
                    bulkUnit: "Boîte",
                    hasSubUnit: false
                }
            },
            {
                id: "elec_eclairage",
                name: "Éclairage & Luminaires",
                examples: "Ampoules LED, spots, appliques",
                defaults: {
                    unit: "Pièce",
                    retailMode: "unit",
                    bulkUnit: "Carton",
                    hasSubUnit: false
                }
            }
        ]
    },

    // 5. Plomberie
    "Plomberie et Sanitaire": {
        icon: Droplet,
        color: "bg-blue-100 text-blue-700",
        description: "Arrivée d'eau, évacuations et salles de bain",
        subCategories: [
            {
                id: "plomb_tubes",
                name: "Tubes et Tuyaux",
                examples: "Cuivre, PER, Multicouche, PVC",
                defaults: {
                    unit: "Barre",
                    retailMode: "detail",
                    subUnitName: "Mètre",
                    subUnitConversion: 4, // Ex: Barre de 4m
                    bulkUnit: "Paquet",
                    hasSubUnit: true
                }
            },
            {
                id: "plomb_raccords",
                name: "Raccords & Siphons",
                examples: "Coudes, tés, manchons, bondes",
                defaults: {
                    unit: "Pièce",
                    retailMode: "unit",
                    bulkUnit: "Sachet",
                    hasSubUnit: false
                }
            },
            {
                id: "plomb_robinetterie",
                name: "Robinetterie et Sanitaire",
                examples: "Mitigeurs, vannes d'arrêt, chasse d'eau",
                defaults: {
                    unit: "Pièce",
                    retailMode: "unit",
                    bulkUnit: "",
                    hasSubUnit: false
                }
            }
        ]
    },

    // 6. Droguerie
    "Droguerie et Décoration": {
        icon: PaintBucket,
        color: "bg-purple-100 text-purple-700",
        description: "Peintures, colles, mastics et nettoyants",
        subCategories: [
            {
                id: "drog_peinture",
                name: "Peintures, Lasures, Vernis",
                examples: "Peinture murale, lasure bois, pinceaux",
                defaults: {
                    unit: "Pot",
                    retailMode: "detail",
                    subUnitName: "Litre",
                    subUnitConversion: 27, // Par ex pot 27L
                    bulkUnit: "",
                    hasSubUnit: true
                }
            },
            {
                id: "drog_mastics",
                name: "Mastics, Colles et Adhésifs",
                examples: "Silicone, colle bois, scotch, mousse expansive",
                defaults: {
                    unit: "Cartouche", // ex: cartouche silicone
                    retailMode: "unit",
                    bulkUnit: "Carton",
                    hasSubUnit: false
                }
            },
            {
                id: "drog_nettoyants",
                name: "Solvants et Nettoyants",
                examples: "White spirit, diluant, décapants",
                defaults: {
                    unit: "Bidon",
                    retailMode: "detail",
                    subUnitName: "Litre",
                    subUnitConversion: 5,
                    bulkUnit: "Carton",
                    hasSubUnit: true
                }
            }
        ]
    },

    // 7. EPI
    "EPI et Jardinage": {
        icon: HardHat,
        color: "bg-green-100 text-green-700",
        description: "Matériel de sécurité et outils d'extérieur",
        subCategories: [
            {
                id: "epi_securite",
                name: "Vêtements et Sécurité (EPI)",
                examples: "Casques, gants, lunettes, chaussures",
                defaults: {
                    unit: "Pièce", // Ou "Paire"
                    retailMode: "unit",
                    bulkUnit: "",
                    hasSubUnit: false
                }
            },
            {
                id: "jardin_outils",
                name: "Matériel de Jardinage",
                examples: "Pelles, râteaux, tuyaux d'arrosage, engrais",
                defaults: {
                    unit: "Unité",
                    retailMode: "unit",
                    bulkUnit: "",
                    hasSubUnit: false
                }
            }
        ]
    }
};
