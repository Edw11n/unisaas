# unisaas_mobile_api.api.CreditsThirdPartiesApi

## Load the API package
```dart
import 'package:unisaas_mobile_api/api.dart';
```

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**thirdPartyControllerCreateThirdParty**](CreditsThirdPartiesApi.md#thirdpartycontrollercreatethirdparty) | **POST** /api/v1/credits/third-parties | Registrar un nuevo tercero (Cliente, Proveedor o Ambos)
[**thirdPartyControllerGetThirdParties**](CreditsThirdPartiesApi.md#thirdpartycontrollergetthirdparties) | **GET** /api/v1/credits/third-parties | Listar terceros (clientes y proveedores) del inquilino (con RLS)
[**thirdPartyControllerGetThirdPartyById**](CreditsThirdPartiesApi.md#thirdpartycontrollergetthirdpartybyid) | **GET** /api/v1/credits/third-parties/{id} | Consultar detalles e historial reciente de un tercero


# **thirdPartyControllerCreateThirdParty**
> thirdPartyControllerCreateThirdParty()

Registrar un nuevo tercero (Cliente, Proveedor o Ambos)

### Example
```dart
import 'package:unisaas_mobile_api/api.dart';
// TODO Configure HTTP Bearer authorization: bearer
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken(yourTokenGeneratorFunction);

final api_instance = CreditsThirdPartiesApi();

try {
    api_instance.thirdPartyControllerCreateThirdParty();
} catch (e) {
    print('Exception when calling CreditsThirdPartiesApi->thirdPartyControllerCreateThirdParty: $e\n');
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

# **thirdPartyControllerGetThirdParties**
> thirdPartyControllerGetThirdParties()

Listar terceros (clientes y proveedores) del inquilino (con RLS)

### Example
```dart
import 'package:unisaas_mobile_api/api.dart';
// TODO Configure HTTP Bearer authorization: bearer
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken(yourTokenGeneratorFunction);

final api_instance = CreditsThirdPartiesApi();

try {
    api_instance.thirdPartyControllerGetThirdParties();
} catch (e) {
    print('Exception when calling CreditsThirdPartiesApi->thirdPartyControllerGetThirdParties: $e\n');
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

# **thirdPartyControllerGetThirdPartyById**
> thirdPartyControllerGetThirdPartyById(id)

Consultar detalles e historial reciente de un tercero

### Example
```dart
import 'package:unisaas_mobile_api/api.dart';
// TODO Configure HTTP Bearer authorization: bearer
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken(yourTokenGeneratorFunction);

final api_instance = CreditsThirdPartiesApi();
final id = id_example; // String | 

try {
    api_instance.thirdPartyControllerGetThirdPartyById(id);
} catch (e) {
    print('Exception when calling CreditsThirdPartiesApi->thirdPartyControllerGetThirdPartyById: $e\n');
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

