import { Decimal } from '@unisaas/core-domain';

/**
 * Calculadora Canónica de Costo Promedio Ponderado (CPP) y Política de Precisión
 * según estándares NIIF / IAS 2 y especificaciones de base de datos PostgreSQL:
 * - Costo Unitario / CPP: 6 decimales (Decimal(18, 6))
 * - Valor Monetario de Inventario: 4 decimales (Decimal(20, 4))
 * - Cantidades físicas: 4 decimales (Decimal(18, 6))
 */
export class CppCalculator {
  public static readonly UNIT_COST_DECIMALS = 6;
  public static readonly INVENTORY_VALUE_DECIMALS = 4;
  public static readonly QUANTITY_DECIMALS = 4;
  public static readonly ROUNDING_MODE = Decimal.ROUND_HALF_UP;

  public static roundUnitCost(value: Decimal.Value): Decimal {
    return new Decimal(value).toDecimalPlaces(this.UNIT_COST_DECIMALS, this.ROUNDING_MODE);
  }

  public static roundInventoryValue(value: Decimal.Value): Decimal {
    return new Decimal(value).toDecimalPlaces(this.INVENTORY_VALUE_DECIMALS, this.ROUNDING_MODE);
  }

  public static roundQuantity(value: Decimal.Value): Decimal {
    return new Decimal(value).toDecimalPlaces(this.QUANTITY_DECIMALS, this.ROUNDING_MODE);
  }

  /**
   * Recalcula el saldo, valor total y Costo Promedio Ponderado ante una entrada (compra, traslado entrante o ajuste positivo).
   *
   * Fórmula canónica NIIF:
   * valorRecibido = round(cantidadRecibida × costoUnitario, 4)
   * nuevoValor = round(valorExistente + valorRecibido, 4)
   * nuevaCantidad = cantidadExistente + cantidadRecibida
   * nuevoCPP = round(nuevoValor / nuevaCantidad, 6)
   */
  public static calculateInbound(params: {
    currentQuantity: Decimal.Value;
    currentInventoryValue: Decimal.Value;
    currentAverageCost: Decimal.Value;
    incomingQuantity: Decimal.Value;
    incomingUnitCost: Decimal.Value;
  }) {
    const currentQty = new Decimal(params.currentQuantity);
    const currentVal = new Decimal(params.currentInventoryValue);
    const inQty = new Decimal(params.incomingQuantity);
    const inCost = new Decimal(params.incomingUnitCost);

    if (inQty.lte(0)) {
      throw new Error('La cantidad entrante debe ser estrictamente mayor a cero');
    }
    if (inCost.lt(0)) {
      throw new Error('El costo unitario no puede ser negativo');
    }

    const valorRecibido = this.roundInventoryValue(inQty.mul(inCost));
    const nuevoValor = this.roundInventoryValue(currentVal.plus(valorRecibido));
    const nuevaCantidad = this.roundQuantity(currentQty.plus(inQty));

    const nuevoCPP = nuevaCantidad.gt(0)
      ? this.roundUnitCost(nuevoValor.div(nuevaCantidad))
      : this.roundUnitCost(inCost);

    return {
      incomingValue: valorRecibido.toNumber(),
      newQuantity: nuevaCantidad.toNumber(),
      newInventoryValue: nuevoValor.toNumber(),
      newAverageCost: nuevoCPP.toNumber(),
    };
  }

