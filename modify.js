const fs = require('fs');
let content = fs.readFileSync('src/components/ProductModal.jsx', 'utf8');

// 1. Remove state variables
content = content.replace("    const [step, setStep] = useState(product ? 3 : 1);\n", "");
content = content.replace("    const [selectedFamily, setSelectedFamily] = useState('');\n", "");
content = content.replace('    const [taxonomySearch, setTaxonomySearch] = useState("");\n', "");

// 2. Remove renderStep1 and renderStep2
content = content.replace(/    const renderStep1 = \(\) => \{[\s\S]*?    const renderStep2 = \(\) => \{[\s\S]*?        \);\n    };\n/, "");

// 3. Update the header
const oldHeader = `                <div className="flex justify-between items-center p-6 border-b border-gray-100 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        {step > 1 && !product && (
                            <button type="button" onClick={() => setStep(step - 1)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                        )}
                        <h2 className="text-xl font-bold text-gray-900">
                            {product ? 'Modifier le produit' : (step === 1 ? 'Nouveau produit (1/3)' : step === 2 ? 'Catégorie (2/3)' : 'Détails du produit (3/3)')}
                        </h2>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="overflow-y-auto w-full">
                    {step === 1 && renderStep1()}
                    {step === 2 && renderStep2()}
                    {step === 3 && (
                        <form onSubmit={handleSubmit} className="p-6 space-y-6">`;

const newHeader = `                <div className="flex justify-between items-center p-6 border-b border-gray-100 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <h2 className="text-xl font-bold text-gray-900">
                            {product ? 'Modifier le produit' : 'Nouveau produit'}
                        </h2>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="overflow-y-auto w-full">
                        <form onSubmit={handleSubmit} className="p-6 space-y-6">`;

content = content.replace(oldHeader, newHeader);

// 4. Update the category field
const oldCat = `                                {/* ── Catégorie ── */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie / Type</label>
                                    <p className="text-xs text-gray-500 mb-2">Automatiquement définie par l'assistant</p>
                                    <div className="w-full px-4 py-2 border border-green-200 bg-green-50 text-green-800 rounded-lg font-medium">
                                        {formData.category || 'Non spécifiée'}
                                    </div>
                                </div>`;

const newCat = `                                {/* ── Catégorie ── */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie / Type</label>
                                    <p className="text-xs text-gray-500 mb-2">Ex: Plomberie, Électricité</p>
                                    <input
                                        type="text"
                                        name="category"
                                        required
                                        value={formData.category}
                                        onChange={handleChange}
                                        list="category-list"
                                        className="w-full px-4 py-2 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                                        placeholder="Ex: Peinture"
                                    />
                                    <datalist id="category-list">
                                        {[...new Set(products.map(p => p.category))].map(cat => (
                                            <option key={cat} value={cat} />
                                        ))}
                                    </datalist>
                                </div>`;

content = content.replace(oldCat, newCat);

// 5. Remove the closing brace of step 3
content = content.replace(`                            </div>\n                        </form>\n                    )}\n                </div>`, `                            </div>\n                        </form>\n                </div>`);

fs.writeFileSync('src/components/ProductModal.jsx', content);
