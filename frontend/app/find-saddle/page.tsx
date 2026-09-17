'use client';

import { useState, useCallback } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { fetchOrderDetail, type OrderDetailData } from '@/services/enrichedOrders';
import { baseOptionName } from '@/utils/optionSlots';
import { generateOrderPDF } from '@/lib/generate-pdf';
import { logger } from '@/utils/logger';

// Option group mapping matching production layout
const optionGroups: Record<string, string> = {
  'Seat Size': '',
  'Tree Size': '',
  'Billets': '',
  'Outer Reinforcement (Wear Strip)': '',
  'Stirrup Bars': 'SEAT',
  'Seat Leather': 'SEAT',
  'SEAT Option': 'SEAT',
  'Skirt': 'SEAT',
  'Welt Color': 'SEAT',
  'CANTLE Option': 'CANTLE',
  'Flap Length': 'FLAPS',
  'Knee Roll': 'FLAPS',
  'Knee Roll/ Pad Leather': 'FLAPS',
  'Flap Leather': 'FLAPS',
  'Loops': 'FLAPS',
  'Facing - Front (on FLAPS for NON Mono)': 'FLAPS',
  'Stitch Color': 'FLAPS',
  'Front Gusset': 'PANEL',
  'Rear Gusset': 'PANEL',
  'Gusset Leather': 'PANEL',
  'Panel Material': 'PANEL',
  'Panel Leather': 'PANEL',
  'Facing - Back/Rear': 'PANEL',
  'Gullet Lining': 'PANEL',
};

function formatOrderDate(orderTime: string | null): string {
  if (!orderTime) return '-';
  try {
    const date = new Date(orderTime);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return orderTime;
  }
}

