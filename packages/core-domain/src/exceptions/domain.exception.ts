export abstract class DomainException extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidMoneyException extends DomainException {
  constructor(message = 'Valor monetario inválido o no finito') {
    super(message);
  }
}

export class NegativeMoneyException extends DomainException {
  constructor(message = 'El valor monetario no puede ser negativo') {
    super(message);
  }
}

export class InvalidQuantityException extends DomainException {
  constructor(message = 'Cantidad de inventario inválida') {
    super(message);
  }
}

export class NegativeQuantityException extends DomainException {
  constructor(message = 'La cantidad no puede ser negativa en esta operación') {
    super(message);
  }
}

export class InvalidTaxRateException extends DomainException {
  constructor(message = 'Tasa de impuesto inválida (debe estar entre 0% y 100%)') {
    super(message);
  }
}

export class InvalidUUIDException extends DomainException {
  constructor(message = 'Identificador UUID v4 inválido') {
    super(message);
  }
}

