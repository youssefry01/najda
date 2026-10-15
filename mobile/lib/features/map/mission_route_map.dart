import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:maplibre_gl/maplibre_gl.dart';

import '../../core/l10n/enum_labels.dart';
import '../../core/l10n/l10n_x.dart';
import '../../core/routing/route_service.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_palette.dart';
import '../responder/domain/teammate_unit.dart';
import 'map_gestures.dart';
import 'najda_map_style.dart';

enum _RouteMode { driving, straight }

/// Unit (or its home station) -> destination, with an OSRM driving route or a
/// straight line, plus the other units working the same incident.
class MissionRouteMap extends ConsumerStatefulWidget {
  const MissionRouteMap({
    required this.destinationLatitude,
    required this.destinationLongitude,
    super.key,
    this.unitLatitude,
    this.unitLongitude,
    this.facilityLatitude,
    this.facilityLongitude,
    this.teammates = const [],
  });

  final double? unitLatitude;
  final double? unitLongitude;
  final double? facilityLatitude;
  final double? facilityLongitude;
  final double destinationLatitude;
  final double destinationLongitude;
  final List<TeammateUnit> teammates;

  @override
  ConsumerState<MissionRouteMap> createState() => _MissionRouteMapState();
}

class _MissionRouteMapState extends ConsumerState<MissionRouteMap> {
  MapLibreMapController? _controller;
  bool _styleLoaded = false;
  _RouteMode _mode = _RouteMode.driving;
  bool _showTeammates = true;

  bool _drawing = false;
  bool _redrawQueued = false;
  bool _framed = false;

  /// Latest own driving route (set from build) and a small cache for teammates,
  /// keyed by coordinates rounded to ~100 m so live movement does not hammer OSRM.
  DrivingRoute? _ownRoute;
  final Map<RouteQuery, DrivingRoute?> _teammateRoutes = {};

  double? get _fromLat => widget.unitLatitude ?? widget.facilityLatitude;
  double? get _fromLng => widget.unitLongitude ?? widget.facilityLongitude;
  bool get _hasOrigin => _fromLat != null && _fromLng != null;
  bool get _usingStation => _hasOrigin && widget.unitLatitude == null;

  RouteQuery? get _query => _hasOrigin
      ? (
          fromLng: _fromLng!,
          fromLat: _fromLat!,
          toLng: widget.destinationLongitude,
          toLat: widget.destinationLatitude,
        )
      : null;

  @override
  void didUpdateWidget(MissionRouteMap oldWidget) {
    super.didUpdateWidget(oldWidget);
    unawaited(_redraw());
  }

  double _round(double v) => (v * 1000).round() / 1000;

  Future<List<LatLng>> _teammatePoints(TeammateUnit mate) async {
    final origin = LatLng(mate.latitude, mate.longitude);
    final destination = LatLng(
      widget.destinationLatitude,
      widget.destinationLongitude,
    );
    if (_mode != _RouteMode.driving) return [origin, destination];

    final query = (
      fromLng: _round(mate.longitude),
      fromLat: _round(mate.latitude),
      toLng: widget.destinationLongitude,
      toLat: widget.destinationLatitude,
    );
    if (!_teammateRoutes.containsKey(query)) {
      try {
        _teammateRoutes[query] = await ref.read(
          drivingRouteProvider(query).future,
        );
      } catch (_) {
        _teammateRoutes[query] = null;
      }
    }
    final route = _teammateRoutes[query];
    return route == null
        ? [origin, destination]
        : [for (final (lng, lat) in route.coordinates) LatLng(lat, lng)];
  }

  static Color _color(String hex) =>
      Color(int.parse('FF${hex.substring(1)}', radix: 16));

  /// Serialised: map annotation calls are async, and overlapping redraws
  /// would leave duplicate markers behind.
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
      await controller.clearLines();

      final destination = LatLng(
        widget.destinationLatitude,
        widget.destinationLongitude,
      );
      final origin = _hasOrigin ? LatLng(_fromLat!, _fromLng!) : null;

      if (_showTeammates) {
        for (final mate in widget.teammates) {
          if (mate.isRoutable) {
            await controller.addLine(
              LineOptions(
                geometry: await _teammatePoints(mate),
                lineColor: mate.color,
                lineWidth: 3,
                lineOpacity: 0.75,
              ),
            );
          }
          await controller.addCircle(
            CircleOptions(
              geometry: LatLng(mate.latitude, mate.longitude),
              circleRadius: 8,
              circleColor: mate.color,
              circleStrokeColor: '#ffffff',
              circleStrokeWidth: 2,
            ),
          );
        }
      }

      if (origin != null) {
        final route = _ownRoute;
        final points = _mode == _RouteMode.driving && route != null
            ? [for (final (lng, lat) in route.coordinates) LatLng(lat, lng)]
            : [origin, destination];
        await controller.addLine(
          LineOptions(
            geometry: points,
            lineColor: MapColors.route,
            lineWidth: _mode == _RouteMode.driving ? 4 : 3,
            lineOpacity: _mode == _RouteMode.driving ? 0.9 : 0.6,
          ),
        );
        await controller.addCircle(
          CircleOptions(
            geometry: origin,
            circleRadius: 9,
            circleColor: _usingStation ? MapColors.station : MapColors.unit,
            circleStrokeColor: '#ffffff',
            circleStrokeWidth: 3,
          ),
        );
      }
      await controller.addCircle(
        CircleOptions(
          geometry: destination,
          circleRadius: 22,
          circleColor: MapColors.destination,
          circleOpacity: 0.22,
        ),
      );
      await controller.addCircle(
        CircleOptions(
          geometry: destination,
          circleRadius: 10,
          circleColor: MapColors.destination,
          circleStrokeColor: '#ffffff',
          circleStrokeWidth: 3,
        ),
      );

