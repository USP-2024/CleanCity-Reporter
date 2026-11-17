import 'package:flutter/material.dart';

import '../common/home_shell.dart';
import '../common/leaderboard_screen.dart';
import '../common/profile_screen.dart';
import '../common/report_list_screen.dart';
import '../common/reports_map_screen.dart';

class CitizenHome extends StatelessWidget {
  const CitizenHome({super.key});

  @override
  Widget build(BuildContext context) {
    return HomeShell(
      showReportButton: true,
      tabs: [
        const TabItem('Map', Icons.map_outlined, ReportsMapScreen()),
        const TabItem(
          'My reports',
          Icons.list_alt,
          ReportListScreen(mode: 'mine'),
        ),
        const TabItem(
          'Leaderboard',
          Icons.emoji_events_outlined,
          LeaderboardScreen(),
        ),
        const TabItem('Profile', Icons.person_outline, ProfileScreen()),
      ],
    );
  }
}
