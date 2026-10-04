import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Lock, Mail, ArrowRight, User, Phone, Store, MapPin, ChevronLeft, ShieldCheck, Globe, ChevronDown, Check } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import T from '../../utils/toast';
import Logo from '../../components/Logo';

// ── Liste des pays avec drapeaux (emoji), code ISO et indicatif téléphonique ──
const COUNTRIES = [
    { code: 'TG', name: 'Togo',             flag: '🇹🇬', dialCode: '+228', currency: 'XOF' },
    { code: 'BJ', name: 'Bénin',            flag: '🇧🇯', dialCode: '+229', currency: 'XOF' },
    { code: 'CM', name: 'Cameroun',          flag: '🇨🇲', dialCode: '+237', currency: 'XAF' },
    { code: 'CI', name: "Côte d'Ivoire",    flag: '🇨🇮', dialCode: '+225', currency: 'XOF' },
    { code: 'ML', name: 'Mali',              flag: '🇲🇱', dialCode: '+223', currency: 'XOF' },
    { code: 'GN', name: 'Guinée Conakry',   flag: '🇬🇳', dialCode: '+224', currency: 'GNF' },
    { code: 'GW', name: 'Guinée-Bissau',    flag: '🇬🇼', dialCode: '+245', currency: 'XOF' },
    { code: 'SN', name: 'Sénégal',          flag: '🇸🇳', dialCode: '+221', currency: 'XOF' },
];

// ── Sélecteur de pays avec drapeaux ──────────────────────────────────────────
const CountrySelector = ({ value, onChange }) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const ref = useRef(null);

    const selected = COUNTRIES.find(c => c.code === value) || null;
    const filtered = COUNTRIES.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.dialCode.includes(search) ||
        c.code.toLowerCase().includes(search.toLowerCase())
    );

    // Ferme le dropdown si clic à l'extérieur
    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen(p => !p)}
                className="w-full flex items-center gap-3 pl-4 pr-3 py-2.5 bg-white/10 backdrop-blur-md border-2 border-white/20 hover:border-white/40 focus:border-white focus:bg-white/20 rounded-sm text-white font-medium text-sm transition-all focus:outline-none"
            >
                {selected ? (
                    <>
                        <span className="text-2xl leading-none">{selected.flag}</span>
                        <span className="flex-1 text-left text-white">{selected.name}</span>
                        <span className="text-blue-300/70 text-xs font-mono">{selected.dialCode}</span>
                        <span className="text-xs text-blue-100/60 font-bold border border-white/20 rounded px-1 ml-1">{selected.code}</span>
                    </>
                ) : (
                    <>
                        <Globe className="w-5 h-5 text-blue-200/70" />
                        <span className="flex-1 text-left text-blue-200/50">Choisir votre pays</span>
                    </>
                )}
                <ChevronDown className={`w-4 h-4 text-blue-200/70 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div className="absolute z-50 mt-1 w-full rounded-sm shadow-2xl border border-white/20 backdrop-blur-xl overflow-hidden"
                     style={{ background: 'rgba(0, 29, 53, 0.97)' }}>
                    {/* Champ de recherche */}
                    <div className="p-2 border-b border-white/10">
                        <input
                            autoFocus
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Rechercher un pays..."
                            className="w-full px-3 py-1.5 bg-white/10 border border-white/20 rounded text-white text-xs placeholder-blue-200/40 focus:outline-none focus:border-white/50"
                        />
                    </div>

                    {/* Liste des pays */}
                    <div className="max-h-52 overflow-y-auto">
                        {filtered.length === 0 ? (
                            <div className="px-4 py-3 text-blue-200/50 text-xs text-center">Aucun résultat</div>
                        ) : (
                            filtered.map(country => (
                                <button
                                    key={country.code}
                                    type="button"
                                    onClick={() => { onChange(country.code); setOpen(false); setSearch(''); }}
                                    className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 transition-colors text-left group ${value === country.code ? 'bg-white/10' : ''}`}
                                >
                                    <span className="text-2xl leading-none">{country.flag}</span>
                                    <span className="flex-1 text-white text-sm font-medium">{country.name}</span>
                                    <span className="text-blue-300/70 text-xs font-mono">{country.dialCode}</span>
                                    <span className="text-[10px] text-blue-200/50 font-bold border border-white/15 rounded px-1 ml-1">{country.code}</span>
                                    {value === country.code && <Check className="w-3.5 h-3.5 text-emerald-400 ml-1" />}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────

