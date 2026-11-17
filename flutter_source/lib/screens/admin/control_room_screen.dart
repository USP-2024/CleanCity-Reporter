import 'dart:async';

import 'package:flutter/material.dart';

import '../../models/models.dart';
import '../../services/api.dart';
import '../../widgets/common.dart';
import '../../widgets/sim_view.dart';
import '../common/report_details_screen.dart';
import '../common/reports_map_screen.dart';
import '../common/simulation_details_screen.dart';
import '../common/simulation_list_screen.dart';

/// Admin "Control Room": 3D CCTV digital twin, 2D map and the simulation review queue.
/// (The three tabs are switched by hand with a plain state variable instead of a TabBarView,
/// which keeps the 3D web view simple and reliable.)
class ControlRoomScreen extends StatefulWidget {
  const ControlRoomScreen({super.key});

  @override
  State<ControlRoomScreen> createState() => _ControlRoomScreenState();
}

class _ControlRoomScreenState extends State<ControlRoomScreen> {
  int _tab = 0;

  static const _labels = ['3D CCTV', 'Map', 'Sim reviews'];
  static const _icons = [Icons.videocam_outlined, Icons.map_outlined, Icons.rate_review_outlined];

  Widget _page() {
    switch (_tab) {
      case 1:
        return const ReportsMapScreen();
      case 2:
        return const SimulationListScreen(admin: true);
      default:
        return const _CctvTab();
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Column(
      children: [
        Material(
          color: scheme.surface,
          child: Row(
            children: [
              for (var i = 0; i < _labels.length; i++)
                Expanded(
                  child: InkWell(
                    onTap: () => setState(() => _tab = i),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      decoration: BoxDecoration(
                        border: Border(
                          bottom: BorderSide(
                            width: 3,
                            color: _tab == i ? scheme.primary : Colors.transparent,
                          ),
                        ),
                      ),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(_icons[i], color: _tab == i ? scheme.primary : scheme.onSurfaceVariant),
                          const SizedBox(height: 2),
                          Text(
                            _labels[i],
                            style: TextStyle(
                              fontWeight: FontWeight.w600,
                              color: _tab == i ? scheme.primary : scheme.onSurfaceVariant,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
        // the key makes the page rebuild (and re-fetch its data) when the tab changes
        Expanded(child: KeyedSubtree(key: ValueKey(_tab), child: _page())),
      ],
    );
  }
}

class _CctvTab extends StatefulWidget {
  const _CctvTab();

  @override
  State<_CctvTab> createState() => _CctvTabState();
}

class _CctvTabState extends State<_CctvTab> {
  final _sim = GlobalKey<SimViewState>();
  Map<String, dynamic>? _data;
  String? _error;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _load(first: true);
    // the 3D city refreshes itself every 15 seconds
    _timer = Timer.periodic(const Duration(seconds: 15), (_) => _load());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  /// Reads the real reports + simulations from the backend and shapes them for the 3D scene.
  Future<Map<String, dynamic>> _fetch() async {
    final reports = await Api.get('/reports');
    final sims = await Api.get('/simulations');
    return {
      'reports': (reports['reports'] as List).map((e) {
        final r = Report.fromJson(Map<String, dynamic>.from(e as Map));
        return {
          'id': r.id,
          'title': r.title,
          'ward': r.ward,
          'status': r.status,
          'category': r.category,
        };
      }).toList(),
      'simulations': (sims['simulations'] as List).map((e) {
        final s = SimSubmission.fromJson(Map<String, dynamic>.from(e as Map));
        return {
          'id': s.id,
          'workerName': s.workerName,
          'status': s.status,
          'itemsCleaned': s.itemsCleaned,
          'totalItems': s.totalItems,
        };
      }).toList(),
    };
  }

  Future<void> _load({bool first = false}) async {
    try {
      final data = await _fetch();
      if (!mounted) return;
      if (first) {
        setState(() {
          _data = data;
          _error = null;
        });
      } else {
        _data = data;
        await _sim.currentState?.update(data);
      }
    } on ApiException catch (e) {
      if (mounted && first) setState(() => _error = e.message);
    }
  }

  Future<void> _onMessage(Map<String, dynamic> message) async {
    switch (message['type']) {
      case 'openReport':
        await Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => ReportDetailsScreen(reportId: '${message['id']}'),
          ),
        );
        _load();
        break;
      case 'openSimulation':
        await Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) =>
                SimulationDetailsScreen(simulationId: '${message['id']}'),
          ),
        );
        _load();
        break;
      case 'jsError':
        if (mounted)
          showMsg(
            context,
            '3D view problem: ${message['message']}',
            error: true,
          );
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) {
      return ErrorView(
        message: _error!,
        onRetry: () {
          setState(() => _error = null);
          _load(first: true);
        },
      );
    }
    if (_data == null) return const Center(child: CircularProgressIndicator());
    return SimView(
      key: _sim,
      mode: 'control_room',
      data: _data!,
      onMessage: _onMessage,
    );
  }
}
