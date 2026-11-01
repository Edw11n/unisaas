# unisaas_mobile_api.api.HealthApi

## Load the API package
```dart
import 'package:unisaas_mobile_api/api.dart';
```

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**healthControllerCheckHealth**](HealthApi.md#healthcontrollercheckhealth) | **GET** /api/v1/health | Sonda de disponibilidad y salud de infraestructura


# **healthControllerCheckHealth**
> healthControllerCheckHealth()

Sonda de disponibilidad y salud de infraestructura

### Example
```dart
import 'package:unisaas_mobile_api/api.dart';

final api_instance = HealthApi();

try {
    api_instance.healthControllerCheckHealth();
} catch (e) {
    print('Exception when calling HealthApi->healthControllerCheckHealth: $e\n');
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

