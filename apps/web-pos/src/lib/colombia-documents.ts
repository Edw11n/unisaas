/**
 * UTILIDADES DE IDENTIFICACION Y REGULACION LEGAL COLOMBIANA
 * Ecosistema: UniSaaS Colombia
 * Normas: DIAN (Estatuto Tributario Art. 555-2), Ley 1581 de 2012 (Habeas Data)
 */

export type ColombiaDocumentType =
  | 'CC'
  | 'NIT'
  | 'CE'
  | 'TI'
  | 'PASAPORTE'
  | 'PPT';

export interface DocumentTypeOption {
  code: ColombiaDocumentType;
  label: string;
  shortLabel: string;
  requiresDv: boolean;
}

export const COLOMBIA_DOCUMENT_TYPES: DocumentTypeOption[] = [
  { code: 'CC', label: 'Cedula de Ciudadania (CC)', shortLabel: 'CC', requiresDv: false },
  { code: 'NIT', label: 'Numero de Identificacion Tributaria (NIT)', shortLabel: 'NIT', requiresDv: true },
  { code: 'CE', label: 'Cedula de Extranjeria (CE)', shortLabel: 'CE', requiresDv: false },
  { code: 'TI', label: 'Tarjeta de Identidad (TI)', shortLabel: 'TI', requiresDv: false },
  { code: 'PASAPORTE', label: 'Pasaporte Extranjero', shortLabel: 'PASAPORTE', requiresDv: false },
  { code: 'PPT', label: 'Permiso por Proteccion Temporal (PPT)', shortLabel: 'PPT', requiresDv: false },
];

export const COLOMBIAN_DOCUMENT_TYPES = COLOMBIA_DOCUMENT_TYPES;

/**
 * Pesos primos oficiales definidos por la DIAN para el calculo del digito de verificacion.
 */
const NIT_WEIGHTS = [71, 67, 59, 53, 47, 43, 41, 37, 29, 23, 19, 17, 13, 7, 3];

/**
 * Calcula de manera determinista el Digito de Verificacion (DV) de un NIT colombiano.
 * Segun el algoritmo oficial de la DIAN (Decreto 624 de 1989 / Art. 555-2 E.T.).
 */
export function calculateNitDv(rawNit: string | number): string {
  if (!rawNit) return '0';
  const cleanNit = String(rawNit).replace(/[^0-9]/g, '');
  if (cleanNit.length === 0) return '0';

  let sum = 0;
  const len = cleanNit.length;

  for (let i = 0; i < len; i++) {
    const digit = parseInt(cleanNit.charAt(len - 1 - i), 10);
    const weight = NIT_WEIGHTS[NIT_WEIGHTS.length - 1 - i] || 3;
    sum += digit * weight;
  }

  const remainder = sum % 11;
  if (remainder === 0) return '0';
  if (remainder === 1) return '1';
  return String(11 - remainder);
}

/**
 * Valida si un NIT acompanado de su digito de verificacion coincide con el calculo oficial.
 */
export function validateNitWithDv(rawNit: string | number, declaredDv: string | number): boolean {
  const calculatedDv = calculateNitDv(rawNit);
  return String(declaredDv).trim() === calculatedDv;
}

/**
 * Formatea un numero de NIT a formato estandar colombiano: ej. 901000000 -> "901.000.000-1"
 */
