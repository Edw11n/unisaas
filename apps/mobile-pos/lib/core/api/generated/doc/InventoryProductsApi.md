# unisaas_mobile_api.api.InventoryProductsApi

## Load the API package
```dart
import 'package:unisaas_mobile_api/api.dart';
```

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**productControllerCreateProduct**](InventoryProductsApi.md#productcontrollercreateproduct) | **POST** /api/v1/inventory/products | Crear un nuevo producto con su variante por defecto y código de barras
[**productControllerGetProductById**](InventoryProductsApi.md#productcontrollergetproductbyid) | **GET** /api/v1/inventory/products/{id} | Consultar detalles de un producto por ID
[**productControllerGetProducts**](InventoryProductsApi.md#productcontrollergetproducts) | **GET** /api/v1/inventory/products | Listar productos del catálogo del inquilino (con RLS)


# **productControllerCreateProduct**
> productControllerCreateProduct()

Crear un nuevo producto con su variante por defecto y código de barras

### Example
```dart
import 'package:unisaas_mobile_api/api.dart';
// TODO Configure HTTP Bearer authorization: bearer
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken(yourTokenGeneratorFunction);

final api_instance = InventoryProductsApi();

try {
    api_instance.productControllerCreateProduct();
} catch (e) {
    print('Exception when calling InventoryProductsApi->productControllerCreateProduct: $e\n');
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

# **productControllerGetProductById**
> productControllerGetProductById(id)

Consultar detalles de un producto por ID

### Example
```dart
import 'package:unisaas_mobile_api/api.dart';
// TODO Configure HTTP Bearer authorization: bearer
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken(yourTokenGeneratorFunction);

final api_instance = InventoryProductsApi();
final id = id_example; // String | 

try {
    api_instance.productControllerGetProductById(id);
} catch (e) {
    print('Exception when calling InventoryProductsApi->productControllerGetProductById: $e\n');
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

# **productControllerGetProducts**
> productControllerGetProducts()

Listar productos del catálogo del inquilino (con RLS)

### Example
```dart
import 'package:unisaas_mobile_api/api.dart';
// TODO Configure HTTP Bearer authorization: bearer
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken(yourTokenGeneratorFunction);

final api_instance = InventoryProductsApi();

try {
    api_instance.productControllerGetProducts();
} catch (e) {
    print('Exception when calling InventoryProductsApi->productControllerGetProducts: $e\n');
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

