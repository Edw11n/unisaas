# unisaas_mobile_api.api.AccountingJournalsApi

## Load the API package
```dart
import 'package:unisaas_mobile_api/api.dart';
```

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**journalControllerCreateJournalEntry**](AccountingJournalsApi.md#journalcontrollercreatejournalentry) | **POST** /api/v1/accounting/journals | Registrar un nuevo asiento contable por partida doble
[**journalControllerGetJournalEntries**](AccountingJournalsApi.md#journalcontrollergetjournalentries) | **GET** /api/v1/accounting/journals | Listar asientos contables registrados (con RLS)
[**journalControllerGetJournalEntryById**](AccountingJournalsApi.md#journalcontrollergetjournalentrybyid) | **GET** /api/v1/accounting/journals/{id} | Consultar detalles y líneas de un asiento contable
[**journalControllerReverseJournalEntry**](AccountingJournalsApi.md#journalcontrollerreversejournalentry) | **POST** /api/v1/accounting/journals/{id}/reverse | Reversar un asiento contable existente generando contra-asiento


# **journalControllerCreateJournalEntry**
> journalControllerCreateJournalEntry()

Registrar un nuevo asiento contable por partida doble

### Example
```dart
import 'package:unisaas_mobile_api/api.dart';
// TODO Configure HTTP Bearer authorization: bearer
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingJournalsApi();

try {
    api_instance.journalControllerCreateJournalEntry();
} catch (e) {
    print('Exception when calling AccountingJournalsApi->journalControllerCreateJournalEntry: $e\n');
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

# **journalControllerGetJournalEntries**
> journalControllerGetJournalEntries(branchId)

Listar asientos contables registrados (con RLS)

### Example
```dart
import 'package:unisaas_mobile_api/api.dart';
// TODO Configure HTTP Bearer authorization: bearer
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingJournalsApi();
final branchId = branchId_example; // String | 

try {
    api_instance.journalControllerGetJournalEntries(branchId);
} catch (e) {
    print('Exception when calling AccountingJournalsApi->journalControllerGetJournalEntries: $e\n');
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

# **journalControllerGetJournalEntryById**
> journalControllerGetJournalEntryById(id)

Consultar detalles y líneas de un asiento contable

### Example
```dart
import 'package:unisaas_mobile_api/api.dart';
// TODO Configure HTTP Bearer authorization: bearer
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingJournalsApi();
final id = id_example; // String | 

try {
    api_instance.journalControllerGetJournalEntryById(id);
} catch (e) {
    print('Exception when calling AccountingJournalsApi->journalControllerGetJournalEntryById: $e\n');
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

# **journalControllerReverseJournalEntry**
> journalControllerReverseJournalEntry(id)

Reversar un asiento contable existente generando contra-asiento

### Example
```dart
import 'package:unisaas_mobile_api/api.dart';
// TODO Configure HTTP Bearer authorization: bearer
// Case 1. Use String Token
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken('YOUR_ACCESS_TOKEN');
// Case 2. Use Function which generate token.
// String yourTokenGeneratorFunction() { ... }
//defaultApiClient.getAuthentication<HttpBearerAuth>('bearer').setAccessToken(yourTokenGeneratorFunction);

final api_instance = AccountingJournalsApi();
final id = id_example; // String | 

try {
    api_instance.journalControllerReverseJournalEntry(id);
} catch (e) {
    print('Exception when calling AccountingJournalsApi->journalControllerReverseJournalEntry: $e\n');
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