      if (!_framed) {
        _framed = true;
        await _frame(origin, destination);
      }
    } finally {
      _drawing = false;
      if (_redrawQueued) {
        _redrawQueued = false;
        unawaited(_redraw());
      }
    }
  }

  Future<void> _frame(LatLng? origin, LatLng destination) async {
    final controller = _controller;
    if (controller == null) return;
    if (origin == null) {
      await controller.animateCamera(
        CameraUpdate.newLatLngZoom(destination, 14),
      );
      return;
    }
    final south = origin.latitude < destination.latitude
        ? origin.latitude
        : destination.latitude;
    final north = origin.latitude > destination.latitude
        ? origin.latitude
        : destination.latitude;
    final west = origin.longitude < destination.longitude
        ? origin.longitude
        : destination.longitude;
    final east = origin.longitude > destination.longitude
        ? origin.longitude
        : destination.longitude;
    await controller.animateCamera(
      CameraUpdate.newLatLngBounds(
        LatLngBounds(
          southwest: LatLng(south, west),
          northeast: LatLng(north, east),
        ),
        left: 48,
        top: 48,
        right: 48,
        bottom: 48,
      ),
    );
  }

  void _setMode(_RouteMode mode) {
    if (mode == _mode) return;
    setState(() => _mode = mode);
    unawaited(_redraw());
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final p = context.palette;

    final query = _query;
    _ownRoute = _mode == _RouteMode.driving && query != null
        ? ref.watch(drivingRouteProvider(query)).value
        : null;

    // Repaint whenever the own route resolves.
    if (query != null) {
      ref.listen(drivingRouteProvider(query), (_, _) => unawaited(_redraw()));
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (_hasOrigin || widget.teammates.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                if (_hasOrigin) ...[
                  _ModeChip(
                    label: l10n.missionRouteMapDriving,
                    selected: _mode == _RouteMode.driving,
                    onTap: () => _setMode(_RouteMode.driving),
                  ),
                  _ModeChip(
                    label: l10n.missionRouteMapStraight,
                    selected: _mode == _RouteMode.straight,
                    onTap: () => _setMode(_RouteMode.straight),
                  ),
                ],
                if (widget.teammates.isNotEmpty)
                  _ModeChip(
                    label: l10n.missionRouteMapOtherUnits(
                      widget.teammates.length,
                    ),
                    selected: _showTeammates,
                    onTap: () {
                      setState(() => _showTeammates = !_showTeammates);
                      unawaited(_redraw());
                    },
                  ),
                if (_ownRoute != null && _mode == _RouteMode.driving)
                  Text(
                    '${_ownRoute!.distanceKm.toStringAsFixed(1)} km · ${_ownRoute!.durationMin.round()} min',
                    style: TextStyle(fontSize: 12, color: p.textMuted),
                  ),
              ],
            ),
          ),
        ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: SizedBox(
            height: 260,
            child: MapLibreMap(
              styleString: najdaMapStyle,
              initialCameraPosition: CameraPosition(
                target: LatLng(
                  widget.destinationLatitude,
                  widget.destinationLongitude,
                ),
                zoom: 13,
              ),
              gestureRecognizers: mapGestureRecognizers,
              compassEnabled: false,
              rotateGesturesEnabled: false,
              tiltGesturesEnabled: false,
              onMapCreated: (controller) => _controller = controller,
              onStyleLoadedCallback: () {
                _styleLoaded = true;
                unawaited(_redraw());
              },
            ),
          ),
        ),
        if (_showTeammates && widget.teammates.isNotEmpty) ...[
          const SizedBox(height: 8),
          Wrap(
            spacing: 12,
            runSpacing: 6,
            children: [
              for (final mate in widget.teammates)
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      height: 10,
                      width: 10,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: _color(mate.color),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      '${mate.label} · ${unitTypeLabel(l10n, mate.unitType)}',
                      style: TextStyle(fontSize: 12, color: p.textMuted),
                    ),
                  ],
                ),
            ],
          ),
        ],
        const SizedBox(height: 6),
        if (!_hasOrigin)
          Text(
            l10n.missionRouteMapNoUnitLocation,
            style: TextStyle(fontSize: 12, color: p.textMuted),
          )
        else if (_usingStation)
          Text(
            l10n.missionRouteMapFromStation,
            style: TextStyle(fontSize: 12, color: p.textMuted),
          ),
      ],
    );
  }
}

class _ModeChip extends StatelessWidget {
  const _ModeChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.palette;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: selected ? AppColors.blue600 : p.surface,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: selected ? AppColors.blue600 : p.border),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: selected ? Colors.white : p.text,
          ),
        ),
      ),
    );
  }
}
