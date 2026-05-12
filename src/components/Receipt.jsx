import React, { useRef, useState } from "react";
import {
  X,
  Printer,
  PackageOpen,
  Receipt as ReceiptIcon,
  FileText,
  ArrowLeft,
} from "lucide-react";
import QRCode from "react-qr-code";
import { formatPrice, formatRowPrice } from "../utils/currency";
import { useSettings } from "../context/SettingsContext";
import ReceiptA4 from "./ReceiptA4";
import PrintOptionsDialog from "./PrintOptionsDialog";

const Receipt = ({ transaction, onClose }) => {
  const receiptRef = useRef();
  // null = dialog, 'thermal' | 'a4-invoice' | 'a4-delivery' = chosen format
  const [selectedFormat, setSelectedFormat] = useState(null);
  const { company } = useSettings();

  const handlePrint = () => window.print();

  if (!transaction) return null;

  // ── Step 1: show the print options dialog ─────────────────────────────────
  if (selectedFormat === null) {
    return (
      <PrintOptionsDialog
        transaction={transaction}
        onSelect={(format) => setSelectedFormat(format)}
        onClose={onClose}
      />
    );
  }

  // ── Step 2a: A4 invoice or delivery slip ──────────────────────────────────
  if (selectedFormat === "a4-invoice" || selectedFormat === "a4-delivery") {
    return (
      <ReceiptA4
        transaction={transaction}
        initialDeliverySlip={selectedFormat === "a4-delivery"}
        onBack={() => setSelectedFormat(null)}
        onClose={onClose}
      />
    );
  }

  // ── Step 2b: 80mm thermal receipt ─────────────────────────────────────────
  const getUnitLabel = (item) =>
    item.label?.toUpperCase() || item.unit?.toUpperCase() || "UNITÉ";

  const date = new Date(transaction.date);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-sm shadow-2xl max-w-md w-full max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex justify-between items-center print:hidden">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedFormat(null)}
              className="p-1.5 hover:bg-gray-100 rounded-sm transition-colors text-gray-400"
              title="Changer de format"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <ReceiptIcon className="w-6 h-6 text-primary-600" />
              Reçu Thermique 80mm
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-sm transition-colors text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Receipt Content - Optimized for 80mm thermal printer */}
        <div ref={receiptRef} className="receipt-content p-4">
          {/* Header */}
          <div className="text-center border-b border-dashed border-gray-400 pb-3 mb-3">
            {company.logo && (
              <img
                src={company.logo}
                alt="Logo"
                className="h-12 mx-auto mb-2 grayscale"
              />
            )}
            <h1 className="text-xl font-bold uppercase">{company.name}</h1>
            <p className="text-xs mt-1 font-medium">{company.address}</p>
            <p className="text-[11px] mt-1">NIF: {company.nif}</p>
            <p className="text-[11px]">Tel: {company.phone}</p>
            {company.email && <p className="text-[11px]">{company.email}</p>}
          </div>

          {/* Transaction Info */}
          <div className="text-xs space-y-1 mb-3">
            <div className="flex justify-between">
              <span>No Transaction:</span>
              <span className="font-mono font-bold">#{transaction.id}</span>
            </div>
            <div className="flex justify-between">
              <span>Date:</span>
              <span>{date.toLocaleDateString("fr-FR")}</span>
            </div>
            <div className="flex justify-between">
              <span>Heure:</span>
              <span>{date.toLocaleTimeString("fr-FR")}</span>
            </div>
          </div>

          {/* Items */}
          <div className="border-t border-b border-dashed border-gray-400 py-2 mb-3">
            <table className="w-full text-xs table-fixed">
              <thead>
                <tr className="border-b border-gray-300">
                  <th className="text-left pb-1 w-[45%]">Article</th>
                  <th className="text-center pb-1 w-[15%]">Qte</th>
                  <th className="text-right pb-1 w-[20%]">P.U.</th>
                  <th className="text-right pb-1 w-[20%]">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transaction.items.map((item, index) => (
                  <tr key={index}>
                    <td className="py-2 pr-1 font-medium break-words align-top">
                      {item.name?.toUpperCase()}
                      {item.type !== "base" && (
                        <span className="text-[10px] text-gray-500 block">
                          ({getUnitLabel(item)})
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-center align-top font-bold">
                      {item.inputQuantity}
                    </td>
                    <td className="py-2 text-right align-top">
                      {formatRowPrice(
                        item.isBulk ? item.bulkPrice : item.price,
                      )}
                    </td>
                    <td className="py-2 text-right font-medium align-top">
                      {formatRowPrice(
                        (item.isBulk ? item.bulkPrice : item.price) *
                          item.inputQuantity,
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Payment Details */}
          <div className="space-y-1 text-xs mb-3">
            <div className="flex justify-between font-bold text-base">
              <span>TOTAL:</span>
              <span>{formatPrice(transaction.total)}</span>
            </div>
            <div className="flex justify-between">
              <span>Mode paiement:</span>
              <span className="uppercase">
                {transaction.paymentMethod === "cash"
                  ? "ESPÈCES"
                  : transaction.paymentMethod === "credit"
                    ? "CRÉDIT"
                    : "CARTE"}
              </span>
            </div>
            {transaction.paymentMethod === "cash" && (
              <>
                <div className="flex justify-between">
                  <span>Montant recu:</span>
                  <span>
                    {formatPrice(transaction.amountGiven || transaction.total)}
                  </span>
                </div>
                {transaction.change > 0 && (
                  <div className="flex justify-between font-bold">
                    <span>MONNAIE:</span>
                    <span>{formatPrice(transaction.change)}</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="text-center pt-3 border-t border-dashed border-gray-400 text-xs">
            <div className="space-y-1">
              <p className="font-medium whitespace-pre-wrap">
                {company.receiptMessage}
              </p>
            </div>
          </div>

          {/* Barcode placeholder */}
          <div className="text-center mt-3 print:block hidden">
            <div className="font-mono text-xs">*{transaction.id}*</div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-gray-200 flex gap-3 print:hidden">
          <button
            onClick={handlePrint}
            className="flex-1 text-white px-4 py-2 rounded-sm flex items-center justify-center gap-2 transition-colors font-semibold"
            style={{ backgroundColor: "#018f8f" }}
          >
            <Printer className="w-5 h-5" />
            Imprimer
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-sm transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>

      {/* Thermal Printer Optimized Print Styles */}
      <style>{`
                @media print {
                    body * { visibility: hidden; }
                    .receipt-content, .receipt-content * { visibility: visible; }
                    .fixed { position: static !important; }
                    .receipt-content {
                        position: absolute;
                        left: 0; top: 0;
                        width: 80mm;
                        margin: 0;
                        padding: 5mm;
                        background: white;
                        font-family: 'Courier New', monospace;
                        font-size: 10pt;
                        line-height: 1.3;
                    }
                    @page { size: 80mm auto; margin: 0; }
                    body { margin: 0; padding: 0; }
                    .print\\:hidden { display: none !important; }
                    .print\\:block  { display: block  !important; }
                    * { color: #000 !important; background: transparent !important; box-shadow: none !important; }
                    .border-b, .border-t { border-color: #000 !important; }
                    table { width: 100%; }
                }
            `}</style>
    </div>
  );
};

export default Receipt;
