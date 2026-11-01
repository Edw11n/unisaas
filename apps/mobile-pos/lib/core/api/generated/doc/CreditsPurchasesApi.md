# unisaas_mobile_api.api.CreditsPurchasesApi

## Load the API package
```dart
import 'package:unisaas_mobile_api/api.dart';
```

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**purchaseControllerCreatePurchase**](CreditsPurchasesApi.md#purchasecontrollercreatepurchase) | **POST** /api/v1/credits/purchases | Registrar una compra a proveedor (Contado o Crédito)
[**purchaseControllerGetPurchaseById**](CreditsPurchasesApi.md#purchasecontrollergetpurchasebyid) | **GET** /api/v1/credits/purchases/{id} | Consultar detalles completos de una compra por ID
[**purchaseControllerGetPurchases**](CreditsPurchasesApi.md#purchasecontrollergetpurchases) | **GET** /api/v1/credits/purchases | Listar compras a proveedores (con RLS)


# **purchaseControllerCreatePurchase**
> purchaseControllerCreatePurchase()

Registrar una compra a proveedor (Contado o Crédito)

### Example
```dart
import 'package:unisaas_mobile_api/api.dart';
// TODO Configure HTTP Bearer authorization: bearer
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken(yourTokenGeneratorFunction);

final api_instance = CreditsPurchasesApi();

try {
    api_instance.purchaseControllerCreatePurchase();
} catch (e) {
    print('Exception when calling CreditsPurchasesApi->purchaseControllerCreatePurchase: $e\n');
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

# **purchaseControllerGetPurchaseById**
> purchaseControllerGetPurchaseById(id)

Consultar detalles completos de una compra por ID

### Example
```dart
import 'package:unisaas_mobile_api/api.dart';
// TODO Configure HTTP Bearer authorization: bearer
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken(yourTokenGeneratorFunction);

final api_instance = CreditsPurchasesApi();
final id = id_example; // String | 

try {
    api_instance.purchaseControllerGetPurchaseById(id);
} catch (e) {
    print('Exception when calling CreditsPurchasesApi->purchaseControllerGetPurchaseById: $e\n');
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

# **purchaseControllerGetPurchases**
> purchaseControllerGetPurchases(branchId)

Listar compras a proveedores (con RLS)

### Example
```dart
import 'package:unisaas_mobile_api/api.dart';
// TODO Configure HTTP Bearer authorization: bearer
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken(yourTokenGeneratorFunction);

final api_instance = CreditsPurchasesApi();
final branchId = branchId_example; // String | 

try {
    api_instance.purchaseControllerGetPurchases(branchId);
} catch (e) {
    print('Exception when calling CreditsPurchasesApi->purchaseControllerGetPurchases: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **branchId** | **String**|  | 

### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

