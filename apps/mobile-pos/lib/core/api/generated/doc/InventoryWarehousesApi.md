# unisaas_mobile_api.api.InventoryWarehousesApi

## Load the API package
```dart
import 'package:unisaas_mobile_api/api.dart';
```

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**warehouseControllerCreateWarehouse**](InventoryWarehousesApi.md#warehousecontrollercreatewarehouse) | **POST** /api/v1/inventory/warehouses | Crear una nueva bodega o almacén
[**warehouseControllerGetWarehouses**](InventoryWarehousesApi.md#warehousecontrollergetwarehouses) | **GET** /api/v1/inventory/warehouses | Listar bodegas o almacenes del inquilino (con RLS)


# **warehouseControllerCreateWarehouse**
> warehouseControllerCreateWarehouse()

Crear una nueva bodega o almacén

### Example
```dart
import 'package:unisaas_mobile_api/api.dart';
// TODO Configure HTTP Bearer authorization: bearer
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken(yourTokenGeneratorFunction);

final api_instance = InventoryWarehousesApi();

try {
    api_instance.warehouseControllerCreateWarehouse();
} catch (e) {
    print('Exception when calling InventoryWarehousesApi->warehouseControllerCreateWarehouse: $e\n');
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

# **warehouseControllerGetWarehouses**
> warehouseControllerGetWarehouses()

Listar bodegas o almacenes del inquilino (con RLS)

### Example
```dart
import 'package:unisaas_mobile_api/api.dart';
// TODO Configure HTTP Bearer authorization: bearer
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken(yourTokenGeneratorFunction);

final api_instance = InventoryWarehousesApi();

try {
    api_instance.warehouseControllerGetWarehouses();
} catch (e) {
    print('Exception when calling InventoryWarehousesApi->warehouseControllerGetWarehouses: $e\n');
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

