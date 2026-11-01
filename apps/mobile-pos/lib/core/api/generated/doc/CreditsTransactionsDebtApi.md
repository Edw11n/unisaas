# unisaas_mobile_api.api.CreditsTransactionsDebtApi

## Load the API package
```dart
import 'package:unisaas_mobile_api/api.dart';
```

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**creditControllerGetCreditHistory**](CreditsTransactionsDebtApi.md#creditcontrollergetcredithistory) | **GET** /api/v1/credits/transactions/{thirdPartyId} | Consultar estado de cuenta e historial de créditos/abonos de un tercero
[**creditControllerRegisterTransaction**](CreditsTransactionsDebtApi.md#creditcontrollerregistertransaction) | **POST** /api/v1/credits/transactions | Registrar cargo por venta a crédito o abono a cartera


# **creditControllerGetCreditHistory**
> creditControllerGetCreditHistory(thirdPartyId)

Consultar estado de cuenta e historial de créditos/abonos de un tercero

### Example
```dart
import 'package:unisaas_mobile_api/api.dart';
// TODO Configure HTTP Bearer authorization: bearer
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken(yourTokenGeneratorFunction);

final api_instance = CreditsTransactionsDebtApi();
final thirdPartyId = thirdPartyId_example; // String | 

try {
    api_instance.creditControllerGetCreditHistory(thirdPartyId);
} catch (e) {
    print('Exception when calling CreditsTransactionsDebtApi->creditControllerGetCreditHistory: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **thirdPartyId** | **String**|  | 

### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **creditControllerRegisterTransaction**
> creditControllerRegisterTransaction()

Registrar cargo por venta a crédito o abono a cartera

### Example
```dart
import 'package:unisaas_mobile_api/api.dart';
// TODO Configure HTTP Bearer authorization: bearer
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken(yourTokenGeneratorFunction);

final api_instance = CreditsTransactionsDebtApi();

try {
    api_instance.creditControllerRegisterTransaction();
} catch (e) {
    print('Exception when calling CreditsTransactionsDebtApi->creditControllerRegisterTransaction: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

