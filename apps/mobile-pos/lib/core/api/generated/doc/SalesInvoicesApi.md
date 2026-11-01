# unisaas_mobile_api.api.SalesInvoicesApi

## Load the API package
```dart
import 'package:unisaas_mobile_api/api.dart';
```

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**invoiceControllerCreateInvoice**](SalesInvoicesApi.md#invoicecontrollercreateinvoice) | **POST** /api/v1/sales/invoices | Emitir una nueva factura de venta (POS o Crédito)
[**invoiceControllerGetInvoiceById**](SalesInvoicesApi.md#invoicecontrollergetinvoicebyid) | **GET** /api/v1/sales/invoices/{id} | Consultar detalles completos de una factura por ID
[**invoiceControllerGetInvoices**](SalesInvoicesApi.md#invoicecontrollergetinvoices) | **GET** /api/v1/sales/invoices | Listar facturas emitidas por la empresa (con RLS)
[**invoiceControllerVoidInvoice**](SalesInvoicesApi.md#invoicecontrollervoidinvoice) | **POST** /api/v1/sales/invoices/{id}/void | Anular una factura emitida previamente


# **invoiceControllerCreateInvoice**
> invoiceControllerCreateInvoice()

Emitir una nueva factura de venta (POS o Crédito)

### Example
```dart
import 'package:unisaas_mobile_api/api.dart';
// TODO Configure HTTP Bearer authorization: bearer
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken(yourTokenGeneratorFunction);

final api_instance = SalesInvoicesApi();

try {
    api_instance.invoiceControllerCreateInvoice();
} catch (e) {
    print('Exception when calling SalesInvoicesApi->invoiceControllerCreateInvoice: $e\n');
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

# **invoiceControllerGetInvoiceById**
> invoiceControllerGetInvoiceById(id)

Consultar detalles completos de una factura por ID

### Example
```dart
import 'package:unisaas_mobile_api/api.dart';
// TODO Configure HTTP Bearer authorization: bearer
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken(yourTokenGeneratorFunction);

final api_instance = SalesInvoicesApi();
final id = id_example; // String | 

try {
    api_instance.invoiceControllerGetInvoiceById(id);
} catch (e) {
    print('Exception when calling SalesInvoicesApi->invoiceControllerGetInvoiceById: $e\n');
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

# **invoiceControllerGetInvoices**
> invoiceControllerGetInvoices(branchId)

Listar facturas emitidas por la empresa (con RLS)

### Example
```dart
import 'package:unisaas_mobile_api/api.dart';
// TODO Configure HTTP Bearer authorization: bearer
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken(yourTokenGeneratorFunction);

final api_instance = SalesInvoicesApi();
final branchId = branchId_example; // String | 

try {
    api_instance.invoiceControllerGetInvoices(branchId);
} catch (e) {
    print('Exception when calling SalesInvoicesApi->invoiceControllerGetInvoices: $e\n');
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

# **invoiceControllerVoidInvoice**
> invoiceControllerVoidInvoice(id)

Anular una factura emitida previamente

### Example
```dart
import 'package:unisaas_mobile_api/api.dart';
// TODO Configure HTTP Bearer authorization: bearer
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken(yourTokenGeneratorFunction);

final api_instance = SalesInvoicesApi();
final id = id_example; // String | 

try {
    api_instance.invoiceControllerVoidInvoice(id);
} catch (e) {
    print('Exception when calling SalesInvoicesApi->invoiceControllerVoidInvoice: $e\n');
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

