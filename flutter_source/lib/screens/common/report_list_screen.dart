import 'package:flutter/material.dart';

import '../../config.dart';
import '../../models/models.dart';
import '../../services/api.dart';
import '../../widgets/common.dart';
import 'report_details_screen.dart';

/// List of reports with status filter chips.
/// mode: 'mine' (citizen's own), 'assigned' (worker's tasks), 'all' (admin).
class ReportListScreen extends StatefulWidget {
  final String mode;
  const ReportListScreen({super.key, required this.mode});

  @override
  State<ReportListScreen> createState() => _ReportListScreenState();
}

class _ReportListScreenState extends State<ReportListScreen> {
  List<Report> _reports = [];
  bool _loading = true;
  String? _error;
  String _status = ''; // '' = all

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final query = <String, String>{};
    if (widget.mode == 'mine') query['mine'] = 'true';
    if (widget.mode == 'assigned') query['assigned'] = 'true';
    if (_status.isNotEmpty) query['status'] = _status;

    try {
      final data = await Api.get('/reports', query: query);
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

  String get _emptyText {
    switch (widget.mode) {
      case 'mine':
        return 'You have not reported anything yet.\nTap "Report" to add your first one.';
      case 'assigned':
        return 'No tasks assigned to you right now.';
      default:
        return 'No reports found.';
    }
  }

  @override
  Widget build(BuildContext context) {
    final filters = ['', ...statusOrder];

    Widget list;
    if (_loading) {
      list = const Center(child: CircularProgressIndicator());
    } else if (_error != null) {
      list = ErrorView(
        message: _error!,
        onRetry: () {
          setState(() => _loading = true);
          _load();
        },
      );
    } else {
      list = RefreshIndicator(
        onRefresh: _load,
        child: _reports.isEmpty
            ? ListView(
                children: [
                  const SizedBox(height: 120),
                  Center(child: Text(_emptyText, textAlign: TextAlign.center)),
                ],
              )
            : ListView.builder(
                padding: const EdgeInsets.only(bottom: 90, top: 4),
                itemCount: _reports.length,
                itemBuilder: (context, i) {
                  final r = _reports[i];
                  return ReportCard(
                    report: r,
                    onTap: () async {
                      await Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => ReportDetailsScreen(reportId: r.id),
                        ),
                      );
                      _load();
                    },
                  );
                },
              ),
      );
    }

    return Column(
      children: [
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
                label: Text(f.isEmpty ? 'All' : (statusLabels[f] ?? f)),
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
        Expanded(child: list),
      ],
    );
  }
}
