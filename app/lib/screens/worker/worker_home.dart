import 'package:flutter/material.dart';

import '../common/home_shell.dart';
import '../common/profile_screen.dart';
import '../common/report_list_screen.dart';
import 'simulator_hub_screen.dart';

class WorkerHome extends StatelessWidget {
  const WorkerHome({super.key});

  @override
  Widget build(BuildContext context) {
    return HomeShell(
      tabs: [
        const TabItem(
          'My tasks',
          Icons.task_alt,
          ReportListScreen(mode: 'assigned'),
        ),
        const TabItem('Simulator', Icons.view_in_ar, SimulatorHubScreen()),
        const TabItem('Profile', Icons.person_outline, ProfileScreen()),
      ],
    );
  }
}
