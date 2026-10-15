import '../../../core/utils/wire_enum.dart';

enum Role {
  citizen,
  dispatcher,
  ambulanceCrew,
  police,
  firefighter,
  firstResponder,
  hospitalStaff,
  admin,
  superAdmin;

  static Role fromJson(Object? wire) => enumFromWire(Role.values, wire);

  /// Roles that get a dedicated field UI in this app (shift, missions).
  bool get isResponder => switch (this) {
    Role.ambulanceCrew ||
    Role.police ||
    Role.firefighter ||
    Role.firstResponder => true,
    _ => false,
  };

  /// Desk roles (Dispatcher / Hospital Staff / Admin / Super Admin) work from
  /// the web console and have no mobile surface. They can sign in, but the app
  /// shows them a "use the web dashboard" page rather than the citizen SOS
  /// screen, so nobody files a false report by tapping around.
  bool get isDesk => !isResponder && this != Role.citizen;
}
