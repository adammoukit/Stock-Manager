/**
 * utils/toast.jsx
 * Système centralisé de notifications Toast pour toute l'application.
 * Utilise react-hot-toast avec les icônes Lucide et le design Kabllix (4px border-radius).
 */
import toast from 'react-hot-toast';
import React from 'react';
import {
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Info,
    ShoppingCart,
    PackagePlus,
    Pencil,
    Trash2,
    LogIn,
    LogOut,
    FileText,
    Wallet,
    BarChart2,
    RotateCcw,
    X,
} from 'lucide-react';

// ─── Styles de base communs ────────────────────────────────────────────────────
const BASE = {
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: '600',
    padding: '10px 14px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
    maxWidth: '380px',
    border: '1.5px solid transparent',
};

const STYLES = {
    success: {
        ...BASE,
        background: '#16a34a',      // green-600
        color: '#ffffff',
        border: '1.5px solid #15803d',
    },
    error: {
        ...BASE,
        background: '#dc2626',      // red-600
        color: '#ffffff',
        border: '1.5px solid #b91c1c',
    },
    warning: {
        ...BASE,
        background: '#d97706',      // amber-600
        color: '#ffffff',
        border: '1.5px solid #b45309',
    },
    info: {
        ...BASE,
        background: '#001d35',      // Navy Kabllix
        color: '#ffffff',
        border: '1.5px solid #00284a',
    },
};

// ─── Rendu d'une icône dans un cercle ─────────────────────────────────────────
const Icon = ({ children }) => (
    <span
        style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '26px',
            height: '26px',
            borderRadius: '4px',
            background: 'rgba(255,255,255,0.20)',
            flexShrink: 0,
        }}
    >
        {children}
    </span>
);

const parseArgs = (iconOrOptions, maybeOptions, defaultDuration) => {
    let icon = null;
    let options = {};

    if (React.isValidElement(iconOrOptions)) {
        icon = iconOrOptions;
        options = maybeOptions || {};
    } else if (iconOrOptions && typeof iconOrOptions === 'object') {
        options = iconOrOptions;
    } else if (iconOrOptions) {
        icon = iconOrOptions;
        options = maybeOptions || {};
    }

    const duration = options.duration !== undefined ? options.duration : defaultDuration;
    const isDismissible = options.dismissible ?? (duration === Infinity);

    return { icon, options: { ...options, duration }, isDismissible };
};

const renderCustomToast = (type, message, icon, defaultIcon, options, isDismissible) => {
    return toast.custom((t) => (
        <div
            style={{
                ...STYLES[type],
                opacity: t.visible ? 1 : 0,
                transform: t.visible ? 'translateY(0)' : 'translateY(-8px)',
                transition: 'all 0.25s ease',
                position: 'relative',
                paddingRight: isDismissible ? '32px' : '14px',
                ...options.style,
            }}
        >
            <Icon>{icon || defaultIcon}</Icon>
            <span style={{ flex: 1, wordBreak: 'break-word', lineHeight: '1.4' }}>{message}</span>
            {isDismissible && (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        toast.dismiss(t.id);
                    }}
                    style={{
                        position: 'absolute',
                        top: '6px',
                        right: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '20px',
                        height: '20px',
                        background: 'rgba(255,255,255,0.15)',
                        border: 'none',
                        color: '#ffffff',
                        cursor: 'pointer',
                        borderRadius: '4px',
                        opacity: 0.85,
                        padding: 0,
                        transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = '1';
                        e.currentTarget.style.background = 'rgba(255,255,255,0.3)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = '0.85';
                        e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
                    }}
                    aria-label="Fermer"
                    title="Fermer"
                >
                    <X size={13} strokeWidth={2.5} />
                </button>
            )}
        </div>
    ), options);
};

// ─── Fonctions publiques ───────────────────────────────────────────────────────

/** Succès (fond vert) */
export const toastSuccess = (message, iconOrOptions, maybeOptions) => {
    const { icon, options, isDismissible } = parseArgs(iconOrOptions, maybeOptions, 3000);
    return renderCustomToast(
        'success',
        message,
        icon,
        <CheckCircle2 size={15} strokeWidth={2.5} color="#fff" />,
        options,
        isDismissible
    );
};

