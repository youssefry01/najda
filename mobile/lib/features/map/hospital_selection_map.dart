import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:maplibre_gl/maplibre_gl.dart';

import '../../core/l10n/l10n_x.dart';
import '../../core/theme/app_palette.dart';
import '../../core/geo/geo.dart';
import '../handoff/domain/hospital_transfer.dart';
import 'map_gestures.dart';
import 'najda_map_style.dart';

/// Pick a hospital on the map: the incident pin plus every hospital as a
/// coloured dot (recommended / your base / other). Tapping near a dot selects it.
class HospitalSelectionMap extends StatefulWidget {
  const HospitalSelectionMap({
    required this.incidentLatitude,
    required this.incidentLongitude,
    required this.options,
    required this.selectedId,
    required this.onSelect,
    super.key,
  });

  final double incidentLatitude;
  final double incidentLongitude;
  final List<HospitalOption> options;
  final int? selectedId;
  final ValueChanged<int> onSelect;

  @override
  State<HospitalSelectionMap> createState() => _HospitalSelectionMapState();
}

class _HospitalSelectionMapState extends State<HospitalSelectionMap> {
  static const _tapRadiusPx = 28.0;
  static const _recommended = '#16a34a';
  static const _ownBase = '#0d9488';
  static const _other = '#64748b';
  static const _selected = '#2563eb';
  static const _incident = '#db313f';

  MapLibreMapController? _controller;
  bool _styleLoaded = false;
  bool _drawing = false;
  bool _redrawQueued = false;
  bool _framed = false;

  @override
  void didUpdateWidget(HospitalSelectionMap oldWidget) {
    super.didUpdateWidget(oldWidget);
    unawaited(_redraw());
  }

  Future<void> _redraw() async {
    if (_drawing) {
      _redrawQueued = true;
      return;
    }
    final controller = _controller;
    if (controller == null || !_styleLoaded) return;

    _drawing = true;
    try {
      await controller.clearCircles();

      for (final option in widget.options) {
        final isSelected = option.id == widget.selectedId;
        await controller.addCircle(
          CircleOptions(
            geometry: LatLng(
              option.hospital.latitude,
              option.hospital.longitude,
            ),
            circleRadius: isSelected ? 11 : 7,
            circleColor: isSelected
                ? _selected
                : option.recommended
                ? _recommended
                : option.isOwnBase
                ? _ownBase
                : _other,
            circleStrokeColor: '#ffffff',
            circleStrokeWidth: isSelected ? 3 : 2,
          ),
        );
      }

      final incident = LatLng(
        widget.incidentLatitude,
        widget.incidentLongitude,
      );
      await controller.addCircle(
        CircleOptions(
          geometry: incident,
          circleRadius: 20,
          circleColor: _incident,
          circleOpacity: 0.22,
        ),
      );
      await controller.addCircle(
        CircleOptions(
          geometry: incident,
          circleRadius: 9,
          circleColor: _incident,
          circleStrokeColor: '#ffffff',
          circleStrokeWidth: 3,
        ),
      );

      if (!_framed && widget.options.isNotEmpty) {
        _framed = true;
        await _frameNearest();
      }
    } finally {
      _drawing = false;
      if (_redrawQueued) {
        _redrawQueued = false;
        unawaited(_redraw());
      }
    }
  }

  /// Fit the incident plus the few nearest hospitals so the choice is visible
  /// without hunting for it.
  Future<void> _frameNearest() async {
    final controller = _controller;
    if (controller == null) return;

    final nearest = widget.options
        .take(3)
        .map((o) => LatLng(o.hospital.latitude, o.hospital.longitude));
    final points = [
      LatLng(widget.incidentLatitude, widget.incidentLongitude),
      ...nearest,
    ];

    final lats = points.map((p) => p.latitude);
    final lngs = points.map((p) => p.longitude);
    await controller.animateCamera(
      CameraUpdate.newLatLngBounds(
        LatLngBounds(
          southwest: LatLng(lats.reduce(math.min), lngs.reduce(math.min)),
          northeast: LatLng(lats.reduce(math.max), lngs.reduce(math.max)),
        ),
        left: 40,
        top: 40,
        right: 40,
        bottom: 40,
      ),
    );
  }

  /// Taps are matched to the nearest hospital within [_tapRadiusPx] on screen,
  /// which is easier on a phone than hitting a 7 px dot exactly.
  void _onMapClick(LatLng tapped) {
    final zoom = _controller?.cameraPosition?.zoom ?? 12;
    final metersPerPixel =
        156543.03392 *
        math.cos(tapped.latitude * math.pi / 180) /
        math.pow(2, zoom);
    final thresholdKm = _tapRadiusPx * metersPerPixel / 1000;

    HospitalOption? best;
    var bestDistance = double.infinity;
    for (final option in widget.options) {
      final distance = haversineKm(
        tapped.latitude,
        tapped.longitude,
        option.hospital.latitude,
        option.hospital.longitude,
      );
      if (distance < bestDistance) {
        best = option;
        bestDistance = distance;
      }
    }
    if (best != null && bestDistance <= thresholdKm) widget.onSelect(best.id);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: SizedBox(
            height: 240,
            child: MapLibreMap(
              styleString: najdaMapStyle,
              initialCameraPosition: CameraPosition(
                target: LatLng(
                  widget.incidentLatitude,
                  widget.incidentLongitude,
                ),
                zoom: 12,
              ),
              trackCameraPosition: true,
              gestureRecognizers: mapGestureRecognizers,
              compassEnabled: false,
              rotateGesturesEnabled: false,
              tiltGesturesEnabled: false,
              onMapCreated: (controller) => _controller = controller,
              onStyleLoadedCallback: () {
                _styleLoaded = true;
                unawaited(_redraw());
              },
              onMapClick: (_, coordinates) => _onMapClick(coordinates),
            ),
          ),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 12,
          runSpacing: 6,
          children: [
            _LegendDot(
              color: _incident,
              label: l10n.hospitalLabelsIncidentLocation,
            ),
            _LegendDot(
              color: _recommended,
              label: l10n.hospitalLabelsRecommended,
            ),
            _LegendDot(color: _ownBase, label: l10n.hospitalLabelsYourBase),
            _LegendDot(color: _selected, label: l10n.hospitalLabelsSelected),
          ],
        ),
      ],
    );
  }
}

class _LegendDot extends StatelessWidget {
  const _LegendDot({required this.color, required this.label});

  final String color;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          height: 10,
          width: 10,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: Color(int.parse('FF${color.substring(1)}', radix: 16)),
          ),
        ),
        const SizedBox(width: 6),
        Text(
          label,
          style: TextStyle(fontSize: 12, color: context.palette.textMuted),
        ),
      ],
    );
  }
}
