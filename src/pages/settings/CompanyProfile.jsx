import React, { useState } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { Save, Store, CreditCard, Building2, Phone, Mail, FileText, CheckCircle2, MapPin, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

const CompanyProfile = () => {
    const { company, setCompany, subscription, stores, setStores, currentStoreId } = useSettings();
    const activeStore = stores.find(s => s.id === currentStoreId);
    const [formData, setFormData] = useState({
        ...company,
        // Le nom de la boutique active devient le "Nom de l'entreprise"
        name: activeStore?.name || company.name
    });
    const [isLoading, setIsLoading] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleLogoUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            // Optional basic size validation (e.g. max 2MB)
            if (file.size > 2 * 1024 * 1024) {
                toast.error("L'image est trop volumineuse (max 2MB)");
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData(prev => ({ ...prev, logo: reader.result }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = () => {
        setIsLoading(true);
        setTimeout(() => {
            // Mettre à jour les infos générales de l'entreprise
            setCompany(formData);
            // Synchroniser le nom avec la boutique active dans le sélecteur du Header
            setStores(prev => prev.map(s =>
                s.id === currentStoreId ? { ...s, name: formData.name } : s
            ));
            toast.success("Paramètres enregistrés ! Le sélecteur de boutique a été mis à jour.");
            setIsLoading(false);
        }, 1500);
    };

    return (
        <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-[#018f8f] tracking-tight">Mon Entreprise</h2>
                    <p className="text-gray-500 text-sm mt-1 font-medium">Gérez les informations de votre entreprise et vos abonnements</p>
                </div>
                <button 
                    onClick={handleSave}
                    className="flex items-center gap-2 bg-[#018f8f] text-white px-4 py-2 rounded-sm hover:bg-teal-700 transition-colors shadow-md font-medium"
                >
                    <Save className="w-5 h-5" />
                    Enregistrer les modifications
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Colonne Gauche: Abonnement et Logo */}
                <div className="space-y-6">
                    {/* Carte Abonnement */}
                    <div className="bg-white p-3 rounded-sm border-2 border-gray-300 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-teal-50 rounded-bl-full -z-0" />
                        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2 relative z-10">
                            <CreditCard className="w-5 h-5 text-[#018f8f]" />
                            Abonnement & Licences
                        </h2>
                        
                        <div className="space-y-4 relative z-10">
                            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-sm">
                                <span className="text-sm text-gray-600">Plan actuel</span>
                                <span className="font-bold text-[#018f8f] bg-teal-50 px-3 py-1 rounded-full text-sm">
                                    {subscription.planName}
                                </span>
                            </div>
                            
                            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-sm">
                                <span className="text-sm text-gray-600">Boutiques actives</span>
                                <span className="font-bold text-gray-800">
                                    {stores.length} / {subscription.maxStores === 999 ? '∞' : subscription.maxStores}
                                </span>
                            </div>

                            <div className="pt-2">
                                <p className="text-xs text-gray-500 mb-2">Options de facturation (Mensuel) :</p>
                                <ul className="text-xs space-y-1.5 text-gray-600">
                                    <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-green-500"/> 1 Boutique : 12 500 FCFA</li>
                                    <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-green-500"/> 2 Boutiques : 20 000 FCFA</li>
                                    <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-[#018f8f]"/> Illimité : 32 000 FCFA</li>
                                </ul>
                            </div>

                            <button className="w-full mt-2 py-2 text-sm font-medium text-[#018f8f] border border-[#018f8f] rounded-sm hover:bg-teal-50 transition-colors">
                                Gérer mon abonnement
                            </button>
                        </div>
                    </div>

                    {/* Carte Boutique Active */}
                    <div className="bg-white p-3 rounded-sm border-2 border-gray-300 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-amber-50 rounded-bl-full -z-0" />
                        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2 relative z-10">
                            <MapPin className="w-5 h-5 text-amber-500" />
                            Boutique Active
                        </h2>

                        <div className="space-y-3 relative z-10">
                            {stores.map(store => {
                                const isActive = store.id === currentStoreId;
                                return (
                                    <div
                                        key={store.id}
                                        className={`flex items-start gap-3 p-3 rounded-sm border transition-all ${
                                            isActive
                                                ? 'bg-teal-50 border-[#018f8f]/30'
                                                : 'bg-gray-50 border-gray-100 opacity-60'
                                        }`}
                                    >
                                        <div className={`mt-0.5 w-8 h-8 rounded-sm flex items-center justify-center flex-shrink-0 ${
                                            isActive ? 'bg-[#018f8f] text-white' : 'bg-gray-200 text-gray-500'
                                        }`}>
                                            <Store className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm font-bold truncate ${isActive ? 'text-[#018f8f]' : 'text-gray-600'}`}>
                                                {store.name}
                                            </p>
                                            <p className="text-xs text-gray-400 truncate mt-0.5">{store.address}</p>
                                        </div>
                                        {isActive && (
                                            <span className="flex-shrink-0 text-[10px] font-bold bg-[#018f8f] text-white px-2 py-0.5 rounded-full">
                                                Actif
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Carte Logo */}
                    <div className="bg-white p-3 rounded-sm border-2 border-gray-300 shadow-sm text-center">
                        <label className="w-32 h-32 mx-auto bg-gray-100 rounded-sm border-2 border-dashed border-gray-300 flex items-center justify-center mb-4 overflow-hidden relative group cursor-pointer hover:border-[#018f8f] transition-colors">
                            <input type="file" accept="image/png, image/jpeg" className="hidden" onChange={handleLogoUpload} />
                            {formData.logo ? (
                                <img src={formData.logo} alt="Logo" className="w-full h-full object-contain bg-white" />
                            ) : (
                                <div className="text-gray-400 flex flex-col items-center group-hover:text-[#018f8f] transition-colors">
                                    <Store className="w-8 h-8 mb-2" />
                                    <span className="text-xs font-medium">Ajouter un Logo</span>
                                </div>
                            )}
                        </label>
                        <p className="text-xs text-gray-500 mb-2">Format recommandé : PNG ou JPG (Max 2MB). Ce logo apparaîtra sur vos factures et tickets.</p>
                        {formData.logo && (
                            <button 
                                onClick={() => setFormData(prev => ({ ...prev, logo: '' }))}
                                className="text-xs text-red-500 hover:text-red-700 font-semibold transition-colors"
                            >
                                Supprimer le logo actuel
                            </button>
                        )}
                    </div>
                </div>

                {/* Colonne Droite: Informations Générales */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white p-3 rounded-sm border-2 border-gray-300 shadow-sm">
                        <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                            <Building2 className="w-5 h-5 text-[#018f8f]" />
                            Informations Légales & Contact
                        </h2>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            <div className="space-y-3">
                                <label className="text-sm font-medium text-gray-700">
                                    Nom de la boutique / Raison sociale
                                </label>
                                <input 
                                    type="text" 
                                    name="name"
                                    value={formData.name} 
                                    onChange={handleChange}
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-sm focus:ring-2 focus:ring-[#018f8f] focus:border-transparent outline-none transition-all"
                                />
                            </div>
                            
                            <div className="space-y-3">
                                <label className="text-sm font-medium text-gray-700">NIF / Numéro de Registre</label>
                                <input 
                                    type="text" 
                                    name="nif"
                                    value={formData.nif} 
                                    onChange={handleChange}
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-sm focus:ring-2 focus:ring-[#018f8f] focus:border-transparent outline-none transition-all"
                                />
                            </div>

                            <div className="space-y-3">
                                <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                                    <Phone className="w-4 h-4 text-gray-400" /> Téléphone Principal
                                </label>
                                <input 
                                    type="text" 
                                    name="phone"
                                    value={formData.phone} 
                                    onChange={handleChange}
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-sm focus:ring-2 focus:ring-[#018f8f] focus:border-transparent outline-none transition-all"
                                />
                            </div>

                            <div className="space-y-3">
                                <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                                    <Mail className="w-4 h-4 text-gray-400" /> Email de Contact
                                </label>
                                <input 
                                    type="email" 
                                    name="email"
                                    value={formData.email} 
                                    onChange={handleChange}
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-sm focus:ring-2 focus:ring-[#018f8f] focus:border-transparent outline-none transition-all"
                                />
                            </div>

                            <div className="col-span-1 md:col-span-2 space-y-3">
                                <label className="text-sm font-medium text-gray-700">Adresse Complète</label>
                                <textarea 
                                    name="address"
                                    value={formData.address} 
                                    onChange={handleChange}
                                    rows="2"
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-sm focus:ring-2 focus:ring-[#018f8f] focus:border-transparent outline-none transition-all resize-none"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-3 rounded-sm border-2 border-gray-300 shadow-sm">
                        <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-[#018f8f]" />
                            Paramètres d'Impression (Tickets & Factures)
                        </h2>
                        
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-gray-700">Message de pied de page (Ex: Conditions de retour)</label>
                                <textarea 
                                    name="receiptMessage"
                                    value={formData.receiptMessage} 
                                    onChange={handleChange}
                                    rows="3"
                                    placeholder="Merci de votre visite !"
                                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-sm focus:ring-2 focus:ring-[#018f8f] focus:border-transparent outline-none transition-all resize-none text-sm"
                                />
                                <p className="text-xs text-gray-500 mt-1">Ce texte sera imprimé automatiquement en bas de tous vos tickets de caisse et devis.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Full-screen Loader */}
            {isLoading && (
                <div className="fixed inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center z-[100] animate-in fade-in duration-200">
                    <div className="flex flex-col items-center gap-4 bg-white p-8 rounded-sm shadow-xl">
                        <div className="w-12 h-12 border-4 border-[#018f8f]/20 border-t-[#018f8f] rounded-full animate-spin"></div>
                        <p className="text-gray-700 font-medium animate-pulse">Enregistrement en cours...</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CompanyProfile;
