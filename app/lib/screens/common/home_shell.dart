import 'package:flutter/material.dart';

import '../citizen/new_report_screen.dart';
import 'notification_bell.dart';

class TabItem {
  final String label;
  final IconData icon;
  final Widget page;
  const TabItem(this.label, this.icon, this.page);
}

/// Common layout for all three roles: app bar with notification bell,
/// bottom navigation, and (for citizens) the "Report" button.
class HomeShell extends StatefulWidget {
  final List<TabItem> tabs;
  final bool showReportButton;

  const HomeShell({
    super.key,
    required this.tabs,
    this.showReportButton = false,
  });

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;
  int _tick = 0; // bumped to force the current tab to reload

  @override
  Widget build(BuildContext context) {
    final tab = widget.tabs[_index];
    return Scaffold(
      appBar: AppBar(
        title: Text(tab.label),
        actions: const [NotificationBell()],
      ),
      // The key makes the tab rebuild (and re-fetch its data) whenever we switch tabs.
      body: KeyedSubtree(key: ValueKey('$_index-$_tick'), child: tab.page),
      floatingActionButton: widget.showReportButton
          ? FloatingActionButton.extended(
              onPressed: () async {
                await Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const NewReportScreen()),
                );
                if (mounted) setState(() => _tick++);
              },
              icon: const Icon(Icons.add_a_photo),
              label: const Text('Report'),
            )
          : null,
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: [
          for (final t in widget.tabs)
            NavigationDestination(icon: Icon(t.icon), label: t.label),
        ],
      ),
    );
  }
}
