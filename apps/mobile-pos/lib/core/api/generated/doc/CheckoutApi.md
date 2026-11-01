# unisaas_mobile_api.api.CheckoutApi

## Load the API package
```dart
import 'package:unisaas_mobile_api/api.dart';
```

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**checkoutControllerCheckout**](CheckoutApi.md#checkoutcontrollercheckout) | **POST** /api/v1/pos/checkout | 


# **checkoutControllerCheckout**
> checkoutControllerCheckout(idempotencyKey, xIdempotencyKey)



### Example
```dart
import 'package:unisaas_mobile_api/api.dart';

final api_instance = CheckoutApi();
final idempotencyKey = idempotencyKey_example; // String | 
final xIdempotencyKey = xIdempotencyKey_example; // String | 

try {
    api_instance.checkoutControllerCheckout(idempotencyKey, xIdempotencyKey);
} catch (e) {
    print('Exception when calling CheckoutApi->checkoutControllerCheckout: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **idempotencyKey** | **String**|  | 
 **xIdempotencyKey** | **String**|  | 

### Return type

void (empty response body)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