export default function FindSaddlePage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [orderData, setOrderData] = useState<OrderDetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(async () => {
    const term = searchTerm.trim();
    if (!term) {
      setOrderData(null);
      setError(null);
      return;
    }

    const orderId = parseInt(term, 10);
    if (isNaN(orderId)) {
      setError('Please enter a valid order number');
      setOrderData(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetchOrderDetail(orderId);
      if (result) {
        setOrderData(result);
      } else {
        setOrderData(null);
        setError('No order found with that number');
      }
    } catch (err) {
      setError('Error searching for order. Please try again.');
      setOrderData(null);
      logger.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handlePrint = () => {
    if (!orderData) return;

    const saddleModel = `${orderData.brandName || ''} ${orderData.modelName || ''}`.trim();
    const saddleLeatherType = orderData.leatherName || '';
    const saddleSpecs = orderData.saddleSpecs || [];

    const saddleDataForPdf: Record<string, string> = {
      model: saddleModel,
      leatherType: saddleLeatherType,
    };
    for (const spec of saddleSpecs) {
      saddleDataForPdf[spec.optionName] = spec.displayValue || '';
    }

    const orderDataForPdf = {
      orderId: orderData.orderId,
      saddle: saddleDataForPdf,
      saddleSpecs,
      fitter: {
        fullName: orderData.fitterName || '-',
        email: orderData.fitterEmail || '-',
      },
      customer: {
        name: orderData.customerName || orderData.orderName || '-',
        address: orderData.customerAddress || orderData.orderAddress || '',
        city: orderData.customerCity || orderData.orderCity || '',
        zipcode: orderData.customerZipcode || orderData.orderZipcode || '',
        country: orderData.customerCountry || orderData.orderCountry || '',
        email: orderData.customerEmail || orderData.orderEmail || '-',
      },
      price: {
        saddlePrice: Number(orderData.priceSaddle) || 0,
        tradeIn: Number(orderData.priceTradein) || 0,
        deposit: Number(orderData.priceDeposit) || 0,
        discount: Number(orderData.priceDiscount) || 0,
        fittingEval: Number(orderData.priceFittingeval) || 0,
        callFee: Number(orderData.priceCallfee) || 0,
        girth: Number(orderData.priceGirth) || 0,
        additional: Number(orderData.priceAdditional) || 0,
        shipping: Number(orderData.priceShipping) || 0,
        tax: Number(orderData.priceTax) || 0,
        total: Number(orderData.totalPrice) || 0,
      },
      notes: orderData.specialNotes || '',
      serialno: orderData.serialNumber || '',
      orderDate: formatOrderDate(orderData.orderTime),
      orderStatus: orderData.orderStatus || '',
      currency: orderData.currency || 'USD',
      history: [],
    };

    const doc = generateOrderPDF(orderDataForPdf);
    doc.save(`saddle-info-${orderData.orderId}.pdf`);
  };

  // Separate specs into ungrouped and grouped
  const saddleSpecs = orderData?.saddleSpecs || [];
  const ungrouped: typeof saddleSpecs = [];
  const grouped: Record<string, typeof saddleSpecs> = {};

  for (const spec of saddleSpecs) {
    // Clone rows are named "CANTLE Option (2)"; group them with their base option
    const group = optionGroups[baseOptionName(spec.optionName)];
    if (group === undefined) {
      // Unknown option - show ungrouped
      ungrouped.push(spec);
    } else if (group === '') {
      // Explicitly ungrouped (Seat Size, Tree Size, etc.)
      ungrouped.push(spec);
    } else {
      if (!grouped[group]) grouped[group] = [];
      grouped[group].push(spec);
    }
  }

  const saddleModel = orderData
    ? `${orderData.brandName || ''} ${orderData.modelName || ''}`.trim()
    : '';
  const saddleLeatherType = orderData?.leatherName || '';
  const customerReference = orderData?.orderName || orderData?.customerName || '';

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Find Saddle</h1>

      <div className="relative mb-8 flex gap-2">
        <div className="relative flex-1">
          <Input
            type="text"
            placeholder="Enter order number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
            className="text-base py-6 pr-10"
          />
          <button
            onClick={handleSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <Search className="h-5 w-5" />
          </button>
        </div>
      </div>

      {loading && (
        <div className="text-center text-muted-foreground">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#8B0000] mx-auto mb-2"></div>
          Searching...
        </div>
      )}

      {error && (
        <div className="text-center text-destructive mb-4">{error}</div>
      )}

      {orderData && (
        <div className="space-y-6">
          {/* Order header */}
          <div className="flex items-baseline gap-6">
            <h2 className="text-xl font-bold">Order {orderData.orderId}</h2>
            <span className="text-sm text-muted-foreground">
              Order date: {formatOrderDate(orderData.orderTime)}
            </span>
          </div>

          {/* Main content card */}
          <div className="border rounded-lg p-6 space-y-6 bg-white">
            {/* Your order reference */}
            <div>
              <h3 className="text-sm font-semibold text-[#8B0000] mb-3">
                Your order reference
              </h3>
              <div className="flex gap-4 text-sm ml-4">
                <span className="font-bold min-w-[140px]">Your reference</span>
                <span>{customerReference}</span>
              </div>
            </div>

            {/* Saddle information */}
            <div>
              <h3 className="text-sm font-semibold text-[#8B0000] mb-3">
                Saddle information
              </h3>
              <div className="space-y-2 ml-4">
                <div className="flex gap-4 text-sm">
                  <span className="font-bold min-w-[140px]">Model:</span>
                  <span className="italic">{saddleModel || '-'}</span>
                </div>
                <div className="flex gap-4 text-sm">
                  <span className="font-bold min-w-[140px]">Leathertype:</span>
                  <span className="italic">{saddleLeatherType || '-'}</span>
                </div>
              </div>
            </div>

            {/* Options */}
            <div>
              <h3 className="text-sm font-semibold text-[#8B0000] mb-3">
                Options
              </h3>
              <div className="space-y-2 ml-4">
                {/* Ungrouped options (Seat Size, Tree Size, etc.) */}
                {ungrouped.map((spec, idx) => (
                  <div key={`ungrouped-${idx}`} className="flex gap-4 text-sm">
                    <span className="font-bold min-w-[140px]">
                      {spec.optionName}
                    </span>
                    <span className="italic">{spec.displayValue || '-'}</span>
                  </div>
                ))}

                {/* Grouped options */}
                {(['SEAT', 'CANTLE', 'FLAPS', 'PANEL'] as const).map(
                  (groupName) => {
                    const specs = grouped[groupName];
                    if (!specs || specs.length === 0) return null;
                    return specs.map((spec, idx) => (
                      <div
                        key={`${groupName}-${idx}`}
                        className="flex gap-4 text-sm"
                      >
                        <span className="font-bold min-w-[140px]">
                          {spec.optionName}
                        </span>
                        <span className="italic">
                          {spec.displayValue || '-'}
                        </span>
                      </div>
                    ));
                  },
                )}
              </div>
            </div>

            {/* Special Notes */}
            {orderData.specialNotes && (
              <div>
                <h3 className="text-sm font-semibold text-[#8B0000] mb-3">
                  Special Notes
                </h3>
                <div className="ml-4 space-y-2">
                  <div className="flex gap-4 text-sm">
                    <span className="font-bold min-w-[140px]">Notes:</span>
                    <span className="italic">{orderData.specialNotes}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Serial number */}
            {orderData.serialNumber && (
              <div>
                <h3 className="text-sm font-semibold text-[#8B0000] mb-3">
                  Serialnumber
                </h3>
                <div className="ml-4">
                  <div className="flex gap-4 text-sm">
                    <span className="font-bold min-w-[140px]">Serialno:</span>
                    <span className="italic">{orderData.serialNumber}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Print button */}
          <div>
            <Button
              onClick={handlePrint}
              className="bg-[#8B0000] hover:bg-[#6B0000] text-white"
            >
              Print Saddle Information
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
