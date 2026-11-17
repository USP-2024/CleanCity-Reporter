import 'package:flutter/material.dart';

import '../common/simulation_list_screen.dart';
import 'worker_simulator_screen.dart';

/// Worker tab: start the 3D simulator and see the status of earlier submissions.
class SimulatorHubScreen extends StatefulWidget {
  const SimulatorHubScreen({super.key});

  @override
  State<SimulatorHubScreen> createState() => _SimulatorHubScreenState();
}

class _SimulatorHubScreenState extends State<SimulatorHubScreen> {
  int _tick = 0;

  Future<void> _start() async {
    await Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const WorkerSimulatorScreen()),
    );
    if (mounted) setState(() => _tick++);
  }

  @override
  Widget build(BuildContext context) {
    final header = Card(
      margin: const EdgeInsets.all(12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  Icons.view_in_ar,
                  size: 34,
                  color: Theme.of(context).colorScheme.primary,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    '3D cleaning simulator',
                    style: Theme.of(context).textTheme.titleLarge
                        ?.copyWith(fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            const Text(
              'Practice a clean-up job: a citizen reports garbage, the admin assigns it, '
              'you clean the area with the joystick, take a photo and upload it. '
              'The admin reviews it from the CCTV control room.',
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: _start,
                icon: const Icon(Icons.play_arrow),
                label: const Padding(
                  padding: EdgeInsets.symmetric(vertical: 10),
                  child: Text('Start simulation'),
                ),
              ),
            ),
          ],
        ),
      ),
    );

    return SimulationListScreen(
      key: ValueKey(_tick),
      admin: false,
      header: header,
    );
  }
}
