import mountain from '@/assets/ecuador-hero.jpg';
import mindo from '@/assets/mindo.jpg';
import islands from '@/assets/galapagos.jpg';
import cuenca from '@/assets/cuenca.jpg';
import type { Property } from './habitat-types';
export const destinations = ['Quito, Pichincha', 'Mindo, Pichincha', 'Baños, Tungurahua', 'Cuenca, Azuay', 'Montañita, Santa Elena', 'Tena, Napo', 'Puerto Ayora, Galápagos'];
export const demoProperties: Property[] = [
 { id: 'H001', name: 'Refugio del Cotopaxi', type: 'Cabaña de Montaña', city: 'Quito', province: 'Pichincha', region: 'Sierra', cityId: 1, address: 'Camino al páramo, km 12', price: 95, adults: 4, rooms: 2, rating: 9.8, reviews: 124, image: mountain, active: true, description: 'Despierta frente a los Andes. Una cabaña de madera, ventanales abiertos al paisaje y el silencio del páramo.' },
 { id: 'H002', name: 'Mindo Bosque Vivo', type: 'Eco-Lodge', city: 'Mindo', province: 'Pichincha', region: 'Sierra', cityId: 2, address: 'Vía al bosque nublado, km 3', price: 78, adults: 4, rooms: 2, rating: 9.6, reviews: 86, image: mindo, active: true, description: 'Un refugio entre helechos y colibríes. Arquitectura que se integra al bosque nublado y una terraza para desconectar.' },
 { id: 'H003', name: 'Isla Brisa Boutique', type: 'Hotel Boutique', city: 'Puerto Ayora', province: 'Galápagos', region: 'Galápagos', cityId: 3, address: 'Avenida Charles Darwin', price: 165, adults: 4, rooms: 2, rating: 9.7, reviews: 112, image: islands, active: true, description: 'La calma del Pacífico, jardines de plantas nativas y una estancia íntima en el corazón de las islas.' },
 { id: 'H004', name: 'Casa del Patio', type: 'Hotel Boutique', city: 'Cuenca', province: 'Azuay', region: 'Sierra', cityId: 4, address: 'Centro histórico, calle Larga', price: 88, adults: 6, rooms: 3, rating: 9.5, reviews: 73, image: cuenca, active: true, description: 'Patios llenos de vida y tradición cuencana en una casa patrimonial restaurada con cuidado.' },
 { id: 'H005', name: 'Napo Selva Lodge', type: 'Eco-Lodge', city: 'Tena', province: 'Napo', region: 'Amazonía', cityId: 5, address: 'Vía al río Napo, km 8', price: 65, adults: 6, rooms: 3, rating: 9.4, reviews: 58, image: mindo, active: true, description: 'Conecta con la selva y sus sonidos en un alojamiento de bajo impacto junto al río.' },
 { id: 'H006', name: 'Brisa del Pacífico', type: 'Hostal', city: 'Montañita', province: 'Santa Elena', region: 'Costa', cityId: 6, address: 'Malecón de Montañita', price: 38, adults: 4, rooms: 2, rating: 9.2, reviews: 92, image: islands, active: true, description: 'Días de mar, espacios compartidos y la hospitalidad de la costa ecuatoriana.' },
];
