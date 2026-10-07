import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowLeft, CalendarDays, UsersRound, ShieldCheck, CreditCard, Landmark, CircleCheck, LoaderCircle, Info } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useHabitat } from './context';
import { demoQuote, money, type Customer, type Property, type Quote } from '@/lib/habitat-types';
import { api, isDemo } from '@/services/api';

export function BookingModal({ property, onClose }: { property: Property | null; onClose: () => void }) {
  const { search, addReservation, session } = useHabitat(); 
  const [step, setStep] = useState<'datos' | 'pago' | 'confirmacion'>('datos'); 
  const [customerTouched, setCustomerTouched] = useState({ firstName: false, lastName: false, email: false });
  const [quote, setQuote] = useState<Quote | null>(null); 
  const [customer, setCustomer] = useState<Customer>(() => {
    const parts = (session?.name || '').trim().split(' ');
    return {
      firstName: parts[0] || '',
      lastName: parts.slice(1).join(' ') || '',
      email: session?.email || ''
    };
  }); 
  const [payment, setPayment] = useState('card'); 
  const [error, setError] = useState(''); 
  const [busy, setBusy] = useState(false); 
  const [pnr, setPnr] = useState(''); 
  const key = useRef(''); 
  const submitting = useRef(false);

  // Payment Form State
  const [paymentForm, setPaymentForm] = useState({ cardNumber: '', cardHolder: '', expiry: '', cvc: '' });
  const [paymentTouched, setPaymentTouched] = useState({ cardNumber: false, cardHolder: false, expiry: false, cvc: false });

  // Payment Validations
  const isCardValid = paymentForm.cardNumber.replace(/\s/g, '').length === 16;
  const isCardHolderValid = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(paymentForm.cardHolder) && paymentForm.cardHolder.trim().length >= 3;
  const isExpiryValid = () => {
    const match = paymentForm.expiry.match(/^(0[1-9]|1[0-2])\/(\d{2})$/);
    if (!match) return false;
    const year = parseInt(match[2], 10);
    return year >= 26;
  };
  const isCvcValid = paymentForm.cvc.length === 3 || paymentForm.cvc.length === 4;
  
  const isPaymentValid = payment === 'transfer' || (isCardValid && isCardHolderValid && isExpiryValid() && isCvcValid);

  const getInputClass = (isValid: boolean, isTouched: boolean) => {
    if (!isTouched) return '';
    return isValid 
      ? 'border-teal-500 focus:ring-teal-400 outline-none ring-1 ring-teal-500' 
      : 'border-red-500 focus:ring-red-400 outline-none ring-1 ring-red-500';
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 16) val = val.slice(0, 16);
    const formatted = val.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
    setPaymentForm(f => ({ ...f, cardNumber: formatted }));
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 4) val = val.slice(0, 4);
    if (val.length >= 2) {
      val = val.slice(0, 2) + '/' + val.slice(2);
    }
    setPaymentForm(f => ({ ...f, expiry: val }));
  };

  const handleCvcChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
    setPaymentForm(f => ({ ...f, cvc: val }));
  };

  useEffect(() => { 
    if (!property) return; 
    setStep('datos'); setError(''); setPnr(''); setQuote(null); 
    setCustomerTouched({ firstName: false, lastName: false, email: false });
    const parts = (session?.name || '').trim().split(/\s+/).filter(Boolean);
    setCustomer(c => ({
      firstName: c.firstName || parts[0] || '',
      lastName: c.lastName || parts.slice(1).join(' ') || '',
      email: c.email || session?.email || '',
    }));
    setPaymentForm({ cardNumber: '', cardHolder: '', expiry: '', cvc: '' });
    setPaymentTouched({ cardNumber: false, cardHolder: false, expiry: false, cvc: false });
    key.current = crypto.randomUUID(); 
    setBusy(true); 
    let canceled = false; 
    (isDemo ? Promise.resolve(demoQuote(property, search)) : api.preview(property, search))
      .then(q => { if (!canceled) setQuote(q); })
      .catch(e => { if (!canceled) setError(e instanceof Error ? e.message : 'No pudimos preparar tu cotización.'); })
      .finally(() => { if (!canceled) setBusy(false); }); 
    return () => { canceled = true; }; 
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [property, search]);

  const isFirstNameValid = customer.firstName.trim().length >= 2;
  const isLastNameValid = customer.lastName.trim().length >= 2;
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email.trim());
  const isCustomerValid = isFirstNameValid && isLastNameValid && isEmailValid;

  function goToPayment() {
    setCustomerTouched({ firstName: true, lastName: true, email: true });
    if (!isCustomerValid || !quote || busy) return;
    setError('');
    setStep('pago');
  }

  async function confirm(e: React.FormEvent<HTMLFormElement>) { 
    e.preventDefault(); 
    setPaymentTouched({ cardNumber: true, cardHolder: true, expiry: true, cvc: true });
    if (!property || !quote || submitting.current || !isPaymentValid) return; 
    submitting.current = true; setBusy(true); setError(''); 
    try { 
      const response = isDemo ? { pnr: `HAB-EC-${crypto.randomUUID().slice(0, 8).toUpperCase()}` } : await api.createOrder(property, search, customer, payment, key.current, quote.quoteId); 
      setPnr(response.pnr); 
      addReservation({ pnr: response.pnr, propertyId: property.id, total: quote.total, checkin: search.checkin, checkout: search.checkout }); 
      setStep('confirmacion'); 
    } catch (e) { 
      setError(e instanceof Error ? e.message : 'No pudimos confirmar la reserva.'); 
    } finally { 
      setBusy(false); submitting.current = false; 
    } 
  }

  return (
    <Dialog open={property !== null} onOpenChange={open => { if (!open && !busy) onClose(); }}>
      <DialogContent className="habitat-modal booking-modal">
        <DialogTitle className="editorial modal-heading">
          {step === 'confirmacion' ? 'Tu escapada está confirmada' : step === 'datos' ? 'Un lugar para tu próxima historia' : 'Confirma tu reserva'}
        </DialogTitle>
        <DialogDescription>
          {step === 'confirmacion' ? 'Guarda tu código de reserva.' : `Paso ${step === 'datos' ? 1 : 2} de 2 · ${step === 'datos' ? 'Tu estancia y tus datos' : 'Método de pago'}`}
        </DialogDescription>
        
        {isDemo && <p className="demo-notice"><ShieldCheck size={16} /> Reserva simulada · no se realizará ningún cobro.</p>}
        
        {step === 'confirmacion' ? (
          <div className="success-state">
            <CircleCheck size={54} />
            <h3 className="editorial">¡Nos vemos en Ecuador!</h3>
            <p>{property?.name}</p>
            <strong className="pnr">{pnr}</strong>
            <p>{search.checkin} → {search.checkout}</p>
            <Button type="button" onClick={onClose}>Cerrar <ArrowRight /></Button>
          </div>
        ) : (
          <>
            {property && (
              <div className="booking-property">
                <img src={property.image} alt={property.name} width={96} height={80} />
                <div>
                  <h3 className="editorial">{property.name}</h3>
                  <p>{property.city}, {property.province}</p>
                  <span><CalendarDays size={14} /> {search.checkin} → {search.checkout}</span>
                  <span><UsersRound size={14} /> {search.adults} adultos · {search.rooms} habitación(es)</span>
                </div>
              </div>
            )}
            {busy && !quote && <div className="loading-inline"><LoaderCircle className="animate-spin" /> Preparando tu cotización…</div>}
            {quote && (
              <div className="quote-lines">
                <span>{money(property?.price || 0)} × {quote.nights} noches <b>{money(quote.base)}</b></span>
                <span>Tarifa de servicio {isDemo ? '(8%, demo)' : ''}<b>{money(quote.service)}</b></span>
                <span>Impuestos {isDemo ? '(15%, demo)' : ''}<b>{money(quote.tax)}</b></span>
                <span className="quote-total">Total USD <b>{money(quote.total)}</b></span>
              </div>
            )}
            {step === 'datos' ? (
              <form className="form-stack" noValidate onSubmit={e => { e.preventDefault(); goToPayment(); }}>
                <div className="form-row">
                  <label>Nombre
                    <input value={customer.firstName} className={getInputClass(isFirstNameValid, customerTouched.firstName)} onChange={e => setCustomer(c => ({ ...c, firstName: e.target.value }))} onBlur={() => setCustomerTouched(t => ({ ...t, firstName: true }))} autoComplete="given-name" />
                    {customerTouched.firstName && !isFirstNameValid && <span className="text-xs text-red-500 mt-1 flex items-center gap-1"><Info size={14} /> Ingresa tu nombre (mínimo 2 letras).</span>}
                  </label>
                  <label>Apellido
                    <input value={customer.lastName} className={getInputClass(isLastNameValid, customerTouched.lastName)} onChange={e => setCustomer(c => ({ ...c, lastName: e.target.value }))} onBlur={() => setCustomerTouched(t => ({ ...t, lastName: true }))} autoComplete="family-name" />
                    {customerTouched.lastName && !isLastNameValid && <span className="text-xs text-red-500 mt-1 flex items-center gap-1"><Info size={14} /> Ingresa tu apellido (mínimo 2 letras).</span>}
                  </label>
                </div>
                <label>Correo electrónico
                  <input type="email" value={customer.email} className={getInputClass(isEmailValid, customerTouched.email)} onChange={e => setCustomer(c => ({ ...c, email: e.target.value }))} onBlur={() => setCustomerTouched(t => ({ ...t, email: true }))} autoComplete="email" />
                  {customerTouched.email && !isEmailValid && <span className="text-xs text-red-500 mt-1 flex items-center gap-1"><Info size={14} /> Ingresa un correo válido (ej. usuario@dominio.com).</span>}
                </label>
                <Button type="button" size="lg" disabled={!quote || busy} onClick={goToPayment}>Continuar al pago <ArrowRight /></Button>
              </form>
            ) : (
              <form className="form-stack" onSubmit={confirm}>
                <div className="role-options">
                  <Button type="button" variant={payment === 'card' ? 'outline' : 'ghost'} className={payment === 'card' ? 'selected-role' : ''} onClick={() => setPayment('card')}><CreditCard /> Tarjeta</Button>
                  <Button type="button" variant={payment === 'transfer' ? 'outline' : 'ghost'} className={payment === 'transfer' ? 'selected-role' : ''} onClick={() => setPayment('transfer')}><Landmark /> Billetera / Transferencia</Button>
                </div>
                {payment === 'card' ? (
                  <>
                    {isDemo && <p className="text-xs text-muted-foreground">Usa únicamente datos ficticios. Nunca ingreses una tarjeta real.</p>}
                    <label>
                      Titular
                      <input 
                        required placeholder="Nombre como aparece en la tarjeta" 
                        className={getInputClass(isCardHolderValid, paymentTouched.cardHolder)}
                        value={paymentForm.cardHolder}
                        onChange={e => setPaymentForm(f => ({ ...f, cardHolder: e.target.value }))}
                        onBlur={() => setPaymentTouched(t => ({ ...t, cardHolder: true }))}
                      />
                      {paymentTouched.cardHolder && !isCardHolderValid && (
                        <span className="text-xs text-red-500 mt-1 flex items-center gap-1"><Info size={14} /> Ingresa el nombre tal como figura en la tarjeta (solo letras).</span>
                      )}
                    </label>
                    <label>
                      Número de tarjeta
                      <input 
                        inputMode="numeric" required placeholder="4242 4242 4242 4242" maxLength={19}
                        className={getInputClass(isCardValid, paymentTouched.cardNumber)}
                        value={paymentForm.cardNumber}
                        onChange={handleCardNumberChange}
                        onBlur={() => setPaymentTouched(t => ({ ...t, cardNumber: true }))}
                      />
                      {paymentTouched.cardNumber && !isCardValid && (
                        <span className="text-xs text-red-500 mt-1 flex items-center gap-1"><Info size={14} /> Ingresa los 16 dígitos de tu tarjeta de crédito o débito.</span>
                      )}
                    </label>
                    <div className="form-row">
                      <label>
                        Vencimiento
                        <input 
                          required placeholder="MM/AA" maxLength={5} 
                          className={getInputClass(isExpiryValid(), paymentTouched.expiry)}
                          value={paymentForm.expiry}
                          onChange={handleExpiryChange}
                          onBlur={() => setPaymentTouched(t => ({ ...t, expiry: true }))}
                        />
                        {paymentTouched.expiry && !isExpiryValid() && (
                          <span className="text-xs text-red-500 mt-1 flex items-center gap-1"><Info size={14} /> Formato MM/AA (el mes debe ser entre 01 y 12 y la tarjeta debe estar vigente).</span>
                        )}
                      </label>
                      <label>
                        CVC
                        <input 
                          required type="password" inputMode="numeric" maxLength={4} placeholder="•••" 
                          className={getInputClass(isCvcValid, paymentTouched.cvc)}
                          value={paymentForm.cvc}
                          onChange={handleCvcChange}
                          onBlur={() => setPaymentTouched(t => ({ ...t, cvc: true }))}
                        />
                        {paymentTouched.cvc && !isCvcValid && (
                          <span className="text-xs text-red-500 mt-1 flex items-center gap-1"><Info size={14} /> 3 o 4 dígitos al reverso de tu tarjeta.</span>
                        )}
                      </label>
                    </div>
                  </>
                ) : (
                  <div className="transfer-notice">
                    <Landmark size={30} />
                    <strong>Deuna / Banco Pichincha</strong>
                    <p>{isDemo ? 'Confirmación de transferencia simulada. No se requiere enviar dinero.' : 'La confirmación enviará tu solicitud de pago al alojamiento. No transfieras sin instrucciones oficiales.'}</p>
                  </div>
                )}
                <p className="payment-security"><ShieldCheck size={16} /> Solicitud protegida por Idempotency-Key</p>
                <div className="form-row">
                  <Button type="button" variant="ghost" onClick={() => setStep('datos')} disabled={busy}><ArrowLeft /> Atrás</Button>
                  <Button 
                    type="submit" 
                    disabled={busy || !quote || !isPaymentValid}
                    className={(!isPaymentValid) ? 'opacity-60 cursor-not-allowed' : ''}
                  >
                    {busy ? <LoaderCircle className="animate-spin" /> : <ShieldCheck />} {isDemo ? 'Confirmar reserva demo' : 'Confirmar y pagar'}
                  </Button>
                </div>
              </form>
            )}
            {error && <p role="alert" className="error-message">{error}</p>}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
