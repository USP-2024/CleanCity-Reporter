import 'package:flutter/material.dart';

import '../../config.dart';
import '../../models/models.dart';
import '../../services/api.dart';
import '../../widgets/common.dart';
import 'report_details_screen.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  List<AppNotification> _items = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final data = await Api.get('/notifications');
      final list = (data['notifications'] as List)
          .map(
            (e) =>
                AppNotification.fromJson(Map<String, dynamic>.from(e as Map)),
          )
          .toList();
      if (!mounted) return;
      setState(() {
        _items = list;
        _error = null;
        _loading = false;
      });
      // Opening the screen marks everything as read (the list above still shows what was new).
      Api.patch('/notifications/read-all').catchError((_) {});
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
    Widget body;
    if (_loading) {
      body = const Center(child: CircularProgressIndicator());
    } else if (_error != null) {
      body = ErrorView(message: _error!, onRetry: _load);
    } else if (_items.isEmpty) {
      body = const Center(child: Text('No notifications yet'));
    } else {
      body = ListView.separated(
        itemCount: _items.length,
        separatorBuilder: (context, index) => const Divider(height: 1),
        itemBuilder: (context, i) {
          final n = _items[i];
          return ListTile(
            leading: Icon(
              n.isRead ? Icons.notifications_none : Icons.notifications_active,
              color: n.isRead
                  ? Colors.grey
                  : Theme.of(context).colorScheme.primary,
            ),
            title: Text(
              n.message,
              style: TextStyle(
                fontWeight: n.isRead ? FontWeight.normal : FontWeight.bold,
              ),
            ),
            subtitle: Text(fmtDate(n.createdAt)),
            trailing: n.reportId.isNotEmpty && n.reportId != 'null'
                ? const Icon(Icons.chevron_right)
                : null,
            onTap: n.reportId.isEmpty || n.reportId == 'null'
                ? null
                : () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => ReportDetailsScreen(reportId: n.reportId),
                    ),
                  ),
          );
        },
      );
    }
    return Scaffold(
      appBar: AppBar(title: const Text('Notifications')),
      body: RefreshIndicator(onRefresh: _load, child: body),
    );
  }
}
