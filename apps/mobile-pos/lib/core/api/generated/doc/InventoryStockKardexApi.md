# unisaas_mobile_api.api.InventoryStockKardexApi

## Load the API package
```dart
import 'package:unisaas_mobile_api/api.dart';
```

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**stockControllerAdjustStock**](InventoryStockKardexApi.md#stockcontrolleradjuststock) | **POST** /api/v1/inventory/stock/adjustments | Registrar ajuste manual de inventario (Entrada o Salida)
[**stockControllerGetBalances**](InventoryStockKardexApi.md#stockcontrollergetbalances) | **GET** /api/v1/inventory/stock/balances | Consultar balances de existencias por bodega (con RLS)
[**stockControllerGetKardexEntries**](InventoryStockKardexApi.md#stockcontrollergetkardexentries) | **GET** /api/v1/inventory/stock/kardex/{variantId} | Consultar historial de movimientos (Kardex) para una variante


# **stockControllerAdjustStock**
> stockControllerAdjustStock()

Registrar ajuste manual de inventario (Entrada o Salida)

### Example
```dart
import 'package:unisaas_mobile_api/api.dart';
// TODO Configure HTTP Bearer authorization: bearer
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken(yourTokenGeneratorFunction);

final api_instance = InventoryStockKardexApi();

try {
    api_instance.stockControllerAdjustStock();
} catch (e) {
    print('Exception when calling InventoryStockKardexApi->stockControllerAdjustStock: $e\n');
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

# **stockControllerGetBalances**
> stockControllerGetBalances(warehouseId)

Consultar balances de existencias por bodega (con RLS)

### Example
```dart
import 'package:unisaas_mobile_api/api.dart';
// TODO Configure HTTP Bearer authorization: bearer
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken(yourTokenGeneratorFunction);

final api_instance = InventoryStockKardexApi();
final warehouseId = warehouseId_example; // String | 

try {
    api_instance.stockControllerGetBalances(warehouseId);
} catch (e) {
    print('Exception when calling InventoryStockKardexApi->stockControllerGetBalances: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **warehouseId** | **String**|  | 

### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **stockControllerGetKardexEntries**
> stockControllerGetKardexEntries(variantId)

Consultar historial de movimientos (Kardex) para una variante

### Example
```dart
import 'package:unisaas_mobile_api/api.dart';
// TODO Configure HTTP Bearer authorization: bearer
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken(yourTokenGeneratorFunction);

final api_instance = InventoryStockKardexApi();
final variantId = variantId_example; // String | 

try {
    api_instance.stockControllerGetKardexEntries(variantId);
} catch (e) {
    print('Exception when calling InventoryStockKardexApi->stockControllerGetKardexEntries: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **variantId** | **String**|  | 

### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

