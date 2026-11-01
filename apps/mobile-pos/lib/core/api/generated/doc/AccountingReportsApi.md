# unisaas_mobile_api.api.AccountingReportsApi

## Load the API package
```dart
import 'package:unisaas_mobile_api/api.dart';
```

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**reportControllerGetTrialBalance**](AccountingReportsApi.md#reportcontrollergettrialbalance) | **GET** /api/v1/accounting/reports/trial-balance | Generar balance de comprobación (Sumas y Saldos) para el inquilino


# **reportControllerGetTrialBalance**
> reportControllerGetTrialBalance()

Generar balance de comprobación (Sumas y Saldos) para el inquilino

### Example
```dart
import 'package:unisaas_mobile_api/api.dart';
// TODO Configure HTTP Bearer authorization: bearer
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingReportsApi();

try {
    api_instance.reportControllerGetTrialBalance();
} catch (e) {
    print('Exception when calling AccountingReportsApi->reportControllerGetTrialBalance: $e\n');
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

