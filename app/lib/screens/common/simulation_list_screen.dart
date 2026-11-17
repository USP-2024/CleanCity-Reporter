import 'package:flutter/material.dart';

import '../../config.dart';
import '../../models/models.dart';
import '../../services/api.dart';
import '../../widgets/common.dart';
import 'simulation_details_screen.dart';

/// List of simulation submissions.
/// admin = true  -> everybody's submissions (to review)
/// admin = false -> only the logged-in worker's own submissions
class SimulationListScreen extends StatefulWidget {
  final bool admin;
  final Widget? header;
  const SimulationListScreen({super.key, required this.admin, this.header});

  @override
  State<SimulationListScreen> createState() => _SimulationListScreenState();
}

class _SimulationListScreenState extends State<SimulationListScreen> {
  List<SimSubmission> _items = [];
  bool _loading = true;
  String? _error;
  String _status = ''; // '' = all

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final data = await Api.get(
        '/simulations',
        query: _status.isEmpty ? null : {'status': _status},
      );
      final list = (data['simulations'] as List)
          .map((e) => SimSubmission.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList();
      if (!mounted) return;
      setState(() {
        _items = list;
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

  @override
  Widget build(BuildContext context) {
    const filters = ['', 'pending', 'approved', 'rejected'];

    final children = <Widget>[
      if (widget.header != null) widget.header!,
      SizedBox(
        height: 52,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          itemCount: filters.length,
          separatorBuilder: (context, index) => const SizedBox(width: 8),
          itemBuilder: (context, i) {
            final f = filters[i];
            return ChoiceChip(
              label: Text(f.isEmpty ? 'All' : (simStatusLabels[f] ?? f)),
              selected: _status == f,
              onSelected: (_) {
                setState(() {
                  _status = f;
                  _loading = true;
                });
                _load();
              },
            );
          },
        ),
      ),
    ];

    if (_loading) {
      children.add(
        const Padding(
          padding: EdgeInsets.all(40),
          child: Center(child: CircularProgressIndicator()),
        ),
      );
    } else if (_error != null) {
      children.add(
        SizedBox(
          height: 260,
          child: ErrorView(message: _error!, onRetry: _load),
        ),
      );
    } else if (_items.isEmpty) {
      children.add(
        Padding(
          padding: const EdgeInsets.all(40),
          child: Center(
            child: Text(
              widget.admin
                  ? 'No simulations to show.'
                  : 'You have not submitted a simulation yet.',
              textAlign: TextAlign.center,
            ),
          ),
        ),
      );
    } else {
      for (final s in _items) {
        children.add(
          _SimulationCard(
            simulation: s,
            showWorker: widget.admin,
            onTap: () async {
              await Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => SimulationDetailsScreen(simulationId: s.id),
                ),
              );
              _load();
            },
          ),
        );
      }
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.only(bottom: 24),
        children: children,
      ),
    );
  }
}

class _SimulationCard extends StatelessWidget {
  final SimSubmission simulation;
  final bool showWorker;
  final VoidCallback onTap;

  const _SimulationCard({
    required this.simulation,
    required this.showWorker,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final s = simulation;
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Row(
          children: [
            NetImage(s.photo, width: 96, height: 96),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      showWorker ? s.workerName : s.scenario,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 15,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Cleaned ${s.itemsCleaned}/${s.totalItems}  |  ${fmtDuration(s.durationSec)}',
                      style: TextStyle(
                        color: Colors.grey.shade700,
                        fontSize: 13,
                      ),
                    ),
                    Text(
                      fmtDate(s.createdAt),
                      style: TextStyle(
                        color: Colors.grey.shade600,
                        fontSize: 12,
                      ),
                    ),
                    const SizedBox(height: 6),
                    SimStatusChip(s.status),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
