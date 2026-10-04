import React from 'react';

/**
 * Icon360.jsx
 * Version Haute Performance avec support d'Animation 360° :
 * - Chiffres "360" massifs en Inter Black 900.
 * - Véritable symbole de degré '°' : Anneau évidé (cercle ouvert) en orange #f77500 à droite et en haut.
 * - Flèches arquées latérales avec marges aérées.
 * - Flèche gauche montante surélevée / Flèche droite descendante abaissée.
 * - Support `animateArrows` : rotation fluide infinie des flèches autour du centre 360°.
 */
const Icon360 = ({ 
    className = "w-12 h-7", 
    color = "#f77500", 
    textColor = "currentColor", 
    animateArrows = false,
    ...props 
}) => {
    return (
        <svg
            viewBox="0 0 58 34"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            {...props}
        >
            {animateArrows && (
                <style>{`
                    @keyframes rotateArrows360 {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                    .anim-arrows-360 {
                        transform-origin: 29px 17px;
                        animation: rotateArrows360 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
                    }
                `}</style>
            )}

            {/* ── Groupe des Flèches Arquées (animées ou statiques) ── */}
            <g className={animateArrows ? "anim-arrows-360" : undefined}>
                {/* Flèche arquée CÔTÉ GAUCHE (surélevée vers le haut, monte / sens horaire) */}
                <path
                    d="M 7.5 25 A 10 13 0 0 1 7.5 4.5"
                    stroke={color}
                    strokeWidth="3.2"
                    strokeLinecap="round"
                />
                {/* Pointe de la flèche gauche */}
                <path
                    d="M 3.8 5.2 L 9.8 2.2 V 8.2"
                    stroke={color}
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />

                {/* Flèche arquée CÔTÉ DROIT (abaissée vers le bas, descend / symétrie 180°) */}
                <path
                    d="M 50.5 9 A 10 13 0 0 1 50.5 29.5"
                    stroke={color}
                    strokeWidth="3.2"
                    strokeLinecap="round"
                />
                {/* Pointe de la flèche droite */}
                <path
                    d="M 54.2 28.8 L 48.2 31.8 V 25.8"
                    stroke={color}
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </g>

            {/* ── Chiffres "360" géants au centre ── */}
            <text
                x="25"
                y="18.2"
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="20.5"
                fontWeight="900"
                fontFamily="Inter, system-ui, -apple-system, sans-serif"
                letterSpacing="-1.1px"
                fill={textColor}
            >
                360
            </text>

            {/* ── Véritable Symbole Degré '°' (Anneau ouvert évidé orange #f77500 à droite et en haut de 360) ── */}
            <circle
                cx="42.5"
                cy="8.5"
                r="2.4"
                stroke={color}
                strokeWidth="1.8"
                fill="none"
            />
        </svg>
    );
};

export default Icon360;
