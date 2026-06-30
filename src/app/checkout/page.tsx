'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useCart } from '@/lib/contexts/CartContext';
import { formatPrice } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

type Step = 'resumen' | 'datos' | 'envio' | 'pago';

interface BuyerData {
  name: string;
  email: string;
  whatsapp: string;
}

interface ShippingData {
  address: string;
  postalCode: string;
  city: string;
  province: string;
}

const STEP_LABELS: { id: Step; label: string; icon: string }[] = [
  { id: 'resumen', label: 'Resumen', icon: '🛒' },
  { id: 'datos', label: 'Tus datos', icon: '👤' },
  { id: 'envio', label: 'Envío', icon: '📦' },
  { id: 'pago', label: 'Pago', icon: '💳' },
];

const MOTOR_QUOTES = [
  { text: "Si todo parece bajo control, es que no vas lo suficientemente rápido.", author: "Mario Andretti" },
  { text: "El coche más bello es el que todavía no hemos construido.", author: "Enzo Ferrari" },
  { text: "Aerodinámica es para gente que no sabe construir motores.", author: "Enzo Ferrari" },
  { text: "Yo no diseño coches para moverme de un sitio a otro, diseño obras de arte con ruedas.", author: "Ettore Bugatti" },
  { text: "El segundo es el primero de los perdedores.", author: "Ayrton Senna" },
  { text: "Para ser el primero, primero tienes que terminar.", author: "Enzo Ferrari" },
  { text: "Correr es vivir. Todo lo que ocurre antes o después, es simplemente esperar.", author: "Steve McQueen" }
];