const Register = () => {
    const [step, setStep] = useState(1); // Étape 1 : Info boutique | Étape 2 : Info Admin
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isRedirecting, setIsRedirecting] = useState(false);
    const navigate = useNavigate();

    const [form, setForm] = useState({
        countryCode: '',
        storeName: '',
        storeAddress: '',
        phone: '',
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        confirmPassword: ''
    });

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleCountryChange = (code) => {
        const country = COUNTRIES.find(c => c.code === code);
        setForm(prev => ({
            ...prev,
            countryCode: code,
            // Pré-remplir l'indicatif dans le champ téléphone si vide
            phone: prev.phone ? prev.phone : (country?.dialCode || '')
        }));
    };

    const handleNextStep = (e) => {
        e.preventDefault();
        if (!form.countryCode) {
            T.warning("Veuillez sélectionner votre pays.");
            return;
        }
        if (!form.storeName || !form.phone) {
            T.warning("Le nom de la boutique et le téléphone sont obligatoires.");
            return;
        }
        setStep(2);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (form.password !== form.confirmPassword) {
            T.warning("Les mots de passe ne correspondent pas.");
            return;
        }
        setIsSubmitting(true);
        try {
            const selectedCountry = COUNTRIES.find(c => c.code === form.countryCode);
            const response = await fetch('http://localhost:8080/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    storeName: form.storeName,
                    storeAddress: form.storeAddress,
                    phone: form.phone,
                    countryCode: form.countryCode,
                    countryName: selectedCountry?.name || '',
                    firstName: form.firstName,
                    lastName: form.lastName,
                    email: form.email,
                    password: form.password
                })
            });

            if (!response.ok) {
                throw new Error("Erreur lors de la création du compte. L'email est peut-être déjà utilisé.");
            }

            T.success("Votre quincaillerie a été créée avec succès !");
            setIsRedirecting(true);
            setTimeout(() => {
                navigate('/login');
            }, 2000);
        } catch (error) {
            T.error(error.message);
            setIsSubmitting(false);
        }
    };

    const selectedCountry = COUNTRIES.find(c => c.code === form.countryCode);

    return (
        <div className="min-h-screen w-full relative bg-gradient-to-br from-[#0c1838] via-[#001d35] to-[#071126] text-white flex flex-col justify-between p-6 sm:p-10 overflow-hidden">
            {/* Ambient Background Glows */}
            <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>

            {/* Top Bar Branding */}
            <div className="relative z-10 flex items-center justify-between max-w-6xl w-full mx-auto">
                <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    <span className="text-xs font-bold uppercase tracking-widest text-blue-200/80">Espace Inscription Enterprise</span>
                </div>
            </div>

            {/* Main Center Content */}
            <div className="relative z-10 max-w-md w-full mx-auto my-auto py-6">
                {/* Entête Logo */}
                <div className="text-center mb-6">
                    <Logo className="h-9 sm:h-10 text-white mx-auto drop-shadow-lg mb-2" />
                    <p className="text-blue-200 text-xs font-bold tracking-widest uppercase opacity-90 mt-1">
                        Créer votre Espace Quincaillerie
                    </p>

                    {/* Indicateur d'étapes */}
                    <div className="flex items-center justify-center gap-2 mt-4">
                        <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold border-2 transition-all ${step >= 1 ? 'bg-white text-[#001d35] border-white' : 'border-white/40 text-white/60'}`}>1</div>
                        <div className={`w-12 h-0.5 transition-all ${step >= 2 ? 'bg-white' : 'bg-white/30'}`}></div>
                        <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold border-2 transition-all ${step >= 2 ? 'bg-white text-[#001d35] border-white' : 'border-white/40 text-white/60'}`}>2</div>
                    </div>
                    <p className="text-blue-100 text-xs tracking-wider uppercase font-medium mt-1">
                        {step === 1 ? 'Étape 1 : Votre Boutique' : 'Étape 2 : Compte Administrateur'}
                    </p>
                </div>

                {/* ── Étape 1 : Informations de la boutique ────────────────── */}
                {step === 1 && (
                    <form onSubmit={handleNextStep} className="space-y-4">

                        {/* Sélection du pays */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-blue-100/90 mb-1.5">
                                Pays *
                            </label>
                            <CountrySelector value={form.countryCode} onChange={handleCountryChange} />
                            {selectedCountry && (
                                <div className="mt-1.5 flex items-center gap-2 px-2">
                                    <span className="text-lg">{selectedCountry.flag}</span>
                                    <span className="text-[11px] text-emerald-300 font-semibold">
                                        {selectedCountry.name} · Code: {selectedCountry.code} · Indicatif: {selectedCountry.dialCode}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Nom de la boutique */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-blue-100/90 mb-1.5">Nom de la Boutique *</label>
                            <div className="relative">
                                <Store className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-blue-200/70" />
                                <input name="storeName" value={form.storeName} onChange={handleChange}
                                    className="block w-full pl-11 pr-4 py-2.5 bg-white/10 backdrop-blur-md border-2 border-white/20 hover:border-white/40 focus:border-white focus:bg-white/20 rounded-sm text-white placeholder-blue-200/50 font-medium text-sm transition-all focus:outline-none"
                                    placeholder="Ex: Quincaillerie La Prospérité" required />
                            </div>
                        </div>

                        {/* Téléphone */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-blue-100/90 mb-1.5">Numéro de Téléphone *</label>
                            <div className="relative">
                                {selectedCountry ? (
                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xl leading-none pointer-events-none">{selectedCountry.flag}</span>
                                ) : (
                                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-blue-200/70" />
                                )}
                                <input name="phone" value={form.phone} onChange={handleChange} type="tel"
                                    className="block w-full pl-11 pr-4 py-2.5 bg-white/10 backdrop-blur-md border-2 border-white/20 hover:border-white/40 focus:border-white focus:bg-white/20 rounded-sm text-white placeholder-blue-200/50 font-medium text-sm transition-all focus:outline-none"
                                    placeholder={selectedCountry ? `${selectedCountry.dialCode} 00 00 00 00` : "+228 90 00 00 00"} required />
                            </div>
                        </div>

                        {/* Adresse */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-blue-100/90 mb-1.5">Adresse de la Boutique</label>
                            <div className="relative">
                                <MapPin className="absolute left-3.5 top-3 h-5 w-5 text-blue-200/70" />
                                <textarea name="storeAddress" value={form.storeAddress} onChange={handleChange} rows={2}
                                    className="block w-full pl-11 pr-4 py-2.5 bg-white/10 backdrop-blur-md border-2 border-white/20 hover:border-white/40 focus:border-white focus:bg-white/20 rounded-sm text-white placeholder-blue-200/50 font-medium text-sm transition-all focus:outline-none resize-none"
                                    placeholder={selectedCountry ? `Rue du Commerce, ${selectedCountry.name.split(' ')[0]}...` : "Ex: Rue du Commerce, Lomé, Togo"} />
                            </div>
                        </div>

                        <button type="submit"
                            className="w-full py-3.5 px-4 bg-white hover:bg-blue-50 text-[#001d35] font-black rounded-sm shadow-xl transition-all text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer border border-white">
                            Étape suivante <ArrowRight className="w-4 h-4 text-[#001d35]" />
                        </button>
                    </form>
                )}

                {/* ── Étape 2 : Compte Admin ────────────────────────────────── */}
                {step === 2 && (
                    <form onSubmit={handleSubmit} className="space-y-3.5">
                        <button type="button" onClick={() => setStep(1)}
                            className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-blue-200 hover:text-white transition-colors mb-1 cursor-pointer">
                            <ChevronLeft className="w-4 h-4" /> Retour boutique
                        </button>

                        {/* Récap pays sélectionné */}
                        {selectedCountry && (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-sm bg-white/5 border border-white/10 mb-1">
                                <span className="text-xl">{selectedCountry.flag}</span>
                                <span className="text-xs text-blue-200 font-medium">{selectedCountry.name}</span>
                                <span className="ml-auto text-[10px] font-bold text-blue-300/70 border border-white/15 rounded px-1">{selectedCountry.code}</span>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-blue-100/90 mb-1">Prénom *</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-200/70" />
                                    <input name="firstName" value={form.firstName} onChange={handleChange}
                                        className="block w-full pl-9 pr-3 py-2 bg-white/10 backdrop-blur-md border-2 border-white/20 hover:border-white/40 focus:border-white focus:bg-white/20 rounded-sm text-white placeholder-blue-200/50 font-medium text-sm transition-all focus:outline-none"
                                        placeholder="Koffi" required />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-blue-100/90 mb-1">Nom *</label>
                                <input name="lastName" value={form.lastName} onChange={handleChange}
                                    className="block w-full px-3 py-2 bg-white/10 backdrop-blur-md border-2 border-white/20 hover:border-white/40 focus:border-white focus:bg-white/20 rounded-sm text-white placeholder-blue-200/50 font-medium text-sm transition-all focus:outline-none"
                                    placeholder="Amégah" required />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-blue-100/90 mb-1">Adresse E-mail *</label>
                            <div className="relative">
                                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-blue-200/70" />
                                <input name="email" value={form.email} onChange={handleChange} type="email"
                                    className="block w-full pl-11 pr-4 py-2.5 bg-white/10 backdrop-blur-md border-2 border-white/20 hover:border-white/40 focus:border-white focus:bg-white/20 rounded-sm text-white placeholder-blue-200/50 font-medium text-sm transition-all focus:outline-none"
                                    placeholder="admin@maboutique.com" required />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-blue-100/90 mb-1">Mot de passe *</label>
                            <div className="relative">
                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-blue-200/70" />
                                <input name="password" value={form.password} onChange={handleChange} type="password"
                                    className="block w-full pl-11 pr-4 py-2.5 bg-white/10 backdrop-blur-md border-2 border-white/20 hover:border-white/40 focus:border-white focus:bg-white/20 rounded-sm text-white placeholder-blue-200/50 font-medium text-sm transition-all focus:outline-none"
                                    placeholder="Minimum 8 caractères" required minLength={8} />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-blue-100/90 mb-1">Confirmer le mot de passe *</label>
                            <div className="relative">
                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-blue-200/70" />
                                <input name="confirmPassword" value={form.confirmPassword} onChange={handleChange} type="password"
                                    className="block w-full pl-11 pr-4 py-2.5 bg-white/10 backdrop-blur-md border-2 border-white/20 hover:border-white/40 focus:border-white focus:bg-white/20 rounded-sm text-white placeholder-blue-200/50 font-medium text-sm transition-all focus:outline-none"
                                    placeholder="••••••••" required />
                            </div>
                        </div>

                        <button type="submit" disabled={isSubmitting}
                            className={`w-full py-3.5 px-4 bg-white hover:bg-blue-50 text-[#001d35] font-black rounded-sm shadow-xl transition-all text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer border border-white ${isSubmitting ? 'opacity-75 cursor-wait' : ''}`}>
                            {isSubmitting ? 'Création en cours...' : 'Créer ma Quincaillerie'}
                            {!isSubmitting && <ArrowRight className="w-4 h-4 text-[#001d35]" />}
                        </button>
                    </form>
                )}

                {/* Footer Link */}
                <div className="pt-4 text-center">
                    <p className="text-xs text-blue-200/80 font-medium">
                        Déjà un compte ?{' '}
                        <Link to="/login" className="font-bold text-white hover:underline underline-offset-2">
                            Se connecter
                        </Link>
                    </p>
                </div>
            </div>

            {/* Footer */}
            <div className="relative z-10 text-center text-xs text-blue-200/60 font-medium uppercase tracking-widest">
                © {new Date().getFullYear()} KABLLIX System Management. Tous droits réservés.
            </div>

            {/* ── Loader overlay après inscription réussie ── */}
            {isRedirecting && (
                <div className="fixed inset-0 bg-[#001d35]/75 backdrop-blur-md flex items-center justify-center z-[200] animate-in fade-in duration-150">
                    <div className="flex flex-col items-center gap-5 bg-white px-10 py-8 rounded-sm shadow-2xl border border-gray-100 max-w-sm w-full mx-4 animate-in zoom-in-95 duration-150">
                        <div className="w-14 h-14 border-4 border-[#001d35]/20 border-t-[#001d35] rounded-full animate-spin"></div>
                        <div className="text-center">
                            {selectedCountry && <div className="text-4xl mb-2">{selectedCountry.flag}</div>}
                            <p className="text-gray-900 font-bold text-base">
                                Quincaillerie créée avec succès !
                            </p>
                            <p className="text-gray-500 text-xs mt-1 font-medium">
                                Redirection vers la page de connexion...
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Register;
