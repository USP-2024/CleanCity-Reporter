import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../../config.dart';
import '../../models/models.dart';
import '../../services/api.dart';
import '../../widgets/common.dart';
import 'report_details_screen.dart';

/// All reports as colour-coded pins on an OpenStreetMap map.
class ReportsMapScreen extends StatefulWidget {
  const ReportsMapScreen({super.key});

  @override
  State<ReportsMapScreen> createState() => _ReportsMapScreenState();
}

class _ReportsMapScreenState extends State<ReportsMapScreen> {
  List<Report> _reports = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final data = await Api.get('/reports');
      final list = (data['reports'] as List)
          .map((e) => Report.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList();
      if (!mounted) return;
      setState(() {
        _reports = list;
        _error = null;
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _loading = false;
      });
    }
  }

  LatLng get _center {
    if (_reports.isEmpty) return const LatLng(defaultLat, defaultLng);
    final lat =
        _reports.map((r) => r.lat).reduce((a, b) => a + b) / _reports.length;
    final lng =
        _reports.map((r) => r.lng).reduce((a, b) => a + b) / _reports.length;
    return LatLng(lat, lng);
  }

  @override
  Widget build(BuildContext context) {
    if (_loading && _reports.isEmpty)
      return const Center(child: CircularProgressIndicator());
    if (_error != null) return ErrorView(message: _error!, onRetry: _load);

    return Stack(
      children: [
        FlutterMap(
          options: MapOptions(initialCenter: _center, initialZoom: 14.5),
          children: [
            TileLayer(
              urlTemplate: tileUrl,
              userAgentPackageName: tileUserAgent,
            ),
            MarkerLayer(
              markers: [
                for (final r in _reports)
                  Marker(
                    point: LatLng(r.lat, r.lng),
                    width: 40,
                    height: 40,
                    alignment: Alignment.topCenter,
                    child: GestureDetector(
                      onTap: () async {
                        await Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => ReportDetailsScreen(reportId: r.id),
                          ),
                        );
                        _load();
                      },
                      child: Icon(
                        Icons.location_on,
                        size: 40,
                        color: statusColor(r.status),
                      ),
                    ),
                  ),
              ],
            ),
          ],
        ),
        Positioned(
          top: 8,
          left: 8,
          right: 8,
          child: Card(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              child: Wrap(
                spacing: 12,
                runSpacing: 4,
                alignment: WrapAlignment.center,
                children: [
                  for (final s in statusOrder)
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.circle, size: 10, color: statusColor(s)),
                        const SizedBox(width: 4),
                        Text(
                          statusLabels[s] ?? s,
                          style: const TextStyle(fontSize: 11),
                        ),
                      ],
                    ),
                ],
              ),
            ),
          ),
        ),
        Positioned(
          bottom: 16,
          left: 16,
          child: FloatingActionButton.small(
            heroTag: 'mapRefresh',
            onPressed: _load,
            child: const Icon(Icons.refresh),
          ),
        ),
      ],
    );
  }
}
