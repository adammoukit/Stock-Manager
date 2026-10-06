import * as XLSX from 'xlsx';

/**
 * Exporte des données au format Excel natif (.xlsx)
 * avec calcul automatique des largeurs de colonnes.
 * 
 * @param {Array<Object>} data - Tableau d'objets représentant les lignes
 * @param {string} filename - Nom du fichier sans ou avec extension
 * @param {string} [sheetName='Données'] - Nom de l'onglet Excel (max 31 caractères)
 */
export const exportToExcel = (data, filename = 'export', sheetName = 'Données') => {
    if (!data || !Array.isArray(data) || data.length === 0) {
        return false;
    }

    try {
        // 1. Création de la feuille à partir du tableau d'objets
        const worksheet = XLSX.utils.json_to_sheet(data);

        // 2. Calcul automatique des largeurs de colonnes (wch)
        const keys = Object.keys(data[0] || {});
        const colWidths = keys.map(key => {
            let maxLen = String(key || '').length;
            for (let i = 0; i < data.length; i++) {
                const val = data[i][key];
                if (val !== undefined && val !== null) {
                    const len = String(val).length;
                    if (len > maxLen) maxLen = len;
                }
            }
            return { wch: Math.min(Math.max(maxLen + 4, 12), 60) };
        });

        worksheet['!cols'] = colWidths;

        // 3. Création du classeur et ajout de la feuille
        const workbook = XLSX.utils.book_new();
        const safeSheetName = (sheetName || 'Données').substring(0, 31);
        XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName);

        // 4. Génération et déclenchement du téléchargement .xlsx
        const finalFilename = filename.toLowerCase().endsWith('.xlsx')
            ? filename
            : `${filename.replace(/\.csv$/i, '')}.xlsx`;

        XLSX.writeFile(workbook, finalFilename);
        return true;
    } catch (error) {
        console.error('Erreur lors de la génération du fichier Excel:', error);
        return false;
    }
};

export default exportToExcel;
