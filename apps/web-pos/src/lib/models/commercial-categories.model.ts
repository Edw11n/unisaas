export interface CommercialCategoryItem {
  id: string;
  code: string;
  name: string;
  family:
    | 'RETAIL'
    | 'GASTRONOMIA'
    | 'MODA'
    | 'SALUD'
    | 'SERVICIOS'
    | 'COMERCIO'
    | 'ESPECIALIZADO'
    | 'ENTRETENIMIENTO'
    | 'AGROPECUARIO'
    | 'GENERAL';
  description: string;
  icon: string;
  capabilities: {
    quickSale?: boolean;
    scaleSupport?: boolean;
    fractionalUnits?: boolean;
    barcodeScanner?: boolean;
    creditFiado?: boolean;
    wholesalePricing?: boolean;
    multiWarehouse?: boolean;
    orderNotes?: boolean;
    kitchenPrint?: boolean;
    tipSupport?: boolean;
    variantMatrix?: boolean;
    returnPolicy?: boolean;
    lotTracking?: boolean;
    expirationAlerts?: boolean;
    workOrders?: boolean;
    customAttributes?: boolean;
  };
}

export const COLOMBIA_COMMERCIAL_CATEGORIES: CommercialCategoryItem[] = [
  // 1. Retail & Abastos
  {
    id: 'TIENDA_BARRIO',
    code: 'TIENDA_BARRIO',
    name: 'Tienda de Barrio / Abarrotes / Viveres',
    family: 'RETAIL',
    description: 'Ventas rapidas de mostrador, balanza digital, unidades fraccionarias y fiado recurrente.',
    icon: 'store',
    capabilities: { quickSale: true, scaleSupport: true, fractionalUnits: true, barcodeScanner: true, creditFiado: true },
  },
  {
    id: 'MINIMERCADO',
    code: 'MINIMERCADO',
    name: 'Minimercado / Supermercado de Cercania',
    family: 'RETAIL',
    description: 'Autoservicio y mostrador, lector de codigo de barras continuo, control estricto de SKU e IVA 0% canasta basica.',
    icon: 'shopping-cart',
    capabilities: { quickSale: true, barcodeScanner: true, scaleSupport: true, creditFiado: true },
  },
  {
    id: 'FRUVER',
    code: 'FRUVER',
    name: 'Fruver / Frutas, Verduras y Plaza',
    family: 'RETAIL',
    description: 'Pesaje directo en balanza con precision de 3 decimales, productos exentos y control de mermas.',
    icon: 'apple',
    capabilities: { scaleSupport: true, fractionalUnits: true, quickSale: true, creditFiado: true },
  },
  {
    id: 'CARNICERIA_PESCADERIA',
    code: 'CARNICERIA_PESCADERIA',
    name: 'Carniceria / Salsamentaria / Pescaderia',
    family: 'RETAIL',
    description: 'Venta por peso (kilos y libras), cortes refrigerados, alta velocidad de mostrador y fiado vecinal.',
    icon: 'beef',
    capabilities: { scaleSupport: true, fractionalUnits: true, quickSale: true, creditFiado: true },
  },
  {
    id: 'LICORERA_CIGARRERIA',
    code: 'LICORERA_CIGARRERIA',
    name: 'Licorera / Cigarreria / Estanco',
    family: 'RETAIL',
    description: 'Control de inventario por botella y canasta, venta rapida en mostrador y horarios extendidos.',
    icon: 'wine',
    capabilities: { quickSale: true, barcodeScanner: true },
  },

  // 2. Gastronomia & Alimentos
  {
    id: 'RESTAURANTE',
    code: 'RESTAURANTE',
    name: 'Restaurante Tradicional / Cafeteria / Piqueteadero',
    family: 'GASTRONOMIA',
    description: 'Comandas a cocina, notas de preparacion, propina voluntaria 10% e Impuesto Nacional al Consumo (INC 8%).',
    icon: 'utensils',
    capabilities: { quickSale: true, orderNotes: true, kitchenPrint: true, tipSupport: true },
  },
  {
    id: 'COMIDAS_RAPIDAS',
    code: 'COMIDAS_RAPIDAS',
    name: 'Comidas Rapidas / Pizzeria / Hamburgueseria',
    family: 'GASTRONOMIA',
    description: 'Atencion agil en mostrador y mesa, domicilios locales, combos e Impoconsumo INC 8%.',
    icon: 'pizza',
    capabilities: { quickSale: true, orderNotes: true, kitchenPrint: true, tipSupport: true },
  },
  {
    id: 'PANADERIA_PASTELERIA',
    code: 'PANADERIA_PASTELERIA',
    name: 'Panaderia / Pasteleria / Reposteria',
    family: 'GASTRONOMIA',
    description: 'Venta rapida de mostrador, combos de cafeteria y rotacion diaria de panaderia.',
    icon: 'croissant',
    capabilities: { quickSale: true, orderNotes: true, tipSupport: true },
  },
  {
    id: 'HELADERIA_CAFES',
    code: 'HELADERIA_CAFES',
    name: 'Heladeria / Cafes Especiales / Fruteria',
    family: 'GASTRONOMIA',
    description: 'Cobro rapido de mesa y barra, adiciones, postres y preparaciones especiales.',
    icon: 'ice-cream',
    capabilities: { quickSale: true, orderNotes: true, tipSupport: true },
  },
  {
    id: 'GASTROBAR_DISCOTECA',
    code: 'GASTROBAR_DISCOTECA',
    name: 'Bar / Gastrobar / Discoteca / Taberna',
    family: 'ENTRETENIMIENTO',
    description: 'Cuentas abiertas, control de mesas, Impoconsumo 8% y liquidacion agil de licores.',
    icon: 'beer',
    capabilities: { quickSale: true, orderNotes: true, tipSupport: true },
  },

  // 3. Moda, Confeccion & Calzado
  {
    id: 'ROPA_CALZADO',
    code: 'ROPA_CALZADO',
    name: 'Boutique / Ropa / Calzado y Confeccion',
    family: 'MODA',
    description: 'Gestion de inventario por matriz de talla y color, lector de codigo de barras y politicas de cambios.',
    icon: 'shirt',
    capabilities: { variantMatrix: true, barcodeScanner: true, returnPolicy: true, quickSale: true },
  },
  {
    id: 'JOYERIA_RELOJERIA',
    code: 'JOYERIA_RELOJERIA',
    name: 'Joyeria / Relojeria / Bisuteria',
    family: 'MODA',
    description: 'Catalogo de alto valor, control de garantias y registro de numero de serie o referencia.',
    icon: 'gem',
    capabilities: { barcodeScanner: true, customAttributes: true, quickSale: true },
  },
  {
    id: 'SASTRERIA_MODISTERIA',
    code: 'SASTRERIA_MODISTERIA',
    name: 'Sastreria / Modisteria / Arreglos',
    family: 'MODA',
    description: 'Recepcion de prendas, cobro de servicios de confeccion y venta de telas e insumos.',
    icon: 'scissors',
    capabilities: { workOrders: true, quickSale: true, customAttributes: true },
  },

  // 4. Salud, Belleza & Cuidado
  {
    id: 'DROGUERIA_FARMACIA',
    code: 'DROGUERIA_FARMACIA',
    name: 'Drogueria / Farmacia / Perfumeria',
    family: 'SALUD',
    description: 'Control de lotes, fechas de vencimiento, medicamentos exentos/gravados y venta de mostrador.',
    icon: 'pill',
    capabilities: { lotTracking: true, expirationAlerts: true, quickSale: true, barcodeScanner: true },
  },
  {
    id: 'VETERINARIA_PETSHOP',
    code: 'VETERINARIA_PETSHOP',
    name: 'Veterinaria / Pet Shop / Alimentos Mascotas',
    family: 'SALUD',
    description: 'Venta de concentrados por kilos decimales, medicamentos veterinarios y servicios de guarderia/bano.',
    icon: 'dog',
    capabilities: { scaleSupport: true, fractionalUnits: true, barcodeScanner: true, quickSale: true },
  },
  {
    id: 'TIENDA_NATURISTA',
    code: 'TIENDA_NATURISTA',
    name: 'Tienda Naturista / Productos Bio',
    family: 'SALUD',
    description: 'Productos organicos, suplementos dietarios, control de vencimientos y atencion personalizada.',
    icon: 'leaf',
    capabilities: { lotTracking: true, expirationAlerts: true, barcodeScanner: true, quickSale: true },
  },
  {
    id: 'OPTICA',
    code: 'OPTICA',
    name: 'Optica / Consultorio Visual',
    family: 'SALUD',
    description: 'Monturas, lentes oftalmicos, registro de formula medica y venta de accesorios.',
    icon: 'glasses',
    capabilities: { customAttributes: true, workOrders: true, barcodeScanner: true },
  },
  {
    id: 'GIMNASIO_FITNESS',
    code: 'GIMNASIO_FITNESS',
    name: 'Gimnasio / Fitness / Acondicionamiento',
    family: 'SALUD',
    description: 'Control de membresias con vigencia en dias, registro de documento CC y venta de hidratacion.',
    icon: 'dumbbell',
    capabilities: { expirationAlerts: true, quickSale: true, customAttributes: true },
  },
  {
    id: 'SPA_ESTETICA',
    code: 'SPA_ESTETICA',
    name: 'Spa / Estetica / Centro de Unas',
    family: 'SERVICIOS',
    description: 'Servicios por cita, comisiones a esteticistas y venta cruzada de cosmeticos.',
    icon: 'sparkles',
    capabilities: { workOrders: true, quickSale: true, customAttributes: true },
  },
  {
    id: 'BARBERIA_PELUQUERIA',
    code: 'BARBERIA_PELUQUERIA',
    name: 'Barberia / Peluqueria / Salon de Belleza',
    family: 'SERVICIOS',
    description: 'Cobro por servicios de corte y peinado, comisiones a barberos y venta de ceras/tintes.',
    icon: 'scissors',
    capabilities: { workOrders: true, quickSale: true, customAttributes: true },
  },

  // 5. Ferreteria, Construccion & Especializado
  {
    id: 'FERRETERIA',
    code: 'FERRETERIA',
    name: 'Ferreteria / Deposito de Materiales',
    family: 'ESPECIALIZADO',
    description: 'Precios mayoristas, credito a maestros de obra, multiples bodegas y unidades fraccionarias (metros, kilos).',
    icon: 'wrench',
    capabilities: { quickSale: true, creditFiado: true, wholesalePricing: true, multiWarehouse: true, fractionalUnits: true },
  },
  {
    id: 'DISTRIBUIDORA_MAYORISTA',
    code: 'DISTRIBUIDORA_MAYORISTA',
    name: 'Distribuidora / Mayorista / Deposito',
    family: 'ESPECIALIZADO',
    description: 'Escalas de precios por volumen (caja, bulto, estiba), despacho a clientes y cartera comercial.',
    icon: 'boxes',
    capabilities: { wholesalePricing: true, multiWarehouse: true, creditFiado: true, barcodeScanner: true },
  },
  {
    id: 'REPUESTOS_AUTOPARTES',
    code: 'REPUESTOS_AUTOPARTES',
    name: 'Repuestos / Autopartes / Baterias',
    family: 'ESPECIALIZADO',
    description: 'Catalogo extenso por marca y modelo de vehiculo, codigos OEM y venta de mostrador.',
    icon: 'cog',
    capabilities: { barcodeScanner: true, customAttributes: true, wholesalePricing: true },
  },
  {
    id: 'PINTURAS_ACABADOS',
    code: 'PINTURAS_ACABADOS',
    name: 'Almacen de Pinturas / Acabados',
    family: 'ESPECIALIZADO',
    description: 'Venta por galones y cuartos, mezclas personalizadas y credito a contratistas.',
    icon: 'paint-roller',
    capabilities: { fractionalUnits: true, customAttributes: true, creditFiado: true },
  },
  {
    id: 'AGROPECUARIO_AGROQUIMICA',
    code: 'AGROPECUARIO_AGROQUIMICA',
    name: 'Insumos Agropecuarios / Semillas / Veterinaria Rural',
    family: 'AGROPECUARIO',
    description: 'Fertilizantes, concentrados por bulto, herramientas de campo y credito agropecuario.',
    icon: 'sprout',
    capabilities: { wholesalePricing: true, fractionalUnits: true, creditFiado: true },
  },

  // 6. Comercio General & Tecnologia
  {
    id: 'PAPELERIA_MISCELANEA',
    code: 'PAPELERIA_MISCELANEA',
    name: 'Papeleria / Miscelanea / Fotocopias',
    family: 'COMERCIO',
    description: 'Articulos de oficina junto a servicios no inventariables inmediatos (copias, impresiones, tramites).',
    icon: 'file-text',
    capabilities: { quickSale: true, barcodeScanner: true, customAttributes: true },
  },
  {
    id: 'TECNOLOGIA_CELULARES',
    code: 'TECNOLOGIA_CELULARES',
    name: 'Telefonia / Celulares / Accesorios',
    family: 'COMERCIO',
    description: 'Registro de serial/IMEI, repuestos, servicio tecnico y venta de accesorios moviles.',
    icon: 'smartphone',
    capabilities: { customAttributes: true, workOrders: true, barcodeScanner: true },
  },
  {
    id: 'VARIEDADES_CACHARRERIA',
    code: 'VARIEDADES_CACHARRERIA',
    name: 'Cacharreria / Variedades / Todo a Mil',
    family: 'COMERCIO',
    description: 'Gran rotacion de articulos pequenos a precios fijos, cobro rapido y mostrador agil.',
    icon: 'tag',
    capabilities: { quickSale: true, barcodeScanner: true },
  },
  {
    id: 'MUEBLERIA_HOGAR',
    code: 'MUEBLERIA_HOGAR',
    name: 'Muebleria / Decoracion / Colchones',
    family: 'COMERCIO',
    description: 'Venta de muebles, electrodomesticos, planes de pago a cuotas y despachos a domicilio.',
    icon: 'sofa',
    capabilities: { creditFiado: true, customAttributes: true, wholesalePricing: true },
  },
  {
    id: 'FLORISTERIA_VIVERO',
    code: 'FLORISTERIA_VIVERO',
    name: 'Floristeria / Plantas / Vivero',
    family: 'COMERCIO',
    description: 'Arreglos florales, plantas ornamentales, abonos e insumos de jardineria.',
    icon: 'flower',
    capabilities: { quickSale: true, customAttributes: true },
  },
  {
    id: 'JUGUETERIA_PINATERIA',
    code: 'JUGUETERIA_PINATERIA',
    name: 'Jugueteria / Pinateria / Fiestas',
    family: 'COMERCIO',
    description: 'Juguetes, articulos para celebraciones, combos de decoracion y ventas de temporada.',
    icon: 'gift',
    capabilities: { quickSale: true, barcodeScanner: true },
  },
  {
    id: 'LIBRERIA_ARTE',
    code: 'LIBRERIA_ARTE',
    name: 'Libreria / Papeleria de Arte',
    family: 'COMERCIO',
    description: 'Textos escolares, literatura, oleos, lienzos y materiales especializados de dibujo.',
    icon: 'book',
    capabilities: { barcodeScanner: true, customAttributes: true },
  },

  // 7. Servicios & Mantenimiento
  {
    id: 'TALLER_AUTOMOTRIZ',
    code: 'TALLER_AUTOMOTRIZ',
    name: 'Taller Automotriz / Motos / Montallantas',
    family: 'SERVICIOS',
    description: 'Ordenes de trabajo con placa y kilometraje, cobro de mano de obra y repuestos de bodega.',
    icon: 'car',
    capabilities: { workOrders: true, quickSale: true, customAttributes: true },
  },
  {
    id: 'SERVICIOS',
    code: 'SERVICIOS',
    name: 'Servicios Tecnicos / Reparacion Electrodomesticos',
    family: 'SERVICIOS',
    description: 'Recepcion de equipos con diagnostico, cotizacion de reparacion y mano de obra.',
    icon: 'cpu',
    capabilities: { workOrders: true, quickSale: true, customAttributes: true },
  },
  {
    id: 'LAVANDERIA_TINTORERIA',
    code: 'LAVANDERIA_TINTORERIA',
    name: 'Lavanderia / Tintoreria / Planchado',
    family: 'SERVICIOS',
    description: 'Servicio por kilos de ropa o por prenda delicada, tickets de reclamo y fecha de entrega.',
    icon: 'shirt',
    capabilities: { scaleSupport: true, workOrders: true, quickSale: true },
  },
  {
    id: 'LAVADERO_AUTOS',
    code: 'LAVADERO_AUTOS',
    name: 'Lavadero de Autos / Car Wash',
    family: 'SERVICIOS',
    description: 'Servicios de lavado basico, grafitado, polichado y comisiones a operarios.',
    icon: 'droplet',
    capabilities: { quickSale: true, workOrders: true },
  },
  {
    id: 'PARQUEADERO',
    code: 'PARQUEADERO',
    name: 'Parqueadero / Estacionamiento',
    family: 'SERVICIOS',
    description: 'Control de ingreso y salida por placa vehicular, tarifa por minuto/hora o mensualidades.',
    icon: 'clock',
    capabilities: { quickSale: true, customAttributes: true },
  },
  {
    id: 'CONSULTORIA_PROFESIONAL',
    code: 'CONSULTORIA_PROFESIONAL',
    name: 'Consultoria / Asesoria / Servicios Profesionales',
    family: 'SERVICIOS',
    description: 'Honorarios por consulta, asesorias juridicas/contables y expedicion de recibos.',
    icon: 'briefcase',
    capabilities: { quickSale: true, customAttributes: true },
  },
  {
    id: 'EVENTOS_ALQUILER',
    code: 'EVENTOS_ALQUILER',
    name: 'Organizacion de Eventos / Alquiler Mobiliario',
    family: 'SERVICIOS',
    description: 'Alquiler de sillas, mesas, manteles, deposito de garantia y logistica de despacho.',
    icon: 'calendar',
    capabilities: { workOrders: true, creditFiado: true, customAttributes: true },
  },

  // 8. Opcion Universal
  {
    id: 'OTRO',
    code: 'OTRO',
    name: 'Otro Tipo de Negocio / Comercio General',
    family: 'GENERAL',
    description: 'Configuracion estandar versatil para cualquier actividad comercial con punto de venta.',
    icon: 'shopping-bag',
    capabilities: { quickSale: true, customAttributes: true, barcodeScanner: true, creditFiado: true },
  },
];
