import { createFileRoute } from "@tanstack/react-router";
import { Marketplace } from '@/components/habitat/marketplace';
export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: 'Hábitat EC — Hospedajes conscientes en Ecuador' },
    { name: 'description', content: 'Descubre cabañas, eco-lodges y hoteles boutique en Sierra, Costa, Galápagos y Amazonía. Tu próximo lugar favorito en Ecuador.' },
    { property: 'og:title', content: 'Hábitat EC — Ecuador, a tu ritmo' },
    { property: 'og:description', content: 'Hospedajes conscientes en los rincones más mágicos del Ecuador. Explora estancias con propósito.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: Marketplace,
});
