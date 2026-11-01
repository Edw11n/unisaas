import { create } from 'zustand';

export interface CartItem {
  productId: string;
  variantId: string;
  warehouseId: string;
  productName: string;
  productSku: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discountRate: number;
  subtotal: number;
  taxAmount: number;
  total: number;
}

export interface CustomerInfo {
  id?: string;
  name: string;
  documentNumber: string;
  creditLimit?: number;
  currentDebt?: number;
}

export interface CheckoutReceipt {
  success: boolean;
  invoiceId: string;
  consecutive: string;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  paymentMethod: string;
  cashTendered: number | null;
  changeGiven: number | null;
  ticketBase64?: string;
  isReplay?: boolean;
  createdAt: string;
}

export interface PosCartState {
  items: CartItem[];
  customer: CustomerInfo;
  paymentMethod: 'EFECTIVO' | 'NEQUI' | 'DAVIPLATA' | 'TARJETA' | 'CREDITO_FIADO';
  cashTendered: number;
  isCheckoutModalOpen: boolean;
  isReceiptModalOpen: boolean;
  isProcessing: boolean;
  lastReceipt: CheckoutReceipt | null;
  error: string | null;

  // Acciones
  addItem: (product: {
    productId: string;
    variantId: string;
    warehouseId: string;
    productName: string;
    productSku: string;
    price: number;
    taxRate?: number;
  }) => void;
  removeItem: (variantId: string) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  setCustomer: (customer: CustomerInfo) => void;
  setPaymentMethod: (method: 'EFECTIVO' | 'NEQUI' | 'DAVIPLATA' | 'TARJETA' | 'CREDITO_FIADO') => void;
  setCashTendered: (amount: number) => void;
  setCheckoutModalOpen: (open: boolean) => void;
  setReceiptModalOpen: (open: boolean) => void;
  setProcessing: (processing: boolean) => void;
  setLastReceipt: (receipt: CheckoutReceipt | null) => void;
  setError: (err: string | null) => void;
  clearCart: () => void;

  // Calculados
  getSubtotal: () => number;
  getTaxTotal: () => number;
  getTotal: () => number;
  getChangeGiven: () => number;
}

const DEFAULT_CUSTOMER: CustomerInfo = {
  name: 'Consumidor Final',
  documentNumber: '222222222',
};

export const usePosCartStore = create<PosCartState>((set, get) => ({
  items: [],
  customer: DEFAULT_CUSTOMER,
  paymentMethod: 'EFECTIVO',
  cashTendered: 0,
  isCheckoutModalOpen: false,
  isReceiptModalOpen: false,
  isProcessing: false,
  lastReceipt: null,
  error: null,

  addItem: (product) => {
    set((state) => {
      const existingIdx = state.items.findIndex((i) => i.variantId === product.variantId);
      const taxRate = product.taxRate !== undefined ? product.taxRate : 19;

      if (existingIdx >= 0) {
        const updated = [...state.items];
        const item = updated[existingIdx];
        const newQty = item.quantity + 1;
        const subtotal = item.unitPrice * newQty;
        const taxAmount = Math.round(subtotal * (taxRate / 100));
        const total = subtotal + taxAmount;

        updated[existingIdx] = {
          ...item,
          quantity: newQty,
          subtotal,
          taxAmount,
          total,
        };
        return { items: updated, error: null };
      }

      const qty = 1;
      const subtotal = product.price * qty;
      const taxAmount = Math.round(subtotal * (taxRate / 100));
      const total = subtotal + taxAmount;

      const newItem: CartItem = {
        productId: product.productId,
        variantId: product.variantId,
        warehouseId: product.warehouseId,
        productName: product.productName,
        productSku: product.productSku,
        quantity: qty,
        unitPrice: product.price,
        taxRate,
        discountRate: 0,
        subtotal,
        taxAmount,
        total,
      };

      return { items: [...state.items, newItem], error: null };
    });
  },

  removeItem: (variantId) => {
    set((state) => ({
      items: state.items.filter((i) => i.variantId !== variantId),
    }));
  },

  updateQuantity: (variantId, quantity) => {
    if (quantity <= 0) {
      get().removeItem(variantId);
      return;
    }

    set((state) => {
      const updated = state.items.map((item) => {
        if (item.variantId === variantId) {
          const subtotal = item.unitPrice * quantity;
          const taxAmount = Math.round(subtotal * (item.taxRate / 100));
          const total = subtotal + taxAmount;
          return {
            ...item,
            quantity,
            subtotal,
            taxAmount,
            total,
          };
        }
        return item;
      });

      return { items: updated };
    });
  },

  setCustomer: (customer) => set({ customer }),
  setPaymentMethod: (paymentMethod) => set({ paymentMethod }),
  setCashTendered: (cashTendered) => set({ cashTendered }),
  setCheckoutModalOpen: (isCheckoutModalOpen) => set({ isCheckoutModalOpen }),
  setReceiptModalOpen: (isReceiptModalOpen) => set({ isReceiptModalOpen }),
  setProcessing: (isProcessing) => set({ isProcessing }),
  setLastReceipt: (lastReceipt) => set({ lastReceipt }),
  setError: (error) => set({ error }),

  clearCart: () =>
    set({
      items: [],
      customer: DEFAULT_CUSTOMER,
      cashTendered: 0,
      paymentMethod: 'EFECTIVO',
      error: null,
    }),

  getSubtotal: () => {
    return get().items.reduce((sum, i) => sum + i.subtotal, 0);
  },

  getTaxTotal: () => {
    return get().items.reduce((sum, i) => sum + i.taxAmount, 0);
  },

  getTotal: () => {
    return get().getSubtotal() + get().getTaxTotal();
  },

  getChangeGiven: () => {
    const total = get().getTotal();
    const tendered = get().cashTendered;
    return tendered > total ? tendered - total : 0;
  },
}));

