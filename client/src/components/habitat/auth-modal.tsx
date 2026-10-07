import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { Compass, ArrowRight, LoaderCircle, UserRound, House, ShieldCheck, Info, Check, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useHabitat } from './context';
import { api, isDemo } from '@/services/api';
import type { Session } from '@/lib/habitat-types';

export function AuthModal() {
  const { authModal, setAuthModal, setSession, authMessage, setAuthMessage } = useHabitat();
  const [role, setRole] = useState<Session['role']>('CLIENTE');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [touched, setTouched] = useState({ name: false, email: false, password: false });

  const isNameValid = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(form.name) && form.name.trim().length >= 3;
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) && !form.email.includes('..');
  
  const hasMinLength = form.password.length >= 8;
  const hasUpperLower = /[a-z]/.test(form.password) && /[A-Z]/.test(form.password);
  const hasNumber = /[0-9]/.test(form.password);
  const isPasswordValid = hasMinLength && hasUpperLower && hasNumber;

  const isFormValid = authModal === 'register' 
    ? (isNameValid && isEmailValid && isPasswordValid) 
    : (isEmailValid && form.password.length > 0);

  const getInputClass = (isValid: boolean, isTouched: boolean) => {
    if (!isTouched) return '';
    return isValid 
      ? 'border-teal-500 focus:ring-teal-400 outline-none ring-1 ring-teal-500' 
      : 'border-red-500 focus:ring-red-400 outline-none ring-1 ring-red-500';
  };

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isFormValid) return;
    setError('');
    
    const email = form.email;
    const password = form.password;
    const name = form.name || email.split('@')[0];

    setBusy(true);
    try {
      if (isDemo) {
        setSession({ name, email, role });
      } else {
        if (authModal === 'login') {
          const response = await api.login(email, password);
          const token = response.token;
          if (!token || !response.user) throw new Error('Respuesta de acceso no válida.');
          setSession({ ...response.user, token });
        } else {
          const response = await api.register({
            fullName: name,
            email,
            password,
            roleType: role
          });
          const token = response.token;
          if (!token || !response.user) throw new Error('Respuesta de acceso no válida.');
          setSession({ ...response.user, token });
        }
      }
      
      // Cleanup form
      setForm({ name: '', email: '', password: '' });
      setTouched({ name: false, email: false, password: false });
      
      // Close modal
      setAuthModal(null);
      setAuthMessage(null);

      // Show success toast
      toast.success(
        authModal === 'register' 
          ? '¡Cuenta creada con éxito! Bienvenido a Hábitat EC' 
          : '¡Bienvenido de vuelta a Hábitat EC!'
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos iniciar sesión.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={authModal !== null} onOpenChange={open => { 
      if (!open) { 
        setAuthModal(null); setAuthMessage(null); setError(''); setForm({name:'', email:'', password:''}); setTouched({name:false, email:false, password:false}); 
      } 
    }}>
      <DialogContent className="habitat-modal">
        <div className="modal-brand"><Compass size={32} /></div>
        <DialogTitle className="editorial modal-heading">{authModal === 'register' ? 'Tu próxima historia empieza aquí' : 'Qué bueno tenerte de vuelta'}</DialogTitle>
        <DialogDescription>Conecta con lugares únicos y personas que cuidan Ecuador.</DialogDescription>
        <div className="segmented">
          <Button type="button" variant={authModal === 'login' ? 'default' : 'ghost'} onClick={() => { setAuthModal('login'); setError(''); }}>Iniciar Sesión</Button>
          <Button type="button" variant={authModal === 'register' ? 'default' : 'ghost'} onClick={() => { setAuthModal('register'); setError(''); }}>Registrarse</Button>
        </div>
        
        {authMessage && (
          <div className="p-3 bg-amber-50 text-amber-700 text-sm font-medium rounded-md flex items-start gap-2 border border-amber-200">
            <ShieldCheck size={18} className="mt-0.5 shrink-0" /> <p>{authMessage}</p>
          </div>
        )}
        
        {isDemo && <p className="demo-notice"><ShieldCheck size={16} /> Acceso de demostración; no se crea una cuenta real.</p>}
        
        <form onSubmit={submit} className="form-stack">
          {(authModal === 'register' || isDemo) && (
            <>
              <div className="role-options">
                <Button type="button" variant={role === 'CLIENTE' ? 'outline' : 'ghost'} className={role === 'CLIENTE' ? 'selected-role' : ''} onClick={() => setRole('CLIENTE')}><UserRound /> Viajero</Button>
                <Button type="button" variant={role === 'PROPIETARIO' ? 'outline' : 'ghost'} className={role === 'PROPIETARIO' ? 'selected-role' : ''} onClick={() => setRole('PROPIETARIO')}><House /> Anfitrión</Button>
              </div>
              <label>
                Nombre
                <input 
                  name="name" required autoComplete="name" placeholder="Tu nombre"
                  className={getInputClass(isNameValid, touched.name)}
                  value={form.name}
                  onChange={e => setForm(f => ({...f, name: e.target.value}))}
                  onBlur={() => setTouched(t => ({...t, name: true}))}
                />
                {touched.name && !isNameValid && (
                  <span className="text-xs text-red-500 mt-1 flex items-center gap-1"><Info size={14} /> Usa solo letras y al menos 3 caracteres (ej. Carlos Mendoza).</span>
                )}
              </label>
            </>
          )}
          <label>
            Correo electrónico
            <input 
              name="email" type="email" required autoComplete="email" placeholder="tu@correo.com"
              className={getInputClass(isEmailValid, touched.email)}
              value={form.email}
              onChange={e => setForm(f => ({...f, email: e.target.value}))}
              onBlur={() => setTouched(t => ({...t, email: true}))}
            />
            {touched.email && !isEmailValid && (
              <span className="text-xs text-red-500 mt-1 flex items-center gap-1"><Info size={14} /> Ingresa un formato de correo válido (ej. usuario@dominio.com).</span>
            )}
          </label>
          <label>
            Contraseña
            <input 
              name="password" type="password" required autoComplete={authModal === 'register' ? 'new-password' : 'current-password'} placeholder="Mínimo 8 caracteres"
              className={getInputClass(authModal === 'register' ? isPasswordValid : form.password.length > 0, touched.password)}
              value={form.password}
              onChange={e => setForm(f => ({...f, password: e.target.value}))}
              onBlur={() => setTouched(t => ({...t, password: true}))}
            />
            {authModal === 'register' && touched.password && (
              <div className="flex flex-col gap-1 mt-2 text-xs">
                <span className={`flex items-center gap-1 ${hasMinLength ? 'text-teal-600' : 'text-slate-500'}`}>
                  {hasMinLength ? <Check size={14} /> : <div className="w-3.5 h-3.5 rounded-full border border-slate-300" />} Al menos 8 caracteres
                </span>
                <span className={`flex items-center gap-1 ${hasUpperLower ? 'text-teal-600' : 'text-slate-500'}`}>
                  {hasUpperLower ? <Check size={14} /> : <div className="w-3.5 h-3.5 rounded-full border border-slate-300" />} Al menos una letra mayúscula y una minúscula
                </span>
                <span className={`flex items-center gap-1 ${hasNumber ? 'text-teal-600' : 'text-slate-500'}`}>
                  {hasNumber ? <Check size={14} /> : <div className="w-3.5 h-3.5 rounded-full border border-slate-300" />} Al menos un número
                </span>
              </div>
            )}
          </label>
          {error && <p role="alert" className="text-sm text-red-500 bg-red-50 p-3 rounded-md border border-red-200 mt-2">{error}</p>}
          
          <Button 
            type="submit" 
            size="lg" 
            disabled={busy || !isFormValid}
            className={!isFormValid ? 'opacity-60 cursor-not-allowed' : ''}
          >
            {busy ? <LoaderCircle className="animate-spin" /> : <ArrowRight />}
            {authModal === 'register' ? 'Crear mi cuenta' : 'Entrar a Hábitat EC'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
