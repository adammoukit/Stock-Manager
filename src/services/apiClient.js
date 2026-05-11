/**
 * apiClient.js — Service centralisé pour les appels API sécurisés
 * 
 * Ce module utilise Axios et injecte automatiquement le token JWT dans chaque requête.
 * Le contexte fictif (InventoryContext) reste intact.
 * Ce service est utilisé EN PARALLÈLE pour tester le vrai backend.
 */

import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

// Création de l'instance axios
const apiClient = axios.create({
    baseURL: BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Intercepteur pour ajouter le token JWT à chaque requête
apiClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('kabllix_token');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
            console.log("Envoi de la requête à", config.url, "avec le token :", token.substring(0, 15) + "...");
        } else {
            console.warn("ATTENTION: Aucun token trouvé dans le localStorage pour la requête :", config.url);
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Intercepteur pour gérer les réponses et les erreurs globales
apiClient.interceptors.response.use(
    (response) => {
        return response.data;
    },
    (error) => {
        if (error.response) {
            console.error("API Error Response:", error.response.status, error.response.data);

            // Si le token est expiré ou invalide, on notifie l'AuthContext
            // via un événement personnalisé — on ne supprime JAMAIS le token ici directement.
            // C'est l'AuthContext qui gère le logout proprement.
            if (error.response.status === 401) {
                console.warn("401 détecté : token expiré ou invalide. Notification de l'AuthContext.");
                window.dispatchEvent(new CustomEvent('auth:unauthorized'));
            }

            const err = new Error(
                error.response.data?.message || `Erreur HTTP ${error.response.status}`
            );
            err.response = error.response;
            throw err;
        } else if (error.request) {
            // Erreur de réseau ou serveur injoignable — on ne touche PAS au token
            console.error("Serveur injoignable ou erreur réseau.");
            throw new Error('Impossible de contacter le serveur. Vérifiez votre connexion.');
        } else {
            throw error;
        }
    }
);

// ─────────────────────────────────────────────────────────────
// API PRODUITS — /api/products
// ─────────────────────────────────────────────────────────────
export const productApi = {
    /** Récupère tous les produits de la base de données */
    getAll: () => apiClient.get('/products'),

    /** Récupère un seul produit par son ID */
    getById: (id) => apiClient.get(`/products/${id}`),

    /** Crée un nouveau produit */
    create: (data) => apiClient.post('/products', data),

    /** Modifie un produit existant */
    update: (id, data) => apiClient.put(`/products/${id}`, data),

    /** Supprime un produit par son ID */
    delete: (id) => apiClient.delete(`/products/${id}`),
};

// ─────────────────────────────────────────────────────────────
// API BOUTIQUES — /api/stores (à implémenter côté Java)
// ─────────────────────────────────────────────────────────────
export const storeApi = {
    getAll: () => apiClient.get('/stores'),
};

// ─────────────────────────────────────────────────────────────
// API UTILISATEURS — /api/users (à implémenter côté Java)
// ─────────────────────────────────────────────────────────────
export const userApi = {
    getAll: () => apiClient.get('/users'),
    create: (data) => apiClient.post('/users', data),
};

// ─────────────────────────────────────────────────────────────
// API VENTES — /api/sales
// ─────────────────────────────────────────────────────────────
export const salesApi = {
    create: (data) => apiClient.post('/sales', data),
    getByStore: (storeId) => apiClient.get(`/sales/store/${storeId}`),
};

export default { productApi, storeApi, userApi, salesApi, apiClient };
