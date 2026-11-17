import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../config.dart';
import '../../models/models.dart';
import '../../providers/auth_provider.dart';
import '../../services/api.dart';
import '../../widgets/common.dart';

/// One simulation submission. Admins can approve or reject it while it is pending.
class SimulationDetailsScreen extends StatefulWidget {
  final String simulationId;
  const SimulationDetailsScreen({super.key, required this.simulationId});

  @override
  State<SimulationDetailsScreen> createState() =>
      _SimulationDetailsScreenState();
}

class _SimulationDetailsScreenState extends State<SimulationDetailsScreen> {
  SimSubmission? _sim;
  String? _error;
  bool _loading = true;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final data = await Api.get('/simulations/${widget.simulationId}');
      if (!mounted) return;
      setState(() {
        _sim = SimSubmission.fromJson(
          Map<String, dynamic>.from(data['simulation']),
        );
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

  Future<void> _review(bool approve) async {
    String note = '';
    if (!approve) {
      final controller = TextEditingController();
      final ok = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Reject simulation'),
          content: TextField(
            controller: controller,
            decoration: const InputDecoration(
              labelText: 'Reason for the worker',
              border: OutlineInputBorder(),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Reject'),
            ),
          ],
        ),
      );
      note = controller.text.trim();
      if (ok != true) return;
    }
    setState(() => _busy = true);
    try {
      await Api.patch('/simulations/${_sim!.id}/review', {
        'approve': approve,
        'note': note,
      });
      if (!mounted) return;
      showMsg(
        context,
        approve
            ? 'Simulation approved'
            : 'Simulation rejected. The worker was notified.',
      );
      await _load();
    } on ApiException catch (e) {
      if (mounted) showMsg(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Widget _info(IconData icon, String text) => Padding(
    padding: const EdgeInsets.only(top: 6),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 18, color: Colors.grey.shade700),
        const SizedBox(width: 8),
        Expanded(child: Text(text)),
      ],
    ),
  );

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;

    Widget body;
    if (_loading) {
      body = const Center(child: CircularProgressIndicator());
    } else if (_error != null || _sim == null) {
      body = ErrorView(
        message: _error ?? 'Could not load this simulation',
        onRetry: () {
          setState(() => _loading = true);
          _load();
        },
      );
    } else {
      final s = _sim!;
      final complete = s.itemsCleaned >= s.totalItems && s.totalItems > 0;
      body = ListView(
        children: [
          Container(
            color: Colors.black,
            child: InteractiveViewer(
              child: NetImage(
                s.photo,
                width: double.infinity,
                height: 300,
                fit: BoxFit.contain,
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        s.scenario,
                        style: Theme.of(context).textTheme.titleLarge
                            ?.copyWith(fontWeight: FontWeight.bold),
                      ),
                    ),
                    const SizedBox(width: 8),
                    SimStatusChip(s.status),
                  ],
                ),
                const SizedBox(height: 6),
                _info(Icons.engineering_outlined, 'Worker: ${s.workerName}'),
                _info(
                  Icons.cleaning_services_outlined,
                  'Cleaned ${s.itemsCleaned} of ${s.totalItems} items${complete ? '' : ' (incomplete)'}',
                ),
                _info(
                  Icons.timer_outlined,
                  'Time taken: ${fmtDuration(s.durationSec)}',
                ),
                _info(Icons.schedule, 'Submitted ${fmtDate(s.createdAt)}'),
                if (s.status != 'pending') ...[
                  const SizedBox(height: 12),
                  Card(
                    color: s.status == 'approved'
                        ? Colors.green.shade50
                        : Colors.red.shade50,
                    child: ListTile(
                      leading: Icon(
                        s.status == 'approved'
                            ? Icons.check_circle_outline
                            : Icons.info_outline,
                        color: simStatusColor(s.status),
                      ),
                      title: Text(
                        s.status == 'approved' ? 'Approved' : 'Rejected',
                      ),
                      subtitle: Text(
                        '${s.reviewNote}${s.reviewerName.isEmpty ? '' : '\n- ${s.reviewerName}'}',
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 12),
                Card(
                  color: Colors.blueGrey.shade50,
                  child: const Padding(
                    padding: EdgeInsets.all(12),
                    child: Row(
                      children: [
                        Icon(Icons.view_in_ar_outlined),
                        SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'This is a training simulation. It is not a real report and gives no points.',
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                if (user != null &&
                    user.role == 'admin' &&
                    s.status == 'pending') ...[
                  const SizedBox(height: 12),
                  FilledButton.icon(
                    onPressed: _busy ? null : () => _review(true),
                    icon: const Icon(Icons.check),
                    label: const Text('Approve'),
                    style: FilledButton.styleFrom(
                      backgroundColor: Colors.green.shade700,
                    ),
                  ),
                  const SizedBox(height: 8),
                  OutlinedButton.icon(
                    onPressed: _busy ? null : () => _review(false),
                    icon: const Icon(Icons.close),
                    label: const Text('Reject'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.red.shade700,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Simulation')),
      body: Stack(
        children: [
          Positioned.fill(child: body),
          if (_busy)
            const Positioned(
              top: 0,
              left: 0,
              right: 0,
              child: LinearProgressIndicator(),
            ),
        ],
      ),
    );
  }
}