  /**
   * Calcula el despacho o salida física a valor de CPP actual.
   *
   * Fórmula:
   * valorSalida = round(cantidadSalida × CPP, 4)
   * nuevoValor = round(valorExistente - valorSalida, 4)
   * nuevaCantidad = cantidadExistente - cantidadSalida
   *
   * Si la nueva cantidad llega a 0, el valor e inventario se fijan en 0.
   */
  public static calculateOutbound(params: {
    currentQuantity: Decimal.Value;
    currentInventoryValue: Decimal.Value;
    currentAverageCost: Decimal.Value;
    outgoingQuantity: Decimal.Value;
  }) {
    const currentQty = new Decimal(params.currentQuantity);
    const currentVal = new Decimal(params.currentInventoryValue);
    const currentCPP = new Decimal(params.currentAverageCost);
    const outQty = new Decimal(params.outgoingQuantity);

    if (outQty.lte(0)) {
      throw new Error('La cantidad a despachar debe ser mayor que cero');
    }

    if (currentQty.lt(outQty)) {
      throw new Error(
        `Existencias insuficientes para despacho: Disponible ${currentQty.toString()}, Requerido ${outQty.toString()}`,
      );
    }

    const valorSalida = this.roundInventoryValue(outQty.mul(currentCPP));
    const nuevaCantidad = this.roundQuantity(currentQty.minus(outQty));

    let nuevoValor: Decimal;
    let nuevoCPP: Decimal;

    if (nuevaCantidad.isZero()) {
      nuevoValor = new Decimal(0);
      nuevoCPP = new Decimal(0);
    } else {
      nuevoValor = this.roundInventoryValue(currentVal.minus(valorSalida));
      if (nuevoValor.lt(0)) {
        nuevoValor = new Decimal(0);
      }
      nuevoCPP = currentCPP; // El costo unitario promedio se mantiene constante en salidas
    }

    return {
      dispatchedValue: valorSalida.toNumber(),
      newQuantity: nuevaCantidad.toNumber(),
      newInventoryValue: nuevoValor.toNumber(),
      newAverageCost: nuevoCPP.toNumber(),
      appliedUnitCost: currentCPP.toNumber(),
    };
  }

  /**
   * Reversión de salida (anulación de venta POS / devolución de cliente).
   * Restaura existencias físicas reingresándolas al mismo costo unitario promedio de la salida.
   */
  public static reverseOutbound(params: {
    currentQuantity: Decimal.Value;
    currentInventoryValue: Decimal.Value;
    currentAverageCost: Decimal.Value;
    revertedQuantity: Decimal.Value;
    appliedUnitCost: Decimal.Value;
  }) {
    return this.calculateInbound({
      currentQuantity: params.currentQuantity,
      currentInventoryValue: params.currentInventoryValue,
      currentAverageCost: params.currentAverageCost,
      incomingQuantity: params.revertedQuantity,
      incomingUnitCost: params.appliedUnitCost,
    });
  }

  /**
   * Reversión de entrada (devolución a proveedor / anulación de compra).
   * Resta la cantidad y el valor de adquisición original, recalculando el CPP remanente.
   */
  public static reverseInbound(params: {
    currentQuantity: Decimal.Value;
    currentInventoryValue: Decimal.Value;
    revertedQuantity: Decimal.Value;
    originalUnitCost: Decimal.Value;
  }) {
    const currentQty = new Decimal(params.currentQuantity);
    const currentVal = new Decimal(params.currentInventoryValue);
    const revQty = new Decimal(params.revertedQuantity);
    const origCost = new Decimal(params.originalUnitCost);

    if (currentQty.lt(revQty)) {
      throw new Error('Existencias insuficientes para revertir la entrada previa');
    }

    const valorRevertido = this.roundInventoryValue(revQty.mul(origCost));
    const nuevaCantidad = this.roundQuantity(currentQty.minus(revQty));
    let nuevoValor = this.roundInventoryValue(currentVal.minus(valorRevertido));

    if (nuevaCantidad.isZero() || nuevoValor.lt(0)) {
      nuevoValor = new Decimal(0);
      return {
        newQuantity: 0,
        newInventoryValue: 0,
        newAverageCost: 0,
        revertedValue: valorRevertido.toNumber(),
      };
    }

    const nuevoCPP = this.roundUnitCost(nuevoValor.div(nuevaCantidad));

    return {
      newQuantity: nuevaCantidad.toNumber(),
      newInventoryValue: nuevoValor.toNumber(),
      newAverageCost: nuevoCPP.toNumber(),
      revertedValue: valorRevertido.toNumber(),
    };
  }
}
