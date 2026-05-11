import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { Lock, Mail, ArrowRight, ShieldCheck } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
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
            navigate('/');
        }
        setIsSubmitting(false);
    };

    return (
        <div className="min-h-screen bg-[#e8eef4] flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-sm shadow-xl overflow-hidden flex flex-col">
                {/* Header du Login */}
                <div className="bg-[#018f8f] p-8 text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full bg-black/10 z-0"></div>
                    <div className="relative z-10 flex flex-col items-center">
                        <div className="w-16 h-16 mb-4 flex items-center justify-center">
                            {/* Kabllix Modern SVG Logo */}
                            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-16 h-16 drop-shadow-md">
                                <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="white" />
                                <path d="M2 17L12 22L22 17" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M2 12L12 17L22 12" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                        <h1 className="text-3xl font-extrabold text-white tracking-[0.2em] uppercase">
                            KABLLIX
                        </h1>
                        <p className="text-teal-100 text-xs mt-2 font-bold tracking-widest uppercase opacity-90">System Management</p>
                    </div>
                </div>

                {/* Formulaire */}
                <div className="p-8">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1.5">Adresse E-mail</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Mail className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-sm focus:ring-2 focus:ring-[#018f8f] focus:border-[#018f8f] transition-all bg-gray-50 focus:bg-white text-gray-900 font-medium"
                                    placeholder="admin@kabllix.com"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-1.5">
                                <label className="block text-sm font-bold text-gray-700">Mot de passe</label>
                                <a href="#" className="text-sm font-medium text-[#018f8f] hover:text-teal-700 hover:underline transition-colors">
                                    Mot de passe oublié ?
                                </a>
                            </div>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-sm focus:ring-2 focus:ring-[#018f8f] focus:border-[#018f8f] transition-all bg-gray-50 focus:bg-white text-gray-900 font-medium"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className={`w-full flex items-center justify-center gap-2 py-3 px-4 border border-transparent rounded-sm shadow-sm text-sm font-bold text-white bg-[#018f8f] hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#018f8f] transition-colors ${isSubmitting ? 'opacity-75 cursor-wait' : 'cursor-pointer'}`}
                        >
                            {isSubmitting ? 'Connexion en cours...' : 'Se Connecter'}
                            {!isSubmitting && <ArrowRight className="w-4 h-4" />}
                        </button>
                    </form>
                </div>

                {/* Footer */}
                <div className="bg-gray-50 p-4 border-t border-gray-100 text-center space-y-2">
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                        Système Protégé • Kabllix V3
                    </p>
                    <p className="text-sm text-gray-600">
                        Pas encore de compte ?{' '}
                        <Link to="/register" className="font-bold text-[#018f8f] hover:underline">
                            Créer votre quincaillerie
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
