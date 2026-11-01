# unisaas_mobile_api.api.SalesPOSShiftsApi

## Load the API package
```dart
import 'package:unisaas_mobile_api/api.dart';
```

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**posShiftControllerCloseShift**](SalesPOSShiftsApi.md#posshiftcontrollercloseshift) | **POST** /api/v1/sales/shifts/{id}/close | Cerrar y cuadrar un turno de caja POS
[**posShiftControllerGetCurrentShift**](SalesPOSShiftsApi.md#posshiftcontrollergetcurrentshift) | **GET** /api/v1/sales/shifts/current | Consultar turno activo del cajero en la sucursal
[**posShiftControllerGetShifts**](SalesPOSShiftsApi.md#posshiftcontrollergetshifts) | **GET** /api/v1/sales/shifts | Listar turnos de caja de la sucursal (con RLS)
[**posShiftControllerOpenShift**](SalesPOSShiftsApi.md#posshiftcontrolleropenshift) | **POST** /api/v1/sales/shifts/open | Aperturar un nuevo turno de caja POS


# **posShiftControllerCloseShift**
> posShiftControllerCloseShift(id)

Cerrar y cuadrar un turno de caja POS

### Example
```dart
import 'package:unisaas_mobile_api/api.dart';
// TODO Configure HTTP Bearer authorization: bearer
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken(yourTokenGeneratorFunction);

final api_instance = SalesPOSShiftsApi();
final id = id_example; // String | 

try {
    api_instance.posShiftControllerCloseShift(id);
} catch (e) {
    print('Exception when calling SalesPOSShiftsApi->posShiftControllerCloseShift: $e\n');
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

# **posShiftControllerGetCurrentShift**
> posShiftControllerGetCurrentShift(branchId)

Consultar turno activo del cajero en la sucursal

### Example
```dart
import 'package:unisaas_mobile_api/api.dart';
// TODO Configure HTTP Bearer authorization: bearer
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken(yourTokenGeneratorFunction);

final api_instance = SalesPOSShiftsApi();
final branchId = branchId_example; // String | 

try {
    api_instance.posShiftControllerGetCurrentShift(branchId);
} catch (e) {
    print('Exception when calling SalesPOSShiftsApi->posShiftControllerGetCurrentShift: $e\n');
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

# **posShiftControllerGetShifts**
> posShiftControllerGetShifts(branchId)

Listar turnos de caja de la sucursal (con RLS)

### Example
```dart
import 'package:unisaas_mobile_api/api.dart';
// TODO Configure HTTP Bearer authorization: bearer
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken(yourTokenGeneratorFunction);

final api_instance = SalesPOSShiftsApi();
final branchId = branchId_example; // String | 

try {
    api_instance.posShiftControllerGetShifts(branchId);
} catch (e) {
    print('Exception when calling SalesPOSShiftsApi->posShiftControllerGetShifts: $e\n');
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

# **posShiftControllerOpenShift**
> posShiftControllerOpenShift()

Aperturar un nuevo turno de caja POS

### Example
```dart
import 'package:unisaas_mobile_api/api.dart';
// TODO Configure HTTP Bearer authorization: bearer
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken(yourTokenGeneratorFunction);

final api_instance = SalesPOSShiftsApi();

try {
    api_instance.posShiftControllerOpenShift();
} catch (e) {
    print('Exception when calling SalesPOSShiftsApi->posShiftControllerOpenShift: $e\n');
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

