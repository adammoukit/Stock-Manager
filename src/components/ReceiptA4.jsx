import React, { useRef, useState } from 'react';
import { X, Printer, FileText, PackageOpen, ArrowLeft } from 'lucide-react';
import QRCode from 'react-qr-code';
import { formatPrice, formatRowPrice } from '../utils/currency';
import { useSettings } from '../context/SettingsContext';

const ReceiptA4 = ({ transaction, onClose, onBack, initialDeliverySlip = false }) => {
    const receiptRef = useRef();
    const [isDeliverySlip, setIsDeliverySlip] = useState(initialDeliverySlip);
    const { company } = useSettings();

    const handlePrint = () => {
        const docContent = receiptRef.current?.innerHTML;
        if (!docContent) return;

        const printWindow = window.open('', '_blank', 'width=900,height=700');
        printWindow.document.write(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Facture — ${company.name}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 10pt;
      color: #1a1a1a;
      background: white;
    }
    table { border-collapse: collapse; width: 100%; }
    img { max-width: 100%; }
    @page { size: A4 portrait; margin: 0; }
    @media print {
      body { margin: 0; padding: 0; }
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }
  </style>
</head>
<body>
  <div style="width:210mm;min-height:297mm;padding:15mm 18mm;font-family:'Segoe UI',Arial,sans-serif;font-size:10pt;color:#1a1a1a;background:white;">
    ${docContent}
  </div>
</body>
</html>`);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 400);
    };

    if (!transaction) return null;

    const date = new Date(transaction.date);
    const invoiceNumber = `FAC-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}-${String(transaction.id).padStart(4, '0')}`;

    const getUnitLabel = (item) =>
        item.label?.toUpperCase() || item.unit?.toUpperCase() || 'UNITÉ';

    const subtotal = transaction.items.reduce(
        (sum, item) => sum + (item.isBulk ? item.bulkPrice : item.price) * item.inputQuantity,
        0
    );

    const paymentLabel =
        transaction.paymentMethod === 'cash'
            ? 'Espèces'
            : transaction.paymentMethod === 'credit'
            ? 'Crédit / À terme'
            : 'Carte bancaire';

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 overflow-y-auto">

            {/* ---- Sticky action bar ---- */}
            <div className="a4-action-bar print:hidden sticky top-0 z-10 flex items-center justify-end gap-2 px-4 py-3 bg-black/50 backdrop-blur-md border-b border-white/10">
                {onBack && (
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 text-sm px-4 py-2 bg-white/90 hover:bg-white border border-gray-200 text-gray-600 rounded-sm font-medium shadow transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Retour
                    </button>
                )}
                <button
                    onClick={() => setIsDeliverySlip(!isDeliverySlip)}
                    className="flex items-center gap-2 text-sm px-4 py-2 bg-white/90 hover:bg-white border border-gray-200 text-gray-700 rounded-sm font-medium shadow transition-colors"
                >
                    <PackageOpen className="w-4 h-4" />
                    {isDeliverySlip ? 'Mode Facture' : 'Mode Bon à Enlever'}
                </button>
                <button
                    onClick={handlePrint}
                    className="flex items-center gap-2 text-sm px-4 py-2 bg-[#018f8f] hover:bg-teal-700 text-white rounded-sm font-semibold shadow transition-colors"
                >
                    <Printer className="w-4 h-4" />
                    Imprimer A4
                </button>
                <button
                    onClick={onClose}
                    className="p-2 bg-white/90 hover:bg-white border border-gray-200 text-gray-600 rounded-sm shadow transition-colors"
                    title="Fermer"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* ---- Scrollable A4 document ---- */}
            <div className="flex justify-center py-8 px-4">
                <div
                    ref={receiptRef}
                    className="a4-document bg-white shadow-2xl"
                    style={{
                        width: '210mm',
                        minHeight: '297mm',
                        padding: '15mm 18mm',
                        fontFamily: "'Segoe UI', Arial, sans-serif",
                        fontSize: '10pt',
                        color: '#1a1a1a',
                    }}
                >
                {/* ===== HEADER ===== */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '5mm', borderBottom: '3px solid #018f8f', paddingBottom: '5mm' }}>
                    {/* Company info + document title */}
                    <div style={{ flex: 1 }}>
                        {company.logo && (
                            <img src={company.logo} alt="Logo" style={{ height: '14mm', marginBottom: '3mm', objectFit: 'contain' }} />
                        )}
                        <div style={{ fontSize: '15pt', fontWeight: '800', color: '#018f8f', letterSpacing: '-0.5px', textTransform: 'uppercase' }}>
                            {company.name}
                        </div>
                        <div style={{ fontSize: '8.5pt', color: '#555', marginTop: '1.5mm', lineHeight: '1.6' }}>
                            {company.address && <div>{company.address}</div>}
                            {company.phone && <div>Tél : {company.phone}</div>}
                            {company.email && <div>Email : {company.email}</div>}
                            {company.nif && <div>NIF : {company.nif}</div>}
                        </div>
                    </div>

                    {/* Invoice meta (N°, Date, Heure, Réf.) */}
                    <div style={{ textAlign: 'right', minWidth: '65mm', paddingLeft: '8mm' }}>
                        <div style={{ fontSize: '8.5pt', color: '#444', lineHeight: '2' }}>
                            <div><span style={{ color: '#888' }}>N° :</span> <strong style={{ color: '#018f8f' }}>{invoiceNumber}</strong></div>
                            <div><span style={{ color: '#888' }}>Date :</span> {date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
                            <div><span style={{ color: '#888' }}>Heure :</span> {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
                            <div><span style={{ color: '#888' }}>Réf. :</span> <span style={{ fontFamily: 'monospace' }}>#{transaction.id}</span></div>
                        </div>
                    </div>
                </div>

                {/* Centered Document Title */}
                <div style={{
                    textAlign: 'center',
                    margin: '4mm 0 8mm 0',
                    textTransform: 'uppercase',
                }}>
                    <div style={{
                        fontSize: '16pt',
                        fontWeight: '900',
                        color: '#1a1a1a',
                        letterSpacing: '4px',
                        display: 'inline-block',
                        borderBottom: '2px solid #018f8f',
                        paddingBottom: '1mm',
                        marginBottom: '1mm'
                    }}>
                        {isDeliverySlip ? 'Bon à Enlever' : 'Facture de Vente'}
                    </div>
                    {isDeliverySlip && (
                        <div style={{ fontSize: '7.5pt', color: '#666', fontWeight: 'bold', letterSpacing: '1px' }}>
                            (Document non contractuel — Sans prix)
                        </div>
                    )}
                </div>



                {/* ===== CLIENT INFO ===== */}
                {transaction.customerName && (
                    <div style={{ display: 'flex', gap: '6mm', marginBottom: '6mm' }}>
                        {/* Client block */}
                        <div style={{ flex: 1, backgroundColor: '#f8f9fa', border: '1px solid #e9ecef', borderRadius: '2px', padding: '3mm 4mm' }}>
                            <div style={{ fontSize: '7.5pt', fontWeight: '700', color: '#018f8f', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '1.5mm' }}>
                                Client
                            </div>
                            <div style={{ fontSize: '9pt', color: '#333' }}>
                                {transaction.customerName}
                            </div>
                        </div>
                    </div>
                )}

                {/* ===== ITEMS TABLE ===== */}
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '6mm', fontSize: '9pt' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#018f8f', color: 'white' }}>
                            <th style={{ padding: '3mm 3mm', textAlign: 'left', fontWeight: '700', fontSize: '8pt', width: '40%' }}>
                                DÉSIGNATION
                            </th>
                            {!isDeliverySlip && (
                                <th style={{ padding: '3mm 3mm', textAlign: 'center', fontWeight: '700', fontSize: '8pt', width: '18%' }}>
                                    PRIX UNITAIRE
                                </th>
                            )}
                            <th style={{ padding: '3mm 3mm', textAlign: 'center', fontWeight: '700', fontSize: '8pt', width: '12%' }}>
                                QTÉ
                            </th>
                            <th style={{ padding: '3mm 3mm', textAlign: 'center', fontWeight: '700', fontSize: '8pt', width: '15%' }}>
                                UNITÉ
                            </th>
                            {!isDeliverySlip && (
                                <th style={{ padding: '3mm 3mm', textAlign: 'right', fontWeight: '700', fontSize: '8pt', width: '15%' }}>
                                    MONTANT
                                </th>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {transaction.items.map((item, index) => {
                            const unitPrice = item.isBulk ? item.bulkPrice : item.price;
                            const lineTotal = unitPrice * item.inputQuantity;
                            const isEven = index % 2 === 0;
                            return (
                                <tr key={index} style={{ backgroundColor: isEven ? '#fff' : '#f8fffe', borderBottom: '1px solid #e5e7eb' }}>
                                    <td style={{ padding: '2.5mm 3mm', verticalAlign: 'top' }}>
                                        <div style={{ fontWeight: '600', color: '#1a1a1a' }}>{item.name?.toUpperCase()}</div>
                                        {item.type !== 'base' && (
                                            <div style={{ fontSize: '7.5pt', color: '#888', marginTop: '0.5mm' }}>
                                                ({getUnitLabel(item)})
                                            </div>
                                        )}
                                    </td>
                                    {!isDeliverySlip && (
                                        <td style={{ padding: '2.5mm 3mm', textAlign: 'center', verticalAlign: 'top', color: '#444' }}>
                                            {formatRowPrice(unitPrice)}
                                        </td>
                                    )}
                                    <td style={{ padding: '2.5mm 3mm', textAlign: 'center', verticalAlign: 'top', fontWeight: '700' }}>
                                        {item.inputQuantity}
                                    </td>
                                    <td style={{ padding: '2.5mm 3mm', textAlign: 'center', verticalAlign: 'top', color: '#555', fontSize: '8.5pt' }}>
                                        {getUnitLabel(item)}
                                    </td>
                                    {!isDeliverySlip && (
                                        <td style={{ padding: '2.5mm 3mm', textAlign: 'right', verticalAlign: 'top', fontWeight: '600', color: '#018f8f' }}>
                                            {formatRowPrice(lineTotal)}
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
                        {/* Empty rows to pad short invoices */}
                        {transaction.items.length < 5 && Array.from({ length: 5 - transaction.items.length }).map((_, i) => (
                            <tr key={`empty-${i}`} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                <td style={{ padding: '2.5mm 3mm' }}>&nbsp;</td>
                                {!isDeliverySlip && <td />}
                                <td />
                                <td />
                                {!isDeliverySlip && <td />}
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* ===== TOTALS ===== */}
                {!isDeliverySlip && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8mm' }}>
                        <div style={{ minWidth: '75mm' }}>
                            {/* Subtotal */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1.5mm 3mm', fontSize: '9pt', color: '#555', borderBottom: '1px solid #e5e7eb' }}>
                                <span>Sous-total HT</span>
                                <span style={{ fontWeight: '600' }}>{formatPrice(subtotal)}</span>
                            </div>
                            {/* Tax (if applicable - TVA placeholder) */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1.5mm 3mm', fontSize: '9pt', color: '#555', borderBottom: '1px solid #e5e7eb' }}>
                                <span>TVA (0%)</span>
                                <span>0 FCFA</span>
                            </div>
                            {/* Grand Total */}
                            <div style={{
                                display: 'flex', justifyContent: 'space-between',
                                padding: '3mm 3mm',
                                backgroundColor: '#018f8f',
                                color: 'white',
                                fontWeight: '800',
                                fontSize: '12pt',
                                borderRadius: '2px',
                                marginTop: '1.5mm'
                            }}>
                                <span>TOTAL NET</span>
                                <span>{formatPrice(transaction.total)}</span>
                            </div>

                            {/* Payment mode block */}
                            {!isDeliverySlip && (
                                <div style={{ marginTop: '2mm', backgroundColor: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: '2px', padding: '2mm 3mm' }}>
                                    <div style={{ fontSize: '7pt', fontWeight: '700', color: '#018f8f', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '1mm' }}>
                                        Mode de paiement
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9pt', fontWeight: '600', color: '#333' }}>
                                        <span>{paymentLabel}</span>
                                    </div>
                                    {transaction.paymentMethod === 'credit' && (
                                        <div style={{ fontSize: '8pt', color: '#dc2626', marginTop: '1mm' }}>
                                            ⚠ Montant dû : {formatPrice(transaction.total)}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Cash payment details */}
                            {transaction.paymentMethod === 'cash' && (
                                <div style={{ marginTop: '2mm', fontSize: '8.5pt', color: '#444', lineHeight: '1.8', padding: '0 1mm' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Montant reçu</span>
                                        <span style={{ fontWeight: '600' }}>{formatPrice(transaction.amountGiven || transaction.total)}</span>
                                    </div>
                                    {(transaction.change || 0) > 0 && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a', fontWeight: '700' }}>
                                            <span>Monnaie rendue</span>
                                            <span>{formatPrice(transaction.change)}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ===== DELIVERY SLIP SIGNATURE ZONES ===== */}
                {isDeliverySlip && (
                    <div style={{ display: 'flex', gap: '10mm', marginBottom: '10mm', marginTop: '6mm' }}>
                        {[
                            { label: 'Préparé par', sub: 'Le magasinier' },
                            { label: 'Vérifié par', sub: 'Le gérant' },
                            { label: 'Reçu par', sub: 'Le client' }
                        ].map((zone) => (
                            <div key={zone.label} style={{ flex: 1, border: '1px dashed #ccc', borderRadius: '2px', padding: '3mm', minHeight: '22mm', position: 'relative' }}>
                                <div style={{ fontSize: '7.5pt', fontWeight: '700', color: '#018f8f', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{zone.label}</div>
                                <div style={{ fontSize: '7pt', color: '#aaa', marginTop: '0.5mm' }}>{zone.sub}</div>
                                <div style={{ position: 'absolute', bottom: '2mm', left: '3mm', right: '3mm', borderBottom: '1px solid #ddd', fontSize: '7pt', color: '#bbb', paddingBottom: '1mm' }}>
                                    Signature :
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* ===== FOOTER ===== */}
                <div style={{
                    borderTop: '2px solid #018f8f',
                    paddingTop: '5mm',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-end',
                    marginTop: 'auto'
                }}>
                    {/* QR Code */}
                    <div style={{ textAlign: 'center' }}>
                        <QRCode
                            value={`${company.name}|${invoiceNumber}|${transaction.total}|${date.toISOString()}`}
                            size={55}
                            fgColor="#018f8f"
                        />
                        <div style={{ fontSize: '6pt', color: '#aaa', marginTop: '1mm' }}>Scan pour vérifier</div>
                    </div>

                    {/* Message */}
                    <div style={{ flex: 1, textAlign: 'center', padding: '0 8mm' }}>
                        {!isDeliverySlip && company.receiptMessage && (
                            <div style={{ fontSize: '8pt', color: '#666', fontStyle: 'italic', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                                {company.receiptMessage}
                            </div>
                        )}
                        {isDeliverySlip && (
                            <div style={{ fontSize: '9pt', fontWeight: '700', color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                BON À PRÉSENTER AU MAGASIN
                            </div>
                        )}
                    </div>

                    {/* Company stamp area */}
                    <div style={{
                        width: '35mm', height: '25mm',
                        border: '1px dashed #ccc',
                        borderRadius: '2mm',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                    }}>
                        <span style={{ fontSize: '7pt', color: '#bbb', textAlign: 'center' }}>Cachet &amp;<br />Signature</span>
                    </div>
                </div>

                {/* Page info */}
                <div style={{ textAlign: 'center', marginTop: '4mm', fontSize: '7pt', color: '#ccc' }}>
                    Document généré le {date.toLocaleDateString('fr-FR')} — {company.name} — {invoiceNumber}
                </div>
                </div> {/* end a4-document */}
            </div> {/* end flex justify-center wrapper */}

            {/* ===== PRINT STYLES ===== */}
            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    .a4-document, .a4-document * { visibility: visible !important; }
                    .a4-action-bar { display: none !important; }
                    .fixed { position: static !important; }
                    .a4-document {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 210mm !important;
                        min-height: 297mm !important;
                        max-height: none !important;
                        overflow: visible !important;
                        margin: 0 !important;
                        padding: 15mm 18mm !important;
                        box-shadow: none !important;
                        background: white !important;
                    }
                    @page {
                        size: A4 portrait;
                        margin: 0;
                    }
                    body {
                        margin: 0;
                        padding: 0;
                        background: white;
                    }
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                }
            `}</style>
        </div> 
    );
};

export default ReceiptA4;
