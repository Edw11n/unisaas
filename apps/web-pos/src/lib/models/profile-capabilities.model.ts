/**
 * MODELO MAESTRO DE PERFILES COMERCIALES Y CAPACIDADES ACTIVABLES (FEATURE FLAGS)
 * Ecosistema: UNISAAS
 * Norma: Base común con capacidades activables por perfil (cero duplicación de código ni UI)
 */

export type CommercialGroup =
  | 'TIENDAS_Y_MINIMERCADOS'
  | 'ALIMENTOS_Y_BEBIDAS'
  | 'COMERCIO_ESPECIALIZADO'
  | 'SERVICIOS';

export type BusinessProfileType =
  // Grupo 1: Tiendas y minimercados
  | 'TIENDA_BARRIO'
  | 'MINIMERCADO'
  // Grupo 2: Alimentos y bebidas
  | 'RESTAURANTE'
  | 'CAFETERIA'
  | 'PANADERIA'
  // Grupo 3: Comercio especializado
  | 'FERRETERIA'
  | 'FRUVER'
  | 'PAPELERIA'
  | 'ROPA_ACCESORIOS'
  // Grupo 4: Servicios
  | 'ESTETICA_PELUQUERIA'
  | 'TALLER_MECANICA'
  | 'GIMNASIO_FITNESS'
  // Modalidad universal express (Benchmark Comercial)
  | 'VENTA_LIBRE_EXPRESS';

export interface ProfileCapabilities {
  // Identificación y Entrada
  enableBarcodeScanner: boolean;          // Lector continuo USB/HID para SKU/EAN13
  enableManualKeypad: boolean;            // Teclado numérico de cobro directo estilo Express
  enableDecimalScale: boolean;            // Balanza digital con cálculo de gramos/kilos decimales
  enableFractionalUnits: boolean;         // Unidades continuas fraccionarias (metros, litros, tubos)
  enableProductVariants: boolean;         // Matriz de atributos (talla, color, acabado)

  // Operación de Venta y Cartera
  enableCreditFiado: boolean;             // Venta a crédito con validación de cupo y cartera
  enableOrderTypeMesa: boolean;           // Atención a mesa y cuentas de salón
  enableOrderTypeDelivery: boolean;       // Gestión de domicilios y despacho
  enableQuickServiceItems: boolean;       // Artículos de servicio no inventariables (copias, mano de obra)
  enableCustomerDocRequired: boolean;     // Obligatoriedad de documento CC/NIT para cerrar venta

  // Reglas Fiscales Colombianas
  primaryTaxScheme: 'IVA_19' | 'INC_8' | 'EXENTO_0';
  requiresIncDisclaimer: boolean;        // Advertencia Art. 512-1 E.T. (Impoconsumo)
  allowVoluntaryTip: boolean;            // Propina voluntaria 10% (Ley 1935 de 2018)

  // Capacidades Avanzadas de Fase Futura
  enableKitchenTickets: boolean;         // Comanda térmica para cocina y bar
  enableRecipesBOM: boolean;              // Descarga de insumos por receta
  enableServiceAppointments: boolean;    // Agenda de citas y asignación de profesionales
  enableWorkOrders: boolean;             // Órdenes de trabajo, placas de vehículos y seriales
  enableExpirationTracking: boolean;      // Control de días/vigencia para planes y membresías
}

export interface BusinessProfileMetadata {
  id: BusinessProfileType;
  group: CommercialGroup;
  displayName: string;
  shortDescription: string;
  defaultCapabilities: ProfileCapabilities;
}

