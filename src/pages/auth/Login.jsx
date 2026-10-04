import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { Lock, Mail, ArrowRight, ShieldCheck } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import Logo from '../../components/Logo';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isRedirecting, setIsRedirecting] = useState(false);
    const { login } = useAuth();
    const { company } = useSettings();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        const success = await login(email, password);
        if (success) {
            // Indique au Dashboard qu'il doit recharger les données pour s'assurer de la fraîcheur
            sessionStorage.setItem('kabllix_refresh_needed', 'true');
            setIsRedirecting(true);
            setTimeout(() => {
                navigate('/');
            }, 2000);
            return;
        }
        setIsSubmitting(false);
    };

    return (
        <div className="min-h-screen w-full relative bg-gradient-to-br from-[#0c1838] via-[#001d35] to-[#071126] text-white flex flex-col justify-between p-6 sm:p-10 overflow-hidden">
            {/* Ambient Background Glows */}
            <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>

            {/* Top Bar Branding */}
            <div className="relative z-10 flex items-center justify-between max-w-6xl w-full mx-auto">
                <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    <span className="text-xs font-bold uppercase tracking-widest text-blue-200/80">Accès Sécurisé Enterprise</span>
                </div>
            </div>

            {/* Main Center Content (No Visible Card Container) */}
            <div className="relative z-10 max-w-md w-full mx-auto my-auto py-8">
                {/* Entête Logo */}
                <div className="text-center mb-8 flex flex-col items-center">
                    {company?.logo ? (
                        <div className="mb-4">
                            <img src={company.logo} alt={company.name || "Logo"} className="h-20 max-w-[260px] object-contain drop-shadow-2xl mx-auto" />
                        </div>
                    ) : (
                        <div className="inline-flex items-center justify-center w-20 h-20 mb-5 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-xl">
                            <img src="/kabllix-logo-white.svg" alt="Kabllix Icon" className="w-12 h-12 drop-shadow-md" />
                        </div>
                    )}
                    <Logo className="h-10 sm:h-12 text-white mx-auto drop-shadow-lg" />
                </div>

                {/* Formulaire Flottant Sans Conteneur */}
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-blue-100/90 mb-2">
                            Adresse E-mail
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                <Mail className="h-5 w-5 text-blue-200/70" />
                            </div>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="block w-full pl-11 pr-4 py-3 bg-white/10 backdrop-blur-md border-2 border-white/20 hover:border-white/40 focus:border-white focus:bg-white/20 rounded-sm text-white placeholder-blue-200/50 font-medium text-sm transition-all focus:outline-none"
                                placeholder="admin@kabllix.com"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-xs font-bold uppercase tracking-wider text-blue-100/90">
                                Mot de passe
                            </label>
                            <a href="#" className="text-xs font-semibold text-blue-200 hover:text-white transition-colors underline-offset-2 hover:underline">
                                Mot de passe oublié ?
                            </a>
                        </div>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                <Lock className="h-5 w-5 text-blue-200/70" />
                            </div>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="block w-full pl-11 pr-4 py-3 bg-white/10 backdrop-blur-md border-2 border-white/20 hover:border-white/40 focus:border-white focus:bg-white/20 rounded-sm text-white placeholder-blue-200/50 font-medium text-sm transition-all focus:outline-none"
                                placeholder="••••••••"
                                required
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className={`w-full py-3.5 px-4 bg-white hover:bg-blue-50 text-[#001d35] font-black rounded-sm shadow-xl hover:shadow-white/20 transition-all text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99] border border-white ${isSubmitting ? 'opacity-75 cursor-wait' : ''}`}
                    >
                        {isSubmitting ? 'Connexion en cours...' : 'Se Connecter'}
                        {!isSubmitting && <ArrowRight className="w-4 h-4 text-[#001d35]" />}
                    </button>

                    <div className="pt-4 text-center">
                        <p className="text-xs text-blue-200/80 font-medium">
                            Pas encore de compte ?{' '}
                            <Link to="/register" className="font-bold text-white hover:underline underline-offset-2">
                                Créer votre quincaillerie
                            </Link>
                        </p>
                    </div>
                </form>
            </div>

            {/* Footer */}
            <div className="relative z-10 text-center text-xs text-blue-200/60 font-medium uppercase tracking-widest">
                © {new Date().getFullYear()} KABLLIX System Management. Tous droits réservés.
            </div>

            {/* ── Loader overlay 2s après connexion réussie ── */}
            {isRedirecting && (
                <div className="fixed inset-0 bg-[#001d35]/75 backdrop-blur-md flex items-center justify-center z-[200] animate-in fade-in duration-150">
                    <div className="flex flex-col items-center gap-5 bg-white px-10 py-8 rounded-sm shadow-2xl border border-gray-100 max-w-sm w-full mx-4 animate-in zoom-in-95 duration-150">
                        <div className="w-14 h-14 border-4 border-[#001d35]/20 border-t-[#001d35] rounded-full animate-spin"></div>
                        <div className="text-center">
                            <p className="text-gray-900 font-bold text-base">
                                Connexion réussie !
                            </p>
                            <p className="text-gray-500 text-xs mt-1 font-medium">
                                Préparation de votre tableau de bord...
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Login;
