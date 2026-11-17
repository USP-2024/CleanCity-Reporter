import 'package:geolocator/geolocator.dart';

import 'api.dart';

/// Asks for permission (if needed) and returns the current GPS position.
Future<Position> getCurrentPosition() async {
  final enabled = await Geolocator.isLocationServiceEnabled();
  if (!enabled) {
    throw ApiException('Location is turned off. Turn it on and try again.');
  }

  var permission = await Geolocator.checkPermission();
  if (permission == LocationPermission.denied) {
    permission = await Geolocator.requestPermission();
  }
  if (permission == LocationPermission.denied ||
      permission == LocationPermission.deniedForever) {
    throw ApiException(
      'Location permission denied. Allow it in the phone settings.',
    );
  }

  return Geolocator.getCurrentPosition(
    locationSettings: const LocationSettings(
      accuracy: LocationAccuracy.high,
      timeLimit: Duration(seconds: 20),
    ),
  );
}

String locationErrorText(Object e) {
  if (e is ApiException) return e.message;
  return 'Could not get your location. On the emulator, set one under "..." > Location.';
}
