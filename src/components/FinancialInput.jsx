import React, { forwardRef, useImperativeHandle, useRef, useLayoutEffect, useState, useEffect } from 'react';
import { formatFinancialNumber, unformatFinancialNumber } from '../utils/currency';

/**
 * Composant de saisie financière avec séparation automatique des milliers par des espaces.
 * Exemple: 10000 -> "10 000", 1000000 -> "1 000 000"
 * Transmet la valeur brute non formatée (ex: "10000") aux gestionnaires onChange standards.
 */
const FinancialInput = forwardRef(({
    value,
    defaultValue,
    onChange,
    onValueChange,
    allowDecimals = false,
    className = '',
    placeholder = '0',
    name,
    min,
    max,
    disabled = false,
    readOnly = false,
    autoFocus = false,
    required = false,
    onKeyDown,
    onBlur,
    onFocus,
    ...props
}, ref) => {
    const inputRef = useRef(null);
    useImperativeHandle(ref, () => inputRef.current);

    // Conserver la position du curseur lors des reformatages
    const cursorRef = useRef(null);

    const getFormatted = (val) => {
        if (val === '' || val === null || val === undefined) return '';
        return formatFinancialNumber(val, allowDecimals);
    };

    const [displayValue, setDisplayValue] = useState(() => {
        const initial = value !== undefined ? value : defaultValue;
        return getFormatted(initial);
    });

    // Synchroniser si la prop value externe change
    useEffect(() => {
        if (value !== undefined) {
            const formatted = getFormatted(value);
            setDisplayValue(formatted);
        }
    }, [value, allowDecimals]);

    useLayoutEffect(() => {
        if (cursorRef.current !== null && inputRef.current) {
            const { position } = cursorRef.current;
            try {
                inputRef.current.setSelectionRange(position, position);
            } catch {
                // ignore in non-text inputs if any
            }
            cursorRef.current = null;
        }
    });

    const calculateNewCursor = (newFormatted, targetNonSpaces) => {
        if (targetNonSpaces <= 0) return 0;
        let count = 0;
        for (let i = 0; i < newFormatted.length; i++) {
            if (newFormatted[i] !== ' ') {
                count++;
                if (count === targetNonSpaces) {
                    return i + 1;
                }
            }
        }
        return newFormatted.length;
    };

    const dispatchChange = (originalEvent, rawValue) => {
        if (onChange) {
            const syntheticEvent = {
                ...originalEvent,
                target: {
                    ...(originalEvent.target || {}),
                    name: name || originalEvent.target?.name || '',
                    value: rawValue
                },
                currentTarget: {
                    ...(originalEvent.currentTarget || {}),
                    name: name || originalEvent.currentTarget?.name || '',
                    value: rawValue
                }
            };
            onChange(syntheticEvent);
        }
        if (onValueChange) {
            const num = rawValue === '' ? 0 : (allowDecimals ? parseFloat(rawValue) : parseInt(rawValue, 10));
            onValueChange(isNaN(num) ? 0 : num, rawValue);
        }
    };

    const handleKeyDown = (e) => {
        const input = inputRef.current;
        if (!input) {
            onKeyDown?.(e);
            return;
        }

        // Touche Retour arrière (Backspace) devant un espace
        if (e.key === 'Backspace' && input.selectionStart === input.selectionEnd && input.selectionStart > 0) {
            const pos = input.selectionStart;
            if (input.value[pos - 1] === ' ') {
                e.preventDefault();
                // Supprimer le chiffre situé avant l'espace
                const before = input.value.slice(0, pos - 2);
                const after = input.value.slice(pos);
                const nextVal = before + after;
                const raw = unformatFinancialNumber(nextVal, allowDecimals);
                const formatted = formatFinancialNumber(raw, allowDecimals);

                const nonSpacesBefore = before.replace(/\s/g, '').length;
                const newPos = calculateNewCursor(formatted, nonSpacesBefore);

                cursorRef.current = { position: newPos };
                setDisplayValue(formatted);
                dispatchChange(e, raw);
                return;
            }
        }

        // Touche Suppr (Delete) devant un espace
        if (e.key === 'Delete' && input.selectionStart === input.selectionEnd && input.selectionStart < input.value.length) {
            const pos = input.selectionStart;
            if (input.value[pos] === ' ') {
                e.preventDefault();
                // Supprimer l'espace et le chiffre qui suit
                const before = input.value.slice(0, pos);
                const after = input.value.slice(pos + 2);
                const nextVal = before + after;
                const raw = unformatFinancialNumber(nextVal, allowDecimals);
                const formatted = formatFinancialNumber(raw, allowDecimals);

                const nonSpacesBefore = before.replace(/\s/g, '').length;
                const newPos = calculateNewCursor(formatted, nonSpacesBefore);

                cursorRef.current = { position: newPos };
                setDisplayValue(formatted);
                dispatchChange(e, raw);
                return;
            }
        }

        onKeyDown?.(e);
    };

    const handleChange = (e) => {
        const input = e.target;
        const currentVal = input.value;
        const selStart = input.selectionStart;

        // Nombre de caractères utiles (hors espaces) avant le curseur
        const nonSpacesBefore = currentVal.slice(0, selStart).replace(/\s/g, '').length;

        const raw = unformatFinancialNumber(currentVal, allowDecimals);
        const formatted = formatFinancialNumber(raw, allowDecimals);

        const newPos = calculateNewCursor(formatted, nonSpacesBefore);
        cursorRef.current = { position: newPos };

        setDisplayValue(formatted);
        dispatchChange(e, raw);
    };

    return (
        <input
            {...props}
            ref={inputRef}
            type="text"
            inputMode={allowDecimals ? 'decimal' : 'numeric'}
            pattern="[0-9 ]*"
            name={name}
            value={displayValue}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={onFocus}
            onBlur={onBlur}
            disabled={disabled}
            readOnly={readOnly}
            autoFocus={autoFocus}
            required={required}
            placeholder={placeholder}
            className={className}
        />
    );
});

FinancialInput.displayName = 'FinancialInput';

export default FinancialInput;
