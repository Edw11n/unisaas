# unisaas_mobile_api.api.AccountingPUCAccountsApi

## Load the API package
```dart
import 'package:unisaas_mobile_api/api.dart';
```

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**accountControllerCreateAccount**](AccountingPUCAccountsApi.md#accountcontrollercreateaccount) | **POST** /api/v1/accounting/accounts | Crear una nueva cuenta PUC en el plan contable
[**accountControllerGetAccountById**](AccountingPUCAccountsApi.md#accountcontrollergetaccountbyid) | **GET** /api/v1/accounting/accounts/{id} | Consultar una cuenta PUC por ID
[**accountControllerGetAccounts**](AccountingPUCAccountsApi.md#accountcontrollergetaccounts) | **GET** /api/v1/accounting/accounts | Consultar el catálogo de cuentas PUC del inquilino (con RLS)


# **accountControllerCreateAccount**
> accountControllerCreateAccount()

Crear una nueva cuenta PUC en el plan contable

### Example
```dart
import 'package:unisaas_mobile_api/api.dart';
// TODO Configure HTTP Bearer authorization: bearer
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingPUCAccountsApi();

try {
    api_instance.accountControllerCreateAccount();
} catch (e) {
    print('Exception when calling AccountingPUCAccountsApi->accountControllerCreateAccount: $e\n');
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

# **accountControllerGetAccountById**
> accountControllerGetAccountById(id)

Consultar una cuenta PUC por ID

### Example
```dart
import 'package:unisaas_mobile_api/api.dart';
// TODO Configure HTTP Bearer authorization: bearer
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingPUCAccountsApi();
final id = id_example; // String | 

try {
    api_instance.accountControllerGetAccountById(id);
} catch (e) {
    print('Exception when calling AccountingPUCAccountsApi->accountControllerGetAccountById: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **id** | **String**|  | 

### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **accountControllerGetAccounts**
> accountControllerGetAccounts()

Consultar el catálogo de cuentas PUC del inquilino (con RLS)

### Example
```dart
import 'package:unisaas_mobile_api/api.dart';
// TODO Configure HTTP Bearer authorization: bearer
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingPUCAccountsApi();

try {
    api_instance.accountControllerGetAccounts();
} catch (e) {
    print('Exception when calling AccountingPUCAccountsApi->accountControllerGetAccounts: $e\n');
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

