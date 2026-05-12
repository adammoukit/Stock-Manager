import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const API_URL = 'http://localhost:8080/api/auth';

    // Fonction de logout réutilisable (définie avant le useEffect)
    const logout = useCallback((showToast = true) => {
        setToken(null);
        setUser(null);
        setIsAuthenticated(false);
        localStorage.removeItem('kabllix_token');
        localStorage.removeItem('kabllix_user');
        sessionStorage.removeItem('kabllix_token');
        sessionStorage.removeItem('kabllix_user');
        
        if (showToast) {
            toast.success("Votre session a expiré. Redirection...");
        }

        // Force le rechargement pour vider tous les contextes et rediriger vers /login
        setTimeout(() => {
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }, 1000);
    }, []);

    useEffect(() => {
        const initAuth = async () => {
            const storedToken = localStorage.getItem('kabllix_token') || sessionStorage.getItem('kabllix_token');
            const storedUser = localStorage.getItem('kabllix_user') || sessionStorage.getItem('kabllix_user');

            if (!storedToken || !storedUser) {
                setIsLoading(false);
                return;
            }

            try {
                // Validation simple du token (doit être un string non vide et avoir un format JWT de base)
                // Un JWT a 3 parties séparées par des points.
                const isJwtFormat = storedToken.split('.').length === 3;
                
                if (!isJwtFormat || storedToken.length < 10) {
                    console.error("AuthContext: Token corrompu ou illégal détecté.");
                    logout(false);
                    return;
                }

                // On restaure d'abord la session en mémoire
                setToken(storedToken);
                setUser(JSON.parse(storedUser));
                setIsAuthenticated(true);
            } catch (e) {
                console.error("AuthContext: Erreur lors de la restauration de la session:", e);
                logout(false);
            } finally {
                setIsLoading(false);
            }
        };

        initAuth();
    }, []);

    // Écoute l'événement émis par apiClient quand le backend retourne 401
    // (token expiré côté serveur) — déclenche un logout propre
    useEffect(() => {
        const handleUnauthorized = () => {
            if (window.location.pathname !== '/login') {
                console.warn("AuthContext: événement 'auth:unauthorized' reçu → déconnexion.");
                toast.error("Votre session a expiré. Veuillez vous reconnecter.");
                logout(false); // false = ne pas afficher le toast "déconnecté" en double
            }
        };

        window.addEventListener('auth:unauthorized', handleUnauthorized);
        return () => {
            window.removeEventListener('auth:unauthorized', handleUnauthorized);
        };
    }, [logout]);

    const login = async (email, password) => {
        try {
            const response = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            if (!response.ok) {
                await response.json().catch(() => ({}));
                throw new Error("Identifiants incorrects ou compte désactivé");
            }

            const data = await response.json();
            
            const userData = {
                firstName: data.firstName,
                lastName: data.lastName,
                role: data.role,
                email: email
            };
            
            setToken(data.token);
            setUser(userData);
            setIsAuthenticated(true);

            // Sauvegarde persistante — validité gérée par le Backend (6h)
            localStorage.setItem('kabllix_token', data.token);
            localStorage.setItem('kabllix_user', JSON.stringify(userData));
            
            toast.success(`Bienvenue ${data.firstName} !`);
            return true;
        } catch (error) {
            console.error("Erreur de connexion:", error);
            toast.error(error.message || "Erreur lors de la connexion");
            return false;
        }
    };

    return (
        <AuthContext.Provider value={{ user, token, isAuthenticated, isLoading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
