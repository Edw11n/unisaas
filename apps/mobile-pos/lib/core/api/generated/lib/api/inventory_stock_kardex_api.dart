//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class InventoryStockKardexApi {
  InventoryStockKardexApi([ApiClient? apiClient])
      : apiClient = apiClient ?? defaultApiClient;

  final ApiClient apiClient;

  /// Registrar ajuste manual de inventario (Entrada o Salida)
  ///
  /// Note: This method returns the HTTP [Response].
  Future<Response> stockControllerAdjustStockWithHttpInfo({
    Future<void>? abortTrigger,
  }) async {
    // ignore: prefer_const_declarations
    final path = r'/api/v1/inventory/stock/adjustments';

    // ignore: prefer_final_locals
    Object? postBody;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    const contentTypes = <String>[];

    return apiClient.invokeAPI(
      path,
      'POST',
      queryParams,
      postBody,
      headerParams,
      formParams,
      contentTypes.isEmpty ? null : contentTypes.first,
      abortTrigger: abortTrigger,
    );
  }

  /// Registrar ajuste manual de inventario (Entrada o Salida)
  Future<void> stockControllerAdjustStock({
    Future<void>? abortTrigger,
  }) async {
    final response = await stockControllerAdjustStockWithHttpInfo(
      abortTrigger: abortTrigger,
    );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
  }

  /// Consultar balances de existencias por bodega (con RLS)
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] warehouseId (required):
  Future<Response> stockControllerGetBalancesWithHttpInfo(
    String warehouseId, {
    Future<void>? abortTrigger,
  }) async {
    // ignore: prefer_const_declarations
    final path = r'/api/v1/inventory/stock/balances';

    // ignore: prefer_final_locals
    Object? postBody;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    queryParams.addAll(_queryParams('', 'warehouseId', warehouseId));

    const contentTypes = <String>[];

    return apiClient.invokeAPI(
      path,
      'GET',
      queryParams,
      postBody,
      headerParams,
      formParams,
      contentTypes.isEmpty ? null : contentTypes.first,
      abortTrigger: abortTrigger,
    );
  }

  /// Consultar balances de existencias por bodega (con RLS)
  ///
  /// Parameters:
  ///
  /// * [String] warehouseId (required):
  Future<void> stockControllerGetBalances(
    String warehouseId, {
    Future<void>? abortTrigger,
  }) async {
    final response = await stockControllerGetBalancesWithHttpInfo(
      warehouseId,
      abortTrigger: abortTrigger,
    );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
  }

  /// Consultar historial de movimientos (Kardex) para una variante
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] variantId (required):
  Future<Response> stockControllerGetKardexEntriesWithHttpInfo(
    String variantId, {
    Future<void>? abortTrigger,
  }) async {
    // ignore: prefer_const_declarations
    final path = r'/api/v1/inventory/stock/kardex/{variantId}'
        .replaceAll('{variantId}', variantId);

    // ignore: prefer_final_locals
    Object? postBody;

    final queryParams = <QueryParam>[];
    final headerParams = <String, String>{};
    final formParams = <String, String>{};

    const contentTypes = <String>[];

    return apiClient.invokeAPI(
      path,
      'GET',
      queryParams,
      postBody,
      headerParams,
      formParams,
      contentTypes.isEmpty ? null : contentTypes.first,
      abortTrigger: abortTrigger,
    );
  }

  /// Consultar historial de movimientos (Kardex) para una variante
  ///
  /// Parameters:
  ///
  /// * [String] variantId (required):
  Future<void> stockControllerGetKardexEntries(
    String variantId, {
    Future<void>? abortTrigger,
  }) async {
    final response = await stockControllerGetKardexEntriesWithHttpInfo(
      variantId,
      abortTrigger: abortTrigger,
    );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
  }
}
