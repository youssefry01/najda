import 'package:dio/dio.dart';

import 'failure.dart';

Failure mapDioError(DioException e) {
  switch (e.type) {
    case DioExceptionType.connectionTimeout:
    case DioExceptionType.sendTimeout:
    case DioExceptionType.receiveTimeout:
    case DioExceptionType.connectionError:
      return const NetworkFailure();
    case DioExceptionType.badResponse:
      final code = e.response?.statusCode;
      final message = _extractMessage(e.response?.data);
      if (code == 401 || code == 403) {
        return AuthFailure(message ?? 'Access denied');
      }
      if (code == 400 || code == 409 || code == 422) {
        return ValidationFailure(message ?? 'Invalid request');
      }
      return ServerFailure(message ?? 'Server error', statusCode: code);
    default:
      return const UnknownFailure();
  }
}

String? _extractMessage(dynamic data) {
  if (data is Map && data['message'] is String) {
    return data['message'] as String;
  }
  return null;
}
