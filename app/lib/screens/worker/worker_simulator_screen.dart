import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';

import '../../services/api.dart';
import '../../widgets/common.dart';
import '../../widgets/sim_view.dart';

/// 3D cleaning simulator. The worker steers a character, cleans the garbage and takes a photo.
/// The photo is sent to the backend as a SIMULATION submission (never as a real report).
class WorkerSimulatorScreen extends StatefulWidget {
  const WorkerSimulatorScreen({super.key});

  @override
  State<WorkerSimulatorScreen> createState() => _WorkerSimulatorScreenState();
}

class _WorkerSimulatorScreenState extends State<WorkerSimulatorScreen> {
  final _sim = GlobalKey<SimViewState>();
  bool _uploaded = false;

  Future<void> _onMessage(Map<String, dynamic> message) async {
    switch (message['type']) {
      case 'photo':
        await _upload(message);
        break;
      case 'close':
        if (mounted) Navigator.pop(context, _uploaded);
        break;
      case 'jsError':
        if (mounted)
          showMsg(
            context,
            '3D view problem: ${message['message']}',
            error: true,
          );
        break;
    }
  }

  /// The 3D scene sends the photo as base64 text. Save it as a file and upload it.
  Future<void> _upload(Map<String, dynamic> m) async {
    File? file;
    try {
      final base64Text = (m['image'] as String).split(',').last;
      final bytes = base64Decode(base64Text);
      file = File(
        '${Directory.systemTemp.path}/sim_${DateTime.now().millisecondsSinceEpoch}.jpg',
      );
      await file.writeAsBytes(bytes);

      await Api.upload(
        '/simulations',
        filePath: file.path,
        fields: {
          'itemsCleaned': '${m['itemsCleaned']}',
          'totalItems': '${m['totalItems']}',
          'durationSec': '${m['durationSec']}',
          'scenario': '${m['scenario'] ?? ''}',
        },
      );
      _uploaded = true;
      await _sim.currentState?.uploadResult(true, 'Uploaded');
    } on ApiException catch (e) {
      await _sim.currentState?.uploadResult(false, e.message);
    } catch (e) {
      await _sim.currentState?.uploadResult(
        false,
        'Could not send the photo: $e',
      );
    } finally {
      try {
        await file?.delete();
      } catch (_) {}
    }
  }

  void _showInfo() {
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        icon: const Icon(Icons.view_in_ar, size: 36),
        title: const Text('Training simulator'),
        content: const Text(
          'This is a practice mode. A citizen reports garbage, the admin assigns the job, '
          'and you clean it with the joystick, take a photo and upload it.\n\n'
          'The admin sees your submission in the Control Room and approves or rejects it. '
          'It never counts as a real report.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Got it'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Cleaning simulator'),
        actions: [
          IconButton(
            icon: const Icon(Icons.info_outline),
            onPressed: _showInfo,
          ),
        ],
      ),
      body: SimView(
        key: _sim,
        mode: 'cleaner',
        data: const {'scenario': 'Garbage clean-up training'},
        onMessage: _onMessage,
      ),
    );
  }
}
