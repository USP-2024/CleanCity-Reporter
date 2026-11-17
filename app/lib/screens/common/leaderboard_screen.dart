import 'package:flutter/material.dart';

import '../../services/api.dart';
import '../../widgets/common.dart';

class LeaderboardScreen extends StatefulWidget {
  const LeaderboardScreen({super.key});

  @override
  State<LeaderboardScreen> createState() => _LeaderboardScreenState();
}

class _LeaderboardScreenState extends State<LeaderboardScreen> {
  List<Map<String, dynamic>> _wards = [];
  List<Map<String, dynamic>> _citizens = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final data = await Api.get('/leaderboard');
      if (!mounted) return;
      setState(() {
        _wards = (data['wards'] as List)
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
        _citizens = (data['citizens'] as List)
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
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

  Color _medal(int index) {
    if (index == 0) return Colors.amber.shade600;
    if (index == 1) return Colors.blueGrey.shade300;
    if (index == 2) return Colors.brown.shade300;
    return Colors.grey.shade400;
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null) return ErrorView(message: _error!, onRetry: _load);

    final maxResolved = _wards.isEmpty
        ? 1
        : _wards
              .map((w) => (w['resolved'] as num).toInt())
              .reduce((a, b) => a > b ? a : b);

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(12),
        children: [
          Text('Cleanest ward', style: Theme.of(context).textTheme.titleLarge),
          const Text('Ranked by issues resolved'),
          const SizedBox(height: 8),
          if (_wards.isEmpty)
            const Padding(
              padding: EdgeInsets.all(16),
              child: Text('No resolved reports yet.'),
            ),
          for (var i = 0; i < _wards.length; i++)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Row(
                  children: [
                    CircleAvatar(
                      backgroundColor: _medal(i),
                      foregroundColor: Colors.white,
                      child: Text('${i + 1}'),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _wards[i]['ward'].toString(),
                            style: const TextStyle(fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 6),
                          LinearProgressIndicator(
                            value:
                                (_wards[i]['resolved'] as num).toDouble() /
                                maxResolved,
                            minHeight: 8,
                            borderRadius: BorderRadius.circular(4),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    Text('${_wards[i]['resolved']} resolved'),
                  ],
                ),
              ),
            ),
          const SizedBox(height: 20),
          Text('Top citizens', style: Theme.of(context).textTheme.titleLarge),
          const Text('Points for verified reports'),
          const SizedBox(height: 8),
          if (_citizens.isEmpty)
            const Padding(
              padding: EdgeInsets.all(16),
              child: Text('No citizens yet.'),
            ),
          for (var i = 0; i < _citizens.length; i++)
            Card(
              child: ListTile(
                leading: CircleAvatar(
                  backgroundColor: _medal(i),
                  foregroundColor: Colors.white,
                  child: Text('${i + 1}'),
                ),
                title: Text(_citizens[i]['name'].toString()),
                trailing: Text(
                  '${_citizens[i]['points']} pts',
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