export default function CheckoutPage() {
  const router = useRouter();
  const { items, total, clearCart, validateStock, stockStatuses, addItem } = useCart();

  const [step, setStep] = useState<Step>('resumen');
  const [shippingMethod, setShippingMethod] = useState<'recogida' | 'envio'>('recogida');
  const [buyer, setBuyer] = useState<BuyerData>({ name: '', email: '', whatsapp: '+34 ' });
  const [shipping, setShipping] = useState<ShippingData>({
    address: '',
    postalCode: '',
    city: '',
    province: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [paymentsEnabled, setPaymentsEnabled] = useState<boolean>(true);
  const [squarePaymentEnabled, setSquarePaymentEnabled] = useState<boolean>(false);
  const [bizumEnabled, setBizumEnabled] = useState<boolean>(true);
  const [paypalEnabled, setPaypalEnabled] = useState<boolean>(true);
  const [selectedMethod, setSelectedMethod] = useState<'tarjeta' | 'bizum' | 'paypal' | null>(null);
  const [squareLoaded, setSquareLoaded] = useState(false);
  const [squareCard, setSquareCard] = useState<any>(null);
  const [paying, setPaying] = useState(false);
  const [reserving, setReserving] = useState(false);
  const [reserved, setReserved] = useState(false);
  const [reservationExpiry, setReservationExpiry] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState<string>('');
  const [payError, setPayError] = useState<string>('');

  // Countdown & Quotes Carousel states
  const [countdownActive, setCountdownActive] = useState(false);
  const [countdownValue, setCountdownValue] = useState(60);
  const [pendingSaleId, setPendingSaleId] = useState<string | null>(null);
  const [pendingOrderNumber, setPendingOrderNumber] = useState<string | null>(null);
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);

  const unavailableIds = reserved
    ? []
    : stockStatuses
        .filter((s) => !s.available)
        .map((s) => s.articleId);

  const availableItems = items.filter((i) => !unavailableIds.includes(i.article.id));
  const subtotal = availableItems.reduce((s, i) => s + i.priceAtAdd, 0);
  const shippingPrice = shippingMethod === 'envio' ? 9.99 : 0;
  const availableTotal = subtotal + shippingPrice;

  // Validate stock on load
  useEffect(() => {
    validateStock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load query param article if present
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const articleIdParam = params.get('article');
    if (!articleIdParam) return;

    const articleId = Number(articleIdParam);
    if (isNaN(articleId)) return;

    // Check if it's already in the cart
    const isAlreadyInCart = items.some((i) => i.article.id === articleId);
    if (isAlreadyInCart) return;

    // Fetch the article details and add it to the cart
    async function fetchAndAddArticle() {
      try {
        const { data: art, error } = await supabase
          .from('articles')
          .select('*')
          .eq('id', articleId)
          .single();

        if (error || !art) {
          console.error('[checkout] Failed to fetch query article:', error);
          router.replace('/');
          return;
        }

        // Add to cart
        addItem(art);
      } catch (err) {
        console.error('[checkout] Error adding query article to cart:', err);
        router.replace('/');
      }
    }

    fetchAndAddArticle();
  }, [items, addItem, router]);

  // Redirect to catalog if cart is empty (only if not on payment step to prevent redirect races)
  useEffect(() => {
    const hasArticleParam = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('article');
    if (items.length === 0 && step !== 'pago' && !hasArticleParam) {
      router.replace('/');
    }
  }, [items, router, step]);

  // Load payment settings on mount
  useEffect(() => {
    async function checkSettings() {
      try {
        const { data } = await supabase
          .from('settings')
          .select('key, value');

        if (data) {
          const settingsMap = new Map(data.map((item: any) => [item.key, item.value]));
          
          setPaymentsEnabled(settingsMap.get('payments_enabled') !== 'false');
          setSquarePaymentEnabled(settingsMap.get('square_payments_enabled') === 'true');
          setBizumEnabled(settingsMap.get('bizum_enabled') !== 'false');
          setPaypalEnabled(settingsMap.get('paypal_enabled') !== 'false');
        }
      } catch (e) {
        console.error('Error fetching settings:', e);
      }
    }
    checkSettings();
  }, []);

  // Set default selected payment method based on loaded configurations
  useEffect(() => {
    if (squarePaymentEnabled) {
      setSelectedMethod('tarjeta');
    } else if (bizumEnabled) {
      setSelectedMethod('bizum');
    } else if (paypalEnabled) {
      setSelectedMethod('paypal');
    } else {
      setSelectedMethod(null);
    }
  }, [squarePaymentEnabled, bizumEnabled, paypalEnabled]);

  // Load Square Web Payments SDK
  useEffect(() => {
    if (step !== 'pago' || squareLoaded || squarePaymentEnabled === false) return;

    const appId = process.env.NEXT_PUBLIC_SQUARE_APPLICATION_ID || '';
    const isSandbox = appId.startsWith('sandbox-');

    const script = document.createElement('script');
    script.src = isSandbox
      ? 'https://sandbox.web.squarecdn.com/v1/square.js'
      : 'https://web.squarecdn.com/v1/square.js';
    script.onload = () => setSquareLoaded(true);
    document.body.appendChild(script);

    return () => {
      try { document.body.removeChild(script); } catch {}
    };
  }, [step, squareLoaded, squarePaymentEnabled]);

  // Init Square card form
  useEffect(() => {
    if (!squareLoaded || squareCard || squarePaymentEnabled === false) return;

    const initSquare = async () => {
      try {
        const payments = (window as any).Square.payments(
          process.env.NEXT_PUBLIC_SQUARE_APPLICATION_ID,
          process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID,
        );
        const card = await payments.card({
          postalCode: shipping.postalCode || '28001'
        });
        await card.attach('#square-card-container');
        setSquareCard(card);
      } catch (err) {
        console.error('[Square] Init error:', err);
        setPayError('Error cargando el formulario de pago. Recarga la página.');
      }
    };

    initSquare();
  }, [squareLoaded, squareCard, shipping.postalCode, squarePaymentEnabled]);

  // Restore reservation from localStorage on mount
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('mec_reservation');
        if (stored) {
          const { expiry, items: savedIds } = JSON.parse(stored);
          const expiryDate = new Date(expiry);
          if (expiryDate > new Date()) {
            const currentIds = availableItems.map((i) => i.article.id);
            const matches = savedIds.length === currentIds.length && savedIds.every((id: number) => currentIds.includes(id));
            if (matches) {
              setReservationExpiry(expiryDate);
              setReserved(true);
            }
          } else {
            localStorage.removeItem('mec_reservation');
          }
        }
      }
    } catch (e) {
      console.error('[checkout] Error restoring reservation:', e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reserve stock when entering payment step
  useEffect(() => {
    if (step !== 'pago' || reserved || reserving) return;

    const doReserve = async () => {
      setReserving(true);
      try {
        const ids = availableItems.map((i) => i.article.id);
        const res = await fetch('/api/checkout/reserve-stock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ articleIds: ids }),
        });
        const data = await res.json();

        if (data.success) {
          const expiry = new Date(Date.now() + 3 * 60 * 1000);
          setReservationExpiry(expiry);
          setReserved(true);
          if (typeof window !== 'undefined') {
            localStorage.setItem('mec_reservation', JSON.stringify({ expiry: expiry.toISOString(), items: ids }));
          }
        } else {
          setPayError(
            'Algún artículo ya no está disponible. Vuelve al carrito y actualiza.',
          );
          await validateStock();
        }
      } catch {
        setPayError('Error al reservar el stock. Inténtalo de nuevo.');
      } finally {
        setReserving(false);
      }
    };

    doReserve();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Countdown timer
  useEffect(() => {
    if (!reservationExpiry) return;

    const tick = () => {
      const remaining = reservationExpiry.getTime() - Date.now();
      if (remaining <= 0) {
        setCountdown('00:00');
        setPayError('Tu reserva ha expirado. Vuelve al carrito e inténtalo de nuevo.');
        setReserved(false);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('mec_reservation');
        }
        return;
      }
      const m = Math.floor(remaining / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      setCountdown(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [reservationExpiry]);

  // Release reservation when leaving payment step
  useEffect(() => {
    return () => {
      if (reserved) {
        fetch('/api/checkout/release-stock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ articleIds: availableItems.map((i) => i.article.id) }),
          keepalive: true,
        }).catch(() => {});
        if (typeof window !== 'undefined') {
          localStorage.removeItem('mec_reservation');
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reserved]);

  // Countdown and Quotes effect for waiting payment validation
  useEffect(() => {
    if (!countdownActive) return;

    // Rotate quote every 7 seconds
    const quoteInterval = setInterval(() => {
      setCurrentQuoteIndex((prev) => (prev + 1) % MOTOR_QUOTES.length);
    }, 7000);

    // Countdown tick down
    const tickInterval = setInterval(() => {
      setCountdownValue((prev) => {
        if (prev <= 1) {
          clearInterval(tickInterval);
          clearInterval(quoteInterval);
          // Trigger manual sale email dispatch on backend after timer finishes
          (async () => {
            try {
              await fetch('/api/checkout/send-manual-sale-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ saleId: pendingSaleId }),
              });
            } catch (err) {
              console.error('Failed to trigger reservation email:', err);
            } finally {
              clearCart();
              router.push(`/checkout/success?order=${pendingOrderNumber ?? ''}`);
            }
          })();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(tickInterval);
      clearInterval(quoteInterval);
    };
  }, [countdownActive, pendingSaleId, pendingOrderNumber, clearCart, router]);

  // ── Validation ────────────────────────────────────────────

  function validateBuyer(): boolean {
    const e: Record<string, string> = {};
    if (!buyer.name.trim()) e.name = 'El nombre es obligatorio';
    if (!buyer.email.trim()) e.email = 'El email es obligatorio';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyer.email))
      e.email = 'Introduce un email válido';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validateShipping(): boolean {
    if (shippingMethod === 'recogida') {
      return true;
    }

    const e: Record<string, string> = {};
    if (!shipping.address.trim()) e.address = 'La dirección es obligatoria';
    
    const cp = shipping.postalCode.trim();
    if (!cp) {
      e.postalCode = 'El código postal es obligatorio';
    } else if (!/^\d{5}$/.test(cp)) {
      e.postalCode = 'Introduce un código postal de 5 dígitos';
    } else {
      const prefix = cp.substring(0, 2);
      const blockedPrefixes = ['07', '35', '38', '51', '52']; // Baleares, Canarias, Ceuta, Melilla
      if (blockedPrefixes.includes(prefix)) {
        e.postalCode = 'Lo sentimos, no realizamos envíos fuera de España peninsular.';
      }
    }

    if (!shipping.city.trim()) e.city = 'La ciudad es obligatoria';
    if (!shipping.province.trim()) e.province = 'La provincia es obligatoria';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  const goNext = () => {
    setErrors({});
    if (step === 'resumen') setStep('datos');
    else if (step === 'datos' && validateBuyer()) setStep('envio');
    else if (step === 'envio' && validateShipping()) setStep('pago');
  };

  const goBack = () => {
    setErrors({});
    if (step === 'datos') setStep('resumen');
    else if (step === 'envio') setStep('datos');
    else if (step === 'pago') {
      setStep('envio');
      setReserved(false);
      setReservationExpiry(null);
    }
  };

  // ── Pay ────────────────────────────────────────────────────

  const handlePay = useCallback(async () => {
    if (paying) return;
    setPayError('');
    setPaying(true);

    const formattedWhatsapp = buyer.whatsapp.replace(/\D/g, '') === '34' || buyer.whatsapp.trim() === ''
      ? null
      : buyer.whatsapp.trim();

    const shippingAddress = shippingMethod === 'recogida'
      ? {
          method: 'recogida',
          price: 0,
          description: 'Recogida en taller (León, ESP)',
        }
      : {
          method: 'envio',
          price: 9.99,
          address: shipping.address,
          postalCode: shipping.postalCode,
          city: shipping.city,
          province: shipping.province,
          country: 'España',
        };

    const cartItems = availableItems.map((i) => ({
      articleId: i.article.id,
      title: i.article.title,
      priceAtCheckout: i.priceAtAdd,
    }));

    if (selectedMethod === 'tarjeta') {
      if (!squareCard) {
        setPayError('El formulario de tarjeta no está listo.');
        setPaying(false);
        return;
      }

      try {
        const tokenResult = await squareCard.tokenize();
        if (tokenResult.status !== 'OK') {
          setPayError('No se pudo procesar la tarjeta. Revisa los datos e inténtalo de nuevo.');
          setPaying(false);
          return;
        }

        const sourceId = tokenResult.token;

        const res = await fetch('/api/checkout/create-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceId,
            cartItems,
            total: availableTotal,
            buyerEmail: buyer.email,
            buyerName: buyer.name,
            buyerWhatsapp: formattedWhatsapp,
            shippingAddress,
          }),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          setPayError(data.error ?? 'El pago ha fallado. Inténtalo de nuevo.');
          setPaying(false);
          return;
        }

        clearCart();
        router.push(`/checkout/success?order=${data.orderNumber ?? ''}`);
      } catch (err) {
        console.error('[handlePay Card]', err);
        setPayError('Error inesperado procesando la tarjeta. Inténtalo de nuevo.');
        setPaying(false);
      }
    } else if (selectedMethod === 'bizum') {
      try {
        const res = await fetch('/api/checkout/create-manual-sale', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cartItems,
            buyerName: buyer.name,
            buyerEmail: buyer.email,
            buyerWhatsapp: formattedWhatsapp,
            shippingAddress,
            total: availableTotal,
            paymentMethod: 'BIZUM',
            delayEmail: true,
          }),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          setPayError(data.error ?? 'Error al registrar el pedido Bizum.');
          setPaying(false);
          return;
        }

        // Redirect to external Bizum payment link in a new window
        const amountInCents = Math.round(Number(availableTotal) * 100);
        const noteText = `MEC | mini engines - Pedido ${data.orderNumber}`;
        const bizumPayUrl = `https://revolut.me/jfernandezz?currency=EUR&amount=${amountInCents}&note=${encodeURIComponent(noteText)}`;
        window.open(bizumPayUrl, '_blank');

        setPendingSaleId(data.saleId);
        setPendingOrderNumber(data.orderNumber);
        setCountdownValue(60);
        setCountdownActive(true);
        setPaying(false);
      } catch (err) {
        console.error('[handlePay Bizum]', err);
        setPayError('Error registrando tu pedido Bizum. Inténtalo de nuevo.');
        setPaying(false);
      }
    } else if (selectedMethod === 'paypal') {
      try {
        const res = await fetch('/api/checkout/create-manual-sale', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cartItems,
            buyerName: buyer.name,
            buyerEmail: buyer.email,
            buyerWhatsapp: formattedWhatsapp,
            shippingAddress,
            total: availableTotal,
            paymentMethod: 'PAYPAL',
            delayEmail: true,
          }),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          setPayError(data.error ?? 'Error al registrar el pedido PayPal.');
          setPaying(false);
          return;
        }

        // Redirect to external PayPal link in a new window
        const paypalPrice = Number(availableTotal).toFixed(2);
        const noteText = `MEC | mini engines - Pedido ${data.orderNumber}`;
        const paypalPayUrl = `https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=javifzlvdc@gmail.com&item_name=${encodeURIComponent(noteText)}&amount=${paypalPrice}&currency_code=EUR&no_shipping=1`;
        window.open(paypalPayUrl, '_blank');

        setPendingSaleId(data.saleId);
        setPendingOrderNumber(data.orderNumber);
        setCountdownValue(60);
        setCountdownActive(true);
        setPaying(false);
      } catch (err) {
        console.error('[handlePay PayPal]', err);
        setPayError('Error registrando tu pedido PayPal. Inténtalo de nuevo.');
        setPaying(false);
      }
    }
  }, [
    selectedMethod,
    squareCard,
    paying,
    availableItems,
    availableTotal,
    buyer,
    shipping,
    shippingMethod,
    clearCart,
    router,
  ]);

  // ── UI ────────────────────────────────────────────────────

  const currentStepIndex = STEP_LABELS.findIndex((s) => s.id === step);

  if (countdownActive) {
    const minutes = Math.floor(countdownValue / 60);
    const seconds = countdownValue % 60;
    const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    const quote = MOTOR_QUOTES[currentQuoteIndex];

    return (
      <main
        style={{
          minHeight: '100vh',
          background: 'var(--bg-page)',
          color: 'var(--text-primary)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 24px',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: '480px', width: '100%' }}>
          {/* Spinner */}
          <div style={{ marginBottom: '32px', position: 'relative', display: 'inline-block' }}>
            <div
              style={{
                width: '96px',
                height: '96px',
                borderRadius: '50%',
                border: '4px solid rgba(99, 102, 241, 0.1)',
                borderTopColor: 'var(--accent-primary, #6366f1)',
                animation: 'spin 2s linear infinite',
              }}
            />
            <style dangerouslySetInnerHTML={{__html: `
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}} />
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                fontSize: '28px',
              }}
            >
              🏎️
            </div>
          </div>

          <h1
            style={{
              fontSize: '24px',
              fontWeight: 800,
              marginBottom: '12px',
              letterSpacing: '-0.02em',
            }}
          >
            Procesando reserva...
          </h1>

          <p
            style={{
              fontSize: '14px',
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
              marginBottom: '24px',
            }}
          >
            Por favor, completa el pago en la pestaña de Revolut o PayPal que se acaba de abrir. La web confirmará tu reserva en unos segundos. No cierres esta ventana.
          </p>

          {/* Timer Display */}
          <div
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '16px',
              padding: '20px 24px',
              marginBottom: '40px',
            }}
          >
            <div
              style={{
                fontSize: '40px',
                fontWeight: 800,
                color: 'var(--accent-primary, #6366f1)',
                fontFamily: 'monospace',
                letterSpacing: '2px',
                marginBottom: '4px',
              }}
            >
              {formattedTime}
            </div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)' }}>
              Espera de validación
            </div>
          </div>

          {/* Carousel box */}
          <div
            style={{
              minHeight: '120px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              background: 'linear-gradient(180deg, rgba(99,102,241,0.03) 0%, rgba(139,92,246,0.03) 100%)',
              border: '1px solid rgba(99,102,241,0.08)',
              borderRadius: '16px',
              padding: '24px',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            }}
          >
            <div
              key={currentQuoteIndex}
              style={{
                animation: 'fadeInOut 7s ease-in-out infinite',
              }}
            >
              <p
                style={{
                  fontStyle: 'italic',
                  fontSize: '14px',
                  lineHeight: 1.6,
                  color: 'var(--text-primary)',
                  marginBottom: '10px',
                  fontWeight: 500,
                }}
              >
                "{quote.text}"
              </p>
              <p
                style={{
                  fontSize: '12px',
                  color: 'var(--accent-primary, #8b5cf6)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                — {quote.author}
              </p>
            </div>
            <style dangerouslySetInnerHTML={{__html: `
              @keyframes fadeInOut {
                0% { opacity: 0; transform: translateY(4px); }
                10% { opacity: 1; transform: translateY(0); }
                90% { opacity: 1; transform: translateY(0); }
                100% { opacity: 0; transform: translateY(-4px); }
              }
            `}} />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--bg-page)',
        color: 'var(--text-primary)',
        padding: '24px 16px 80px',
      }}
    >
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>

        {/* Back to catalog */}
        <a
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            color: 'var(--text-secondary)',
            textDecoration: 'none',
            marginBottom: '24px',
          }}
        >
          ← Volver al catálogo
        </a>

        <h1
          style={{
            fontSize: '24px',
            fontWeight: 800,
            marginBottom: '28px',
            letterSpacing: '-0.02em',
          }}
        >
          Finalizar pedido
        </h1>

        {/* Step indicator */}
        <div
          style={{
            display: 'flex',
            gap: '0',
            marginBottom: '32px',
            borderRadius: '12px',
            overflow: 'hidden',
            border: '1px solid var(--border-card)',
          }}
        >
          {STEP_LABELS.map((s, i) => (
            <div
              key={s.id}
              style={{
                flex: 1,
                padding: '10px 4px',
                textAlign: 'center',
                fontSize: '11px',
                fontWeight: i <= currentStepIndex ? 700 : 500,
                background:
                  i < currentStepIndex
                    ? 'rgba(99,102,241,0.15)'
                    : i === currentStepIndex
                      ? 'linear-gradient(135deg,#6366f1,#8b5cf6)'
                      : 'var(--bg-card-glass)',
                color:
                  i === currentStepIndex
                    ? '#fff'
                    : i < currentStepIndex
                      ? '#6366f1'
                      : 'var(--text-secondary)',
                borderRight:
                  i < STEP_LABELS.length - 1
                    ? '1px solid var(--border-card)'
                    : 'none',
              }}
            >
              {s.icon} {s.label}
            </div>
          ))}
        </div>

        {/* ── PASO 1: RESUMEN ─────────────────────────────── */}
        {step === 'resumen' && (
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>
              🛒 Artículos en tu carrito
            </h2>

            {unavailableIds.length > 0 && (
              <div
                style={{
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  marginBottom: '16px',
                  fontSize: '13px',
                  color: '#ef4444',
                }}
              >
                ⚠️ Algunos artículos ya no están disponibles. Elimínalos del carrito antes de continuar.
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
              {items.map((item) => {
                const isUnavailable = unavailableIds.includes(item.article.id);
                const img = item.article.image_urls?.[0];
                return (
                  <div
                    key={item.article.id}
                    style={{
                      display: 'flex',
                      gap: '12px',
                      alignItems: 'center',
                      padding: '12px',
                      borderRadius: '10px',
                      background: isUnavailable
                        ? 'rgba(239,68,68,0.06)'
                        : 'var(--bg-card-glass)',
                      border: `1px solid ${isUnavailable ? 'rgba(239,68,68,0.3)' : 'var(--border-card)'}`,
                      opacity: isUnavailable ? 0.65 : 1,
                    }}
                  >
                    <div
                      style={{
                        width: '52px',
                        height: '52px',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        flexShrink: 0,
                        background: 'var(--bg-page)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {img ? (
                        <Image
                          src={img}
                          alt={item.article.title}
                          width={52}
                          height={52}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <span style={{ fontSize: '24px' }}>🚗</span>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          margin: 0,
                          fontSize: '13px',
                          fontWeight: 600,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.article.title}
                      </p>
                      {isUnavailable && (
                        <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#ef4444', fontWeight: 600 }}>
                          ❌ Ya no disponible
                        </p>
                      )}
                    </div>
                    <span style={{ fontSize: '15px', fontWeight: 700, flexShrink: 0 }}>
                      {formatPrice(item.priceAtAdd)}
                    </span>
                  </div>
                );
              })}
            </div>

            <TotalRow label="Subtotal (artículos)" value={formatPrice(subtotal)} />
            <TotalRow label="Total provisional:" value={formatPrice(subtotal)} />
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '6px' }}>
              * Los gastos de envío se calcularán al finalizar el checkout.
            </p>

            <NavButtons
              onNext={goNext}
              nextDisabled={availableItems.length === 0 || unavailableIds.length > 0}
              nextLabel="Continuar"
              hideBack
            />
          </div>
        )}

        {/* ── PASO 2: DATOS DEL COMPRADOR ─────────────────── */}
        {step === 'datos' && (
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px' }}>
              👤 Tus datos
            </h2>

            <Field
              label="Nombre completo *"
              value={buyer.name}
              onChange={(v) => setBuyer((b) => ({ ...b, name: v }))}
              error={errors.name}
              placeholder="María García López"
            />
            <Field
              label="Email *"
              value={buyer.email}
              onChange={(v) => setBuyer((b) => ({ ...b, email: v }))}
              error={errors.email}
              placeholder="maria@ejemplo.com"
              type="email"
            />
            <Field
              label="WhatsApp (opcional)"
              value={buyer.whatsapp}
              onChange={(v) => setBuyer((b) => ({ ...b, whatsapp: v }))}
              placeholder="+34 612 345 678"
              hint="Si lo rellenas, te enviaremos también el resguardo por WhatsApp."
            />

            <NavButtons onBack={goBack} onNext={goNext} nextLabel="Continuar" />
          </div>
        )}

        {/* ── PASO 3: ENVÍO / ENTREGA ─────────────────────── */}
        {step === 'envio' && (
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>
              📦 Método de entrega
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Elige cómo deseas recibir tus artículos únicos.
            </p>

            {/* Selector Options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              
              {/* Option 1: Recogida */}
              <div
                onClick={() => setShippingMethod('recogida')}
                style={{
                  border: `2px solid ${shippingMethod === 'recogida' ? '#6366f1' : 'var(--border-card)'}`,
                  background: shippingMethod === 'recogida' ? 'rgba(99,102,241,0.06)' : 'var(--bg-card-glass)',
                  borderRadius: '12px',
                  padding: '16px',
                  cursor: 'pointer',
                  transition: 'border 0.2s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 700, fontSize: '15px' }}>📍 Recogida en Taller</span>
                  <span style={{ color: '#10b981', fontWeight: 800, fontSize: '13px', background: 'rgba(16,185,129,0.1)', padding: '4px 8px', borderRadius: '999px' }}>
                    GRATUITA
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  El taller de <strong>MEC | MINIENGINES CREATIONS</strong> se ubica en <strong>León (ESP)</strong>.
                  Después del pago contactaremos contigo para acordar la fecha y hora de recogida.
                </p>
              </div>

              {/* Option 2: Envío */}
              <div
                onClick={() => setShippingMethod('envio')}
                style={{
                  border: `2px solid ${shippingMethod === 'envio' ? '#6366f1' : 'var(--border-card)'}`,
                  background: shippingMethod === 'envio' ? 'rgba(99,102,241,0.06)' : 'var(--bg-card-glass)',
                  borderRadius: '12px',
                  padding: '16px',
                  cursor: 'pointer',
                  transition: 'border 0.2s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 700, fontSize: '15px' }}>🚚 Envío a domicilio</span>
                  <span style={{ color: '#6366f1', fontWeight: 800, fontSize: '14px' }}>
                    9,99 €
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Envío por mensajería en <strong>España peninsular</strong>.
                  <em> (No realizamos envíos a Canarias, Baleares, Ceuta ni Melilla)</em>.
                </p>
              </div>

            </div>

            {/* Collapsible Address Fields (only show if method is 'envio') */}
            {shippingMethod === 'envio' && (
              <div style={{
                background: 'var(--bg-card-glass)',
                border: '1px solid var(--border-card)',
                borderRadius: '12px',
                padding: '20px 16px 12px',
                marginBottom: '20px',
                display: 'flex',
                flexDirection: 'column',
                animation: 'fadeIn 0.2s ease-out'
              }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 16px' }}>
                  Dirección de destino (Solo Península)
                </h3>
                <Field
                  label="Dirección *"
                  value={shipping.address}
                  onChange={(v) => setShipping((s) => ({ ...s, address: v }))}
                  error={errors.address}
                  placeholder="Calle Mayor 42, 3º B"
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <Field
                    label="Código postal *"
                    value={shipping.postalCode}
                    onChange={(v) => setShipping((s) => ({ ...s, postalCode: v }))}
                    error={errors.postalCode}
                    placeholder="28001"
                  />
                  <Field
                    label="Ciudad *"
                    value={shipping.city}
                    onChange={(v) => setShipping((s) => ({ ...s, city: v }))}
                    error={errors.city}
                    placeholder="Madrid"
                  />
                </div>
                <Field
                  label="Provincia *"
                  value={shipping.province}
                  onChange={(v) => setShipping((s) => ({ ...s, province: v }))}
                  error={errors.province}
                  placeholder="Madrid"
                />
                <Field label="País" value="España" onChange={() => {}} disabled />
              </div>
            )}

            {/* Warning / Info Banner */}
            {shippingMethod === 'envio' ? (
              <div
                style={{
                  background: 'rgba(239,68,68,0.06)',
                  border: '1px solid rgba(239,68,68,0.25)',
                  borderRadius: '10px',
                  padding: '14px 16px',
                  fontSize: '13px',
                  color: 'var(--text-primary)',
                  lineHeight: 1.6,
                  margin: '20px 0',
                }}
              >
                <strong>🔰 Todos los artículos son únicos y extremadamente frágiles.</strong>
                <div style={{ color: '#ef4444', fontWeight: 800, margin: '8px 0', paddingLeft: '8px', borderLeft: '3px solid #ef4444' }}>
                  ❌ NO NOS HACEMOS CARGO DE LOS DAÑOS DURANTE EL ENVÍO.<br />
                  💡 ACONSEJAMOS LA RECOGIDA GRATUITA EN TALLER.
                </div>
                En el supuesto de no tener otra opción, el paquete será protegido con el máximo mimo y cuidado, pero los transportistas no tienen el mismo tacto que nosotros en el taller. Nos pondremos en contacto contigo antes de realizar el envío.
              </div>
            ) : (
              <div
                style={{
                  background: 'rgba(16,185,129,0.06)',
                  border: '1px solid rgba(16,185,129,0.25)',
                  borderRadius: '10px',
                  padding: '14px 16px',
                  fontSize: '13px',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.6,
                  margin: '20px 0',
                }}
              >
                ✅ <strong>Excelente elección.</strong> Evitas riesgos de roturas en el transporte y gastos de envío. Coordinaremos contigo la recogida en León (ESP) en cuanto confirmes el pago.
              </div>
            )}

            <NavButtons onBack={goBack} onNext={goNext} nextLabel="Ir al pago" />
          </div>
        )}

        {/* ── PASO 4: PAGO ────────────────────────────────── */}
        {step === 'pago' && (
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>
              💳 Pago con tarjeta
            </h2>

            {/* Countdown */}
            {reservationExpiry && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background:
                    countdown === '00:00'
                      ? 'rgba(239,68,68,0.1)'
                      : 'rgba(99,102,241,0.08)',
                  border: `1px solid ${countdown === '00:00' ? 'rgba(239,68,68,0.3)' : 'rgba(99,102,241,0.2)'}`,
                  borderRadius: '10px',
                  padding: '10px 14px',
                  marginBottom: '20px',
                  fontSize: '13px',
                }}
              >
                <span style={{ fontSize: '18px' }}>⏱️</span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  Artículos reservados —
                </span>
                <span
                  style={{
                    fontWeight: 800,
                    fontSize: '16px',
                    fontVariantNumeric: 'tabular-nums',
                    color: countdown === '00:00' ? '#ef4444' : '#6366f1',
                  }}
                >
                  {countdown}
                </span>
              </div>
            )}

            {reserving && (
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px' }}>
                ⏳ Reservando artículos…
              </p>
            )}

            {/* Order summary */}
            <div
              style={{
                background: 'var(--bg-card-glass)',
                border: '1px solid var(--border-card)',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '20px',
              }}
            >
              <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Resumen del pedido
              </p>
              {availableItems.map((i) => (
                <div key={i.article.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '4px 0' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{i.article.title}</span>
                  <span style={{ fontWeight: 600 }}>{formatPrice(i.priceAtAdd)}</span>
                </div>
              ))}
              
              <div style={{ borderTop: '1px solid var(--border-card)', marginTop: '8px', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Subtotal artículos</span>
                  <span style={{ fontWeight: 600 }}>{formatPrice(subtotal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Entrega: {shippingMethod === 'recogida' ? 'Recogida' : 'Envío'}</span>
                  <span style={{ fontWeight: 600, color: shippingMethod === 'recogida' ? '#10b981' : 'var(--text-primary)' }}>
                    {shippingMethod === 'recogida' ? 'Gratis' : formatPrice(9.99)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 800, marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed var(--border-card)' }}>
                  <span>Total a pagar</span>
                  <span style={{ color: '#6366f1', fontSize: '17px' }}>{formatPrice(availableTotal)}</span>
                </div>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Selecciona tu método de pago:
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {squarePaymentEnabled && (
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '16px',
                      borderRadius: '12px',
                      border: `1.5px solid ${selectedMethod === 'tarjeta' ? '#6366f1' : 'var(--border-card)'}`,
                      background: selectedMethod === 'tarjeta' ? 'rgba(99,102,241,0.04)' : 'var(--bg-card-glass)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="tarjeta"
                      checked={selectedMethod === 'tarjeta'}
                      onChange={() => setSelectedMethod('tarjeta')}
                      style={{ accentColor: '#6366f1', width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <div>
                      <strong style={{ display: 'block', fontSize: '14px', color: 'var(--text-primary)' }}>💳 Pago con tarjeta bancaria</strong>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Seguro e instantáneo a través de Square</span>
                    </div>
                  </label>
                )}

                {bizumEnabled && (
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '16px',
                      borderRadius: '12px',
                      border: `1.5px solid ${selectedMethod === 'bizum' ? '#6366f1' : 'var(--border-card)'}`,
                      background: selectedMethod === 'bizum' ? 'rgba(99,102,241,0.04)' : 'var(--bg-card-glass)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="bizum"
                      checked={selectedMethod === 'bizum'}
                      onChange={() => setSelectedMethod('bizum')}
                      style={{ accentColor: '#6366f1', width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <div>
                      <strong style={{ display: 'block', fontSize: '14px', color: 'var(--text-primary)' }}>📲 Bizum / Transferencia</strong>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Te redirigiremos para completar el pago móvil</span>
                    </div>
                  </label>
                )}

                {paypalEnabled && (
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '16px',
                      borderRadius: '12px',
                      border: `1.5px solid ${selectedMethod === 'paypal' ? '#6366f1' : 'var(--border-card)'}`,
                      background: selectedMethod === 'paypal' ? 'rgba(99,102,241,0.04)' : 'var(--bg-card-glass)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="paypal"
                      checked={selectedMethod === 'paypal'}
                      onChange={() => setSelectedMethod('paypal')}
                      style={{ accentColor: '#6366f1', width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <div>
                      <strong style={{ display: 'block', fontSize: '14px', color: 'var(--text-primary)' }}>🅿️ Pago online con PayPal</strong>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Paga de forma rápida y segura desde tu cuenta</span>
                    </div>
                  </label>
                )}

                {!squarePaymentEnabled && !bizumEnabled && !paypalEnabled && (
                  <div
                    style={{
                      background: 'rgba(239,68,68,0.04)',
                      border: '1px solid rgba(239,68,68,0.15)',
                      borderRadius: '12px',
                      padding: '24px 20px',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '32px', marginBottom: '10px' }}>🛑</div>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '15px', fontWeight: 'bold', color: 'var(--text-primary)' }}>Sin métodos de pago</h3>
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                      No hay métodos de pago online habilitados en este momento. Disculpa las molestias.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Dynamic payment content based on selection */}
            {selectedMethod === 'tarjeta' && (
              <>
                <div style={{ overflow: 'hidden', borderRadius: '12px', border: '1px solid var(--border-card)', background: 'var(--bg-card-glass)', marginBottom: '20px' }}>
                  <div
                    id="square-card-container"
                    style={{
                      width: 'calc(100% + 62px)', // Push postal code field past the viewport
                      marginLeft: '0px',
                      padding: '16px 0',
                      clipPath: 'inset(0 62px 0 0)', // Clip only the postal code field (last 62px)
                      minHeight: '48px',
                    }}
                  />
                </div>

                {payError && (
                  <div
                    style={{
                      background: 'rgba(239,68,68,0.08)',
                      border: '1px solid rgba(239,68,68,0.3)',
                      borderRadius: '10px',
                      padding: '12px 14px',
                      marginBottom: '16px',
                      fontSize: '13px',
                      color: '#ef4444',
                    }}
                  >
                    ❌ {payError}
                  </div>
                )}

                <button
                  onClick={handlePay}
                  disabled={paying || reserving || countdown === '00:00' || !squareCard}
                  style={{
                    width: '100%',
                    padding: '16px',
                    borderRadius: '12px',
                    border: 'none',
                    background:
                      paying || reserving || countdown === '00:00'
                        ? 'rgba(99,102,241,0.3)'
                        : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                    color: '#fff',
                    fontSize: '16px',
                    fontWeight: 800,
                    cursor: paying || countdown === '00:00' ? 'not-allowed' : 'pointer',
                    transition: 'opacity 0.2s',
                  }}
                >
                  {paying ? '⏳ Procesando pago…' : `Pagar ${formatPrice(availableTotal)}`}
                </button>

                <p style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '12px' }}>
                  🔒 Pago seguro procesado por Square. Tus datos bancarios nunca pasan por nuestros servidores.
                </p>
              </>
            )}

            {selectedMethod === 'bizum' && (
              <>
                <div style={{ padding: '18px', borderRadius: '12px', background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.15)', fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '20px' }}>
                  💡 Al confirmar el pedido, <strong>te redirigiremos de forma segura a Revolut</strong> para realizar tu pago Bizum por un total de <strong>{formatPrice(availableTotal)}</strong>.<br />
                  <span style={{ display: 'block', marginTop: '8px', color: 'var(--text-primary)', fontWeight: 'bold' }}>
                    🚨 Recuerda indicar tu número de pedido como concepto al pagar y guardar la captura.
                  </span>
                </div>

                {payError && (
                  <div
                    style={{
                      background: 'rgba(239,68,68,0.08)',
                      border: '1px solid rgba(239,68,68,0.3)',
                      borderRadius: '10px',
                      padding: '12px 14px',
                      marginBottom: '16px',
                      fontSize: '13px',
                      color: '#ef4444',
                    }}
                  >
                    ❌ {payError}
                  </div>
                )}

                <button
                  onClick={handlePay}
                  disabled={paying || reserving || countdown === '00:00'}
                  style={{
                    width: '100%',
                    padding: '16px',
                    borderRadius: '12px',
                    border: 'none',
                    background:
                      paying || reserving || countdown === '00:00'
                        ? 'rgba(99,102,241,0.3)'
                        : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                    color: '#fff',
                    fontSize: '16px',
                    fontWeight: 800,
                    cursor: paying || countdown === '00:00' ? 'not-allowed' : 'pointer',
                    transition: 'opacity 0.2s',
                  }}
                >
                  {paying ? '⏳ Registrando pedido…' : `Confirmar pedido y pagar con Bizum 📲`}
                </button>
              </>
            )}

            {selectedMethod === 'paypal' && (
              <>
                <div style={{ padding: '18px', borderRadius: '12px', background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.15)', fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '20px' }}>
                  💡 Al confirmar el pedido, <strong>te redirigiremos de forma segura a PayPal</strong> para abonar tu importe de <strong>{formatPrice(availableTotal)}</strong>.<br />
                  <span style={{ display: 'block', marginTop: '8px', color: 'var(--text-primary)', fontWeight: 'bold' }}>
                    🚨 Recuerda realizar el abono y nos pondremos en contacto contigo para verificarlo lo antes posible.
                  </span>
                </div>

                {payError && (
                  <div
                    style={{
                      background: 'rgba(239,68,68,0.08)',
                      border: '1px solid rgba(239,68,68,0.3)',
                      borderRadius: '10px',
                      padding: '12px 14px',
                      marginBottom: '16px',
                      fontSize: '13px',
                      color: '#ef4444',
                    }}
                  >
                    ❌ {payError}
                  </div>
                )}

                <button
                  onClick={handlePay}
                  disabled={paying || reserving || countdown === '00:00'}
                  style={{
                    width: '100%',
                    padding: '16px',
                    borderRadius: '12px',
                    border: 'none',
                    background:
                      paying || reserving || countdown === '00:00'
                        ? 'rgba(99,102,241,0.3)'
                        : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                    color: '#fff',
                    fontSize: '16px',
                    fontWeight: 800,
                    cursor: paying || countdown === '00:00' ? 'not-allowed' : 'pointer',
                    transition: 'opacity 0.2s',
                  }}
                >
                  {paying ? '⏳ Registrando pedido…' : `Confirmar pedido y pagar con PayPal 🅿️`}
                </button>
              </>
            )}

            <button
              onClick={goBack}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '13px',
                marginTop: '8px',
                display: 'block',
                width: '100%',
                textAlign: 'center',
              }}
            >
              ← Volver atrás
            </button>
          </div>
        )}

      </div>
    </main>
  );
}

// ── Sub-components ────────────────────────────────────────────────

function Field({
  label, value, onChange, error, hint, placeholder, type = 'text', disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: string;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)' }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          width: '100%',
          padding: '11px 14px',
          borderRadius: '10px',
          border: `1px solid ${error ? '#ef4444' : 'var(--border-card)'}`,
          background: 'var(--bg-card-glass)',
          color: 'var(--text-primary)',
          fontSize: '14px',
          boxSizing: 'border-box',
          opacity: disabled ? 0.6 : 1,
        }}
      />
      {error && <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#ef4444' }}>{error}</p>}
      {hint && !error && <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>{hint}</p>}
    </div>
  );
}

function TotalRow({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '14px' }}>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontWeight: 600, color: muted ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
        {value}
      </span>
    </div>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--bg-card-glass)',
        border: '1px solid var(--border-card)',
        borderRadius: '10px',
        padding: '12px 14px',
        fontSize: '13px',
        color: 'var(--text-secondary)',
        lineHeight: 1.6,
        margin: '16px 0',
      }}
    >
      {children}
    </div>
  );
}

function NavButtons({
  onBack,
  onNext,
  nextLabel = 'Continuar',
  nextDisabled = false,
  hideBack = false,
}: {
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  hideBack?: boolean;
}) {
  return (
    <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
      {!hideBack && onBack && (
        <button
          onClick={onBack}
          style={{
            flex: '0 0 auto',
            padding: '13px 20px',
            borderRadius: '10px',
            border: '1px solid var(--border-card)',
            background: 'var(--bg-card-glass)',
            color: 'var(--text-primary)',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          ← Atrás
        </button>
      )}
      {onNext && (
        <button
          onClick={onNext}
          disabled={nextDisabled}
          style={{
            flex: 1,
            padding: '13px 20px',
            borderRadius: '10px',
            border: 'none',
            background: nextDisabled
              ? 'rgba(99,102,241,0.3)'
              : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
            color: '#fff',
            fontSize: '15px',
            fontWeight: 700,
            cursor: nextDisabled ? 'not-allowed' : 'pointer',
          }}
        >
          {nextLabel} →
        </button>
      )}
    </div>
  );
}
