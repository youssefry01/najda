import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/network/json.dart';
import '../../../core/utils/file_types.dart';
import '../domain/incident_media.dart';

final incidentMediaRepositoryProvider = Provider<IncidentMediaRepository>(
  (ref) => IncidentMediaRepository(ref.watch(apiClientProvider)),
);

class IncidentMediaRepository {
  IncidentMediaRepository(this._api);

  final ApiClient _api;

  /// Talks to the storage provider directly (no app credentials involved), so
  /// it deliberately does not use [ApiClient].
  final Dio _storage = Dio();

  static const _slow = Duration(seconds: 30);

  /// Signed-URL upload, the same three steps as the web app:
  /// ask the backend for a URL -> PUT the file straight to storage -> register it.
  Future<IncidentMedia> upload({
    required int incidentId,
    required MediaKind kind,
    required String path,
  }) async {
    final extension = extensionOf(path);
    final signed = asJsonMap(
      await _api.post(
        '/api/incident-media/upload-url?incidentId=$incidentId&fileExtension=$extension',
        timeout: _slow,
      ),
    );

    await _putFile(
      signed['uploadUrl'] as String,
      File(path),
      contentTypeFor(extension),
    );

    final json = await _api.post(
      '/api/incident-media',
      body: {
        'incidentId': incidentId,
        'mediaType': kind.wire,
        'path': signed['path'],
      },
      timeout: _slow,
    );
    return IncidentMedia.fromJson(asJsonMap(json));
  }

  Future<void> _putFile(String uploadUrl, File file, String contentType) async {
    try {
      final response = await _storage.put<void>(
        uploadUrl,
        data: file.openRead(),
        options: Options(
          headers: {
            Headers.contentTypeHeader: contentType,
            Headers.contentLengthHeader: await file.length(),
          },
          sendTimeout: const Duration(minutes: 3),
          receiveTimeout: const Duration(minutes: 1),
          validateStatus: (_) => true,
        ),
      );
      final status = response.statusCode ?? 0;
      if (status < 200 || status >= 300) {
        throw ApiException(
          'Upload to storage failed (HTTP $status).',
          status: status,
        );
      }
    } on DioException {
      throw const ApiException(
        'Upload to storage failed. Check your connection and try again.',
      );
    }
  }

  /// A short-lived signed link; never store or build storage URLs by hand.
  Future<String> downloadUrl(int mediaId) async {
    final json = asJsonMap(
      await _api.get('/api/incident-media/$mediaId/download-url'),
    );
    return json['downloadUrl'] as String;
  }

  Future<void> editText(int mediaId, String text) => _api.patch(
    '/api/incident-media/$mediaId/text',
    body: {'textContent': text},
  );

  Future<void> delete(int mediaId) =>
      _api.delete('/api/incident-media/$mediaId');
}
