import 'incident.dart';
import 'pending_attachment.dart';

/// A report that has been handed to the app for sending and must not be lost,
/// whatever the network does. Persisted to disk before the first attempt.
///
/// Sending is two phases, and progress through them is remembered so a crash or
/// a lost connection halfway resumes instead of restarting:
///   1. create the incident (idempotent: [request] carries a `clientRequestId`);
///   2. upload each attachment ([incidentId] is then set).
class OutboxReport {
  const OutboxReport({
    required this.userId,
    required this.request,
    required this.attachments,
    required this.capturedAt,
    this.incidentId,
    this.uploadedIds = const {},
    this.failedIds = const {},
  });

  factory OutboxReport.fromJson(Map<String, dynamic> json) => OutboxReport(
    userId: (json['userId'] as num).toInt(),
    request: SubmitIncidentRequest.fromJson(
      Map<String, dynamic>.from(json['request'] as Map),
    ),
    attachments: [
      for (final item in (json['attachments'] as List<dynamic>? ?? const []))
        PendingAttachment.fromJson(Map<String, dynamic>.from(item as Map)),
    ],
    capturedAt: DateTime.parse(json['capturedAt'] as String),
    incidentId: (json['incidentId'] as num?)?.toInt(),
    uploadedIds: {
      for (final id in (json['uploadedIds'] as List<dynamic>? ?? const []))
        id as String,
    },
    failedIds: {
      for (final id in (json['failedIds'] as List<dynamic>? ?? const []))
        id as String,
    },
  );

  /// A saved report older than this needs the citizen's go-ahead before it is
  /// sent: their situation and location may have changed.
  static const staleAfter = Duration(minutes: 30);

  final int userId;
  final SubmitIncidentRequest request;
  final List<PendingAttachment> attachments;
  final DateTime capturedAt;

  /// Set once the server has created the incident.
  final int? incidentId;
  final Set<String> uploadedIds;

  /// Attachments the server permanently refused (kept out of the retry loop).
  final Set<String> failedIds;

  /// The idempotency key: identifies this report across every retry.
  String get id =>
      request.clientRequestId ?? capturedAt.microsecondsSinceEpoch.toString();

  bool isStale(DateTime now) => now.difference(capturedAt) > staleAfter;

  List<PendingAttachment> get remaining => [
    for (final a in attachments)
      if (!uploadedIds.contains(a.id) && !failedIds.contains(a.id)) a,
  ];

  OutboxReport copyWith({
    int? incidentId,
    Set<String>? uploadedIds,
    Set<String>? failedIds,
  }) => OutboxReport(
    userId: userId,
    request: request,
    attachments: attachments,
    capturedAt: capturedAt,
    incidentId: incidentId ?? this.incidentId,
    uploadedIds: uploadedIds ?? this.uploadedIds,
    failedIds: failedIds ?? this.failedIds,
  );

  Map<String, Object?> toJson() => {
    'userId': userId,
    'request': request.toJson(),
    'attachments': [for (final a in attachments) a.toJson()],
    'capturedAt': capturedAt.toIso8601String(),
    'incidentId': incidentId,
    'uploadedIds': uploadedIds.toList(),
    'failedIds': failedIds.toList(),
  };
}
