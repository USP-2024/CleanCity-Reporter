import 'package:flutter/material.dart';

import '../common/home_shell.dart';
import '../common/profile_screen.dart';
import '../common/report_list_screen.dart';
import 'control_room_screen.dart';
import 'dashboard_screen.dart';
import 'users_screen.dart';

class AdminHome extends StatelessWidget {
  const AdminHome({super.key});

  @override
  Widget build(BuildContext context) {
    return HomeShell(
      tabs: [
        const TabItem('Dashboard', Icons.dashboard_outlined, DashboardScreen()),
        const TabItem('Reports', Icons.list_alt, ReportListScreen(mode: 'all')),
        const TabItem(
          'Control room',
          Icons.videocam_outlined,
          ControlRoomScreen(),
        ),
        const TabItem('Users', Icons.group_outlined, UsersScreen()),
        const TabItem('Profile', Icons.person_outline, ProfileScreen()),
      ],
    );
  }
}
