import 'dart:async';

import 'package:flutter/material.dart';

import '../../services/api.dart';
import 'notifications_screen.dart';

/// Bell icon with an unread badge. Checks the server every 15 seconds.
class NotificationBell extends StatefulWidget {
  const NotificationBell({super.key});

  @override
  State<NotificationBell> createState() => _NotificationBellState();
}

class _NotificationBellState extends State<NotificationBell> {
  int _unread = 0;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _load();
    _timer = Timer.periodic(const Duration(seconds: 15), (_) => _load());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final data = await Api.get('/notifications');
      if (!mounted) return;
      setState(() => _unread = ((data['unread'] ?? 0) as num).toInt());
    } catch (_) {
      // ignore: the bell is not important enough to show an error
    }
  }

  @override
  Widget build(BuildContext context) {
    return IconButton(
      tooltip: 'Notifications',
      onPressed: () async {
        await Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => const NotificationsScreen()),
        );
        _load();
      },
      icon: Badge(
        isLabelVisible: _unread > 0,
        label: Text('$_unread'),
        child: const Icon(Icons.notifications_outlined),
      ),
    );
  }
}
