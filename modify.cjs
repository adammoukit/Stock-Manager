const fs = require('fs');
let content = fs.readFileSync('src/components/ProductModal.jsx', 'utf8');

const regex = /\{\/\* ══ Modèles de Déconditionnement ══ \*\/\}[\s\S]*?\{formData.hasSubUnit && \([\s\S]*?                                \)\}/;

const newContent = `                                {/* ══ Modèles de Déconditionnement ══ */}
                                {formData.hasSubUnit && (
                                    <div className="col-span-2">
                                        <div className="flex items-center justify-between mb-3 pt-3 border-t">
                                            <div>
                                                <h4 className="font-semibold text-gray-800 text-sm">📦 Créer des options de Vente Fractionnée</h4>
                                                <p className="text-xs text-gray-500 mt-0.5">
                                                    Définissez vos propres quantités et prix (ex: 5 kilos à 750F).
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const newId = 'custom_' + Date.now();
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        packagings: [...prev.packagings, { modelId: newId, name: '', targetQty: '', price: '', deductionRatio: 0 }]
                                                    }));
                                                }}
                                                className="text-xs bg-primary-50 text-primary-700 px-3 py-1.5 rounded hover:bg-primary-100 transition-colors font-bold"
                                            >
                                                + Ajouter une option
                                            </button>
                                        </div>

                                        <div className="space-y-3">
                                            {formData.packagings.length === 0 && (
                                                <div className="p-6 text-center bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                                    <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                                                    <p className="text-sm text-gray-500">Aucune option créée. Cliquez sur Ajouter.</p>
                                                </div>
                                            )}
                                            {formData.packagings.map((pkg, idx) => (
                                                <div key={pkg.modelId} className="border border-primary-200 bg-white rounded-lg p-4 relative">
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormData(prev => ({
                                                            ...prev,
                                                            packagings: prev.packagings.filter(p => p.modelId !== pkg.modelId)
                                                        }))}
                                                        className="absolute top-2 right-2 text-gray-400 hover:text-red-500"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                        <div>
                                                            <label className="text-[11px] font-bold text-gray-600 mb-1 block uppercase tracking-tight">Nom (ex: 5 Kilos)</label>
                                                            <input
                                                                type="text"
                                                                value={pkg.name}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    setFormData(prev => ({
                                                                        ...prev,
                                                                        packagings: prev.packagings.map(p => p.modelId === pkg.modelId ? { ...p, name: val } : p)
                                                                    }));
                                                                }}
                                                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                                                                placeholder="Ex: 5 Kilos"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-[11px] font-bold text-gray-600 mb-1 block uppercase tracking-tight">Quantité vendue</label>
                                                            <input
                                                                type="number"
                                                                min="0.0001"
                                                                step="any"
                                                                value={pkg.targetQty}
                                                                onChange={(e) => {
                                                                    const val = parseFloat(e.target.value) || 0;
                                                                    const factor = parseFloat(formData.conversionFactor) || 1;
                                                                    setFormData(prev => ({
                                                                        ...prev,
                                                                        packagings: prev.packagings.map(p => p.modelId === pkg.modelId ? { ...p, targetQty: e.target.value, deductionRatio: val / factor } : p)
                                                                    }));
                                                                }}
                                                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                                                                placeholder="Ex: 5"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-[11px] font-bold text-gray-600 mb-1 block uppercase tracking-tight">Prix (FCFA)</label>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={pkg.price}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    setFormData(prev => ({
                                                                        ...prev,
                                                                        packagings: prev.packagings.map(p => p.modelId === pkg.modelId ? { ...p, price: val } : p)
                                                                    }));
                                                                }}
                                                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 font-bold text-primary-700"
                                                                placeholder="Ex: 750"
                                                            />
                                                        </div>
                                                    </div>
                                                    {pkg.deductionRatio > 0 && (
                                                        <div className="mt-3 p-2 bg-amber-50 rounded border border-amber-100 flex items-center gap-2">
                                                            <Info className="w-3 h-3 text-amber-600" />
                                                            <span className="text-[10px] text-amber-700">
                                                                Intelligence : Cette option retirera <b>{parseFloat(pkg.deductionRatio).toFixed(3)} {formData.unit}</b> du stock.
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}`;

content = content.replace(regex, newContent);
fs.writeFileSync('src/components/ProductModal.jsx', content);