export function formatNit(rawNit: string | number, manualDv?: string): string {
  const cleanNit = String(rawNit || '').replace(/[^0-9]/g, '');
  if (!cleanNit) return '';

  const dv = manualDv !== undefined ? String(manualDv).replace(/[^0-9]/g, '') : calculateNitDv(cleanNit);
  const formattedBody = cleanNit.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${formattedBody}-${dv}`;
}

/**
 * Texto oficial de consentimiento de tratamiento de datos personales segun la Ley 1581 de 2012
 */
export const HABEAS_DATA_COLOMBIA_STATEMENT =
  'Autorizo de manera libre, previa, expresa e informada a UniSaaS para recolectar, almacenar y tratar mis datos personales comerciales de conformidad con la Ley 1581 de 2012 y el Decreto 1377 de 2013 de la Republica de Colombia, exclusivamente para la operacion del software comercial, facturacion e inventario.';

/**
 * Principales Departamentos y Municipios de Colombia para selector comercial.
 */
export interface ColombiaLocation {
  department: string;
  municipalities: string[];
}

export const COLOMBIA_LOCATIONS: ColombiaLocation[] = [
  {
    department: 'Bogota D.C.',
    municipalities: ['Bogota D.C.'],
  },
  {
    department: 'Antioquia',
    municipalities: ['Medellin', 'Bello', 'Itagui', 'Envigado', 'Rionegro', 'Apartado'],
  },
  {
    department: 'Valle del Cauca',
    municipalities: ['Cali', 'Buenaventura', 'Palmira', 'Tulua', 'Yumbo', 'Cartago'],
  },
  {
    department: 'Atlantico',
    municipalities: ['Barranquilla', 'Soledad', 'Malambo', 'Sabanalarga'],
  },
  {
    department: 'Santander',
    municipalities: ['Bucaramanga', 'Floridablanca', 'Giron', 'Piedecuesta', 'Barrancabermeja'],
  },
  {
    department: 'Putumayo',
    municipalities: ['Mocoa', 'Puerto Asís', 'Puerto Asis', 'Orito', 'Sibundoy', 'Villagarzon', 'Valle del Guamuez'],
  },
  {
    department: 'Narino',
    municipalities: ['Pasto', 'Tumaco', 'Ipiales', 'Tuquerres'],
  },
  {
    department: 'Cundinamarca',
    municipalities: ['Soacha', 'Chia', 'Zipaquira', 'Facatativa', 'Fusagasuga', 'Mosquera'],
  },
  {
    department: 'Bolivar',
    municipalities: ['Cartagena', 'Magangue', 'Turbaco', 'Arjona'],
  },
  {
    department: 'Caldas',
    municipalities: ['Manizales', 'La Dorada', 'Chinchina', 'Villamaria'],
  },
  {
    department: 'Risaralda',
    municipalities: ['Pereira', 'Dosquebradas', 'Santa Rosa de Cabal'],
  },
  {
    department: 'Quindio',
    municipalities: ['Armenia', 'Calarca', 'Montenegro', 'Quimbaya'],
  },
  {
    department: 'Huila',
    municipalities: ['Neiva', 'Pitalito', 'Garzon', 'La Plata'],
  },
  {
    department: 'Tolima',
    municipalities: ['Ibague', 'Espinal', 'Melgar', 'Chaparral'],
  },
  {
    department: 'Norte de Santander',
    municipalities: ['Cucuta', 'Ocana', 'Villa del Rosario', 'Los Patios'],
  },
  {
    department: 'Meta',
    municipalities: ['Villavicencio', 'Acacias', 'Granada', 'Puerto Lopez'],
  },
  {
    department: 'Boyaca',
    municipalities: ['Tunja', 'Duitama', 'Sogamoso', 'Chiquinquira'],
  },
  {
    department: 'Cauca',
    municipalities: ['Popayan', 'Santander de Quilichao', 'Puerto Tejada'],
  },
  {
    department: 'Cordoba',
    municipalities: ['Monteria', 'Cerete', 'Sahagun', 'Lorica'],
  },
  {
    department: 'Cesar',
    municipalities: ['Valledupar', 'Aguachica', 'Agustin Codazzi'],
  },
  {
    department: 'Magdalena',
    municipalities: ['Santa Marta', 'Cienaga', 'Fundacion'],
  },
  {
    department: 'Sucre',
    municipalities: ['Sincelejo', 'Corozal', 'San Marcos'],
  },
  {
    department: 'Casanare',
    municipalities: ['Yopal', 'Aguazul', 'Villanueva'],
  },
  {
    department: 'Caqueta',
    municipalities: ['Florencia', 'San Vicente del Caguan'],
  },
  {
    department: 'Choco',
    municipalities: ['Quibdo', 'Istmina'],
  },
  {
    department: 'Arauca',
    municipalities: ['Arauca', 'Saravena', 'Tame'],
  },
  {
    department: 'Guajira',
    municipalities: ['Riohacha', 'Maicao', 'Uribia'],
  },
  {
    department: 'San Andres y Providencia',
    municipalities: ['San Andres', 'Providencia'],
  },
  {
    department: 'Amazonas',
    municipalities: ['Leticia', 'Puerto Narino'],
  },
  {
    department: 'Guainia',
    municipalities: ['Inirida'],
  },
  {
    department: 'Guaviare',
    municipalities: ['San Jose del Guaviare'],
  },
  {
    department: 'Vaupes',
    municipalities: ['Mitu'],
  },
  {
    department: 'Vichada',
    municipalities: ['Puerto Carreno'],
  },
];

export interface ColombiaDepartment {
  code: string;
  name: string;
  department: string;
  capital: string;
  cities: string[];
  municipalities: string[];
}

export const COLOMBIAN_DEPARTMENTS: ColombiaDepartment[] = COLOMBIA_LOCATIONS.map((l) => ({
  code: l.department === 'Putumayo' ? 'PUT' : l.department.substring(0, 3).toUpperCase(),
  name: l.department,
  department: l.department,
  capital: l.municipalities[0],
  cities: l.municipalities,
  municipalities: l.municipalities,
}));

export const COLOMBIA_DEPARTMENTS = COLOMBIAN_DEPARTMENTS;

export interface HabeasDataSummary {
  title: string;
  law: string;
  purpose: string;
  rights: string[];
  zeroAiCommitment: string;
}

export const HABEAS_DATA_SUMMARY: HabeasDataSummary = {
  title: 'Politica de Tratamiento de Datos Personales (Ley 1581 de 2012)',
  law: 'Cumplimiento estricto del regimen general de proteccion de datos personales de Colombia.',
  purpose:
    'UniSaaS recolecta y trata sus datos comerciales, contables y tributarios exclusivamente para la operacion del software, emision de comprobantes, gestion de cartera y soporte.',
  rights: [
    'Conocer, actualizar y rectificar sus datos personales frente a UniSaaS.',
    'Solicitar prueba de la autorizacion otorgada.',
    'Ser informado sobre el uso que se le ha dado a sus datos.',
    'Revocar la autorizacion o solicitar la supresion del dato cuando sea legalmente procedente.',
  ],
  zeroAiCommitment:
    'UniSaaS no comercializa, no transfiere a terceros ni utiliza sus datos contables para entrenamiento no autorizado de modelos.',
};
