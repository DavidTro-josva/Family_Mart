import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { 
  Search, 
  User, 
  Trash2, 
  Plus, 
  Minus, 
  Receipt, 
  Loader2, 
  X,
  CreditCard,
  Banknote,
  QrCode,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import api from '../services/api.ts';

// --- Type Definitions ---
interface Product {
  id: string;
  name: string;
  barcode: string;

  sellingPrice: number;
  costPrice: number;
  mrp: number;
  gstCategory: { rate: number };
  unit: { abbreviation: string };
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  creditLimit: number;
  outstandingBalance: number;
}

interface CartItem {
  product: Product;
  quantity: number;
  discount: number;
}

interface InvoiceItem {
  id: string;
  product: Product;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  createdAt: string;
  subTotal: number;
  taxAmount: number;
  discount: number;
  grandTotal: number;
  paymentMethod: string;
  cashier: { username: string };
  customer?: { name: string } | null;
  items: InvoiceItem[];
}

interface CheckoutItemPayload {
  productId: string;
  quantity: number;
  discount: number;
}

interface CheckoutPayload {
  customerId: string | null;
  paymentMethod: 'CASH' | 'UPI' | 'CARD' | 'SPLIT';
  discount: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  paymentDetails: any;
  items: CheckoutItemPayload[];
}

export const POS: React.FC = () => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [globalDiscount, setGlobalDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI' | 'CARD' | 'SPLIT'>('CASH');
  const [cashReceived, setCashReceived] = useState<string>('');
  const [checkoutResult, setCheckoutResult] = useState<Invoice | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [isUpiModalOpen, setIsUpiModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSearchingBarcode, setIsSearchingBarcode] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // --- Debounce Search Query ---
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // --- Queries ---
  const { data: productsData, isFetching: isProductsFetching } = useQuery({
    queryKey: ['pos-products', debouncedSearchQuery],
    queryFn: async () => {
      const res = await api.get('/master/products', { 
        params: { search: debouncedSearchQuery, limit: 100 } 
      });
      return res.data.data.products as Product[];
    }
  });

  const isSearching = searchQuery !== debouncedSearchQuery || isProductsFetching;

  const { data: customersData } = useQuery({
    queryKey: ['pos-customers'],
    queryFn: async () => {
      const res = await api.get('/master/customers', { params: { limit: 100 } });
      return res.data.data.customers as Customer[];
    }
  });

  // --- Mutations ---
  const checkoutMutation = useMutation({
    mutationFn: async (payload: CheckoutPayload) => {
      const res = await api.post('/pos/checkout', payload);
      return res.data.data.invoice as Invoice;
    },
    onSuccess: (data) => {
      setCheckoutResult(data);
      setIsReceiptOpen(true);
      setCart([]);
      setSearchQuery('');
      setSelectedCustomerId('');
      setGlobalDiscount(0);
      setCashReceived('');
      setError(null);
    },
    onError: (err) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const errMsg = (err as any).response?.data?.error?.message || 'Checkout failed. Check stock levels.';
      setError(errMsg);
    }
  });

  // --- Barcode Scanner / Search Input Handler ---
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearchingBarcode(true);
    let product = productsData?.find(p => p.barcode === searchQuery.trim());

    if (!product && searchResults.length === 1) {
      product = searchResults[0];
    }

    if (!product) {
      try {
        const res = await api.get('/master/products', { 
          params: { search: searchQuery.trim(), limit: 1 } 
        });
        const fetched = res.data.data.products;
        if (fetched.length > 0 && fetched[0].barcode === searchQuery.trim()) {
          product = fetched[0];
        }
      } catch (err) {
        console.error("Barcode lookup failed", err);
      }
    }

    setIsSearchingBarcode(false);

    if (product) {
      addToCart(product);
      setSearchQuery('');
    }
  };

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) => 
          item.product.id === product.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1, discount: 0 }];
    });
  };

  const updateQuantity = (productId: string, amount: number) => {
    setCart((prev) => 
      prev.map((item) => {
        if (item.product.id === productId) {
          const newQty = item.quantity + amount;
          return newQty > 0 ? { ...item, quantity: newQty } : item;
        }
        return item;
      })
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  // --- Calculations ---
  const subTotal = cart.reduce((acc, item) => acc + item.product.sellingPrice * item.quantity, 0);
  
  const taxAmount = cart.reduce((acc, item) => {
    const itemSub = item.product.sellingPrice * item.quantity;
    const rate = item.product.gstCategory.rate;
    return acc + (itemSub * rate) / 100;
  }, 0);

  const itemDiscounts = cart.reduce((acc, item) => acc + item.discount, 0);
  const totalDiscount = itemDiscounts + globalDiscount;
  const grandTotal = subTotal + taxAmount - totalDiscount;

  const changeDue = cashReceived ? Math.max(0, parseFloat(cashReceived) - grandTotal) : 0;

  const searchResults = React.useMemo(() => {
    console.log('searchQuery:', searchQuery, 'productsData:', productsData);
    if (!searchQuery.trim() || !productsData) return [];
    const results = productsData.filter(
      (p) => {
        try {
          return p.barcode === searchQuery.trim() || 
                 p.name.toLowerCase().includes(searchQuery.trim().toLowerCase());
        } catch (e) {
          console.error("Error filtering product", p, e);
          return false;
        }
      }
    );
    console.log('searchResults:', results);
    return results;
  }, [searchQuery, productsData]);

  const handleCheckout = () => {
    setError(null);
    if (cart.length === 0) {
      setError('Cart is empty.');
      return;
    }

    if (paymentMethod === 'UPI') {
      setIsUpiModalOpen(true);
      return;
    }

    processCheckout();
  };

  const processCheckout = () => {
    const payload: CheckoutPayload = {
      customerId: selectedCustomerId || null,
      paymentMethod,
      discount: globalDiscount,
      paymentDetails: paymentMethod === 'CASH' ? {
        cashReceived: parseFloat(cashReceived) || 0,
        changeGiven: changeDue
      } : {},
      items: cart.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
        discount: item.discount
      }))
    };

    checkoutMutation.mutate(payload);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-12 grid-rows-1 gap-6 h-[calc(100vh-8rem)] overflow-hidden print:hidden">
      {/* Left Panel: Shopping Cart */}
      <div className="lg:col-span-8 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-full min-h-0">
        {/* Cart Header */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <span className="font-display font-bold text-slate-800 flex items-center gap-2">
            <Sparkles className="text-brand-blue-600" size={18} />
            <span>Active Cart ({cart.length} items)</span>
          </span>
          <button 
            onClick={() => setCart([])}
            className="text-xs text-slate-400 hover:text-red-600 transition-colors"
          >
            Clear Cart
          </button>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-5">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100">
                <Search size={24} className="text-slate-300" />
              </div>
              <p className="text-sm">Cart is empty. Scan barcode or search products.</p>
              <p className="text-xs text-red-500">DEBUG: productsData length: {productsData?.length ?? 'undefined'}</p>
            </div>
          ) : (
            cart.map((item) => {
              const itemTotal = (item.product.sellingPrice * item.quantity) + 
                ((item.product.sellingPrice * item.quantity * item.product.gstCategory.rate) / 100) - 
                item.discount;

              return (
                <div key={item.product.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl">
                  <div className="flex-1 min-w-0 pr-4">
                    <h4 className="font-semibold text-slate-800 truncate">{item.product.name}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Barcode: {item.product.barcode} | GST: {item.product.gstCategory.rate}%
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-6 shrink-0">
                    {/* Quantity Controls */}
                    <div className="flex items-center border border-slate-200 rounded-lg bg-white overflow-hidden">
                      <button 
                        onClick={() => updateQuantity(item.product.id, -1)}
                        className="p-1.5 hover:bg-slate-50 text-slate-500"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="px-3 text-sm font-semibold text-slate-800">{item.quantity}</span>
                      <button 
                        onClick={() => updateQuantity(item.product.id, 1)}
                        className="p-1.5 hover:bg-slate-50 text-slate-500"
                      >
                        <Plus size={14} />
                      </button>
                    </div>

                    {/* Price Snapshot */}
                    <div className="text-right w-24">
                      <div className="text-sm font-bold text-slate-800">₹{itemTotal.toFixed(2)}</div>
                      <div className="text-xs text-slate-400">₹{item.product.sellingPrice.toFixed(2)} each</div>
                    </div>

                    {/* Delete button */}
                    <button 
                      onClick={() => removeFromCart(item.product.id)}
                      className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Panel: Search, Totals & Payment */}
      <div className="lg:col-span-4 flex flex-col gap-6 h-full min-h-0">
        {/* Product Search & Customer Selection */}
        <div className="glass-card p-5 space-y-4 shrink-0">
          <div className="relative">
            <form onSubmit={handleSearchSubmit} className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500">Scan Barcode or Type Product Name</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  {isSearchingBarcode ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                </span>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Scan barcode or type product name..."
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue-500/10 focus:border-brand-blue-500"
                  disabled={isSearchingBarcode}
                />
              </div>
            </form>

            {/* Autocomplete Dropdown */}
            {searchQuery.trim() && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                {searchResults.map((product) => (
                  <div 
                    key={product.id}
                    onClick={() => {
                      addToCart(product);
                      setSearchQuery('');
                      searchInputRef.current?.focus();
                    }}
                    className="px-4 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0"
                  >
                    <div className="font-semibold text-sm text-slate-800">{product.name}</div>
                    <div className="text-xs text-slate-500 flex justify-between mt-0.5">
                      <span>Barcode: {product.barcode}</span>
                      <span className="font-semibold text-brand-blue-600">₹{product.sellingPrice.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
                {searchResults.length === 0 && isSearching && (
                  <div className="px-4 py-3 text-sm text-slate-500 flex items-center justify-center gap-2">
                    <Loader2 size={14} className="animate-spin" /> Searching...
                  </div>
                )}
                {searchResults.length === 0 && !isSearching && (
                  <div className="px-4 py-3 text-sm text-slate-500 text-center">No products found</div>
                )}
              </div>
            )}
          </div>

          {/* Customer Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 flex items-center gap-1">
              <User size={14} />
              <span>Select Customer</span>
            </label>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="form-input text-sm py-2"
            >
              <option value="">Walk-in Customer</option>
              {customersData?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.phone}) - Bal: ₹{c.outstandingBalance.toFixed(2)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Totals Summary & Checkout */}
        <div className="glass-card flex-1 min-h-0 flex flex-col">
          <div className="p-5 flex-1 overflow-y-auto space-y-4">
            <h3 className="font-display font-bold text-slate-800 border-b border-slate-100 pb-2">Order Summary</h3>
            
            {/* Breakdowns */}
            <div className="space-y-2 text-sm text-slate-600">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-medium text-slate-800">₹{subTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>CGST</span>
                <span className="font-medium text-slate-800">₹{(taxAmount / 2).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>SGST</span>
                <span className="font-medium text-slate-800">₹{(taxAmount / 2).toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Global Discount</span>
                <input 
                  type="number" 
                  min="0"
                  value={globalDiscount}
                  onChange={(e) => setGlobalDiscount(parseFloat(e.target.value) || 0)}
                  className="w-20 px-2 py-1 text-right border border-slate-200 rounded bg-slate-50 text-sm focus:outline-none focus:border-brand-blue-500"
                />
              </div>
            </div>

            {/* Grand Total */}
            <div className="pt-3 border-t border-slate-100 flex justify-between items-baseline">
              <span className="font-bold text-slate-800">Grand Total</span>
              <span className="text-2xl font-black text-brand-blue-700">₹{grandTotal.toFixed(2)}</span>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-2 pt-3 border-t border-slate-100">
              <label className="text-xs font-semibold text-slate-500">Payment Method</label>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => setPaymentMethod('CASH')}
                  className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-2 text-sm font-semibold transition-all
                    ${paymentMethod === 'CASH' 
                      ? 'border-brand-blue-500 bg-brand-blue-50 text-brand-blue-700' 
                      : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                >
                  <Banknote size={16} />
                  <span>Cash</span>
                </button>
                <button 
                  onClick={() => setPaymentMethod('UPI')}
                  className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-2 text-sm font-semibold transition-all
                    ${paymentMethod === 'UPI' 
                      ? 'border-brand-blue-500 bg-brand-blue-50 text-brand-blue-700' 
                      : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                >
                  <QrCode size={16} />
                  <span>UPI</span>
                </button>
                <button 
                  onClick={() => setPaymentMethod('CARD')}
                  className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-2 text-sm font-semibold transition-all
                    ${paymentMethod === 'CARD' 
                      ? 'border-brand-blue-500 bg-brand-blue-50 text-brand-blue-700' 
                      : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                >
                  <CreditCard size={16} />
                  <span>Card</span>
                </button>
              </div>
            </div>

            {/* Cash Received */}
            {paymentMethod === 'CASH' && (
              <div className="space-y-2 pt-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-slate-500">Cash Received</label>
                  <input 
                    type="number"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    placeholder="Enter amount..."
                    className="w-32 px-3 py-1.5 border border-slate-200 rounded-xl bg-slate-50 text-right font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue-500/10 focus:border-brand-blue-500"
                  />
                </div>
                {parseFloat(cashReceived) >= grandTotal && (
                  <div className="flex justify-between text-xs font-semibold text-emerald-600">
                    <span>Change Due</span>
                    <span>₹{changeDue.toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-start gap-2">
                <AlertCircle className="shrink-0 mt-0.5" size={16} />
                <span>{error}</span>
              </div>
            )}
          </div>

          <div className="p-5 pt-2 mt-auto shrink-0 bg-white/30 backdrop-blur-sm rounded-b-2xl border-t border-slate-100/50">
            <button
              onClick={handleCheckout}
              disabled={checkoutMutation.isPending || cart.length === 0}
              className="w-full py-3.5 bg-gradient-to-r from-brand-green-600 to-brand-green-500 hover:from-brand-green-700 hover:to-brand-green-600 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-brand-green-500/10 hover:shadow-brand-green-500/20 transition-all duration-200 flex items-center justify-center gap-2"
            >
              {checkoutMutation.isPending ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  <span>Processing Sale...</span>
                </>
              ) : (
                <>
                  <Receipt size={18} />
                  <span>Complete Checkout (F10)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
      </div>

      {/* Thermal Receipt Print Modal */}
      {isReceiptOpen && checkoutResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 overflow-y-auto print:p-0 print:bg-white print:static print:block">
          <div className="w-full max-w-sm bg-white border border-slate-100 shadow-2xl rounded-2xl p-6 flex flex-col print:shadow-none print:border-none print:p-8 print:w-full print:max-w-none print:mx-auto">
            {/* Actions */}
            <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-4 print:hidden">
              <span className="font-display font-bold text-slate-800">Sale Complete</span>
              <button 
                onClick={() => setIsReceiptOpen(false)}
                className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            {/* Thermal Receipt Content */}
            <div className="flex-1 font-mono text-xs text-slate-800 space-y-4 pr-1 pl-1 w-full max-w-full print:font-sans print:text-sm print:text-black">
              {/* Header */}
              <div className="text-center print:mb-8">
                <h2 className="font-bold text-base tracking-wider uppercase print:text-2xl print:mb-2">Thangam Store</h2>
                <p className="text-[10px] text-slate-500 print:text-sm print:text-black">Ozhalapathy Junction</p>
                <p className="text-[10px] text-slate-500 print:text-sm print:text-black">GSTIN: 27AAAAA1111A1Z1</p>
                <div className="border-b border-dashed border-slate-300 print:border-black my-2 print:my-6"></div>
              </div>

              {/* Invoice Meta */}
              <div className="space-y-0.5 text-[10px] text-slate-600 print:text-sm print:text-black print:mb-8">
                <div className="flex justify-between">
                  <span>Invoice:</span>
                  <span className="font-bold text-slate-800 print:text-black">{checkoutResult.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span>Date:</span>
                  <span>{new Date(checkoutResult.createdAt).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cashier:</span>
                  <span>{checkoutResult.cashier.username}</span>
                </div>
                <div className="flex justify-between">
                  <span>Customer:</span>
                  <span>{checkoutResult.customer?.name || 'Walk-in'}</span>
                </div>
              </div>

              <div className="border-b border-dashed border-slate-300 print:border-black my-2 print:my-6"></div>

              {/* Items Table */}
              <table className="w-full text-left text-[10px] print:text-sm print:mb-6">
                <thead>
                  <tr className="border-b border-slate-200 print:border-black print:border-b-2">
                    <th className="pb-1 print:pb-3">Item Description</th>
                    <th className="pb-1 text-center print:pb-3">Qty</th>
                    <th className="pb-1 text-right print:pb-3">Price</th>
                    <th className="pb-1 text-right print:pb-3">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 print:divide-black/20">
                  {checkoutResult.items.map((item: InvoiceItem) => (
                    <tr key={item.id}>
                      <td className="py-1.5 font-semibold text-slate-900 print:text-black print:py-3">{item.product.name}</td>
                      <td className="py-1.5 text-center print:py-3">{item.quantity}</td>
                      <td className="py-1.5 text-right print:py-3">₹{item.unitPrice.toFixed(2)}</td>
                      <td className="py-1.5 text-right print:py-3">₹{item.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="border-b border-dashed border-slate-300 print:border-black my-2 print:my-6"></div>

              {/* Summaries */}
              <div className="space-y-1 text-right text-[11px] print:text-base print:space-y-2 w-1/2 ml-auto">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>₹{checkoutResult.subTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>CGST:</span>
                  <span>₹{(checkoutResult.taxAmount / 2).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>SGST:</span>
                  <span>₹{(checkoutResult.taxAmount / 2).toFixed(2)}</span>
                </div>
                {checkoutResult.discount > 0 && (
                  <div className="flex justify-between text-red-600 print:text-black">
                    <span>Discount:</span>
                    <span>-₹{checkoutResult.discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-xs border-t border-slate-200 print:border-black pt-1 print:text-lg print:pt-4 print:mt-4">
                  <span>Grand Total:</span>
                  <span>₹{checkoutResult.grandTotal.toFixed(2)}</span>
                </div>
              </div>

              <div className="border-b border-dashed border-slate-300 print:border-black my-2 print:my-8"></div>

              {/* Footer */}
              <div className="text-center text-[10px] text-slate-500 print:text-sm print:text-black">
                <p className="font-bold">Thank You For Shopping!</p>
                <p>Please visit again</p>
              </div>
            </div>

            {/* Print Buttons */}
            <div className="mt-6 flex gap-3 print:hidden">
              <button 
                onClick={() => setIsReceiptOpen(false)}
                className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl text-sm transition-all"
              >
                Close
              </button>
              <button 
                onClick={handlePrint}
                className="flex-1 px-4 py-2.5 bg-brand-blue-600 hover:bg-brand-blue-700 text-white font-medium rounded-xl text-sm shadow-md shadow-brand-blue-500/10 transition-all flex items-center justify-center gap-1.5"
              >
                <Receipt size={16} />
                <span>Print Receipt</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UPI Payment Modal */}
      {isUpiModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 print:hidden">
          <div className="w-full max-w-sm bg-white border border-slate-100 shadow-2xl rounded-2xl p-6 flex flex-col items-center animate-fade-in">
            <div className="w-full flex justify-between items-center border-b border-slate-100 pb-4 mb-6">
              <span className="font-display font-bold text-slate-800 flex items-center gap-2">
                <QrCode size={18} className="text-brand-blue-600" />
                UPI Payment
              </span>
              <button 
                onClick={() => setIsUpiModalOpen(false)}
                className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="text-center mb-6">
              <p className="text-sm text-slate-500 mb-4">Scan to pay with any UPI app</p>
              <div className="w-48 h-48 bg-white border-2 border-slate-100 rounded-2xl mx-auto flex items-center justify-center p-2 shadow-sm">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`upi://pay?pa=davidjosva12345@oksbi&pn=David Josva&am=${grandTotal.toFixed(2)}&cu=INR`)}`} 
                  alt="UPI QR Code" 
                  className="w-full h-full object-contain rounded-xl"
                />
              </div>
              <p className="text-[11px] font-mono text-slate-400 mt-3">davidjosva12345@oksbi</p>
              <h3 className="text-3xl font-black text-brand-blue-700 mt-4">₹{grandTotal.toFixed(2)}</h3>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1">Total Amount</p>
            </div>

            <div className="w-full mt-2">
              <button
                onClick={() => {
                  setIsUpiModalOpen(false);
                  processCheckout();
                }}
                className="w-full py-3.5 bg-brand-blue-600 hover:bg-brand-blue-700 text-white font-bold rounded-xl shadow-lg shadow-brand-blue-500/20 transition-all flex items-center justify-center gap-2"
              >
                <span>Confirm Payment Received</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default POS;
