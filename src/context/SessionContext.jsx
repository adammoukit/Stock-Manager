import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import { useSettings } from './SettingsContext';
import { useAuth } from './AuthContext';

const SessionContext = createContext();

export const useSession = () => useContext(SessionContext);

export const SessionProvider = ({ children }) => {
    const { currentStoreId } = useSettings();
    const { user } = useAuth();

    // ── Clé d'isolation Multi-Tenant / Multi-Boutiques ──
    const storeKey = currentStoreId ? String(currentStoreId) : 'store_default';
    const userId = user?.email || user?.id || user?.username || 'anonymous';

    const MASTER_AUDIT_KEY = `kabllix_master_audit_sessions_${storeKey}`;
    const SESSION_KEY = `kabllix_active_session_${storeKey}_${userId}`;
    const PAST_KEY = `kabllix_past_sessions_${storeKey}_${userId}`;

    // Référence combinée pour détecter tout basculement de boutique OU d'utilisateur
    const prevScopeRef = useRef(`${storeKey}_${userId}`);

    // Helper pour charger la session active isolée
    const loadActiveSession = () => {
        // Clé isolée par boutique & utilisateur
        const saved = localStorage.getItem(`kabllix_active_session_${storeKey}_${userId}`);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Isolation stricte : la session DOIT posséder un storeId identique au store courant
                if (parsed && parsed.storeId && String(parsed.storeId) === storeKey) {
                    return parsed;
                }
            } catch (e) {
                console.error("Erreur lecture session active:", e);
            }
        }
        return null;
    };

    // Helper pour charger l'historique des sessions isolées
    const loadPastSessions = () => {
        const saved = localStorage.getItem(`kabllix_past_sessions_${storeKey}_${userId}`);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    return parsed.filter(s => s.storeId && String(s.storeId) === storeKey);
                }
            } catch (e) {
                console.error("Erreur lecture past_sessions:", e);
            }
        }
        return [];
    };

    // Helper pour charger le Grand Livre Maître d'Audit (regroupe les caissiers DE CETTE BOUTIQUE uniquement)
    const loadMasterSessions = () => {
        const saved = localStorage.getItem(`kabllix_master_audit_sessions_${storeKey}`);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    return parsed.filter(s => s.storeId && String(s.storeId) === storeKey);
                }
            } catch (e) {
                console.error("Erreur lecture master_audit_sessions:", e);
            }
        }
        return [];
    };

    const [activeSession, setActiveSession] = useState(loadActiveSession);
    const [pastSessions, setPastSessions] = useState(loadPastSessions);
    const [masterSessions, setMasterSessions] = useState(loadMasterSessions);

    // ── Basculement réactif strict lors du changement de boutique ou d'utilisateur ──
    useEffect(() => {
        const currentScope = `${storeKey}_${userId}`;
        if (prevScopeRef.current !== currentScope) {
            prevScopeRef.current = currentScope;

            // Rechargement immédiat et cloisonné
            const newActive = loadActiveSession();
            const newPast = loadPastSessions();
            const newMaster = loadMasterSessions();

            setActiveSession(newActive);
            setPastSessions(newPast);
            setMasterSessions(newMaster);
        }
    }, [storeKey, userId]);

    // Persister la session active dans son espace cloisonné
    useEffect(() => {
        if (activeSession && activeSession.storeId && String(activeSession.storeId) === storeKey) {
            localStorage.setItem(SESSION_KEY, JSON.stringify(activeSession));
        } else {
            localStorage.removeItem(SESSION_KEY);
        }
    }, [activeSession, SESSION_KEY, storeKey]);

    // Persister l'historique dans son espace cloisonné
    useEffect(() => {
        const isolatedPast = pastSessions.filter(s => s.storeId && String(s.storeId) === storeKey);
        localStorage.setItem(PAST_KEY, JSON.stringify(isolatedPast));
    }, [pastSessions, PAST_KEY, storeKey]);

    // Persister le Grand Livre Maître d'Audit dans son espace cloisonné
    useEffect(() => {
        const isolatedMaster = masterSessions.filter(s => s.storeId && String(s.storeId) === storeKey);
        localStorage.setItem(MASTER_AUDIT_KEY, JSON.stringify(isolatedMaster));
    }, [masterSessions, MASTER_AUDIT_KEY, storeKey]);

    const openSession = (initialAmount) => {
        const newSession = {
            id: `session_${Date.now()}`,
            storeId: currentStoreId,
            userId: userId,
            cashierName: user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : (user?.name || user?.username || 'Caissier'),
            startTime: new Date().toISOString(),
            initialAmount: parseFloat(initialAmount) || 0,
            status: 'open'
        };
        setActiveSession(newSession);
        return newSession;
    };

    const closeSession = (actualAmount, expectedAmount, totalSales, totalExpenses, auditMetadata = {}) => {
        if (!activeSession) return;

        const difference = (parseFloat(actualAmount) || 0) - (parseFloat(expectedAmount) || 0);

        const closedSession = {
            ...activeSession,
            storeId: currentStoreId,
            endTime: new Date().toISOString(),
            actualAmount: parseFloat(actualAmount) || 0,
            expectedAmount: parseFloat(expectedAmount) || 0,
            difference,
            totalSales,
            totalExpenses,
            status: 'closed',
            // Métadonnées Clôture en Aveugle & Anti-Coulage
            isBlind: auditMetadata.isBlind ?? true,
            breakdown: auditMetadata.breakdown || null,
            expectedBreakdown: auditMetadata.expectedBreakdown || null,
            justification: auditMetadata.justification || '',
            cashierComment: auditMetadata.cashierComment || '',
            movementsSnapshot: auditMetadata.movementsSnapshot || [],
            auditStatus: Math.abs(difference) === 0 ? 'approved' : 'pending_review',
            auditNote: auditMetadata.auditNote || (Math.abs(difference) === 0 ? 'Conforme — Aucun écart' : ''),
            auditedBy: null,
            auditedAt: null
        };

        // Enregistrer dans l'historique du caissier
        setPastSessions(prev => [closedSession, ...prev.filter(s => s.id !== closedSession.id)]);

        // Enregistrer dans le Grand Livre Maître d'Audit Patron
        setMasterSessions(prev => [closedSession, ...prev.filter(s => s.id !== closedSession.id)]);

        setActiveSession(null);
        return closedSession;
    };

    // Arbitrage et visa patronal sur une session d'audit
    const reviewSessionAudit = (sessionId, { status, note, reviewerName }) => {
        const updatedFields = {
            auditStatus: status, // 'approved', 'payroll_deduction', 'investigating', 'regularized'
            auditNote: note,
            auditedBy: reviewerName || (user?.firstName ? `${user?.firstName} ${user?.lastName || ''}`.trim() : 'Patron'),
            auditedAt: new Date().toISOString()
        };

        setMasterSessions(prev =>
            prev.map(s => s.id === sessionId ? { ...s, ...updatedFields } : s)
        );

        setPastSessions(prev =>
            prev.map(s => s.id === sessionId ? { ...s, ...updatedFields } : s)
        );
    };

    const isSessionOverdue = () => {
        if (!activeSession || !activeSession.startTime) return false;
        const start = new Date(activeSession.startTime);
        const today = new Date();
        
        // Comparaison stricte des dates sans les heures
        const startDateOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        
        return startDateOnly < todayDateOnly;
    };

    // Garantir que activeSession n'est jamais exposée si elle n'appartient pas au store courant
    const safeActiveSession = useMemo(() => {
        if (!activeSession) return null;
        if (!activeSession.storeId || String(activeSession.storeId) !== storeKey) {
            return null;
        }
        return activeSession;
    }, [activeSession, storeKey]);

    // Filtrage strict des listes exposées (aucune session sans storeId ou d'une autre boutique)
    const safePastSessions = useMemo(() => {
        return pastSessions.filter(s => s.storeId && String(s.storeId) === storeKey);
    }, [pastSessions, storeKey]);

    const safeMasterSessions = useMemo(() => {
        return masterSessions.filter(s => s.storeId && String(s.storeId) === storeKey);
    }, [masterSessions, storeKey]);

    const isOverdue = safeActiveSession ? isSessionOverdue() : false;

    return (
        <SessionContext.Provider value={{
            activeSession: safeActiveSession,
            pastSessions: safePastSessions,
            masterSessions: safeMasterSessions,
            openSession,
            closeSession,
            reviewSessionAudit,
            isOverdue
        }}>
            {children}
        </SessionContext.Provider>
    );
};
