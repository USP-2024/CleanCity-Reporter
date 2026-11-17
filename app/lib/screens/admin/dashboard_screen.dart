import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../../config.dart';
import '../../services/api.dart';
import '../../widgets/common.dart';

/// Admin dashboard: summary numbers and charts from GET /api/stats.
class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  Map<String, dynamic>? _stats;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final data = await Api.get('/stats');
      if (!mounted) return;
      setState(() {
        _stats = Map<String, dynamic>.from(data as Map);
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

  Map<String, int> _asMap(dynamic raw) {
    final result = <String, int>{};
    if (raw is Map) {
      raw.forEach((k, v) => result[k.toString()] = (v as num).toInt());
    }
    return result;
  }

  Widget _summaryCard(String label, int value, IconData icon, Color color) {
    return Expanded(
      child: Card(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
          child: Column(
            children: [
              Icon(icon, color: color),
              const SizedBox(height: 6),
              Text(
                '$value',
                style: const TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                ),
              ),
              Text(
                label,
                style: TextStyle(fontSize: 12, color: Colors.grey.shade700),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _chartCard(String title, Widget chart, {double height = 220}) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
            ),
            const SizedBox(height: 14),
            SizedBox(height: height, child: chart),
          ],
        ),
      ),
    );
  }

  Widget _statusPie(Map<String, int> byStatus) {
    final entries = statusOrder.where((s) => (byStatus[s] ?? 0) > 0).toList();
    if (entries.isEmpty) return const Center(child: Text('No data yet'));
    return Row(
      children: [
        Expanded(
          child: PieChart(
            PieChartData(
              sectionsSpace: 2,
              centerSpaceRadius: 34,
              sections: [
                for (final s in entries)
                  PieChartSectionData(
                    value: byStatus[s]!.toDouble(),
                    color: statusColor(s),
                    radius: 48,
                    title: '${byStatus[s]}',
                    titleStyle: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
              ],
            ),
          ),
        ),
        const SizedBox(width: 12),
        Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (final s in entries)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 3),
                child: Row(
                  children: [
                    Icon(Icons.circle, size: 12, color: statusColor(s)),
                    const SizedBox(width: 6),
                    Text(
                      statusLabels[s] ?? s,
                      style: const TextStyle(fontSize: 13),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ],
    );
  }

  Widget _barChart(
    Map<String, int> data,
    Color color, {
    Map<String, String>? labels,
  }) {
    final keys = data.keys.toList()..sort();
    if (keys.isEmpty) return const Center(child: Text('No data yet'));
    final maxValue = data.values.fold<int>(0, (a, b) => a > b ? a : b);
    final interval = (maxValue / 4).ceil() < 1
        ? 1.0
        : (maxValue / 4).ceil().toDouble();

    return BarChart(
      BarChartData(
        alignment: BarChartAlignment.spaceAround,
        maxY: maxValue + interval,
        gridData: const FlGridData(show: true, drawVerticalLine: false),
        borderData: FlBorderData(show: false),
        titlesData: FlTitlesData(
          topTitles: const AxisTitles(
            sideTitles: SideTitles(showTitles: false),
          ),
          rightTitles: const AxisTitles(
            sideTitles: SideTitles(showTitles: false),
          ),
          leftTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 28,
              interval: interval,
            ),
          ),
          bottomTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 30,
              getTitlesWidget: (value, meta) {
                final i = value.toInt();
                if (i < 0 || i >= keys.length) return const SizedBox.shrink();
                final name = labels?[keys[i]] ?? keys[i];
                return Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(name, style: const TextStyle(fontSize: 10)),
                );
              },
            ),
          ),
        ),
        barGroups: [
          for (var i = 0; i < keys.length; i++)
            BarChartGroupData(
              x: i,
              barRods: [
                BarChartRodData(
                  toY: data[keys[i]]!.toDouble(),
                  color: color,
                  width: 18,
                  borderRadius: const BorderRadius.vertical(
                    top: Radius.circular(4),
                  ),
                ),
              ],
            ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null || _stats == null) {
      return ErrorView(
        message: _error ?? 'Could not load the dashboard',
        onRetry: () {
          setState(() => _loading = true);
          _load();
        },
      );
    }

    final s = _stats!;
    final byStatus = _asMap(s['byStatus']);
    final open =
        (byStatus['reported'] ?? 0) +
        (byStatus['assigned'] ?? 0) +
        (byStatus['in_progress'] ?? 0);
    final primary = Theme.of(context).colorScheme.primary;

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(12),
        children: [
          Row(
            children: [
              _summaryCard(
                'Total reports',
                (s['total'] as num).toInt(),
                Icons.report_outlined,
                Colors.blueGrey,
              ),
              _summaryCard(
                'Open',
                open,
                Icons.pending_actions,
                Colors.orange.shade700,
              ),
            ],
          ),
          Row(
            children: [
              _summaryCard(
                'Needs review',
                byStatus['pending_review'] ?? 0,
                Icons.rate_review_outlined,
                Colors.purple.shade500,
              ),
              _summaryCard(
                'Resolved',
                byStatus['resolved'] ?? 0,
                Icons.check_circle_outline,
                Colors.green.shade700,
              ),
            ],
          ),
          _chartCard('Reports by status', _statusPie(byStatus)),
          _chartCard(
            'Reports by category',
            _barChart(_asMap(s['byCategory']), primary, labels: categories),
          ),
          _chartCard(
            'Reports by ward',
            _barChart(_asMap(s['byWard']), Colors.teal),
          ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }
}
