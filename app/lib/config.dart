import 'package:flutter/material.dart';

// ---------------------------------------------------------------------------
// SERVER ADDRESS
// Android emulator  -> http://10.0.2.2:5000   (10.0.2.2 = your laptop)
// Real phone (same Wi-Fi) -> http://<your-laptop-ip>:5000   e.g. http://192.168.1.5:5000
// ---------------------------------------------------------------------------
const String baseUrl = 'http://10.0.2.2:5001';
const String apiUrl = '$baseUrl/api';

/// true  = camera AND gallery buttons (easy testing on an emulator)
/// false = camera ONLY (use this for the final demo, so photos must be real)
const bool allowGalleryUpload = true;

/// Shows quick "fill demo login" buttons on the login screen.
const bool showDemoLogins = true;

/// Map centre when there are no reports yet (Andheri East, Mumbai).
const double defaultLat = 19.1136;
const double defaultLng = 72.8697;

const String tileUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const String tileUserAgent = 'com.cleancity.cleancity_app';

const List<String> wards = [
  'Ward A',
  'Ward B',
  'Ward C',
  'Ward D',
  'Ward E',
  'Ward F',
];

const Map<String, String> categories = {
  'garbage': 'Garbage',
  'pothole': 'Pothole',
  'waterlogging': 'Waterlogging',
  'streetlight': 'Streetlight',
  'other': 'Other',
};

const List<String> statusOrder = [
  'reported',
  'assigned',
  'in_progress',
  'pending_review',
  'resolved',
];

const Map<String, String> statusLabels = {
  'reported': 'Reported',
  'assigned': 'Assigned',
  'in_progress': 'In Progress',
  'pending_review': 'Pending Review',
  'resolved': 'Resolved',
};

Color statusColor(String status) {
  switch (status) {
    case 'reported':
      return Colors.red.shade600;
    case 'assigned':
      return Colors.orange.shade700;
    case 'in_progress':
      return Colors.blue.shade600;
    case 'pending_review':
      return Colors.purple.shade500;
    case 'resolved':
      return Colors.green.shade700;
    default:
      return Colors.grey;
  }
}

IconData categoryIcon(String category) {
  switch (category) {
    case 'garbage':
      return Icons.delete_outline;
    case 'pothole':
      return Icons.warning_amber_rounded;
    case 'waterlogging':
      return Icons.water_drop_outlined;
    case 'streetlight':
      return Icons.lightbulb_outline;
    default:
      return Icons.report_problem_outlined;
  }
}

/// Photos are stored on the server as "/uploads/xyz.jpg" -> turn into a full URL.
String imageUrl(String? path) {
  if (path == null || path.isEmpty) return '';
  if (path.startsWith('http')) return path;
  return '$baseUrl$path';
}

String fmtDate(DateTime date) {
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  final d = date.toLocal();
  final hh = d.hour.toString().padLeft(2, '0');
  final mm = d.minute.toString().padLeft(2, '0');
  return '${d.day} ${months[d.month - 1]} ${d.year}, $hh:$mm';
}

// ---------------------------------------------------------------- simulations
const Map<String, String> simStatusLabels = {
  'pending': 'Pending review',
  'approved': 'Approved',
  'rejected': 'Rejected',
};

Color simStatusColor(String status) {
  switch (status) {
    case 'approved':
      return Colors.green.shade700;
    case 'rejected':
      return Colors.red.shade600;
    default:
      return Colors.purple.shade500;
  }
}

String fmtDuration(int seconds) =>
    '${seconds ~/ 60}:${(seconds % 60).toString().padLeft(2, '0')}';
