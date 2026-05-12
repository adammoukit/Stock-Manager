import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Lock, Mail, ArrowRight, User, Phone, Store, MapPin, ChevronLeft } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';

const Register = () => {
    const [step, setStep] = useState(1); // Étape 1 : Info boutique | Étape 2 : Info Admin
    const [isSubmitting, setIsSubmitting] = useState(false);
    const navigate = useNavigate();

    const [form, setForm] = useState({
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

    const handleNextStep = (e) => {
        e.preventDefault();
        if (!form.storeName || !form.phone) {
            toast.error("Le nom de la boutique et le téléphone sont obligatoires.");
            return;
        }
        setStep(2);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (form.password !== form.confirmPassword) {
            toast.error("Les mots de passe ne correspondent pas.");
            return;
        }
        setIsSubmitting(true);
        try {
            const response = await fetch('http://localhost:8080/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    storeName: form.storeName,
                    storeAddress: form.storeAddress,
                    phone: form.phone,
                    firstName: form.firstName,
                    lastName: form.lastName,
                    email: form.email,
                    password: form.password
                })
            });

            if (!response.ok) {
                throw new Error("Erreur lors de la création du compte. L'email est peut-être déjà utilisé.");
            }

            toast.success("Votre quincaillerie a été créée avec succès !");
            navigate('/login');
        } catch (error) {
            toast.error(error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#e8eef4] flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-sm shadow-xl overflow-hidden flex flex-col">

                {/* Header */}
                <div className="bg-[#1c398e] p-6 text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full bg-black/10 z-0"></div>
                    <div className="relative z-10 flex flex-col items-center gap-2">
                        <div className="flex items-center gap-3">
                            <img src="/kabllix-logo-white.svg" alt="Kabllix" className="h-8 w-8" />
                            <img src="/kabllix-logo.svg" alt="Kabllix" className="h-5 brightness-0 invert" />
                        </div>
                        <p className="text-white font-bold text-sm mt-1">Créer votre Espace Kabllix</p>
                        
                        {/* Indicateur d'étapes */}
                        <div className="flex items-center gap-2 mt-2">
                            <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold border-2 transition-all ${step >= 1 ? 'bg-white text-[#1c398e] border-white' : 'border-white/50 text-white/50'}`}>1</div>
                            <div className={`w-12 h-0.5 transition-all ${step >= 2 ? 'bg-white' : 'bg-white/30'}`}></div>
                            <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold border-2 transition-all ${step >= 2 ? 'bg-white text-[#1c398e] border-white' : 'border-white/50 text-white/50'}`}>2</div>
                        </div>
                        <p className="text-blue-100 text-xs tracking-wider uppercase font-medium">
                            {step === 1 ? 'Votre Boutique' : 'Votre Compte Admin'}
                        </p>
                    </div>
                </div>

                {/* Étape 1 : Informations de la boutique */}
                {step === 1 && (
                    <form onSubmit={handleNextStep} className="p-8 space-y-5">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1.5">Nom de la Boutique *</label>
                            <div className="relative">
                                <Store className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                                <input name="storeName" value={form.storeName} onChange={handleChange}
                                    className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-sm focus:ring-2 focus:ring-[#1c398e] focus:border-[#1c398e] transition-all bg-gray-50 focus:bg-white text-gray-900 font-medium"
                                    placeholder="Ex: Quincaillerie La Prospérité" required />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1.5">Numéro de Téléphone *</label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                                <input name="phone" value={form.phone} onChange={handleChange} type="tel"
                                    className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-sm focus:ring-2 focus:ring-[#1c398e] focus:border-[#1c398e] transition-all bg-gray-50 focus:bg-white text-gray-900 font-medium"
                                    placeholder="+228 90 00 00 00" required />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1.5">Adresse de la Boutique</label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                                <textarea name="storeAddress" value={form.storeAddress} onChange={handleChange} rows={2}
                                    className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-sm focus:ring-2 focus:ring-[#1c398e] focus:border-[#1c398e] transition-all bg-gray-50 focus:bg-white text-gray-900 font-medium resize-none"
                                    placeholder="Ex: Rue du Commerce, Lomé, Togo" />
                            </div>
                        </div>

                        <button type="submit"
                            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-sm text-sm font-bold text-white bg-[#1c398e] hover:bg-blue-800 transition-colors cursor-pointer">
                            Étape suivante <ArrowRight className="w-4 h-4" />
                        </button>
                    </form>
                )}

                {/* Étape 2 : Informations du compte Admin */}
                {step === 2 && (
                    <form onSubmit={handleSubmit} className="p-8 space-y-4">
                        <button type="button" onClick={() => setStep(1)}
                            className="flex items-center gap-1 text-sm text-gray-500 hover:text-[#1c398e] transition-colors mb-2 cursor-pointer">
                            <ChevronLeft className="w-4 h-4" /> Retour
                        </button>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1.5">Prénom *</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <input name="firstName" value={form.firstName} onChange={handleChange}
                                        className="block w-full pl-9 pr-2 py-2.5 border border-gray-300 rounded-sm focus:ring-2 focus:ring-[#1c398e] focus:border-[#1c398e] transition-all bg-gray-50 focus:bg-white text-gray-900 font-medium"
                                        placeholder="Koffi" required />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1.5">Nom *</label>
                                <input name="lastName" value={form.lastName} onChange={handleChange}
                                    className="block w-full px-3 py-2.5 border border-gray-300 rounded-sm focus:ring-2 focus:ring-[#1c398e] focus:border-[#1c398e] transition-all bg-gray-50 focus:bg-white text-gray-900 font-medium"
                                    placeholder="Amégah" required />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1.5">Adresse E-mail *</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                                <input name="email" value={form.email} onChange={handleChange} type="email"
                                    className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-sm focus:ring-2 focus:ring-[#1c398e] focus:border-[#1c398e] transition-all bg-gray-50 focus:bg-white text-gray-900 font-medium"
                                    placeholder="admin@maboutique.com" required />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1.5">Mot de passe *</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                                <input name="password" value={form.password} onChange={handleChange} type="password"
                                    className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-sm focus:ring-2 focus:ring-[#1c398e] focus:border-[#1c398e] transition-all bg-gray-50 focus:bg-white text-gray-900 font-medium"
                                    placeholder="Minimum 8 caractères" required minLength={8} />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1.5">Confirmer le mot de passe *</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                                <input name="confirmPassword" value={form.confirmPassword} onChange={handleChange} type="password"
                                    className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-sm focus:ring-2 focus:ring-[#1c398e] focus:border-[#1c398e] transition-all bg-gray-50 focus:bg-white text-gray-900 font-medium"
                                    placeholder="••••••••" required />
                            </div>
                        </div>

                        <button type="submit" disabled={isSubmitting}
                            className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-sm text-sm font-bold text-white bg-[#1c398e] hover:bg-blue-800 transition-colors ${isSubmitting ? 'opacity-75 cursor-wait' : 'cursor-pointer'}`}>
                            {isSubmitting ? 'Création en cours...' : 'Créer ma Quincaillerie'}
                            {!isSubmitting && <ArrowRight className="w-4 h-4" />}
                        </button>
                    </form>
                )}

                {/* Footer */}
                <div className="bg-gray-50 p-4 border-t border-gray-100 text-center">
                    <p className="text-sm text-gray-600">
                        Déjà un compte ?{' '}
                        <Link to="/login" className="font-bold text-[#1c398e] hover:underline">
                            Se connecter
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Register;
