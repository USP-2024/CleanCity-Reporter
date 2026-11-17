import 'dart:io';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';

import '../../config.dart';
import '../../models/models.dart';
import '../../services/api.dart';
import '../../services/location.dart';
import '../../widgets/common.dart';

/// Citizen: photo + GPS + details. Before saving, the server is asked whether a
/// similar report already exists within 100 m (duplicate detection).
class NewReportScreen extends StatefulWidget {
  const NewReportScreen({super.key});

  @override
  State<NewReportScreen> createState() => _NewReportScreenState();
}

class _NewReportScreenState extends State<NewReportScreen> {
  final _title = TextEditingController();
  final _description = TextEditingController();
  final _address = TextEditingController();

  String _category = 'garbage';
  String _ward = wards.first;
  String? _photoPath;
  Position? _position;
  String? _locationError;
  bool _locating = false;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _locate();
  }

  @override
  void dispose() {
    _title.dispose();
    _description.dispose();
    _address.dispose();
    super.dispose();
  }

  Future<void> _locate() async {
    setState(() {
      _locating = true;
      _locationError = null;
    });
    try {
      final pos = await getCurrentPosition();
      if (!mounted) return;
      setState(() => _position = pos);
    } catch (e) {
      if (!mounted) return;
      setState(() => _locationError = locationErrorText(e));
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  Future<void> _pickPhoto(ImageSource source) async {
    try {
      final file = await ImagePicker().pickImage(
        source: source,
        imageQuality: 75,
        maxWidth: 1600,
      );
      if (file != null && mounted) setState(() => _photoPath = file.path);
    } catch (e) {
      if (mounted) {
        showMsg(
          context,
          'Could not open the ${source == ImageSource.camera ? 'camera' : 'gallery'}: $e',
          error: true,
        );
      }
    }
  }

  /// Returns 'support', 'new' or null (cancel).
  Future<String?> _askAboutDuplicate(Report existing) {
    return showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Already reported nearby?'),
        content: Text(
          '"${existing.title}" (${statusLabels[existing.status]}) was reported within 100 m of you'
          '${existing.supportCount > 0 ? ' and ${existing.supportCount} people support it' : ''}.\n\n'
          'Is this the same problem?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, 'new'),
            child: const Text('No, report new'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, 'support'),
            child: const Text('Same - Me too'),
          ),
        ],
      ),
    );
  }

  Future<void> _submit() async {
    if (_photoPath == null) {
      showMsg(context, 'Add a photo of the problem first', error: true);
      return;
    }
    if (_title.text.trim().isEmpty) {
      showMsg(context, 'Give the report a short title', error: true);
      return;
    }
    final pos = _position;
    if (pos == null) {
      showMsg(context, 'Waiting for your GPS location', error: true);
      return;
    }

    setState(() => _busy = true);
    try {
      // 1. duplicate check
      final near = await Api.get(
        '/reports/nearby',
        query: {
          'lat': '${pos.latitude}',
          'lng': '${pos.longitude}',
          'category': _category,
        },
      );
      final similar = (near['reports'] as List)
          .map((e) => Report.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList();

      if (similar.isNotEmpty) {
        final choice = await _askAboutDuplicate(similar.first);
        if (choice == null) return;
        if (choice == 'support') {
          await Api.post('/reports/${similar.first.id}/upvote');
          if (!mounted) return;
          showMsg(
            context,
            'Thanks! Your support was added to the existing report.',
          );
          Navigator.pop(context);
          return;
        }
      }

      // 2. create the report
      await Api.upload(
        '/reports',
        filePath: _photoPath!,
        fields: {
          'title': _title.text.trim(),
          'description': _description.text.trim(),
          'category': _category,
          'ward': _ward,
          'address': _address.text.trim(),
          'lat': '${pos.latitude}',
          'lng': '${pos.longitude}',
        },
      );
      if (!mounted) return;
      showMsg(context, 'Report submitted. Thank you!');
      Navigator.pop(context);
    } on ApiException catch (e) {
      if (mounted) showMsg(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('New report')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // ---- photo
          Container(
            height: 210,
            decoration: BoxDecoration(
              color: Colors.grey.shade200,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.grey.shade400),
            ),
            clipBehavior: Clip.antiAlias,
            child: _photoPath == null
                ? Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.add_a_photo_outlined,
                          size: 44,
                          color: Colors.grey.shade600,
                        ),
                        const SizedBox(height: 8),
                        const Text('Add a photo of the problem'),
                      ],
                    ),
                  )
                : Image.file(
                    File(_photoPath!),
                    fit: BoxFit.cover,
                    width: double.infinity,
                  ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed: () => _pickPhoto(ImageSource.camera),
                  icon: const Icon(Icons.camera_alt),
                  label: const Text('Camera'),
                ),
              ),
              if (allowGalleryUpload) ...[
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => _pickPhoto(ImageSource.gallery),
                    icon: const Icon(Icons.photo_library_outlined),
                    label: const Text('Gallery'),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 16),

          // ---- location
          Card(
            child: ListTile(
              leading: Icon(
                Icons.my_location,
                color: _position != null
                    ? Colors.green.shade700
                    : Colors.grey.shade600,
              ),
              title: Text(
                _position != null
                    ? 'Location captured'
                    : (_locating
                          ? 'Getting your location...'
                          : 'Location not available'),
              ),
              subtitle: Text(
                _position != null
                    ? '${_position!.latitude.toStringAsFixed(5)}, ${_position!.longitude.toStringAsFixed(5)}'
                    : (_locationError ?? 'Please wait'),
              ),
              trailing: _locating
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : IconButton(
                      icon: const Icon(Icons.refresh),
                      tooltip: 'Refresh location',
                      onPressed: _locate,
                    ),
            ),
          ),
          const SizedBox(height: 12),

          // ---- details
          TextField(
            controller: _title,
            textCapitalization: TextCapitalization.sentences,
            decoration: const InputDecoration(
              labelText: 'Title (e.g. Garbage pile near bus stop)',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _description,
            maxLines: 3,
            textCapitalization: TextCapitalization.sentences,
            decoration: const InputDecoration(
              labelText: 'Description (optional)',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            value: _category,
            decoration: const InputDecoration(
              labelText: 'Category',
              border: OutlineInputBorder(),
            ),
            items: [
              for (final e in categories.entries)
                DropdownMenuItem(
                  value: e.key,
                  child: Row(
                    children: [
                      Icon(categoryIcon(e.key), size: 20),
                      const SizedBox(width: 10),
                      Text(e.value),
                    ],
                  ),
                ),
            ],
            onChanged: (v) => setState(() => _category = v ?? _category),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            value: _ward,
            decoration: const InputDecoration(
              labelText: 'Ward',
              border: OutlineInputBorder(),
            ),
            items: [
              for (final w in wards) DropdownMenuItem(value: w, child: Text(w)),
            ],
            onChanged: (v) => setState(() => _ward = v ?? _ward),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _address,
            decoration: const InputDecoration(
              labelText: 'Landmark / address (optional)',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 20),
          FilledButton(
            onPressed: _busy ? null : _submit,
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: _busy
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Submit report'),
            ),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}
