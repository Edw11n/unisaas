# unisaas_mobile_api.api.TenantsApi

## Load the API package
```dart
import 'package:unisaas_mobile_api/api.dart';
```

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**tenantControllerCreateBranch**](TenantsApi.md#tenantcontrollercreatebranch) | **POST** /api/v1/tenants/{id}/branches | Crear nueva sucursal para la empresa
[**tenantControllerCreateTenant**](TenantsApi.md#tenantcontrollercreatetenant) | **POST** /api/v1/tenants | Registrar nueva empresa en la plataforma (Onboarding)
[**tenantControllerGetBranches**](TenantsApi.md#tenantcontrollergetbranches) | **GET** /api/v1/tenants/{id}/branches | Listar sucursales de la empresa (con RLS)
[**tenantControllerGetTenant**](TenantsApi.md#tenantcontrollergettenant) | **GET** /api/v1/tenants/{id} | Consultar detalles de una empresa/inquilino


# **tenantControllerCreateBranch**
> tenantControllerCreateBranch(id)

Crear nueva sucursal para la empresa

### Example
```dart
import 'package:unisaas_mobile_api/api.dart';
// TODO Configure HTTP Bearer authorization: bearer
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken(yourTokenGeneratorFunction);

final api_instance = TenantsApi();
final id = id_example; // String | 

try {
    api_instance.tenantControllerCreateBranch(id);
} catch (e) {
    print('Exception when calling TenantsApi->tenantControllerCreateBranch: $e\n');
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

# **tenantControllerCreateTenant**
> tenantControllerCreateTenant()

Registrar nueva empresa en la plataforma (Onboarding)

### Example
```dart
import 'package:unisaas_mobile_api/api.dart';
// TODO Configure HTTP Bearer authorization: bearer
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken(yourTokenGeneratorFunction);

final api_instance = TenantsApi();

try {
    api_instance.tenantControllerCreateTenant();
} catch (e) {
    print('Exception when calling TenantsApi->tenantControllerCreateTenant: $e\n');
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

# **tenantControllerGetBranches**
> tenantControllerGetBranches(id)

Listar sucursales de la empresa (con RLS)

### Example
```dart
import 'package:unisaas_mobile_api/api.dart';
// TODO Configure HTTP Bearer authorization: bearer
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken(yourTokenGeneratorFunction);

final api_instance = TenantsApi();
final id = id_example; // String | 

try {
    api_instance.tenantControllerGetBranches(id);
} catch (e) {
    print('Exception when calling TenantsApi->tenantControllerGetBranches: $e\n');
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

# **tenantControllerGetTenant**
> tenantControllerGetTenant(id)

Consultar detalles de una empresa/inquilino

### Example
```dart
import 'package:unisaas_mobile_api/api.dart';
// TODO Configure HTTP Bearer authorization: bearer
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken(yourTokenGeneratorFunction);

final api_instance = TenantsApi();
final id = id_example; // String | 

try {
    api_instance.tenantControllerGetTenant(id);
} catch (e) {
    print('Exception when calling TenantsApi->tenantControllerGetTenant: $e\n');
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

