import '../../responder/domain/unit.dart';

/// Rough average speeds (km/h) for a first estimate; real routing is not
/// available to citizens, so this is always presented as approximate.
double _averageSpeedKmh(UnitType type) => switch (type) {
  UnitType.ambulance => 45,
  UnitType.fireTruck => 40,
  UnitType.policeCar => 50,
  UnitType.firstResponder => 35,
};

/// Whole minutes (at least 1) for [type] to cover [distanceMeters] in a straight line.
int estimatedArrivalMinutes(UnitType type, double distanceMeters) {
  final hours = (distanceMeters / 1000) / _averageSpeedKmh(type);
  return (hours * 60).ceil().clamp(1, 999);
}
