import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useSettings } from './SettingsContext';
import { useAuth } from './AuthContext';

const SessionContext = createContext();

export const useSession = () => useContext(SessionContext);

export const SessionProvider = ({ children }) => {
    const { currentStoreId } = useSettings();
    const { user } = useAuth();

    // Clés localStorage isolées par utilisateur — sécurité multi-comptes
    const userId = user?.id || user?.username || 'anonymous';
    const SESSION_KEY = `active_session_${userId}`;
    const PAST_KEY = `past_sessions_${userId}`;

    const prevUserIdRef = useRef(userId);

    const [activeSession, setActiveSession] = useState(() => {
        const saved = localStorage.getItem(`active_session_${userId}`);
        return saved ? JSON.parse(saved) : null;
    });

    const [pastSessions, setPastSessions] = useState(() => {
        const saved = localStorage.getItem(`past_sessions_${userId}`);
        return saved ? JSON.parse(saved) : [];
    });

    // Quand l'utilisateur change (déconnexion / reconnexion), recharger les bonnes données
    useEffect(() => {
        const newUserId = user?.id || user?.username || 'anonymous';
        if (prevUserIdRef.current !== newUserId) {
            prevUserIdRef.current = newUserId;
            // Charger les données du nouvel utilisateur
            const savedSession = localStorage.getItem(`active_session_${newUserId}`);
            const savedPast = localStorage.getItem(`past_sessions_${newUserId}`);
            setActiveSession(savedSession ? JSON.parse(savedSession) : null);
            setPastSessions(savedPast ? JSON.parse(savedPast) : []);
        }
    }, [user]);

    // Persister la session active liée à l'utilisateur courant
    useEffect(() => {
        if (activeSession) {
            localStorage.setItem(SESSION_KEY, JSON.stringify(activeSession));
        } else {
            localStorage.removeItem(SESSION_KEY);
        }
    }, [activeSession, SESSION_KEY]);

    // Persister l'historique lié à l'utilisateur courant
    useEffect(() => {
        localStorage.setItem(PAST_KEY, JSON.stringify(pastSessions));
    }, [pastSessions, PAST_KEY]);

    const openSession = (initialAmount) => {
        const newSession = {
            id: `session_${Date.now()}`,
            storeId: currentStoreId,
            userId: userId,
            cashierName: user?.name || user?.username || 'Caissier',
            startTime: new Date().toISOString(),
            initialAmount: parseFloat(initialAmount) || 0,
            status: 'open'
        };
        setActiveSession(newSession);
        return newSession;
    };

    const closeSession = (actualAmount, expectedAmount, totalSales, totalExpenses) => {
        if (!activeSession) return;

        const closedSession = {
            ...activeSession,
            endTime: new Date().toISOString(),
            actualAmount: parseFloat(actualAmount) || 0,
            expectedAmount: parseFloat(expectedAmount) || 0,
            difference: (parseFloat(actualAmount) || 0) - (parseFloat(expectedAmount) || 0),
            totalSales,
            totalExpenses,
            status: 'closed'
        };

        setPastSessions(prev => [closedSession, ...prev]);
        setActiveSession(null);
        return closedSession;
    };

    return (
        <SessionContext.Provider value={{
            activeSession,
            pastSessions,
            openSession,
            closeSession
        }}>
            {children}
        </SessionContext.Provider>
    );
};
