export type VehicleType = 'AUTO' | 'MOTO' | 'MOTOTAXI' | 'VAN' | 'CARGO';

export const VEHICLE_CATALOG: Record<VehicleType, Record<string, string[]>> = {
  MOTOTAXI: {
    Bajaj: ['Torito RE 205', 'Torito RE 4S', 'Maxima Z', 'Maxima Cargo', 'Optima', 'Torito Diesel'],
    Zongshen: ['ZS 200', 'ZS 150', 'ZS 250', 'ZS-ZH 200', 'Tricargo 200'],
    Wanxin: ['WX 200', 'WX 150', 'WX 250', 'Motokar 200', 'Torito'],
    TVS: ['King Deluxe', 'King Duramax', 'King FI', 'King Kargo'],
    Motokar: ['CCG 200', 'Clásica 200', 'Especial 150', '200'],
    Lifan: ['LF 200 ZH', 'LF 150', 'Pasajeros 200'],
    Ronco: ['Pantera 200', 'Super Cargo 200', 'Motokar 150'],
    Mavila: ['Veloz 200', 'Pasajeros 150', 'Carga 200'],
    SSendas: ['Trimoto 200', 'Trimoto 150'],
    RTM: ['RTM 200', 'Pasajeros 150']
  },
  AUTO: {
    Toyota: ['Yaris', 'Corolla', 'Hilux', 'RAV4', 'Rush', 'Etios', 'Avanza', 'Fortuner', 'Land Cruiser'],
    Hyundai: ['Accent', 'Tucson', 'Elantra', 'Creta', 'Grand i10', 'Santa Fe', 'Venue'],
    Kia: ['Rio', 'Picanto', 'Sportage', 'Cerato', 'Seltos', 'Soluto', 'Sorento'],
    Nissan: ['Versa', 'Sentra', 'Frontier', 'Kicks', 'Qashqai', 'Tiida', 'March'],
    Suzuki: ['Swift', 'Alto', 'Grand Vitara', 'Baleno', 'Dzire', 'Jimny', 'Ertiga', 'Celerio'],
    Chevrolet: ['Sail', 'Onix', 'Tracker', 'Spark', 'Captiva', 'Cruze', 'Aveo'],
    Volkswagen: ['Gol', 'Polo', 'Virtus', 'Tiguan', 'T-Cross', 'Amarok', 'Jetta'],
    Honda: ['Civic', 'CR-V', 'HR-V', 'City', 'Fit', 'Accord'],
    Mazda: ['Mazda 3', 'Mazda 2', 'CX-5', 'CX-30', 'CX-3', 'BT-50'],
    Ford: ['Ranger', 'EcoSport', 'Explorer', 'Fiesta', 'F-150', 'Focus'],
    Chery: ['Tiggo 2', 'Tiggo 4', 'Tiggo 7', 'Arrizo 5'],
    MG: ['ZS', 'MG 3', 'MG 5', 'RX5', 'HS'],
    Renault: ['Duster', 'Kwid', 'Logan', 'Sandero', 'Stepway', 'Koleos'],
    Mitsubishi: ['L200', 'Outlander', 'ASX', 'Eclipse Cross', 'Montero'],
    BMW: ['Serie 3', 'Serie 1', 'X3', 'X5', 'Serie 5', 'X1'],
    'Mercedes-Benz': ['Clase C', 'Clase A', 'GLA', 'GLC', 'Clase E']
  },
  MOTO: {
    Honda: ['CB 125', 'CB 190R', 'GL 125', 'Wave 110', 'XR 150', 'XR 190L', 'Navi', 'Elite 125'],
    Yamaha: ['YBR 125', 'FZ 16', 'FZ-25', 'Crypton 115', 'MT-03', 'NMAX', 'Ray ZR', 'XTZ 125'],
    Bajaj: ['Pulsar 125', 'Pulsar 150', 'Pulsar 200 NS', 'Pulsar N250', 'Discover 125', 'Boxer 150'],
    Ronco: ['Demoledor 150', 'X-Plorer 200', 'Aggressor 200', 'Matrix 150', 'Pantera 150'],
    Wanxin: ['WX 125', 'WX 150', 'WX 200', 'Cobra', 'Águila', 'Scorpion'],
    Zongshen: ['Z-One 150', 'Z-One 200', 'Storm 200', 'Infinity 150', 'RX3'],
    Suzuki: ['GN 125', 'Gixxer 150', 'Gixxer 250', 'AX 100', 'Smash 110'],
    Nexus: ['150', '200', '250', 'Dragón', 'Naked'],
    Italika: ['FT 150', 'DM 200', 'WS 150', '250Z', 'RT 200'],
    KTM: ['Duke 200', 'Duke 250', 'Duke 390', 'RC 200']
  },
  VAN: {
    Toyota: ['HiAce', 'Probox', 'Succeed', 'Avanza', 'Innova'],
    Hyundai: ['H1', 'Grand Starex', 'Solati', 'Grace', 'H350'],
    Nissan: ['NV350 Urvan', 'Urvan', 'Serena', 'Vanette'],
    Renault: ['Master', 'Trafic', 'Kangoo'],
    Foton: ['View CS2', 'View C2', 'Toano', 'Gratour'],
    JAC: ['Sunray', 'Refine', 'M3', 'M4'],
    Jinbei: ['Haise', 'Granse', 'H2'],
    Joylong: ['A6', 'A4', 'Higer'],
    Chevrolet: ['N300', 'N400', 'Spin'],
    Kia: ['Carnival', 'Pregio', 'Grand Carnival'],
    'Mercedes-Benz': ['Sprinter', 'Vito']
  },
  CARGO: {
    Volvo: ['FH 460', 'FH 500', 'FM 420', 'FMX', 'VM 330', 'FH12'],
    Scania: ['R450', 'G410', 'P360', 'NTG', 'P310', 'R500'],
    'Mercedes-Benz': ['Actros', 'Axor', 'Atego', 'Accelo', 'Arocs'],
    Hino: ['Serie 300', 'Serie 500', 'Serie 700', 'Dutro'],
    Isuzu: ['Forward', 'ELF', 'FTR', 'NPR', 'NKR', 'NQR'],
    'Mitsubishi Fuso': ['Canter', 'Fighter', 'Super Great'],
    Hyundai: ['HD78', 'HD65', 'Mighty', 'Xcient', 'Pavise'],
    Freightliner: ['Cascadia', 'M2 106', 'Columbia', 'Coronado'],
    International: ['ProStar', 'WorkStar', 'DuraStar', 'LT'],
    Dongfeng: ['Captain', 'Kinland', 'Dollicar', 'Duolika'],
    Foton: ['Auman', 'Aumark', 'Ollin'],
    Shacman: ['F3000', 'X3000', 'M3000'],
    Sinotruk: ['HOWO A7', 'HOWO T7H', 'Sitrak']
  }
};

export function getBrandsForType(vehicleType: VehicleType): string[] {
  const map = VEHICLE_CATALOG[vehicleType] || VEHICLE_CATALOG.AUTO;
  return Object.keys(map);
}

export function getModelsForBrand(vehicleType: VehicleType, brand: string): string[] {
  if (!brand) return [];
  const map = VEHICLE_CATALOG[vehicleType] || VEHICLE_CATALOG.AUTO;
  const matchKey = Object.keys(map).find((k) => k.toLowerCase() === brand.trim().toLowerCase());
  return matchKey ? map[matchKey] : [];
}