/** Erreur (fond rouge) */
export const toastError = (message, iconOrOptions, maybeOptions) => {
    const { icon, options, isDismissible } = parseArgs(iconOrOptions, maybeOptions, 4000);
    return renderCustomToast(
        'error',
        message,
        icon,
        <XCircle size={15} strokeWidth={2.5} color="#fff" />,
        options,
        isDismissible
    );
};

/** Avertissement (fond amber) */
export const toastWarning = (message, iconOrOptions, maybeOptions) => {
    const { icon, options, isDismissible } = parseArgs(iconOrOptions, maybeOptions, 4000);
    return renderCustomToast(
        'warning',
        message,
        icon,
        <AlertTriangle size={15} strokeWidth={2.5} color="#fff" />,
        options,
        isDismissible
    );
};

/** Info (fond navy Kabllix) */
export const toastInfo = (message, iconOrOptions, maybeOptions) => {
    const { icon, options, isDismissible } = parseArgs(iconOrOptions, maybeOptions, 3500);
    return renderCustomToast(
        'info',
        message,
        icon,
        <Info size={15} strokeWidth={2.5} color="#fff" />,
        options,
        isDismissible
    );
};

export const toastDismiss = (id) => toast.dismiss(id);

// ─── Raccourcis sémantiques avec icône pré-définie ────────────────────────────

/** Produit ajouté au panier */
export const toastCartAdd = (name) =>
    toastSuccess(
        `${name} ajouté au panier`,
        <ShoppingCart size={15} strokeWidth={2.5} color="#fff" />
    );

/** Produit créé */
export const toastProductCreated = (name) =>
    toastSuccess(
        `${name} ajouté au catalogue`,
        <PackagePlus size={15} strokeWidth={2.5} color="#fff" />
    );

/** Produit modifié */
export const toastProductUpdated = (name) =>
    toastSuccess(
        `${name} mis à jour`,
        <Pencil size={15} strokeWidth={2.5} color="#fff" />
    );

/** Suppression réussie */
export const toastDeleted = (label) =>
    toastSuccess(
        label || 'Supprimé avec succès',
        <Trash2 size={15} strokeWidth={2.5} color="#fff" />
    );

/** Connexion réussie */
export const toastLogin = (name) =>
    toastSuccess(
        `Bienvenue ${name} !`,
        <LogIn size={15} strokeWidth={2.5} color="#fff" />
    );

/** Déconnexion */
export const toastLogout = () =>
    toastInfo('Déconnecté avec succès', <LogOut size={15} strokeWidth={2.5} color="#fff" />);

/** Paiement validé */
export const toastPaymentSuccess = () =>
    toastSuccess(
        'Paiement validé avec succès !',
        <Wallet size={15} strokeWidth={2.5} color="#fff" />
    );

/** Devis / rapport sauvegardé */
export const toastSaved = (label) =>
    toastSuccess(
        label || 'Enregistré avec succès',
        <FileText size={15} strokeWidth={2.5} color="#fff" />
    );

/** Action annulée / remboursement */
export const toastCancelled = (label) =>
    toastWarning(
        label || 'Action annulée',
        <RotateCcw size={15} strokeWidth={2.5} color="#fff" />
    );

/** Export CSV */
export const toastExport = (label) =>
    toastSuccess(
        label || 'Export réussi',
        <BarChart2 size={15} strokeWidth={2.5} color="#fff" />
    );

export default {
    success: toastSuccess,
    error: toastError,
    warning: toastWarning,
    info: toastInfo,
    dismiss: toastDismiss,
    cartAdd: toastCartAdd,
    productCreated: toastProductCreated,
    productUpdated: toastProductUpdated,
    deleted: toastDeleted,
    login: toastLogin,
    logout: toastLogout,
    paymentSuccess: toastPaymentSuccess,
    saved: toastSaved,
    cancelled: toastCancelled,
    export: toastExport,
};
