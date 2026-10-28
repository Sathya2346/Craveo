import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import api from '../lib/api.js';
import { useToast } from './ToastContext.jsx';
import { useSettings } from './SettingsContext.jsx';

const CartContext = createContext(null);
const STORAGE_KEY = 'craveo:cart';

const readStored = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { lines: [], restaurant: null, couponCode: '' };
    const parsed = JSON.parse(raw);
    return {
      lines: Array.isArray(parsed.lines) ? parsed.lines : [],
      restaurant: parsed.restaurant ?? null,
      couponCode: parsed.couponCode ?? '',
    };
  } catch {
    return { lines: [], restaurant: null, couponCode: '' };
  }
};

const localPricing = (lines, restaurant, settings) => {
  const subtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const freeAbove = Number(settings?.free_delivery_above) || 0;
  const deliveryFee = subtotal >= freeAbove ? 0 : Number(restaurant?.deliveryFee ?? settings?.delivery_fee ?? 0);
  const tax = Math.round(((subtotal * (Number(settings?.tax_percent) || 0)) / 100) * 100) / 100;
  return {
    subtotal,
    discount: 0,
    deliveryFee,
    tax,
    total: Math.round((subtotal + deliveryFee + tax) * 100) / 100,
    minOrder: Number(restaurant?.minOrder ?? 0),
    freeDeliveryAbove: freeAbove,
  };
};

export const CartProvider = ({ children }) => {
  const stored = useRef(readStored()).current;
  const [lines, setLines] = useState(stored.lines);
  const [restaurant, setRestaurant] = useState(stored.restaurant);
  const [couponCode, setCouponCode] = useState(stored.couponCode);
  const [coupon, setCoupon] = useState(null);
  const [quote, setQuote] = useState(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const toast = useToast();
  const { settings } = useSettings();

  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);

  useEffect(() => {
    const payload = JSON.stringify({ lines, restaurant, couponCode });
    localStorage.setItem(STORAGE_KEY, payload);
  }, [lines, restaurant, couponCode]);

  // Ask the server for authoritative pricing whenever the cart changes.
  useEffect(() => {
    if (!lines.length) {
      setQuote(null);
      setQuoteError(null);
      setCoupon(null);
      return undefined;
    }

    let active = true;
    setQuoting(true);
    const timer = window.setTimeout(() => {
      api
        .post('/orders/quote', {
          items: lines.map((line) => ({ foodId: line.foodId, quantity: line.quantity })),
          couponCode: couponCode || undefined,
        })
        .then((response) => {
          if (!active) return;
          setQuote(response.data.data.pricing);
          setCoupon(response.data.data.coupon);
          setQuoteError(response.data.data.couponError || null);
        })
        .catch((error) => {
          if (!active) return;
          setQuote(null);
          setQuoteError(error.response?.data?.error?.message || 'Could not price your cart');
        })
        .finally(() => {
          if (active) setQuoting(false);
        });
    }, 320);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [lines, couponCode]);

  const addItem = useCallback(
    (food, restaurantInfo) => {
      if (!food?.id) return;
      const targetRestaurant = {
        id: food.restaurantId ?? restaurantInfo?.id,
        name: food.restaurantName ?? restaurantInfo?.name,
        slug: food.restaurantSlug ?? restaurantInfo?.slug,
        imageUrl: restaurantInfo?.imageUrl ?? null,
        deliveryFee: restaurantInfo?.deliveryFee ?? (Number(settings.delivery_fee) || 0),
        minOrder: restaurantInfo?.minOrder ?? 0,
        deliveryTime: restaurantInfo?.deliveryTime ?? null,
      };

      if (restaurant && restaurant.id && targetRestaurant.id && restaurant.id !== targetRestaurant.id) {
        setLines([]);
        setCouponCode('');
        setCoupon(null);
        setRestaurant(targetRestaurant);
        setLines([
          {
            foodId: food.id,
            name: food.name,
            imageUrl: food.imageUrl,
            price: food.effectivePrice ?? food.price,
            foodType: food.foodType,
            quantity: 1,
          },
        ]);
        toast.warning(`Cart cleared · added from ${targetRestaurant.name}`);
        setDrawerOpen(true);
        return;
      }

      setRestaurant((current) => current ?? targetRestaurant);
      setLines((current) => {
        const existing = current.find((line) => line.foodId === food.id);
        if (existing) {
          return current.map((line) =>
            line.foodId === food.id ? { ...line, quantity: Math.min(line.quantity + 1, 20) } : line,
          );
        }
        return [
          ...current,
          {
            foodId: food.id,
            name: food.name,
            imageUrl: food.imageUrl,
            price: food.effectivePrice ?? food.price,
            foodType: food.foodType,
            quantity: 1,
          },
        ];
      });
      toast.success(`${food.name} added to cart`);
    },
    [restaurant, settings.delivery_fee, toast],
  );

  const changeQuantity = useCallback((foodId, quantity) => {
    setLines((current) => {
      if (quantity <= 0) return current.filter((line) => line.foodId !== foodId);
      return current.map((line) =>
        line.foodId === foodId ? { ...line, quantity: Math.min(quantity, 20) } : line,
      );
    });
  }, []);

  const removeItem = useCallback((foodId) => {
    setLines((current) => current.filter((line) => line.foodId !== foodId));
  }, []);

  const clearCart = useCallback(() => {
    setLines([]);
    setRestaurant(null);
    setCouponCode('');
    setCoupon(null);
    setQuote(null);
    setQuoteError(null);
  }, []);

  const applyCoupon = useCallback((code) => {
    setCouponCode(String(code || '').trim().toUpperCase());
  }, []);

  const removeCoupon = useCallback(() => {
    setCouponCode('');
    setCoupon(null);
    setQuoteError(null);
  }, []);

  const pricing = quote || localPricing(lines, restaurant, settings);

  /** Merges server prices back onto local line metadata for display. */
  const pricedLines = useMemo(() => {
    if (!quote?.items?.length) {
      return lines.map((line) => ({ ...line, unitPrice: line.price, lineTotal: line.price * line.quantity }));
    }
    return quote.items.map((item) => {
      const local = lines.find((line) => line.foodId === item.foodId);
      return {
        ...local,
        ...item,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
        foodType: local?.foodType,
      };
    });
  }, [quote, lines]);

  const value = useMemo(
    () => ({
      lines,
      pricedLines,
      restaurant,
      itemCount,
      pricing,
      coupon,
      couponCode,
      couponError: quoteError,
      quoting,
      drawerOpen,
      openDrawer: () => setDrawerOpen(true),
      closeDrawer: () => setDrawerOpen(false),
      addItem,
      changeQuantity,
      removeItem,
      clearCart,
      applyCoupon,
      removeCoupon,
      meetsMinimum: !pricing?.minOrder || pricing.subtotal >= pricing.minOrder,
      amountToMinimum: Math.max(0, (pricing?.minOrder || 0) - (pricing?.subtotal || 0)),
    }),
    [
      lines,
      pricedLines,
      restaurant,
      itemCount,
      pricing,
      coupon,
      couponCode,
      quoteError,
      quoting,
      drawerOpen,
      addItem,
      changeQuantity,
      removeItem,
      clearCart,
      applyCoupon,
      removeCoupon,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used inside CartProvider');
  return context;
};
