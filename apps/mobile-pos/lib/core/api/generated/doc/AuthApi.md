# unisaas_mobile_api.api.AuthApi

## Load the API package
```dart
import 'package:unisaas_mobile_api/api.dart';
```

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**authControllerGetSessions**](AuthApi.md#authcontrollergetsessions) | **GET** /api/v1/auth/sessions | Listar sesiones activas del usuario
[**authControllerLogin**](AuthApi.md#authcontrollerlogin) | **POST** /api/v1/auth/login | Iniciar sesión y obtener tokens JWT con sesión en Redis
[**authControllerLogout**](AuthApi.md#authcontrollerlogout) | **POST** /api/v1/auth/logout | Cerrar sesión activa y revocar token en Redis
[**authControllerRefresh**](AuthApi.md#authcontrollerrefresh) | **POST** /api/v1/auth/refresh | Renovar access token mediante refresh token
[**authControllerRevokeAllSessions**](AuthApi.md#authcontrollerrevokeallsessions) | **DELETE** /api/v1/auth/sessions | Revocar masivamente todas las sesiones activas del usuario


# **authControllerGetSessions**
> authControllerGetSessions()

Listar sesiones activas del usuario

### Example
```dart
import 'package:unisaas_mobile_api/api.dart';
// TODO Configure HTTP Bearer authorization: bearer
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AuthApi();

try {
    api_instance.authControllerGetSessions();
} catch (e) {
    print('Exception when calling AuthApi->authControllerGetSessions: $e\n');
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

# **authControllerLogin**
> authControllerLogin()

Iniciar sesión y obtener tokens JWT con sesión en Redis

### Example
```dart
import 'package:unisaas_mobile_api/api.dart';

final api_instance = AuthApi();

try {
    api_instance.authControllerLogin();
} catch (e) {
    print('Exception when calling AuthApi->authControllerLogin: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

void (empty response body)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **authControllerLogout**
> authControllerLogout()

Cerrar sesión activa y revocar token en Redis

### Example
```dart
import 'package:unisaas_mobile_api/api.dart';
// TODO Configure HTTP Bearer authorization: bearer
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AuthApi();

try {
    api_instance.authControllerLogout();
} catch (e) {
    print('Exception when calling AuthApi->authControllerLogout: $e\n');
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

# **authControllerRefresh**
> authControllerRefresh()

Renovar access token mediante refresh token

### Example
```dart
import 'package:unisaas_mobile_api/api.dart';

final api_instance = AuthApi();

try {
    api_instance.authControllerRefresh();
} catch (e) {
    print('Exception when calling AuthApi->authControllerRefresh: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

void (empty response body)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **authControllerRevokeAllSessions**
> authControllerRevokeAllSessions()

Revocar masivamente todas las sesiones activas del usuario

### Example
```dart
import 'package:unisaas_mobile_api/api.dart';
// TODO Configure HTTP Bearer authorization: bearer
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AuthApi();

try {
    api_instance.authControllerRevokeAllSessions();
} catch (e) {
    print('Exception when calling AuthApi->authControllerRevokeAllSessions: $e\n');
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

