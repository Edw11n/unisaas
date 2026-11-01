//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.18

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class CreditsTransactionsDebtApi {
  CreditsTransactionsDebtApi([ApiClient? apiClient])
      : apiClient = apiClient ?? defaultApiClient;

  final ApiClient apiClient;

  /// Consultar estado de cuenta e historial de créditos/abonos de un tercero
  ///
  /// Note: This method returns the HTTP [Response].
  ///
  /// Parameters:
  ///
  /// * [String] thirdPartyId (required):
  Future<Response> creditControllerGetCreditHistoryWithHttpInfo(
    String thirdPartyId, {
    Future<void>? abortTrigger,
  }) async {
    // ignore: prefer_const_declarations
    final path = r'/api/v1/credits/transactions/{thirdPartyId}'
        .replaceAll('{thirdPartyId}', thirdPartyId);

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

  /// Consultar estado de cuenta e historial de créditos/abonos de un tercero
  ///
  /// Parameters:
  ///
  /// * [String] thirdPartyId (required):
  Future<void> creditControllerGetCreditHistory(
    String thirdPartyId, {
    Future<void>? abortTrigger,
  }) async {
    final response = await creditControllerGetCreditHistoryWithHttpInfo(
      thirdPartyId,
      abortTrigger: abortTrigger,
    );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
  }

  /// Registrar cargo por venta a crédito o abono a cartera
  ///
  /// Note: This method returns the HTTP [Response].
  Future<Response> creditControllerRegisterTransactionWithHttpInfo({
    Future<void>? abortTrigger,
  }) async {
    // ignore: prefer_const_declarations
    final path = r'/api/v1/credits/transactions';

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

  /// Registrar cargo por venta a crédito o abono a cartera
  Future<void> creditControllerRegisterTransaction({
    Future<void>? abortTrigger,
  }) async {
    final response = await creditControllerRegisterTransactionWithHttpInfo(
      abortTrigger: abortTrigger,
    );
    if (response.statusCode >= HttpStatus.badRequest) {
      throw ApiException(response.statusCode, await _decodeBodyBytes(response));
    }
  }
}