export const PROFILE_METADATA_REGISTRY: Record<BusinessProfileType, BusinessProfileMetadata> = {
  // --------------------------------------------------------------------------
  // GRUPO 1: TIENDAS Y MINIMERCADOS
  // --------------------------------------------------------------------------
  TIENDA_BARRIO: {
    id: 'TIENDA_BARRIO',
    group: 'TIENDAS_Y_MINIMERCADOS',
    displayName: 'Tienda de Barrio',
    shortDescription: 'Alta rotación de efectivo, catálogo de abarrotes, fiados y venta libre rápida.',
    defaultCapabilities: {
      enableBarcodeScanner: true,
      enableManualKeypad: true,
      enableDecimalScale: false,
      enableFractionalUnits: false,
      enableProductVariants: false,
      enableCreditFiado: true,
      enableOrderTypeMesa: false,
      enableOrderTypeDelivery: true,
      enableQuickServiceItems: false,
      enableCustomerDocRequired: false,
      primaryTaxScheme: 'EXENTO_0',
      requiresIncDisclaimer: false,
      allowVoluntaryTip: false,
      enableKitchenTickets: false,
      enableRecipesBOM: false,
      enableServiceAppointments: false,
      enableWorkOrders: false,
      enableExpirationTracking: false,
    },
  },
  MINIMERCADO: {
    id: 'MINIMERCADO',
    group: 'TIENDAS_Y_MINIMERCADOS',
    displayName: 'Minimercado & Autoservicio',
    shortDescription: 'Escaneo continuo con código de barras, control estricto de inventario y caja.',
    defaultCapabilities: {
      enableBarcodeScanner: true,
      enableManualKeypad: true,
      enableDecimalScale: true,
      enableFractionalUnits: false,
      enableProductVariants: false,
      enableCreditFiado: true,
      enableOrderTypeMesa: false,
      enableOrderTypeDelivery: true,
      enableQuickServiceItems: false,
      enableCustomerDocRequired: false,
      primaryTaxScheme: 'IVA_19',
      requiresIncDisclaimer: false,
      allowVoluntaryTip: false,
      enableKitchenTickets: false,
      enableRecipesBOM: false,
      enableServiceAppointments: false,
      enableWorkOrders: false,
      enableExpirationTracking: false,
    },
  },

  // --------------------------------------------------------------------------
  // GRUPO 2: ALIMENTOS Y BEBIDAS
  // --------------------------------------------------------------------------
  CAFETERIA: {
    id: 'CAFETERIA',
    group: 'ALIMENTOS_Y_BEBIDAS',
    displayName: 'Cafetería & Panadería',
    shortDescription: 'Ventas de barra rápida, consumo al paso, combos y régimen de Impoconsumo INC 8%.',
    defaultCapabilities: {
      enableBarcodeScanner: false,
      enableManualKeypad: true,
      enableDecimalScale: false,
      enableFractionalUnits: false,
      enableProductVariants: false,
      enableCreditFiado: false,
      enableOrderTypeMesa: true,
      enableOrderTypeDelivery: true,
      enableQuickServiceItems: false,
      enableCustomerDocRequired: false,
      primaryTaxScheme: 'INC_8',
      requiresIncDisclaimer: true,
      allowVoluntaryTip: true,
      enableKitchenTickets: true,
      enableRecipesBOM: false,
      enableServiceAppointments: false,
      enableWorkOrders: false,
      enableExpirationTracking: false,
    },
  },
  PANADERIA: {
    id: 'PANADERIA',
    group: 'ALIMENTOS_Y_BEBIDAS',
    displayName: 'Panadería & Repostería',
    shortDescription: 'Despacho en mostrador, alta afluencia matutina y vespertina, y combos.',
    defaultCapabilities: {
      enableBarcodeScanner: false,
      enableManualKeypad: true,
      enableDecimalScale: false,
      enableFractionalUnits: false,
      enableProductVariants: false,
      enableCreditFiado: true,
      enableOrderTypeMesa: true,
      enableOrderTypeDelivery: true,
      enableQuickServiceItems: false,
      enableCustomerDocRequired: false,
      primaryTaxScheme: 'INC_8',
      requiresIncDisclaimer: true,
      allowVoluntaryTip: true,
      enableKitchenTickets: false,
      enableRecipesBOM: false,
      enableServiceAppointments: false,
      enableWorkOrders: false,
      enableExpirationTracking: false,
    },
  },
  RESTAURANTE: {
    id: 'RESTAURANTE',
    group: 'ALIMENTOS_Y_BEBIDAS',
    displayName: 'Restaurante & Gastro',
    shortDescription: 'Servicio en salón con mesas, comandas, propina voluntaria e Impoconsumo INC 8%.',
    defaultCapabilities: {
      enableBarcodeScanner: false,
      enableManualKeypad: false,
      enableDecimalScale: false,
      enableFractionalUnits: false,
      enableProductVariants: false,
      enableCreditFiado: false,
      enableOrderTypeMesa: true,
      enableOrderTypeDelivery: true,
      enableQuickServiceItems: false,
      enableCustomerDocRequired: false,
      primaryTaxScheme: 'INC_8',
      requiresIncDisclaimer: true,
      allowVoluntaryTip: true,
      enableKitchenTickets: true,
      enableRecipesBOM: true,
      enableServiceAppointments: false,
      enableWorkOrders: false,
      enableExpirationTracking: false,
    },
  },

  // --------------------------------------------------------------------------
  // GRUPO 3: COMERCIO ESPECIALIZADO
  // --------------------------------------------------------------------------
  FERRETERIA: {
    id: 'FERRETERIA',
    group: 'COMERCIO_ESPECIALIZADO',
    displayName: 'Ferretería & Construcción',
    shortDescription: 'Unidades fraccionadas (metros, tubos, kilos), listas mayoristas y fiados a contratistas.',
    defaultCapabilities: {
      enableBarcodeScanner: true,
      enableManualKeypad: true,
      enableDecimalScale: false,
      enableFractionalUnits: true,
      enableProductVariants: false,
      enableCreditFiado: true,
      enableOrderTypeMesa: false,
      enableOrderTypeDelivery: true,
      enableQuickServiceItems: false,
      enableCustomerDocRequired: false,
      primaryTaxScheme: 'IVA_19',
      requiresIncDisclaimer: false,
      allowVoluntaryTip: false,
      enableKitchenTickets: false,
      enableRecipesBOM: false,
      enableServiceAppointments: false,
      enableWorkOrders: false,
      enableExpirationTracking: false,
    },
  },
  FRUVER: {
    id: 'FRUVER',
    group: 'COMERCIO_ESPECIALIZADO',
    displayName: 'Fruver & Verdulería',
    shortDescription: 'Ventas pesadas en balanza digital por kilogramo con 3 decimales, canasta familiar exenta.',
    defaultCapabilities: {
      enableBarcodeScanner: true,
      enableManualKeypad: true,
      enableDecimalScale: true,
      enableFractionalUnits: true,
      enableProductVariants: false,
      enableCreditFiado: true,
      enableOrderTypeMesa: false,
      enableOrderTypeDelivery: true,
      enableQuickServiceItems: false,
      enableCustomerDocRequired: false,
      primaryTaxScheme: 'EXENTO_0',
      requiresIncDisclaimer: false,
      allowVoluntaryTip: false,
      enableKitchenTickets: false,
      enableRecipesBOM: false,
      enableServiceAppointments: false,
      enableWorkOrders: false,
      enableExpirationTracking: false,
    },
  },
  PAPELERIA: {
    id: 'PAPELERIA',
    group: 'COMERCIO_ESPECIALIZADO',
    displayName: 'Papelería & Trámites',
    shortDescription: 'Combinación de artículos de escritorio físicos con servicios inmediatos no inventariables.',
    defaultCapabilities: {
      enableBarcodeScanner: true,
      enableManualKeypad: true,
      enableDecimalScale: false,
      enableFractionalUnits: false,
      enableProductVariants: false,
      enableCreditFiado: true,
      enableOrderTypeMesa: false,
      enableOrderTypeDelivery: false,
      enableQuickServiceItems: true,
      enableCustomerDocRequired: false,
      primaryTaxScheme: 'IVA_19',
      requiresIncDisclaimer: false,
      allowVoluntaryTip: false,
      enableKitchenTickets: false,
      enableRecipesBOM: false,
      enableServiceAppointments: false,
      enableWorkOrders: false,
      enableExpirationTracking: false,
    },
  },
  ROPA_ACCESORIOS: {
    id: 'ROPA_ACCESORIOS',
    group: 'COMERCIO_ESPECIALIZADO',
    displayName: 'Ropa & Accesorios de Moda',
    shortDescription: 'Control de inventario por variantes de talla y color, etiquetas de código de barras.',
    defaultCapabilities: {
      enableBarcodeScanner: true,
      enableManualKeypad: false,
      enableDecimalScale: false,
      enableFractionalUnits: false,
      enableProductVariants: true,
      enableCreditFiado: true,
      enableOrderTypeMesa: false,
      enableOrderTypeDelivery: true,
      enableQuickServiceItems: false,
      enableCustomerDocRequired: false,
      primaryTaxScheme: 'IVA_19',
      requiresIncDisclaimer: false,
      allowVoluntaryTip: false,
      enableKitchenTickets: false,
      enableRecipesBOM: false,
      enableServiceAppointments: false,
      enableWorkOrders: false,
      enableExpirationTracking: false,
    },
  },

  // --------------------------------------------------------------------------
  // GRUPO 4: SERVICIOS
  // --------------------------------------------------------------------------
  ESTETICA_PELUQUERIA: {
    id: 'ESTETICA_PELUQUERIA',
    group: 'SERVICIOS',
    displayName: 'Estética & Peluquería',
    shortDescription: 'Citas programadas, comisiones a estilistas y venta cruzada de cosméticos de mostrador.',
    defaultCapabilities: {
      enableBarcodeScanner: true,
      enableManualKeypad: true,
      enableDecimalScale: false,
      enableFractionalUnits: false,
      enableProductVariants: false,
      enableCreditFiado: false,
      enableOrderTypeMesa: false,
      enableOrderTypeDelivery: false,
      enableQuickServiceItems: true,
      enableCustomerDocRequired: true,
      primaryTaxScheme: 'IVA_19',
      requiresIncDisclaimer: false,
      allowVoluntaryTip: true,
      enableKitchenTickets: false,
      enableRecipesBOM: false,
      enableServiceAppointments: true,
      enableWorkOrders: false,
      enableExpirationTracking: false,
    },
  },
  TALLER_MECANICA: {
    id: 'TALLER_MECANICA',
    group: 'SERVICIOS',
    displayName: 'Taller Mecánico & Mantenimiento',
    shortDescription: 'Órdenes de servicio, control por placa vehicular, mano de obra y repuestos de bodega.',
    defaultCapabilities: {
      enableBarcodeScanner: true,
      enableManualKeypad: true,
      enableDecimalScale: false,
      enableFractionalUnits: true,
      enableProductVariants: false,
      enableCreditFiado: true,
      enableOrderTypeMesa: false,
      enableOrderTypeDelivery: false,
      enableQuickServiceItems: true,
      enableCustomerDocRequired: true,
      primaryTaxScheme: 'IVA_19',
      requiresIncDisclaimer: false,
      allowVoluntaryTip: false,
      enableKitchenTickets: false,
      enableRecipesBOM: false,
      enableServiceAppointments: true,
      enableWorkOrders: true,
      enableExpirationTracking: false,
    },
  },
  GIMNASIO_FITNESS: {
    id: 'GIMNASIO_FITNESS',
    group: 'SERVICIOS',
    displayName: 'Gimnasio & Centro Fitness',
    shortDescription: 'Planes por mensualidad/tiquetera con vigencia, documento obligatorio y venta de hidratación.',
    defaultCapabilities: {
      enableBarcodeScanner: true,
      enableManualKeypad: true,
      enableDecimalScale: false,
      enableFractionalUnits: false,
      enableProductVariants: false,
      enableCreditFiado: false,
      enableOrderTypeMesa: false,
      enableOrderTypeDelivery: false,
      enableQuickServiceItems: true,
      enableCustomerDocRequired: true,
      primaryTaxScheme: 'IVA_19',
      requiresIncDisclaimer: false,
      allowVoluntaryTip: false,
      enableKitchenTickets: false,
      enableRecipesBOM: false,
      enableServiceAppointments: false,
      enableWorkOrders: false,
      enableExpirationTracking: true,
    },
  },

  // --------------------------------------------------------------------------
  // MODALIDAD UNIVERSAL EXPRESS (BENCHMARK COMERCIAL)
  // --------------------------------------------------------------------------
  VENTA_LIBRE_EXPRESS: {
    id: 'VENTA_LIBRE_EXPRESS',
    group: 'TIENDAS_Y_MINIMERCADOS',
    displayName: 'Venta Libre Directa (Estilo Express)',
    shortDescription: 'Calculadora de cobro inmediato por monto sin catálogo previo, para ventas al paso.',
    defaultCapabilities: {
      enableBarcodeScanner: false,
      enableManualKeypad: true,
      enableDecimalScale: false,
      enableFractionalUnits: false,
      enableProductVariants: false,
      enableCreditFiado: true,
      enableOrderTypeMesa: false,
      enableOrderTypeDelivery: true,
      enableQuickServiceItems: false,
      enableCustomerDocRequired: false,
      primaryTaxScheme: 'IVA_19',
      requiresIncDisclaimer: false,
      allowVoluntaryTip: false,
      enableKitchenTickets: false,
      enableRecipesBOM: false,
      enableServiceAppointments: false,
      enableWorkOrders: false,
      enableExpirationTracking: false,
    },
  },
};

/**
 * Resuelve las capacidades finales de un perfil aplicando posibles anulaciones del comercio
 */
export function resolveProfileCapabilities(
  profile: BusinessProfileType,
  overrides?: Partial<ProfileCapabilities>
): ProfileCapabilities {
  const metadata = PROFILE_METADATA_REGISTRY[profile] ?? PROFILE_METADATA_REGISTRY.TIENDA_BARRIO;
  return {
    ...metadata.defaultCapabilities,
    ...(overrides ?? {}),
  };
}

/**
 * Retorna el nombre amigable del grupo comercial
 */
export function getCommercialGroupName(group: CommercialGroup): string {
  switch (group) {
    case 'TIENDAS_Y_MINIMERCADOS':
      return 'Tiendas y Minimercados';
    case 'ALIMENTOS_Y_BEBIDAS':
      return 'Alimentos y Bebidas';
    case 'COMERCIO_ESPECIALIZADO':
      return 'Comercio Especializado';
    case 'SERVICIOS':
      return 'Servicios';
  }
}
