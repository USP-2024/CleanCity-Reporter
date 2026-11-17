import 'dart:io';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';

import '../../config.dart';
import '../../models/models.dart';
import '../../services/api.dart';
import '../../services/location.dart';
import '../../widgets/common.dart';

/// Worker: take the AFTER photo at the reported spot.
/// The server only accepts it if the worker is within 50 m of the report's GPS point.
class AfterPhotoScreen extends StatefulWidget {
  final Report report;
  const AfterPhotoScreen({super.key, required this.report});

  @override
  State<AfterPhotoScreen> createState() => _AfterPhotoScreenState();
}

class _AfterPhotoScreenState extends State<AfterPhotoScreen> {
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

  double? get _distance {
    final p = _position;
    if (p == null) return null;
    return Geolocator.distanceBetween(
      p.latitude,
      p.longitude,
      widget.report.lat,
      widget.report.lng,
    );
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

  Future<void> _submit() async {
    final pos = _position;
    if (_photoPath == null || pos == null) {
      showMsg(
        context,
        'Take the photo and wait for your GPS location',
        error: true,
      );
      return;
    }
    setState(() => _busy = true);
    try {
      await Api.upload(
        '/reports/${widget.report.id}/after-photo',
        filePath: _photoPath!,
        fields: {'lat': '${pos.latitude}', 'lng': '${pos.longitude}'},
      );
      if (!mounted) return;
      Navigator.pop(context, true);
    } on ApiException catch (e) {
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (ctx) => AlertDialog(
          icon: Icon(Icons.location_off, color: Colors.red.shade700, size: 36),
          title: const Text('Photo not accepted'),
          content: Text(e.message),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('OK'),
            ),
          ],
        ),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final r = widget.report;
    final distance = _distance;
    final near = distance != null && distance <= 50;

    return Scaffold(
      appBar: AppBar(title: const Text('After photo')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            r.title,
            style: Theme.of(context).textTheme.titleMedium
                ?.copyWith(fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          const Text('Before photo'),
          const SizedBox(height: 4),
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: NetImage(r.beforePhoto, width: double.infinity, height: 160),
          ),
          const SizedBox(height: 16),
          const Text('After photo (take it at the same spot)'),
          const SizedBox(height: 4),
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
                    child: Icon(
                      Icons.add_a_photo_outlined,
                      size: 44,
                      color: Colors.grey.shade600,
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
          Card(
            color: distance == null
                ? null
                : (near ? Colors.green.shade50 : Colors.red.shade50),
            child: ListTile(
              leading: Icon(
                near ? Icons.check_circle : Icons.my_location,
                color: distance == null
                    ? Colors.grey.shade600
                    : (near ? Colors.green.shade700 : Colors.red.shade700),
              ),
              title: Text(
                distance == null
                    ? (_locating
                          ? 'Getting your location...'
                          : 'Location not available')
                    : (near
                          ? 'You are ${distance.toStringAsFixed(0)} m from the spot. Good.'
                          : 'You are ${distance.toStringAsFixed(0)} m from the spot'),
              ),
              subtitle: Text(
                distance == null
                    ? (_locationError ?? 'Please wait')
                    : 'Reported spot: ${r.lat.toStringAsFixed(5)}, ${r.lng.toStringAsFixed(5)}\nThe photo is accepted only within 50 m.',
              ),
              isThreeLine: distance != null,
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
          const SizedBox(height: 16),
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
                  : const Text('Upload after photo'),
            ),
          ),
        ],
      ),
    );
  }
}
